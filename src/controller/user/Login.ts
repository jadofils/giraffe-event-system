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
      console.error("[Login Attempt] Database not initialized");
      res.status(500).json({ success: false, message: "Database not initialized" });
      return;
    }

    const { identifier, password } = req.body;

    if (!identifier || !password) {
      console.log(`[Login Attempt] Identifier: ${identifier} - Missing identifier or password`);
      res.status(400).json({ success: false, message: "Please enter both identifier and password." });
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
            where: [{ email: identifier }, { username: identifier }, { phoneNumber: identifier }],
            relations: ["role", "organizations"],
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

      // Verify session data
      if (
        !req.session?.defaultPassword ||
        !(
          req.session.defaultEmail === user.email ||
          req.session.username === user.username ||
          req.session.phoneNumber === user.phoneNumber
        )
      ) {
        console.log(`[Login Attempt] User ID: ${user.userId} - Invalid session data`);
        res.status(401).json({ success: false, message: "Session data doesn't match user account." });
        return;
      }

      // Password verification
      let isMatch = false;
      let isSessionPasswordLogin = false;

      if (req.session.defaultPassword === password) {
        isMatch = true;
        isSessionPasswordLogin = true;
        PasswordService.invalidateDefaultPassword(req, user.email);
        // Clear session data
        req.session.defaultPassword = undefined;
        req.session.defaultEmail = undefined;
        req.session.username = undefined;
        req.session.phoneNumber = undefined;
      } else if (user.password) {
        isMatch = await bcrypt.compare(password, user.password);
      }

      if (!isMatch) {
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
      if (!LoginController.UUID_REGEX.test(firstOrganization.organizationId)) {
        console.log(`[Login Attempt] User ID: ${user.userId} - Invalid organization ID: ${firstOrganization.organizationId}`);
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
          needsPasswordReset: isSessionPasswordLogin,
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

      const { password: _, ...userData } = user;

      console.log(`[Login Success] User ID: ${user.userId}, Role: ${user.role.roleName}, Organization ID: ${firstOrganization.organizationId}`);

      res.status(200).json({
        success: true,
        message: isSessionPasswordLogin ? "Login successful! Please create a new password." : "Login successful!",
        user: { ...userData, needsPasswordReset: isSessionPasswordLogin },
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
              { phoneNumber: identifier },
            ],
            relations: [
              "role",
              "organizations",
              "createdEvents",
              "createdEvents.organization",
              "createdEvents.venues",
              "managedVenues",
              "registrations",
              "registrations.event",
              "registrations.venue",
              "feedbacks",
              "feedbacks.event"
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
      if (!LoginController.UUID_REGEX.test(firstOrganization.organizationId)) {
        console.log(`[Login Attempt] User ID: ${user.userId} - Invalid organization ID: ${firstOrganization.organizationId}`);
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

      // Remove password from user data
      const { password: _, ...userData } = user;

      // Format the response with all related data
      const formattedResponse = {
        ...userData,
        role: {
          roleId: user.role.roleId,
          roleName: user.role.roleName,
          permissions: user.role.permissions || []
        },
        organizations: user.organizations.map(org => ({
          organizationId: org.organizationId,
          organizationName: org.organizationName,
          description: org.description,
          contactEmail: org.contactEmail,
          contactPhone: org.contactPhone,
          address: org.address,
          organizationType: org.organizationType
        })),
        events: user.createdEvents?.map(event => ({
          eventId: event.eventId,
          eventTitle: event.eventTitle,
          description: event.description,
          eventCategory: event.eventCategoryId,
          eventType: event.eventType,
          organizerId: event.organizationId,
          venueId: event.venues?.[0]?.venueId,
          maxAttendees: event.maxAttendees,
          status: event.status,
          isFeatured: event.isFeatured,
          qrCode: event.qrCode
        })) || [],
        venues: user.managedVenues?.map(venue => ({
          venueId: venue.venueId,
          venueName: venue.venueName,
          location: venue.location,
          capacity: venue.capacity,
          amenities: venue.amenities
        })) || [],
        registrations: user.registrations?.map(reg => ({
          registrationId: reg.registrationId,
          event: reg.event ? {
            eventId: reg.event.eventId,
            eventTitle: reg.event.eventTitle
          } : null,
          ticketType: reg.ticketType ? {
            ticketTypeId: reg.ticketType.ticketTypeId,
            ticketName: reg.ticketType.ticketName,
            price: reg.ticketType.price
          } : null,
          venue: reg.venue ? {
            venueId: reg.venue.venueId,
            venueName: reg.venue.venueName
          } : null,
          registrationDate: reg.registrationDate,
          paymentStatus: reg.paymentStatus,
          attended: reg.attended
        })) || [],
        feedbacks: user.feedbacks?.map(feedback => ({
          feedbackId: feedback.feedbackId,
          rating: feedback.rating,
          comments: feedback.comments
        })) || []
      };

      console.log(`[Login Success] User ID: ${user.userId}, Role: ${user.role.roleName}, Organization ID: ${firstOrganization.organizationId}`);

      res.status(200).json({
        success: true,
        message: "Login successful!",
        user: formattedResponse,
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