"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const AuthMiddleware_1 = require("../middlewares/AuthMiddleware");
const router = (0, express_1.Router)();
// =======================
// 📂 Public Event Routes
// =======================
// router.get('/', EventController.getAllEvents);
// router.get('/:id', EventController.getEventById);
// router.get('/:eventId/venue-bookings', EventController.getVenueBookings);
// =======================
// 🔒 Protected Event Routes
// =======================
router.use(AuthMiddleware_1.authenticate);
// Event Management
// router.post('/',checkVenueAvailability, EventController.createEvent);
// router.put('/:id/approve', EventController.approveEvent);
// router.put('/:id', EventController.updateEvent);
// router.delete('/:id', EventController.deleteEvent);
// // Venue Booking Management
// router.post('/:eventId/venue-bookings', EventController.bulkCreateVenueBookings);
// router.put('/venue-bookings/:bookingId/approve', EventController.approveVenueBooking);
// router.put('/:eventId/venue-bookings/:bookingId', EventController.updateVenueBooking);
// router.delete('/:eventId/venue-bookings/:bookingId', EventController.deleteVenueBooking);
exports.default = router;
