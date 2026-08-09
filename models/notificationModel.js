import { Schema, model } from "mongoose";

const notificationSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },

    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 300,
    },

    type: {
      type: String,
      enum: [
        "System",
        "Blood Request",
        "Support Ticket",
        "Donation",
        "Hospital",
        "Medicine",
        "Enquiry",
        "Blood Bank"
      ],
      default: "System",
    },

    actionUrl: {
      type: String,
      default: null,
    },

    isRead: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

const Notification= model("Notification", notificationSchema);

export default Notification;
