import { Router } from "express";
import { VenueController } from "../controller/venueController";
import { isAdmin } from "../middlewares/IsAdmin";
// import checkAbsenceRoutes from "./CheckAbsenceRoutes";
import { authenticate } from "../middlewares/AuthMiddleware";
import upload from "../middlewares/upload";

const router = Router();

router.get("/all", authenticate, VenueController.getAll);
router.get("/get/:id", authenticate, VenueController.getById);
router.get("/search", authenticate, VenueController.searchVenues);
router.get("/count", authenticate, VenueController.getVenueCount);
router.post(
  "/add",
  authenticate,
  upload.fields([
    { name: "mainPhoto", maxCount: 1 },
    { name: "subPhotos", maxCount: 2 },
  ]),
  VenueController.create
);
router.get("/manager-venues", authenticate, VenueController.getByManagerId);
router.put("/update/:id", authenticate, VenueController.update);
router.delete("/remove/:id", authenticate, VenueController.delete);
router.get("/venue-approximately", authenticate, VenueController.getVenuesByProximity);
router.post(
  "/assign-manager",
  authenticate,
  VenueController.assignManagerToVenue
);
router.post(
  "/:venueId/resources",
  authenticate,
  VenueController.addResourcesToVenue
);
router.delete(
  "/:venueId/resources/:resourceId",
  authenticate,
  VenueController.removeResourceFromVenue
);
router.get(
  ":venueId/resources",
  authenticate,
  VenueController.getVenueResources
);
router.post("/add-with-resources", authenticate, VenueController.create);
router.get(
  "/approved-venues",
  authenticate,
  VenueController.listApprovedVenues
);
router.put(
  "/update-manager/:id",
  authenticate,
  VenueController.updateVenueManager
);
router.put(
  "/remove-manager/:id",
  authenticate,
  isAdmin,
  VenueController.removeVenueManager
);

router.get(
  "/available-venues",
  authenticate,
  VenueController.checkAvailability
);

router.post("/approve/:id", authenticate, VenueController.approveVenue);
router.post("/cancel/:id", authenticate, VenueController.cancelVenue);

router.get("/:venueId/events", authenticate, VenueController.getEventsByVenue);

router.get("/public-approved-events", VenueController.listPublicApprovedEvents);

router.get("/event-types", VenueController.listEventTypes);
router.get("/venue-conflicts", VenueController.checkVenueEventConflicts);
router.get("/with-approved-events", VenueController.getVenuesWithApprovedEvents);
// router.use("/", checkAbsenceRoutes);
router.get("/with-approved-events-via-bookings", VenueController.getVenuesWithApprovedEventsViaBookings);


export const venueRoute = router;
