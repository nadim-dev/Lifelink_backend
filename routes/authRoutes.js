import express from "express";
import multer from "multer";
import { registerUser,loginUser,fetchCurrentUser,loginWithGoogle,logoutUser, deleteCurrentUserAccount, updateCurrentUserPassword, updateCurrentUserProfile, updateProfilePicture} from "../controllers/authController.js";
import checkAuth from "../middleware/authMiddleware.js";
import { uploadProfilePicture } from "../middleware/profilePictureUpload.js";



const router=express.Router();

router.post("/register",registerUser);
router.post("/login",loginUser);
router.get("/me",checkAuth,fetchCurrentUser);
router.patch("/profile",checkAuth,updateCurrentUserProfile);
router.patch("/profile-picture",checkAuth,uploadProfilePicture.single("picture"),updateProfilePicture);
router.patch("/password",checkAuth,updateCurrentUserPassword);
router.post("/logout",checkAuth,logoutUser);
router.delete("/account",checkAuth,deleteCurrentUserAccount);
router.post("/google-login",loginWithGoogle)

router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError || err.message?.includes("files are supported")) {
    const message =
      err.code === "LIMIT_FILE_SIZE"
        ? "Profile picture must be 5MB or smaller"
        : err.message || "Invalid profile picture upload";

    return res.status(400).json({ message });
  }

  next(err);
});

export default router;
