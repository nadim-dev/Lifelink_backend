import Hospital from "../models/HospitalModel.js";
import Doctor from "../models/doctorModel.js";
import ServiceFacility from "../models/serviceFacilityModel.js";
import Notification from "../models/notificationModel.js";
import User from "../models/userModel.js";
import { sanitize } from "../utils/sanitize.js";
import { uploadBufferToCloudinary } from "../utils/uploadToCloudinary.js";
import { getRouteDistanceInMeters } from "../utils/geoapifyDistance.js";

const hospitalSelect = "-password";

export const getMyHospitalProfile = async (req, res) => {
  try {
    const hospital = await Hospital.findOne({
      $or: [
        { userId: req.user._id },
        { userId: { $exists: false }, email: req.user.email },
      ],
    })
      .select(hospitalSelect)
      .lean();
    if (!hospital)
      return res.status(404).json({ message: "Hospital profile not found" });
    hospital.contactPerson = {
      ...(hospital.contactPerson || {}),
      name: hospital.contactPerson?.name || req.user.username || "",
      phoneNumber:
        hospital.contactPerson?.phoneNumber ||
        hospital.phoneNumber ||
        req.user.phoneNumber ||
        "",
    };
    return res.status(200).json({ hospital });
  } catch {
    return res.status(500).json({ message: "Unable to load hospital profile" });
  }
};

export const updateMyHospitalProfile = async (req, res) => {
  try {
    const {
      openingTime,
      closingTime,
      isOpen24Hours,
      contactPersonName,
      phoneNumber,
    } = sanitize(req.body);
    const alwaysOpen = isOpen24Hours === true || isOpen24Hours === "true";
    if (!contactPersonName || !phoneNumber)
      return res
        .status(400)
        .json({ message: "Contact person and phone number are required" });
    if (!alwaysOpen && (!openingTime || !closingTime))
      return res
        .status(400)
        .json({ message: "Opening and closing time are required" });
    const hospital = await Hospital.findOneAndUpdate(
      {
        $or: [
          { userId: req.user._id },
          { userId: { $exists: false }, email: req.user.email },
        ],
      },
      {
        $set: {
          userId: req.user._id,
          phoneNumber,
          "contactPerson.name": contactPersonName,
          "contactPerson.phoneNumber": phoneNumber,
          workingHours: {
            openingTime: alwaysOpen ? "" : openingTime,
            closingTime: alwaysOpen ? "" : closingTime,
            isOpen24Hours: alwaysOpen,
          },
        },
      },
      { returnDocument: "after", runValidators: true },
    )
      .select(hospitalSelect)
      .lean();
    if (!hospital)
      return res.status(404).json({ message: "Hospital profile not found" });
    return res.json({
      hospital,
      message: "Hospital profile updated successfully",
    });
  } catch {
    return res
      .status(500)
      .json({ message: "Unable to update hospital profile" });
  }
};

export const updateMyEmergencyStatus = async (req, res) => {
  try {
    const cleanBody = sanitize(req.body || {});
    const emergencyStatus = String(cleanBody.emergencyStatus || "").trim().toLowerCase();
    if (!["available", "limited", "unavailable"].includes(emergencyStatus))
      return res.status(400).json({ message: "Invalid emergency status" });
    const hospital = await Hospital.findOneAndUpdate(
      { userId: req.user._id },
      { $set: { "capacity.emergencyStatus": emergencyStatus } },
      { returnDocument: "after", runValidators: true },
    )
      .select(hospitalSelect)
      .lean();
    if (!hospital)
      return res.status(404).json({ message: "Hospital profile not found" });

    return res.json({
      hospital,
      message: "Emergency status updated successfully",
    });
  } catch (error) {
    console.error("Emergency status update error:", error);
    return res
      .status(500)
      .json({ message: "Unable to update emergency status" });
  }
};

export const updateMyCapacityBed = async (req, res) => {
  try {
    const cleanBody = sanitize(req.body || {});
    const category = String(cleanBody.category || "").trim().toLowerCase();
    const total = Number(cleanBody.total);
    const occupied = Number(cleanBody.occupied);
 

    const hospital = await Hospital.findOneAndUpdate(
      { userId: req.user._id },
      {
        $set: {
          [`capacity.beds.${category}.total`]: total,
          [`capacity.beds.${category}.occupied`]: occupied,
        },
      },
      { returnDocument: "after", runValidators: true },
    )
      .select(hospitalSelect)
      .lean();
    if (!hospital)
      return res.status(404).json({ message: "Hospital profile not found" });
    return res.json({ hospital, message: "Bed capacity updated successfully" });
  } catch (error) {
    console.error("Bed capacity update error:", error);
    return res.status(500).json({ message: "Unable to update bed capacity" });
  }
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
      .select(
        "name hospitalType phoneNumber address location contactPerson accountStatus verificationStatus",
      )
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
    const userAccountStatus =
      accountStatus === "approved" ? "active" : accountStatus;
    const hospital = await Hospital.findByIdAndUpdate(
      req.params.hospitalId,
      {
        accountStatus,
        verificationStatus:
          accountStatus === "approved"
            ? "verified"
            : accountStatus === "rejected"
              ? "rejected"
              : "pending",
      },
      { returnDocument: "after", runValidators: true },
    ).select(hospitalSelect);

    if (!hospital) {
      return res.status(404).json({ message: "Hospital not found" });
    }

    await User.findOneAndUpdate(
      { email: hospital.email },
      { accountStatus: userAccountStatus },
      { runValidators: true },
    );

    return res
      .status(200)
      .json({ message: "Hospital status updated successfully", hospital });
  } catch (error) {
    console.error("Hospital status update error:", error);
    return res
      .status(500)
      .json({ message: "Unable to update hospital status" });
  }
};

export const registerHospital = async (req, res) => {
  let createdUser = null;

  try {
    const {
      email,
      password,
      confirmPassword,
      name,
      hospitalType,
      registrationNumber,
      phoneNumber,
      address,
      city,
      district,
      state,
      location,
      contactName,
      contactPhoneNumber,
      contactEmail,
    } = sanitize(req.body);

    if (
      !email ||
      !password ||
      !confirmPassword ||
      !name ||
      !hospitalType ||
      !registrationNumber ||
      !phoneNumber ||
      !address ||
      !city ||
      !state ||
      !location ||
      !contactName ||
      !contactPhoneNumber ||
      !contactEmail
    )
      return res
        .status(400)
        .json({ message: "All required fields must be provided" });

    if (password !== confirmPassword)
      return res
        .status(400)
        .json({ message: "Password and confirm password must match" });

    if (!req.file)
      return res
        .status(400)
        .json({ message: "Registration certificate is required" });

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
      return res
        .status(400)
        .json({ message: "Exact hospital location is required" });
    }

    const existingUser = await User.findOne({ email }).lean();

    if (existingUser) {
      return res.status(409).json({ message: "Email is already registered" });
    }

    const existingHospital = await Hospital.findOne({
      registrationNumber,
    }).lean();

    if (existingHospital) {
      return res
        .status(409)
        .json({ message: "Registration number is already registered" });
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
      userId: createdUser._id,
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
        return res
          .status(409)
          .json({ message: "Registration number is already registered" });
      }
    }

    return res.status(500).json({ message: "Unable to register hospital" });
  }
};

export const createDoctor = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("email").lean();
    const hospital = user
      ? await Hospital.findOne({ email: user.email }).select("_id")
      : null;
    if (!hospital)
      return res.status(404).json({ message: "Hospital profile not found" });

    const {
      name,
      email,
      phoneNumber,
      gender,
      dateOfBirth,
      department,
      specialization,
      experience,
      registrationNumber,
      consultationFee,
      appointmentDuration,
      status,
    } = req.body;
    let { qualifications } = req.body;
    try {
      qualifications = qualifications ? JSON.parse(qualifications) : [];
    } catch {
      qualifications = String(qualifications || "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
    }
    if (
      Array.isArray(qualifications) &&
      qualifications.length === 1 &&
      typeof qualifications[0] === "string" &&
      qualifications[0].trim().startsWith("[")
    ) {
      try {
        const nestedQualifications = JSON.parse(qualifications[0]);
        if (Array.isArray(nestedQualifications))
          qualifications = nestedQualifications;
      } catch {
        // Keep the original value when it is not valid nested JSON.
      }
    }
    let availability = req.body.availability;
    try {
      availability = availability ? JSON.parse(availability) : [];
    } catch {
      availability = [];
    }
    const uploadResult = req.file
      ? await uploadBufferToCloudinary(req.file.buffer, {
          folder: "mediverse/doctor-profile-pictures",
          resource_type: "image",
        })
      : null;
    const doctor = await Doctor.create({
      hospitalId: hospital._id,
      name,
      profileImage: uploadResult?.secure_url || null,
      email,
      phoneNumber,
      gender,
      dateOfBirth: dateOfBirth || undefined,
      department,
      specialization,
      qualifications: Array.isArray(qualifications) ? qualifications : [],
      experience: Number(experience),
      registrationNumber,
      consultationFee: Number(consultationFee || 0),
      appointmentDuration: Number(appointmentDuration || 30),
      availability: Array.isArray(availability) ? availability : [],
      status: status || "active",
    });
    return res
      .status(201)
      .json({ message: "Doctor added successfully", doctor });
  } catch (error) {
    console.error("Create doctor error:", error);
    return res
      .status(400)
      .json({ message: error.message || "Unable to add doctor" });
  }
};

export const getHospitalDoctors = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("email").lean();
    const hospital = user
      ? await Hospital.findOne({ email: user.email }).select("_id").lean()
      : null;
    if (!hospital)
      return res.status(404).json({ message: "Hospital profile not found" });

    const doctors = await Doctor.find({ hospitalId: hospital._id })
      .sort({ createdAt: -1 })
      .lean();
    return res.status(200).json({ doctors });
  } catch (error) {
    console.error("Get hospital doctors error:", error);
    return res.status(500).json({ message: "Unable to load doctors" });
  }
};

export const updateDoctorStatus = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("email").lean();
    const hospital = user
      ? await Hospital.findOne({ email: user.email }).select("_id").lean()
      : null;
    if (!hospital)
      return res.status(404).json({ message: "Hospital profile not found" });

    const nextStatus = req.body.status === "active" ? "active" : "inactive";
    const doctor = await Doctor.findOneAndUpdate(
      { _id: req.params.doctorId, hospitalId: hospital._id },
      { status: nextStatus },
      { returnDocument: "after", runValidators: true },
    ).lean();

    if (!doctor) return res.status(404).json({ message: "Doctor not found" });
    return res.status(200).json({
      message: `Doctor ${nextStatus === "active" ? "activated" : "deactivated"} successfully`,
      doctor,
    });
  } catch (error) {
    console.error("Deactivate doctor error:", error);
    return res.status(500).json({ message: "Unable to deactivate doctor" });
  }
};

export const updateDoctorSchedule = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("email").lean();
    const hospital = user
      ? await Hospital.findOne({ email: user.email }).select("_id").lean()
      : null;
    const schedule = Array.isArray(req.body.availability)
      ? req.body.availability
      : JSON.parse(req.body.availability || "[]");
    const doctor = await Doctor.findOneAndUpdate(
      { _id: req.params.doctorId, hospitalId: hospital?._id },
      { availability: schedule },
      { returnDocument: "after", runValidators: true },
    ).lean();
    if (!doctor) return res.status(404).json({ message: "Doctor not found" });
    return res
      .status(200)
      .json({ message: "Doctor schedule updated successfully", doctor });
  } catch (error) {
    console.error("Update doctor schedule error:", error);
    return res
      .status(400)
      .json({ message: error.message || "Unable to update doctor schedule" });
  }
};

export const updateDoctor = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("email").lean();
    const hospital = user
      ? await Hospital.findOne({ email: user.email }).select("_id").lean()
      : null;
    if (!hospital)
      return res.status(404).json({ message: "Hospital profile not found" });
    let { qualifications, availability } = req.body;
    try {
      qualifications = JSON.parse(qualifications || "[]");
    } catch {
      qualifications = String(qualifications || "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
    }
    try {
      availability = JSON.parse(availability || "[]");
    } catch {
      availability = [];
    }
    const updates = {
      ...req.body,
      qualifications,
      availability,
      experience: Number(req.body.experience),
      consultationFee: Number(req.body.consultationFee || 0),
      appointmentDuration: Number(req.body.appointmentDuration || 30),
    };
    delete updates.profileImage;
    if (req.file) {
      const uploadResult = await uploadBufferToCloudinary(req.file.buffer, {
        folder: "mediverse/doctor-profile-pictures",
        resource_type: "image",
      });
      updates.profileImage = uploadResult.secure_url;
    }
    const doctor = await Doctor.findOneAndUpdate(
      { _id: req.params.doctorId, hospitalId: hospital._id },
      updates,
      { returnDocument: "after", runValidators: true },
    ).lean();
    if (!doctor) return res.status(404).json({ message: "Doctor not found" });
    return res
      .status(200)
      .json({ message: "Doctor updated successfully", doctor });
  } catch (error) {
    console.error("Update doctor error:", error);
    return res
      .status(400)
      .json({ message: error.message || "Unable to update doctor" });
  }
};

export const createServiceFacility = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("email").lean();
    const hospital = user
      ? await Hospital.findOne({ email: user.email }).select("_id").lean()
      : null;
    if (!hospital)
      return res.status(404).json({ message: "Hospital profile not found" });
    const { name, type, description, status } = req.body;
    if (!name || !type)
      return res
        .status(400)
        .json({ message: "Name, type and description are required" });
    const upload = req.file
      ? await uploadBufferToCloudinary(req.file.buffer, {
          folder: "mediverse/service-facilities",
          resource_type: "image",
        })
      : null;
    const item = await ServiceFacility.create({
      hospitalId: hospital._id,
      name,
      type,
      description,
      status: status === "inactive" ? "inactive" : "active",
      imageUrl: upload?.secure_url || null,
    });
    return res
      .status(201)
      .json({ message: "Service/facility added successfully", item });
  } catch (error) {
    console.error("Create service facility error:", error);
    return res
      .status(400)
      .json({ message: error.message || "Unable to add service/facility" });
  }
};

export const getHospitalServicesFacilities = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("email").lean();
    const hospital = user
      ? await Hospital.findOne({ email: user.email }).select("_id").lean()
      : null;
    if (!hospital)
      return res.status(404).json({ message: "Hospital profile not found" });
    const items = await ServiceFacility.find({ hospitalId: hospital._id })
      .sort({ createdAt: -1 })
      .lean();
    return res.status(200).json({ items });
  } catch (error) {
    console.error("Get services facilities error:", error);
    return res
      .status(500)
      .json({ message: "Unable to load services and facilities" });
  }
};

export const updateServiceFacility = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("email").lean();
    const hospital = user
      ? await Hospital.findOne({ email: user.email }).select("_id").lean()
      : null;
    const updates = {
      name: req.body.name,
      type: req.body.type,
      description: req.body.description,
      status: req.body.status === "inactive" ? "inactive" : "active",
    };
    if (req.file) {
      const upload = await uploadBufferToCloudinary(req.file.buffer, {
        folder: "mediverse/service-facilities",
        resource_type: "image",
      });
      updates.imageUrl = upload.secure_url;
    }
    const item = await ServiceFacility.findOneAndUpdate(
      { _id: req.params.itemId, hospitalId: hospital?._id },
      updates,
      { returnDocument: "after", runValidators: true },
    ).lean();
    if (!item)
      return res.status(404).json({ message: "Service or facility not found" });
    return res.json({ item });
  } catch (error) {
    return res
      .status(400)
      .json({ message: error.message || "Unable to update service/facility" });
  }
};

export const deleteServiceFacility = async (req, res) => {
  const user = await User.findById(req.user._id).select("email").lean();
  const hospital = user
    ? await Hospital.findOne({ email: user.email }).select("_id").lean()
    : null;
  const item = await ServiceFacility.findOneAndDelete({
    _id: req.params.itemId,
    hospitalId: hospital?._id,
  });
  if (!item)
    return res.status(404).json({ message: "Service or facility not found" });
  return res.json({ message: "Deleted successfully" });
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
      return res
        .status(400)
        .json({ message: "Please update your current location first" });
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
            coordinates: "$location.coordinates",
          },
          fullAddress: "$address.fullAddress",
          phoneNumber: "$contactPerson.phoneNumber",
        },
      },
      { $limit: 30 },
    ]);

    const hospitalsWithRouteDistance = await Promise.all(
      hospitals.map(async (hospital) => {
        const [hospitalLongitude, hospitalLatitude] =
          hospital.location?.coordinates || [];
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
      }),
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
