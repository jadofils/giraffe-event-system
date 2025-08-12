import { Router } from "express";
import { EventController } from "../controller/eventController";
import { authenticate } from "../middlewares/AuthMiddleware";
import multer from "multer";
import { isAdmin } from "../middlewares/IsAdmin";
import { RegistrationController } from "../controller/RegistrationController";
import { FreeEventRegistrationController } from "../controller/FreeEventRegistrationController";
import { FreeEventAttendanceController } from "../controller/FreeEventAttendanceController";
import { CheckInStaffController } from "../controller/CheckInStaffController";

const router = Router();
const upload = multer();

// Public Event Routes
router.get("/all", EventController.getAllApprovedEvents);
router.get("/public/:id", EventController.getEventById);

// Public: Free event check-in flows
router.post(
  "/free-check-in/details",
  FreeEventAttendanceController.viewFreeEventCheckInDetails
);
router.post("/free-check-in", FreeEventAttendanceController.checkInFreeEvent);

// Public: ticket check-in endpoint
router.post("/tickets/check-in", RegistrationController.checkInTicket);

// Public: View paid ticket details before check-in
router.post("/tickets/details", RegistrationController.viewTicketDetails);

// Public: validate code for check-in staff
router.post(
  "/check-in-staff/validate-code",
  CheckInStaffController.validateSixDigitCode
);

// Public: update free registration (kept public per current behavior)
router.patch(
  "/registrations/free/:freeRegistrationId",
  FreeEventRegistrationController.updateFreeEventRegistration
);

// Authenticated routes below
router.use(authenticate);

// Events
router.get("/", EventController.getAllEvents);
router.get("/:id", EventController.getEventById);
router.get("/:eventId/registrations", EventController.getRegistrationsByEvent);

// 📂 Free Event Registration Route (now authenticated)
router.post(
  "/:eventId/register/free",
  FreeEventRegistrationController.registerForFreeEvent
);

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
  EventController.createEventForExternalUser
);

// Ticket purchase route
router.post("/tickets/purchase", EventController.purchaseTicket);

// Get tickets by User ID Route
router.get("/tickets/user/:userId", RegistrationController.getTicketsByUserId);

// Get single ticket registration by ID (authenticated)
router.get(
  "/registration/:registrationId",
  RegistrationController.getRegistrationById
);

router.get(
  "/:eventId/registrations/free",
  FreeEventRegistrationController.getFreeRegistrationsByEventId
);

// Get single free registration by ID (authenticated)
router.get(
  "/free-registration/:registrationId",
  FreeEventRegistrationController.getOneFreeRegistrationById
);

// Free Event Attendance (authenticated)
router.get(
  "/:eventId/attendance/free",
  FreeEventRegistrationController.getFreeEventAttendance
);
router.post(
  "/:eventId/check-in-staff",
  CheckInStaffController.createCheckInStaff
);
router.get(
  "/:eventId/check-in-staff",
  CheckInStaffController.listCheckInStaffByEvent
);
router.patch(
  "/check-in-staff/:staffId",
  CheckInStaffController.updateCheckInStaff
);
router.delete(
  "/check-in-staff/:staffId",
  CheckInStaffController.deleteCheckInStaff
);

// Admin/Staff only (example)
// router.patch("/tickets/:registrationId/mark-attended", isAdmin, RegistrationController.markTicketAttended);

export const eventRouter = router;
