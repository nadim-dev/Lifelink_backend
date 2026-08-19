import { Schema,model } from "mongoose";

const deliveryRequestSchema = new Schema(
  {
    bloodRequestId: {
      type: Schema.Types.ObjectId,
      ref: "BloodRequest",
      required: true,
      index: true,
    },

    deliveryPartnerId: {
      type: Schema.Types.ObjectId,
      ref: "DeliveryPartner",
      required: true,
      index: true,
    },

    requestStatus: {
      type: String,
      enum: ["Pending", "Accepted", "Declined", "Expired"],
      default: "Pending",
    },

    distanceToPickup: {
      type: Number,
      default: null,
    },

    distanceToDelivery: {
      type: Number,
      default: null,
    },

    sentAt: {
      type: Date,
      default: Date.now,
    },

    respondedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);


export const DeliveryRequest=model("DeliveryRequest",deliveryRequestSchema);