import { Router } from "express";
import { EventController } from "../controller/eventController";
import { checkVenueAvailability } from "../middlewares/checkVenueAvailability";
import { authenticate } from "../middlewares/AuthMiddleware";

const router = Router();

// Get all events
router.get("/", EventController.getAllEvents);

// Get event by ID
router.get("/:id", EventController.getEventById);

// Create event
router.post("/",checkVenueAvailability,authenticate, EventController.createEvent);

// Update event
router.put("/:id", EventController.updateEvent);

// Delete event
router.delete("/:id", EventController.deleteEvent);

// Approve event
router.put("/:id/approve", EventController.approveEvent);

// Bulk create venue bookings for an event
router.post("/:eventId/venue-bookings/bulk", EventController.bulkCreateVenueBookings);

// Get all venue bookings for an event
router.get("/:eventId/venue-bookings", EventController.getVenueBookings);

// Approve a venue booking
router.put("/venue-bookings/:bookingId/approve", EventController.approveVenueBooking);

// Update a venue booking
router.put("/venue-bookings/:bookingId", EventController.updateVenueBooking);

// Delete a venue booking from an event
router.delete("/:eventId/venue-bookings/:bookingId", EventController.deleteVenueBooking);

export default router;
