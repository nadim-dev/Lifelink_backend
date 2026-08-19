import BloodBank from "../models/BloodbankModel.js";
import BloodRequest from "../models/bloodRequestModel.js";
import Counter from "../models/counterModel.js";
import Notification from "../models/notificationModel.js";
import User from "../models/userModel.js";
const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
const BLOOD_COMPONENTS = ["PRBC", "Platelets", "Plasma"];
import DeliveryPartner from "../models/deliveryPartnerModel.js";
import { DeliveryRequest } from "../models/deliveryRequestModel.js";
import crypto from "node:crypto";

const hashPickupOtp = (otp) => crypto.createHash("sha256").update(otp).digest("hex");

const verifyDeliveryOtp = async (bloodRequestId, otp) => {
  const bloodRequest = await BloodRequest.findById(bloodRequestId).select("pickupVerification");
  const verification = bloodRequest?.pickupVerification;

  if (!/^\d{4}$/.test(String(otp || ""))) return false;
  if (!verification?.otpHash || !verification.expiresAt || verification.expiresAt <= new Date()) return false;

  return verification.otpHash === hashPickupOtp(String(otp));
};


const getGeoapifyDistance = async (fromCoordinates = [], toCoordinates = []) => {
  if (!process.env.GEOAPIFY_API_KEY) return null;

  const [fromLongitude, fromLatitude] = fromCoordinates.map(Number);
  const [toLongitude, toLatitude] = toCoordinates.map(Number);

  const hasInvalidCoordinates = [fromLongitude, fromLatitude, toLongitude, toLatitude].some(
    (coordinate) => !Number.isFinite(coordinate),
  );

  if (hasInvalidCoordinates) return null;

  const url = new URL("https://api.geoapify.com/v1/routing");
  url.searchParams.set("waypoints", `${fromLatitude},${fromLongitude}|${toLatitude},${toLongitude}`);
  url.searchParams.set("mode", "drive");
  url.searchParams.set("format", "json");
  url.searchParams.set("apiKey", process.env.GEOAPIFY_API_KEY);

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error("Geoapify route distance request failed");
  }

  const data = await response.json();
  const route = data?.results?.[0];
  const distanceMeters = Number(route?.distance);


  if (!Number.isFinite(distanceMeters)) return null;

  return {
    distanceMeters,
    distanceKm: Number((distanceMeters / 1000).toFixed(2)),
  };
};

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
    console.log("create blood request controller is running");
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

    const user=await User.findById(req.user._id);
    const deliveryAddress = getDeliveryAddress(user);
    console.log("deliveryAddress",deliveryAddress);

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
    console.log(err.message);
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

export const getMyBloodRequestTracking = async (req, res) => {
  try {
    const bloodRequest = await BloodRequest.findOne({
      _id: req.params.bloodRequestId,
      userId: req.user._id,
    })
      .populate("bloodBankId", "bloodBankName phoneNumber address")
      .populate("deliveryPartnerId", "fullName phoneNumber profileImageUrl")
      .lean();

    if (!bloodRequest) {
      return res.status(404).json({ message: "Blood request not found." });
    }

    return res.status(200).json({ bloodRequest });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Unable to load request tracking." });
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
      .populate("deliveryPartnerId", "fullName")
      .populate("bloodBankId", "bloodBankName phoneNumber address")
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
      _id: req.params.bloodRequestId,
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
    console.log("ready to dispatch function is running");
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
      const inventoryItem = bloodBank.inventory.find(
        (item) =>
          item.bloodGroup === requestItem.bloodGroup &&
          (item.type || item.component || "PRBC") === requestItem.component,
      );
      const requestedUnits = Number(requestItem.quantity || 0);
      const committedUnits = Number(inventoryItem?.unitsCommitted || 0);

      if (!inventoryItem || committedUnits < requestedUnits) {
        return res.status(400).json({
          message: `Reserved ${requestItem.bloodGroup} ${requestItem.component} units are not available for dispatch.`,
        });
      }

      inventoryItem.unitsAvailable = Number(inventoryItem.unitsAvailable || 0) - requestedUnits;
      inventoryItem.unitsCommitted = committedUnits - requestedUnits;
    }

    bloodRequest.deliveryStatus = "Searching";
    bloodRequest.deliveryStatusHistory.push({status: "Searching",changedAt: new Date()});

    await bloodBank.save();
    await bloodRequest.save();



    const deliveryRequestData = {
      requestId: bloodRequest._id,
      requestNumber: bloodRequest.requestNumber,
      items: bloodRequest.items,
      pickup: {
        name: bloodBank.bloodBankName,
        address: bloodBank.address?.completeAddress,
        location: bloodBank.location,
      },
      delivery: {
        address: bloodRequest.deliveryAddress?.completeAddress,
        city: bloodRequest.deliveryAddress?.city,
        location: bloodRequest.deliveryAddress?.location,
      },
      createdAt: bloodRequest.createdAt,
    };

    
    const nearbyPartners = await DeliveryPartner.find({
      availabilityStatus: "available",
      accountStatus: "approved",
      currentLocation: {
        $near: {
          $geometry: {
            type: "Point",
            coordinates: bloodBank.location.coordinates,
          },
          $maxDistance: 10000, // 10 km
        },
      },
    }).select("_id userId currentLocation.coordinates").lean();

console.log("nearbyPartners",nearbyPartners);

    const io = req.app.get("io");

    for (const partner of nearbyPartners) {
      let distanceToPickup = null;
      let distanceToDelivery = null;

      try {
        [distanceToPickup, distanceToDelivery] = await Promise.all([
          getGeoapifyDistance(partner.currentLocation?.coordinates, bloodBank.location?.coordinates),
          getGeoapifyDistance(partner.currentLocation?.coordinates, bloodRequest.deliveryAddress?.location?.coordinates),
        ]);
      } catch (error) {
        console.error("Delivery partner route distance error:", error.message);
      }



       const deliveryRequest = await DeliveryRequest.create({
               bloodRequestId: bloodRequest._id,
               deliveryPartnerId: partner._id,
               requestStatus: "Pending",
               distanceToPickup:distanceToPickup.distanceMeters,
               distanceToDelivery:distanceToDelivery.distanceMeters,
               sentAt: new Date(),
       });

      if (partner.userId) {
        io.to(`delivery-partner:${partner.userId}`).emit(
          "newDeliveryRequest",
          {
            ...deliveryRequestData,
            deliveryRequestId: deliveryRequest._id,
            distanceToPickup:distanceToPickup.distanceMeters,
            distanceToDelivery:distanceToDelivery.distanceMeters,
          }
        );
      }
    }


    const updatedRequest = await BloodRequest.findById(bloodRequest._id)
      .populate("userId", "username email phoneNumber picture")
      .lean();

    return res.status(200).json({
      message: "Blood request is ready to dispatch.",
      bloodRequest: updatedRequest,
    });


  } catch (err) {
    console.log(err.message);
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

export const getActiveRequestDelivery = async (req, res) => {
  try {
    console.log("get active delivery function is running");
    const deliveryPartner = await DeliveryPartner.findOne({
      userId: req.user._id,
    }).select("_id");

    if (!deliveryPartner) {
      return res.status(404).json({
        message: "Delivery partner profile not found.",
      });
    }

    const activeDelivery = await BloodRequest.findOne({
      deliveryPartnerId: deliveryPartner._id,
      deliveryStatus: {
        $in: ["Assigned", "PickedUp","OnTheWayToPickup","OutForDelivery"],
      },
    })
      .select(
        "requestNumber items patient deliveryAddress payment deliveryStatus deliveryStatusHistory updatedAt bloodBankId",
      )
      .populate({
        path: "bloodBankId",
        select: "bloodBankName address location",
      })
      .lean();

    if (!activeDelivery) {
      return res.status(200).json({
        message: "No active delivery found.",
        activeDelivery: null,
        deliveryRequest: null,
      });
    }

    const deliveryRequest = await DeliveryRequest.findOne({
      bloodRequestId: activeDelivery._id,
      deliveryPartnerId: deliveryPartner._id,
      requestStatus: "Accepted",
    })
      .select("bloodRequestId requestStatus distanceToPickup distanceToDelivery sentAt respondedAt")
      .lean();

    const activeDeliveryPayload = {
      _id: activeDelivery._id,
      requestNumber: activeDelivery.requestNumber,
      items: (activeDelivery.items || []).map((item) => ({
        bloodGroup: item.bloodGroup,
        component: item.component,
        quantity: item.quantity,
      })),
      patient: {
        name: activeDelivery.patient?.name,
        contactNumber: activeDelivery.patient?.contactNumber,
      },
      deliveryAddress: {
        completeAddress: activeDelivery.deliveryAddress?.completeAddress,
        city: activeDelivery.deliveryAddress?.city,
        state: activeDelivery.deliveryAddress?.state,
      },
      deliveryStatus: activeDelivery.deliveryStatus,
      payment: {
        method: activeDelivery.payment?.method || "PayOnDelivery",
        amount:activeDelivery.payment?.amount
      },
      deliveryStatusHistory: (activeDelivery.deliveryStatusHistory || []).map((entry) => ({
        status: entry.status,
        changedAt: entry.changedAt,
      })),
      updatedAt: activeDelivery.updatedAt,
      bloodBankId: {
        bloodBankName: activeDelivery.bloodBankId?.bloodBankName,
        address: {
          completeAddress: activeDelivery.bloodBankId?.address?.completeAddress,
          city: activeDelivery.bloodBankId?.address?.city,
          state: activeDelivery.bloodBankId?.address?.state,
        },
      },
    };

    const deliveryRequestPayload = deliveryRequest
      ? {
          _id: deliveryRequest._id,
          distanceToPickup: deliveryRequest.distanceToPickup,
          distanceToDelivery: deliveryRequest.distanceToDelivery,
          respondedAt: deliveryRequest.respondedAt,
        }
      : null;

    return res.status(200).json({
      message: "Active delivery fetched successfully.",
      activeDelivery: activeDeliveryPayload,
      deliveryRequest: deliveryRequestPayload,
    });
  } catch (error) {
    console.error("Get active delivery error:", error);

    return res.status(500).json({
      message: error.message || "Unable to fetch active delivery.",
    });
  }
};

export const getCompletedDeliveries = async (req, res) => {
  try {
    const deliveryPartner = await DeliveryPartner.findOne({ userId: req.user._id }).select("_id fullName phoneNumber").lean();
    if (!deliveryPartner) return res.status(404).json({ message: "Delivery partner profile not found." });

    const deliveries = await BloodRequest.find({ deliveryPartnerId: deliveryPartner._id, deliveryStatus: "Delivered" })
      .select("requestNumber items patient deliveryAddress payment deliveryStatus deliveryStatusHistory updatedAt createdAt bloodBankId")
      .populate("bloodBankId", "bloodBankName address")
      .sort({ updatedAt: -1 })
      .lean();

    const completedDeliveries = await Promise.all(deliveries.map(async (delivery) => {
      const deliveryRequest = await DeliveryRequest.findOne({ bloodRequestId: delivery._id, deliveryPartnerId: deliveryPartner._id })
        .select("distanceToPickup distanceToDelivery")
        .sort({ updatedAt: -1 })
        .lean();
      return { ...delivery, deliveryPartner, deliveryRequest };
    }));

    return res.status(200).json({ completedDeliveries });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Unable to load completed deliveries." });
  }
};


export const startDeliveryJourney = async (req, res) => {
  try {
    const deliveryPartner = await DeliveryPartner.findOne({
      userId: req.user._id,
    }).select("_id fullName");

    console.log("blood requestId",req.params);
    if (!deliveryPartner) {
      return res.status(404).json({
        message: "Delivery partner profile not found.",
      });
    }

    const bloodRequest = await BloodRequest.findOne({
      _id: req.params.bloodRequestId,
      deliveryPartnerId: deliveryPartner._id,
      deliveryStatus: "Assigned",
    });

    

    if (!bloodRequest) {
      return res.status(404).json({
        message: "Assigned delivery not found.",
      });
    }

    // Update delivery status
    bloodRequest.deliveryStatus = "OnTheWayToPickup";

    // Add status history
    bloodRequest.deliveryStatusHistory.push({
      status: "OnTheWayToPickup",
      changedAt: new Date(),
    });

    await bloodRequest.save();

    // Find blood bank
    const bloodBank = await BloodBank.findById(
      bloodRequest.bloodBankId
    ).select("userId");

    if (bloodBank?.userId) {
      // Create persistent notification
      const notification = await Notification.create({
        userId: bloodBank.userId,
        title: "Delivery Partner On the Way",
        message: `${deliveryPartner.fullName} has started the journey to pick up blood request ${bloodRequest.requestNumber}.`,
        type: "Blood Request",
        actionUrl: "/blood-bank/requests",
      });

      // Send real-time notification
      const io = req.app.get("io");

      io.to(`blood-bank:${bloodBank.userId}`).emit(
        "newNotification",
        notification
      );

      io.to(`blood-bank:${bloodBank.userId}`).emit(
        "deliveryStatusUpdated",
        {
          bloodRequestId: bloodRequest._id,
          requestNumber: bloodRequest.requestNumber,
          deliveryPartnerId: deliveryPartner._id,
          deliveryStatus: bloodRequest.deliveryStatus,
        }
      );
    }

    return res.status(200).json({
      message: "Journey started successfully.",
      deliveryStatus: bloodRequest.deliveryStatus,
    });

  } catch (error) {
    console.error("Start journey error:", error);

    return res.status(500).json({
      message: error.message || "Unable to start journey.",
    });
  }
};

export const generatePickupOtp = async (req, res) => {
  try {
    const bloodBank = await BloodBank.findOne({ userId: req.user._id }).select("_id");
    const bloodRequest = await BloodRequest.findOne({
      _id: req.params.bloodRequestId,
      bloodBankId: bloodBank?._id,
      deliveryStatus: "OnTheWayToPickup",
    });

    if (!bloodRequest) {
      return res.status(404).json({ message: "Delivery waiting for pickup was not found." });
    }

    const otp = crypto.randomInt(100000, 1000000).toString();
    bloodRequest.pickupVerification = {
      otpHash: hashPickupOtp(otp),
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      verifiedAt: null,
    };
    await bloodRequest.save();

    return res.status(200).json({ message: "Pickup OTP generated successfully.", otp });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Unable to generate pickup OTP." });
  }
};

export const generateDeliveryOtp = async (req, res) => {
  try {
    const bloodRequest = await BloodRequest.findOne({ _id: req.params.bloodRequestId, userId: req.user._id, deliveryStatus: "OutForDelivery" });
    if (!bloodRequest) return res.status(404).json({ message: "Out-for-delivery request was not found." });
    const otp = crypto.randomInt(1000, 10000).toString();
    bloodRequest.pickupVerification = { otpHash: hashPickupOtp(otp), expiresAt: new Date(Date.now() + 10 * 60 * 1000), verifiedAt: null };
    await bloodRequest.save();
    return res.status(200).json({ message: "Delivery OTP generated successfully.", otp });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Unable to generate delivery OTP." });
  }
};

export const confirmPickup = async (req, res) => {
  try {
    const { otp } = req.body;
    const deliveryPartner = await DeliveryPartner.findOne({ userId: req.user._id }).select("_id");
    const bloodRequest = await BloodRequest.findOne({
      _id: req.params.bloodRequestId,
      deliveryPartnerId: deliveryPartner?._id,
      deliveryStatus: "OnTheWayToPickup",
    });

    if (!bloodRequest) {
      return res.status(404).json({ message: "Delivery waiting for pickup was not found." });
    }

    const verification = bloodRequest.pickupVerification;
    const isValid = /^\d{6}$/.test(String(otp || "")) && verification?.otpHash
      && verification.expiresAt > new Date()
      && verification.otpHash === hashPickupOtp(String(otp));

    if (!isValid) {
      return res.status(400).json({ message: "Invalid or expired pickup OTP." });
    }

    bloodRequest.deliveryStatus = "PickedUp";
    bloodRequest.deliveryStatusHistory.push({ status: "PickedUp", changedAt: new Date() });
    bloodRequest.pickupVerification.verifiedAt = new Date();
    bloodRequest.pickupVerification.otpHash = null;
    await bloodRequest.save();

    const bloodBank = await BloodBank.findById(bloodRequest.bloodBankId).select("userId");
    const io = req.app.get("io");
    if (bloodBank?.userId) {
      io.to(`blood-bank:${bloodBank.userId}`).emit("deliveryStatusUpdated", {
        bloodRequestId: bloodRequest._id,
        requestNumber: bloodRequest.requestNumber,
        deliveryStatus: bloodRequest.deliveryStatus,
      });
    }

    return res.status(200).json({ message: "Pickup confirmed successfully.", deliveryStatus: bloodRequest.deliveryStatus });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Unable to confirm pickup." });
  }
};

export const startDelivery = async (req, res) => {
  try {
    const deliveryPartner = await DeliveryPartner.findOne({
      userId: req.user._id,
    }).select("_id fullName");

    if (!deliveryPartner) {
      return res.status(404).json({
        message: "Delivery partner profile not found.",
      });
    }

    const bloodRequest = await BloodRequest.findOne({
      _id: req.params.bloodRequestId,
      deliveryPartnerId: deliveryPartner._id,
      deliveryStatus: "PickedUp",
    });

    if (!bloodRequest) {
      return res.status(404).json({
        message: "Picked-up delivery not found.",
      });
    }

    // Update delivery status
    bloodRequest.deliveryStatus = "OutForDelivery";

    // Add status history
    bloodRequest.deliveryStatusHistory.push({
      status: "OutForDelivery",
      changedAt: new Date(),
    });

    await bloodRequest.save();

    // Find blood bank
    const bloodBank = await BloodBank.findById(
      bloodRequest.bloodBankId
    ).select("userId");

    const io = req.app.get("io");

    if (bloodBank?.userId) {
      
       
      // Update Blood Bank UI in real time
      io.to(`blood-bank:${bloodBank.userId}`).emit(
        "deliveryStatusUpdated",
        {
          bloodRequestId: bloodRequest._id,
          requestNumber: bloodRequest.requestNumber,
          deliveryPartnerId: deliveryPartner._id,
          deliveryStatus: "OutForDelivery",
        }
      );

      
    }

    const notification = await Notification.create({
       userId: bloodRequest.userId,
       title: "Blood Is On the Way",
       message: `Your blood request ${bloodRequest.requestNumber} has been picked up and is now on the way to you.`,
       type: "Blood Request",
       actionUrl: "/my-requests",
    });

    return res.status(200).json({
      message: "Delivery started successfully.",
      deliveryStatus: bloodRequest.deliveryStatus,
    });

  } catch (error) {
    console.error("Start delivery error:", error);

    return res.status(500).json({
      message: error.message || "Unable to start delivery.",
    });
  }
};


export const confirmDelivery = async (req, res) => {
  try {
    const { requestId } = req.params;
    const { otp, collectionMethod } = req.body;

    // 1. Validate input
    if (!otp || !collectionMethod) {
      return res.status(400).json({
        message: "OTP and collection method are required.",
      });
    }

    if (!["Cash", "UPI"].includes(collectionMethod)) {
      return res.status(400).json({
        message: "Invalid collection method.",
      });
    }

    // 2. Get DeliveryPartner linked to logged-in user
    const deliveryPartner = await DeliveryPartner.findOne({
      userId: req.user._id,
    }).select("_id");

    if (!deliveryPartner) {
      return res.status(404).json({
        message: "Delivery partner profile not found.",
      });
    }

    // 3. Find this partner's active delivery
    const bloodRequest = await BloodRequest.findOne({
      _id: requestId,
      deliveryPartnerId: deliveryPartner._id,
      deliveryStatus: "OutForDelivery",
    });

    if (!bloodRequest) {
      return res.status(404).json({
        message: "Active delivery not found.",
      });
    }

    // 4. Verify delivery OTP
    const isOtpValid = await verifyDeliveryOtp(
      bloodRequest._id,
      otp
    );

    if (!isOtpValid) {
      return res.status(400).json({
        message: "Invalid or expired delivery OTP.",
      });
    }

    // 5. Mark delivery as delivered
    bloodRequest.deliveryStatus = "Delivered";

    bloodRequest.deliveryStatusHistory.push({
      status: "Delivered",
      changedAt: new Date(),
    });

    // 6. Complete blood request
    bloodRequest.requestStatus = "Completed";

    bloodRequest.statusHistory.push({
      status: "Completed",
      changedAt: new Date(),
    });

    // 7. Update payment
    bloodRequest.payment.collectionMethod = collectionMethod;
    bloodRequest.payment.status = "Paid";
    bloodRequest.payment.paidAt = new Date();
    bloodRequest.payment.collectedBy = req.user._id;

    bloodRequest.pickupVerification.verifiedAt = new Date();
    bloodRequest.pickupVerification.otpHash = null;
    bloodRequest.pickupVerification.expiresAt = null;

    await bloodRequest.save();

    // 8. Get blood bank user
    const bloodBank = await BloodBank.findById(
      bloodRequest.bloodBankId
    ).select("userId");

    const io = req.app.get("io");

    // 9. Notify patient
    const notification = await Notification.create({
      userId: bloodRequest.userId,
      title: "Blood Delivered",
      message: `Your blood request ${bloodRequest.requestNumber} has been successfully delivered.`,
      type: "Blood Request",
      actionUrl: "/blood-requests",
    });

    // 10. Update patient's UI in real time
    io.to(`user:${bloodRequest.userId}`).emit(
      "deliveryStatusUpdated",
      {
        bloodRequestId: bloodRequest._id,
        requestNumber: bloodRequest.requestNumber,
        deliveryStatus: "Delivered",
      }
    );

    io.to(`user:${bloodRequest.userId}`).emit(
      "newNotification",
      notification
    );

    // 11. Update Blood Bank UI in real time
    if (bloodBank?.userId) {
      io.to(`blood-bank:${bloodBank.userId}`).emit(
        "deliveryStatusUpdated",
        {
          bloodRequestId: bloodRequest._id,
          requestNumber: bloodRequest.requestNumber,
          deliveryPartnerId: deliveryPartner._id,
          deliveryStatus: "Delivered",
          requestStatus: "Completed",
        }
      );
    }

    return res.status(200).json({
      message: "Delivery completed successfully.",
      deliveryStatus: bloodRequest.deliveryStatus,
      requestStatus: bloodRequest.requestStatus,
      payment: {
        amount: bloodRequest.payment.amount,
        status: bloodRequest.payment.status,
        collectionMethod: bloodRequest.payment.collectionMethod,
      },
    });
  } catch (error) {
    console.error("Confirm delivery error:", error);

    return res.status(500).json({
      message: "Unable to complete delivery.",
    });
  }
};
