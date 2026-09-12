import mongoose from "mongoose";

const serviceFacilitySchema = new mongoose.Schema(
  {
    hospitalId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Hospital",
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    type: { type: String, enum: ["Service", "Facility"], required: true },
    description: { type: String, required: true, trim: true },
    imageUrl: { type: String, default: null },
    status: { type: String, enum: ["active", "inactive"], default: "active" },
  },
  { timestamps: true },
);

export default mongoose.model("ServiceFacility", serviceFacilitySchema);