import { Router } from "express";
import { VenueTypeController } from "../controller/VenueTypeController";
import { authenticate } from "../middlewares/AuthMiddleware";
import { isAdmin } from "../middlewares/IsAdmin";

const router = Router();

// Public routes
router.get("/", VenueTypeController.getAllVenueTypes);
router.get("/:id", VenueTypeController.getVenueTypeById);

// Admin routes
router.post(
  "/",
  authenticate,
  isAdmin,
  VenueTypeController.createVenueType
);
router.patch(
  "/:id",
  authenticate,
  isAdmin,
  VenueTypeController.updateVenueType
);
router.delete(
  "/:id",
  authenticate,
  isAdmin,
  VenueTypeController.deleteVenueType
);

export default router;
