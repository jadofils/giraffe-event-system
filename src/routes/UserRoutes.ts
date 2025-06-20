import { Router } from "express";
import { UserController } from "../controller/user/Registration";
import { LoginController } from "../controller/user/Login";
import {  } from "../middlewares/AuthMiddleware";
import { ResetPasswordController } from "../controller/user/ResetDefaultPassword";

const router = Router();

// Public Authentication Routes
// Grouped by user journey: registration, login, password reset
router.post("/auth/register", UserController.register); // 1. Register a new user
router.post("/auth/login/default", LoginController.loginWithDefaultPassword); // 2. Login with default password sent via email
router.post("/auth/reset", ResetPasswordController.resetPassword); // 3. Reset password after default login
router.post("/auth/login", LoginController.login); // 4. Login with new or standard password
router.post("/auth/forgot", ResetPasswordController.forgotPasswordLink); // 5. Request password reset link if password forgotten
router.post("/auth/reset/resend", ResetPasswordController.resendPasswordResetEmail); // 6. Resend password reset email if needed
// Deprecated: Insecure, use /auth/forgot and /auth/reset instead
//router.post("/auth/forgot/identifier", ResetPasswordController.forgotPasswordLinkByUsernameOrEmail); // 7. Deprecated password reset method

// Protected Routes (require authentication)
// Apply authentication middleware
//router.use();

// User Profile Routes (individual user actions)
router.get("/profile", UserController.getProfile); // Get current user's profile
router.put("/profile", UserController.updateProfile); // Update current user's profile

// User Management Routes (admin-level, RESTful order)
router.get("/", UserController.getAllUsers); // List all users
router.get("/:id", UserController.getUserById); // Get specific user by ID
router.put("/:id", UserController.updateUser); // Update specific user
router.delete("/:id", UserController.deleteUser); // Delete specific user

// Role Management Routes (specific actions)
router.post("/assign-role", UserController.updateDefaultUserRole); // Assign default role to user
router.post("/:userId/role", UserController.updateAssignedUserRole); // Update role for specific user

export const userRoutes = router;