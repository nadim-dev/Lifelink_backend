import Donor from "../models/donorModel.js";
import { sanitize } from "../utils/sanitize.js";
import { donorSchema } from "../validators/donorValidator.js";
import User from "../models/userModel.js";

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

    const {address} = await getAddressFromCoordinates(coordinates);
    console.log("address",address);
    const shortAddress = sanitizeText(address.ShortLabel || address.Address || address.Match_addr);

    await User.findByIdAndUpdate(
      req.user._id,
      {
        city: sanitizeText(address.City || address.District || ""),
        state: sanitizeText(address.Region || ""),
        short_address: shortAddress,
        long_address: sanitizeText(address.LongLabel || address.Match_addr),
        coordinates: {latitude: address.Y,longitude: address.X}
      },
      { runValidators: true },
    );

    return res.status(200).json({
      message: "Location updated successfully",
      short_address: shortAddress,
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

    const donorData = {
      ...data,
      phoneNumber: sanitizeText(data.phoneNumber),
      userId: req.user._id,
      lastDonationDate: data.lastDonationDate || null,
      healthReason: sanitizeText(data.healthReason || ""),
    };

    const donor = await Donor.findOneAndUpdate(
      { userId:req.user._id},
      donorData,
      {
        new: true,
        runValidators: true,
        upsert: true,
      },
    );

    await User.findByIdAndUpdate(
      req.user._id,
      {
        isDonor: true,
        bloodGroup: data.bloodGroup,
      },
      { runValidators: true },
    );

    return res.status(201).json({
      message: "Donor profile created successfully",
      donor,
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
