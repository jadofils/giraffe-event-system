"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.organizationRoutes = void 0;
// src/routes/organizationRoutes.ts
const express_1 = require("express");
const AuthMiddleware_1 = require("../middlewares/AuthMiddleware");
const OrganizationController_1 = require("../controller/OrganizationController");
const router = (0, express_1.Router)();
router.get("/", AuthMiddleware_1.authenticate, OrganizationController_1.OrganizationController.getAll);
router.get("/:id", AuthMiddleware_1.authenticate, OrganizationController_1.OrganizationController.getById);
router.post("/", AuthMiddleware_1.authenticate, OrganizationController_1.OrganizationController.create);
router.post("/bulk", AuthMiddleware_1.authenticate, OrganizationController_1.OrganizationController.bulkCreate);
router.put("/:id", AuthMiddleware_1.authenticate, OrganizationController_1.OrganizationController.update);
router.put("/bulk", AuthMiddleware_1.authenticate, OrganizationController_1.OrganizationController.bulkUpdate);
router.delete("/:id", AuthMiddleware_1.authenticate, OrganizationController_1.OrganizationController.delete);
router.post("/:id/users", AuthMiddleware_1.authenticate, OrganizationController_1.OrganizationController.assignUsers);
router.delete("/:id/users", AuthMiddleware_1.authenticate, OrganizationController_1.OrganizationController.removeUsers);
router.get("/:id/users", AuthMiddleware_1.authenticate, OrganizationController_1.OrganizationController.getUsers);
exports.organizationRoutes = router;
