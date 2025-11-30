import express from "express";
import * as notifController from "../controllers/notifications.controller.js";

const router = express.Router();

router.get("/:user_id", notifController.getNotifications);
router.put("/:id/read", notifController.markAsRead);
router.delete("/:id", notifController.deleteNotification);

export default router;