import { Request, Response } from "express";
import { OrganizationRepository } from "../repositories/OrganizationRepository";
import { OrganizationInterface } from "../interfaces/OrganizationInterface";
import { CloudinaryUploadService } from "../services/CloudinaryUploadService";
import { OrganizationStatusEnum } from "../interfaces/Enums/OrganizationStatusEnum";

export class OrganizationController {
  /**
   * Get all organizations
   * @route GET /organizations
   * @access Protected
   */
  static async getAll(req: Request, res: Response): Promise<void> {
    try {
      console.log("Calling OrganizationRepository.getAll()");
      const result = await OrganizationRepository.getAll();
      console.log("Result from OrganizationRepository.getAll():", result);
      res.status(result.success ? 200 : 500).json(result);
    } catch (error) {
      console.error("[OrganizationController GetAll Error]:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  /**
   * Get organization by ID
   * @route GET /organizations/:id
   * @access Protected
   */
  static async getById(req: Request, res: Response): Promise<void> {
    const { id } = req.params;

    if (!id || !OrganizationRepository.UUID_REGEX.test(id)) {
      res
        .status(400)
        .json({ success: false, message: "Valid organization ID is required" });
      return;
    }

    try {
      const result = await OrganizationRepository.getById(id);
      res.status(result.success ? 200 : result.data ? 400 : 404).json(result);
    } catch (error) {
      console.error(`[OrganizationController GetById Error] ID: ${id}:`, error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  /**
   * Create a single organization (with file upload)
   * @route POST /organizations
   * @access Protected
   */
  static async create(req: Request, res: Response): Promise<void> {
    const userId = req.user?.userId;
    const isAdmin = req.user?.isAdmin;

    // Track uploaded files for cleanup in case of failure
    const uploadedFiles: { url: string; type: "image" | "raw" }[] = [];

    try {
      console.log("=== Organization Creation Debug ===");
      console.log("Request body:", req.body);
      console.log("Files received:", req.files);
      console.log("User role:", isAdmin ? "ADMIN" : "REGULAR USER");

      // Parse fields from form-data
      const {
        organizationName,
        description,
        contactEmail,
        contactPhone,
        address,
        organizationType,
        city,
        country,
        postalCode,
        stateProvince,
        members,
        assignCreator = !isAdmin, // Default to true for regular users, false for admins
      } = req.body;

      // Validate required fields
      if (!organizationName || !contactEmail) {
        res.status(400).json({
          success: false,
          message: "organizationName and contactEmail are required.",
        });
        return;
      }

      // Convert members to number if provided
      const membersCount = members ? parseInt(members) : 0;

      // Handle supportingDocument upload if present
      let supportingDocumentUrl: string | undefined = undefined;
      if (req.files && (req.files as any)["supportingDocument"]) {
        console.log("Processing supporting document...");
        const docFile = (req.files as any)["supportingDocument"][0];
        console.log("Supporting document file:", {
          filename: docFile.originalname,
          mimetype: docFile.mimetype,
          size: docFile.size,
        });

        const allowedTypes = [
          "application/pdf",
          "image/jpeg",
          "image/png",
          "image/jpg",
          "image/gif",
          "image/webp",
        ];
        if (!allowedTypes.includes(docFile.mimetype)) {
          res.status(400).json({
            success: false,
            message:
              "Only PDF and image files are allowed as supporting documents.",
          });
          return;
        }
        try {
          const uploadResult = await CloudinaryUploadService.uploadBuffer(
            docFile.buffer,
            "uploads/organization-supporting-document"
          );
          console.log("Supporting document upload result:", uploadResult);
          supportingDocumentUrl = uploadResult.url;
          uploadedFiles.push({
            url: uploadResult.url,
            type: docFile.mimetype.startsWith("image/") ? "image" : "raw",
          });
        } catch (uploadError) {
          console.error("Supporting document upload error:", uploadError);
          res.status(500).json({
            success: false,
            message: "Failed to upload supporting document",
            error:
              uploadError instanceof Error
                ? uploadError.message
                : "Unknown error",
          });
          return;
        }
      }

      // Handle logo upload if present
      let logoUrl: string | undefined = undefined;
      console.log("Processing logo...");
      if (req.files && (req.files as any)["logo"]) {
        const logoFile = (req.files as any)["logo"][0];
        console.log("Logo file:", {
          filename: logoFile.originalname,
          mimetype: logoFile.mimetype,
          size: logoFile.size,
        });

        const allowedLogoTypes = [
          "image/jpeg",
          "image/png",
          "image/jpg",
          "image/gif",
          "image/webp",
        ];
        if (!allowedLogoTypes.includes(logoFile.mimetype)) {
          res.status(400).json({
            success: false,
            message: "Only image files are allowed as logo.",
          });
          return;
        }
        try {
          const uploadLogoResult = await CloudinaryUploadService.uploadBuffer(
            logoFile.buffer,
            "uploads/organization-logo"
          );
          console.log("Logo upload result:", uploadLogoResult);
          logoUrl = uploadLogoResult.url;
          uploadedFiles.push({
            url: uploadLogoResult.url,
            type: "image",
          });
        } catch (uploadError) {
          console.error("Logo upload error:", uploadError);
          // If logo upload fails, clean up any previously uploaded supporting document
          if (supportingDocumentUrl) {
            try {
              await CloudinaryUploadService.deleteFromCloudinary(
                supportingDocumentUrl,
                uploadedFiles[0].type
              );
            } catch (cleanupError) {
              console.error(
                "Failed to cleanup supporting document:",
                cleanupError
              );
            }
          }
          res.status(500).json({
            success: false,
            message: "Failed to upload logo",
            error:
              uploadError instanceof Error
                ? uploadError.message
                : "Unknown error",
          });
          return;
        }
      }

      console.log("Building organization data with URLs:", {
        supportingDocumentUrl,
        logoUrl,
      });

      // Build organization object
      const orgData = {
        organizationName,
        description,
        contactEmail,
        contactPhone,
        address,
        organizationType,
        city,
        country,
        postalCode,
        stateProvince,
        members: membersCount,
        supportingDocument: supportingDocumentUrl,
        logo: logoUrl,
        status: isAdmin
          ? OrganizationStatusEnum.APPROVED
          : OrganizationStatusEnum.PENDING,
      };

      // Use bulkCreate for consistency (single item array)
      const result = await OrganizationRepository.bulkCreate([orgData]);
      if (!result.success || !result.data?.length) {
        console.error("Failed to create organization:", result);

        // Clean up uploaded files if organization creation fails
        for (const file of uploadedFiles) {
          try {
            await CloudinaryUploadService.deleteFromCloudinary(
              file.url,
              file.type
            );
          } catch (cleanupError) {
            console.error(`Failed to cleanup file ${file.url}:`, cleanupError);
          }
        }

        res.status(400).json({
          ...result,
          message: result.message || "Failed to create organization",
        });
        return;
      }

      // Only assign creator if they're not an admin or if explicitly requested
      if (assignCreator && userId) {
        console.log("Assigning creator to organization:", {
          userId,
          organizationId: result.data[0].organizationId,
        });

        const assignResult =
          await OrganizationRepository.assignUsersToOrganization(
            [userId],
            result.data[0].organizationId
          );

        if (!assignResult.success) {
          console.error("Failed to assign user to organization:", assignResult);

          // Clean up everything if user assignment fails
          for (const file of uploadedFiles) {
            try {
              await CloudinaryUploadService.deleteFromCloudinary(
                file.url,
                file.type
              );
            } catch (cleanupError) {
              console.error(
                `Failed to cleanup file ${file.url}:`,
                cleanupError
              );
            }
          }

          // Try to delete the created organization
          try {
            await OrganizationRepository.delete(result.data[0].organizationId);
          } catch (deleteError) {
            console.error("Failed to cleanup organization:", deleteError);
          }

          res.status(500).json({
            success: false,
            message: "Failed to assign user to organization",
          });
          return;
        }

        console.log("Organization creation completed with user assignment:", {
          organizationId: result.data[0].organizationId,
          assignResult,
        });

        res.status(201).json({
          success: true,
          data: result.data[0],
          message: "Organization created and creator assigned.",
        });
      } else {
        console.log("Organization created without user assignment:", {
          organizationId: result.data[0].organizationId,
          isAdmin,
          assignCreator,
        });

        res.status(201).json({
          success: true,
          data: result.data[0],
          message: "Organization created successfully.",
        });
      }
    } catch (error) {
      console.error("[OrganizationController Create Error]:", error);

      // Clean up any uploaded files in case of unexpected errors
      for (const file of uploadedFiles) {
        try {
          await CloudinaryUploadService.deleteFromCloudinary(
            file.url,
            file.type
          );
        } catch (cleanupError) {
          console.error(`Failed to cleanup file ${file.url}:`, cleanupError);
        }
      }

      res.status(500).json({
        success: false,
        message: "Internal server error",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  /**
   * Create multiple organizations
   * @route POST /organizations/bulk
   * @access Protected
   */

  /**
   * Update an organization
   * @route PUT /organizations/:id
   * @access Protected
   */
  static async update(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const data: Partial<OrganizationInterface> = req.body;

    if (!id || !OrganizationRepository.UUID_REGEX.test(id)) {
      res
        .status(400)
        .json({ success: false, message: "Valid organization ID is required" });
      return;
    }

    // Convert members to number if provided
    if (data.members !== undefined) {
      data.members = parseInt(data.members.toString());
    }

    try {
      const result = await OrganizationRepository.update(id, data);
      res.status(result.success ? 200 : result.data ? 400 : 404).json(result);
    } catch (error) {
      console.error(`[OrganizationController Update Error] ID: ${id}:`, error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  /**
   * Update multiple organizations
   * @route PUT /organizations/bulk
   * @access Protected
   */

  /**
   * Update an organization's logo
   * @route PATCH /organizations/:id/logo
   * @access Protected
   */
  static async updateLogo(req: Request, res: Response): Promise<void> {
    const { id } = req.params;

    if (!req.file) {
      res
        .status(400)
        .json({ success: false, message: "Logo file is required" });
      return;
    }

    try {
      console.log("=== UPDATE LOGO DEBUG ===");
      // Get organization with current logo
      const orgResult = await OrganizationRepository.getById(id);
      if (!orgResult.success || !orgResult.data) {
        res
          .status(404)
          .json({ success: false, message: "Organization not found" });
        return;
      }

      // Store the old logo URL BEFORE uploading new one
      const oldLogoUrl = orgResult.data.logo;
      console.log("Current logo URL:", oldLogoUrl);

      // Upload new logo
      const logoFile = req.file;
      const allowedTypes = [
        "image/jpeg",
        "image/png",
        "image/jpg",
        "image/gif",
        "image/webp",
      ];

      if (!allowedTypes.includes(logoFile.mimetype)) {
        res.status(400).json({
          success: false,
          message: "Only image files are allowed as logo",
        });
        return;
      }

      try {
        // Upload new logo first
        const uploadResult = await CloudinaryUploadService.uploadBuffer(
          logoFile.buffer,
          "uploads/organization-logo"
        );
        console.log("New logo upload result:", uploadResult);

        // Update organization with new logo URL
        const updateResult = await OrganizationRepository.update(id, {
          logo: uploadResult.url,
        });

        if (!updateResult.success) {
          // If organization update fails, delete the newly uploaded logo
          try {
            await CloudinaryUploadService.deleteFromCloudinary(
              uploadResult.url,
              "image"
            );
          } catch (cleanupError) {
            console.error(
              "Failed to cleanup new logo after update failure:",
              cleanupError
            );
          }
          res.status(400).json(updateResult);
          return;
        }

        // If update successful and there was an old logo, delete it
        if (oldLogoUrl) {
          console.log("Deleting old logo:", oldLogoUrl);
          try {
            await CloudinaryUploadService.deleteFromCloudinary(
              oldLogoUrl,
              "image"
            );
            console.log("Successfully deleted old logo");
          } catch (deleteError) {
            // Don't fail the request if old logo deletion fails
            console.error("Failed to delete old logo:", deleteError);
          }
        } else {
          console.log("ℹ️  No old logo to delete");
        }

        console.log("=== END UPDATE LOGO DEBUG ===");
        res.status(200).json({
          success: true,
          data: updateResult.data,
          message: "Logo updated successfully",
        });
      } catch (uploadError) {
        console.error("Logo upload error:", uploadError);
        res.status(500).json({
          success: false,
          message: "Failed to upload new logo",
          error:
            uploadError instanceof Error
              ? uploadError.message
              : "Unknown error",
        });
      }
    } catch (error) {
      console.error("Logo update error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  /**
   * Update an organization's supporting document
   * @route PATCH /organizations/:id/supporting-document
   * @access Protected
   */
  static async updateSupportingDocument(
    req: Request,
    res: Response
  ): Promise<void> {
    const { id } = req.params;
    if (!id || !OrganizationRepository.UUID_REGEX.test(id)) {
      res
        .status(400)
        .json({ success: false, message: "Valid organization ID is required" });
      return;
    }
    if (!req.file) {
      res.status(400).json({
        success: false,
        message: "Supporting document file is required",
      });
      return;
    }
    const allowedTypes = [
      "application/pdf",
      "image/jpeg",
      "image/png",
      "image/jpg",
      "image/gif",
      "image/webp",
    ];
    if (!allowedTypes.includes(req.file.mimetype)) {
      res.status(400).json({
        success: false,
        message:
          "Only PDF and image files are allowed as supporting documents.",
      });
      return;
    }
    try {
      // Fetch the current organization to get the old document URL
      const orgResult = await OrganizationRepository.getById(id);
      const oldDocUrl = orgResult.data?.supportingDocument;
      if (!orgResult.success || !orgResult.data) {
        res
          .status(404)
          .json({ success: false, message: "Organization not found" });
        return;
      }
      if (oldDocUrl) {
        const resourceType = oldDocUrl.endsWith(".pdf") ? "raw" : "image";
        try {
          await CloudinaryUploadService.deleteFromCloudinary(
            oldDocUrl,
            resourceType
          );
        } catch (deleteErr) {
          console.warn(
            "❌ Failed to delete old document, but update was successful:",
            deleteErr
          );
          // Don't fail the entire operation if old document deletion fails
        }
      } else {
        console.log("ℹ️  No old document to delete");
      }
      const uploadResult = await CloudinaryUploadService.uploadBuffer(
        req.file.buffer,
        "uploads/organization-supporting-document"
      );
      const result = await OrganizationRepository.update(id, {
        supportingDocument: uploadResult.url,
      });
      if (!result.success) {
        res.status(400).json(result);
        return;
      }
      res.status(200).json({
        success: true,
        data: result.data,
        message: "Supporting document updated successfully.",
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Failed to update supporting document.",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  /**
   * Delete an organization and all its associated data
   * @route DELETE /organizations/:id
   * @access Admin Only
   */
  static async delete(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const isAdmin = req.user?.isAdmin;

    // Check if user is admin
    if (!isAdmin) {
      res.status(403).json({
        success: false,
        message: "Only administrators can delete organizations",
      });
      return;
    }

    // Validate organization ID
    if (!id || !OrganizationRepository.UUID_REGEX.test(id)) {
      res.status(400).json({
        success: false,
        message: "Valid organization ID is required",
      });
      return;
    }

    try {
      console.log("=== DELETE ORGANIZATION DEBUG ===");
      console.log("Organization ID:", id);

      // First check if organization exists with its venues and users
      const orgCheck = await OrganizationRepository.getById(id);
      if (!orgCheck.success || !orgCheck.data) {
        res.status(404).json({
          success: false,
          message: "Organization not found",
        });
        return;
      }

      const organization = orgCheck.data;
      console.log("Organization found with:", {
        venueCount: organization.venues?.length || 0,
        userCount: organization.users?.length || 0,
      });

      // 1. First remove all venues from the organization
      if (organization.venues && organization.venues.length > 0) {
        const venueIds = organization.venues.map((v) => v.venueId);
        console.log("Removing venues:", venueIds);

        const venueResult =
          await OrganizationRepository.removeVenuesFromOrganization(
            venueIds,
            id
          );

        if (!venueResult.success) {
          console.error("Failed to remove venues:", venueResult.message);
          res.status(500).json({
            success: false,
            message: "Failed to remove associated venues",
          });
          return;
        }
        console.log("Successfully removed all venues");
      }

      // 2. Then remove all users from the organization
      if (organization.users && organization.users.length > 0) {
        console.log(
          "Removing users:",
          organization.users.map((u) => u.userId)
        );
        const userResult =
          await OrganizationRepository.removeUsersFromOrganization(
            organization.users.map((u) => u.userId),
            id
          );
        if (!userResult.success) {
          console.error("Failed to remove users:", userResult.message);
          res.status(500).json({
            success: false,
            message: "Failed to remove associated users",
          });
          return;
        }
        console.log("Successfully removed users");
      }

      // 3. Finally delete the organization itself
      console.log("Deleting organization");
      const deleteResult = await OrganizationRepository.delete(id);

      console.log("Delete result:", deleteResult);
      console.log("=== END DELETE ORGANIZATION DEBUG ===");

      if (deleteResult.success) {
        res.status(200).json({
          success: true,
          message: "Organization and all associated data deleted successfully",
        });
      } else {
        res.status(400).json({
          success: false,
          message: deleteResult.message || "Failed to delete organization",
        });
      }
    } catch (error) {
      console.error(
        `[OrganizationController Delete Error] Org ID: ${id}:`,
        error
      );
      res.status(500).json({
        success: false,
        message: "Internal server error",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  /**
   * Assign users to an organization
   * @route POST /organizations/:id/users
   * @access Admin Only
   */
  static async assignUsers(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const { userIds }: { userIds: string[] } = req.body;
    const isAdmin = req.user?.isAdmin;

    // Check if user is admin
    if (!isAdmin) {
      res.status(403).json({
        success: false,
        message: "Only administrators can assign users to organizations",
      });
      return;
    }

    // Validate organization ID
    if (!id || !OrganizationRepository.UUID_REGEX.test(id)) {
      res.status(400).json({
        success: false,
        message: "Valid organization ID is required",
      });
      return;
    }

    // Validate user IDs array
    if (!Array.isArray(userIds) || userIds.length === 0) {
      res.status(400).json({
        success: false,
        message: "At least one user ID is required",
      });
      return;
    }

    // Validate each user ID format
    if (userIds.some((uid) => !OrganizationRepository.UUID_REGEX.test(uid))) {
      res.status(400).json({
        success: false,
        message: "One or more user IDs are invalid",
      });
      return;
    }

    try {
      console.log("=== ASSIGN USERS DEBUG ===");
      console.log("Organization ID:", id);
      console.log("Users to assign:", userIds);

      // First check if organization exists and is approved
      const orgCheck = await OrganizationRepository.getById(id);
      if (!orgCheck.success || !orgCheck.data) {
        res.status(404).json({
          success: false,
          message: "Organization not found",
        });
        return;
      }

      // Check organization status
      if (orgCheck.data.status !== OrganizationStatusEnum.APPROVED) {
        res.status(400).json({
          success: false,
          message: `Cannot assign users to organization with status: ${orgCheck.data.status}. Organization must be APPROVED.`,
        });
        return;
      }

      // Attempt to assign users
      const result = await OrganizationRepository.assignUsersToOrganization(
        userIds,
        id
      );

      console.log("Assignment result:", result);
      console.log("=== END ASSIGN USERS DEBUG ===");

      if (result.success) {
        res.status(200).json({
          success: true,
          data: result.data,
          message:
            result.message || "Users successfully assigned to organization",
        });
      } else {
        // Handle different failure scenarios
        if (result.message?.includes("already assigned")) {
          res.status(409).json({
            success: false,
            message: result.message,
          });
        } else if (result.message?.includes("not found")) {
          res.status(404).json({
            success: false,
            message: result.message,
          });
        } else {
          res.status(400).json({
            success: false,
            message: result.message || "Failed to assign users to organization",
          });
        }
      }
    } catch (error) {
      console.error(
        `[OrganizationController AssignUsers Error] Org ID: ${id}:`,
        error
      );
      res.status(500).json({
        success: false,
        message: "Internal server error",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  /**
   * Remove users from an organization
   * @route DELETE /organizations/:id/users
   * @access Admin Only
   */
  static async removeUsers(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const { userIds }: { userIds: string[] } = req.body;
    const isAdmin = req.user?.isAdmin;

    // Check if user is admin
    if (!isAdmin) {
      res.status(403).json({
        success: false,
        message: "Only administrators can remove users from organizations",
      });
      return;
    }

    // Validate organization ID
    if (!id || !OrganizationRepository.UUID_REGEX.test(id)) {
      res.status(400).json({
        success: false,
        message: "Valid organization ID is required",
      });
      return;
    }

    // Validate user IDs array
    if (!Array.isArray(userIds) || userIds.length === 0) {
      res.status(400).json({
        success: false,
        message: "At least one user ID is required",
      });
      return;
    }

    // Validate each user ID format
    if (userIds.some((uid) => !OrganizationRepository.UUID_REGEX.test(uid))) {
      res.status(400).json({
        success: false,
        message: "One or more user IDs are invalid",
      });
      return;
    }

    try {
      console.log("=== REMOVE USERS DEBUG ===");
      console.log("Organization ID:", id);
      console.log("Users to remove:", userIds);

      // First check if organization exists
      const orgCheck = await OrganizationRepository.getById(id);
      if (!orgCheck.success || !orgCheck.data) {
        res.status(404).json({
          success: false,
          message: "Organization not found",
        });
        return;
      }

      // Check if any of the users to be removed are the last admin of the organization
      const orgUsers = await OrganizationRepository.getUsersByOrganization(id);
      if (orgUsers.success && orgUsers.data) {
        const adminUsers = orgUsers.data.filter(
          (user) => user.role.roleName === "ADMIN"
        );
        if (adminUsers.length > 0) {
          const remainingAdmins = adminUsers.filter(
            (admin) => !userIds.includes(admin.userId)
          );
          if (remainingAdmins.length === 0) {
            res.status(400).json({
              success: false,
              message: "Cannot remove all admin users from the organization",
            });
            return;
          }
        }
      }

      // Attempt to remove users
      const result = await OrganizationRepository.removeUsersFromOrganization(
        userIds,
        id
      );

      console.log("Removal result:", result);
      console.log("=== END REMOVE USERS DEBUG ===");

      if (result.success) {
        res.status(200).json({
          success: true,
          data: result.data,
          message:
            result.message || "Users successfully removed from organization",
        });
      } else {
        // Handle different failure scenarios
        if (result.message?.includes("not found")) {
          res.status(404).json({
            success: false,
            message: result.message,
          });
        } else if (result.message?.includes("Cannot remove")) {
          res.status(400).json({
            success: false,
            message: result.message,
          });
        } else {
          res.status(400).json({
            success: false,
            message:
              result.message || "Failed to remove users from organization",
          });
        }
      }
    } catch (error) {
      console.error(
        `[OrganizationController RemoveUsers Error] Org ID: ${id}:`,
        error
      );
      res.status(500).json({
        success: false,
        message: "Internal server error",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  /**
   * Get users for an organization
   * @route GET /organizations/:id/users
   * @access Protected
   */
  static async getUsers(req: Request, res: Response): Promise<void> {
    const { id } = req.params;

    if (!id || !OrganizationRepository.UUID_REGEX.test(id)) {
      res
        .status(400)
        .json({ success: false, message: "Valid organization ID is required" });
      return;
    }

    try {
      const result = await OrganizationRepository.getUsersByOrganization(id);
      res.status(result.success ? 200 : 404).json(result);
    } catch (error) {
      console.error(
        `[OrganizationController GetUsers Error] Org ID: ${id}:`,
        error
      );
      res.status(500).json({
        success: false,
        message: "Internal server error",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  /**
   * Add one or more venues to an organization
   * @route POST /organizations/:organizationId/venues
   * @access Protected
   */
  static async addVenues(req: Request, res: Response): Promise<void> {
    const { organizationId } = req.params;
    const { venueIds }: { venueIds: string[] } = req.body;

    if (
      !organizationId ||
      !OrganizationRepository.UUID_REGEX.test(organizationId)
    ) {
      res.status(400).json({
        success: false,
        message: "Valid organization ID (UUID) is required.",
      });
      return;
    }

    if (
      !Array.isArray(venueIds) ||
      venueIds.length === 0 ||
      venueIds.some((vid) => !OrganizationRepository.UUID_REGEX.test(vid))
    ) {
      res.status(400).json({
        success: false,
        message: "A valid array of venue IDs (UUIDs) is required.",
      });
      return;
    }

    try {
      const result = await OrganizationRepository.addVenuesToOrganization(
        organizationId,
        venueIds
      );
      if (result.success) {
        res.status(200).json(result); // 200 OK, message indicates if any were already assigned
      } else {
        // More specific error handling based on repository message
        if (result.message === "Organization not found") {
          res.status(404).json(result);
        } else if (
          result.message.includes("Venue") &&
          result.message.includes("already assigned to another organization")
        ) {
          res.status(409).json(result); // Conflict
        } else if (result.message.includes("venue(s) not found")) {
          res.status(404).json(result); // Specific venues not found
        } else {
          res.status(400).json(result); // Generic bad request
        }
      }
    } catch (error) {
      console.error(
        `[OrganizationController AddVenues Error] Org ID: ${organizationId}:`,
        error
      );
      res.status(500).json({
        success: false,
        message:
          "Internal server error occurred while adding venues to organization.",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  /**
   * Remove one or more venues from an organization
   * @route DELETE /organizations/:organizationId/venues
   * @access Protected
   */
  static async removeVenues(req: Request, res: Response): Promise<void> {
    const { organizationId } = req.params;
    const { venueIds }: { venueIds: string[] } = req.body; // Using body for DELETE with payload

    if (
      !organizationId ||
      !OrganizationRepository.UUID_REGEX.test(organizationId)
    ) {
      res.status(400).json({
        success: false,
        message: "Valid organization ID (UUID) is required.",
      });
      return;
    }

    if (
      !Array.isArray(venueIds) ||
      venueIds.length === 0 ||
      venueIds.some((vid) => !OrganizationRepository.UUID_REGEX.test(vid))
    ) {
      res.status(400).json({
        success: false,
        message: "A valid array of venue IDs (UUIDs) is required.",
      });
      return;
    }

    try {
      const result = await OrganizationRepository.removeVenuesFromOrganization(
        venueIds,
        organizationId
      );
      if (result.success) {
        res.status(200).json(result);
      } else {
        // More specific error handling based on repository message
        if (result.message === "Organization not found") {
          res.status(404).json(result);
        } else if (
          result.message.includes(
            "No specified venues found linked to this organization to remove"
          )
        ) {
          res.status(404).json(result); // Or 200 with a message if it's considered non-error
        } else {
          res.status(400).json(result);
        }
      }
    } catch (error) {
      console.error(
        `[OrganizationController RemoveVenues Error] Org ID: ${organizationId}:`,
        error
      );
      res.status(500).json({
        success: false,
        message:
          "Internal server error occurred while removing venues from organization.",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  /**
   * Enable an organization
   * @route PATCH /organizations/:id/enable-status
   * @access Admin Only
   */
  static async enableStatus(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const isAdmin = req.user?.isAdmin;

    // Check if user is admin
    if (!isAdmin) {
      res.status(403).json({
        success: false,
        message: "Only administrators can enable organizations",
      });
      return;
    }

    try {
      console.log("=== ENABLE ORGANIZATION STATUS DEBUG ===");

      const result = await OrganizationRepository.enableOrganization(id);

      console.log("Enable result:", result);
      console.log("=== END ENABLE ORGANIZATION STATUS DEBUG ===");

      if (result.success) {
        res.status(200).json({
          success: true,
          data: result.data,
          message: result.message,
        });
      } else {
        res.status(result.data ? 400 : 404).json({
          success: false,
          message: result.message,
        });
      }
    } catch (error) {
      console.error(
        `[OrganizationController EnableStatus Error] ID: ${id}:`,
        error
      );
      res.status(500).json({
        success: false,
        message: "Internal server error",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  /**
   * Disable an organization
   * @route PATCH /organizations/:id/disable-status
   * @access Admin Only
   */
  static async disableStatus(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const isAdmin = req.user?.isAdmin;

    // Check if user is admin
    if (!isAdmin) {
      res.status(403).json({
        success: false,
        message: "Only administrators can disable organizations",
      });
      return;
    }

    try {
      console.log("=== DISABLE ORGANIZATION STATUS DEBUG ===");

      const result = await OrganizationRepository.disableOrganization(id);

      console.log("Disable result:", result);
      console.log("=== END DISABLE ORGANIZATION STATUS DEBUG ===");

      if (result.success) {
        res.status(200).json({
          success: true,
          data: result.data,
          message: result.message,
        });
      } else {
        res.status(result.data ? 400 : 404).json({
          success: false,
          message: result.message,
        });
      }
    } catch (error) {
      console.error(
        `[OrganizationController DisableStatus Error] ID: ${id}:`,
        error
      );
      res.status(500).json({
        success: false,
        message: "Internal server error",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  /**
   * Get organization venues with status check
   * @route GET /organizations/:organizationId/venues
   * @access Protected - Admin can see all, users can only see venues from enabled organizations
   */
  static async getOrganizationVenues(
    req: Request,
    res: Response
  ): Promise<void> {
    const { organizationId } = req.params;
    const isAdmin = req.user?.isAdmin;

    if (
      !organizationId ||
      !OrganizationRepository.UUID_REGEX.test(organizationId)
    ) {
      res.status(400).json({
        success: false,
        message: "Valid organization ID (UUID) is required.",
      });
      return;
    }

    try {
      console.log("=== GET ORGANIZATION VENUES DEBUG ===");
      console.log("Organization ID:", organizationId);
      console.log("User Role:", isAdmin ? "ADMIN" : "REGULAR USER");

      const result = await OrganizationRepository.getById(organizationId);

      if (!result.success || !result.data) {
        res.status(404).json({
          success: false,
          message: "Organization not found",
        });
        return;
      }

      // Check organization status for non-admin users
      if (!isAdmin && result.data.status === OrganizationStatusEnum.DISABLED) {
        res.status(403).json({
          success: false,
          message: "This organization is currently disabled",
        });
        return;
      }

      console.log("Organization Status:", result.data.status);
      console.log("=== END GET ORGANIZATION VENUES DEBUG ===");

      res.status(200).json({
        success: true,
        data: {
          venues: result.data.venues || [],
          users: isAdmin ? result.data.users || [] : [], // Only send users data to admin
        },
        message:
          result.data.venues?.length > 0
            ? "Venues retrieved successfully"
            : "No venues found for this organization",
      });
    } catch (error) {
      console.error(
        `[OrganizationController GetOrganizationVenues Error] Org ID: ${organizationId}:`,
        error
      );
      res.status(500).json({
        success: false,
        message:
          "Internal server error occurred while fetching venues for organization.",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  static async approve(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const result = await OrganizationRepository.approveOrganization(id);
    if (result.success) {
      res
        .status(200)
        .json({ success: true, message: result.message, data: result.data });
    } else {
      res.status(400).json({ success: false, message: result.message });
    }
  }

  static async reject(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const { reason } = req.body;
    const result = await OrganizationRepository.rejectOrganization(id, reason);
    if (result.success) {
      res
        .status(200)
        .json({ success: true, message: result.message, data: result.data });
    } else {
      res.status(400).json({ success: false, message: result.message });
    }
  }

  static async getOrganizationsByUserId(
    req: Request,
    res: Response
  ): Promise<void> {
    const { userId } = req.params;
    if (!userId || !OrganizationRepository.UUID_REGEX.test(userId)) {
      res
        .status(400)
        .json({ success: false, message: "Valid user ID is required" });
      return;
    }
    try {
      const result = await OrganizationRepository.getOrganizationsByUserId(
        userId
      );
      if (result.success && result.data) {
        if (Array.isArray(result.data)) {
          if (result.data.length === 1) {
            res.status(200).json({ success: true, data: result.data[0] });
          } else {
            res.status(200).json({ success: true, data: result.data });
          }
        } else {
          res.status(200).json({ success: true, data: result.data });
        }
      } else {
        res.status(200).json({ success: true, data: [] });
      }
    } catch (error) {
      console.error(
        `[OrganizationController GetOrganizationsByUserId Error] User ID: ${userId}:`,
        error
      );
      res.status(500).json({
        success: false,
        message: "Internal server error",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  /**
   * Get public organization details including venues and events
   * @route GET /organizations/public/:id
   * @access Public
   */
  static async getPublicDetails(req: Request, res: Response): Promise<void> {
    const { id } = req.params;

    if (!id || !OrganizationRepository.UUID_REGEX.test(id)) {
      res.status(400).json({
        success: false,
        message: "Valid organization ID is required",
      });
      return;
    }

    try {
      const result = await OrganizationRepository.getPublicDetails(id);

      if (!result.success || !result.data) {
        res.status(404).json({
          success: false,
          message: "Organization not found or not accessible",
        });
        return;
      }

      // Only return public-safe data
      const {
        organizationId,
        organizationName,
        description,
        logo,
        address,
        city,
        country,
        members,
        venues,
        events,
      } = result.data;

      res.status(200).json({
        success: true,
        data: {
          organizationId,
          organizationName,
          description,
          logo,
          address,
          city,
          country,
          members,
          venues:
            venues?.map((venue) => ({
              venueId: venue.venueId,
              venueName: venue.venueName,
              description: venue.venueLocation,
              address: venue.venueLocation,
              capacity: venue.capacity,
              images: venue.photoGallery || [],
            })) || [],
          events:
            events?.map((event) => ({
              eventId: event.eventId,
              eventName: event.eventName,
              description: event.description,
              startDate: event.startDate,
              endDate: event.endDate,
              eventType: event.eventType,
              status: event.status,
            })) || [],
        },
      });
    } catch (error) {
      console.error(
        `[OrganizationController GetPublicDetails Error] ID: ${id}:`,
        error
      );
      res.status(500).json({
        success: false,
        message: "Internal server error",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  /**
   * Get all public organizations with their venues and events
   * @route GET /organizations/public
   * @access Public
   */
  static async getAllPublicOrganizations(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const result = await OrganizationRepository.getAllPublicOrganizations();

      if (!result.success) {
        res.status(500).json({
          success: false,
          message: result.message || "Failed to fetch public organizations",
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: result.data,
        message: result.message,
      });
    } catch (error) {
      console.error("[OrganizationController GetAllPublic Error]:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
}
