import { AppDataSource } from "../../config/Database";
import { Notification } from "../../models/Notification";
import { User } from "../../models/User";

export class SimpleNotificationService {
  static async notifyUser(user: User, message: string) {
    const notificationRepo = AppDataSource.getRepository(Notification);
    const notification = notificationRepo.create({
      user,
      userId: user.userId,
      message,
      sentAt: new Date(),
      isDesabled: false,
      isRead: false,
    });
    return await notificationRepo.save(notification);
  }
}
