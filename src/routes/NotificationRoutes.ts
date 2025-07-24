import { Router } from "express";
import { NotificationController } from "../controller/NotificationController";
import { authenticate } from "../middlewares/AuthMiddleware";
import { asyncHandler } from "../utils/asyncHandler";

const router = Router();

router.use(authenticate);
router.get("/", asyncHandler(NotificationController.getAllForUser));
router.patch("/:id/read", asyncHandler(NotificationController.markAsRead));
router.delete("/:id", asyncHandler(NotificationController.deleteNotification));

export default router;
