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
// ...other routes can remain commented or be enabled as needed

export default router;
