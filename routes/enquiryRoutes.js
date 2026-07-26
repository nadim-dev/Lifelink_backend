import express from "express";
import { createEnquiry } from "../controllers/enquiryController.js";

const router = express.Router();

router.post("/", createEnquiry);

export default router;
