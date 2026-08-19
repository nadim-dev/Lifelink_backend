import { Schema, model } from "mongoose";

const bloodRequestSchema = new Schema(
  {
    // Human-friendly request number
    requestNumber: {
      type: String,
      unique: true,
      index: true,
      immutable: true,
    },

    // User who created the request
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // Blood bank from which blood is requested
    bloodBankId: {
      type: Schema.Types.ObjectId,
      ref: "BloodBank",
      required: true,
      index: true,
    },

    // Blood groups and quantities requested
    items: [
      {
        component: {
          type: String,
          enum: ["PRBC", "Platelets", "Plasma"],
          default: "PRBC",
          required: true,
        },
        bloodGroup: {
          type: String,
          enum: [
            "A+",
            "A-",
            "B+",
            "B-",
            "AB+",
            "AB-",
            "O+",
            "O-",
          ],
          required: true,
        },

        quantity: {
          type: Number,
          required: true,
          min: 1,
        },
      },
    ],

  pickupVerification: {
      otpHash: {
        type: String,
        default: null,
      },
    
      expiresAt: {
        type: Date,
        default: null,
      },
    
      verifiedAt: {
        type: Date,
        default: null,
      },
  },
  
    // Person who will receive the blood
    patient: {
      name: {
        type: String,
        required: true,
        trim: true,
        maxlength: 100,
      },

      contactNumber: {
        type: String,
        required: true,
        trim: true,
      },

      alternateContactNumber: {
        type: String,
        trim: true,
      },
    },

    // Snapshot of user's address at the time of request
    deliveryAddress: {
      completeAddress: {
        type: String,
        required: true,
        trim: true,
      },

      city: {
        type: String,
        required: true,
        trim: true,
      },

      district: {
        type: String,
        trim: true,
      },

      state: {
        type: String,
        required: true,
        trim: true,
      },

      pincode: {
        type: String,
        trim: true,
      },

      location: {
        type: {
          type: String,
          enum: ["Point"],
          default: "Point",
        },

        coordinates: {
          type: [Number],
        },
      },
    },

    // Request lifecycle
    requestStatus: {
      type: String,
      enum: [
        "Pending",
        "Approved",
        "Rejected",
        "Cancelled",
        "Completed",
      ],
      default: "Pending",
      index: true,
    },

    rejectionReason: {
      type: String,
      trim: true,
      maxlength: 500,
    },

    // User-visible request tracking timeline
    statusHistory: [
      {
        status: {
          type: String,
          enum: [
            "Pending",
            "Approved",
            "Rejected",
            "Cancelled",
            "Completed",
          ],
          required: true,
        },
        changedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],

    // Delivery information
    deliveryPartnerId: {
      type: Schema.Types.ObjectId,
      ref: "DeliveryPartner",
      default: null,
      index: true,
    },

    deliveryStatus: {
      type: String,
      enum: [
        "NotAssigned",
        "Searching",
        "Assigned",
        "OnTheWayToPickup",
        "PickedUp",
        "OutForDelivery",
        "Delivered",
      ],
      default: "NotAssigned",
    },

    deliveryStatusHistory: [
  {
    status: {
      type: String,
      enum: [
         "NotAssigned",
         "Searching",
         "Assigned",
         "OnTheWayToPickup",
         "PickedUp",
         "OutForDelivery",
         "Delivered"
      ],
      required: true,
    },

    changedAt: {
      type: Date,
      default: Date.now,
    },
  },
     ],

    // Payment information
    payment: {
  method: {
    type: String,
    enum: ["PayOnDelivery"],
    default: "PayOnDelivery",
  },

  collectionMethod: {
    type: String,
    enum: ["Cash", "UPI"],
    default: null,
  },

  status: {
    type: String,
    enum: ["Pending", "Paid", "Failed"],
    default: "Pending",
  },

  amount: {
    type: Number,
    required: true,
    min: 0,
  },

  paidAt: {
    type: Date,
    default: null,
  },

  collectedBy: {
    type: Schema.Types.ObjectId,
    ref: "User",
    default: null,
  },
}
     },
  {
    timestamps: true,
    versionKey: false,
  }
);

bloodRequestSchema.index({
  "deliveryAddress.location": "2dsphere",
});

const BloodRequest = model("BloodRequest", bloodRequestSchema);

export default BloodRequest;
