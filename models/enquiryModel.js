import { Schema, model } from "mongoose";

const enquirySchema = Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    subject: {
      type: String,
      required: true,
      trim: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
    },
    isReplied: {
    type: Boolean,
    default: false,
    },
    repliedAt: {
    type: Date,
    default: null,
  },
  },
  {
    timestamps: true,
  },
);

const Enquiry = model("Enquiry", enquirySchema);
export default Enquiry;
