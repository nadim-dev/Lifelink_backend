import Hospital from "../models/HospitalModel.js";
import Notification from "../models/notificationModel.js";
import User from "../models/userModel.js";
import { sanitize } from "../utils/sanitize.js";
import { uploadBufferToCloudinary } from "../utils/uploadToCloudinary.js";

const hospitalSelect = "-password";

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

export const getHospitalStats = async (req, res) => {
  try {
    const [total, pending, approved, rejected, suspended] = await Promise.all([
      Hospital.countDocuments(),
      Hospital.countDocuments({ accountStatus: "pending" }),
      Hospital.countDocuments({ accountStatus: "approved" }),
      Hospital.countDocuments({ accountStatus: "rejected" }),
      Hospital.countDocuments({ accountStatus: "suspended" }),
    ]);

    return res.status(200).json({
      stats: {
        total,
        pending,
        approved,
        rejected,
        suspended,
      },
    });
  } catch (error) {
    console.error("Hospital stats error:", error);
    return res.status(500).json({ message: "Unable to load hospital stats" });
  }
};

export const getHospitals = async (req, res) => {
  try {
    const hospitals = await Hospital.find()
      .select(hospitalSelect)
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({ hospitals });
  } catch (error) {
    console.error("Hospital list error:", error);
    return res.status(500).json({ message: "Unable to load hospitals" });
  }
};

export const getHospitalById = async (req, res) => {
  try {
    const hospital = await Hospital.findById(req.params.hospitalId)
      .select(hospitalSelect)
      .lean();

    if (!hospital) {
      return res.status(404).json({ message: "Hospital not found" });
    }

    return res.status(200).json({ hospital });
  } catch (error) {
    console.error("Hospital details error:", error);
    return res.status(500).json({ message: "Unable to load hospital" });
  }
};

export const getPublicHospitalById = async (req, res) => {
  try {
    const hospital = await Hospital.findOne({
      _id: req.params.hospitalId,
      accountStatus: "approved",
    })
      .select("name hospitalType phoneNumber address location contactPerson accountStatus verificationStatus")
      .lean();

    if (!hospital) {
      return res.status(404).json({ message: "Hospital not found" });
    }

    return res.status(200).json({ hospital });
  } catch (error) {
    console.error("Public hospital details error:", error);
    return res.status(500).json({ message: "Unable to load hospital" });
  }
};

export const updateHospitalStatus = async (req, res) => {
  const { accountStatus } = sanitize(req.body);
  const allowedStatuses = ["pending", "approved", "rejected", "suspended"];

  if (!allowedStatuses.includes(accountStatus)) {
    return res.status(400).json({ message: "Invalid hospital status" });
  }

  try {
    const userAccountStatus = accountStatus === "approved" ? "active" : accountStatus;
    const hospital = await Hospital.findByIdAndUpdate(
      req.params.hospitalId,
      {
        accountStatus,
        verificationStatus: accountStatus === "approved" ? "verified" : accountStatus === "rejected" ? "rejected" : "pending",
      },
      { new: true, runValidators: true },
    ).select(hospitalSelect);

    if (!hospital) {
      return res.status(404).json({ message: "Hospital not found" });
    }

    await User.findOneAndUpdate(
      { email: hospital.email },
      { accountStatus: userAccountStatus },
      { runValidators: true },
    );

    return res.status(200).json({ message: "Hospital status updated successfully", hospital });
  } catch (error) {
    console.error("Hospital status update error:", error);
    return res.status(500).json({ message: "Unable to update hospital status" });
  }
};

export const registerHospital = async (req, res) => {
  let createdUser = null;

  try {
    const {email,password,confirmPassword,name,hospitalType,registrationNumber,phoneNumber,address,city,district,state,location,contactName,contactPhoneNumber,contactEmail} = sanitize(req.body);

    if ( !email || !password || !confirmPassword || !name || !hospitalType || !registrationNumber || !phoneNumber || !address || !city || !state || !location || !contactName || !contactPhoneNumber || !contactEmail)
      return res.status(400).json({ message: "All required fields must be provided" });
    

    if (password !== confirmPassword)
      return res.status(400).json({ message: "Password and confirm password must match" });
    

    if (!req.file) 
      return res.status(400).json({ message: "Registration certificate is required" });
    

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
      return res.status(400).json({ message: "Exact hospital location is required" });
    }

    const existingUser = await User.findOne({ email }).lean();

    if (existingUser) {
      return res.status(409).json({ message: "Email is already registered" });
    }

    const existingHospital = await Hospital.findOne({ registrationNumber }).lean();

    if (existingHospital) {
      return res.status(409).json({ message: "Registration number is already registered" });
    }

    const uploadResult = await uploadBufferToCloudinary(req.file.buffer, {
      folder: "mediverse/hospital-registration-documents",
      public_id: `${registrationNumber}-${Date.now()}`,
    });

    createdUser = await User.create({
      username: contactName,
      email,
      password,
      phoneNumber,
      role: "Hospital",
      accountStatus: "pending",
    });

    const hospital = await Hospital.create({
      email,
      password: createdUser.password,
      name,
      hospitalType,
      registrationNumber,
      phoneNumber,
      address: {
        fullAddress: address,
        city,
        district: district || "",
        state,
      },
      location: {
        type: "Point",
        coordinates: coordinates.map(Number),
      },
      contactPerson: {
        name: contactName,
        phoneNumber: contactPhoneNumber,
        email: contactEmail,
      },
      registrationDocumentUrl: uploadResult.secure_url,
    });

    const admins = await User.find({ role: "Admin" }).select("_id").lean();

    if (admins.length) {
      await Notification.insertMany(
        admins.map((admin) => ({
          userId: admin._id,
          title: "New Hospital Registration",
          message: `${name} submitted a new hospital registration for verification.`,
          type: "Hospital",
          actionUrl: `/admin/hospitals/${hospital._id}`,
        })),
        { ordered: false },
      ).catch((notificationError) => {
        console.error("Hospital admin notification error:", notificationError);
      });
    }

    return res.status(201).json({
      message:
        "Hospital registration submitted successfully. Your account is pending admin approval and verification may take up to 24 hours.",
    });
  } catch (error) {
    console.error("Hospital registration error:", error);

    if (createdUser?._id) {
      await User.findByIdAndDelete(createdUser._id).catch((deleteError) => {
        console.error("Hospital user cleanup error:", deleteError);
      });
    }

    if (error.code === 11000) {
      if (error.keyPattern?.email) {
        return res.status(409).json({ message: "Email is already registered" });
      }

      if (error.keyPattern?.registrationNumber) {
        return res.status(409).json({ message: "Registration number is already registered" });
      }
    }

    return res.status(500).json({ message: "Unable to register hospital" });
  }
};

export const getNearbyHospitals = async (req, res) => {
  console.log("get nearbyHospitals controller is running");

  try {
    const user = await User.findById(req.user._id).select("location").lean();
    const coordinates = user?.location?.coordinates;

    if (
      !Array.isArray(coordinates) ||
      coordinates.length !== 2 ||
      coordinates.some((coordinate) => Number.isNaN(Number(coordinate)))
    ) {
      return res.status(400).json({ message: "Please update your current location first" });
    }

    const [longitude, latitude] = coordinates.map(Number);

    const hospitals = await Hospital.aggregate([
      {
        $geoNear: {
          near: {
            type: "Point",
            coordinates: [longitude, latitude],
          },
          distanceField: "distanceInMeters",
          spherical: true,
          maxDistance: 50000,
          query: { accountStatus: "approved" },
        },
      },
      {
        $project: {
          name: 1,
          hospitalType: 1,
          location: {
            type: "$location.type",
            coordinates: "$location.coordinates"
          },
          fullAddress: "$address.fullAddress",
          phoneNumber: "$contactPerson.phoneNumber",
        },
      },
      { $limit: 30 },
    ]);

    const hospitalsWithRouteDistance = await Promise.all(
      hospitals.map(async (hospital) => {
        const [hospitalLongitude, hospitalLatitude] = hospital.location?.coordinates || [];
        const toLatitude = Number(hospitalLatitude);
        const toLongitude = Number(hospitalLongitude);

        if (!Number.isFinite(toLatitude) || !Number.isFinite(toLongitude)) {
          return {
            ...hospital,
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
            ...hospital,
            routeDistanceInMeters,
          };

        } catch (routeError) {
          console.error("Hospital route distance error:", routeError.message);
          return {
            ...hospital,
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
      hospitals: hospitalsWithRouteDistance,
    });
  } catch (error) {
    console.error("Nearby hospitals error:", error);
    return res.status(500).json({ message: "Unable to load nearby hospitals" });
  }
};
