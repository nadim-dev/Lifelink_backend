import { Schema, model } from "mongoose";

const deliveryPartnerSchema = new Schema(
  {
    // Account Details
    fullName: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    phoneNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    password: {
      type: String,
      required: true,
    },

    // Identity Verification
    aadhaarNumber: {
      type: String,
      required: true,
    },

    aadhaarDocumentUrl: {
      type: String,
      required: true,
    },

    identityVerificationStatus: {
      type: String,
      enum: ["pending", "verified", "rejected"],
      default: "pending",
    },

    // Vehicle Information
    vehicleType: {
      type: String,
      enum: ["bike", "scooter"],
      required: true,
    },

    vehicleNumber: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
    },

    // Driving License
    drivingLicenseNumber: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },

    drivingLicenseDocumentUrl: {
      type: String,
      required: true,
    },

    // Current Location
    currentLocation: {
      type: {
        type: String,
        enum: ["Point"],
        default: "Point",
      },

      coordinates: {
        type: [Number],
        required: true,
      },
    },

    locationUpdatedAt: {
      type: Date,
      default: null,
    },

    // Account Status
    accountStatus: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },

    // Delivery Availability
    availabilityStatus: {
      type: String,
      enum: ["offline", "available", "busy"],
      default: "offline",
    },
  },
  {
    timestamps: true,
  }
);

// Used to find nearby delivery partners
deliveryPartnerSchema.index({
  currentLocation: "2dsphere",
});

const DeliveryPartner = model(
  "DeliveryPartner",
  deliveryPartnerSchema
);

export default DeliveryPartner;
