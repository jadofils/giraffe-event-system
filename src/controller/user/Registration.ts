import { Request, Response } from "express";
import { UserRepository } from "../../repositories/UserRepository";
import { AppDataSource } from "../../config/Database";
import { User } from "../../models/User";
import PasswordService from "../../services/emails/EmailService"; // Assuming this is correct
import { Role } from "../../models/Role";
import { Organization } from "../../models/Organization"; // Import Organization model
import { UserInterface } from "../../interfaces/UserInterface"; // Import UserInterface
import bcrypt from "bcryptjs";
import { OrganizationRepository } from "../../repositories/OrganizationRepository";
import { AuthenticatedRequest } from "../../middlewares/AuthMiddleware";

export class UserController {
  static async register(req: Request, res: Response): Promise<void> {
    try {
      const usersData = Array.isArray(req.body) ? req.body : [req.body];
      const results = [];

      // First, check for existing users
      const existingUsersMap = await UserRepository.findExistingUsers(
        usersData.map(data => ({
          email: data.email || '',
          username: data.username || '',
          phoneNumber:data.phoneNumber || ''
        }))
      );

      // Process each user
      for (const userInput of usersData) {
      const {
        username,
        firstName,
        lastName,
        email,
        phoneNumber,
        password,
          confirmPassword,
        bio,
        profilePictureURL,
        preferredLanguage,
        timezone,
        emailNotificationsEnabled,
        smsNotificationsEnabled,
        socialMediaLinks,
        dateOfBirth,
        gender,
        addressLine1,
        addressLine2,
        city,
        stateProvince,
        postalCode,
        country,
        organization: organizationNameFromRequest,
        } = userInput as Partial<UserInterface> & { confirmPassword?: string; organization?: string };

        // Check if user already exists
        if (email && existingUsersMap.has(email) || username && existingUsersMap.has(username)) {
          results.push({
            success: false,
            message: "User already exists with that username or email.",
            user: { username, email }
          });
          continue;
        }

      // === Input Validation ===
      const errors: string[] = [];

      if (!username || username.length < 3 || username.length > 50) {
        errors.push("Username must be between 3 and 50 characters.");
      }
      if (!firstName || firstName.length < 1 || firstName.length > 50) {
        errors.push("First name must be between 1 and 50 characters.");
      }
      if (!lastName || lastName.length < 1 || lastName.length > 50) {
        errors.push("Last name must be between 1 and 50 characters.");
      }
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        errors.push("Invalid email format.");
      }
      if (phoneNumber && !/^\+?[1-9]\d{1,14}$/.test(phoneNumber)) {
        errors.push("Invalid phone number format.");
      }

        // Password validation only if password is provided
        if (password) {
          if (password.length < 6) {
        errors.push("Password must be at least 6 characters long.");
      }
      if (password !== confirmPassword) {
        errors.push("Passwords do not match.");
      }
      const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d]{6,}$/;
          if (!passwordRegex.test(password)) {
        errors.push("Password must contain at least one uppercase letter, one lowercase letter, and one number.");
          }
      }

      if (errors.length > 0) {
          results.push({
            success: false,
            message: errors.join(" "),
            user: { username, email }
          });
          continue;
        }

        // === Hash password only if provided ===
        const hashedPassword = password ? await bcrypt.hash(password, 10) : undefined;

      // === Default Role Assignment ===
      const roleRepository = AppDataSource.getRepository(Role);
      const guestRole = await roleRepository.findOne({ where: { roleName: "GUEST" } });

      if (!guestRole) {
          results.push({
            success: false,
            message: "Default GUEST role not found. Please initialize roles.",
            user: { username, email }
          });
          continue;
      }

      // === Handle Organization ===
      const organizationRepository = AppDataSource.getRepository(Organization);
      const defaultOrgName = "Independent";
      const effectiveOrgName = (organizationNameFromRequest?.trim() || defaultOrgName).toLowerCase() === "independent"
        ? defaultOrgName
        : organizationNameFromRequest!.trim();

      let userOrganization = await organizationRepository.findOne({ where: { organizationName: effectiveOrgName } });

      if (!userOrganization && effectiveOrgName === defaultOrgName) {
        userOrganization = organizationRepository.create({
          organizationName: defaultOrgName,
          organizationType: "General",
          description: "Auto-created organization: Independent",
          contactEmail: "admin@independent.com",
        });
        await organizationRepository.save(userOrganization);
      }

        // === Create User Data ===
        const userData = {
        username,
        firstName,
        lastName,
        email,
        phoneNumber,
        bio,
        profilePictureURL,
        preferredLanguage,
        timezone,
        emailNotificationsEnabled,
        smsNotificationsEnabled,
        socialMediaLinks,
        dateOfBirth,
        gender,
        addressLine1,
        addressLine2,
        city,
        stateProvince,
        postalCode,
        country,
        roleId: guestRole.roleId,
        };

        // Only add password if it was provided
        if (hashedPassword) {
          Object.assign(userData, { password: hashedPassword });
        }

        // Create and save user
        const user = UserRepository.createUser(userData);
      const savedUser = await AppDataSource.getRepository(User).save(user);

        if (userOrganization) {
          savedUser.organizations = [userOrganization];
          await AppDataSource.getRepository(User).save(savedUser);
        }

   const completeUser = await AppDataSource.getRepository(User).findOne({
  where: { userId: savedUser.userId },
          relations: ['role', 'organizations'],
});

      if (!completeUser) {
          results.push({
            success: false,
            message: "User registration failed during final fetch.",
            user: { username, email }
          });
          continue;
      }

      // === Optional: Send welcome email ===
      try {
        const emailSent = await PasswordService.sendDefaultPassword(
          email!,
          completeUser.lastName,
          completeUser.firstName,
          completeUser.username,
          req
        );

        if (!emailSent) {
          console.warn(`Email not sent to ${email}, but user created.`);
        }
      } catch (emailErr) {
        console.error("Email sending error:", emailErr);
      }

        // === Add successful result ===
        const userResponse = {
          userId: completeUser.userId,
          username: completeUser.username,
          email: completeUser.email,
          firstName: completeUser.firstName,
          lastName: completeUser.lastName,
          phoneNumber: completeUser.phoneNumber,
          bio: completeUser.bio,
          profilePictureURL: completeUser.profilePictureURL,
          preferredLanguage: completeUser.preferredLanguage,
          timezone: completeUser.timezone,
          emailNotificationsEnabled: completeUser.emailNotificationsEnabled,
          smsNotificationsEnabled: completeUser.smsNotificationsEnabled,
          socialMediaLinks: completeUser.socialMediaLinks,
          dateOfBirth: completeUser.dateOfBirth,
          gender: completeUser.gender,
          addressLine1: completeUser.addressLine1,
          addressLine2: completeUser.addressLine2,
          city: completeUser.city,
          stateProvince: completeUser.stateProvince,
          postalCode: completeUser.postalCode,
          country: completeUser.country,
          role: completeUser.role
            ? {
                roleId: completeUser.role.roleId,
                roleName: completeUser.role.roleName,
                permissions: completeUser.role.permissions || [],
              }
            : null,
          organizations: completeUser.organizations?.map(org => ({
            organizationId: org.organizationId,
            organizationName: org.organizationName,
            description: org.description,
            contactEmail: org.contactEmail,
            contactPhone: org.contactPhone,
            address: org.address,
            city: org.city,
            country: org.country,
            postalCode: org.postalCode,
            stateProvince: org.stateProvince,
            organizationType: org.organizationType,
          })) || [],
        };

        results.push({
          success: true,
          message: "User registered successfully.",
          user: userResponse
        });
      }

      // === Send Response ===
      const allSuccessful = results.every(result => result.success);
      const statusCode = allSuccessful ? 201 : (results.some(result => result.success) ? 207 : 400);
      
      res.status(statusCode).json({
        success: allSuccessful,
        message: allSuccessful ? "All users registered successfully" : "Some users failed to register",
        results
      });

    } catch (err) {
      console.error("Unexpected error during registration:", err);
      res.status(500).json({ success: false, message: "Internal server error." });
    }
  }

  static async getProfile(req: Request, res: Response): Promise<void> {
    res.status(200).json({ success: true, message: "User profile retrieved" });
  }

  static async updateProfile(req: Request, res: Response): Promise<void> {
    res.status(200).json({ success: true, message: "Profile updated successfully" });
  }

  static async getAllUsers(req: Request, res: Response): Promise<void> {
    try {
      const users = await UserRepository.getAllUsers();

      if (!users || users.length === 0) {
        res.status(404).json({ success: false, message: "No users found" });
        return;
      }

      const formattedUsers = users.map((user) => ({
        userId: user?.userId,
        username: user?.username,
        firstName: user?.firstName,
        lastName: user?.lastName,
        email: user?.email,
        phoneNumber: user?.phoneNumber,
        // Include new optional fields
        bio: user?.bio,
        profilePictureURL: user?.profilePictureURL,
        preferredLanguage: user?.preferredLanguage,
        timezone: user?.timezone,
        emailNotificationsEnabled: user?.emailNotificationsEnabled,
        smsNotificationsEnabled: user?.smsNotificationsEnabled,
        socialMediaLinks: user?.socialMediaLinks,
        dateOfBirth: user?.dateOfBirth,
        gender: user?.gender,
        addressLine1: user?.addressLine1,
        addressLine2: user?.addressLine2,
        city: user?.city,
        stateProvince: user?.stateProvince,
        postalCode: user?.postalCode,
        country: user?.country,
        // Relationships
        role: user?.role
          ? {
              roleId: user.role.roleId,
              roleName: user.role.roleName,
              permissions: user.role.permissions || [],
            }
          : null,
        // Corrected: 'organization' is singular and an object, not an array
        organization: user?.organizations?.[0]
          ? {
              organizationId: user.organizations[0].organizationId,
              organizationName: user.organizations[0].organizationName,
              description: user.organizations[0].description || "",
              contactEmail: user.organizations[0].contactEmail,
              contactPhone: user.organizations[0].contactPhone || "",
              address: user.organizations[0].address || "",
              organizationType: user.organizations[0].organizationType || "",
            }
          : null,
      }));

      res.status(200).json({ success: true, users: formattedUsers });
    } catch (error) {
      console.error("Error in getAllUsers:", error);
      res.status(500).json({ success: false, message: "Internal server error" });
    }
  }

  static async getUserById(req: Request, res: Response): Promise<void> {
    try {
      const user = await UserRepository.getUserById(req.params.id);

      if (!user) {
        res.status(404).json({ success: false, message: "User not found" });
        return;
      }

      const formattedUser = {
        userId: user.userId,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phoneNumber: user.phoneNumber,
        // Include new optional fields
        bio: user.bio,
        profilePictureURL: user.profilePictureURL,
        preferredLanguage: user.preferredLanguage,
        timezone: user.timezone,
        emailNotificationsEnabled: user.emailNotificationsEnabled,
        smsNotificationsEnabled: user.smsNotificationsEnabled,
        socialMediaLinks: user.socialMediaLinks,
        dateOfBirth: user.dateOfBirth,
        gender: user.gender,
        addressLine1: user.addressLine1,
        addressLine2: user.addressLine2,
        city: user.city,
        stateProvince: user.stateProvince,
        postalCode: user.postalCode,
        country: user.country,
        // Relationships
        role: user.role
          ? {
              roleId: user.role.roleId,
              roleName: user.role.roleName,
              permissions: user.role.permissions || [],
            }
          : null,
        // Corrected: 'organization' is singular and an object, not an array
        organization: user.organizations?.[0]
          ? {
              organizationId: user.organizations[0].organizationId,
              organizationName: user.organizations[0].organizationName,
              description: user.organizations[0].description || "",
              contactEmail: user.organizations[0].contactEmail,
              contactPhone: user.organizations[0].contactPhone || "",
              address: user.organizations[0].address || "",
              organizationType: user.organizations[0].organizationType || "",
            }
          : null,
        // Format registrationsAsAttendee
        registrations: user.registrationsAsAttendee?.map((registration) => ({
          registrationIds: {
            registrationId: registration.registrationId,
            registrationDate: registration.registrationDate,
            paymentStatus: registration.paymentStatus,
            attended: registration.attended,
          },
          eventId: {
            eventId: registration.event.eventId,
            eventTitle: registration.event.eventTitle,
            description: registration.event.description,
            eventCategory: registration.event.eventCategoryId,
            eventType: registration.event.eventType,
          },
          // Handle both array and single object cases for ticketType (as per your original logic)
          ticketType: Array.isArray(registration.ticketType)
            ? (registration.ticketType as any[]).map((ticket) => ({
                ticketTypeId: ticket.ticketTypeId,
                ticketTypeName: ticket.ticketName,
                price: ticket.price,
                description: ticket.description,
              }))
            : registration.ticketType && typeof registration.ticketType === 'object'
              ? [{
                  ticketTypeId: (registration.ticketType as any).ticketTypeId,
                  ticketTypeName: (registration.ticketType as any).ticketName,
                  price: (registration.ticketType as any).price,
                  description: (registration.ticketType as any).description,
                }]
              : [],
          eventName: { // Duplicated from eventId above, consider if both are needed
            eventId: registration.event.eventId,
            eventTitle: registration.event.eventTitle,
            description: registration.event.description,
            eventCategory: registration.event.eventCategoryId,
            eventType: registration.event.eventType,
          },
          venueName: registration.venue // Check if venue is always loaded here, or make it optional
            ? {
              venueId: registration.venue.venueId,
              venueName: registration.venue.venueName,
              capacity: registration.venue.capacity,
              location: registration.venue.location,
              managerId: registration.venue.managerId,
            }
            : null,
          noOfTickets: registration.noOfTickets,
          qrcode: registration.qrCode,
          registrationDate: registration.registrationDate,
          paymentStatus: registration.paymentStatus,
          attended: registration.attended,
        })) || [],
      };
      res.status(200).json({ success: true, user: formattedUser });
    } catch (error) {
      console.error("Error in getUserById:", error);
      res.status(500).json({ success: false, message: "Internal server error" });
    }
  }

  static async updateUser(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.params.id;
      const userRepository = AppDataSource.getRepository(User);

      const user = await userRepository.findOne({
        where: { userId },
        relations: ["role", "organization"], // Include related entities
      });

      if (!user) {
        res.status(404).json({ success: false, message: "User not found" });
        return;
      }

      // Destructure all possible updatable fields, including new optional ones
      const updateData: Partial<UserInterface> = req.body;

      // Update user fields if they exist in the request body
      // This is a more concise way to update all fields
      Object.assign(user, updateData);

      // Explicitly handle password if present (needs hashing)
      if (updateData.password) {
        const hashedPassword = await bcrypt.hash(updateData.password, 10);
        user.password = hashedPassword;
      }

      // Handle organization update if organizationName is provided
      if (updateData.organization?.organizationName) {
          const organizationRepository = AppDataSource.getRepository(Organization);
          let userOrganization = await organizationRepository.findOne({ 
              where: { organizationName: updateData.organization.organizationName } 
          });

          if (!userOrganization) {
              userOrganization = organizationRepository.create({
                  organizationName: updateData.organization.organizationName,
                  organizationType: "General",
                  description: `Auto-created during update: ${updateData.organization.organizationName}`,
              });
              await organizationRepository.save(userOrganization);
          }
          user.organizations = [userOrganization];
      }

      const updatedUser = await userRepository.save(user);

      res.status(200).json({
        success: true,
        message: "User updated successfully",
        user: {
          userId: updatedUser.userId,
          username: updatedUser.username,
          firstName: updatedUser.firstName,
          lastName: updatedUser.lastName,
          email: updatedUser.email,
          phoneNumber: updatedUser.phoneNumber,
          bio: updatedUser.bio,
          profilePictureURL: updatedUser.profilePictureURL,
          preferredLanguage: updatedUser.preferredLanguage,
          timezone: updatedUser.timezone,
          emailNotificationsEnabled: updatedUser.emailNotificationsEnabled,
          smsNotificationsEnabled: updatedUser.smsNotificationsEnabled,
          socialMediaLinks: updatedUser.socialMediaLinks,
          dateOfBirth: updatedUser.dateOfBirth,
          gender: updatedUser.gender,
          addressLine1: updatedUser.addressLine1,
          addressLine2: updatedUser.addressLine2,
          city: updatedUser.city,
          stateProvince: updatedUser.stateProvince,
          postalCode: updatedUser.postalCode,
          country: updatedUser.country,
          role: updatedUser.role
            ? {
                roleId: updatedUser.role.roleId,
                roleName: updatedUser.role.roleName,
                permissions: updatedUser.role.permissions || [],
              }
            : null,
          organizations: updatedUser.organizations?.map(org => ({
            organizationId: org.organizationId,
            organizationName: org.organizationName,
            description: org.description,
            contactEmail: org.contactEmail,
            contactPhone: org.contactPhone,
            address: org.address,
            city: org.city,
            country: org.country,
            postalCode: org.postalCode,
            stateProvince: org.stateProvince,
            organizationType: org.organizationType,
          })) || [],
        },
      });
    } catch (error) {
      console.error("Error in updateUser:", error);
      res.status(500).json({ success: false, message: "Internal server error" });
    }
  }

  static async deleteUser(req: Request, res: Response): Promise<void> {
    const { id } = req.params;

    if (!id) {
      res.status(400).json({ success: false, message: "User ID is required" });
      return;
    }

    try {
      const result = await UserRepository.deleteUser(id);

      if (result.success) {
        res.status(200).json({ success: true, message: result.message });
      } else {
        res.status(404).json({ success: false, message: result.message });
      }
    } catch (error) {
      console.error("Error in deleteUser:", error);
      res.status(500).json({ success: false, message: "Internal server error" });
    }
  }

  static async updateDefaultUserRole(req: Request, res: Response): Promise<void> {
    try {
      const { userId, roleId } = req.body;

      if (!userId || !roleId) {
        res.status(400).json({ message: "User ID and Role ID are required" });
        return;
      }

      const result = await UserRepository.assignUserRole(userId, roleId);

      if (result.success) { // Check success boolean rather than message string
        res.status(200).json({ message: result.message, data: result });
      } else {
        // Use the message from the repository for client response
        res.status(400).json({ message: result.message });
      }
    } catch (error) {
      console.error("Error in updateDefaultUserRole:", error); // Corrected log message
      res.status(500).json({ message: "Internal server error" });
    }
  }

  static async updateAssignedUserRole(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params;
      const { roleId } = req.body;

      if (!userId) {
        res.status(400).json({ success: false, message: 'userId is required in the URL parameters' });
        return;
      }
      if (!roleId) {
        res.status(400).json({ success: false, message: 'roleId is required in the request body' });
        return;
      }

      const result = await UserRepository.updateUserRole(userId, roleId);

      if (result.success) {
        res.status(200).json({
          success: true,
          message: result.message,
          user: {
            userId: result.user?.userId,
            username: result.user?.username,
            email: result.user?.email,
            role: {
              roleId: result.newRole?.roleId,
              roleName: result.newRole?.roleName
            }
          }
        });
      } else {
        res.status(400).json({
          success: false,
          message: result.message,
        });
      }
    } catch (error) {
      console.error('Error in updateAssignedUserRole controller:', error);

      res.status(500).json({
        success: false,
        message: 'Internal server error occurred while updating user role',
      });
    }
  }

  static async getMyOrganizations(req: AuthenticatedRequest, res: Response): Promise<void> {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }
    const result = await OrganizationRepository.getOrganizationsByUserId(userId);
    res.status(result.success ? 200 : 404).json(result);
  }
}