import { Router } from "express";

import {  } from "../middlewares/AuthMiddleware";
import { VenueBookingController } from "../controller/VenueBookingController";

const router = Router();

router.post("/bookings", VenueBookingController.createVenueBooking);
router.post("/bookings/bulk", VenueBookingController.createMultipleVenueBookings);
router.get("/bookings", VenueBookingController.getAllVenueBookings);
router.get("/bookings/:id", VenueBookingController.getVenueBookingById);
router.put("/bookings/:id" , VenueBookingController.updateVenueBooking);
router.patch("/bookings/:id/status", VenueBookingController.updateVenueBookingStatus);
router.delete("/bookings/:id", VenueBookingController.deleteVenueBooking);
router.get("/events/:eventId/bookings", VenueBookingController.getBookingsByEventId);
router.get("/venues/:venueId/bookings", VenueBookingController.getBookingsByVenueId);
router.get("/bookings/organizer", VenueBookingController.getBookingsByOrganizerId);
router.get("/organizations/:organizationId/bookings", VenueBookingController.getBookingsByOrganizationId);
router.get("/bookings/status/:status", VenueBookingController.getBookingsByStatus);
router.get("/bookings/date-range", VenueBookingController.getBookingsByDateRange);
router.get("/bookings/check-duplicates", VenueBookingController.checkDuplicateBookings);

// Error handlers
//router.all("*", VenueBookingController.methodNotAllowed);
router.get("/unauthorized", VenueBookingController.unauthorized);
router.get("/forbidden", VenueBookingController.forbidden);

export default router;