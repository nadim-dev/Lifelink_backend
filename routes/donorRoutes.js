import express from "express";
import { createDonor, getAllUsersStats, getCurrentUserDonor, updateCurrentUserDonor, updateUserLocation } from "../controllers/donorController.js";
import checkAuth, { allowRoles } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/location", checkAuth, updateUserLocation);
router.get("/users/stat", checkAuth, allowRoles("Admin"), getAllUsersStats);
router.get("/me", checkAuth, getCurrentUserDonor);
router.patch("/me", checkAuth, updateCurrentUserDonor);
router.post("/", checkAuth, createDonor);

export default router;
