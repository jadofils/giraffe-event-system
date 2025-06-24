import { Router } from 'express';
import { EventController } from '../controller/eventController';
import { authenticate } from '../middlewares/AuthMiddleware';

const router = Router();

// =======================
// 📂 Public Event Routes
// =======================
router.get('/', EventController.getAllEvents);
router.get('/:id', EventController.getEventById);
router.get('/:eventId/venue-bookings', EventController.getVenueBookings);

// =======================
// 🔒 Protected Event Routes
// =======================
router.use(authenticate);

// Event Management
router.post('/', EventController.createEvent);
router.put('/:id/approve', EventController.approveEvent);
router.put('/:id', EventController.updateEvent);
router.delete('/:id', EventController.deleteEvent);


// Venue Booking Management
router.post('/:eventId/venue-bookings', EventController.bulkCreateVenueBookings);
router.put('/venue-bookings/:bookingId/approve', EventController.approveVenueBooking);
router.put('/:eventId/venue-bookings/:bookingId', EventController.updateVenueBooking);
router.delete('/:eventId/venue-bookings/:bookingId', EventController.deleteVenueBooking);

export default router;
