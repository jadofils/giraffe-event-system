import { AppDataSource } from "../config/Database";
import { Notification } from "../models/Notification";

export class NotificationRepository {
  static async getAllForUser(userId: string) {
    const repo = AppDataSource.getRepository(Notification);
    return await repo.find({ where: { userId }, order: { sentAt: "DESC" } });
  }

  static async markAsRead(notificationId: string) {
    const repo = AppDataSource.getRepository(Notification);
    const notification = await repo.findOne({ where: { notificationId } });
    if (notification) {
      notification.isRead = true;
      await repo.save(notification);
    }
    return notification;
  }

  static async deleteNotification(notificationId: string) {
    const repo = AppDataSource.getRepository(Notification);
    return await repo.delete({ notificationId });
  }

  static async createNotification(data: Partial<Notification>) {
    const repo = AppDataSource.getRepository(Notification);
    const notification = repo.create(data);
    return await repo.save(notification);
  }
} 