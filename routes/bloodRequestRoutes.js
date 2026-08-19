import express from "express";
import checkAuth from "../middleware/authMiddleware.js";
import { confirmPickup, generatePickupOtp, getActiveRequestDelivery, getCompletedDeliveries, startDeliveryJourney } from "../controllers/bloodRequestController.js";

const router = express.Router();

router.get("/my/active-delivery", checkAuth, getActiveRequestDelivery);
router.get("/my/completed-deliveries", checkAuth, getCompletedDeliveries);
router.patch("/:bloodRequestId/start-journey",checkAuth,startDeliveryJourney);
router.post("/:bloodRequestId/pickup-otp", checkAuth, generatePickupOtp);
router.patch("/:bloodRequestId/confirm-pickup", checkAuth, confirmPickup);

export default router;
