import { AppDataSource } from "../config/Database";
import { Organization } from "../models/Organization";
import { OrganizationInterface } from "../interfaces/OrganizationInterface";
import { User } from "../models/User";
import { In } from "typeorm";
import { CacheService } from "../services/CacheService";

const CACHE_TTL = 3600; // 1 hour in seconds

export class OrganizationRepository {
  private static readonly UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  private static repo = AppDataSource.getRepository(Organization);

  /**
   * Get all organizations with caching
   * @returns List of organizations with users and their roles
   */
  static async getAll(): Promise<{ success: boolean; data?: Organization[]; message?: string }> {
    try {
      const cacheKey = "org:all";
      const organizations = await CacheService.getOrSetMultiple(
        cacheKey,
        OrganizationRepository.repo,
        async () => {
          return await OrganizationRepository.repo.find({
            relations: ["users", "users.role"],
            order: { organizationName: "ASC" },
          });
        },
        CACHE_TTL
      );

      return { success: true, data: organizations, message: "Organizations retrieved successfully" };
    } catch (error) {
      console.error("[Organization Fetch All Error]:", error);
      return { success: false, message: "Failed to fetch organizations" };
    }
  }

  /**
   * Get an organization by ID with caching
   * @param id Organization UUID
   * @returns Organization with users and their roles
   */
  static async getById(id: string): Promise<{ success: boolean; data?: Organization; message?: string }> {
    if (!id || !this.UUID_REGEX.test(id)) {
      return { success: false, message: "Valid organization ID is required" };
    }

    try {
      const cacheKey = `org:id:${id}`;
      const organization = await CacheService.getOrSetSingle(
        cacheKey,
        OrganizationRepository.repo,
        async () => {
          return await OrganizationRepository.repo.findOne({
            where: { organizationId: id },
            relations: ["users", "users.role"],
          });
        },
        CACHE_TTL
      );

      if (!organization) {
        return { success: false, message: "Organization not found" };
      }

      return { success: true, data: organization, message: "Organization retrieved successfully" };
    } catch (error) {
      console.error(`[Organization Fetch Error] ID: ${id}:`, error);
      return { success: false, message: "Failed to fetch organization" };
    }
  }

  /**
   * Create a new organization entity (not saved)
   * @param data Organization data
   * @returns Organization entity
   */
  static create(data: Partial<OrganizationInterface>): {
    success: boolean;
    data?: Organization;
    message?: string;
  } {
    if (!data.organizationName || !data.contactEmail || !data.address || !data.organizationType) {
      return { success: false, message: "Required fields (name, email, address, type) are missing" };
    }

    try {
      const organization = OrganizationRepository.repo.create({
        organizationName: data.organizationName,
        description: data.description ?? "",
        contactEmail: data.contactEmail,
        contactPhone: data.contactPhone ?? "",
        address: data.address,
        organizationType: data.organizationType,
        city: data.city ?? "",
        country: data.country ?? "",
        postalCode: data.postalCode ?? "",
        stateProvince: data.stateProvince ?? "",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      return { success: true, data: organization, message: "Organization entity created" };
    } catch (error) {
      console.error("[Organization Create Entity Error]:", error);
      return { success: false, message: "Failed to create organization entity" };
    }
  }

  /**
   * Save an organization
   * @param org Organization entity
   * @returns Saved organization
   */
  static async save(org: Organization): Promise<{ success: boolean; data?: Organization; message?: string }> {
    if (!org.organizationName || !org.contactEmail || !org.address || !org.organizationType) {
      return { success: false, message: "Required fields (name, email, address, type) are missing" };
    }

    try {
      // Check for duplicates (excluding self if updating)
      const existing = await OrganizationRepository.repo.findOne({
        where: [
          { organizationName: org.organizationName },
          { contactEmail: org.contactEmail },
        ],
      });

      if (existing && existing.organizationId !== org.organizationId) {
        return {
          success: false,
          message: "Organization with this name or email already exists",
        };
      }

      org.updatedAt = new Date();
      const savedOrganization = await OrganizationRepository.repo.save(org);

      // Invalidate cache
      await CacheService.invalidateMultiple([
        "org:all",
        `org:id:${savedOrganization.organizationId}`,
      ]);

      return { success: true, data: savedOrganization, message: "Organization saved successfully" };
    } catch (error) {
      console.error("[Organization Save Error]:", error);
      return { success: false, message: "Failed to save organization" };
    }
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
      return { success: false, message: "At least one organization is required" };
    }

    try {
      const organizations: Organization[] = [];
      const names = new Set<string>();
      const emails = new Set<string>();

      // Validate and create entities
      for (const item of data) {
        // Check required fields for each organization
        const missingFields = [];
        if (!item.organizationName) missingFields.push('organizationName');
        if (!item.contactEmail) missingFields.push('contactEmail');
        if (!item.address) missingFields.push('address');
        if (!item.organizationType) missingFields.push('organizationType');

        if (missingFields.length > 0) {
          return {
            success: false,
            message: `Required fields missing for organization: ${missingFields.join(', ')}`,
          };
        }

        // Type assertions for required fields
        const orgName = item.organizationName!;
        const orgEmail = item.contactEmail!;
        const orgAddress = item.address!;
        const orgType = item.organizationType!;

        if (names.has(orgName) || emails.has(orgEmail)) {
          return { success: false, message: "Duplicate organization name or email in bulk data" };
        }
        names.add(orgName);
        emails.add(orgEmail);

        const org = OrganizationRepository.repo.create({
          organizationName: orgName,
          description: item.description ?? "",
          contactEmail: orgEmail,
          contactPhone: item.contactPhone ?? "",
          address: orgAddress,
          organizationType: orgType,
          city: item.city ?? "",
          country: item.country ?? "",
          postalCode: item.postalCode ?? "",
          stateProvince: item.stateProvince ?? "",
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        organizations.push(org);
      }

      // Check existing organizations
      const existing = await OrganizationRepository.repo.find({
        where: [{ organizationName: In([...names]) }, { contactEmail: In([...emails]) }],
      });

      if (existing.length) {
        return {
          success: false,
          message: "One or more organizations already exist with provided name or email",
        };
      }

      // Save all organizations in a transaction
      const savedOrganizations = await AppDataSource.manager.transaction(async (transactionalEntityManager) => {
        return await transactionalEntityManager.save(Organization, organizations);
      });

      // Invalidate cache
      await CacheService.invalidateMultiple([
        "org:all",
        ...savedOrganizations.map((org) => `org:id:${org.organizationId}`),
      ]);

      return { success: true, data: savedOrganizations, message: "Organizations created successfully" };
    } catch (error) {
      console.error("[Organization Bulk Create Error]:", error);
      return { success: false, message: "Failed to create organizations" };
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
      const organization = await OrganizationRepository.repo.findOne({
        where: { organizationId: id },
        relations: ["users"],
      });

      if (!organization) {
        return { success: false, message: "Organization not found" };
      }

      // Check for duplicate name/email
      if (data.organizationName || data.contactEmail) {
        const existing = await OrganizationRepository.repo.findOne({
          where: [
            { organizationName: data.organizationName || organization.organizationName },
            { contactEmail: data.contactEmail || organization.contactEmail },
          ],
        });
        if (existing && existing.organizationId !== id) {
          return { success: false, message: "Organization name or email already exists" };
        }
      }

      // Update only provided fields
      const updateData: Partial<Organization> = {
        organizationName: data.organizationName,
        description: data.description,
        contactEmail: data.contactEmail,
        contactPhone: data.contactPhone,
        address: data.address,
        organizationType: data.organizationType,
        city: data.city,
        country: data.country,
        postalCode: data.postalCode,
        stateProvince: data.stateProvince,
        updatedAt: new Date(),
      };

      // Remove undefined values to avoid overwriting with null
      Object.keys(updateData).forEach((key) => {
        if (updateData[key as keyof typeof updateData] === undefined) {
          delete updateData[key as keyof typeof updateData];
        }
      });

      OrganizationRepository.repo.merge(organization, updateData);
      const updatedOrganization = await OrganizationRepository.repo.save(organization);

      // Invalidate cache
      await CacheService.invalidateMultiple([
        "org:all",
        `org:id:${id}`,
        ...organization.users.map((user) => `org:user:${user.userId}`),
      ]);

      return { success: true, data: updatedOrganization, message: "Organization updated successfully" };
    } catch (error) {
      console.error(`[Organization Update Error] ID: ${id}:`, error);
      return { success: false, message: "Failed to update organization" };
    }
  }

  /**
   * Update an organization with array inputs for fields
   * @param id Organization UUID
   * @param data Partial organization data with possible array values
   * @returns Updated organization
   */
  static async updateWithArray(
    id: string,
    data: Partial<Record<keyof OrganizationInterface, string | string[]>>
  ): Promise<{ success: boolean; data?: Organization; message?: string }> {
    if (!id || !this.UUID_REGEX.test(id)) {
      return { success: false, message: "Valid organization ID is required" };
    }

    try {
      const organization = await OrganizationRepository.repo.findOne({
        where: { organizationId: id },
        relations: ["users"],
      });

      if (!organization) {
        return { success: false, message: "Organization not found" };
      }

      // Prepare update data, handling arrays by taking the last value
      const updateData: Partial<Organization> = {
        updatedAt: new Date(),
      };

      const fields: (keyof OrganizationInterface)[] = [
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

      for (const field of fields) {
        if (data[field] !== undefined) {
          const value = Array.isArray(data[field]) ? (data[field] as string[])[(data[field] as string[]).length - 1] : (data[field] as string);
          if (value !== undefined) {
            (updateData as Record<string, string>)[field] = value;
          }
        }
      }

      // Check for duplicate name/email
      if (updateData.organizationName || updateData.contactEmail) {
        const existing = await OrganizationRepository.repo.findOne({
          where: [
            { organizationName: updateData.organizationName || organization.organizationName },
            { contactEmail: updateData.contactEmail || organization.contactEmail },
          ],
        });
        if (existing && existing.organizationId !== id) {
          return { success: false, message: "Organization name or email already exists" };
        }
      }

      // Validate required fields if provided
      const requiredFields = ["organizationName", "contactEmail", "address", "organizationType"] as const;
      for (const field of requiredFields) {
        if (updateData[field as keyof Organization] === "") {
          return { success: false, message: `Required field ${field} cannot be empty` };
        }
      }

      OrganizationRepository.repo.merge(organization, updateData);
      const updatedOrganization = await OrganizationRepository.repo.save(organization);

      // Invalidate cache
      await CacheService.invalidateMultiple([
        "org:all",
        `org:id:${id}`,
        ...organization.users.map((user) => `org:user:${user.userId}`),
      ]);

      return { success: true, data: updatedOrganization, message: "Organization updated successfully" };
    } catch (error) {
      console.error(`[Organization UpdateWithArray Error] ID: ${id}:`, error);
      return { success: false, message: "Failed to update organization" };
    }
  }

  /**
   * Update multiple organizations
   * @param updates Array of organization ID and partial data
   * @returns Updated organizations
   */
  static async bulkUpdate(updates: { id: string; data: Partial<OrganizationInterface> }[]): Promise<{
    success: boolean;
    data?: Organization[];
    message?: string;
  }> {
    if (!updates.length) {
      return { success: false, message: "At least one organization update is required" };
    }

    try {
      const updatedOrganizations: Organization[] = [];
      const invalidateKeys: string[] = ["org:all"];

      await AppDataSource.manager.transaction(async (transactionalEntityManager) => {
        for (const { id, data } of updates) {
          if (!id || !this.UUID_REGEX.test(id)) {
            throw new Error(`Invalid organization ID: ${id}`);
          }

          const organization = await transactionalEntityManager.findOne(Organization, {
            where: { organizationId: id },
            relations: ["users"],
          });

          if (!organization) {
            throw new Error(`Organization not found: ${id}`);
          }

          // Check for duplicate name/email
          if (data.organizationName || data.contactEmail) {
            const existing = await transactionalEntityManager.findOne(Organization, {
              where: [
                { organizationName: data.organizationName || organization.organizationName },
                { contactEmail: data.contactEmail || organization.contactEmail },
              ],
            });
            if (existing && existing.organizationId !== id) {
              throw new Error("Organization name or email already exists");
            }
          }

          transactionalEntityManager.merge(Organization, organization, {
            organizationName: data.organizationName ?? organization.organizationName,
            description: data.description ?? organization.description,
            contactEmail: data.contactEmail ?? organization.contactEmail,
            contactPhone: data.contactPhone ?? organization.contactPhone,
            address: data.address ?? organization.address,
            organizationType: data.organizationType ?? organization.organizationType,
            city: data.city ?? organization.city,
            country: data.country ?? organization.country,
            postalCode: data.postalCode ?? organization.postalCode,
            stateProvince: data.stateProvince ?? organization.stateProvince,
            updatedAt: new Date(),
          });

          const updatedOrg = await transactionalEntityManager.save(Organization, organization);
          updatedOrganizations.push(updatedOrg);
          invalidateKeys.push(
            `org:id:${id}`,
            ...organization.users.map((user) => `org:user:${user.userId}`)
          );
        }
      });

      // Invalidate cache
      await CacheService.invalidateMultiple(invalidateKeys);

      return { success: true, data: updatedOrganizations, message: "Organizations updated successfully" };
    } catch (error) {
      console.error("[Organization Bulk Update Error]:", error);
      return { success: false, message: error instanceof Error ? error.message : "Failed to update organizations" };
    }
  }

  /**
   * Delete an organization
   * @param id Organization UUID
   * @returns Deletion result
   */
  static async delete(id: string): Promise<{ success: boolean; message: string }> {
    if (!id || !this.UUID_REGEX.test(id)) {
      return { success: false, message: "Valid organization ID is required" };
    }

    try {
      const organization = await OrganizationRepository.repo.findOne({
        where: { organizationId: id },
        relations: ["users"],
      });

      if (!organization) {
        return { success: false, message: "Organization not found" };
      }

      // Check if organization has associated users
      if (organization.users && organization.users.length > 0) {
        return {
          success: false,
          message: `Cannot delete organization with ${organization.users.length} associated user(s). Please remove users first.`,
        };
      }

      await OrganizationRepository.repo.remove(organization);

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
      const organization = await OrganizationRepository.repo.findOne({
        where: { organizationId },
        relations: ["users"],
      });

      if (!organization) {
        return { success: false, message: "Organization not found" };
      }

      const userRepo = AppDataSource.getRepository(User);
      const users = await userRepo.find({
        where: { userId: In(userIds) },
        relations: ["organizations"],
      });

      if (users.length !== userIds.length) {
        return { success: false, message: "One or more users not found" };
      }

      // Filter out already assigned users
      const newUsers = users.filter(
        (user) => !user.organizations.some((org) => org.organizationId === organizationId)
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
      const updatedOrganization = await OrganizationRepository.repo.save(organization);

      // Invalidate cache
      await CacheService.invalidateMultiple([
        "org:all",
        `org:id:${organizationId}`,
        ...userIds.map((id) => `org:user:${id}`),
        ...userIds.map((id) => `user:id:${id}`),
      ]);

      return {
        success: true,
        message: `${newUsers.length} user(s) assigned to organization`,
        data: updatedOrganization,
      };
    } catch (error) {
      console.error(`[Organization Assign Users Error] Org ID: ${organizationId}:`, error);
      return { success: false, message: "Failed to assign users to organization" };
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
      const organization = await OrganizationRepository.repo.findOne({
        where: { organizationId },
        relations: ["users"],
      });

      if (!organization) {
        return { success: false, message: "Organization not found" };
      }

      // Filter users to remove
      const usersToRemove = organization.users.filter((user) => userIds.includes(user.userId));
      if (!usersToRemove.length) {
        return {
          success: true,
          message: "No specified users are assigned to this organization",
          data: organization,
        };
      }

      organization.users = organization.users.filter((user) => !userIds.includes(user.userId));
      const updatedOrganization = await OrganizationRepository.repo.save(organization);

      // Invalidate cache
      await CacheService.invalidateMultiple([
        "org:all",
        `org:id:${organizationId}`,
        ...userIds.map((id) => `org:user:${id}`),
        ...userIds.map((id) => `user:id:${id}`),
      ]);

      return {
        success: true,
        message: `${usersToRemove.length} user(s) removed from organization`,
        data: updatedOrganization,
      };
    } catch (error) {
      console.error(`[Organization Remove Users Error] Org ID: ${organizationId}:`, error);
      return { success: false, message: "Failed to remove users from organization" };
    }
  }

  /**
   * Get users by organization with caching
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
          const organization = await OrganizationRepository.repo.findOne({
            where: { organizationId },
            relations: ["users", "users.role"],
          });
          return organization?.users || [];
        },
        CACHE_TTL
      );

      return { success: true, data: users, message: "Users retrieved successfully" };
    } catch (error) {
      console.error(`[Organization Fetch Users Error] Org ID: ${organizationId}:`, error);
      return { success: false, message: "Failed to fetch users for organization" };
    }
  }
}