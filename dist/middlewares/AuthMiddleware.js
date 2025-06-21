"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.isAuthenticatedRequest = exports.authenticate = void 0;
const express_1 = require("express");
const venueController_1 = require("../controller/venueController");
const IsAdmin_1 = require("../middlewares/IsAdmin");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const Database_1 = require("../config/Database");
const User_1 = require("../models/User");
const SECRET_KEY = process.env.JWT_SECRET || "your_jwt_secret";
// Authentication middleware - accepts standard Request and augments it
const authenticate = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d;
    const authHeader = req.headers.authorization;
    const token = authHeader === null || authHeader === void 0 ? void 0 : authHeader.split(" ")[1];
    if (!token) {
        console.log("Access denied: No token provided.");
        res.status(401).json({
            success: false,
            message: "Access denied. No token provided.",
        });
        return;
    }
    try {
        const decoded = jsonwebtoken_1.default.verify(token, SECRET_KEY);
        console.log("Decoded JWT:", decoded);
        // If role and permissions are present in the token, use them directly
        if (decoded.role && decoded.role.permissions) {
            req.user = {
                id: decoded.userId,
                userId: decoded.userId,
                email: decoded.email,
                username: decoded.username,
                organizations: decoded.organizations || [],
                organizationId: decoded.organizationId,
                roles: [{
                        roleName: decoded.role.roleName,
                        permissions: decoded.role.permissions.map((p) => p.name),
                    }],
                role: decoded.role,
                isAdmin: decoded.role.roleName === "ADMIN",
            };
            console.log("req.user populated from token:", req.user);
            return next();
        }
        // Fallback: fetch from DB if not present in token
        const userRepository = Database_1.AppDataSource.getRepository(User_1.User);
        const user = yield userRepository.findOne({
            where: { userId: decoded.userId },
            relations: ["role", "role.permissions", "organizations"],
        });
        if (!user) {
            console.warn(`Invalid token: User ${decoded.userId} not found.`);
            res.status(401).json({
                success: false,
                message: "Invalid token: User not found in database.",
            });
            return;
        }
        const organizations = ((_a = user.organizations) === null || _a === void 0 ? void 0 : _a.map(org => ({
            organizationId: org.organizationId,
            organizationName: org.organizationName,
            description: org.description,
            contactEmail: org.contactEmail,
            contactPhone: org.contactPhone,
            address: org.address,
            organizationType: org.organizationType,
            city: org.city,
            country: org.country,
            postalCode: org.postalCode,
            stateProvince: org.stateProvince,
        }))) || [];
        const isAdmin = ((_c = (_b = user.role) === null || _b === void 0 ? void 0 : _b.roleName) === null || _c === void 0 ? void 0 : _c.toLowerCase()) === "admin";
        const mappedRole = user.role
            ? {
                roleId: user.role.roleId,
                roleName: user.role.roleName,
                description: user.role.description,
                createdAt: user.role.createdAt,
                updatedAt: user.role.updatedAt,
                deletedAt: user.role.deletedAt,
                permissions: user.role.permissions || [],
                users: [], // or user.role.users if you want to include them
                isAdmin,
            }
            : undefined;
        // Augment the request object with user data
        req.user = Object.assign(Object.assign({}, user), { id: user.userId, userId: decoded.userId, email: decoded.email, username: decoded.username, organizations, organizationId: decoded.organizationId, role: mappedRole, isAdmin, roles: user.role
                ? [{
                        roleName: user.role.roleName,
                        permissions: ((_d = user.role.permissions) === null || _d === void 0 ? void 0 : _d.map(p => p.name)) || [],
                    }]
                : [], socialMediaLinks: user.socialMediaLinks && typeof user.socialMediaLinks === 'object'
                ? Object.fromEntries(Object.entries(user.socialMediaLinks).filter(([k, v]) => typeof v === 'string'))
                : undefined });
        console.log("req.user populated:", req.user);
        next();
    }
    catch (err) {
        console.error("JWT verification error:", err);
        if (err instanceof jsonwebtoken_1.default.TokenExpiredError) {
            res.status(401).json({ success: false, message: "Token expired. Please log in again." });
        }
        else if (err instanceof jsonwebtoken_1.default.JsonWebTokenError) {
            res.status(401).json({ success: false, message: "Invalid token. Please log in again." });
        }
        else {
            res.status(500).json({ success: false, message: "Authentication failed due to server error." });
        }
    }
});
exports.authenticate = authenticate;
// Type guard to check if request has authenticated user
const isAuthenticatedRequest = (req) => {
    return 'user' in req && req.user !== undefined;
};
exports.isAuthenticatedRequest = isAuthenticatedRequest;
const router = (0, express_1.Router)();
// Get all venues
router.get("/all", exports.authenticate, venueController_1.VenueController.getAll);
// Get venue by ID
router.get("/get/:id", exports.authenticate, venueController_1.VenueController.getById);
// Search venues
router.get("/search", exports.authenticate, venueController_1.VenueController.searchVenues);
// Get venue count
router.get("/count", exports.authenticate, venueController_1.VenueController.getVenueCount);
// Create venue
router.post("/add", exports.authenticate, venueController_1.VenueController.create);
// Get venues by manager ID
router.get("/manager-venues", exports.authenticate, venueController_1.VenueController.getByManagerId);
// Update venue
router.put("/update/:id", exports.authenticate, venueController_1.VenueController.update);
// Delete venue
router.delete("/remove/:id", exports.authenticate, venueController_1.VenueController.delete);
// Assign manager to venue
router.post("/assign-manager", exports.authenticate, venueController_1.VenueController.assignManagerToVenue);
// Add resources to venue
router.post("/:venueId/resources", exports.authenticate, venueController_1.VenueController.addResourcesToVenue);
// Remove resource from venue
router.delete("/:venueId/resources/:resourceId", exports.authenticate, venueController_1.VenueController.removeResourceFromVenue);
// Get venue resources
router.get("/:venueId/resources", exports.authenticate, venueController_1.VenueController.getVenueResources);
// Create venue with resources
router.post('/add-with-resources', exports.authenticate, venueController_1.VenueController.createVenueWithResources);
// Update venue manager
router.put("/update-manager/:id", exports.authenticate, venueController_1.VenueController.updateVenueManager);
// Remove venue manager
router.put("/remove-manager/:id", IsAdmin_1.isAdmin, venueController_1.VenueController.removeVenueManager);
//router.use("/", checkAbsenceRoutes);
exports.default = router;
