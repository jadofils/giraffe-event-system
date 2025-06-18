import { Router } from "express";

import { authenticate } from "../middlewares/AuthMiddleware";
import { VenueBookingController } from "../controller/VenueBookingController";

const router = Router();

router.post("/bookings", authenticate, VenueBookingController.createVenueBooking);
router.post("/bookings/bulk", authenticate, VenueBookingController.createMultipleVenueBookings);
router.get("/bookings", authenticate, VenueBookingController.getAllVenueBookings);
router.get("/bookings/:id", VenueBookingController.getVenueBookingById);
router.put("/bookings/:id", authenticate, VenueBookingController.updateVenueBooking);
router.patch("/bookings/:id/status", authenticate, VenueBookingController.updateVenueBookingStatus);
router.delete("/bookings/:id", authenticate, VenueBookingController.deleteVenueBooking);
router.get("/events/:eventId/bookings", authenticate, VenueBookingController.getBookingsByEventId);
router.get("/venues/:venueId/bookings", authenticate, VenueBookingController.getBookingsByVenueId);
router.get("/bookings/organizer", authenticate, VenueBookingController.getBookingsByOrganizerId);
router.get("/organizations/:organizationId/bookings", authenticate, VenueBookingController.getBookingsByOrganizationId);
router.get("/bookings/status/:status", authenticate, VenueBookingController.getBookingsByStatus);
router.get("/bookings/date-range", authenticate, VenueBookingController.getBookingsByDateRange);
router.get("/bookings/check-duplicates", authenticate, VenueBookingController.checkDuplicateBookings);

// Error handlers
//router.all("*", VenueBookingController.methodNotAllowed);
router.get("/unauthorized", VenueBookingController.unauthorized);
router.get("/forbidden", VenueBookingController.forbidden);

export default router;