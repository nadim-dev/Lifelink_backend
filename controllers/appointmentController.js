import Doctor from "../models/doctorModel.js";
import { Appointment } from "../models/appointmentModel.js";
import Hospital from "../models/HospitalModel.js";


// Convert "10:30" → 630 minutes
const timeToMinutes = (time) => {
  const [hours, minutes] = time.split(":").map(Number);

  return hours * 60 + minutes;
};


// Convert minutes → "10:30"
const minutesToTime = (minutes) => {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;

  return `${hours.toString().padStart(2, "0")}:${mins
    .toString()
    .padStart(2, "0")}`;
};


export const BookAppointment = async (req, res) => {
  console.log("Book Appointment Controller is running");

  try {
    const { doctorId } = req.body;
    //* finding doctor

    const doctor = await Doctor.findById(doctorId).lean();

    if (!doctor) {
      return res.status(404).json({
        message: "Doctor not found",
      });
    }


    const today = new Date();

    const currentDay = today.toLocaleDateString("en-US", {
      weekday: "long",
    });


    //* checking whether doctor is available today or not

    const todayAvailability = doctor.availability.find(
      (item) =>
        item.day.toLowerCase() === currentDay.toLowerCase()
    );


    if (!todayAvailability || !todayAvailability.isAvailable) {
      return res.status(409).json({
        message: "Doctor is not available today",
      });
    }


    //* Current time in minutes


    const currentMinutes =
      today.getHours() * 60 + today.getMinutes();


    const appointmentDuration =
      doctor.appointmentDuration;



    //* Find a shift which can still accept appointments


    let selectedShift = null;
    let startingMinutes = null;


    for (const shift of todayAvailability.shifts) {

      const shiftStart = timeToMinutes(
        shift.startTime
      );

      const shiftEnd = timeToMinutes(
        shift.endTime
      );

      //* Shift hasn't started yet
    

      if (currentMinutes < shiftStart) {
        selectedShift = shift;
        startingMinutes = shiftStart;
        break;
      }

      //* Currently inside this shift

      if (
        currentMinutes >= shiftStart &&
        currentMinutes < shiftEnd
      ) {


        const elapsed =
          currentMinutes - shiftStart;

        const slotsPassed =
          Math.ceil(elapsed / appointmentDuration);

        startingMinutes =
          shiftStart +
          slotsPassed * appointmentDuration;


        selectedShift = shift;

        break;
      }

      // If currentMinutes >= shiftEnd,
      // this shift has already ended.
    }


    //* No remaining shift today


    if (!selectedShift) {
      return res.status(409).json({
        message: "No appointment slots are available today",
      });
    }


    // --------------------------------
    // 7. Get today's date boundaries
    // --------------------------------

    const startOfDay = new Date(today);

    startOfDay.setHours(
      0,
      0,
      0,
      0
    );


    const endOfDay = new Date(today);

    endOfDay.setHours(
      23,
      59,
      59,
      999
    );


    // --------------------------------
    // 8. Get today's booked appointments
    // --------------------------------

    const bookedAppointments =
      await Appointment.find({
        doctorId: doctor._id,

        appointmentStart: {
          $gte: startOfDay,
          $lte: endOfDay,
        },

        status: {
          $nin: [
            "cancelled",
            "rejected",
          ],
        },
      })
      .select("appointmentStart")
      .lean();


    // --------------------------------
    // 9. Store booked times in Set
    // --------------------------------

    const bookedTimes = new Set(
      bookedAppointments.map(
        (appointment) =>
          appointment.appointmentStart.getTime()
      )
    );


    // --------------------------------
    // 10. Find first available slot
    // --------------------------------

    const shiftEnd =
      timeToMinutes(
        selectedShift.endTime
      );


    let appointmentMinutes =
      startingMinutes;

    let availableSlot = null;


    while (appointmentMinutes < shiftEnd) {

      const appointmentTime =
        new Date(today);

      appointmentTime.setHours(
        Math.floor(appointmentMinutes / 60),
        appointmentMinutes % 60,
        0,
        0
      );


      // Check if this slot is already booked

      if (
        !bookedTimes.has(
          appointmentTime.getTime()
        )
      ) {

        availableSlot =
          appointmentTime;

        break;
      }


      // Move to next appointment

      appointmentMinutes +=
        appointmentDuration;
    }


    // --------------------------------
    // 11. No available slot
    // --------------------------------

    if (!availableSlot) {
      return res.status(409).json({
        message:
          "No appointment slots are available today",
      });
    }


    // --------------------------------
    // 12. Generate token number
    // --------------------------------

    const todayAppointments =
      await Appointment.countDocuments({
        doctorId: doctor._id,

        appointmentStart: {
          $gte: startOfDay,
          $lte: endOfDay,
        },

        status: {
          $nin: [
            "cancelled",
            "rejected",
          ],
        },
      });


    const tokenNumber =
      todayAppointments + 1;


    // --------------------------------
    // 13. Create appointment
    // --------------------------------

    const appointment =
      await Appointment.create({

        patientId: req.user._id,

        doctorId: doctor._id,

        hospitalId: doctor.hospitalId,

        appointmentDate: startOfDay,

        tokenNumber,

        appointmentStart:
          availableSlot,

        status: "confirmed",
      });


    // 14. Return response


    return res.status(201).json({

      message:
        "Appointment booked successfully",

      appointment,

      tokenNumber,

      appointmentTime:
        availableSlot.toLocaleTimeString(
          "en-US",
          {
            hour: "numeric",
            minute: "2-digit",
            hour12: true,
          }
        ),
    });


  } catch (error) {

    console.error(
      "Book appointment error:",
      error
    );

    // A concurrent booking may win the unique appointment/time or token index.
    if (error?.code === 11000) {
      return res.status(409).json({
        message:
          "This appointment slot was just booked. Please try again.",
      });
    }

    return res.status(500).json({
      message:
        "Unable to book appointment",
    });
  }
};

export const GetMyAppointments = async (req, res) => {
  try {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const appointments = await Appointment.find({
      patientId: req.user._id,
      status: { $nin: ["cancelled", "rejected", "completed"] },
      appointmentStart: { $gte: oneHourAgo },
    })
      .populate("doctorId", "name specialization department profileImage")
      .populate("hospitalId", "name address")
      .sort({ appointmentStart: 1 })
      .lean();

    return res.status(200).json({ appointments });
  } catch (error) {
    console.error("Get my appointments error:", error);
    return res.status(500).json({ message: "Unable to load appointments" });
  }
};

export const GetMyAppointmentHistory = async (req, res) => {
  try {
    const appointments = await Appointment.find({ patientId: req.user._id })
      .populate("doctorId", "name specialization department")
      .populate("hospitalId", "name address")
      .sort({ appointmentStart: -1 })
      .lean();
    return res.status(200).json({ appointments });
  } catch (error) {
    console.error("Get appointment history error:", error);
    return res.status(500).json({ message: "Unable to load appointment history" });
  }
};

export const GetHospitalAppointments = async (req, res) => {
  try {
    const hospital = await Hospital.findOne({ userId: req.user._id }).select("_id").lean();
    if (!hospital) {
      return res.status(404).json({ message: "Hospital profile not found" });
    }

    const doctors = await Doctor.find({ hospitalId: hospital._id }).select("_id").lean();
    const doctorIds = doctors.map((doctor) => doctor._id);
    const now = new Date();
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);
    const startOfTomorrow = new Date(startOfToday);
    startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);
    const range = ["today", "last7", "month"].includes(req.query.range) ? req.query.range : "today";
    const listStart = new Date(startOfToday);
    const listEnd = new Date(startOfTomorrow);
    if (range === "last7") listStart.setDate(listStart.getDate() - 6);
    if (range === "month") listStart.setDate(1);

    const hospitalFilter = { doctorId: { $in: doctorIds } };
    const [appointments, todays, upcoming, completed, cancelled] = await Promise.all([
      Appointment.find({
        ...hospitalFilter,
        appointmentStart: { $gte: listStart, $lt: listEnd },
      })
        .populate("patientId", "name fullName")
        .populate("doctorId", "name")
        .sort({ appointmentStart: 1 })
        .lean(),
      Appointment.countDocuments({
        ...hospitalFilter,
        appointmentStart: { $gte: startOfToday, $lt: startOfTomorrow },
      }),
      Appointment.countDocuments({
        ...hospitalFilter,
        appointmentStart: { $gte: startOfTomorrow },
        status: { $nin: ["cancelled", "rejected", "completed"] },
      }),
      Appointment.countDocuments({ ...hospitalFilter, status: "completed" }),
      Appointment.countDocuments({ ...hospitalFilter, status: "cancelled" }),
    ]);

    return res.status(200).json({
      summary: { today: todays, upcoming, completed, cancelled },
      appointments,
    });
  } catch (error) {
    console.error("Get hospital appointments error:", error);
    return res.status(500).json({ message: "Unable to load hospital appointments" });
  }
};

export const UpdateHospitalAppointmentStatus = async (req, res) => {
  try {
    const { status } = req.body;
    if (!["completed", "cancelled"].includes(status)) {
      return res.status(400).json({ message: "Invalid appointment status" });
    }

    const hospital = await Hospital.findOne({ userId: req.user._id }).select("_id").lean();
    if (!hospital) return res.status(404).json({ message: "Hospital profile not found" });

    const doctors = await Doctor.find({ hospitalId: hospital._id }).select("_id").lean();
    const appointment = await Appointment.findOneAndUpdate(
      { _id: req.params.appointmentId, doctorId: { $in: doctors.map((doctor) => doctor._id) } },
      { status },
      { new: true },
    ).lean();

    if (!appointment) return res.status(404).json({ message: "Appointment not found" });
    return res.status(200).json({ message: "Appointment status updated", appointment });
  } catch (error) {
    console.error("Update hospital appointment status error:", error);
    return res.status(500).json({ message: "Unable to update appointment status" });
  }
};
