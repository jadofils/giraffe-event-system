import { Router } from "express";
import { VenueController } from "../controller/venueController";
import { isAdmin } from "../middlewares/IsAdmin";
import checkAbsenceRoutes from "./CheckAbsenceRoutes";
import { authenticate } from "../middlewares/AuthMiddleware";

const router = Router();

router.get("/all", authenticate, VenueController.getAll);
router.get("/get/:id", authenticate, VenueController.getById);
router.get("/search", authenticate, VenueController.searchVenues);
router.get("/count", authenticate, VenueController.getVenueCount);
router.post("/add", authenticate, VenueController.create);
router.get("/manager-venues", authenticate, VenueController.getByManagerId);
router.put("/update/:id", authenticate, VenueController.update);
router.delete("/remove/:id", authenticate, VenueController.delete);
router.post("/assign-manager", authenticate, VenueController.assignManagerToVenue);
router.post("/:venueId/resources", authenticate, VenueController.addResourcesToVenue);
router.delete("/:venueId/resources/:resourceId", authenticate, VenueController.removeResourceFromVenue);
router.get(":venueId/resources", authenticate, VenueController.getVenueResources);
router.post('/add-with-resources', authenticate, VenueController.createVenueWithResources);
router.put("/update-manager/:id", authenticate, VenueController.updateVenueManager);
router.put("/remove-manager/:id", isAdmin, VenueController.removeVenueManager);
router.use("/", checkAbsenceRoutes);

export const venueRoute = router;
