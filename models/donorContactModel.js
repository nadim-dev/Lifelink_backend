import { Schema, model } from "mongoose";

const donorContactSchema = new Schema(
  {
    requesterId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    donorId: {
      type: Schema.Types.ObjectId,
      ref: "Donor",
      required: true,
      index: true,
    },
  },
  { timestamps: true },
);

export default model("DonorContact", donorContactSchema);
