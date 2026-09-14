import express from "express";
import checkAuth from "../middleware/authMiddleware.js";
import { BookAppointment, GetHospitalAppointments, GetMyAppointmentHistory, GetMyAppointments, UpdateHospitalAppointmentStatus } from "../controllers/appointmentController.js";
import { allowRoles } from "../middleware/authMiddleware.js";


const router = express.Router();

router.post("/book-appointment",checkAuth,BookAppointment);
router.get("/my-appointments", checkAuth, GetMyAppointments);
router.get("/my-appointment-history", checkAuth, GetMyAppointmentHistory);
router.get("/hospital-appointments", checkAuth, allowRoles("Hospital"), GetHospitalAppointments);
router.patch("/hospital-appointments/:appointmentId/status", checkAuth, allowRoles("Hospital"), UpdateHospitalAppointmentStatus);

export default router;
