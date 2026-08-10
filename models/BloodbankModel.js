import { Schema, model } from "mongoose";

const bloodBankSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },

    bloodBankName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 150,
    },

    licenseNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
    },

    contactPersonName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },

    phoneNumber: {
      type: String,
      required: true,
      trim: true,
    },

    address: {
      completeAddress: {
        type: String,
        required: true,
        trim: true,
      },

      city: {
        type: String,
        trim: true,
      },

      district: {
        type: String,
        trim: true,
      },

      state: {
        type: String,
        trim: true,
      },
    },

    location: {
      type: {
        type: String,
        enum: ["Point"],
        default: "Point",
        required: true,
      },

      coordinates: {
        type: [Number],
        required: true,
      },
    },

    workingHours: {
      openingTime: {
        type: String,
      },

      closingTime: {
        type: String,
      },

      isOpen24Hours: {
        type: Boolean,
        default: false,
      },
    },

    licenseDocument: {
      url: {
        type: String,
      },

      isVerified: {
        type: Boolean,
        default: false,
      },
    },

    review: {
      approvedAt: Date,
      approvedBy: {
        type: Schema.Types.ObjectId,
        ref: "User",
      },
      rejectedAt: Date,
      rejectedBy: {
        type: Schema.Types.ObjectId,
        ref: "User",
      },
      rejectionReason: {
        type: String,
        trim: true,
      },
      suspendedAt: Date,
      suspendedBy: {
        type: Schema.Types.ObjectId,
        ref: "User",
      },
      suspensionReason: {
        type: String,
        trim: true,
      },
      previousStatus: {
        type: String,
        enum: ["Pending", "Approved", "Rejected", "Suspended"],
      },
      reactivatedAt: Date,
      reactivatedBy: {
        type: Schema.Types.ObjectId,
        ref: "User",
      },
    },

    status: {
      type: String,
      enum: ["Pending", "Approved", "Rejected", "Suspended"],
      default: "Pending",
      index: true,
    },
    activityHistory: [
      {
        action: {
          type: String,
          required: true,
          trim: true,
        },
        status: {
          type: String,
          enum: ["Pending", "Approved", "Rejected", "Suspended"],
        },
        note: {
          type: String,
          trim: true,
        },
        performedBy: {
          type: Schema.Types.ObjectId,
          ref: "User",
        },
        performedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    inventory: [
      {
        bloodGroup: {
          type: String,
          enum: ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"],
          required: true,
        },

        type: {
          type: String,
          enum: ["PRBC", "Platelets", "Plasma"],
          required: true,
        },

        processingFee: {
          type: Number,
          required: true,
          min: 0,
        },

        unitsAvailable: {
          type: Number,
          required: true,
          default: 0,
          min: 0,
        },
      },
    ],
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

bloodBankSchema.index({
  location: "2dsphere",
});

const BloodBank = model("BloodBank", bloodBankSchema);

export default BloodBank;
