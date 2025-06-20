import { Router } from 'express';
import { EventController } from '../controller/eventController';
import { authenticate } from '../middlewares/AuthMiddleware';

const router = Router();

// Event Routes
router.post('/', EventController.createEvent);
router.put('/:id/approve', EventController.approveEvent);
router.get('/:id', EventController.getEventById);
router.get('/', EventController.getAllEvents);
router.put('/:id', EventController.updateEvent);
router.delete('/:id', EventController.deleteEvent);

// Venue Booking Routes
router.post('/:eventId/venue-bookings',authenticate, EventController.bulkCreateVenueBookings);
router.put('/venue-bookings/:bookingId/approve', EventController.approveVenueBooking);
router.get('/:eventId/venue-bookings', EventController.getVenueBookings);
router.put('/:eventId/venue-bookings/:bookingId', EventController.updateVenueBooking);
router.delete('/:eventId/venue-bookings/:bookingId', EventController.deleteVenueBooking);

export default router;