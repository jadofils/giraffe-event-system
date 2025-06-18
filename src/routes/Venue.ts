import { Router } from "express";
import { VenueController } from "../controller/venueController";
import { isAdmin } from "../middlewares/IsAdmin"; // Assuming this checks for 'admin' role
import { authenticate } from "../middlewares/AuthMiddleware"; // Assuming this checks if a user is logged in
import checkAbsenceRoutes from './CheckAbsenceRoutes'; // <--- ADD THIS IMPORT

const router = Router();

// --- Public Routes (No Authentication Required) ---

/**
 * @route GET /api/venues/all
 * @description Get all venues.
 * @access Public
 */
router.get("/all", VenueController.getAll);

/**
 * @route GET /api/venues/get/:id
 * @description Get a single venue by its ID.
 * @access Public
 */
router.get("/get/:id", VenueController.getById);

/**
 * @route GET /api/venues/search
 * @description Search for venues based on various criteria.
 * @access Public
 */
router.get("/search", VenueController.searchVenues);

/**
 * @route GET /api/venues/count
 * @description Get the total count of active venues.
 * @access Public
 */
router.get("/count", VenueController.getVenueCount);

/**
 * @route GET /api/venues/conflicts
 * @description Check for venue event availability conflicts.
 * @access Public
 */
router.get("/conflicts", VenueController.checkVenueEventConflicts);

/**
 * @route GET /api/venues/proximity
 * @description Retrieve venues within a specified geographic radius.
 * @access Public
 */
router.get("/proximity", VenueController.getVenuesByProximity);

/**
 * @route GET /api/venues/:venueId/bookings
 * @description Retrieve all bookings for a specific venue.
 * @access Public
 */
router.get("/:venueId/bookings", VenueController.getBookingsByVenue);

// --- Authenticated Routes (Requires User Login) ---

/**
 * @route POST /api/venues/add
 * @description Create a new venue.
 * @access Authenticated
 */
router.post("/add", authenticate, VenueController.create);

/**
 * @route POST /api/venues/bulk
 * @description Create multiple venues in bulk.
 * @access Authenticated
 */
router.post("/bulk", authenticate, VenueController.createMultiple);

/**
 * @route GET /api/venues/manager-venues
 * @description Get venues managed by the authenticated user.
 * @access Authenticated
 */
router.get("/manager-venues", authenticate, VenueController.getByManagerId);

/**
 * @route PUT /api/venues/update/:id
 * @description Update an existing venue by its ID.
 * @access Authenticated
 */
router.put("/update/:id", authenticate, VenueController.update);

/**
 * @route DELETE /api/venues/remove/:id
 * @description Soft-delete a venue by its ID.
 * @access Authenticated
 */
router.delete("/remove/:id", authenticate, VenueController.delete);

/**
 * @route POST /api/venues/restore/:id
 * @description Restore a soft-deleted venue.
 * @access Authenticated
 */
router.post("/restore/:id", authenticate, VenueController.restore);

/**
 * @route GET /api/venues/deleted
 * @description Get all soft-deleted venues.
 * @access Authenticated
 */
router.get("/deleted", authenticate, VenueController.getDeleted);

// --- Admin-Only Routes (Requires Admin Role) ---

/**
 * @route PUT /api/venues/update-manager
 * @description Update the manager of a specific venue.
 * @access Admin only
 */
router.put("/update-manager", isAdmin, VenueController.updateVenueManager);

/**
 * @route DELETE /api/venues/remove-manager/:venueId
 * @description Remove the manager from a specific venue.
 * @access Admin only
 */
router.delete("/remove-manager/:venueId", isAdmin, VenueController.removeVenueManager);

router.use('/', checkAbsenceRoutes); // <--- ADD THIS LINE

export const venueRoute = router;