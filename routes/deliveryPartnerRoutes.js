import express from "express";
import multer from "multer";
import {approveDeliveryPartner,getDeliveryPartnerById,getDeliveryPartnerStats,getDeliveryPartners,registerDeliveryPartner,rejectDeliveryPartner,updateDeliveryPartnerStatus} from "../controllers/deliveryPartnerControlller.js";
import checkAuth, { allowRoles } from "../middleware/authMiddleware.js";
import { uploadDeliveryPartnerDocuments } from "../middleware/deliveryPartnerUpload.js";

const router = express.Router();

router.post("/register",uploadDeliveryPartnerDocuments.fields([{ name: "aadhaarDocument", maxCount: 1 },{ name: "licenseDocument", maxCount: 1 },]),registerDeliveryPartner);

router.get("/stats", checkAuth, allowRoles("Admin"), getDeliveryPartnerStats);

router.get("/", checkAuth, allowRoles("Admin"), getDeliveryPartners);

router.get("/:partnerId", checkAuth, allowRoles("Admin"), getDeliveryPartnerById);

router.patch("/:partnerId/approve", checkAuth, allowRoles("Admin"), approveDeliveryPartner);

router.patch("/:partnerId/reject", checkAuth, allowRoles("Admin"), rejectDeliveryPartner);

router.patch("/:partnerId/status", checkAuth, allowRoles("Admin"), updateDeliveryPartnerStatus);




router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError || err.message?.includes("files are supported")) {
    const message =
      err.code === "LIMIT_FILE_SIZE"
        ? "Documents must be 5MB or smaller"
        : err.message || "Invalid document upload";

    return res.status(400).json({ message });
  }

  next(err);
});

export default router;
