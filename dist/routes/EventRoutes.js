"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const eventController_1 = require("../controller/eventController");
const AuthMiddleware_1 = require("../middlewares/AuthMiddleware");
const multer_1 = __importDefault(require("multer"));
const IsAdmin_1 = require("../middlewares/IsAdmin");
const RegistrationController_1 = require("../controller/RegistrationController");
const router = (0, express_1.Router)();
const upload = (0, multer_1.default)();
// 📂 Public Event Routes
router.get("/all", eventController_1.EventController.getAllApprovedEvents);
router.get("/public/:id", eventController_1.EventController.getEventById);
router.post("/tickets/check-in", RegistrationController_1.RegistrationController.checkInTicket);
router.use(AuthMiddleware_1.authenticate);
router.get("/", eventController_1.EventController.getAllEvents);
router.get("/:id", eventController_1.EventController.getEventById);
router.post("/", upload.fields([
    { name: "eventPhoto", maxCount: 1 },
    { name: "guestPhotos", maxCount: 5 },
]), eventController_1.EventController.createEvent);
router.patch("/:id/request-publish", eventController_1.EventController.requestPublish);
router.patch("/:id/text-fields", eventController_1.EventController.updateEventTextFields);
router.patch("/:id/query", IsAdmin_1.isAdmin, eventController_1.EventController.queryEvent);
router.patch("/:id/reject", IsAdmin_1.isAdmin, eventController_1.EventController.rejectEvent);
router.patch("/:id/approve", IsAdmin_1.isAdmin, eventController_1.EventController.approveEvent);
router.get("/booking/:bookingId/payment-details", eventController_1.EventController.getBookingPaymentDetails);
router.get("/group/:groupId/payment-details", eventController_1.EventController.getGroupPaymentDetails);
router.post("/bookings/payment-detail", eventController_1.EventController.getPaymentDetailsForSelectedBookings);
router.post("/:eventId/guests", upload.single("guestPhoto"), eventController_1.EventController.addEventGuest);
router.patch("/:eventId/guests/:guestId", eventController_1.EventController.updateEventGuestName);
router.delete("/:eventId/guests/:guestId", eventController_1.EventController.deleteEventGuest);
router.patch("/:eventId/guests/:guestId/photo", upload.single("guestPhoto"), eventController_1.EventController.updateEventGuestPhoto);
router.get("/user/:userId", eventController_1.EventController.getEventsByUserId);
// Add manager endpoint for creating event for external user
router.post("/manager/create-event-for-user", AuthMiddleware_1.authenticate, eventController_1.EventController.createEventForExternalUser);
// Ticket purchase route
router.post("/tickets/purchase", AuthMiddleware_1.authenticate, eventController_1.EventController.purchaseTicket);
// QR Code Validation Route
router.post("/tickets/validate-qr", AuthMiddleware_1.authenticate, RegistrationController_1.RegistrationController.validateTicketQrCode);
// Get tickets by User ID Route
router.get("/tickets/user/:userId", AuthMiddleware_1.authenticate, RegistrationController_1.RegistrationController.getTicketsByUserId);
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
exports.default = router;
