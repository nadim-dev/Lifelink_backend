import express from "express";
import multer from "multer";
import {
  getAllBloodBanksForAdmin,
  getBloodBankForAdmin,
  getNearbyBloodBanks,
  getPublicBloodBank,
  registerBloodBank,
  updateBloodBankStatusForAdmin,
} from "../controllers/bloodBankController.js";
import { uploadBloodBankLicense } from "../middleware/bloodBankUpload.js";
import checkAuth, { allowRoles } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/nearby", checkAuth, getNearbyBloodBanks);
router.get("/admin/all", checkAuth, allowRoles("Admin"), getAllBloodBanksForAdmin);
router.get("/admin/:bloodBankId", checkAuth, allowRoles("Admin"), getBloodBankForAdmin);
router.patch("/admin/:bloodBankId/status", checkAuth, allowRoles("Admin"), updateBloodBankStatusForAdmin);
router.get("/:bloodBankId", checkAuth, allowRoles("Admin", "User"), getPublicBloodBank);

router.post(
  "/register",
  uploadBloodBankLicense.single("licenseDocument"),
  registerBloodBank,
);

router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError || err.message?.includes("files are supported")) {
    const message =
      err.code === "LIMIT_FILE_SIZE"
        ? "License document must be 5MB or smaller"
        : err.message || "Invalid license document upload";

    return res.status(400).json({ message });
  }

  next(err);
});

export default router;
