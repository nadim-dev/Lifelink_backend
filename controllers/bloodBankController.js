import Notification from "../models/notificationModel.js";
import BloodBank from "../models/BloodbankModel.js";
import User from "../models/userModel.js";
import { sanitize } from "../utils/sanitize.js";
import { uploadBufferToCloudinary } from "../utils/uploadToCloudinary.js";
import { generateDemandPrediction } from "../services/ai.service.js";
import BloodRequest from "../models/bloodRequestModel.js";
import { getRouteDistanceInMeters } from "../utils/geoapifyDistance.js";

export const getAllBloodBanksForAdmin = async (req, res) => {
  try {
    const bloodBanks = await BloodBank.find()
      .populate("userId", "email username")
      .sort({ createdAt: -1 })
      .lean();
    
    return res.json({ bloodBanks });
  } catch (error) {
    console.error("Admin blood bank list error:", error);
    return res.status(500).json({ message: "Unable to load blood banks" });
  }
};

export const getBloodBankForAdmin = async (req, res) => {
  try {
    const bloodBank = await BloodBank.findById(req.params.bloodBankId)
      .populate("userId", "email username phoneNumber role createdAt")
      .populate("review.approvedBy", "username email")
      .populate("review.rejectedBy", "username email")
      .populate("review.suspendedBy", "username email")
      .populate("review.reactivatedBy", "username email")
      .populate("activityHistory.performedBy", "username email")
      .lean();

    if (!bloodBank) {
      return res.status(404).json({ message: "Blood bank not found" });
    }

    return res.json({ bloodBank });
  } catch (error) {
    console.error("Admin blood bank detail error:", error);
    return res.status(500).json({ message: "Unable to load blood bank details" });
  }
};

export const getPublicBloodBank = async (req, res) => {
  try {
    const bloodBank = await BloodBank.findOne({
      _id: req.params.bloodBankId,
      status: "Approved",
    })
      .select("bloodBankName phoneNumber address workingHours inventory imageUrl imageURL location status")
      .lean();

    if (!bloodBank) {
      return res.status(404).json({ message: "Blood bank not found" });
    }

    return res.json({ bloodBank });
  } catch (error) {
    console.error("Public blood bank detail error:", error);
    return res.status(500).json({ message: "Unable to load blood bank details" });
  }
};

export const getMyBloodBankProfile = async (req, res) => {
  try {
    const bloodBank = await BloodBank.findOne({ userId: req.user._id })
      .populate("userId", "email username phoneNumber role picture createdAt")
      .lean();

    if (!bloodBank) {
      return res.status(404).json({ message: "Blood bank profile not found" });
    }

    return res.json({ bloodBank });
  } catch (error) {
    console.error("Blood bank profile load error:", error);
    return res.status(500).json({ message: "Unable to load blood bank profile" });
  }
};

export const updateMyBloodBankProfile = async (req, res) => {
  try {
    const {
      contactPersonName,
      phoneNumber,
      openingTime,
      closingTime,
      isOpen24Hours,
    } = sanitize(req.body);

    if (!contactPersonName || !phoneNumber) {
      return res.status(400).json({ message: "Contact person and phone number are required" });
    }

    const isAlwaysOpen = isOpen24Hours === true || isOpen24Hours === "true";

    if (!isAlwaysOpen && (!openingTime || !closingTime)) {
      return res.status(400).json({ message: "Opening and closing time are required" });
    }

    const bloodBank = await BloodBank.findOneAndUpdate(
      { userId: req.user._id },
      {
        $set: {
          contactPersonName,
          phoneNumber,
          workingHours: {
            openingTime: isAlwaysOpen ? "" : openingTime,
            closingTime: isAlwaysOpen ? "" : closingTime,
            isOpen24Hours: isAlwaysOpen,
          },
        },
      },
      { new: true, runValidators: true },
    )
      .populate("userId", "email username phoneNumber role picture createdAt")
      .lean();

    if (!bloodBank) {
      return res.status(404).json({ message: "Blood bank profile not found" });
    }

    await User.findByIdAndUpdate(req.user._id, {
      username: contactPersonName,
      phoneNumber,
    });

    return res.json({
      message: "Blood bank profile updated successfully",
      bloodBank,
    });
  } catch (error) {
    console.error("Blood bank profile update error:", error);
    return res.status(500).json({ message: "Unable to update blood bank profile" });
  }
};

export const addMyBloodBankInventory = async (req, res) => {
  try {
    const allowedBloodGroups = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
    const allowedTypes = ["PRBC", "Platelets", "Plasma"];
    const { bloodGroup, type, expiryDate } = req.body;
    const unitsAvailable = Number(req.body.unitsAvailable);
    const unitsCommitted = Number(req.body.unitsCommitted || 0);
    const processingFee = Number(req.body.processingFee);
    const parsedExpiryDate = new Date(expiryDate);

    if (!allowedBloodGroups.includes(bloodGroup)) {
      return res.status(400).json({ message: "Invalid blood group" });
    }

    if (!allowedTypes.includes(type)) {
      return res.status(400).json({ message: "Invalid component type" });
    }

    if (
      !Number.isFinite(unitsAvailable) ||
      unitsAvailable < 0 ||
      !Number.isFinite(unitsCommitted) ||
      unitsCommitted < 0 ||
      !Number.isFinite(processingFee) ||
      processingFee < 0
    ) {
      return res.status(400).json({ message: "Inventory quantities and fee must be valid numbers" });
    }

    if (Number.isNaN(parsedExpiryDate.getTime())) {
      return res.status(400).json({ message: "Expiry date is required" });
    }

    const bloodBank = await BloodBank.findOneAndUpdate(
      { userId: req.user._id },
      {
        $push: {
          inventory: {
            bloodGroup,
            type,
            unitsAvailable,
            unitsCommitted,
            processingFee,
            expiryDate: parsedExpiryDate,
          },
        },
      },
      { new: true, runValidators: true },
    )
      .populate("userId", "email username phoneNumber role picture createdAt")
      .lean();

    if (!bloodBank) {
      return res.status(404).json({ message: "Blood bank profile not found" });
    }

    return res.status(201).json({
      message: "Inventory added successfully",
      bloodBank,
    });
  } catch (error) {
    console.error("Blood bank inventory add error:", error);
    return res.status(500).json({ message: "Unable to add inventory" });
  }
};

export const deleteMyBloodBankInventory = async (req, res) => {
  try {
    const bloodBank = await BloodBank.findOne({ userId: req.user._id });

    if (!bloodBank) {
      return res.status(404).json({ message: "Blood bank profile not found" });
    }

    const inventoryItem = bloodBank.inventory.id(req.params.inventoryId);

    if (!inventoryItem) {
      return res.status(404).json({ message: "Inventory item not found" });
    }

    if (Number(inventoryItem.unitsCommitted || 0) > 0) {
      return res.status(400).json({
        message: "Inventory with committed blood cannot be deleted",
      });
    }

    inventoryItem.deleteOne();
    await bloodBank.save();

    const updatedBloodBank = await BloodBank.findById(bloodBank._id)
      .populate("userId", "email username phoneNumber role picture createdAt")
      .lean();

    return res.json({
      message: "Inventory deleted successfully",
      bloodBank: updatedBloodBank,
    });
  } catch (error) {
    console.error("Blood bank inventory delete error:", error);
    return res.status(500).json({ message: "Unable to delete inventory" });
  }
};

export const updateMyBloodBankInventory = async (req, res) => {
  try {
    const unitsAvailable = Number(req.body.unitsAvailable);
    const processingFee = Number(req.body.processingFee);
    const parsedExpiryDate = new Date(req.body.expiryDate);

    if (!Number.isFinite(unitsAvailable) || unitsAvailable < 0) {
      return res.status(400).json({ message: "Units available must be a valid number" });
    }

    if (!Number.isFinite(processingFee) || processingFee < 0) {
      return res.status(400).json({ message: "Processing fee must be a valid number" });
    }

    if (Number.isNaN(parsedExpiryDate.getTime())) {
      return res.status(400).json({ message: "Expiry date is required" });
    }

    const bloodBank = await BloodBank.findOne({ userId: req.user._id });

    if (!bloodBank) {
      return res.status(404).json({ message: "Blood bank profile not found" });
    }

    const inventoryItem = bloodBank.inventory.id(req.params.inventoryId);

    if (!inventoryItem) {
      return res.status(404).json({ message: "Inventory item not found" });
    }

    inventoryItem.unitsAvailable = unitsAvailable;
    inventoryItem.processingFee = processingFee;
    inventoryItem.expiryDate = parsedExpiryDate;

    await bloodBank.save();

    const updatedBloodBank = await BloodBank.findById(bloodBank._id)
      .populate("userId", "email username phoneNumber role picture createdAt")
      .lean();

    return res.json({
      message: "Inventory updated successfully",
      bloodBank: updatedBloodBank,
    });
  } catch (error) {
    console.error("Blood bank inventory update error:", error);
    return res.status(500).json({ message: "Unable to update inventory" });
  }
};

export const updateBloodBankStatusForAdmin = async (req, res) => {
  try {
    const { status, reason } = sanitize(req.body);

    if ((status === "Rejected" || status === "Suspended") && !reason?.trim()) {
      return res.status(400).json({ message: "A reason is required for this action" });
    }

    const bloodBank = await BloodBank.findById(req.params.bloodBankId);

    if (!bloodBank) {
      return res.status(404).json({ message: "Blood bank not found" });
    }

    const update = { $set: { status } };
    if (status === "Rejected") update.$set["review.rejectionReason"] = reason.trim();
    if (status === "Suspended") update.$set["review.suspensionReason"] = reason.trim();

    const updatedBloodBank = await BloodBank.findByIdAndUpdate(
      bloodBank._id,
      update,
      { new: true, runValidators: true },
    )
      .populate("userId", "email username phoneNumber role createdAt")
      .lean();

    const accountStatusByBloodBankStatus = {
      Approved: "active",
      Pending: "pending",
      Rejected: "rejected",
      Suspended: "suspended",
    };
    await User.findByIdAndUpdate(bloodBank.userId, {
      accountStatus: accountStatusByBloodBankStatus[status],
    });

    return res.json({
      message: "Blood bank status updated successfully",
      bloodBank: updatedBloodBank,
    });
  } catch (error) {
    console.error("Admin blood bank status update error:", error);
    return res.status(500).json({ message: "Unable to update blood bank status" });
  }
};

export const getNearbyBloodBanks = async (req, res) => {
  console.log("get NearbyBlood banks controller is running");

  console.log("query",req.query);

  try {
    let longitude = Number(req.query.longitude);
    let latitude = Number(req.query.latitude);

    if (
      !Number.isFinite(longitude) ||
      !Number.isFinite(latitude)
    ) {

      const user = await User.findById(req.user._id).select("location").lean();
      const coordinates = user?.location?.coordinates;
     
      if (
        !Array.isArray(coordinates) ||
        coordinates.length !== 2 ||
        coordinates.some((coordinate) => Number.isNaN(Number(coordinate)))
      ) {
        return res.status(400).json({ message: "Please update your current location first" });
      }

      [longitude, latitude] = coordinates.map(Number);
    }

    const bloodBanks = await BloodBank.aggregate([
      {
        $geoNear: {
          near: {
            type: "Point",
            coordinates: [longitude, latitude],
          },
          distanceField: "distanceInMeters",
          spherical: true,
          maxDistance: 50000,
          query: { status: "Approved" },
        },
      },
      {
        $project: {
          bloodBankName: 1,
          phoneNumber: 1,
          address: 1,
          location: 1,
          workingHours: 1,
          inventory: 1,
          distanceInMeters: 1,
        },
      },
      { $limit: 30 },
    ]);

    const bloodBanksWithRouteDistance = await Promise.all(
      bloodBanks.map(async (bloodBank) => {
        const [bankLongitude, bankLatitude] = bloodBank.location?.coordinates || [];
        const toLatitude = Number(bankLatitude);
        const toLongitude = Number(bankLongitude);

        if (!Number.isFinite(toLatitude) || !Number.isFinite(toLongitude)) {
          return {
            ...bloodBank,
            routeDistanceInMeters: null,
          };
        }

        try {
          const routeDistanceInMeters = await getRouteDistanceInMeters({
            fromLatitude: latitude,
            fromLongitude: longitude,
            toLatitude,
            toLongitude,
          });

          return {
            ...bloodBank,
            routeDistanceInMeters,
          };
        } catch (routeError) {
          console.error("Blood bank route distance error:", routeError.message);
          return {
            ...bloodBank,
            routeDistanceInMeters: null,
          };
        }
      })
    );

    return res.status(200).json({
      userLocation: {
        type: "Point",
        coordinates: [longitude, latitude],
      },
      bloodBanks: bloodBanksWithRouteDistance,
    });
  } catch (error) {
    console.error("Nearby blood banks error:", error);
    return res.status(500).json({ message: "Unable to load nearby blood banks" });
  }
};

export const registerBloodBank = async (req, res) => {
  let createdUser = null;

  try {
    const {email,password,confirmPassword,bloodBankName,licenseNumber,contactPersonName,phoneNumber,address,city,district,state,openingTime,closingTime,isOpen24Hours,location} = sanitize(req.body);

    if (!email ||!password ||!confirmPassword ||!bloodBankName ||!licenseNumber ||!contactPersonName ||!phoneNumber ||!address ||!location)
      return res.status(400).json({ message: "All required fields must be provided" });
    

    if (password !== confirmPassword) {
      return res.status(400).json({ message: "Password and confirm password must match" });
    }

    if (!req.file) {
      return res.status(400).json({ message: "License document is required" });
    }

    let parsedLocation;

    try {
      parsedLocation = JSON.parse(location);
    } catch {
      return res.status(400).json({ message: "Invalid location input" });
    }

    const coordinates = parsedLocation?.coordinates;

    if (
      parsedLocation?.type !== "Point" ||
      !Array.isArray(coordinates) ||
      coordinates.length !== 2 ||
      coordinates.some((coordinate) => Number.isNaN(Number(coordinate)))
    ) {
      return res.status(400).json({ message: "Exact blood bank location is required" });
    }

    if (isOpen24Hours !== "true" && (!openingTime || !closingTime)) {
      return res.status(400).json({ message: "Opening and closing time are required" });
    }

    const existingUser = await User.findOne({ email }).lean();

    if (existingUser) {
      return res.status(409).json({ message: "Email is already registered" });
    }

    const existingBloodBank = await BloodBank.findOne({ licenseNumber }).lean();

    if (existingBloodBank) {
      return res.status(409).json({ message: "License number is already registered" });
    }

    const uploadResult = await uploadBufferToCloudinary(req.file.buffer, {
      folder: "mediverse/blood-bank-licenses",
      public_id: `${licenseNumber}-${Date.now()}`,
    });

    createdUser = await User.create({
      username: contactPersonName,
      email,
      password,
      phoneNumber,
      role: "BloodBank",
      accountStatus:"pending"
    });

    const bloodBank=await BloodBank.create({
      userId: createdUser._id,
      bloodBankName,
      licenseNumber,
      contactPersonName,
      phoneNumber,
      address: {
        completeAddress: address,
        city: city || "",
        district: district || "",
        state: state || "",
      },
      location: {
        type: "Point",
        coordinates: coordinates.map(Number),
      },
      workingHours: {
        openingTime: isOpen24Hours === "true" ? "" : openingTime,
        closingTime: isOpen24Hours === "true" ? "" : closingTime,
        isOpen24Hours: isOpen24Hours === "true",
      },
      licenseDocument: {
        url: uploadResult.secure_url,
      },
    });

    const admins = await User.find({ role: "Admin" }).select("_id").lean();

    if (admins.length) {
      await Notification.insertMany(
        admins.map((admin) => ({
          userId: admin._id,
          title: "New Blood Bank Registration",
          message: `${bloodBankName} submitted a new blood bank registration for verification.`,
          type: "Blood Bank",
          actionUrl: `/admin/blood-bank/${bloodBank._id}`,
        })),
        { ordered: false }
      ).catch((notificationError) => {
        console.error("Blood bank admin notification error:", notificationError);
      });
    }

    return res.status(201).json({
     message:
    "Blood Bank registration submitted successfully. Your account is pending admin approval and verification may take up to 24 hours."
});

  } catch (error) {
    console.error("Blood bank registration error:", error);

    if (createdUser?._id) {
      await User.findByIdAndDelete(createdUser._id).catch((deleteError) => {
        console.error("Blood bank user cleanup error:", deleteError);
      });
    }

    if (error.code === 11000) {
      if (error.keyPattern?.email) {
        return res.status(409).json({ message: "Email is already registered" });
      }

      if (error.keyPattern?.licenseNumber) {
        return res.status(409).json({ message: "License number is already registered" });
      }
    }

    return res.status(500).json({ message: "Unable to register blood bank" });
  }
};


const BLOOD_GROUPS = [
  "A+",
  "A-",
  "B+",
  "B-",
  "AB+",
  "AB-",
  "O+",
  "O-",
];

const COMPONENTS = [
  "PRBC",
  "Platelets",
  "Plasma",
];

export const getAIDemandPrediction = async (req, res) => {
  try {
    console.log("AI prediction component is running");
    const userId = req.user._id;

    const now = new Date();

    const sevenDaysAgo = new Date(
      now.getTime() - 7 * 24 * 60 * 60 * 1000
    );

    const fourteenDaysAgo = new Date(
      now.getTime() - 14 * 24 * 60 * 60 * 1000
    );

    const thirtyDaysAgo = new Date(
      now.getTime() - 30 * 24 * 60 * 60 * 1000
    );

    // Fetch blood bank inventory
    const bloodBank = await BloodBank.findOne({userId:userId})
      .select("inventory")
      .lean();

    if (!bloodBank) {
      return res.status(404).json({
        success: false,
        message: "Blood bank not found",
      });
    }

    const bloodBankId=bloodBank._id;

    // Fetch completed requests from the last 30 days
    const requests = await BloodRequest.find({
      bloodBankId,
      requestStatus: "Completed",
      createdAt: {
        $gte: thirtyDaysAgo,
      },
    })
      .select("items createdAt")
      .lean();

    const demandData = {};

    // Analyze each blood component
    for (const component of COMPONENTS) {
      demandData[component] = {};

      // Analyze each blood group
      for (const bloodGroup of BLOOD_GROUPS) {
        const matchingItems = [];

        // Find matching items from completed requests
        for (const request of requests) {
          for (const item of request.items) {
            if (
              item.component === component &&
              item.bloodGroup === bloodGroup
            ) {
              matchingItems.push({
                quantity: item.quantity,
                createdAt: request.createdAt,
              });
            }
          }
        }

        // Demand during the last 7 days
        const last7DaysDemand = matchingItems
          .filter(
            (item) => item.createdAt >= sevenDaysAgo
          )
          .reduce(
            (total, item) =>
              total + Number(item.quantity),
            0
          );

        // Demand during the previous 7 days
        const previous7DaysDemand = matchingItems
          .filter(
            (item) =>
              item.createdAt >= fourteenDaysAgo &&
              item.createdAt < sevenDaysAgo
          )
          .reduce(
            (total, item) =>
              total + Number(item.quantity),
            0
          );

        // Total demand during the last 30 days
        const last30DaysDemand = matchingItems.reduce(
          (total, item) =>
            total + Number(item.quantity),
          0
        );

        // Find inventory for this component + blood group
        const inventoryItem = bloodBank.inventory.find(
          (item) =>
            item.type === component &&
            item.bloodGroup === bloodGroup
        );

        /*
         * OPTION 1
         *
         * unitsAvailable = total physical stock
         * unitsCommitted = stock reserved for approved requests
         * currentStock = stock available for new requests
         */

        const totalStock =
          inventoryItem?.unitsAvailable || 0;

        const unitsCommitted =
          inventoryItem?.unitsCommitted || 0;

        const currentStock = Math.max(
          0,
          totalStock - unitsCommitted
        );

        // Calculate weekly demand trend
        let percentageChange = 0;

        if (previous7DaysDemand > 0) {
          percentageChange = Number(
            (
              ((last7DaysDemand -
                previous7DaysDemand) /
                previous7DaysDemand) *
              100
            ).toFixed(2)
          );
        } else if (last7DaysDemand > 0) {
          percentageChange = 100;
        }

        // Final data sent to Grok
        demandData[component][bloodGroup] = {
          totalStock,
          unitsCommitted,
          currentStock,
          last7DaysDemand,
          previous7DaysDemand,
          last30DaysDemand,
          percentageChange,
        };
      }
    }

    // Send processed data to Groq
    const prediction = await generateDemandPrediction({
      forecastPeriod: "Next 7 Days",
      generatedAt: now.toISOString(),
      demandData,
    });

    return res.status(200).json({
      success: true,
      message:
        "AI demand prediction generated successfully",
      data: prediction,
    });
    
  } catch (error) {
    console.error(
      "AI demand prediction error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to generate AI demand prediction",
    });
  }
};
