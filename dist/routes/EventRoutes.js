"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const eventController_1 = require("../controller/eventController");
const AuthMiddleware_1 = require("../middlewares/AuthMiddleware");
const checkVenueAvailability_1 = require("../middlewares/checkVenueAvailability");
const router = (0, express_1.Router)();
// =======================
// 📂 Public Event Routes
// =======================
router.get('/', eventController_1.EventController.getAllEvents);
router.get('/:id', eventController_1.EventController.getEventById);
router.get('/:eventId/venue-bookings', eventController_1.EventController.getVenueBookings);
// =======================
// 🔒 Protected Event Routes
// =======================
router.use(AuthMiddleware_1.authenticate);
// Event Management
router.post('/', checkVenueAvailability_1.checkVenueAvailability, eventController_1.EventController.createEvent);
router.put('/:id/approve', eventController_1.EventController.approveEvent);
router.put('/:id', eventController_1.EventController.updateEvent);
router.delete('/:id', eventController_1.EventController.deleteEvent);
// Venue Booking Management
router.post('/:eventId/venue-bookings', eventController_1.EventController.bulkCreateVenueBookings);
router.put('/venue-bookings/:bookingId/approve', eventController_1.EventController.approveVenueBooking);
router.put('/:eventId/venue-bookings/:bookingId', eventController_1.EventController.updateVenueBooking);
router.delete('/:eventId/venue-bookings/:bookingId', eventController_1.EventController.deleteVenueBooking);
exports.default = router;
