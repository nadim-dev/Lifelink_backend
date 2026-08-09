import BloodBank from "../models/BloodbankModel.js";
import User from "../models/userModel.js";
import { sanitize } from "../utils/sanitize.js";
import { uploadBufferToCloudinary } from "../utils/uploadToCloudinary.js";

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
      username: bloodBankName,
      email,
      password,
      phoneNumber,
      role: "BloodBank",
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
