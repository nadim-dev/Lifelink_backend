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
    const [total, donors, suspended] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ isDonor: true }),
      User.countDocuments({ accountStatus: "suspended" }),
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


