import express from "express";
import { registerUser,loginUser,fetchCurrentUser,logoutUser} from "../controllers/authController.js";
import checkAuth from "../middleware/authMiddleware.js";


const router=express.Router();

router.post("/register",registerUser);
router.post("/login",loginUser);
router.get("/me",checkAuth,fetchCurrentUser);
router.post("/logout",checkAuth,logoutUser);


export default router;