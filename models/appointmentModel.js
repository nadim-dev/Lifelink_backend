import { Schema, model } from "mongoose";

const appointmentSchema = new Schema(
  {
    patientId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    doctorId: {
      type: Schema.Types.ObjectId,
      ref: "Doctor",
      required: true,
      index: true,
    },

    hospitalId: {
      type: Schema.Types.ObjectId,
      ref: "Hospital",
      required: true,
      index: true,
    },

    // The day on which the appointment is booked
    appointmentDate: {
      type: Date,
      required: true,
      index: true,
    },

    // Patient's position in today's queue
    tokenNumber: {
      type: Number,
      required: true,
    },

    // Actual time assigned by backend
    appointmentStart: {
      type: Date,
      required: true,
    },

    status: {
      type: String,
      enum: [
        "requested",
        "confirmed",
        "completed",
        "cancelled",
        "rejected",
      ],
      default: "requested",
    },
  },
  {
    timestamps: true,
  }
);

// Prevent two appointments from getting
// the same time for the same doctor
appointmentSchema.index(
  {
    doctorId: 1,
    appointmentStart: 1,
  },
  {
    unique: true,
  }
);

// Prevent duplicate token numbers for the same doctor/day
appointmentSchema.index(
  {
    doctorId: 1,
    appointmentDate: 1,
    tokenNumber: 1,
  },
  {
    unique: true,
  }
)
export const Appointment = model("Appointment", appointmentSchema);