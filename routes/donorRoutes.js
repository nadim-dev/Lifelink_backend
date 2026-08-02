import express from "express";
import { createDonor, getCurrentUserDonor, updateCurrentUserDonor, updateUserLocation } from "../controllers/donorController.js";
import checkAuth from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/location", checkAuth, updateUserLocation);
router.get("/me", checkAuth, getCurrentUserDonor);
router.patch("/me", checkAuth, updateCurrentUserDonor);
router.post("/", checkAuth, createDonor);

export default router;
