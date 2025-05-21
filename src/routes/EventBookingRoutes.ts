import express from 'express';
import { EventBookingController } from '../controller/EventBookingController';
import { verifyJWT } from '../middlewares/AuthMiddleware';

const router = express.Router();

/**
 * Basic CRUD Operations
 */
// Create a new event booking
router.post('/create',EventBookingController.createEventBooking);

// Get all event bookings
router.get('/all', EventBookingController.getAllEventBookings);

/**
 * Filtering Operations
 */
// Get bookings by date range (must come before other GET routes with parameters)
router.get('/date-range', EventBookingController.getBookingsByDateRange);

// Get bookings by event ID
router.get('/event/:eventId', EventBookingController.getBookingsByEventId);

// Get bookings by venue ID
router.get('/venue/:venueId', EventBookingController.getBookingsByVenueId);

// Get bookings by organizer ID
// routes/eventBookingRoutes.ts
router.get('/organizer', verifyJWT, EventBookingController.getBookingsByOrganizerId);
// Get bookings by organization ID
router.get('/organization/:organizationId', EventBookingController.getBookingsByOrganizationId);

// Get bookings by approval status
router.get('/status/:status', EventBookingController.getBookingsByStatus);

// Get a specific event booking by ID (must come after other specific GET routes)
router.get('/:id', EventBookingController.getEventBookingById);

// Update an event booking
router.put('/:id', EventBookingController.updateEventBooking);

// Update only the status of an event booking
router.patch('/:id/status', EventBookingController.updateEventBookingStatus);

// Delete an event booking
router.delete('/:id', EventBookingController.deleteEventBooking);



/**
 * Error Handlers
 */
// Handle method not allowed
router.use((req, res) => {
    res.status(404).json({ message: "Route not found" });
});

export default router;