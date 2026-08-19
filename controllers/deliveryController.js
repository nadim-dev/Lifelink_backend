import { DeliveryRequest } from "../models/deliveryRequestModel.js";
import DeliveryPartner from "../models/deliveryPartnerModel.js";
import BloodBank from "../models/BloodbankModel.js";
import BloodRequest from "../models/bloodRequestModel.js";
import Notification from "../models/notificationModel.js";

export const getPendingDeliveryRequests = async (req, res) => {
  try {
    console.log("get pending delivery function is running");
    const deliveryPartner = await DeliveryPartner.findOne({
      userId: req.user._id,
    }).select("_id").lean();

    if (!deliveryPartner) {
      return res.status(404).json({
        message: "Delivery partner profile not found.",
      });
    }

    const deliveryRequests = await DeliveryRequest.find({
      deliveryPartnerId: deliveryPartner._id,
      requestStatus: "Pending",
    })
      .sort({ createdAt: -1 })
      .populate({
        path: "bloodRequestId",
        select: "requestNumber items deliveryAddress",
        populate: {
          path: "bloodBankId",
          select: "bloodBankName address",
        },
      })
      .lean();

    return res.status(200).json({
      message: "Pending delivery requests fetched successfully.",
      deliveryRequests,
    });
  } catch (error) {
    console.error("Get pending delivery requests error:", error);

    return res.status(500).json({
      message: error.message || "Unable to fetch pending delivery requests.",
    });
  }
}; 


export const declineDeliveryRequest = async (req, res) => {
    console.log("decline delivery controller is running ");
  try {
    const deliveryPartner = await DeliveryPartner.findOne({
      userId: req.user._id,
    }).select("_id");

    if (!deliveryPartner) {
      return res.status(404).json({
        message: "Delivery partner profile not found.",
      });
    }

    const deliveryRequest = await DeliveryRequest.findOne({
      _id: req.params.deliveryRequestId,
      deliveryPartnerId: deliveryPartner._id,
      requestStatus: "Pending",
    });

    if (!deliveryRequest) {
      return res.status(404).json({
        message: "Delivery request not found or already responded.",
      });
    }

    deliveryRequest.requestStatus = "Declined";
    deliveryRequest.respondedAt = new Date();

    await deliveryRequest.save();

    return res.status(200).json({
      message: "Delivery request declined successfully.",
      deliveryRequestId: deliveryRequest._id,
    });
  } catch (error) {
    console.error("Decline delivery request error:", error);

    return res.status(500).json({
      message: error.message || "Unable to decline delivery request.",
    });
  }
};


export const acceptDeliveryRequest = async (req, res) => {
  try {
    console.log("accept delivery controller is running");
    const { deliveryRequestId } = req.params;

    // 1. Find logged-in delivery partner
    const deliveryPartner = await DeliveryPartner.findOne({
      userId: req.user._id,
    }).select("_id userId fullName");

    console.log("deliveryPartner",deliveryPartner);


    if (!deliveryPartner) {
      return res.status(404).json({
        message: "Delivery partner profile not found.",
      });
    }

    // 2. Find the pending delivery request belonging to this DP
    const deliveryRequest = await DeliveryRequest.findOne({
      _id: deliveryRequestId,
      deliveryPartnerId: deliveryPartner._id,
      requestStatus: "Pending",
    });

    console.log("deliveryRequest",deliveryRequest);

    if (!deliveryRequest) {
      return re
       s.status(404).json({
        message: "Delivery request not found or already responded.",
      });
    }

    // 3. Atomically assign the BloodRequest
    // Only the first DP who reaches here can change Searching -> Assigned
    const bloodRequest = await BloodRequest.findOneAndUpdate(
      {
        _id: deliveryRequest.bloodRequestId,
        deliveryStatus: "Searching",
        deliveryPartnerId: null,
      },
      {
        $set: {
          deliveryStatus: "Assigned",
          deliveryPartnerId: deliveryPartner._id,
        },
      },
      {
        returnDocument: "after"
      }
    );

    // If null, another DP already accepted this delivery
    if (!bloodRequest) {
      // Expire this DP's request because someone else got it
      deliveryRequest.requestStatus = "Expired";
      deliveryRequest.respondedAt = new Date();

      await deliveryRequest.save();

      return res.status(409).json({
        message: "This delivery has already been assigned to another delivery partner.",
      });
    }

    // 4. Mark this DP's DeliveryRequest as Accepted
    deliveryRequest.requestStatus = "Accepted";
    deliveryRequest.respondedAt = new Date();

    await deliveryRequest.save();

    // 5. Expire all other pending offers for this blood request
    await DeliveryRequest.updateMany(
      {
        bloodRequestId: bloodRequest._id,
        _id: { $ne: deliveryRequest._id },
        requestStatus: "Pending",
      },
      {
        $set: {
          requestStatus: "Expired",
          respondedAt: new Date(),
        },
      }
    );

    // 6. Mark delivery partner as unavailable
    await DeliveryPartner.findByIdAndUpdate(
      deliveryPartner._id,
      {
        availabilityStatus: "busy",
      }
    );

    // 7. Get Socket.IO
    const io = req.app.get("io");

    // 8. Notify other delivery partners
    const otherDeliveryRequests = await DeliveryRequest.find({
      bloodRequestId: bloodRequest._id,
      requestStatus: "Expired",
      _id: { $ne: deliveryRequest._id },
    })
      .populate("deliveryPartnerId", "userId")
      .lean();

    for (const request of otherDeliveryRequests) {
      const userId = request.deliveryPartnerId?.userId;

      if (userId) {
        io.to(`delivery-partner:${userId}`).emit(
          "deliveryRequestExpired",
          {
            deliveryRequestId: request._id,
            bloodRequestId: bloodRequest._id,
          }
        );
      }
    }

    io.to("delivery-partners").emit(
      "deliveryRequestExpired",
      {
        bloodRequestId: bloodRequest._id,
        acceptedDeliveryRequestId: deliveryRequest._id,
      }
    );

    // 9. Notify blood bank operator
    const bloodBank = await BloodBank.findById(
      bloodRequest.bloodBankId
    ).select("userId bloodBankName");

    if (bloodBank?.userId) {
      const notification = await Notification.create({
        userId: bloodBank.userId,
        title: "Delivery Request Accepted",
        message: `${deliveryPartner.fullName} has accepted delivery request ${bloodRequest.requestNumber}.`,
        type: "Blood Request",
        actionUrl: "/blood-bank/requests",
      });

      io.to(`blood-bank:${bloodBank.userId}`).emit("newNotification", notification);
      io.to(`blood-bank:${bloodBank.userId}`).emit("deliveryPartnerAssigned", {
        bloodRequestId: bloodRequest._id,
        requestNumber: bloodRequest.requestNumber,
        deliveryPartnerId: deliveryPartner._id,
        deliveryRequestId: deliveryRequest._id,
        deliveryPartnerName: deliveryPartner.fullName,
        deliveryStatus: "Assigned",
      });
    }

    return res.status(200).json({
      message: "Delivery accepted successfully.",
      deliveryRequest,
      bloodRequest,
    });
  } catch (error) {
    console.error("Accept delivery request error:", error);

    return res.status(500).json({
      message:
        error.message || "Unable to accept delivery request.",
    });
  }
};


//* i have to check whether i am using this controller somewhere or not
export const getActiveDelivery = async (req, res) => {
  try {
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
        $in: ["Assigned", "PickedUp", "OutForDelivery"],
      },
    })
      .populate({
        path: "bloodBankId",
        select: "bloodBankName address location",
      })
      .lean();

    if (!activeDelivery) {
      return res.status(200).json({
        message: "No active delivery found.",
        activeDelivery: null,
      });
    }

    return res.status(200).json({
      message: "Active delivery fetched successfully.",
      activeDelivery,
    });
  } catch (error) {
    console.error("Get active delivery error:", error);

    return res.status(500).json({
      message: error.message || "Unable to fetch active delivery.",
    });
  }
};
