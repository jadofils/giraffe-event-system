import { Request, Response } from "express";
import { NotificationRepository } from "../repositories/NotificationRepository";

export class NotificationController {
  static async getAllForUser(req: Request, res: Response) {
    const userId = req.user?.userId;
    if (!userId || typeof userId !== "string") {
      return res
        .status(400)
        .json({ success: false, message: "userId is required" });
    }
    const notifications = await NotificationRepository.getAllForUser(userId);
    res.json({ success: true, data: notifications });
  }

  static async markAsRead(req: Request, res: Response) {
    const { id } = req.params;
    const notification = await NotificationRepository.markAsRead(id);
    if (!notification) {
      return res
        .status(404)
        .json({ success: false, message: "Notification not found" });
    }
    res.json({ success: true, data: notification });
  }

  static async deleteNotification(req: Request, res: Response) {
    const { id } = req.params;
    await NotificationRepository.deleteNotification(id);
    res.json({ success: true, message: "Notification deleted" });
  }
}
