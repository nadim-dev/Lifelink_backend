import express from "express";
import checkAuth from "../middleware/authMiddleware.js";
import { acceptDeliveryRequest, getPendingDeliveryRequests, declineDeliveryRequest } from "../controllers/deliveryController.js";
import { confirmDelivery, startDelivery } from "../controllers/bloodRequestController.js";
const router = express.Router();


router.get("/pending",checkAuth,getPendingDeliveryRequests);
router.patch("/:deliveryRequestId/decline",checkAuth,declineDeliveryRequest);
router.patch("/:deliveryRequestId/accept",checkAuth,acceptDeliveryRequest);
router.patch("/:bloodRequestId/start-delivery",checkAuth,startDelivery);
router.patch("/:requestId/confirm-delivery", checkAuth, confirmDelivery);

export default router;
