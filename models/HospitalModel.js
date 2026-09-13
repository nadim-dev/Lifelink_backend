import { Schema, model } from "mongoose";

const hospitalSchema = new Schema(
  {
    // Account Details
    userId: { 
      type: Schema.Types.ObjectId, 
      ref: "User", required: true, 
      unique: true, 
      index: true 
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    password: {
      type: String,
      required: true,
    },

    // Hospital Information
    name: {
      type: String,
      required: true,
      trim: true,
    },

    hospitalType: {
      type: String,
      enum: [
        "government",
        "private",
        "trust",
        "multispecialty",
        "specialty",
        "other",
      ],
      required: true,
    },

    registrationNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    phoneNumber: {
      type: String,
      required: true,
      trim: true,
    },

    workingHours: {
      openingTime: { type: String, default: "10:00" },
      closingTime: { type: String, default: "22:00" },
      isOpen24Hours: { type: Boolean, default: false },
    },

    // Hospital Address
    address: {
      fullAddress: {
        type: String,
        required: true,
        trim: true,
      },

      city: {
        type: String,
        required: true,
        trim: true,
      },

      state: {
        type: String,
        required: true,
        trim: true,
      },

      district:{
        type:String,
        trim:true
      }
    },

    // Exact Hospital Location
    location: {
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

    // Authorized Contact Person
    contactPerson: {
      name: {
        type: String,
        required: true,
        trim: true,
      },

      phoneNumber: {
        type: String,
        required: true,
        trim: true,
      },

      email: {
        type: String,
        required: true,
        lowercase: true,
        trim: true,
      },
    },

    // Verification Document
    registrationDocumentUrl: {
      type: String,
      required: true,
    },

    verificationStatus: {
      type: String,
      enum: ["pending", "verified", "rejected"],
      default: "pending",
    },

    capacity: {
       beds: {
         general: {
           total: Number,
           occupied: Number
         },
     
         private: {
           total: Number,
           occupied: Number
         },
     
         icu: {
           total: Number,
           occupied: Number
         }
       },
     
       emergencyStatus: {
         type: String,
         enum: ["available", "limited", "unavailable"],
         default: "available"
       }
    },

    // Account Status
    accountStatus: {
      type: String,
      enum: ["pending", "approved", "rejected", "suspended"],
      default: "pending",
    },
  },
  {
    timestamps: true,
  }
);

// For finding hospitals near a user/blood bank
hospitalSchema.index({
  location: "2dsphere",
});
hospitalSchema.index({ accountStatus: 1 });

const Hospital = model("Hospital", hospitalSchema);

export default Hospital;
