import mongoose from "mongoose";

const shiftSchema = new mongoose.Schema(
  {
    startTime: {
      type: String,
      required: true,
    },

    endTime: {
      type: String,
      required: true,
    },
  },
  { _id: false }
);

const availabilitySchema = new mongoose.Schema(
  {
    day: {
      type: String,
      enum: [
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
        "Sunday",
      ],
      required: true,
    },

    isAvailable: {
      type: Boolean,
      default: false,
    },

    shifts: {
      type: [shiftSchema],
      default: [],
    },
  },
  { _id: false }
);

const doctorSchema = new mongoose.Schema(
  {
    // Hospital to which the doctor belongs
    hospitalId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Hospital",
      required: true,
      index: true,
    },

    // Basic Information
    name: {
      type: String,
      required: true,
      trim: true,
    },

    profileImage: {
      type: String,
      default: null,
    },

    email: {
      type: String,
      trim: true,
      lowercase: true,
    },

    phoneNumber: {
      type: String,
      required: true,
      trim: true,
    },

    gender: {
      type: String,
      enum: ["male", "female", "other"],
    },

    dateOfBirth: {
      type: Date,
    },

    // Professional Information
    department: {
      type: String,
      required: true,
      trim: true,
    },

    specialization: {
      type: String,
      required: true,
      trim: true,
    },

    qualifications: {
      type: [String],
      default: [],
    },

    experience: {
      type: Number,
      required: true,
      min: 0,
    },

    registrationNumber: {
      type: String,
      trim: true,
    },

    consultationFee: {
      type: Number,
      min: 0,
      default: 0,
    },

    // Duration of one appointment in minutes
    appointmentDuration: {
      type: Number,
      required: true,
      default: 30,
      min: 5,
    },

    // Weekly working schedule
    availability: {
      type: [availabilitySchema],
      default: [],
    },

    // Doctor's current status
    status: {
      type: String,
      enum: ["active", "inactive", "on_leave"],
      default: "active",
    },
  },
  {
    timestamps: true,
  }
);

const Doctor = mongoose.model("Doctor", doctorSchema);

export default Doctor;
