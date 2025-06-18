import { Request, Response } from "express";
import { OrganizationRepository } from "../repositories/OrganizationRepository";
import { OrganizationInterface } from "../interfaces/OrganizationInterface";
import { AuthenticatedRequest } from "../middlewares/AuthMiddleware";
import { AppDataSource } from "../config/Database";
import { User } from "../models/User";

export class OrganizationController {
  private static readonly UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  /**
   * Get all organizations
   * @route GET /organizations
   * @access Protected
   */
  static async getAll(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      // Check if user is authenticated
      if (!req.user || !req.user.userId) {
        res.status(401).json({ success: false, message: "Unauthorized: User not authenticated" });
        return;
      }

      const result = await OrganizationRepository.getAll();
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
  static async getById(req: AuthenticatedRequest, res: Response): Promise<void> {
    const { id } = req.params;

    if (!id || !OrganizationController.UUID_REGEX.test(id)) {
      res.status(400).json({ success: false, message: "Valid organization ID is required" });
      return;
    }

    // Check if user is authenticated
    if (!req.user || !req.user.userId) {
      res.status(401).json({ success: false, message: "Unauthorized: User not authenticated" });
      return;
    }

    try {
      // Verify user has access to the organization
      const userRepo = AppDataSource.getRepository(User);
      const user = await userRepo.findOne({
        where: { userId: req.user.userId },
        relations: ["organizations"],
      });

      if (!user) {
        res.status(401).json({ success: false, message: "Unauthorized: User not found" });
        return;
      }

      const hasAccess = user.organizations.some((org) => org.organizationId === id);
      if (!hasAccess) {
        res.status(403).json({
          success: false,
          message: "Forbidden: You don't have access to this organization",
        });
        return;
      }

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
   * Create a new organization or multiple organizations
   * @route POST /organizations
   * @access Protected
   */
  static async create(req: AuthenticatedRequest, res: Response): Promise<void> {
    const data = req.body;

    // Check if user is authenticated
    if (!req.user || !req.user.userId) {
      res.status(401).json({ success: false, message: "Unauthorized: User not authenticated" });
      return;
    }

    try {
      // Handle array input
      if (Array.isArray(data)) {
        if (!data.length) {
          res.status(400).json({
            success: false,
            message: "At least one organization is required",
          });
          return;
        }
        const result = await OrganizationRepository.bulkCreate(data);
        if (result.success) {
          // Assign the creating user to all created organizations
          for (const org of result.data || []) {
            await OrganizationRepository.assignUsersToOrganization([req.user.userId], org.organizationId);
          }
        }
        res.status(result.success ? 201 : 400).json(result);
        return;
      }

      // Handle single object input
      if (!data.organizationName || !data.contactEmail || !data.address || !data.organizationType) {
        res.status(400).json({
          success: false,
          message: "Required fields (name, email, address, type) are missing",
        });
        return;
      }

      const created = OrganizationRepository.create(data);
      if (!created.success) {
        res.status(400).json(created);
        return;
      }

      const saved = await OrganizationRepository.save(created.data!);
      if (saved.success) {
        // Assign the creating user to the organization
        await OrganizationRepository.assignUsersToOrganization([req.user.userId], saved.data!.organizationId);
      }
      res.status(saved.success ? 201 : saved.data ? 400 : 500).json(saved);
    } catch (error) {
      console.error("[OrganizationController Create Error]:", error);
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
  static async bulkCreate(req: AuthenticatedRequest, res: Response): Promise<void> {
    const { organizations }: { organizations: Partial<OrganizationInterface>[] } = req.body;

    if (!organizations?.length) {
      res.status(400).json({
        success: false,
        message: "At least one organization is required",
      });
      return;
    }

    // Check if user is authenticated
    if (!req.user || !req.user.userId) {
      res.status(401).json({ success: false, message: "Unauthorized: User not authenticated" });
      return;
    }

    try {
      const result = await OrganizationRepository.bulkCreate(organizations);
      if (result.success) {
        // Assign the creating user to all created organizations
        for (const org of result.data || []) {
          await OrganizationRepository.assignUsersToOrganization([req.user.userId], org.organizationId);
        }
      }
      res.status(result.success ? 201 : 400).json(result);
    } catch (error) {
      console.error("[OrganizationController BulkCreate Error]:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  /**
   * Update an organization with support for array inputs
   * @route PUT /organizations/:id
   * @access Protected
   */
  static async update(req: AuthenticatedRequest, res: Response): Promise<void> {
    const { id } = req.params;
    const data = req.body;

    if (!id || !OrganizationController.UUID_REGEX.test(id)) {
      res.status(400).json({ success: false, message: "Valid organization ID is required" });
      return;
    }

    // Check if user is authenticated
    if (!req.user || !req.user.userId) {
      res.status(401).json({ success: false, message: "Unauthorized: User not authenticated" });
      return;
    }

    try {
      // Verify user has access to the organization
      const userRepo = AppDataSource.getRepository(User);
      const user = await userRepo.findOne({
        where: { userId: req.user.userId },
        relations: ["organizations"],
      });

      if (!user) {
        res.status(401).json({ success: false, message: "Unauthorized: User not found" });
        return;
      }

      const hasAccess = user.organizations.some((org) => org.organizationId === id);
      if (!hasAccess) {
        res.status(403).json({
          success: false,
          message: "Forbidden: You don't have access to this organization",
        });
        return;
      }

      // Validate allowed fields
      const allowedFields: (keyof OrganizationInterface)[] = [
        "organizationName",
        "description",
        "contactEmail",
        "contactPhone",
        "address",
        "organizationType",
        "city",
        "country",
        "postalCode",
        "stateProvince",
      ];

      // Handle array input
      if (Array.isArray(data)) {
        res.status(400).json({
          success: false,
          message: "Array of objects not supported for single organization update; use PUT /organizations/bulk",
        });
        return;
      }

      // Handle object with array values
      const result = await OrganizationRepository.updateWithArray(id, data);
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
  static async bulkUpdate(req: AuthenticatedRequest, res: Response): Promise<void> {
    const { updates }: { updates: { id: string; data: Partial<OrganizationInterface> }[] } = req.body;

    if (!updates?.length) {
      res.status(400).json({
        success: false,
        message: "At least one organization update is required",
      });
      return;
    }

    // Check if user is authenticated
    if (!req.user || !req.user.userId) {
      res.status(401).json({ success: false, message: "Unauthorized: User not authenticated" });
      return;
    }

    try {
      // Verify user has access to all organizations
      const userRepo = AppDataSource.getRepository(User);
      const user = await userRepo.findOne({
        where: { userId: req.user.userId },
        relations: ["organizations"],
      });

      if (!user) {
        res.status(401).json({ success: false, message: "Unauthorized: User not found" });
        return;
      }

      const orgIds = updates.map((update) => update.id);
      const hasAccess = orgIds.every((id) =>
        user.organizations.some((org) => org.organizationId === id)
      );
      if (!hasAccess) {
        res.status(403).json({
          success: false,
          message: "Forbidden: You don't have access to one or more organizations",
        });
        return;
      }

      // Validate allowed fields for each update
      const allowedFields: (keyof OrganizationInterface)[] = [
        "organizationName",
        "description",
        "contactEmail",
        "contactPhone",
        "address",
        "organizationType",
        "city",
        "country",
        "postalCode",
        "stateProvince",
      ];

      for (const update of updates) {
        if (!update.id || !OrganizationController.UUID_REGEX.test(update.id)) {
          res.status(400).json({ success: false, message: `Invalid organization ID: ${update.id}` });
          return;
        }
        const invalidFields = Object.keys(update.data).filter(
          (key) => !allowedFields.includes(key as keyof OrganizationInterface)
        );
        if (invalidFields.length) {
          res.status(400).json({
            success: false,
            message: `Invalid fields provided for organization ${update.id}: ${invalidFields.join(", ")}`,
          });
          return;
        }
      }

      const result = await OrganizationRepository.bulkUpdate(updates);
      res.status(result.success ? 200 : 400).json(result);
    } catch (error) {
      console.error("[OrganizationController BulkUpdate Error]:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  /**
   * Delete an organization
   * @route DELETE /organizations/:id
   * @access Protected
   */
  static async delete(req: AuthenticatedRequest, res: Response): Promise<void> {
    const { id } = req.params;

    if (!id || !OrganizationController.UUID_REGEX.test(id)) {
      res.status(400).json({ success: false, message: "Valid organization ID is required" });
      return;
    }

    // Check if user is authenticated
    if (!req.user || !req.user.userId) {
      res.status(401).json({
        success: false,
        message: "Unauthorized: User not authenticated",
      });
      return;
    }

    try {
      // Verify user has access to the organization
      const userRepo = AppDataSource.getRepository(User);
      const user = await userRepo.findOne({
        where: { userId: req.user.userId },
        relations: ["organizations"],
      });

      if (!user) {
        res.status(401).json({ success: false, message: "Unauthorized: User not found" });
        return;
      }

      const hasAccess = user.organizations.some((org) => org.organizationId === id);
      if (!hasAccess) {
        res.status(403).json({
          success: false,
          message: "Forbidden: You don't have access to this organization",
        });
        return;
      }

      // Attempt to delete the organization
      const result = await OrganizationRepository.delete(id);
      if (!result.success) {
        // Check if the error is due to associated users
        if (result.message?.includes("Cannot delete")) {
          const usersInOrg = await OrganizationRepository.getUsersByOrganization(id);
          res.status(400).json({
            success: false,
            message: result.message,
            data: usersInOrg.success
              ? usersInOrg.data?.map((user) => ({ userId: user.userId, email: user.email }))
              : [],
          });
          return;
        }
        res.status(404).json(result);
        return;
      }

      res.status(200).json(result);
    } catch (error) {
      console.error(`[OrganizationController Delete Error] ID: ${id}, User: ${req.user.userId}:`, error);
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
   * @access Protected
   */
  static async assignUsers(req: AuthenticatedRequest, res: Response): Promise<void> {
    const { id } = req.params;
    const { userIds }: { userIds: string[] } = req.body;

    if (!id || !OrganizationController.UUID_REGEX.test(id)) {
      res.status(400).json({ success: false, message: "Valid organization ID is required" });
      return;
    }

    if (!userIds?.length || userIds.some((uid) => !OrganizationController.UUID_REGEX.test(uid))) {
      res.status(400).json({ success: false, message: "Valid user IDs are required" });
      return;
    }

    // Check if user is authenticated
    if (!req.user || !req.user.userId) {
      res.status(401).json({
        success: false,
        message: "Unauthorized: User not authenticated",
      });
      return;
    }

    try {
      // Verify user has access to
      const userRepo = AppDataSource.getRepository(User);
      const user = await userRepo.findOne({
        where: { userId: req.user.userId },
        relations: ["organizations"],
      });

      if (!user) {
        res.status(401).json({
          success: false,
          message: "Unauthorized: User not found",
        });
        return;
      }

      const hasAccess = user.organizations.some((org) => org.organizationId === id);
      if (!hasAccess) {
        res.status(403).json({
          success: false,
          message: "Forbidden: You don't have access to this organization",
        });
        return;
      }

      const result = await OrganizationRepository.assignUsersToOrganization(userIds, id);
      res.status(result.success ? 200 : result.data ? 400 : 404).json(result);
    } catch (error) {
      console.error(`[OrganizationController AssignUsers Error] Org ID: ${id}, User: ${req.user.userId}:`, error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  /**
   * Remove users from an organization
   * @route DELETE /organizations/:id/users/:id/users
   * @access Protected
   */
  static async removeUsers(req: AuthenticatedRequest, res: Response): Promise<void> {
    const { id } = req.params;
    const { userIds }: { userIds: string[] } = req.body;

    if (!id || !OrganizationController.UUID_REGEX.test(id)) {
      res.status(400).json({ success: false, message: "Valid organization ID is required" });
      return;
    }

    if (!userIds?.length || userIds.some((uid) => !OrganizationController.UUID_REGEX.test(uid))) {
      res.status(400).json({ success: false, message: "Valid user IDs are required" });
      return;
    }

    // Check if user is authenticated
    if (!req.user || !req.user.userId) {
      res.status(401).json({
        success: false,
        message: "Unauthorized: User not authenticated",
      });
      return;
    }

    try {
      // Verify user has access to the organization
      const userRepo = AppDataSource.getRepository(User);
      const user = await userRepo.findOne({
        where: { userId: req.user.userId },
        relations: ["organizations"],
      });

      if (!user) {
        res.status(401).json({
          success: false,
          message: "Unauthorized: User not found",
        });
        return;
      }

      const hasAccess = user.organizations.some((org) => org.organizationId === id);
      if (!hasAccess) {
        res.status(403).json({
          success: false,
          message: "Forbidden: You don't have access to this organization",
        });
        return;
      }

      const result = await OrganizationRepository.removeUsersFromOrganization(userIds, id);
      res.status(result.success ? 200 : result.data ? 400 : 404).json(result);
    } catch (error) {
      console.error(`[OrganizationController RemoveUsers Error] Org ID: ${id}, User: ${req.user.userId}:`, error);
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
  static async getUsers(req: AuthenticatedRequest, res: Response): Promise<void> {
    const { id } = req.params;

    if (!id || !OrganizationController.UUID_REGEX.test(id)) {
      res.status(400).json({ success: false, message: "Valid organization ID is required" });
      return;
    }

    // Check if user is authenticated
    if (!req.user || !req.user.userId) {
      res.status(401).json({
        success: false,
        message: "Unauthorized: User not authenticated",
      });
      return;
    }

    try {
      // Verify user has access to the organization
      const userRepo = AppDataSource.getRepository(User);
      const user = await userRepo.findOne({
        where: { userId: req.user.userId },
        relations: ["organizations"],
      });

      if (!user) {
        res.status(401).json({
          success: false,
          message: "Unauthorized: User not found",
        });
        return;
      }

      const hasAccess = user.organizations.some((org) => org.organizationId === id);
      if (!hasAccess) {
        res.status(403).json({
          success: false,
          message: "Forbidden: You don't have access to this organization",
        });
        return;
      }

      const result = await OrganizationRepository.getUsersByOrganization(id);
      res.status(result.success ? 200 : 404).json(result);
    } catch (error) {
      console.error(`[OrganizationController GetUsers Error] Org ID: ${id}, User: ${req.user.userId}:`, error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
}