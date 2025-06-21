"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.userRoutes = void 0;
const express_1 = require("express");
const Registration_1 = require("../controller/user/Registration");
const Login_1 = require("../controller/user/Login");
const ResetDefaultPassword_1 = require("../controller/user/ResetDefaultPassword");
const AuthMiddleware_1 = require("../middlewares/AuthMiddleware");
const router = (0, express_1.Router)();
// =======================
// 📂 Public Routes
// =======================
router.post("/auth/register", Registration_1.UserController.register);
router.post("/auth/login/default", Login_1.LoginController.loginWithDefaultPassword);
router.post("/auth/reset", ResetDefaultPassword_1.ResetPasswordController.resetPassword);
router.post("/auth/login", Login_1.LoginController.login);
router.post("/auth/forgot", ResetDefaultPassword_1.ResetPasswordController.forgotPasswordLink);
router.post("/auth/reset/resend", ResetDefaultPassword_1.ResetPasswordController.resendPasswordResetEmail);
// router.post("/auth/forgot/identifier", ResetPasswordController.forgotPasswordLinkByUsernameOrEmail); // deprecated
// =======================
// 🔒 Protected Routes
// =======================
router.use(AuthMiddleware_1.authenticate);
// User Profile
router.get("/profile", Registration_1.UserController.getProfile);
router.put("/profile", Registration_1.UserController.updateProfile);
// User Management
router.get("/", Registration_1.UserController.getAllUsers);
router.get("/:id", Registration_1.UserController.getUserById);
router.put("/:id", Registration_1.UserController.updateUser);
router.delete("/:id", Registration_1.UserController.deleteUser);
// Role Management
router.post("/assign-role", Registration_1.UserController.updateDefaultUserRole);
router.post("/:userId/role", Registration_1.UserController.updateAssignedUserRole);
exports.userRoutes = router;
