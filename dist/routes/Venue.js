"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.venueRoute = void 0;
const express_1 = require("express");
const venueController_1 = require("../controller/venueController");
const IsAdmin_1 = require("../middlewares/IsAdmin"); // Assuming this checks for 'admin' role
const AuthMiddleware_1 = require("../middlewares/AuthMiddleware"); // Assuming this checks if a user is logged in
const CheckAbsenceRoutes_1 = __importDefault(require("./CheckAbsenceRoutes")); // <--- ADD THIS IMPORT
const router = (0, express_1.Router)();
// --- Public Routes (No Authentication Required) ---
/**
 * @route GET /api/venues/all
 * @description Get all venues.
 * @access Public
 */
router.get("/all", venueController_1.VenueController.getAll);
/**
 * @route GET /api/venues/get/:id
 * @description Get a single venue by its ID.
 * @access Public
 */
router.get("/get/:id", venueController_1.VenueController.getById);
/**
 * @route GET /api/venues/search
 * @description Search for venues based on various criteria (name, location, capacity, availability).
 * @access Public
 * @queryParam name (string, optional)
 * @queryParam location (string, optional)
 * @queryParam minCapacity (number, optional)
 * @queryParam maxCapacity (number, optional)
 * @queryParam isAvailable (boolean, optional, 'true' or 'false')
 * @queryParam hasManager (boolean, optional, 'true' or 'false')
 */
router.get("/search", venueController_1.VenueController.searchVenues);
/**
 * @route GET /api/venues/count
 * @description Get the total count of active venues.
 * @access Public
 */
router.get("/count", venueController_1.VenueController.getVenueCount);
// --- Authenticated Routes (Requires User Login) ---
/**
 * @route POST /api/venues/add
 * @description Create a new venue.
 * @access Authenticated (e.g., Admin, Venue Manager) - Consider adding specific role check if needed
 */
router.post("/add", AuthMiddleware_1.authenticate, venueController_1.VenueController.create); // Assuming authenticate handles `req.user`
/**
 * @route GET /api/venues/manager-venues
 * @description Get venues managed by the authenticated user.
 * @access Authenticated (Venue Manager)
 */
router.get("/manager-venues", AuthMiddleware_1.authenticate, venueController_1.VenueController.getByManagerId);
/**
 * @route PUT /api/venues/update/:id
 * @description Update an existing venue by its ID.
 * @access Authenticated (Admin or Venue Manager who owns the venue) - Requires careful authorization logic in controller.
 */
router.put("/update/:id", AuthMiddleware_1.authenticate, venueController_1.VenueController.update);
/**
 * @route DELETE /api/venues/remove/:id
 * @description Soft-delete a venue by its ID.
 * @access Authenticated (Admin or authorized Venue Manager)
 */
router.delete("/remove/:id", AuthMiddleware_1.authenticate, venueController_1.VenueController.delete);
// --- Admin-Only Routes (Requires Admin Role) ---
/**
 * @route PUT /api/venues/update-manager/:id
 * @description Update the manager of a specific venue.
 * @access Admin only
 * @body { "managerId": "uuid" }
 */
router.put("/update-manager/:id", IsAdmin_1.isAdmin, venueController_1.VenueController.updateVenueManager);
/**
 * @route PUT /api/venues/remove-manager/:id
 * @description Remove the manager from a specific venue.
 * @access Admin only
 */
router.put("/remove-manager/:id", IsAdmin_1.isAdmin, venueController_1.VenueController.removeVenueManager);
router.use('/', CheckAbsenceRoutes_1.default); // <--- ADD THIS LINE
exports.venueRoute = router;
