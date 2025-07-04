"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.organizationRoutes = void 0;
// src/routes/organizationRoutes.ts
const express_1 = require("express");
const OrganizationController_1 = require("../controller/OrganizationController");
const AuthMiddleware_1 = require("../middlewares/AuthMiddleware");
const router = (0, express_1.Router)();
router.get("/all", AuthMiddleware_1.authenticate, OrganizationController_1.OrganizationController.getAll);
router.get("/:id", AuthMiddleware_1.authenticate, OrganizationController_1.OrganizationController.getById);
router.post("/bulk", AuthMiddleware_1.authenticate, OrganizationController_1.OrganizationController.bulkCreate);
router.put("/:id", AuthMiddleware_1.authenticate, OrganizationController_1.OrganizationController.update);
router.delete("/:id", AuthMiddleware_1.authenticate, OrganizationController_1.OrganizationController.delete);
router.post("/:id/users", AuthMiddleware_1.authenticate, OrganizationController_1.OrganizationController.assignUsers);
router.delete("/:id/users", AuthMiddleware_1.authenticate, OrganizationController_1.OrganizationController.removeUsers);
router.get("/:id/users", AuthMiddleware_1.authenticate, OrganizationController_1.OrganizationController.getUsers);
// Venue management routes
router.post("/:organizationId/venues", AuthMiddleware_1.authenticate, OrganizationController_1.OrganizationController.addVenues);
router.delete("/:organizationId/venues", AuthMiddleware_1.authenticate, OrganizationController_1.OrganizationController.removeVenues);
router.get("/:organizationId/venues", AuthMiddleware_1.authenticate, OrganizationController_1.OrganizationController.getOrganizationVenues);
exports.organizationRoutes = router;
