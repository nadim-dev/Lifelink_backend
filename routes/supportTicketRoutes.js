import express from "express";
import multer from "multer";
import {addAdminTicketMessage,addTicketMessage,createSupportTicket,getAllSupportTicketsForAdmin,getMySupportTickets,getSupportTicketForAdmin,getTicketById,updateTicketStatusForAdmin,getSupportTicketStats} from "../controllers/supportTicketController.js";
import checkAuth, { allowRoles } from "../middleware/authMiddleware.js";
import { uploadSupportTicketScreenshot } from "../middleware/supportTicketUpload.js";

const router = express.Router();

router.post("/",checkAuth,uploadSupportTicketScreenshot.single("screenshot"),createSupportTicket);

router.get("/mine", checkAuth, getMySupportTickets);

router.get("/admin/all", checkAuth, allowRoles("Admin"), getAllSupportTicketsForAdmin);
router.get("/admin/stats", checkAuth, allowRoles("Admin"), getSupportTicketStats);

router.get("/admin/:ticketId", checkAuth, allowRoles("Admin"), getSupportTicketForAdmin);

router.patch("/admin/:ticketId/status", checkAuth, allowRoles("Admin"), updateTicketStatusForAdmin);

router.post("/admin/:ticketId/messages",checkAuth,allowRoles("Admin"),uploadSupportTicketScreenshot.single("attachment"),addAdminTicketMessage);

router.get("/:ticketId",checkAuth,getTicketById);

router.post("/:ticketId/messages",checkAuth,uploadSupportTicketScreenshot.single("attachment"),addTicketMessage);

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
