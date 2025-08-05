import { Router } from "express";
import { EventController } from "../controller/eventController";
import { authenticate } from "../middlewares/AuthMiddleware";
import multer from "multer";
import { isAdmin } from "../middlewares/IsAdmin";
import EventTicketTypeRoutes from "./EventTicketTypeRoutes";
import { RegistrationController } from "../controller/RegistrationController";

const router = Router();
const upload = multer();

// 📂 Public Event Routes
router.get("/all", EventController.getAllApprovedEvents);
router.get("/public/:id", EventController.getEventById);
router.post("/tickets/check-in", RegistrationController.checkInTicket);

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
router.patch(
  "/:eventId/photo",
  upload.single("eventPhoto"),
  EventController.updateEventPhoto
);
router.get(
  "/booking/:bookingId/payment-details",
  EventController.getBookingPaymentDetails
);
router.get(
  "/group/:groupId/payment-details",
  EventController.getGroupPaymentDetails
);
router.post(
  "/bookings/payment-detail",
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

router.patch(
  "/:eventId/private",
  upload.fields([
    { name: "eventPhoto", maxCount: 1 },
    { name: "guestPhotos", maxCount: 5 },
  ]),
  EventController.updatePrivateEvent
);

router.patch("/admin/:eventId/enable", isAdmin, EventController.enableEvent);
router.patch(
  "/admin/:eventId/disable-by-admin",
  isAdmin,
  EventController.disableEventByAdmin
);

// User accessible enable/disable routes
router.patch("/:eventId/enable", EventController.enableEvent);
router.patch("/:eventId/disable", EventController.disableEvent);

// Add manager endpoint for creating event for external user
router.post(
  "/manager/create-event-for-user",
  authenticate,
  EventController.createEventForExternalUser
);

// Ticket purchase route
router.post("/tickets/purchase", authenticate, EventController.purchaseTicket);

// QR Code Validation Route
router.post(
  "/tickets/validate-qr",
  authenticate,
  RegistrationController.validateTicketQrCode
);

// Get tickets by User ID Route
router.get(
  "/tickets/user/:userId",
  authenticate,
  RegistrationController.getTicketsByUserId
);

// Mark ticket as attended Route (Admin/Staff only)
// router.patch(
//   "/tickets/:registrationId/mark-attended",
//   authenticate,
//   isAdmin,
//   RegistrationController.markTicketAttended
// );

// Unified Ticket Check-in Endpoint (Admin/Staff only)
// router.post(
//   "/tickets/check-in",
//   authenticate,
//   isAdmin,
//   RegistrationController.checkInTicket
// );

export default router;
