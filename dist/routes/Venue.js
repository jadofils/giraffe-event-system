"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.venueRoute = void 0;
const express_1 = require("express");
const venueController_1 = require("../controller/venueController");
// import checkAbsenceRoutes from "./CheckAbsenceRoutes";
const AuthMiddleware_1 = require("../middlewares/AuthMiddleware");
const upload_1 = __importDefault(require("../middlewares/upload"));
const router = (0, express_1.Router)();
router.post("/add", AuthMiddleware_1.authenticate, upload_1.default.fields([
    { name: "mainPhoto", maxCount: 1 },
    { name: "photoGallery", maxCount: 10 },
    { name: "virtualTour", maxCount: 1 },
]), venueController_1.VenueController.create);
router.get("/all", AuthMiddleware_1.authenticate, venueController_1.VenueController.getAllVenuesWithManagers);
router.get("/:id", AuthMiddleware_1.authenticate, venueController_1.VenueController.getVenueById);
router.get("/organizations/:organizationId/venues", AuthMiddleware_1.authenticate, venueController_1.VenueController.getVenuesByOrganization);
router.get("/managers/:managerId/venues", AuthMiddleware_1.authenticate, venueController_1.VenueController.getVenuesByManager);
router.get("/:venueId/amenities", AuthMiddleware_1.authenticate, venueController_1.VenueController.getVenueAmenities);
router.get("/:venueId/booking-conditions", AuthMiddleware_1.authenticate, venueController_1.VenueController.getVenueBookingConditions);
router.get("/:venueId/variables", AuthMiddleware_1.authenticate, venueController_1.VenueController.getVenueVariables);
router.get("/:venueId/amenities/:amenityId", AuthMiddleware_1.authenticate, venueController_1.VenueController.getVenueAmenityById);
router.get("/:venueId/booking-conditions/:conditionId", AuthMiddleware_1.authenticate, venueController_1.VenueController.getVenueBookingConditionById);
router.get("/:venueId/variables/:variableId", AuthMiddleware_1.authenticate, venueController_1.VenueController.getVenueVariableById);
router.put("/:venueId/amenities", AuthMiddleware_1.authenticate, venueController_1.VenueController.updateVenueAmenities);
router.put("/:venueId/booking-conditions", AuthMiddleware_1.authenticate, venueController_1.VenueController.updateVenueBookingConditions);
router.put("/:venueId/variables", AuthMiddleware_1.authenticate, venueController_1.VenueController.updateVenueVariables);
router.put("/:venueId/amenities/:amenityId", AuthMiddleware_1.authenticate, venueController_1.VenueController.updateVenueAmenityById);
router.put("/:venueId/booking-conditions/:conditionId", AuthMiddleware_1.authenticate, venueController_1.VenueController.updateVenueBookingConditionById);
router.put("/:venueId/variables/:variableId", AuthMiddleware_1.authenticate, venueController_1.VenueController.updateVenueVariableById);
router.post("/:venueId/amenities", AuthMiddleware_1.authenticate, venueController_1.VenueController.addVenueAmenity);
router.delete("/:venueId/amenities/:amenityId", AuthMiddleware_1.authenticate, venueController_1.VenueController.removeVenueAmenity);
router.patch("/:id/approve", AuthMiddleware_1.authenticate, venueController_1.VenueController.approveVenue);
router.patch("/:id/approve-public", AuthMiddleware_1.authenticate, venueController_1.VenueController.approveVenuePublic);
router.patch("/:id/reject", AuthMiddleware_1.authenticate, venueController_1.VenueController.rejectVenue);
// General venue update
router.patch("/:id", AuthMiddleware_1.authenticate, venueController_1.VenueController.updateGeneralFields);
// Main photo update
router.patch("/:id/main-photo", AuthMiddleware_1.authenticate, upload_1.default.single("mainPhoto"), venueController_1.VenueController.updateMainPhoto);
// Add photo to gallery
router.post("/:id/photo-gallery", AuthMiddleware_1.authenticate, upload_1.default.single("photo"), venueController_1.VenueController.addPhotoToGallery);
// Remove photo from gallery
router.delete("/:id/photo-gallery", AuthMiddleware_1.authenticate, venueController_1.VenueController.removePhotoFromGallery);
// Virtual tour update
router.patch("/:id/virtual-tour", AuthMiddleware_1.authenticate, upload_1.default.single("virtualTour"), venueController_1.VenueController.updateVirtualTour);
exports.venueRoute = router;
