import { AppDataSource } from "../config/Database";
import { Organization } from "../models/Organization";
import { OrganizationInterface } from "../interfaces/OrganizationInterface";
import { User } from "../models/User";
import { In } from "typeorm";
import { CacheService } from "../services/CacheService";
import { Venue, VenueStatus } from "../models/Venue Tables/Venue";
import { OrganizationStatusEnum } from "../interfaces/Enums/OrganizationStatusEnum";
import { EventStatus } from "../interfaces/Enums/EventStatusEnum";

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
    data?: any[];
    message?: string;
  }> {
    try {
      // Fetch all organizations with users, roles, and venues
      const organizations = await AppDataSource.getRepository(Organization)
        .createQueryBuilder("organization")
        .leftJoinAndSelect("organization.users", "user")
        .leftJoinAndSelect("user.role", "role")
        .leftJoinAndSelect("organization.venues", "venue")
        .where("organization.deletedAt IS NULL")
        .andWhere("LOWER(organization.organizationType) != :independent", {
          independent: "independent",
        })
        .orderBy("organization.organizationName", "ASC")
        .getMany();

      // For each organization, fetch all events linked to any of its venues
      const eventVenueRepo = AppDataSource.getRepository("event_venues");
      const eventRepo = AppDataSource.getRepository("events");

      const data = await Promise.all(
        organizations.map(async (org) => {
          // Get all venueIds for this org
          const venueIds = (org.venues || []).map((v) => v.venueId);
          let events: any[] = [];
          if (venueIds.length > 0) {
            // Find all eventIds linked to these venues
            let eventVenueLinks: any[] = [];
            if (venueIds.length === 1) {
              eventVenueLinks = await eventVenueRepo.find({
                where: { venueId: venueIds[0] },
                select: ["eventId"],
              });
            } else {
              eventVenueLinks = await eventVenueRepo
                .createQueryBuilder("ev")
                .select(["ev.eventId"])
                .where("ev.venueId IN (:...venueIds)", { venueIds })
                .getMany();
            }
            const eventIds = [
              ...new Set(eventVenueLinks.map((ev: any) => ev.eventId)),
            ];
            if (eventIds.length > 0) {
              events = await eventRepo.findByIds(eventIds);
            }
          }
          return {
            ...org,
            users: org.users?.map((u) => ({
              userId: u.userId,
              username: u.username,
              firstName: u.firstName,
              lastName: u.lastName,
              email: u.email,
              phoneNumber: u.phoneNumber,
              role: u.role
                ? { roleId: u.role.roleId, roleName: u.role.roleName }
                : null,
              profilePictureURL: u.profilePictureURL,
              preferredLanguage: u.preferredLanguage,
              timezone: u.timezone,
              emailNotificationsEnabled: u.emailNotificationsEnabled,
              smsNotificationsEnabled: u.smsNotificationsEnabled,
              socialMediaLinks: u.socialMediaLinks,
              dateOfBirth: u.dateOfBirth,
              gender: u.gender,
              addressLine1: u.addressLine1,
              addressLine2: u.addressLine2,
              city: u.city,
              stateProvince: u.stateProvince,
              postalCode: u.postalCode,
              country: u.country,
              createdAt: u.createdAt,
              updatedAt: u.updatedAt,
            })),
            venues: org.venues,
            events,
          };
        })
      );

      return { success: true, data };
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
    organization.members = data.members ?? 0;
    organization.createdAt = new Date();
    organization.updatedAt = new Date();
    organization.isEnabled = true; // Set enabled by default

    return { success: true, data: organization };
  }

  /**
   * Helper to invalidate all cache keys for an organization
   */
  static async invalidateOrgCacheKeys(orgId: string, userIds: string[] = []) {
    const keys = [
      "org:all",
      `org:id:${orgId}`,
      `org:id:${orgId}:withVenuesAndUsers`,
      `org:users:${orgId}`,
      ...userIds.map((id) => `org:user:${id}`),
      ...userIds.map((id) => `user:id:${id}`),
    ];
    await CacheService.invalidateMultiple(keys);
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
          supportingDocuments: item.supportingDocuments,
          logo: item.logo,
          members: item.members ?? 0,
          status: item.status || OrganizationStatusEnum.PENDING,
          isEnabled: true, // Set enabled by default
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
      for (const org of savedOrganizations) {
        await this.invalidateOrgCacheKeys(org.organizationId);
      }

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
        logo: data.logo ?? organization.logo,
        supportingDocuments:
          data.supportingDocuments ?? organization.supportingDocuments,
        members: data.members ?? organization.members,
        updatedAt: new Date(),
      });

      const updatedOrganization = await repo.save(organization);

      // Invalidate cache
      await this.invalidateOrgCacheKeys(
        id,
        organization.users.map((user) => user.userId)
      );

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
   * Delete one or more organizations
   * @param ids Organization UUID or array of UUIDs
   * @returns Deletion result
   */
  static async delete(
    ids: string | string[]
  ): Promise<{ success: boolean; message: string }> {
    const idArray = Array.isArray(ids) ? ids : [ids];

    // Validate all IDs
    if (idArray.some((id) => !this.UUID_REGEX.test(id))) {
      return { success: false, message: "Valid organization ID(s) required" };
    }

    try {
      const repo = AppDataSource.getRepository(Organization);

      // Find organizations with their users
      const organizations = await repo.find({
        where: { organizationId: In(idArray) },
        relations: ["users"],
      });

      if (organizations.length !== idArray.length) {
        return {
          success: false,
          message: "One or more organizations not found",
        };
      }

      // Delete the organizations
      const result = await repo.delete(idArray);

      if (result.affected === 0) {
        return {
          success: false,
          message: "Organizations not found or already deleted",
        };
      }

      // Invalidate cache for all deleted organizations
      for (const org of organizations) {
        await this.invalidateOrgCacheKeys(
          org.organizationId,
          org.users.map((user) => user.userId)
        );
      }

      return {
        success: true,
        message: `${result.affected} organization(s) deleted successfully`,
      };
    } catch (error) {
      console.error(`[Organization Delete Error] IDs: ${ids}:`, error);
      return { success: false, message: "Failed to delete organization(s)" };
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
      await this.invalidateOrgCacheKeys(organizationId, userIds);

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
      await this.invalidateOrgCacheKeys(organizationId, userIds);

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
      console.log("[DEBUG] Querying organizations for userId:", userId);
      const organizations = await AppDataSource.getRepository(Organization)
        .createQueryBuilder("organization")
        .leftJoinAndSelect("organization.users", "user")
        .where("user.userId = :userId", { userId })
        .orderBy("organization.organizationName", "ASC")
        .getMany();
      return { success: true, data: organizations };
    } catch (error) {
      console.error("[DEBUG] Error in getOrganizationsByUserId:", error);
      return {
        success: false,
        message: "Failed to fetch organizations",
        error,
      };
    }
  }

  /**
   * Get all public organizations (approved and enabled) with their venues and events
   * @returns List of public organizations
   */
  static async getAllPublicOrganizations(): Promise<{
    success: boolean;
    data?: any[];
    message?: string;
  }> {
    try {
      const organizations = await AppDataSource.getRepository(Organization)
        .createQueryBuilder("organization")
        .leftJoinAndSelect(
          "organization.venues",
          "venue",
          "venue.status = :venueStatus AND venue.deletedAt IS NULL",
          { venueStatus: VenueStatus.APPROVED }
        )
        .where("organization.status = :status", {
          status: OrganizationStatusEnum.APPROVED,
        })
        .andWhere("organization.isEnabled = :isEnabled", { isEnabled: true })
        .orderBy("organization.organizationName", "ASC")
        .getMany();

      // Format the response to include only necessary information
      const formattedOrganizations = organizations.map((org) => ({
        organizationId: org.organizationId,
        organizationName: org.organizationName,
        description: org.description,
        contactEmail: org.contactEmail,
        contactPhone: org.contactPhone,
        address: org.address,
        organizationType: org.organizationType,
        city: org.city,
        country: org.country,
        postalCode: org.postalCode,
        stateProvince: org.stateProvince,
        supportingDocuments: org.supportingDocuments,
        logo: org.logo,
        cancellationReason: org.cancellationReason,
        status: org.status,
        isEnabled: org.isEnabled,
        members: org.members,
        createdAt: org.createdAt,
        updatedAt: org.updatedAt,
        venues: (org.venues || [])
          .filter((venue) => venue.status === VenueStatus.APPROVED)
          .map((venue) => ({
            venueId: venue.venueId,
            venueName: venue.venueName,
            location: venue.venueLocation,
            capacity: venue.capacity,
            mainPhotoUrl: venue.mainPhotoUrl,
            photoGallery: venue.photoGallery,
            latitude: venue.latitude,
            longitude: venue.longitude,
            googleMapsLink: venue.googleMapsLink,
            virtualTourUrl: venue.virtualTourUrl,
            venueDocuments: venue.venueDocuments,
            status: venue.status,
            visitPurposeOnly: venue.visitPurposeOnly,
            bookingType: venue.bookingType,
            createdAt: venue.createdAt,
            updatedAt: venue.updatedAt,
          })),
      }));

      return {
        success: true,
        data: formattedOrganizations,
        message:
          formattedOrganizations.length > 0
            ? "Organizations retrieved successfully"
            : "No public organizations found",
      };
    } catch (error) {
      console.error("[Public Organizations Fetch Error]:", error);
      return {
        success: false,
        message: "Failed to fetch public organizations",
      };
    }
  }

  /**
   * Get public organization details including venues and events
   * @param id Organization UUID
   * @returns Organization with venues and events
   */
  static async getPublicDetails(id: string): Promise<{
    success: boolean;
    data?: Organization & { events?: any[] };
    message?: string;
  }> {
    if (!id || !this.UUID_REGEX.test(id)) {
      return { success: false, message: "Valid organization ID is required" };
    }

    try {
      const organization = await AppDataSource.getRepository(Organization)
        .createQueryBuilder("organization")
        .leftJoinAndSelect("organization.venues", "venue")
        .leftJoin("venue.events", "event")
        .leftJoinAndSelect("event", "fullEvent")
        .where("organization.organizationId = :id", { id })
        .andWhere("organization.isEnabled = :isEnabled", { isEnabled: true })
        .andWhere("venue.status = :venueStatus", { venueStatus: "APPROVED" })
        .andWhere("(event.status = :eventStatus OR event.status IS NULL)", {
          eventStatus: "PUBLISHED",
        })
        .getOne();

      if (!organization) {
        return {
          success: false,
          message: "Organization not found or not accessible",
        };
      }

      // Get events for this organization's venues
      const events = await AppDataSource.createQueryBuilder()
        .select("event")
        .from("events", "event")
        .innerJoin("event_venues", "ev", "ev.eventId = event.eventId")
        .innerJoin("venues", "venue", "venue.venueId = ev.venueId")
        .where("venue.organizationId = :organizationId", { organizationId: id })
        .andWhere("event.status = :status", { status: "PUBLISHED" })
        .getRawMany();

      return {
        success: true,
        data: {
          ...organization,
          events,
        },
      };
    } catch (error) {
      console.error(`[Organization Public Details Error] ID: ${id}:`, error);
      return {
        success: false,
        message: "Failed to fetch organization details",
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
        }));

        return {
          success: false,
          message: "One or more venues not found",
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
      await this.invalidateOrgCacheKeys(organizationId);

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
   * Remove one or more venues from an organization
   * @param venueIds Array of Venue UUIDs to remove
   * @param organizationId Organization UUID
   * @returns Removal result
   */
  static async removeVenuesFromOrganization(
    venueIds: string[],
    organizationId: string
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
          organization: { organizationId: organizationId },
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
        relations: ["venues"],
      });

      // Invalidate cache
      await this.invalidateOrgCacheKeys(organizationId);

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

  static async approveOrganization(
    id: string
  ): Promise<{ success: boolean; data?: Organization; message: string }> {
    if (!id || !this.UUID_REGEX.test(id)) {
      return { success: false, message: "Valid organization ID is required" };
    }
    try {
      const repo = AppDataSource.getRepository(Organization);
      const organization = await repo.findOne({
        where: { organizationId: id },
      });
      if (!organization) {
        return { success: false, message: "Organization not found" };
      }
      organization.status = OrganizationStatusEnum.APPROVED;
      const updated = await repo.save(organization);
      // Invalidate cache
      await this.invalidateOrgCacheKeys(
        id,
        organization.users?.map((user) => user.userId) || []
      );
      return {
        success: true,
        data: updated,
        message: "Organization approved.",
      };
    } catch (error) {
      return { success: false, message: "Failed to approve organization" };
    }
  }

  static async rejectOrganization(
    id: string,
    reason?: string
  ): Promise<{ success: boolean; data?: Organization; message: string }> {
    if (!id || !this.UUID_REGEX.test(id)) {
      return { success: false, message: "Valid organization ID is required" };
    }
    try {
      const repo = AppDataSource.getRepository(Organization);
      const organization = await repo.findOne({
        where: { organizationId: id },
      });
      if (!organization) {
        return { success: false, message: "Organization not found" };
      }
      organization.status = OrganizationStatusEnum.REJECTED;
      if (reason) {
        organization.cancellationReason = reason;
      }
      const updated = await repo.save(organization);
      // Invalidate cache
      await this.invalidateOrgCacheKeys(
        id,
        organization.users?.map((user) => user.userId) || []
      );
      return {
        success: true,
        data: updated,
        message: "Organization rejected.",
      };
    } catch (error) {
      return { success: false, message: "Failed to reject organization" };
    }
  }

  /**
   * Enable an organization
   * @param id Organization UUID
   * @returns Operation result
   */
  static async enableOrganization(
    id: string
  ): Promise<{ success: boolean; data?: Organization; message: string }> {
    if (!id || !this.UUID_REGEX.test(id)) {
      return { success: false, message: "Valid organization ID is required" };
    }
    try {
      const repo = AppDataSource.getRepository(Organization);
      const organization = await repo.findOne({
        where: { organizationId: id },
      });

      if (!organization) {
        return { success: false, message: "Organization not found" };
      }

      organization.isEnabled = true;
      const updated = await repo.save(organization);

      // Invalidate cache
      await this.invalidateOrgCacheKeys(
        id,
        organization.users?.map((user) => user.userId) || []
      );

      return {
        success: true,
        data: updated,
        message: "Organization enabled successfully",
      };
    } catch (error) {
      console.error(`[Organization Enable Error] ID: ${id}:`, error);
      return { success: false, message: "Failed to enable organization" };
    }
  }

  /**
   * Disable an organization
   * @param id Organization UUID
   * @returns Operation result
   */
  static async disableOrganization(
    id: string
  ): Promise<{ success: boolean; data?: Organization; message: string }> {
    if (!id || !this.UUID_REGEX.test(id)) {
      return { success: false, message: "Valid organization ID is required" };
    }
    try {
      const repo = AppDataSource.getRepository(Organization);
      const organization = await repo.findOne({
        where: { organizationId: id },
      });

      if (!organization) {
        return { success: false, message: "Organization not found" };
      }

      organization.isEnabled = false;
      const updated = await repo.save(organization);

      // Invalidate cache
      await this.invalidateOrgCacheKeys(
        id,
        organization.users?.map((user) => user.userId) || []
      );

      return {
        success: true,
        data: updated,
        message: "Organization disabled successfully",
      };
    } catch (error) {
      console.error(`[Organization Disable Error] ID: ${id}:`, error);
      return { success: false, message: "Failed to disable organization" };
    }
  }

  static async queryOrganization(
    id: string,
    reason?: string
  ): Promise<{ success: boolean; data?: Organization; message: string }> {
    if (!id || !this.UUID_REGEX.test(id)) {
      return { success: false, message: "Valid organization ID is required" };
    }
    try {
      const repo = AppDataSource.getRepository(Organization);
      const organization = await repo.findOne({
        where: { organizationId: id },
      });
      if (!organization) {
        return { success: false, message: "Organization not found" };
      }
      if (organization.status === OrganizationStatusEnum.REJECTED) {
        return {
          success: false,
          message: "Cannot query a rejected organization",
        };
      }
      organization.status = OrganizationStatusEnum.QUERY;
      organization.cancellationReason = reason ?? "";
      const updated = await repo.save(organization);
      await this.invalidateOrgCacheKeys(
        id,
        organization.users?.map((user) => user.userId) || []
      );
      return {
        success: true,
        data: updated,
        message: "Organization set to QUERY.",
      };
    } catch (error) {
      return { success: false, message: "Failed to query organization" };
    }
  }

  static async requestOrganizationAgain(
    id: string
  ): Promise<{ success: boolean; data?: Organization; message: string }> {
    if (!id || !this.UUID_REGEX.test(id)) {
      return { success: false, message: "Valid organization ID is required" };
    }
    try {
      const repo = AppDataSource.getRepository(Organization);
      const organization = await repo.findOne({
        where: { organizationId: id },
      });
      if (!organization) {
        return { success: false, message: "Organization not found" };
      }
      if (organization.status === OrganizationStatusEnum.REJECTED) {
        return {
          success: false,
          message: "Cannot request again for a rejected organization",
        };
      }
      if (organization.status !== OrganizationStatusEnum.QUERY) {
        return {
          success: false,
          message: "Organization is not in QUERY status",
        };
      }
      organization.status = OrganizationStatusEnum.PENDING_QUERY;
      // Do not clear cancellationReason so user can see the reason
      const updated = await repo.save(organization);
      await this.invalidateOrgCacheKeys(
        id,
        organization.users?.map((user) => user.userId) || []
      );
      return {
        success: true,
        data: updated,
        message: "Organization set to PENDING_QUERY.",
      };
    } catch (error) {
      return {
        success: false,
        message: "Failed to request again for organization",
      };
    }
  }
}
