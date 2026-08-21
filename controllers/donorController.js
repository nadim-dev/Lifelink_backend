import { sanitize } from "../utils/sanitize.js";
import { donorSchema, updateDonorSchema } from "../validators/donorValidator.js";
import User from "../models/userModel.js";
import { createDonorProfile } from "../services/donorService.js";
import Donor from "../models/donorModel.js";

const getAddressFromCoordinates = async ({ latitude, longitude }) => {
  const response = await fetch(
  `https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/reverseGeocode?f=pjson&featureTypes=location&location=${longitude},${latitude}`
);

   const geoData= await response.json();

  console.log("geoData",geoData);

  if (!geoData.address?.Match_addr) {
    throw new Error("Address not found for these coordinates");
  }

  return geoData;
};

const sanitizeText = (value) => sanitize({ value }).value;


export const updateUserLocation = async (req, res) => {
  try {
    const { coordinates } = req.body;
    console.log("coordinates", coordinates);

    const latitude = Number(coordinates?.latitude);
    const longitude = Number(coordinates?.longitude);

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return res.status(400).json({ message: "Valid coordinates are required" });
    }

    const {address} = await getAddressFromCoordinates(coordinates);
    console.log("address",address);
    const shortAddress = sanitizeText(address.ShortLabel || address.Address || address.Match_addr);

    const updatedUser = await User.findByIdAndUpdate(
      req.user._id,
      {
        city: sanitizeText(address.City || address.District || ""),
        district: sanitizeText(address.District || address.Subregion || ""),
        state: sanitizeText(address.Region || ""),
        short_address: shortAddress,
        location: {
          type: "Point",
          coordinates: [longitude, latitude],
        },
        lastLocationUpdatedAt: new Date(),
      },
      { new: true, runValidators: true },
    );

    return res.status(200).json({
      message: "Location updated successfully",
      short_address: updatedUser.short_address,
      location: updatedUser.location,
      lastLocationUpdatedAt: updatedUser.lastLocationUpdatedAt,
    });
  } catch (err) {
    console.log(err.message);

    if (
      err.message === "Google Maps API key is missing" ||
      err.message === "Unable to convert coordinates into address" ||
      err.message === "Address not found for these coordinates"
    ) {
      return res.status(502).json({ message: "Unable to detect address from coordinates" });
    }

    return res.status(500).json({ message: "Internal Server Error" });
  }
};


export const createDonor = async (req, res) => {
  try {
    const { success, data, error } = donorSchema.safeParse(req.body);

    if (!success) {
      return res.status(400).json({
        message: "Invalid donor input",
        errors: error.flatten().fieldErrors,
      });
    }

    const { donor } = await createDonorProfile({
      userId: req.user._id,
      donorInput: data,
    });

    return res.status(201).json({
      message: "Donor profile created successfully",
      donor,
    });
  } catch (err) {
    console.log(err.message);

    if (err.statusCode) {
      return res.status(err.statusCode).json({ message: err.message });
    }

    if (
      err.message === "Google Maps API key is missing" ||
      err.message === "Unable to convert coordinates into address" ||
      err.message === "Address not found for these coordinates"
    ) {
      return res.status(502).json({ message: "Unable to detect address from coordinates" });
    }

    return res.status(500).json({ message: "Internal Server Error" });
  }
};

export const getCurrentUserDonor = async (req, res) => {
  try {
    const donor = await Donor.findOne({ userId: req.user._id }).lean();

    if (!donor) {
      return res.status(404).json({ message: "Donor profile not found" });
    }

    return res.status(200).json({ donor });
  } catch (err) {
    console.log(err.message);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

export const updateCurrentUserDonor = async (req, res) => {
  try {
    const { success, data, error } = updateDonorSchema.safeParse(req.body);

    if (!success) {
      return res.status(400).json({
        message: "Invalid donor input",
        errors: error.flatten().fieldErrors,
      });
    }

    const donor = await Donor.findOneAndUpdate(
      { userId: req.user._id },
      {
        weight: data.weight,
        isHealthy: data.isHealthy,
        healthReason: data.isHealthy === "no" ? sanitizeText(data.healthReason) : "",
        availability: data.availability,
        preferredDistance: data.preferredDistance,
      },
      { new: true, runValidators: true },
    ).lean();

    if (!donor) {
      return res.status(404).json({ message: "Donor profile not found" });
    }

    return res.status(200).json({
      message: "Donor information updated successfully",
      donor,
    });
  } catch (err) {
    console.log(err.message);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

export const getAllUsersStats = async (req, res) => {
  try {
    const userRoleFilter = { role: "User" };
    const [total, donors, suspended] = await Promise.all([
      User.countDocuments(userRoleFilter),
      User.countDocuments({ ...userRoleFilter, isDonor: true }),
      User.countDocuments({ ...userRoleFilter, accountStatus: "suspended" }),
    ]);

    return res.status(200).json({
      stats: {
        total,
        donors,
        suspended,
        active: Math.max(total - suspended, 0),
      },
    });
  } catch (err) {
    console.log(err.message);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

export const getAllUsersForAdmin = async (req, res) => {
  try {
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(req.query.limit) || 10, 1), 50);
    const { tab = "all", search = "", status = "All", bloodGroup = "All", city = "All" } = req.query;
    const query = { role: "User" };

    if (tab === "donors") query.isDonor = true;
    if (tab === "suspended") query.accountStatus = "suspended";
    if (status !== "All") query.accountStatus = status.toLowerCase();
    if (search.trim()) {
      const escapedSearch = search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const searchRegex = new RegExp(escapedSearch, "i");
      query.$or = [{ username: searchRegex }, { email: searchRegex }, { phoneNumber: searchRegex }];
    }
    if (city !== "All") query.city = city;
    if (bloodGroup !== "All") {
      const matchingDonors = await Donor.find({ bloodGroup }).select("userId").lean();
      query._id = { $in: matchingDonors.map((donor) => donor.userId) };
    }

    const [users, total] = await Promise.all([
      User.find(query)
        .select("username email phoneNumber city picture accountStatus isDonor createdAt")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      User.countDocuments(query),
    ]);

    const donorProfiles = await Donor.find({ userId: { $in: users.map((user) => user._id) } })
      .select("userId bloodGroup")
      .lean();
    const bloodGroupByUserId = new Map(donorProfiles.map((donor) => [String(donor.userId), donor.bloodGroup]));

    return res.status(200).json({
      users: users.map((user) => ({
        ...user,
        bloodGroup: bloodGroupByUserId.get(String(user._id)) || "",
      })),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    console.log(err.message);
    return res.status(500).json({ message: "Unable to load users" });
  }
};

export const getAdminUserDetails = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findOne({ _id: userId, role: "User" })
      .select("-password -passwordResetToken -passwordResetExpires")
      .lean();

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const donor = user.isDonor
      ? await Donor.findOne({ userId: user._id }).select("-__v").lean()
      : null;

    return res.status(200).json({
      user: {
        _id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        accountStatus: user.accountStatus,
        isDonor: user.isDonor,
        phoneNumber: user.phoneNumber,
        gender: user.gender,
        dateOfBirth: user.dateOfBirth,
        city: user.city,
        district: user.district,
        state: user.state,
        short_address: user.short_address,
        location: user.location,
        lastLocationUpdatedAt: user.lastLocationUpdatedAt,
        picture: user.picture,
        authProvider: user.authProvider,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
      donor: donor
        ? {
            _id: donor._id,
            bloodGroup: donor.bloodGroup,
            weight: donor.weight,
            hasDonatedBefore: donor.hasDonatedBefore,
            lastDonationDate: donor.lastDonationDate,
            isHealthy: donor.isHealthy,
            healthReason: donor.healthReason,
            eligibilityConfirmed: donor.eligibilityConfirmed,
            availability: donor.availability,
            preferredDistance: donor.preferredDistance,
            notificationPreferences: donor.notificationPreferences,
            createdAt: donor.createdAt,
            updatedAt: donor.updatedAt,
          }
        : null,
    });
  } catch (err) {
    console.log(err.message);
    return res.status(500).json({ message: "Unable to load user details" });
  }
};


export const suspendUser = async (req, res) => {
  try {
    console.log("Suspend user function is running");

    const { userId } = req.params;

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    user.accountStatus = "suspended";

    await user.save();

    return res.status(200).json({
      success: true,
      message: "User suspended successfully",
    });
  } catch (error) {
    console.error("Error suspending user:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to suspend user",
    });
  }
};
