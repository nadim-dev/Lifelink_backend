import express from "express";
import { createDonor, updateUserLocation } from "../controllers/donorController.js";
import checkAuth from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/location", checkAuth, updateUserLocation);
router.post("/", checkAuth, createDonor);

export default router;
