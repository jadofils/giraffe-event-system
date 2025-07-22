"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const eventController_1 = require("../controller/eventController");
const AuthMiddleware_1 = require("../middlewares/AuthMiddleware");
const router = (0, express_1.Router)();
// 📂 Public Event Routes
router.use(AuthMiddleware_1.authenticate);
router.get("/", eventController_1.EventController.getAllEvents);
router.get("/:id", eventController_1.EventController.getEventById);
router.post("/", eventController_1.EventController.createEvent);
router.patch("/:id/request-publish", eventController_1.EventController.requestPublish);
router.get("/booking/:bookingId/payment-details", eventController_1.EventController.getBookingPaymentDetails);
router.get("/group/:groupId/payment-details", eventController_1.EventController.getGroupPaymentDetails);
router.post("/bookings/payment-details", eventController_1.EventController.getPaymentDetailsForSelectedBookings);
exports.default = router;
