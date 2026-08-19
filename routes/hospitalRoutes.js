import express from "express";
import multer from "multer";
import { getHospitalById, getHospitalStats, getHospitals,getNearbyHospitals, getPublicHospitalById, registerHospital, updateHospitalStatus } from "../controllers/hospitalController.js";
import checkAuth, { allowRoles } from "../middleware/authMiddleware.js";
import { uploadHospitalRegistrationDocument } from "../middleware/hospitalUpload.js";

const router = express.Router();

router.get("/nearby",checkAuth,getNearbyHospitals);

router.get("/public/:hospitalId", checkAuth, getPublicHospitalById);

router.get("/stats", checkAuth, allowRoles("Admin"), getHospitalStats);

router.get("/", checkAuth, allowRoles("Admin"), getHospitals);

router.get("/:hospitalId", checkAuth, allowRoles("Admin"), getHospitalById);

router.patch("/:hospitalId/status", checkAuth, allowRoles("Admin"), updateHospitalStatus);

router.post(
  "/register",
  uploadHospitalRegistrationDocument.single("registrationDocument"),
  registerHospital,
);



router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError || err.message?.includes("files are supported")) {
    const message =
      err.code === "LIMIT_FILE_SIZE"
        ? "Registration certificate must be 5MB or smaller"
        : err.message || "Invalid registration certificate upload";

    return res.status(400).json({ message });
  }

  next(err);
});

export default router;
