import Notification from "../models/notificationModel.js";
import BloodBank from "../models/BloodbankModel.js";
import User from "../models/userModel.js";
import { sanitize } from "../utils/sanitize.js";
import { uploadBufferToCloudinary } from "../utils/uploadToCloudinary.js";

const getRouteDistanceInMeters = async ({ fromLatitude, fromLongitude, toLatitude, toLongitude }) => {
  if (!process.env.GEOAPIFY_API_KEY) return null;

  const url = new URL("https://api.geoapify.com/v1/routing");
  url.searchParams.set("waypoints", `${fromLatitude},${fromLongitude}|${toLatitude},${toLongitude}`);
  url.searchParams.set("mode", "drive");
  url.searchParams.set("apiKey", process.env.GEOAPIFY_API_KEY);

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error("Geoapify route distance request failed");
  }

  const data = await response.json();
  const distance = Number(data?.features?.[0]?.properties?.distance);

  return Number.isFinite(distance) ? distance : null;
};

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

export const updateBloodBankStatusForAdmin = async (req, res) => {
  try {
    const { status, reason } = sanitize(req.body);
    const allowedStatuses = ["Approved", "Rejected", "Suspended", "Pending"];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ message: "Invalid blood bank status" });
    }

    if ((status === "Rejected" || status === "Suspended") && !reason?.trim()) {
      return res.status(400).json({ message: "A reason is required for this action" });
    }

    const bloodBank = await BloodBank.findById(req.params.bloodBankId);

    if (!bloodBank) {
      return res.status(404).json({ message: "Blood bank not found" });
    }

    const previousStatus = bloodBank.status;
    const now = new Date();
    bloodBank.status = status;

    if (status === "Approved") {
      bloodBank.review.approvedAt = now;
      bloodBank.review.approvedBy = req.user._id;
      bloodBank.review.rejectionReason = undefined;
    }

    if (status === "Rejected") {
      bloodBank.review.rejectedAt = now;
      bloodBank.review.rejectedBy = req.user._id;
      bloodBank.review.rejectionReason = reason.trim();
    }

    if (status === "Suspended") {
      bloodBank.review.suspendedAt = now;
      bloodBank.review.suspendedBy = req.user._id;
      bloodBank.review.suspensionReason = reason.trim();
      bloodBank.review.previousStatus = previousStatus;
    }

    if (status === "Pending" && previousStatus === "Suspended") {
      bloodBank.review.reactivatedAt = now;
      bloodBank.review.reactivatedBy = req.user._id;
      bloodBank.review.previousStatus = previousStatus;
    }

    bloodBank.activityHistory.push({
      action: `Status changed to ${status}`,
      status,
      note: reason?.trim() || "",
      performedBy: req.user._id,
      performedAt: now,
    });

    await bloodBank.save();

    await User.findByIdAndUpdate(bloodBank.userId,{accountStatus:"active"})

    const updatedBloodBank = await BloodBank.findById(bloodBank._id)
      .populate("userId", "email username phoneNumber role createdAt")
      .populate("review.approvedBy", "username email")
      .populate("review.rejectedBy", "username email")
      .populate("review.suspendedBy", "username email")
      .populate("review.reactivatedBy", "username email")
      .populate("activityHistory.performedBy", "username email")
      .lean();

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
  try {
    let longitude = Number(req.query.longitude);
    let latitude = Number(req.query.latitude);

     const inventory=[
    {
      "bloodGroup": "O+",
      "type": "PRBC",
      "processingFee": 1200,
      "unitsAvailable": 10,
    },
    {
      "bloodGroup": "O+",
      "type": "Platelets",
      "processingFee": 1500,
      "unitsAvailable": 5,
    },
    {
      "bloodGroup": "AB+",
      "type": "Plasma",
      "processingFee": 900,
      "unitsAvailable": 8,
    }
  ]

  const updatedBloodBank = await BloodBank.findOneAndUpdate(
      { _id: "6a7733ec2ad7cce1509ac6b1" },
      {
        $set: {
          inventory,
        },
      },
      {
        new: true,
        runValidators: true,
        returnDocument:"after"
      }
    ).select("inventory");

    console.log("updatedBloodBank",updatedBloodBank);

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
