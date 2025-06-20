import { Request, Response } from "express";
import { OrganizationRepository } from "../repositories/OrganizationRepository";
import { OrganizationInterface } from "../interfaces/OrganizationInterface";

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
  static async bulkCreate(req: Request, res: Response): Promise<void> {
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
  static async update(req: Request, res: Response): Promise<void> {
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
  static async delete(req: Request, res: Response): Promise<void> {
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
  static async assignUsers(req: Request, res: Response): Promise<void> {
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
  static async removeUsers(req: Request, res: Response): Promise<void> {
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
  static async getUsers(req: Request, res: Response): Promise<void> {
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

  /**
   * Add one or more venues to an organization
   * @route POST /organizations/:organizationId/venues
   * @access Protected
   */
  static async addVenues(req: Request, res: Response): Promise<void> {
    const { organizationId } = req.params;
    const { venueIds }: { venueIds: string[] } = req.body;

    if (!organizationId || !OrganizationRepository.UUID_REGEX.test(organizationId)) {
      res.status(400).json({ success: false, message: "Valid organization ID (UUID) is required." });
      return;
    }

    if (!Array.isArray(venueIds) || venueIds.length === 0 || venueIds.some((vid) => !OrganizationRepository.UUID_REGEX.test(vid))) {
      res.status(400).json({ success: false, message: "A valid array of venue IDs (UUIDs) is required." });
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
        } else if (result.message.includes("Venue") && result.message.includes("already assigned to another organization")) {
          res.status(409).json(result); // Conflict
        } else if (result.message.includes("venue(s) not found")) {
          res.status(404).json(result); // Specific venues not found
        } else {
          res.status(400).json(result); // Generic bad request
        }
      }
    } catch (error) {
      console.error(`[OrganizationController AddVenues Error] Org ID: ${organizationId}:`, error);
      res.status(500).json({
        success: false,
        message: "Internal server error occurred while adding venues to organization.",
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

    if (!organizationId || !OrganizationRepository.UUID_REGEX.test(organizationId)) {
      res.status(400).json({ success: false, message: "Valid organization ID (UUID) is required." });
      return;
    }

    if (!Array.isArray(venueIds) || venueIds.length === 0 || venueIds.some((vid) => !OrganizationRepository.UUID_REGEX.test(vid))) {
      res.status(400).json({ success: false, message: "A valid array of venue IDs (UUIDs) is required." });
      return;
    }

    try {
      const result = await OrganizationRepository.removeVenuesFromOrganization(
        organizationId,
        venueIds
      );
      if (result.success) {
        res.status(200).json(result);
      } else {
        // More specific error handling based on repository message
        if (result.message === "Organization not found") {
          res.status(404).json(result);
        } else if (result.message.includes("No specified venues found linked to this organization to remove")) {
            res.status(404).json(result); // Or 200 with a message if it's considered non-error
        }
        else {
          res.status(400).json(result);
        }
      }
    } catch (error) {
      console.error(`[OrganizationController RemoveVenues Error] Org ID: ${organizationId}:`, error);
      res.status(500).json({
        success: false,
        message: "Internal server error occurred while removing venues from organization.",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  // You might want a method to get venues by organization as well
  /**
   * Get venues for a specific organization
   * @route GET /organizations/:organizationId/venues
   * @access Protected
   */
  static async getOrganizationVenues(req: Request, res: Response): Promise<void> {
    const { organizationId } = req.params;

    if (!organizationId || !OrganizationRepository.UUID_REGEX.test(organizationId)) {
      res.status(400).json({ success: false, message: "Valid organization ID (UUID) is required." });
      return;
    }

    try {
      // Assuming you have a VenueRepository with a method like getVenuesByOrganizationId
      // Or you can extend the OrganizationRepository to fetch organizations with their venues
      const result = await OrganizationRepository.getById(organizationId); // Fetch organization with venues and users relation
      if (result.success && result.data) {
        res.status(200).json({
          success: true,
          data: {
            venues: result.data.venues || [],
            users: result.data.users || []
          },
          message: (result.data.venues?.length > 0 || result.data.users?.length > 0)
            ? "Venues and users retrieved successfully."
            : "No venues or users found for this organization.",
        });
      } else {
        res.status(result.message === "Organization not found" ? 404 : 400).json(result);
      }
    } catch (error) {
      console.error(`[OrganizationController GetOrganizationVenues Error] Org ID: ${organizationId}:`, error);
      res.status(500).json({
        success: false,
        message: "Internal server error occurred while fetching venues for organization.",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

}