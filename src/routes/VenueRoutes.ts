import { Router } from "express";
import { VenueController } from "../controller/venueController";
import { isAdmin } from "../middlewares/IsAdmin";
// import checkAbsenceRoutes from "./CheckAbsenceRoutes";
import { authenticate } from "../middlewares/AuthMiddleware";
import upload from "../middlewares/upload";

const router = Router();
router.get("/public/:id", VenueController.getPublicVenueDetails);
router.get("/public-venues/list", VenueController.getPublicVenuesList);

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
router.get("/all", authenticate, VenueController.getAllVenuesWithManagers);

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
router.get(
  "/:venueId/amenities",
  authenticate,
  VenueController.getVenueAmenities
);
router.get(
  "/:venueId/booking-conditions",
  authenticate,
  VenueController.getVenueBookingConditions
);
router.get(
  "/:venueId/variables",
  authenticate,
  VenueController.getVenueVariables
);

router.get(
  "/:venueId/amenities/:amenityId",
  authenticate,
  VenueController.getVenueAmenityById
);
router.get(
  "/:venueId/booking-conditions/:conditionId",
  authenticate,
  VenueController.getVenueBookingConditionById
);
router.get(
  "/:venueId/variables/:variableId",
  authenticate,
  VenueController.getVenueVariableById
);

router.put(
  "/:venueId/amenities",
  authenticate,
  VenueController.updateVenueAmenities
);
router.put(
  "/:venueId/booking-conditions",
  authenticate,
  VenueController.updateVenueBookingConditions
);
router.put(
  "/:venueId/variables",
  authenticate,
  VenueController.updateVenueVariables
);

router.put(
  "/:venueId/amenities/:amenityId",
  authenticate,
  VenueController.updateVenueAmenityById
);
router.put(
  "/:venueId/booking-conditions/:conditionId",
  authenticate,
  VenueController.updateVenueBookingConditionById
);
router.put(
  "/:venueId/variables/:variableId",
  authenticate,
  VenueController.updateVenueVariableById
);

router.post(
  "/:venueId/amenities",
  authenticate,
  VenueController.addVenueAmenity
);
router.delete(
  "/:venueId/amenities/:amenityId",
  authenticate,
  VenueController.removeVenueAmenity
);
router.patch("/:id/approve", authenticate, VenueController.approveVenue);
router.patch(
  "/:id/approve-public",
  authenticate,
  VenueController.approveVenuePublic
);
router.patch("/:id/reject", authenticate, VenueController.rejectVenue);

// General venue update
router.patch("/:id", authenticate, VenueController.updateGeneralFields);
// Main photo update
router.patch(
  "/:id/main-photo",
  authenticate,
  upload.single("mainPhoto"),
  VenueController.updateMainPhoto
);
// Add photo to gallery
router.post(
  "/:id/photo-gallery",
  authenticate,
  upload.single("photo"),
  VenueController.addPhotoToGallery
);
// Remove photo from gallery
router.delete(
  "/:id/photo-gallery",
  authenticate,
  VenueController.removePhotoFromGallery
);
// Virtual tour update
router.patch(
  "/:id/virtual-tour",
  authenticate,
  upload.single("virtualTour"),
  VenueController.updateVirtualTour
);

export const venueRoute = router;
