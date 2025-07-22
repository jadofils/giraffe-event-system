"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.organizationRoutes = void 0;
// src/routes/organizationRoutes.ts
const express_1 = require("express");
const OrganizationController_1 = require("../controller/OrganizationController");
const AuthMiddleware_1 = require("../middlewares/AuthMiddleware");
const upload_1 = __importDefault(require("../middlewares/upload"));
const router = (0, express_1.Router)();
// Public endpoints
router.get("/public", OrganizationController_1.OrganizationController.getAllPublicOrganizations);
// Protected endpoints
router.get("/all", AuthMiddleware_1.authenticate, OrganizationController_1.OrganizationController.getAll);
router.get("/user/:userId", AuthMiddleware_1.authenticate, OrganizationController_1.OrganizationController.getOrganizationsByUserId);
router.get("/:id", AuthMiddleware_1.authenticate, OrganizationController_1.OrganizationController.getById);
// Update the POST / route to accept both 'supportingDocument' and 'logo' files
router.post("/", AuthMiddleware_1.authenticate, upload_1.default.fields([
    { name: "supportingDocument", maxCount: 1 },
    { name: "logo", maxCount: 1 },
]), OrganizationController_1.OrganizationController.create);
router.put("/:id", AuthMiddleware_1.authenticate, OrganizationController_1.OrganizationController.update);
router.delete("/:id", AuthMiddleware_1.authenticate, OrganizationController_1.OrganizationController.delete);
router.post("/:id/users", AuthMiddleware_1.authenticate, OrganizationController_1.OrganizationController.assignUsers);
router.delete("/:id/users", AuthMiddleware_1.authenticate, OrganizationController_1.OrganizationController.removeUsers);
router.get("/:id/users", AuthMiddleware_1.authenticate, OrganizationController_1.OrganizationController.getUsers);
// Venue management routes
router.post("/:organizationId/venues", AuthMiddleware_1.authenticate, OrganizationController_1.OrganizationController.addVenues);
router.delete("/:organizationId/venues", AuthMiddleware_1.authenticate, OrganizationController_1.OrganizationController.removeVenues);
router.get("/:organizationId/venues", AuthMiddleware_1.authenticate, OrganizationController_1.OrganizationController.getOrganizationVenues);
router.patch("/:id/approve", AuthMiddleware_1.authenticate, OrganizationController_1.OrganizationController.approve);
router.patch("/:id/reject", AuthMiddleware_1.authenticate, OrganizationController_1.OrganizationController.reject);
// Add PATCH /organizations/:id/logo for updating only the logo
router.patch("/:id/logo", AuthMiddleware_1.authenticate, upload_1.default.single("logo"), OrganizationController_1.OrganizationController.updateLogo);
// Add PATCH /organizations/:id/supporting-document for updating only the supporting document
router.patch("/:id/supporting-document", AuthMiddleware_1.authenticate, upload_1.default.single("supportingDocument"), OrganizationController_1.OrganizationController.updateSupportingDocument);
router.patch("/:id/enable-status", AuthMiddleware_1.authenticate, OrganizationController_1.OrganizationController.enableStatus);
router.patch("/:id/disable-status", AuthMiddleware_1.authenticate, OrganizationController_1.OrganizationController.disableStatus);
exports.organizationRoutes = router;
