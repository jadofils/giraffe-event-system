import { Router } from "express";
import { EventController } from "../controller/eventController";
import { authenticate } from "../middlewares/AuthMiddleware";
import multer from "multer";
import { isAdmin } from "../middlewares/IsAdmin";

const router = Router();
const upload = multer();

// 📂 Public Event Routes
router.get("/all", EventController.getAllApprovedEvents);
router.get("/public/:id", EventController.getEventById);

router.use(authenticate);

router.get("/", EventController.getAllEvents);
router.get("/:id", EventController.getEventById);
router.post(
  "/",
  upload.fields([
    { name: "eventPhoto", maxCount: 1 },
    { name: "guestPhotos", maxCount: 5 },
  ]),
  EventController.createEvent
);
router.patch("/:id/request-publish", EventController.requestPublish);
router.patch("/:id/text-fields", EventController.updateEventTextFields);
router.patch("/:id/query", isAdmin, EventController.queryEvent);
router.patch("/:id/reject", isAdmin, EventController.rejectEvent);
router.patch("/:id/approve", isAdmin, EventController.approveEvent);
router.get(
  "/booking/:bookingId/payment-details",
  EventController.getBookingPaymentDetails
);
router.get(
  "/group/:groupId/payment-details",
  EventController.getGroupPaymentDetails
);
router.post(
  "/bookings/payment-details",
  EventController.getPaymentDetailsForSelectedBookings
);
router.post(
  "/:eventId/guests",
  upload.single("guestPhoto"),
  EventController.addEventGuest
);
router.patch("/:eventId/guests/:guestId", EventController.updateEventGuestName);
router.delete("/:eventId/guests/:guestId", EventController.deleteEventGuest);
router.patch(
  "/:eventId/guests/:guestId/photo",
  upload.single("guestPhoto"),
  EventController.updateEventGuestPhoto
);
router.get("/user/:userId", EventController.getEventsByUserId);

// Add manager endpoint for creating event for external user
router.post(
  "/manager/create-event-for-user",
  authenticate,
  EventController.createEventForExternalUser
);

export default router;
