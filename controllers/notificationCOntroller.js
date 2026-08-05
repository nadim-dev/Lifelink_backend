import Notification from "../models/notificationModel.js";

export const getAllNotifications = async (req, res) => {
  try {
    console.log("Get all notifications controller is running");

    const userId = req.user._id;

    const notifications = await Notification.find({ userId })
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      notifications,
    });
  } catch (error) {
    console.error("Error fetching notifications:", error);

    return res.status(500).json({
      message: "Failed to fetch notifications.",
    });
  }
};

export const fetchNotificationCount = async (req, res) => {
  try {
    console.log("Fetch notification count controller is running");

    const userId = req.user._id;

    const unreadCount = await Notification.countDocuments({
      userId,
      isRead: false,
    });

    return res.status(200).json({
      unreadCount,
    });
  } catch (error) {
    console.error("Error fetching notification count:", error);

    return res.status(500).json({
      message: "Failed to fetch notification count.",
    });
  }
};

export const markAllNotificationsAsRead = async (req, res) => {
  try {
    console.log("Mark all notifications as read controller is running");

    const userId = req.user._id;

    const result = await Notification.updateMany(
      {
        userId,
        isRead: false,
      },
      {
        $set: {
          isRead: true,
        },
      }
    );

    return res.status(200).json({
      message: "All notifications marked as read.",
      modifiedCount: result.modifiedCount,
    });
  } catch (error) {
    console.error("Error marking notifications as read:", error);

    return res.status(500).json({
      message: "Failed to mark notifications as read.",
    });
  }
};
