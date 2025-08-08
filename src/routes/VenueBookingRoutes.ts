import { Router } from "express";
import { authenticate } from "../middlewares/AuthMiddleware";
import { VenueBookingController } from "../controller/VenueBookingController";
import { asyncHandler } from "../utils/asyncHandler";

const router = Router();

router.use(authenticate);

router.get("/", VenueBookingController.getAllBookings);
router.get(
  "/manager/:managerId",
  VenueBookingController.getBookingsByManagerId
);
router.get(
  "/manager/:managerId/pending",
  asyncHandler(VenueBookingController.getPendingBookingsByManager)
);
router.get("/:bookingId", VenueBookingController.getBookingById);
router.patch("/:bookingId/approve", VenueBookingController.approveBooking);
router.patch(
  "/:bookingId/cancel-by-manager",
  VenueBookingController.cancelByManager
);
router.patch(
  "/:bookingId/cancel-and-delete-slots-by-manager",
  VenueBookingController.cancelAndDeleteSlotsByManager
);
router.patch(
  "/:bookingId/cancel-by-manager-without-slot-deletion",
  VenueBookingController.cancelByManagerWithoutSlotDeletion
);
router.post("/:bookingId/payments", VenueBookingController.processPayment);
router.get("/:bookingId/payments", VenueBookingController.getPaymentHistory);
router.get(
  "/payments/manager/:managerId",
  VenueBookingController.getPaymentsByManagerId
);
router.get(
  "/payments/manager/:managerId/formatted",
  asyncHandler(VenueBookingController.getFormattedPaymentsByManager)
);
router.get(
  "/user/:userId/payments",
  VenueBookingController.getPaymentsForUserBookings
);
router.get("/user/:userId/bookings", VenueBookingController.getUserBookings);
router.patch(
  "/:bookingId/refund-all-payments",
  asyncHandler(VenueBookingController.refundAllPaymentsByManager)
);
router.get(
  "/user/:userId/all-accessible-payments",
  asyncHandler(VenueBookingController.getAllAccessiblePaymentsForUser)
);
router.get(
  "/venue/:venueId/bookings",
  asyncHandler(VenueBookingController.getBookingsByVenueId)
);

router.get(
  "/payments/receipt/:receiptNumber",
  asyncHandler(VenueBookingController.getPaymentByReceiptNumber)
);

export default router;
