"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationService = void 0;
const Database_1 = require("../../config/Database");
const Notification_1 = require("../../models/Notification");
class NotificationService {
    static createNotification(_a) {
        return __awaiter(this, arguments, void 0, function* ({ userId, eventId, venueId, message, }) {
            const notificationRepo = Database_1.AppDataSource.getRepository(Notification_1.Notification);
            const notification = notificationRepo.create({
                userId,
                eventId: eventId || null,
                venueId: venueId || null,
                message,
                sentAt: new Date(),
                isDesabled: false,
                isRead: false,
            });
            return yield notificationRepo.save(notification);
        });
    }
    static getAllForUser(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            const notificationRepo = Database_1.AppDataSource.getRepository(Notification_1.Notification);
            return yield notificationRepo.find({
                where: { userId },
                order: { sentAt: "DESC" },
            });
        });
    }
    static markAsRead(notificationId) {
        return __awaiter(this, void 0, void 0, function* () {
            const notificationRepo = Database_1.AppDataSource.getRepository(Notification_1.Notification);
            const notification = yield notificationRepo.findOne({
                where: { notificationId },
            });
            if (notification) {
                notification.isRead = true;
                yield notificationRepo.save(notification);
            }
            return notification;
        });
    }
}
exports.NotificationService = NotificationService;
