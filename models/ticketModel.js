import { Schema, model } from "mongoose";

const supportTicketSchema = new Schema(
  {
    ticketId: {
      type: String,
      unique: true,
      required: true,
    },

    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    category: {
      type: String,
      enum: [
        "Blood Services",
        "Medicine Services",
        "Ambulance Booking",
        "Hospital Services",
        "Account & Profile",
        "Login & Security",
        "AI Prediction",
        "Technical Issue",
        "Feature Request",
        "Other",
      ],
      required: true,
    },
    
    subject: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },

    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 3000,
    },

    priority: {
      type: String,
      enum: ["Low", "Medium", "High"],
      default: "Medium",
    },

    screenshot: {
      type: String,
      default: null,
    },

    status: {
      type: String,
      enum: [
        "Open",
        "In Progress",
        "Resolved",
        "Closed",
      ],
      default: "Open",
    },

    adminReply: {
      type: String,
      default: "",
    },

    resolvedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

const SupportTicket = model("SupportTicket", supportTicketSchema);
export default SupportTicket;
