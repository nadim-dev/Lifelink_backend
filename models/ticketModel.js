import { Schema, model } from "mongoose";


const messageSchema = new Schema(
  {
    sender: {
      type: String,
      enum: ["user", "Admin"],
      required: true,
    },
    senderId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    message: {
      type: String,
      default: "",
      trim: true,
    },
    attachment: {
      type: String,
      default: null,
    },
    attachmentName: {
      type: String,
      trim: true,
      default: null,
    },
  },
  {
    timestamps: true,
    _id: true,
  }
);

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

    screenshot: {
      type: String,
      default: null,
    },

    screenshotName: {
      type: String,
      trim: true,
      default: null,
    },

    statusHistory: [
    {
     status: {
      type: String,
      enum: ["Open", "In Progress", "Resolved", "Closed"],
      required: true,
    },
    changedAt: {
      type: Date,
      default: Date.now,
    },
   },
  ],
 
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

    messages: [messageSchema],

    lastMessageBy: {
     type: String,
     enum: ["user", "Admin"],
     default: "Admin",
    },

    lastRepliedAt: {
     type: Date,
     default: Date.now,
    }

  },
  {
    timestamps: true,
  }
);

const SupportTicket = model("SupportTicket", supportTicketSchema);
export default SupportTicket;
