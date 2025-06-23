import { Router } from "express";

import { authenticate } from "../middlewares/AuthMiddleware";
import { VenueBookingController } from "../controller/VenueBookingController";

function venueBookingRouter(): Router {
    const router = Router();

    // Apply authentication middleware to all routes
    router.use(authenticate);

    // CRUD Routes
    router.post('/', VenueBookingController.createBooking);
    router.post('/bulk', VenueBookingController.createMultipleBookings);
    router.get('/', VenueBookingController.getAllBookings);
    router.get('/:id', VenueBookingController.getBookingById);
    router.put('/:id', VenueBookingController.updateBooking);
    router.delete('/:id', VenueBookingController.deleteBooking);
    // Status Update Route
    router.patch('/:id/status', VenueBookingController.updateBookingStatus);
    // Query Routes
    router.get('/event/:eventId', VenueBookingController.getBookingsByEventId);
    router.get('/venue/:venueId', VenueBookingController.getBookingsByVenueId);
    router.get('/organizer/:organizerId', VenueBookingController.getBookingsByOrganizerId);
    router.get('/organization/:organizationId', VenueBookingController.getBookingsByOrganizationId);
    router.get('/status/:status', VenueBookingController.getBookingsByStatus);
    router.get('/date-range/:startDate/:endDate', VenueBookingController.getBookingsByDateRange);

    // Total Amount Route
    router.get('/total/:eventId', VenueBookingController.getTotalBookingAmountForEvent);

    return router;
}

export default venueBookingRouter();