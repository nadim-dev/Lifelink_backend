import express from "express";
import {
  createEnquiry,
  getAllEnquiries,
  replyToEnquiry,
} from "../controllers/enquiryController.js";
import checkAuth, { allowRoles } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/", createEnquiry);
router.get("/", checkAuth, allowRoles("Admin"), getAllEnquiries);
router.patch("/:id/reply", checkAuth, allowRoles("Admin"), replyToEnquiry);

export default router;
