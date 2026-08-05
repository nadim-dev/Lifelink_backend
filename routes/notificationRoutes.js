
import express from "express"
import checkAuth from "../middleware/authMiddleware.js";
import { fetchNotificationCount,getAllNotifications,markAllNotificationsAsRead } from "../controllers/notificationCOntroller.js";

const router=express.Router();

router.get("/unread-count",checkAuth,fetchNotificationCount);
router.patch("/read-all",checkAuth,markAllNotificationsAsRead);
router.get("/",checkAuth,getAllNotifications);

export default router;
