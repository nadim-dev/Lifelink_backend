import DeliveryPartner from "../models/deliveryPartnerModel.js";
import User from "../models/userModel.js";
import { sanitize } from "../utils/sanitize.js";
import { uploadBufferToCloudinary } from "../utils/uploadToCloudinary.js";

const deliveryPartnerSelect = "-password";

export const registerDeliveryPartner = async (req, res) => {
  let createdUser = null;

  try {
    const {
      fullName,
      email,
      phoneNumber,
      password,
      confirmPassword,
      aadhaarNumber,
      vehicleType,
      vehicleNumber,
      drivingLicenseNumber,
      location,
    } = sanitize(req.body);

    if (password !== confirmPassword) {
      return res.status(400).json({ message: "Password and confirm password must match" });
    }

    const allowedVehicleTypes = ["bike", "scooter"];

    if (!allowedVehicleTypes.includes(vehicleType)) {
      return res.status(400).json({ message: "Only bike or scooter is allowed for delivery partner vehicle" });
    }

    const aadhaarDocument = req.files?.aadhaarDocument?.[0];
    const licenseDocument = req.files?.licenseDocument?.[0];

    let parsedLocation;

    try {
      parsedLocation = JSON.parse(location);
    } catch {
      return res.status(400).json({ message: "Invalid location input" });
    }

    const coordinates = parsedLocation?.coordinates;

    const existingUser = await User.findOne({ email }).lean();

    if (existingUser) {
      return res.status(409).json({ message: "Email is already registered" });
    }

    const aadhaarUpload = await uploadBufferToCloudinary(aadhaarDocument.buffer, {
      folder: "mediverse/delivery-partner-aadhaar",
      public_id: `${aadhaarNumber}-${Date.now()}`,
    });

    const licenseUpload = await uploadBufferToCloudinary(licenseDocument.buffer, {
      folder: "mediverse/delivery-partner-licenses",
      public_id: `${drivingLicenseNumber}-${Date.now()}`,
    });

    createdUser = await User.create({
      username: fullName,
      email,
      password,
      phoneNumber,
      role: "DeliveryPartner",
      accountStatus: "pending",
    });

    await DeliveryPartner.create({
      userId: createdUser._id,
      fullName,
      email,
      phoneNumber,
      password: createdUser.password,
      aadhaarNumber,
      aadhaarDocumentUrl: aadhaarUpload.secure_url,
      vehicleType,
      vehicleNumber,
      drivingLicenseNumber,
      drivingLicenseDocumentUrl: licenseUpload.secure_url,
      currentLocation: {
        type: "Point",
        coordinates: coordinates.map(Number),
      },
      locationUpdatedAt: new Date(),
    });

    return res.status(201).json({
      message:
        "Delivery partner registration submitted successfully. Your account verification will be completed within 24 hours.",
    });
  } catch (error) {
    console.error("Delivery partner registration error:", error);

    if (createdUser?._id) {
      await User.findByIdAndDelete(createdUser._id).catch((deleteError) => {
        console.error("Delivery partner user cleanup error:", deleteError);
      });
    }

    if (error.code === 11000) {
      if (error.keyPattern?.email) {
        return res.status(409).json({ message: "Email is already registered" });
      }

      if (error.keyPattern?.phoneNumber) {
        return res.status(409).json({ message: "Phone number is already registered" });
      }

      if (error.keyPattern?.drivingLicenseNumber) {
        return res.status(409).json({ message: "Driving license number is already registered" });
      }
    }

    return res.status(500).json({ message: "Unable to register delivery partner" });
  }
};

export const getDeliveryPartnerStats = async (req, res) => {
  try {
    const [total, pending, active, suspended] = await Promise.all([
      DeliveryPartner.countDocuments(),
      DeliveryPartner.countDocuments({ accountStatus: "pending" }),
      DeliveryPartner.countDocuments({ accountStatus: "approved" }),
      DeliveryPartner.countDocuments({ accountStatus: "suspended" }),
    ]);

    return res.status(200).json({
      stats: {
        total,
        pending,
        active,
        suspended,
      },
    });
  } catch (error) {
    console.error("Delivery partner stats error:", error);
    return res.status(500).json({ message: "Unable to load delivery partner stats" });
  }
};

export const getDeliveryPartners = async (req, res) => {
  try {
    const partners = await DeliveryPartner.find()
      .select(deliveryPartnerSelect)
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({ partners });
  } catch (error) {
    console.error("Delivery partner list error:", error);
    return res.status(500).json({ message: "Unable to load delivery partners" });
  }
};

export const getDeliveryPartnerById = async (req, res) => {
  try {
    const partner = await DeliveryPartner.findById(req.params.partnerId)
      .select(deliveryPartnerSelect)
      .lean();

    if (!partner) {
      return res.status(404).json({ message: "Delivery partner not found" });
    }

    return res.status(200).json({ partner });
  } catch (error) {
    console.error("Delivery partner details error:", error);
    return res.status(500).json({ message: "Unable to load delivery partner" });
  }
};

export const approveDeliveryPartner = async (req, res) => {
  return updatePartnerAccount(req, res, "approved", "Delivery partner approved successfully");
};

export const rejectDeliveryPartner = async (req, res) => {
  return updatePartnerAccount(req, res, "rejected", "Delivery partner rejected successfully");
};

export const updateDeliveryPartnerStatus = async (req, res) => {
  const { accountStatus } = sanitize(req.body);
  const allowedStatuses = ["pending", "approved", "rejected", "suspended"];

  if (!allowedStatuses.includes(accountStatus)) {
    return res.status(400).json({ message: "Invalid delivery partner status" });
  }

  return updatePartnerAccount(req, res, accountStatus, "Delivery partner status updated successfully");
};

const updatePartnerAccount = async (req, res, accountStatus, message) => {
  try {
    const userAccountStatus = accountStatus === "approved" ? "active" : accountStatus;
    const availabilityStatus = accountStatus === "approved" ? "available" : "offline";
    const partner = await DeliveryPartner.findByIdAndUpdate(
      req.params.partnerId,
      { accountStatus, availabilityStatus },
      { new: true, runValidators: true },
    ).select(deliveryPartnerSelect);

    if (!partner) {
      return res.status(404).json({ message: "Delivery partner not found" });
    }

    await User.findOneAndUpdate(
      { email: partner.email },
      { accountStatus: userAccountStatus },
      { runValidators: true },
    );

    return res.status(200).json({ message, partner });
  } catch (error) {
    console.error("Delivery partner status update error:", error);
    return res.status(500).json({ message: "Unable to update delivery partner status" });
  }
};
