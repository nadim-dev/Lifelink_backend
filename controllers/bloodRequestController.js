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
