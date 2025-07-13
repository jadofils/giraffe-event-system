import { Router } from "express";
import { VenueController } from "../controller/venueController";
import { isAdmin } from "../middlewares/IsAdmin";
// import checkAbsenceRoutes from "./CheckAbsenceRoutes";
import { authenticate } from "../middlewares/AuthMiddleware";
import upload from "../middlewares/upload";

const router = Router();
router.post(
  "/add",
  authenticate,
  upload.fields([
    { name: "mainPhoto", maxCount: 1 },
    { name: "photoGallery", maxCount: 10 },
    { name: "virtualTour", maxCount: 1 },
  ]),
  VenueController.create
);
router.get("/:id", authenticate, VenueController.getVenueById);
router.get(
  "/organizations/:organizationId/venues",
  authenticate,
  VenueController.getVenuesByOrganization
);
router.get(
  "/managers/:managerId/venues",
  authenticate,
  VenueController.getVenuesByManager
);

export const venueRoute = router;
