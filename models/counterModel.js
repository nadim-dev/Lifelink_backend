import { Schema, model } from "mongoose";

const counterSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    value: {
      type: Number,
      required: true,
      default: 0,
    },
  },
  {
    timestamps: true,
  },
);

const Counter = model("Counter", counterSchema);
export default Counter;
