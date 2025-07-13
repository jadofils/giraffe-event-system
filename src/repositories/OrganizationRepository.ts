import { AppDataSource } from "../config/Database";
import { Organization } from "../models/Organization";
import { OrganizationInterface } from "../interfaces/OrganizationInterface";
import { User } from "../models/User";
import { In } from "typeorm";
import { CacheService } from "../services/CacheService";
import { Venue, VenueStatus } from "../models/Venue Tables/Venue";

const CACHE_TTL = 3600; // 1 hour

export class OrganizationRepository {
  public static readonly UUID_REGEX =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  public static readonly CACHE_PREFIX = "org:";

  /**
   * Get all organizations
   * @returns List of organizations with users
   */
  static async getAll(): Promise<{
    success: boolean;
    data?: Organization[];
    message?: string;
  }> {
    try {
      const cacheKey = "org:all";
      const organizations = await CacheService.getOrSetMultiple(
        cacheKey,
        AppDataSource.getRepository(Organization),
        async () => {
          return await AppDataSource.getRepository(Organization).find({
            relations: ["users", "users.role"],
          });
        },
        CACHE_TTL
      );

      return { success: true, data: organizations };
    } catch (error) {
      console.error("[Organization Fetch Error]:", error);
      return { success: false, message: "Failed to fetch organizations" };
    }
  }

  /**
   * Get an organization by ID
   * @param id Organization UUID
   * @returns Organization with users
   */
  /**
   * Retrieves an organization by its ID, including related users and venues.
   * @param id The UUID of the organization.
   * @returns An object indicating success/failure and the organization data.
   */
  static async getById(
    id: string
  ): Promise<{ success: boolean; data?: Organization; message?: string }> {
    if (!id || !this.UUID_REGEX.test(id)) {
      return { success: false, message: "Valid organization ID is required" };
    }

    try {
      const cacheKey = `${this.CACHE_PREFIX}id:${id}:withVenuesAndUsers`; // More specific cache key
      const organization = await CacheService.getOrSetSingle(
        cacheKey,
        AppDataSource.getRepository(Organization),
        async () => {
          // Eagerly load 'users', 'users.role', and 'venues' relations
          return await AppDataSource.getRepository(Organization).findOne({
            where: { organizationId: id },
            relations: ["users", "users.role", "venues"], // FIX: Added "venues" relation here
          });
        },
        CACHE_TTL
      );

      if (!organization) {
        return { success: false, message: "Organization not found" };
      }

      return { success: true, data: organization };
    } catch (error: any) {
      console.error(`[Organization Fetch Error] ID: ${id}:`, error.message);
      return {
        success: false,
        message: `Failed to fetch organization: ${
          error.message || "Unknown error"
        }`,
      };
    }
  }

  /**
   * Create a new organization (not saved)
   * @param data Organization data
   * @returns Organization entity
   */
  static create(data: Partial<OrganizationInterface>): {
    success: boolean;
    data?: Organization;
    message?: string;
  } {
    if (
      !data.organizationName ||
      !data.contactEmail ||
      !data.address ||
      !data.organizationType
    ) {
      return {
        success: false,
        message: "Required fields (name, email, address, type) are missing",
      };
    }

    const organization = new Organization();
    organization.organizationName = data.organizationName;
    organization.description = data.description ?? "";
    organization.contactEmail = data.contactEmail;
    organization.contactPhone = data.contactPhone ?? "";
    organization.address = data.address;
    organization.organizationType = data.organizationType;
    organization.createdAt = new Date();
    organization.updatedAt = new Date();

    return { success: true, data: organization };
  }

  /**
   * Create multiple organizations
   * @param data Array of organization data
   * @returns Created organizations
   */
  static async bulkCreate(data: Partial<OrganizationInterface>[]): Promise<{
    success: boolean;
    data?: Organization[];
    message?: string;
  }> {
    if (!data.length) {
      return {
        success: false,
        message: "At least one organization is required",
      };
    }

    try {
      const repo = AppDataSource.getRepository(Organization);
      const organizations: Organization[] = [];
      const existingNames = new Set<string>();
      const existingEmails = new Set<string>();

      // Validate and create entities
      for (const item of data) {
        if (
          !item.organizationName ||
          !item.contactEmail ||
          !item.address ||
          !item.organizationType
        ) {
          return {
            success: false,
            message: "Required fields missing in one or more organizations",
          };
        }

        if (
          existingNames.has(item.organizationName) ||
          existingEmails.has(item.contactEmail)
        ) {
          return {
            success: false,
            message: "Duplicate organization name or email in bulk data",
          };
        }
        existingNames.add(item.organizationName);
        existingEmails.add(item.contactEmail);

        const org = repo.create({
          organizationName: item.organizationName,
          description: item.description ?? "",
          contactEmail: item.contactEmail,
          contactPhone: item.contactPhone ?? "",
          address: item.address,
          organizationType: item.organizationType,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        organizations.push(org);
      }

      // Check existing organizations
      const existing = await repo.find({
        where: [
          { organizationName: In([...existingNames]) },
          { contactEmail: In([...existingEmails]) },
        ],
      });

      if (existing.length) {
        return {
          success: false,
          message:
            "One or more organizations already exist with provided name or email",
        };
      }

      // Save all organizations
      const savedOrganizations = await repo.save(organizations);

      // Invalidate cache
      await CacheService.invalidateMultiple([
        "org:all",
        ...savedOrganizations.map((org) => `org:id:${org.organizationId}`),
      ]);

      return {
        success: true,
        data: savedOrganizations,
        message: "Organizations created successfully",
      };
    } catch (error) {
      console.error("[Organization Bulk Create Error]:", error);
      return { success: false, message: "Failed to create organizations" };
    }
  }

  /**
   * Save an organization
   * @param org Organization entity
   * @returns Saved organization
   */
  static async save(org: Organization): Promise<{
    success: boolean;
    data?: Organization;
    message?: string;
  }> {
    if (
      !org.organizationName ||
      !org.contactEmail ||
      !org.address ||
      !org.organizationType
    ) {
      return {
        success: false,
        message: "Required fields (name, email, address, type) are missing",
      };
    }

    try {
      const repo = AppDataSource.getRepository(Organization);

      // Check for duplicates
      const existing = await repo.findOne({
        where: [
          { organizationName: org.organizationName },
          { contactEmail: org.contactEmail },
        ],
      });

      if (existing && existing.organizationId !== org.organizationId) {
        return {
          success: false,
          message: "Organization with this name or email already exists",
          data: existing,
        };
      }

      org.updatedAt = new Date();
      const savedOrganization = await repo.save(org);

      // Invalidate cache
      await CacheService.invalidateMultiple([
        "org:all",
        `org:id:${savedOrganization.organizationId}`,
      ]);

      return {
        success: true,
        data: savedOrganization,
        message: "Organization saved successfully",
      };
    } catch (error) {
      console.error("[Organization Save Error]:", error);
      return { success: false, message: "Failed to save organization" };
    }
  }

  /**
   * Update an organization
   * @param id Organization UUID
   * @param data Partial organization data
   * @returns Updated organization
   */
  static async update(
    id: string,
    data: Partial<OrganizationInterface>
  ): Promise<{ success: boolean; data?: Organization; message?: string }> {
    if (!id || !this.UUID_REGEX.test(id)) {
      return { success: false, message: "Valid organization ID is required" };
    }

    try {
      const repo = AppDataSource.getRepository(Organization);
      const organization = await repo.findOne({
        where: { organizationId: id },
        relations: ["users"],
      });

      if (!organization) {
        return { success: false, message: "Organization not found" };
      }

      // Check for duplicate name/email
      if (data.organizationName || data.contactEmail) {
        const existing = await repo.findOne({
          where: [
            { organizationName: data.organizationName || "" },
            { contactEmail: data.contactEmail || "" },
          ],
        });
        if (existing && existing.organizationId !== id) {
          return {
            success: false,
            message: "Organization name or email already exists",
          };
        }
      }

      repo.merge(organization, {
        organizationName:
          data.organizationName ?? organization.organizationName,
        description: data.description ?? organization.description,
        contactEmail: data.contactEmail ?? organization.contactEmail,
        contactPhone: data.contactPhone ?? organization.contactPhone,
        address: data.address ?? organization.address,
        organizationType:
          data.organizationType ?? organization.organizationType,
        updatedAt: new Date(),
      });

      const updatedOrganization = await repo.save(organization);

      // Invalidate cache
      await CacheService.invalidateMultiple([
        "org:all",
        `org:id:${id}`,
        ...organization.users.map((user) => `org:user:${user.userId}`),
      ]);

      return {
        success: true,
        data: updatedOrganization,
        message: "Organization updated successfully",
      };
    } catch (error) {
      console.error(`[Organization Update Error] ID: ${id}:`, error);
      return { success: false, message: "Failed to update organization" };
    }
  }

  /**
   * Update multiple organizations
   * @param updates Array of organization ID and partial data
   * @returns Updated organizations
   */
  static async bulkUpdate(
    updates: { id: string; data: Partial<OrganizationInterface> }[]
  ): Promise<{
    success: boolean;
    data?: Organization[];
    message?: string;
  }> {
    if (!updates.length) {
      return {
        success: false,
        message: "At least one organization update is required",
      };
    }

    try {
      const repo = AppDataSource.getRepository(Organization);
      const updatedOrganizations: Organization[] = [];
      const invalidateKeys: string[] = ["org:all"];

      for (const { id, data } of updates) {
        if (!id || !this.UUID_REGEX.test(id)) {
          return { success: false, message: `Invalid organization ID: ${id}` };
        }

        const organization = await repo.findOne({
          where: { organizationId: id },
          relations: ["users"],
        });

        if (!organization) {
          return { success: false, message: `Organization not found: ${id}` };
        }

        // Check for duplicate name/email
        if (data.organizationName || data.contactEmail) {
          const existing = await repo.findOne({
            where: [
              { organizationName: data.organizationName || "" },
              { contactEmail: data.contactEmail || "" },
            ],
          });
          if (existing && existing.organizationId !== id) {
            return {
              success: false,
              message: "Organization name or email already exists",
            };
          }
        }

        repo.merge(organization, {
          organizationName:
            data.organizationName ?? organization.organizationName,
          description: data.description ?? organization.description,
          contactEmail: data.contactEmail ?? organization.contactEmail,
          contactPhone: data.contactPhone ?? organization.contactPhone,
          address: data.address ?? organization.address,
          organizationType:
            data.organizationType ?? organization.organizationType,
          updatedAt: new Date(),
        });

        const updatedOrg = await repo.save(organization);
        updatedOrganizations.push(updatedOrg);
        invalidateKeys.push(
          `org:id:${id}`,
          ...organization.users.map((user) => `org:user:${user.userId}`)
        );
      }

      // Invalidate cache
      await CacheService.invalidateMultiple(invalidateKeys);

      return {
        success: true,
        data: updatedOrganizations,
        message: "Organizations updated successfully",
      };
    } catch (error) {
      console.error("[Organization Bulk Update Error]:", error);
      return { success: false, message: "Failed to update organizations" };
    }
  }

  /**
   * Delete an organization
   * @param id Organization UUID
   * @returns Deletion result
   */
  static async delete(
    id: string
  ): Promise<{ success: boolean; message: string }> {
    if (!id || !this.UUID_REGEX.test(id)) {
      return { success: false, message: "Valid organization ID is required" };
    }

    try {
      const repo = AppDataSource.getRepository(Organization);
      const organization = await repo.findOne({
        where: { organizationId: id },
        relations: ["users"],
      });

      if (!organization) {
        return { success: false, message: "Organization not found" };
      }

      const result = await repo.delete(id);

      if (result.affected === 0) {
        return {
          success: false,
          message: "Organization not found or already deleted",
        };
      }

      // Invalidate cache
      await CacheService.invalidateMultiple([
        "org:all",
        `org:id:${id}`,
        ...organization.users.map((user) => `org:user:${user.userId}`),
      ]);

      return { success: true, message: "Organization deleted successfully" };
    } catch (error) {
      console.error(`[Organization Delete Error] ID: ${id}:`, error);
      return { success: false, message: "Failed to delete organization" };
    }
  }

  /**
   * Assign users to an organization
   * @param userIds Array of user UUIDs
   * @param organizationId Organization UUID
   * @returns Assignment result
   */
  static async assignUsersToOrganization(
    userIds: string[],
    organizationId: string
  ): Promise<{ success: boolean; message: string; data?: Organization }> {
    if (!organizationId || !this.UUID_REGEX.test(organizationId)) {
      return { success: false, message: "Valid organization ID is required" };
    }

    if (!userIds?.length || userIds.some((id) => !this.UUID_REGEX.test(id))) {
      return { success: false, message: "Valid user IDs are required" };
    }

    try {
      const organizationRepo = AppDataSource.getRepository(Organization);
      const userRepo = AppDataSource.getRepository(User);

      // Fetch organization with existing users
      const organization = await organizationRepo.findOne({
        where: { organizationId },
        relations: ["users"],
      });

      if (!organization) {
        return { success: false, message: "Organization not found" };
      }

      // Fetch users
      const users = await userRepo.find({
        where: { userId: In(userIds) },
        relations: ["organizations"],
      });

      if (users.length !== userIds.length) {
        return { success: false, message: "One or more users not found" };
      }

      // Filter out already assigned users
      const newUsers = users.filter(
        (user) =>
          !user.organizations.some(
            (org) => org.organizationId === organizationId
          )
      );

      if (!newUsers.length) {
        return {
          success: true,
          message: "All users are already assigned to this organization",
          data: organization,
        };
      }

      // Assign users
      organization.users = [...(organization.users || []), ...newUsers];
      const updatedOrganization = await organizationRepo.save(organization);

      // Invalidate cache
      await CacheService.invalidateMultiple([
        "org:all",
        `org:id:${organizationId}`,
        ...userIds.map((id) => `org:user:${id}`),
        ...userIds.map((id) => `user:id:${id}`),
      ]);

      return {
        success: true,
        message: `${newUsers.length} users assigned to organization`,
        data: updatedOrganization,
      };
    } catch (error) {
      console.error(
        `[Organization Assign Users Error] Org ID: ${organizationId}:`,
        error
      );
      return {
        success: false,
        message: "Failed to assign users to organization",
      };
    }
  }

  /**
   * Remove users from an organization
   * @param userIds Array of user UUIDs
   * @param organizationId Organization UUID
   * @returns Removal result
   */
  static async removeUsersFromOrganization(
    userIds: string[],
    organizationId: string
  ): Promise<{ success: boolean; message: string; data?: Organization }> {
    if (!organizationId || !this.UUID_REGEX.test(organizationId)) {
      return { success: false, message: "Valid organization ID is required" };
    }

    if (!userIds?.length || userIds.some((id) => !this.UUID_REGEX.test(id))) {
      return { success: false, message: "Valid user IDs are required" };
    }

    try {
      const organizationRepo = AppDataSource.getRepository(Organization);
      const organization = await organizationRepo.findOne({
        where: { organizationId },
        relations: ["users"],
      });

      if (!organization) {
        return { success: false, message: "Organization not found" };
      }

      // Filter users to remove
      organization.users = organization.users.filter(
        (user) => !userIds.includes(user.userId)
      );

      const updatedOrganization = await organizationRepo.save(organization);

      // Invalidate cache
      await CacheService.invalidateMultiple([
        "org:all",
        `org:id:${organizationId}`,
        ...userIds.map((id) => `org:user:${id}`),
        ...userIds.map((id) => `user:id:${id}`),
      ]);

      return {
        success: true,
        message: `${userIds.length} users removed from organization`,
        data: updatedOrganization,
      };
    } catch (error) {
      console.error(
        `[Organization Remove Users Error] Org ID: ${organizationId}:`,
        error
      );
      return {
        success: false,
        message: "Failed to remove users from organization",
      };
    }
  }

  /**
   * Get users by organization
   * @param organizationId Organization UUID
   * @returns Users associated with organization
   */
  static async getUsersByOrganization(organizationId: string): Promise<{
    success: boolean;
    data?: User[];
    message?: string;
  }> {
    if (!organizationId || !this.UUID_REGEX.test(organizationId)) {
      return { success: false, message: "Valid organization ID is required" };
    }

    try {
      const cacheKey = `org:users:${organizationId}`;
      const users = await CacheService.getOrSetMultiple(
        cacheKey,
        AppDataSource.getRepository(User),
        async () => {
          const organization = await AppDataSource.getRepository(
            Organization
          ).findOne({
            where: { organizationId },
            relations: ["users", "users.role"],
          });
          return organization?.users || [];
        },
        CACHE_TTL
      );

      return { success: true, data: users };
    } catch (error) {
      console.error(
        `[Organization Fetch Users Error] Org ID: ${organizationId}:`,
        error
      );
      return {
        success: false,
        message: "Failed to fetch users for organization",
      };
    }
  }

  static async getOrganizationsByUserId(userId: string) {
    if (!userId) return { success: false, message: "User ID is required" };

    try {
      const organizations = await AppDataSource.getRepository(
        Organization
      ).find({
        relations: [
          "users",
          "users.role",
          "events",
          "venues",
          "venues.manager",
          "venues.bookings",
          "venues.invoices",
          "venues.payments",
        ],
        where: {
          users: {
            userId: userId,
          },
        },
        order: { organizationName: "ASC" },
      });

      if (!organizations.length) {
        return {
          success: false,
          message: "No organizations found for this user",
        };
      }
      return { success: true, data: organizations };
    } catch (error) {
      return {
        success: false,
        message: "Failed to fetch organizations",
        error,
      };
    }
  }

  /**
   * Add one or more venues to an organization.
   * @param organizationId Organization UUID
   * @param venueIds Array of Venue UUIDs to add
   * @returns Assignment result
   */
  static async addVenuesToOrganization(
    organizationId: string,
    venueIds: string[]
  ): Promise<{
    success: boolean;
    message: string;
    data?: Organization;
    missingVenues?: Array<{
      venueId: string;
      venueName: string;
      status?: string;
      users: Array<{ userId: string; username: string; email: string }>;
    }>;
  }> {
    if (!organizationId || !this.UUID_REGEX.test(organizationId)) {
      return { success: false, message: "Valid organization ID is required" };
    }
    if (!venueIds?.length || venueIds.some((id) => !this.UUID_REGEX.test(id))) {
      return { success: false, message: "Valid venue IDs are required" };
    }

    try {
      const organizationRepo = AppDataSource.getRepository(Organization);
      const venueRepo = AppDataSource.getRepository(Venue);

      // Fetch the organization with its current venues
      const organization = await organizationRepo.findOne({
        where: { organizationId },
        relations: ["venues"], // Eagerly load venues
      });

      if (!organization) {
        return { success: false, message: "Organization not found" };
      }

      // Fetch the venues to be added
      const venuesToAdd = await venueRepo.find({
        where: { venueId: In(venueIds) },
        relations: ["organization", "users"], // Load existing organization relation and users
      });

      const foundVenueIds = venuesToAdd.map((v) => v.venueId);
      const missingVenueIds = venueIds.filter(
        (id) => !foundVenueIds.includes(id)
      );

      if (missingVenueIds.length > 0) {
        // Try to fetch details for missing venues (if soft-deleted or in another org)
        const missingVenues = await venueRepo.find({
          where: { venueId: In(missingVenueIds) },
          relations: ["users"],
          withDeleted: true, // if using soft deletes
        });

        // Format missing venues with users and status in uppercase
        const missingVenueDetails = missingVenues.map((venue) => ({
          venueId: venue.venueId,
          venueName: venue.venueName,
          status: venue.status ? String(venue.status).toUpperCase() : undefined,
          users:
            venue.users?.map((user: User) => ({
              userId: user.userId,
              username: user.username,
              email: user.email,
            })) || [],
        }));

        return {
          success: false,
          message: "One or more venues not found",
          missingVenues: missingVenueDetails,
        };
      }

      const assignedVenuesCount = { added: 0, alreadyAssigned: 0 };
      const invalidateKeys: string[] = ["org:all", `org:id:${organizationId}`];

      for (const venue of venuesToAdd) {
        // Check if the venue is already assigned to this organization
        if (
          venue.organization &&
          venue.organization.organizationId === organizationId
        ) {
          assignedVenuesCount.alreadyAssigned++;
        } else if (
          venue.organization &&
          venue.organization.organizationId !== organizationId
        ) {
          // Venue is already assigned to a different organization
          return {
            success: false,
            message: `Venue '${venue.venueName}' (ID: ${venue.venueId}) is already assigned to another organization`,
          };
        } else {
          // Assign the venue to the organization and set status to PENDING
          venue.organization = organization;
          venue.status = VenueStatus.PENDING;
          await venueRepo.save(venue); // Save the venue to update its organizationId foreign key
          assignedVenuesCount.added++;
          invalidateKeys.push(`venue:id:${venue.venueId}`); // Invalidate venue cache too
        }
      }

      if (
        assignedVenuesCount.added === 0 &&
        assignedVenuesCount.alreadyAssigned > 0
      ) {
        return {
          success: true,
          message:
            "All specified venues are already assigned to this organization",
          data: organization,
        };
      } else if (assignedVenuesCount.added === 0) {
        return { success: false, message: "No venues were added" };
      }

      // After saving venues, refetch organization if its 'venues' relation isn't automatically updated by TypeORM
      // For OneToMany/ManyToOne, the update happens on the 'Many' side (Venue), so we might need to refresh the Organization
      const updatedOrganization = await organizationRepo.findOne({
        where: { organizationId },
        relations: ["venues"],
      });

      // Invalidate cache
      await CacheService.invalidateMultiple(invalidateKeys);

      return {
        success: true,
        message: `${assignedVenuesCount.added} venue(s) added successfully to organization`,
        data: updatedOrganization ?? undefined,
      };
    } catch (error) {
      console.error(
        `[Organization Add Venues Error] Org ID: ${organizationId}:`,
        error
      );
      return {
        success: false,
        message: "Failed to add venues to organization",
      };
    }
  }

  /**
   * Remove one or more venues from an organization.
   * @param organizationId Organization UUID
   * @param venueIds Array of Venue UUIDs to remove
   * @returns Removal result
   */
  static async removeVenuesFromOrganization(
    organizationId: string,
    venueIds: string[]
  ): Promise<{ success: boolean; message: string; data?: Organization }> {
    if (!organizationId || !this.UUID_REGEX.test(organizationId)) {
      return { success: false, message: "Valid organization ID is required" };
    }
    if (!venueIds?.length || venueIds.some((id) => !this.UUID_REGEX.test(id))) {
      return { success: false, message: "Valid venue IDs are required" };
    }

    try {
      const organizationRepo = AppDataSource.getRepository(Organization);
      const venueRepo = AppDataSource.getRepository(Venue);

      const organization = await organizationRepo.findOne({
        where: { organizationId },
        relations: ["venues"],
      });

      if (!organization) {
        return { success: false, message: "Organization not found" };
      }

      const venuesToRemove = await venueRepo.find({
        where: {
          venueId: In(venueIds),
          organization: { organizationId: organizationId }, // Ensure we only target venues already linked to this org
        },
      });

      if (!venuesToRemove.length) {
        return {
          success: true,
          message:
            "No specified venues found linked to this organization to remove",
          data: organization,
        };
      }

      const invalidateKeys: string[] = ["org:all", `org:id:${organizationId}`];
      let removedCount = 0;

      for (const venue of venuesToRemove) {
        venue.organization = undefined; // Set the foreign key to undefined
        await venueRepo.save(venue);
        removedCount++;
        invalidateKeys.push(`venue:id:${venue.venueId}`); // Invalidate venue cache
      }

      const updatedOrganization = await organizationRepo.findOne({
        where: { organizationId },
        relations: ["venues"], // Refetch to get updated list
      });

      // Invalidate cache
      await CacheService.invalidateMultiple(invalidateKeys);

      return {
        success: true,
        message: `${removedCount} venue(s) removed from organization`,
        data: updatedOrganization ?? undefined,
      };
    } catch (error) {
      console.error(
        `[Organization Remove Venues Error] Org ID: ${organizationId}:`,
        error
      );
      return {
        success: false,
        message: "Failed to remove venues from organization",
      };
    }
  }
}
