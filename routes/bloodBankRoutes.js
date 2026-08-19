import express from "express";
import multer from "multer";
import {
  addMyBloodBankInventory,
  deleteMyBloodBankInventory,
  getAllBloodBanksForAdmin,
  getBloodBankForAdmin,
  getMyBloodBankProfile,
  getNearbyBloodBanks,
  getPublicBloodBank,
  registerBloodBank,
  updateMyBloodBankInventory,
  updateMyBloodBankProfile,
  updateBloodBankStatusForAdmin,
} from "../controllers/bloodBankController.js";
import {
  approveIncomingBloodBankRequest,
  cancelMyBloodRequest,
  createBloodRequest,
  getIncomingBloodBankRequests,
  getMyBloodRequests,
  getMyBloodRequestTracking,
  generateDeliveryOtp,
  markIncomingBloodBankRequestReadyToDispatch,
  rejectIncomingBloodBankRequest,
} from "../controllers/bloodRequestController.js";
import { uploadBloodBankLicense } from "../middleware/bloodBankUpload.js";
import checkAuth, { allowRoles } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/nearby", checkAuth, getNearbyBloodBanks);
router.get("/me/profile", checkAuth, allowRoles("BloodBank"), getMyBloodBankProfile);
router.patch("/me/profile", checkAuth, allowRoles("BloodBank"), updateMyBloodBankProfile);
router.post("/me/inventory", checkAuth, allowRoles("BloodBank"), addMyBloodBankInventory);
router.patch("/me/inventory/:inventoryId", checkAuth, allowRoles("BloodBank"), updateMyBloodBankInventory);
router.delete("/me/inventory/:inventoryId", checkAuth, allowRoles("BloodBank"), deleteMyBloodBankInventory);
router.get("/admin/all", checkAuth, allowRoles("Admin"), getAllBloodBanksForAdmin);
router.get("/admin/:bloodBankId", checkAuth, allowRoles("Admin"), getBloodBankForAdmin);
router.patch("/admin/:bloodBankId/status", checkAuth, allowRoles("Admin"), updateBloodBankStatusForAdmin);
router.get("/requests/incoming", checkAuth, allowRoles("BloodBank"), getIncomingBloodBankRequests);
router.patch("/requests/incoming/:requestId/approve", checkAuth, allowRoles("BloodBank"), approveIncomingBloodBankRequest);
router.patch("/requests/incoming/:requestId/ready-to-dispatch", checkAuth, allowRoles("BloodBank"), markIncomingBloodBankRequestReadyToDispatch);
router.patch("/requests/incoming/:requestId/reject", checkAuth, allowRoles("BloodBank"), rejectIncomingBloodBankRequest);
router.get("/requests/my", checkAuth, allowRoles("User"), getMyBloodRequests);
router.get("/requests/my/:bloodRequestId/tracking", checkAuth, allowRoles("User"), getMyBloodRequestTracking);
router.post("/requests/my/:bloodRequestId/delivery-otp", checkAuth, allowRoles("User"), generateDeliveryOtp);
router.patch("/requests/:requestId/cancel", checkAuth, allowRoles("User"), cancelMyBloodRequest);
router.post("/:bloodBankId/requests", checkAuth, allowRoles("User"), createBloodRequest);
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
