import express from "express";
import { getAdminDashboardStats, getPendingRegistrations, getPlatformGrowth } from "../controllers/adminController.js";
import checkAuth, { allowRoles } from "../middleware/authMiddleware.js";

const router = express.Router();
router.get("/dashboard/stats", checkAuth, allowRoles("Admin"), getAdminDashboardStats);
router.get("/pending-registrations", checkAuth, allowRoles("Admin"), getPendingRegistrations);
router.get("/platform-growth", checkAuth, allowRoles("Admin"), getPlatformGrowth);

export default router;
