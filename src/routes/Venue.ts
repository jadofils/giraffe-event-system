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
 * @description Search for venues based on various criteria (name, location, capacity, availability).
 * @access Public
 * @queryParam name (string, optional)
 * @queryParam location (string, optional)
 * @queryParam minCapacity (number, optional)
 * @queryParam maxCapacity (number, optional)
 * @queryParam isAvailable (boolean, optional, 'true' or 'false')
 * @queryParam hasManager (boolean, optional, 'true' or 'false')
 */
router.get("/search", VenueController.searchVenues);

/**
 * @route GET /api/venues/count
 * @description Get the total count of active venues.
 * @access Public
 */
router.get("/count", VenueController.getVenueCount);


// --- Authenticated Routes (Requires User Login) ---

/**
 * @route POST /api/venues/add
 * @description Create a new venue.
 * @access Authenticated (e.g., Admin, Venue Manager) - Consider adding specific role check if needed
 */
router.post("/add", authenticate, VenueController.create); // Assuming authenticate handles `req.user`

/**
 * @route GET /api/venues/manager-venues
 * @description Get venues managed by the authenticated user.
 * @access Authenticated (Venue Manager)
 */
router.get("/manager-venues", authenticate, VenueController.getByManagerId);

/**
 * @route PUT /api/venues/update/:id
 * @description Update an existing venue by its ID.
 * @access Authenticated (Admin or Venue Manager who owns the venue) - Requires careful authorization logic in controller.
 */
router.put("/update/:id", authenticate, VenueController.update);

/**
 * @route DELETE /api/venues/remove/:id
 * @description Soft-delete a venue by its ID.
 * @access Authenticated (Admin or authorized Venue Manager)
 */
router.delete("/remove/:id", authenticate, VenueController.delete);


// --- Admin-Only Routes (Requires Admin Role) ---

/**
 * @route PUT /api/venues/update-manager/:id
 * @description Update the manager of a specific venue.
 * @access Admin only
 * @body { "managerId": "uuid" }
 */
router.put("/update-manager/:id", isAdmin, VenueController.updateVenueManager);

/**
 * @route PUT /api/venues/remove-manager/:id
 * @description Remove the manager from a specific venue.
 * @access Admin only
 */
router.put("/remove-manager/:id", isAdmin, VenueController.removeVenueManager);
router.use('/', checkAbsenceRoutes); // <--- ADD THIS LINE


export const venueRoute = router;