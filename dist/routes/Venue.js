"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.venueRoute = void 0;
const express_1 = require("express");
const venueController_1 = require("../controller/venueController");
const IsAdmin_1 = require("../middlewares/IsAdmin");
// import checkAbsenceRoutes from "./CheckAbsenceRoutes";
const AuthMiddleware_1 = require("../middlewares/AuthMiddleware");
const upload_1 = __importDefault(require("../middlewares/upload"));
const router = (0, express_1.Router)();
router.get("/all", AuthMiddleware_1.authenticate, venueController_1.VenueController.getAll);
router.get("/get/:id", AuthMiddleware_1.authenticate, venueController_1.VenueController.getById);
router.get("/search", AuthMiddleware_1.authenticate, venueController_1.VenueController.searchVenues);
router.get("/count", AuthMiddleware_1.authenticate, venueController_1.VenueController.getVenueCount);
router.post("/add", AuthMiddleware_1.authenticate, upload_1.default.fields([
    { name: "mainPhoto", maxCount: 1 },
    { name: "subPhotos", maxCount: 2 },
]), venueController_1.VenueController.create);
router.get("/manager-venues", AuthMiddleware_1.authenticate, venueController_1.VenueController.getByManagerId);
router.put("/update/:id", AuthMiddleware_1.authenticate, venueController_1.VenueController.update);
router.delete("/remove/:id", AuthMiddleware_1.authenticate, venueController_1.VenueController.delete);
router.get("/venue-approximately", AuthMiddleware_1.authenticate, venueController_1.VenueController.getVenuesByProximity);
router.post("/assign-manager", AuthMiddleware_1.authenticate, venueController_1.VenueController.assignManagerToVenue);
router.post("/:venueId/resources", AuthMiddleware_1.authenticate, venueController_1.VenueController.addResourcesToVenue);
router.delete("/:venueId/resources/:resourceId", AuthMiddleware_1.authenticate, venueController_1.VenueController.removeResourceFromVenue);
router.get(":venueId/resources", AuthMiddleware_1.authenticate, venueController_1.VenueController.getVenueResources);
router.post("/add-with-resources", AuthMiddleware_1.authenticate, venueController_1.VenueController.create);
router.get("/approved-venues", AuthMiddleware_1.authenticate, venueController_1.VenueController.listApprovedVenues);
router.put("/update-manager/:id", AuthMiddleware_1.authenticate, venueController_1.VenueController.updateVenueManager);
router.put("/remove-manager/:id", AuthMiddleware_1.authenticate, IsAdmin_1.isAdmin, venueController_1.VenueController.removeVenueManager);
router.get("/available-venues", AuthMiddleware_1.authenticate, venueController_1.VenueController.checkAvailability);
router.post("/approve/:id", AuthMiddleware_1.authenticate, venueController_1.VenueController.approveVenue);
router.post("/cancel/:id", AuthMiddleware_1.authenticate, venueController_1.VenueController.cancelVenue);
router.get("/:venueId/events", AuthMiddleware_1.authenticate, venueController_1.VenueController.getEventsByVenue);
router.get("/public-approved-events", venueController_1.VenueController.listPublicApprovedEvents);
router.get("/event-types", venueController_1.VenueController.listEventTypes);
router.get("/venue-conflicts", venueController_1.VenueController.checkVenueEventConflicts);
router.get("/with-approved-events", venueController_1.VenueController.getVenuesWithApprovedEvents);
// router.use("/", checkAbsenceRoutes);
router.get("/with-approved-events-via-bookings", venueController_1.VenueController.getVenuesWithApprovedEventsViaBookings);
exports.venueRoute = router;
