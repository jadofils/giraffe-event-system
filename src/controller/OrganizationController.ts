import { Request, Response } from "express";
import { OrganizationRepository } from "../repositories/OrganizationRepository";
import { OrganizationInterface } from "../interfaces/OrganizationInterface";
import { AuthenticatedRequest } from "../middlewares/AuthMiddleware";

export class OrganizationController {
  /**
   * Get all organizations
   * @route GET /organizations
   * @access Protected
   */
  static async getAll(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
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

    if (!id || !OrganizationRepository.UUID_REGEX.test(id)) {
      res.status(400).json({ success: false, message: "Valid organization ID is required" });
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

    try {
      const result = await OrganizationRepository.bulkCreate(organizations);
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
   * Update an organization
   * @route PUT /organizations/:id
   * @access Protected
   */
  static async update(req: AuthenticatedRequest, res: Response): Promise<void> {
    const { id } = req.params;
    const data: Partial<OrganizationInterface> = req.body;

    if (!id || !OrganizationRepository.UUID_REGEX.test(id)) {
      res.status(400).json({ success: false, message: "Valid organization ID is required" });
      return;
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
   * Delete an organization
   * @route DELETE /organizations/:id
   * @access Protected
   */
  static async delete(req: AuthenticatedRequest, res: Response): Promise<void> {
    const { id } = req.params;

    if (!id || !OrganizationRepository.UUID_REGEX.test(id)) {
      res.status(400).json({ success: false, message: "Valid organization ID is required" });
      return;
    }

    try {
      const result = await OrganizationRepository.delete(id);
      res.status(result.success ? 200 : 404).json(result);
    } catch (error) {
      console.error(`[OrganizationController Delete Error] ID: ${id}:`, error);
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

    if (!id || !OrganizationRepository.UUID_REGEX.test(id)) {
      res.status(400).json({ success: false, message: "Valid organization ID is required" });
      return;
    }

    if (!userIds?.length || userIds.some((uid) => !OrganizationRepository.UUID_REGEX.test(uid))) {
      res.status(400).json({ success: false, message: "Valid user IDs are required" });
      return;
    }

    try {
      const result = await OrganizationRepository.assignUsersToOrganization(userIds, id);
      res.status(result.success ? 200 : result.data ? 400 : 404).json(result);
    } catch (error) {
      console.error(`[OrganizationController AssignUsers Error] Org ID: ${id}:`, error);
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
   * @access Protected
   */
  static async removeUsers(req: AuthenticatedRequest, res: Response): Promise<void> {
    const { id } = req.params;
    const { userIds }: { userIds: string[] } = req.body;

    if (!id || !OrganizationRepository.UUID_REGEX.test(id)) {
      res.status(400).json({ success: false, message: "Valid organization ID is required" });
      return;
    }

    if (!userIds?.length || userIds.some((uid) => !OrganizationRepository.UUID_REGEX.test(uid))) {
      res.status(400).json({ success: false, message: "Valid user IDs are required" });
      return;
    }

    try {
      const result = await OrganizationRepository.removeUsersFromOrganization(userIds, id);
      res.status(result.success ? 200 : result.data ? 400 : 404).json(result);
    } catch (error) {
      console.error(`[OrganizationController RemoveUsers Error] Org ID: ${id}:`, error);
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

    if (!id || !OrganizationRepository.UUID_REGEX.test(id)) {
      res.status(400).json({ success: false, message: "Valid organization ID is required" });
      return;
    }

    try {
      const result = await OrganizationRepository.getUsersByOrganization(id);
      res.status(result.success ? 200 : 404).json(result);
    } catch (error) {
      console.error(`[OrganizationController GetUsers Error] Org ID: ${id}:`, error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }


}