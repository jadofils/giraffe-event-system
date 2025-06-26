import { Request, Response } from "express";
import { AppDataSource } from "../../config/Database";
import { User } from "../../models/User";
import * as bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import PasswordService from "../../services/emails/EmailService";
import { CacheService } from "../../services/CacheService";

const SECRET_KEY = process.env.JWT_SECRET || "sdbgvkghdfcnmfxdxdfggj";
const COOKIE_EXPIRATION = 24 * 60 * 60 * 1000; // 24 hours
const CACHE_TTL = 3600; // 1 hour, consistent with VenueBookingRepository

export class LoginController {
  private static readonly UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  /**
   * Login using default or user password
   * @route POST /api/auth/login/default
   * @access Public
   */
  static async loginWithDefaultPassword(req: Request, res: Response): Promise<void> {
    if (!AppDataSource.isInitialized) {
      res.status(500).json({ success: false, message: "Database not initialized" });
      return;
    }

    const { identifier, password } = req.body;

    if (!identifier || !password) {
      res.status(400).json({ success: false, message: "Please enter both identifier and password." });
      return;
    }

    const userRepository = AppDataSource.getRepository(User);

    try {
      const user = await userRepository.findOne({
        where: [
          { email: identifier },
          { username: identifier },
          { phoneNumber: identifier }
        ],
        relations: ["role", "role.permissions", "organizations"],
      });

      if (!user) {
        res.status(404).json({ success: false, message: "No account found with that email, username, or phone number." });
        return;
      }

      // Validate user UUID
      if (!LoginController.UUID_REGEX.test(user.userId)) {
        res.status(500).json({ success: false, message: "Invalid user ID format." });
        return;
      }

      // Password verification (default password is now the user's password)
      let isMatch = false;
      if (user.password) {
        isMatch = await bcrypt.compare(password, user.password);
      }

      if (!isMatch) {
        res.status(401).json({ success: false, message: "Incorrect password. Please try again." });
        return;
      }

      // Validate organization
      if (!user.organizations || user.organizations.length === 0) {
        res.status(401).json({ success: false, message: "User is not associated with any organization." });
        return;
      }

      const firstOrganization = user.organizations[0];
      if (!LoginController.UUID_REGEX.test(firstOrganization.organizationId)) {
        res.status(500).json({ success: false, message: "Invalid organization ID format." });
        return;
      }

      // Generate JWT token
      const token = jwt.sign(
        {
          userId: user.userId,
          email: user.email,
          username: user.username,
          phoneNumber: user.phoneNumber,
          organizationId: firstOrganization.organizationId,
          roleId: user.role.roleId,
          roleName: user.role.roleName,
        },
        SECRET_KEY,
        { expiresIn: "24h" }
      );

      res.cookie("authToken", token, {
        httpOnly: true,
        maxAge: COOKIE_EXPIRATION,
        sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
        secure: process.env.NODE_ENV === "production",
      });

      const { password: _, ...userData } = user;

      // Generate password reset token
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

      // Send reset link to user's email
      await PasswordService.sendPasswordResetEmail(user.email, resetLink);

      res.status(200).json({
        success: true,
        message: "Login successful! Please check your email to reset your password.",
        user: { ...userData, needsPasswordReset: true },
        token,
        resetLink, // Optionally return the link for testing
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Something went wrong while logging in.",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  /**
   * Login using user password
   * @route POST /api/auth/login
   * @access Public
   */
  static async login(req: Request, res: Response): Promise<void> {
    const { identifier, password } = req.body;

    // Validate request
    if (!identifier || !password) {
      console.log(`[Login Attempt] Identifier: ${identifier} - Missing identifier or password`);
      res.status(400).json({ success: false, message: "Please provide both identifier and password." });
      return;
    }

    const userRepository = AppDataSource.getRepository(User);

    try {
      const cacheKey = `user:identifier:${identifier}`;
      const user = await CacheService.getOrSetSingle(
        cacheKey,
        userRepository,
        async () => {
          return await userRepository.findOne({
            where: [
              { email: identifier },
              { username: identifier },
              { phoneNumber: identifier }
            ],
            relations: [
              "organizations",
              "organizations.venues",
              "role",
              "role.permissions"
            ],
          });
        },
        CACHE_TTL
      );

      if (!user) {
        console.log(`[Login Attempt] Identifier: ${identifier} - No account found`);
        res.status(404).json({ success: false, "message": "No account found with that email, username, or phone number." });
        return;
      }

      // Validate user UUID
      if (!LoginController.UUID_REGEX.test(user.userId)) {
        console.log(`[Login Attempt] User ID: ${user.userId} - Invalid UUID format`);
        res.status(500).json({ success: false, message: "Invalid user ID format." });
        return;
      }

      // Check password
      if (!user.password || !(await bcrypt.compare(password, user.password))) {
        console.log(`[Login Attempt] User ID: ${user.userId} - Incorrect password`);
        res.status(401).json({ success: false, message: "Incorrect password. Please try again." });
        return;
      }

      // Validate organization
      if (!user.organizations || user.organizations.length === 0) {
        console.log(`[Login Attempt] User ID: ${user.userId} - No associated organizations`);
        res.status(401).json({ success: false, message: "User is not associated with any organization." });
        return;
      }

      const firstOrganization = user.organizations[0];

      // Filter venues and only include approved events for each venue
      const venuesWithApprovedEvents = (firstOrganization.venues || []).map(venue => ({
        ...venue,
        events: (venue.events || []).filter(event => event.status === "APPROVED")
      }));

      const organization = {
        organizationId: firstOrganization.organizationId,
        organizationName: firstOrganization.organizationName,
        description: firstOrganization.description,
        contactEmail: firstOrganization.contactEmail,
        contactPhone: firstOrganization.contactPhone,
        address: firstOrganization.address,
        organizationType: firstOrganization.organizationType,
      };

      // Generate JWT token
      const token = jwt.sign(
        {
          userId: user.userId,
          email: user.email,
          username: user.username,
          phoneNumber: user.phoneNumber,
          organizationId: firstOrganization.organizationId,
          roles: {
            roleId: user.role.roleId,
            roleName: user.role.roleName,
          },
        },
        SECRET_KEY,
        { expiresIn: "24h" }
      );

      res.cookie("authToken", token, {
        httpOnly: true,
        maxAge: COOKIE_EXPIRATION,
        sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
        secure: process.env.NODE_ENV === "production",
      });

      console.log(`[Login Success] User ID: ${user.userId}, Role: ${user.role.roleName}, Organization ID: ${firstOrganization.organizationId}`);

      user.role.permissions.forEach(permission => {
        console.log({
          userId: user.userId,
          username: user.username,
          roleId: user.role.roleId,
          roleName: user.role.roleName,
          permissionId: permission.id,
          permissionName: permission.name,
          permissionDescription: permission.description,
        });
      });

      res.status(200).json({
        success: true,
        message: "Login successful!",
        user: {
          userId: user.userId,
          email: user.email,
          username: user.username,
          phoneNumber: user.phoneNumber,
          roles: user.role,
          organization // <-- now includes venues and only approved events
        },
        token,
      });
    } catch (error) {
      console.error(`[Login Error] Identifier: ${identifier} - ${error instanceof Error ? error.message : "Unknown error"}`);
      res.status(500).json({
        success: false,
        message: "Something went wrong while logging in.",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
}