import { Schema, model } from "mongoose";

const donorSchema = Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    bloodGroup: {
      type: String,
      required: true,
      trim: true,
    },
    dateOfBirth: {
      type: Date,
      required: true,
    },
    gender: {
      type: String,
      required: true,
      enum: ["Male", "Female", "Other"],
    },
    weight: {
      type: Number,
      required: true,
      min: 1,
    },
    phoneNumber: {
      type: String,
      required: true,
      trim: true,
    },
    donatedBefore: {
      type: String,
      required: true,
      enum: ["never", "yes"],
    },
    lastDonationDate: {
      type: Date,
      default: null,
    },
    isHealthy: {
      type: String,
      required: true,
      enum: ["yes", "no"],
    },
    healthReason: {
      type: String,
      trim: true,
      default: "",
    },
    eligibilityConfirmed: {
      type: Boolean,
      required: true,
    },
    availability: {
      type: String,
      required: true,
      enum: ["anytime", "emergency", "unavailable"],
    },
    maxTravelDistance: {
      type: Number,
      required: true,
      enum: [5, 10, 20, 50],
    },
    notifyNearbyRequests: {
      type: Boolean,
      required: true,
    },
    notifyEmergencyRequests: {
      type: Boolean,
      required: true,
    },
  },
  {
    timestamps: true,
  },
);

const Donor = model("Donor", donorSchema);
export default Donor;
