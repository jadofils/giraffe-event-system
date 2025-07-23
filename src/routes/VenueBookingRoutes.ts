import { Router } from "express";
import { authenticate } from "../middlewares/AuthMiddleware";
import { VenueBookingController } from "../controller/VenueBookingController";

const router = Router();

router.use(authenticate);

router.get("/", VenueBookingController.getAllBookings);
router.get(
  "/manager/:managerId",
  VenueBookingController.getBookingsByManagerId
);
router.get("/:bookingId", VenueBookingController.getBookingById);
router.patch("/:bookingId/approve", VenueBookingController.approveBooking);
router.post("/:bookingId/payments", VenueBookingController.processPayment);
router.get("/:bookingId/payments", VenueBookingController.getPaymentHistory);
router.get(
  "/payments/manager/:managerId",
  VenueBookingController.getPaymentsByManagerId
);
router.get(
  "/user/:userId/payments",
  VenueBookingController.getPaymentsForUserBookings
);
router.get("/user/:userId/bookings", VenueBookingController.getUserBookings);

export default router;
