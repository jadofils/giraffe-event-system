import { Request, Response } from "express";
import { OrganizationRepository } from "../repositories/OrganizationRepository";
import { OrganizationInterface } from "../interfaces/OrganizationInterface";
import { AuthenticatedRequest } from "../middlewares/AuthMiddleware";

export class OrganizationController {
  private static readonly UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

    if (!id || !this.UUID_REGEX.test(id)) {
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
   * Create a new organization
   * @route POST /organizations
   * @access Protected
   */
  static async create(req: AuthenticatedRequest, res: Response): Promise<void> {
    const data: Partial<OrganizationInterface> = req.body;

    if (!data.organizationName || !data.contactEmail || !data.address || !data.organizationType) {
      res.status(400).json({
        success: false,
        message: "Required fields (name, email, address, type) are missing",
      });
      return;
    }

    try {
      const created = OrganizationRepository.create(data);
      if (!created.success) {
        res.status(400).json(created);
        return;
      }

      const saved = await OrganizationRepository.save(created.data!);
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

    if (!id || !this.UUID_REGEX.test(id)) {
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
  static async bulkUpdate(req: AuthenticatedRequest, res: Response): Promise<void> {
    const updates: { id: string; data: Partial<OrganizationInterface> }[] = req.body.updates;

    if (!updates?.length) {
      res.status(400).json({
        success: false,
        message: "At least one organization update is required",
      });
      return;
    }

    try {
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

    if (!id || !this.UUID_REGEX.test(id)) {
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

    if (!id || !this.UUID_REGEX.test(id)) {
      res.status(400).json({ success: false, message: "Valid organization ID is required" });
      return;
    }

    if (!userIds?.length || userIds.some((uid) => !this.UUID_REGEX.test(uid))) {
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

    if (!id || !this.UUID_REGEX.test(id)) {
      res.status(400).json({ success: false, message: "Valid organization ID is required" });
      return;
    }

    if (!userIds?.length || userIds.some((uid) => !this.UUID_REGEX.test(uid))) {
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

    if (!id || !this.UUID_REGEX.test(id)) {
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