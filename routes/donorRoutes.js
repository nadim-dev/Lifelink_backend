import express from "express";
import { createDonor, getAdminUserDetails, getAllUsersForAdmin, getAllUsersStats, getCurrentUserDonor,suspendUser, updateCurrentUserDonor, updateUserLocation } from "../controllers/donorController.js";
import checkAuth, { allowRoles } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/location", checkAuth, updateUserLocation);
router.get("/users/stat", checkAuth, allowRoles("Admin"), getAllUsersStats);
router.get("/users", checkAuth, allowRoles("Admin"), getAllUsersForAdmin);
router.get("/users/:userId", checkAuth, allowRoles("Admin"), getAdminUserDetails);
router.get("/me", checkAuth, getCurrentUserDonor);
router.patch("/me", checkAuth, updateCurrentUserDonor);
router.post("/", checkAuth, createDonor);
router.patch("/users/:userId/suspend",checkAuth,allowRoles("Admin"),suspendUser);

export default router;