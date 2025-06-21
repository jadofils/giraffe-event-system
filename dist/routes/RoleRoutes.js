"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const RoleController_1 = require("../controller/RoleController");
const AuthMiddleware_1 = require("../middlewares/AuthMiddleware"); // Make sure this is imported
const router = (0, express_1.Router)();
// =======================
// 🔒 Protected Role Management Routes
// =======================
router.use(AuthMiddleware_1.authenticate);
router.post("/", RoleController_1.RoleController.create);
router.get("/", RoleController_1.RoleController.getAll);
router.get("/:id", RoleController_1.RoleController.getById);
router.put("/:id", RoleController_1.RoleController.update);
router.delete("/:id", RoleController_1.RoleController.deleteById);
router.post("/search-by-name", RoleController_1.RoleController.getRolesByName);
exports.default = router;
