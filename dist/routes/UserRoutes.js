"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.userRoutes = void 0;
const express_1 = require("express");
const Registration_1 = require("../controller/user/Registration");
const Login_1 = require("../controller/user/Login");
const AuthMiddleware_1 = require("../middlewares/AuthMiddleware");
const ResetDefaultPassword_1 = require("../controller/user/ResetDefaultPassword");
const router = (0, express_1.Router)();
// Public Authentication Routes
// Grouped by user journey: registration, login, password reset
router.post("/auth/register", Registration_1.UserController.register); // 1. Register a new user
router.post("/auth/login/default", Login_1.LoginController.loginWithDefaultPassword); // 2. Login with default password sent via email
router.post("/auth/reset", ResetDefaultPassword_1.ResetPasswordController.resetPassword); // 3. Reset password after default login
router.post("/auth/login", Login_1.LoginController.login); // 4. Login with new or standard password
router.post("/auth/forgot", ResetDefaultPassword_1.ResetPasswordController.forgotPasswordLink); // 5. Request password reset link if password forgotten
router.post("/auth/reset/resend", ResetDefaultPassword_1.ResetPasswordController.resendPasswordResetEmail); // 6. Resend password reset email if needed
// Deprecated: Insecure, use /auth/forgot and /auth/reset instead
//router.post("/auth/forgot/identifier", ResetPasswordController.forgotPasswordLinkByUsernameOrEmail); // 7. Deprecated password reset method
// Protected Routes (require authentication)
// Apply authentication middleware
router.use(AuthMiddleware_1.authenticate);
// User Profile Routes (individual user actions)
router.get("/profile", Registration_1.UserController.getProfile); // Get current user's profile
router.put("/profile", Registration_1.UserController.updateProfile); // Update current user's profile
// User Management Routes (admin-level, RESTful order)
router.get("/", Registration_1.UserController.getAllUsers); // List all users
router.get("/:id", Registration_1.UserController.getUserById); // Get specific user by ID
router.put("/:id", Registration_1.UserController.updateUser); // Update specific user
router.delete("/:id", Registration_1.UserController.deleteUser); // Delete specific user
// Role Management Routes (specific actions)
router.post("/assign-role", Registration_1.UserController.updateDefaultUserRole); // Assign default role to user
router.post("/:userId/role", Registration_1.UserController.updateAssignedUserRole); // Update role for specific user
exports.userRoutes = router;
