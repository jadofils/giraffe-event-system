import { Request, Response } from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { AppDataSource } from "../../config/Database";
import { User } from "../../models/User";
import PasswordService from "../../services/emails/EmailService";
import { CacheService } from "../../services/CacheService";

const SECRET_KEY = process.env.JWT_SECRET || "your-secret-key";
const CACHE_TTL = 3600; // 1 hour
const RESET_EMAIL_RATE_LIMIT = 3; // Max 3 resends per hour
const RESET_EMAIL_RATE_LIMIT_TTL = 3600; // 1 hour

export class ResetPasswordController {
  private static readonly UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  /**
   * Reset password using JWT token
   * @route POST /api/auth/reset
   * @access Public (with valid token)
   */
  static async resetPassword(req: Request, res: Response): Promise<void> {
    const { password, confirm_password } = req.body;
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      console.log("[Password Reset Attempt] Missing or invalid Authorization header");
      res.status(401).json({ success: false, message: "Authentication token is required" });
      return;
    }

    const token = authHeader.split(" ")[1];

    if (!token || !password || !confirm_password) {
      console.log("[Password Reset Attempt] Missing token, password, or confirm_password");
      res.status(400).json({ success: false, message: "Token, password, and confirmation are required" });
      return;
    }

    if (password !== confirm_password) {
      console.log("[Password Reset Attempt] Passwords do not match");
      res.status(400).json({ success: false, message: "Password and confirmation do not match" });
      return;
    }

    try {
      // Decode and verify token
      const decoded = jwt.verify(token, SECRET_KEY) as {
        userId: string;
        email: string;
        username: string;
        needsPasswordReset?: boolean;
        purpose?: string;
      };

      if (decoded.purpose !== "password_reset" && !decoded.needsPasswordReset) {
        console.log(`[Password Reset Attempt] User ID: ${decoded.userId} - Invalid token purpose`);
        res.status(403).json({ success: false, message: "This token is not authorized for password reset" });
        return;
      }

      // Validate userId
      if (!ResetPasswordController.UUID_REGEX.test(decoded.userId)) {
        console.log(`[Password Reset Attempt] User ID: ${decoded.userId} - Invalid UUID format`);
        res.status(400).json({ success: false, message: "Invalid user ID format" });
        return;
      }

      // Find user
      const userRepository = AppDataSource.getRepository(User);
      const cacheKey = `user:id:${decoded.userId}`;
      const user = await CacheService.getOrSetSingle(
        cacheKey,
        userRepository,
        async () => {
          return await userRepository.findOne({
            where: { userId: decoded.userId },
            relations: ["organizations", "role"],
          });
        },
        CACHE_TTL
      );

      if (!user) {
        console.log(`[Password Reset Attempt] User ID: ${decoded.userId} - User not found`);
        res.status(404).json({ success: false, message: "User not found" });
        return;
      }

      // Update password
      const hashedPassword = await bcrypt.hash(password, 10);
      user.password = hashedPassword;
      await userRepository.save(user);

      // Invalidate cache
      await CacheService.invalidateMultiple([
        `user:id:${user.userId}`,
        `user:identifier:${user.email}`,
        `user:identifier:${user.username}`,
      ]);

      // Generate new token
      const newToken = jwt.sign(
        {
          userId: user.userId,
          email: user.email,
          username: user.username,
          organizationId: user.organizations[0]?.organizationId,
          roles: {
            roleId: user.role.roleId,
            roleName: user.role.roleName,
          },
        },
        SECRET_KEY,
        { expiresIn: "24h" }
      );

      // Set new cookie
      res.cookie("authToken", newToken, {
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000,
        sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
        secure: process.env.NODE_ENV === "production",
      });

      // Clear session data
      if (req.session) {
        PasswordService.invalidateDefaultPassword(req, user.email);
        // Explicitly clear session data to prevent reuse of default password
        req.session.defaultPassword = undefined;
        req.session.defaultEmail = undefined;
        req.session.username = undefined;
        // TODO: Verify if PasswordService.invalidateDefaultPassword is necessary here,
        // as the password has already been updated in the database
      }

      console.log(`[Password Reset Success] User ID: ${user.userId}, Email: ${user.email}`);

      res.status(200).json({
        success: true,
        message: "Password updated successfully",
        token: newToken,
      });
    } catch (error) {
      console.error(`[Password Reset Error] Token: ${token} - ${error instanceof Error ? error.message : "Unknown error"}`);
      let errorMessage = "Password reset failed";
      if (error instanceof jwt.TokenExpiredError) {
        errorMessage = "Reset token has expired";
      } else if (error instanceof jwt.JsonWebTokenError) {
        errorMessage = "Invalid reset token";
      }
      res.status(400).json({ success: false, message: errorMessage });
    }
  }

  /**
   * Request password reset link
   * @route POST /api/auth/forgot
   * @access Public
   */
  static async forgotPasswordLink(req: Request, res: Response): Promise<void> {
    const { email } = req.body;

    if (!email) {
      console.log("[Password Reset Attempt] Missing email");
      res.status(400).json({ success: false, message: "Email is required" });
      return;
    }

    try {
      const userRepository = AppDataSource.getRepository(User);
      const cacheKey = `user:identifier:${email}`;
      const user = await CacheService.getOrSetSingle(
        cacheKey,
        userRepository,
        async () => {
          return await userRepository.findOne({
            where: { email },
            relations: ["organizations", "role"],
          });
        },
        CACHE_TTL
      );

      // Vague response for security
      if (!user) {
        console.log(`[Password Reset Attempt] Email: ${email} - User not found`);
        res.status(200).json({
          success: true,
          message: "If an account exists with this email, password reset instructions have been sent",
        });
        return;
      }

      // Validate userId
      if (!ResetPasswordController.UUID_REGEX.test(user.userId)) {
        console.log(`[Password Reset Attempt] User ID: ${user.userId} - Invalid UUID format`);
        res.status(500).json({ success: false, message: "Invalid user ID format" });
        return;
      }

      // Check rate limit
      const rateLimitKey = `reset:email:${email}`;
      const attempts = (await CacheService.get(rateLimitKey) as number) || 0;
      if (attempts >= RESET_EMAIL_RATE_LIMIT) {
        console.log(`[Password Reset Attempt] Email: ${email} - Rate limit exceeded`);
        res.status(429).json({ success: false, message: "Too many reset attempts. Please try again later." });
        return;
      }

      // Increment rate limit
      await CacheService.set(rateLimitKey, attempts + 1, RESET_EMAIL_RATE_LIMIT_TTL);

      // Generate reset token
      const resetToken = jwt.sign(
        {
          userId: user.userId,
          email: user.email,
          username: user.username,
          purpose: "password_reset",
        },
        SECRET_KEY,
        { expiresIn: "1h" }
      );

      // Create reset link
      const baseUrl = process.env.FRONTEND_URL || "http://localhost:5000";
      const resetLink = `${baseUrl}/pages/reset-password?token=${resetToken}`;

      // Send email
      await PasswordService.sendPasswordResetEmail(user.email, resetLink);

      console.log(`[Password Reset Success] Email sent to: ${user.email}`);

      res.status(200).json({
        success: true,
        message: "Password reset instructions have been sent to your email",
      });
    } catch (error) {
      console.error(`[Password Reset Error] Email: ${email} - ${error instanceof Error ? error.message : "Unknown error"}`);
      res.status(500).json({ success: false, message: "Failed to process password reset request" });
    }
  }

  /**
   * Resend password reset email
   * @route POST /api/auth/reset/resend
   * @access Public
   */
  static async resendPasswordResetEmail(req: Request, res: Response): Promise<void> {
    const { email, token } = req.body;

    if (!email || !token) {
      console.log(`[Password Reset Attempt] Email: ${email}, Token: ${token} - Missing email or token`);
      res.status(400).json({ success: false, message: "Email and token are required" });
      return;
    }

    try {
      // Decode token (allow expired tokens)
      const decoded = jwt.decode(token) as {
        userId: string;
        email: string;
        username: string;
        purpose?: string;
      } | null;

      if (!decoded || decoded.email !== email || decoded.purpose !== "password_reset") {
        console.log(`[Password Reset Attempt] Email: ${email}, Token: ${token} - Invalid or mismatched token`);
        res.status(400).json({ success: false, message: "Invalid or mismatched token" });
        return;
      }

      // Find user
      const userRepository = AppDataSource.getRepository(User);
      const cacheKey = `user:identifier:${email}`;
      const user = await CacheService.getOrSetSingle(
        cacheKey,
        userRepository,
        async () => {
          return await userRepository.findOne({
            where: { email },
            relations: ["organizations", "role"],
          });
        },
        CACHE_TTL
      );

      // Vague response for security
      if (!user) {
        console.log(`[Password Reset Attempt] Email: ${email}, Token: ${token} - User not found`);
        res.status(200).json({
          success: true,
          message: "If an account exists with this email, password reset instructions have been sent",
        });
        return;
      }

      // Validate userId
      if (!ResetPasswordController.UUID_REGEX.test(user.userId)) {
        console.log(`[Password Reset Attempt] Email: ${email}, Token: ${token}, User ID: ${user.userId} - Invalid UUID format`);
        res.status(500).json({ success: false, message: "Invalid user ID format" });
        return;
      }

      // Check rate limit
      const rateLimitKey = `reset:email:${email}`;
      const attempts = (await CacheService.get(rateLimitKey) as number) || 0;
      if (attempts >= RESET_EMAIL_RATE_LIMIT) {
        console.log(`[Password Reset Attempt] Email: ${email}, Token: ${token} - Rate limit exceeded, Attempts: ${attempts}`);
        res.status(429).json({ success: false, message: "Too many reset attempts. Please try again later." });
        return;
      }

      // Increment rate limit
      await CacheService.set(rateLimitKey, attempts + 1, RESET_EMAIL_RATE_LIMIT_TTL);

      // Generate new reset token
      const resetToken = jwt.sign(
        {
          userId: user.userId,
          email: user.email,
          username: user.username,
          purpose: "password_reset",
        },
        SECRET_KEY,
        { expiresIn: "1h" }
      );

      // Create reset link
      const baseUrl = process.env.FRONTEND_URL || "http://localhost:5000";
      const resetLink = `${baseUrl}/pages/reset-password?token=${resetToken}`;

      // Send email
      await PasswordService.sendPasswordResetEmail(user.email, resetLink);

      // Clear session data if present
      if (req.session) {
        req.session.defaultPassword = undefined;
        req.session.defaultEmail = undefined;
        req.session.username = undefined;
        // Note: Not calling PasswordService.invalidateDefaultPassword here as it's typically tied to default password login
      }

      console.log(`[Password Reset Success] Email: ${email}, Token: ${token}, Resent email to: ${user.email}, Reset Link: ${resetLink}`);

      res.status(200).json({
        success: true,
        message: "Password reset instructions have been resent to your email",
      });
    } catch (error) {
      console.error(`[Password Reset Error] Email: ${email}, Token: ${token} - ${error instanceof Error ? error.message : "Unknown error"}`);
      res.status(500).json({ success: false, message: "Failed to resend password reset email" });
    }
}

}