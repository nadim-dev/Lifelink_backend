import BloodBank from "../models/BloodbankModel.js";
import BloodRequest from "../models/bloodRequestModel.js";
import Counter from "../models/counterModel.js";
import Notification from "../models/notificationModel.js";

const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
const BLOOD_COMPONENTS = ["PRBC", "Platelets", "Plasma"];


const getDeliveryAddress = (user = {}) => {
  const completeAddress = user.short_address || [user.city, user.district, user.state].filter(Boolean).join(", ");
  
  return {
    completeAddress,
    city: user.city,
    district: user.district,
    state: user.state,
    pincode: user.pincode,
    location: user.location,
  };
};

const normalizePatient = (patient = {}) => ({
  name: patient.name?.trim(),
  contactNumber: patient.contactNumber?.trim(),
  alternateContactNumber: patient.alternateContactNumber?.trim() || undefined,
});

const getRequestItemSummary = (items = []) =>
  items
    .map((item) => `${item.quantity} ${item.bloodGroup} ${item.component}`)
    .join(", ");

export const createBloodRequest = async (req, res) => {
  try {
    const { bloodBankId } = req.params;
    const requestItems = Array.isArray(req.body.items)
      ? req.body.items
      : [{ component: req.body.component, bloodGroup: req.body.bloodGroup, quantity: req.body.quantity }];

    if (!requestItems.length) {
      return res.status(400).json({ message: "Please add at least one blood group to the request." });
    }

    const normalizedItems = requestItems.map((item) => ({
      component: item.component || "PRBC",
      bloodGroup: item.bloodGroup,
      quantity: Number(item.quantity),
    }));

    const hasInvalidItem = normalizedItems.some(
      (item) =>
        !BLOOD_COMPONENTS.includes(item.component) ||
        !BLOOD_GROUPS.includes(item.bloodGroup) ||
        !Number.isInteger(item.quantity) ||
        item.quantity < 1,
    );

    if (hasInvalidItem) {
      return res.status(400).json({ message: "Please select valid blood groups and quantities." });
    }

    const patient = normalizePatient(req.body.patient);

    if (!patient.name || !patient.contactNumber) {
      return res.status(400).json({ message: "Patient name and contact number are required for delivery." });
    }

    const bloodBank = await BloodBank.findOne({ _id: bloodBankId, status: "Approved" }).lean();

    if (!bloodBank) {
      return res.status(404).json({ message: "Blood bank not found." });
    }

    const inventoryByGroup = new Map(
      (bloodBank.inventory || []).map((item) => [
        `${item.type || item.component || "PRBC"}:${item.bloodGroup}`,
        {
          unitsAvailable: Number(item.unitsAvailable || 0),
          processingFee: Number(item.processingFee || 0),
        },
      ]),
    );

    for (const item of normalizedItems) {
      const inventoryItem = inventoryByGroup.get(`${item.component}:${item.bloodGroup}`);
      const availableUnits = inventoryItem?.unitsAvailable || 0;

      if (availableUnits < item.quantity) {
        return res.status(400).json({
          message: `Only ${availableUnits} ${item.bloodGroup} ${item.component} unit${availableUnits === 1 ? "" : "s"} available.`,
        });
      }
    }

    const paymentAmount = normalizedItems.reduce((total, item) => {
      const inventoryItem = inventoryByGroup.get(`${item.component}:${item.bloodGroup}`);
      return total + Number(inventoryItem?.processingFee || 0) * item.quantity;
    }, 0);

    const deliveryAddress = getDeliveryAddress(req.user);

    if (!deliveryAddress.completeAddress || !deliveryAddress.city || !deliveryAddress.state) {
      return res.status(400).json({
        message: "Please complete your profile location before requesting blood.",
      });
    }

  const counter = await Counter.findOneAndUpdate(
  { name: "bloodRequest" },
  { $inc: { value: 1 } },
  {
    new: true,
    upsert: true,
  }
);

const requestNumber = `BIT-${String(counter.value).padStart(6, "0")}`;

    const bloodRequest = await BloodRequest.create({
      userId: req.user._id,
      bloodBankId,
      items: normalizedItems,
      patient,
      deliveryAddress,
      requestNumber,
      payment: {
        amount: paymentAmount,
      },
      statusHistory: [
        {
          status: "Pending",
        },
      ],
    });

    await Notification.create({
      userId: bloodBank.userId,
      title: "New Blood Request",
      message: `${patient.name} requested ${getRequestItemSummary(normalizedItems)} from your blood bank.`,
      type: "Blood Request",
      actionUrl: "/blood-bank/requests",
    });

    return res.status(201).json({
      message: "Blood request submitted successfully.",
      bloodRequest,
    });
  } catch (err) {
    return res.status(500).json({ message: err.message || "Unable to create blood request." });
  }
};



export const getMyBloodRequests = async (req, res) => {
  try {
    const bloodRequests = await BloodRequest.find({ userId: req.user._id })
      .populate("bloodBankId", "bloodBankName phoneNumber address")
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({ bloodRequests });
  } catch (err) {
    return res.status(500).json({ message: err.message || "Unable to load blood requests." });
  }
};

export const getIncomingBloodBankRequests = async (req, res) => {
  try {
    const bloodBank = await BloodBank.findOne({ userId: req.user._id }).select("_id").lean();

    if (!bloodBank) {
      return res.status(404).json({ message: "Blood bank profile not found." });
    }

    const bloodRequests = await BloodRequest.find({ bloodBankId: bloodBank._id })
      .populate("userId", "username email phoneNumber picture")
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({ bloodRequests });
  } catch (err) {
    return res.status(500).json({ message: err.message || "Unable to load incoming blood requests." });
  }
};


export const rejectIncomingBloodBankRequest = async (req, res) => {
  try {
    const { reason = "" } = req.body;

    if (!reason.trim())
      return res.status(400).json({ message: "A rejection reason is required." });
    

    const bloodBank = await BloodBank.findOne({ userId: req.user._id }).select("_id").lean();

    if (!bloodBank) {
      return res.status(404).json({ message: "Blood bank profile not found." });
    }

    const bloodRequest = await BloodRequest.findOne({
      _id: req.params.requestId,
      bloodBankId: bloodBank._id,
    });

    if (!bloodRequest) {
      return res.status(404).json({ message: "Blood request not found." });
    }

    if (bloodRequest.requestStatus !== "Pending") {
      return res.status(400).json({ message: "Only pending blood requests can be rejected." });
    }

    bloodRequest.requestStatus = "Rejected";
    bloodRequest.statusHistory.push({
      status: "Rejected",
    });

    bloodRequest.rejectedAt = new Date();
    bloodRequest.rejectionReason = reason.trim();
      

    await bloodRequest.save();

    const updatedRequest = await BloodRequest.findById(bloodRequest._id)
      .populate("userId", "username email phoneNumber picture")
      .lean();

    return res.status(200).json({
      message: "Blood request rejected successfully.",
      bloodRequest: updatedRequest,
    });
  } catch (err) {
    return res.status(500).json({ message: err.message || "Unable to reject blood request." });
  }
};


export const approveIncomingBloodBankRequest = async (req, res) => {
  try {
    const bloodBank = await BloodBank.findOne({ userId: req.user._id });

    if (!bloodBank) {
      return res.status(404).json({ message: "Blood bank profile not found." });
    }

    const bloodRequest = await BloodRequest.findOne({
      _id: req.params.requestId,
      bloodBankId: bloodBank._id,
    });

    if (!bloodRequest) {
      return res.status(404).json({ message: "Blood request not found." });
    }

    if (bloodRequest.requestStatus !== "Pending") {
      return res.status(400).json({ message: "Only pending blood requests can be approved." });
    }

    for (const requestItem of bloodRequest.items || []) {
      const inventoryItem = (bloodBank.inventory || []).find(
        (item) =>
          item.bloodGroup === requestItem.bloodGroup &&
          (item.type || item.component || "PRBC") === requestItem.component,
      );

      if (!inventoryItem) {
        return res.status(400).json({
          message: `${requestItem.bloodGroup} ${requestItem.component} inventory is not available.`,
        });
      }

      const requestedUnits = Number(requestItem.quantity || 0);
      const availableUnits = Number(inventoryItem.unitsAvailable || 0);
      const committedUnits = Number(inventoryItem.unitsCommitted || 0);
      const remainingUnits = availableUnits - committedUnits;

      if (remainingUnits < requestedUnits) {
        return res.status(400).json({
          message: `Only ${remainingUnits} uncommitted ${requestItem.bloodGroup} ${requestItem.component} unit${remainingUnits === 1 ? "" : "s"} available.`,
        });
      }
    }

    for (const requestItem of bloodRequest.items || []) {
      const inventoryItem = bloodBank.inventory.find(
        (item) =>
          item.bloodGroup === requestItem.bloodGroup &&
          (item.type || item.component || "PRBC") === requestItem.component,
      );

      inventoryItem.unitsCommitted = Number(inventoryItem.unitsCommitted || 0) + Number(requestItem.quantity || 0);
    }

    bloodRequest.requestStatus = "Approved";
    bloodRequest.approvedAt = new Date();
    bloodRequest.statusHistory.push({
      status: "Approved",
    });

    await bloodBank.save();
    await bloodRequest.save();

    const updatedRequest = await BloodRequest.findById(bloodRequest._id)
      .populate("userId", "username email phoneNumber picture")
      .lean();

    return res.status(200).json({
      message: "Blood request approved successfully.",
      bloodRequest: updatedRequest,
    });
  } catch (err) {
    return res.status(500).json({ message: err.message || "Unable to approve blood request." });
  }
};


export const markIncomingBloodBankRequestReadyToDispatch = async (req, res) => {
  try {
    const bloodBank = await BloodBank.findOne({ userId: req.user._id });

    if (!bloodBank) {
      return res.status(404).json({ message: "Blood bank profile not found." });
    }

    const bloodRequest = await BloodRequest.findOne({
      _id: req.params.requestId,
      bloodBankId: bloodBank._id,
    });

    if (!bloodRequest) {
      return res.status(404).json({ message: "Blood request not found." });
    }

    if (bloodRequest.requestStatus !== "Approved") {
      return res.status(400).json({ message: "Only approved blood requests can be marked ready to dispatch." });
    }

    if (bloodRequest.deliveryStatus !== "NotAssigned") {
      return res.status(400).json({ message: "This blood request is already in dispatch workflow." });
    }

    for (const requestItem of bloodRequest.items || []) {
      const inventoryItem = (bloodBank.inventory || []).find(
        (item) =>
          item.bloodGroup === requestItem.bloodGroup &&
          (item.type || item.component || "PRBC") === requestItem.component,
      );

      if (!inventoryItem) {
        return res.status(400).json({
          message: `${requestItem.bloodGroup} ${requestItem.component} inventory is not available.`,
        });
      }

      const requestedUnits = Number(requestItem.quantity || 0);
      const availableUnits = Number(inventoryItem.unitsAvailable || 0);
      const committedUnits = Number(inventoryItem.unitsCommitted || 0);

      if (committedUnits < requestedUnits) {
        return res.status(400).json({
          message: `Only ${committedUnits} committed ${requestItem.bloodGroup} ${requestItem.component} unit${committedUnits === 1 ? "" : "s"} available.`,
        });
      }

      if (availableUnits < requestedUnits) {
        return res.status(400).json({
          message: `Only ${availableUnits} ${requestItem.bloodGroup} ${requestItem.component} unit${availableUnits === 1 ? "" : "s"} available.`,
        });
      }
    }

    for (const requestItem of bloodRequest.items || []) {
      const inventoryItem = bloodBank.inventory.find(
        (item) =>
          item.bloodGroup === requestItem.bloodGroup &&
          (item.type || item.component || "PRBC") === requestItem.component,
      );
      const requestedUnits = Number(requestItem.quantity || 0);

      inventoryItem.unitsAvailable = Number(inventoryItem.unitsAvailable || 0) - requestedUnits;
      inventoryItem.unitsCommitted = Number(inventoryItem.unitsCommitted || 0) - requestedUnits;
    }

    bloodRequest.deliveryStatus = "ReadyToDispatch";

    await bloodBank.save();
    await bloodRequest.save();

    const updatedRequest = await BloodRequest.findById(bloodRequest._id)
      .populate("userId", "username email phoneNumber picture")
      .lean();

    return res.status(200).json({
      message: "Blood request is ready to dispatch.",
      bloodRequest: updatedRequest,
    });
  } catch (err) {
    return res.status(500).json({ message: err.message || "Unable to mark blood request ready to dispatch." });
  }
}; 


export const cancelMyBloodRequest = async (req, res) => {
  try {
    const bloodRequest = await BloodRequest.findOne({
      _id: req.params.requestId,
      userId: req.user._id,
    });

    if (!bloodRequest) {
      return res.status(404).json({ message: "Blood request not found." });
    }

    if (bloodRequest.requestStatus !== "Pending") {
      return res.status(400).json({ message: "Only pending blood requests can be cancelled." });
    }

    bloodRequest.requestStatus = "Cancelled";
    bloodRequest.statusHistory.push({
      status: "Cancelled",
    });
    await bloodRequest.save();

    const updatedRequest = await BloodRequest.findById(bloodRequest._id)
      .populate("bloodBankId", "bloodBankName phoneNumber address")
      .lean();

    return res.status(200).json({
      message: "Blood request cancelled successfully.",
      bloodRequest: updatedRequest,
    });
  } catch (err) {
    return res.status(500).json({ message: err.message || "Unable to cancel blood request." });
  }
};