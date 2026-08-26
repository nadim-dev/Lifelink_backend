import { sanitize } from "../utils/sanitize.js";
import { donorSchema, updateDonorSchema } from "../validators/donorValidator.js";
import User from "../models/userModel.js";
import { createDonorProfile } from "../services/donorService.js";
import Donor from "../models/donorModel.js";
import { getRouteDistanceInMeters } from "../utils/geoapifyDistance.js";
import Notification from "../models/notificationModel.js";
import DonorContact from "../models/donorContactModel.js";
import axios from "axios";

const DONOR_CONTACT_COOLDOWN_MS = 12 * 60 * 60 * 1000;

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

export const getNearbyDonors = async (req, res) => {
  try {
    const bloodGroup = String(req.query.bloodGroup || "").trim();
    const radiusKm = Math.min(Math.max(Number(req.query.radius) || 10, 1), 50);

    const currentUser = await User.findById(req.user._id).select("location").lean();
    const coordinates = currentUser?.location?.coordinates;
   
    if (!bloodGroup) return res.status(400).json({ message: "Blood group is required" });
    if (!Array.isArray(coordinates) || coordinates.length !== 2) {
      return res.status(400).json({ message: "Please update your location before searching for donors" });
    }

    const donors = await Donor.find({
      bloodGroup,
      availability: { $ne: "unavailable" },
      eligibilityConfirmed: true,
    })
      .populate({
        path: "userId",
        select: "username phoneNumber picture location accountStatus isDonor gender dateOfBirth",
        match: { accountStatus: "active","location.coordinates": { $exists: true } },
      })
      .lean();

    const nearbyDonors = (await Promise.all(donors
      .filter((donor) => donor.userId)
      .map(async (donor) => {
        const [toLongitude, toLatitude] = donor.userId.location.coordinates;
        const distanceMeters = await getRouteDistanceInMeters({
          fromLatitude: coordinates[1],
          fromLongitude: coordinates[0],
          toLatitude,
          toLongitude,
        });
        if (distanceMeters === null) return null;
        const distance = distanceMeters / 1000;
        console.log("distance",distance);        
        const lastContact = await DonorContact.findOne({
          requesterId: req.user._id,
          donorId: donor._id,
        }).sort({ createdAt: -1 }).select("createdAt").lean();
        const contactedUntil = lastContact
          ? new Date(new Date(lastContact.createdAt).getTime() + DONOR_CONTACT_COOLDOWN_MS)
          : null;

        return {
          _id: donor._id,
          fullName: donor.userId.username,
          bloodGroup: donor.bloodGroup,
          phoneNumber:donor.userId.phoneNumber,
          gender: donor.userId.gender,
          age: donor.userId.dateOfBirth
            ? Math.max(0, Math.floor((Date.now() - new Date(donor.userId.dateOfBirth).getTime()) / 31557600000))
            : null,
          picture: donor.userId.picture,
          distance: Number(distance.toFixed(1)),
          preferredDistance: donor.preferredDistance,
          availability: donor.availability,
          lastDonationDate: donor.lastDonationDate,
          contactedUntil: contactedUntil && contactedUntil > new Date()
            ? contactedUntil
            : null,
        };
      })))
      .filter(Boolean)
      // A donor must be within both the patient's selected radius and
      // the maximum distance that donor has agreed to travel.
      .filter(
        (donor) =>
          donor.distance <= radiusKm &&
          donor.preferredDistance >= donor.distance,
      )
      .sort((first, second) => first.distance - second.distance);

    return res.status(200).json({ donors: nearbyDonors });
  } catch (error) {
    console.error("Nearby donors error:", error);
    return res.status(500).json({ message: "Unable to load nearby donors" });
  }
};

export const sendWhatsAppSms=async (req,res)=>{
  console.log("send whatsapp sms function is running");
  const {donorId}=req.params;
  console.log("donorId",donorId);
  const {distance}=req.body;
  const requester=await User.findById(req.user._id).lean().select("username phoneNumber short_address")
  try{
  const donor= await Donor.findById(donorId).populate("userId");
  console.log("donor",donor);
  if(!donor)
    return res.status(404).json({"messages":"donor dosen't exist"});

  if (!donor.userId) {
    return res.status(404).json({ message: "Donor user account not found" });
  }

  const lastContact = await DonorContact.findOne({
    requesterId: req.user._id,
    donorId,
  }).sort({ createdAt: -1 }).select("createdAt").lean();
  
  const contactedUntil = lastContact
    ? new Date(new Date(lastContact.createdAt).getTime() + DONOR_CONTACT_COOLDOWN_MS)
    : null;

  if (contactedUntil && contactedUntil > new Date()) {
    return res.status(429).json({
      message: "You already contacted this donor recently.",
      contactedUntil,
    });
  }

   const body= `🩸 *New Blood Donation Request*

Hello ${donor.userId.username},

A blood donation request has been made for a patient requiring *${donor.bloodGroup} blood*.

*Request Details:*
👤 Requester: ${requester.username}
🏥 Location: ${requester.short_address}
📍 Distance: Approximately ${distance} km away
🚨 Priority: Urgent

📞 *Contact Number:* ${requester.phoneNumber}

If you are available and willing to donate, please contact the requester directly.

Thank you for supporting someone in need.

— *Lifelink*`


  const response = await axios.post(
      "https://restapi.geniusdevel.com/api/send",

      {
        sessionId: process.env.GENIUS_SESSION_ID,
        number: `91${donor.userId.phoneNumber}`,
        type: "text",
        message: body,
        source: "API",
      },

      {
        headers: {
          "x-api-key": process.env.GENIUS_API_KEY,
          "Content-Type": "application/json",
        },
      }
);

  await DonorContact.create({
    requesterId: req.user._id,
    donorId,
  });

  console.log("response",response);
 

  const notification = await Notification.create({
    userId: donor.userId._id,
    title: "New Blood Request",
    message: `${requester.username} is requesting ${donor.bloodGroup} blood approximately ${distance} km away.
    Contact: ${requester.phoneNumber}`,
    type: "Blood Request",
    actionUrl: "/notifications",
  });

  const io = req.app.get("io");
  io.to(`user:${donor.userId._id}`).emit("newNotification", notification);


  return res.status(200).json({"message":"sms send succesfully"});
  }catch(err){
    console.log(err.message);
    console.log(err);
    return res.status(err.status || 500).json({
      message: err.message || "Unable to send WhatsApp message",
      code: err.code,
    });
  }

}
