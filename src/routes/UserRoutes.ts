import { Router } from "express";
import { UserController } from "../controller/user/Registration";
import { LoginController } from "../controller/user/Login";
import { ResetPasswordController } from "../controller/user/ResetDefaultPassword";
import { authenticate } from "../middlewares/AuthMiddleware";

const router = Router();

// =======================
// 📂 Public Routes
// =======================
router.post("/auth/register", UserController.register);
router.post("/auth/login/default", LoginController.loginWithDefaultPassword);
router.post("/auth/reset", ResetPasswordController.resetPassword);
router.post("/auth/login", LoginController.login);
router.post("/auth/forgot", ResetPasswordController.forgotPasswordLink);
router.post(
  "/auth/reset/resend",
  ResetPasswordController.resendPasswordResetEmail
);
// router.post("/auth/forgot/identifier", ResetPasswordController.forgotPasswordLinkByUsernameOrEmail); // deprecated

// =======================
// 🔒 Protected Routes
// =======================
router.use(authenticate);

// User Profile
router.get("/profile", UserController.getProfile);
router.put("/profile", UserController.updateProfile);

// User Management
router.get("/", UserController.getAllUsers);
router.get("/:id", UserController.getUserById);
router.put("/:id", UserController.updateUser);
router.delete("/:id", UserController.deleteUser);

// Role Management
router.post("/assign-role", UserController.updateDefaultUserRole);
router.post("/:userId/role", UserController.updateAssignedUserRole);

export const userRoutes = router;
