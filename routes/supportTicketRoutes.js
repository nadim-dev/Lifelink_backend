import express from "express";
import multer from "multer";
import {createSupportTicket,getMySupportTickets,} from "../controllers/supportTicketController.js";
import checkAuth from "../middleware/authMiddleware.js";
import { uploadSupportTicketScreenshot } from "../middleware/supportTicketUpload.js";

const router = express.Router();

router.post("/",checkAuth,uploadSupportTicketScreenshot.single("screenshot"),createSupportTicket);

router.get("/mine", checkAuth, getMySupportTickets);


router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    const message =
      err.code === "LIMIT_FILE_SIZE"
        ? "File size must be 5MB or less"
        : "Invalid file upload";

    return res.status(400).json({ message });
  }

  if (err) {
    return res.status(400).json({ message: err.message });
  }

  next();
});

export default router;
