// src/repositories/RoleRepository.ts
import { AppDataSource } from "../config/Database";
import { Role } from "../models/Role";
import { User } from "../models/User";
import { RoleInterface } from "../interfaces/RoleInterface";
import { ILike } from "typeorm"; // Import ILike for case-insensitive search
import { CacheService } from "../services/CacheService";
import { Permission } from "../models/Permission";

export class RoleRepository {
  private static readonly ROLE_CACHE_KEY = "roles:all";

  static async findRoleByName(roleName: string): Promise<Role | null> {
    const roleRepository = AppDataSource.getRepository(Role);
    return await roleRepository.findOne({
      where: { roleName },
      relations: ["users"],
    });
  }

  // --- NEW METHOD FOR CASE-INSENSITIVE SEARCH ---
  static async findRolesByNameIgnoreCase(roleName: string): Promise<Role[]> {
    const roleRepository = AppDataSource.getRepository(Role);
    return await roleRepository.find({
      where: { roleName: ILike(`%${roleName}%`) }, // Using ILike for case-insensitive LIKE
      relations: ["users"], // Include relations if needed
    });
  }
  // --- END NEW METHOD ---

  static async createRole(
    data: Partial<RoleInterface>
  ): Promise<Role | { error: string }> {
    const role = new Role();
    role.roleName = data.roleName ?? "";
    role.description = data.description ?? "";
    if (data.permissions && Array.isArray(data.permissions)) {
      // Accept permissions as array of names (string[]) or Permission[]
      let permissionNames: string[] = [];
      if (data.permissions.every((p) => typeof p === "string")) {
        permissionNames = data.permissions as string[];
      } else if (
        data.permissions.every(
          (p) => typeof p === "object" && p !== null && "name" in p
        )
      ) {
        permissionNames = (data.permissions as { name: string }[]).map(
          (p) => p.name
        );
      } else {
        return { error: "Invalid permissions format." };
      }
      const permissionRepo = AppDataSource.getRepository(Permission);
      const foundPermissions = await permissionRepo.find({
        where: permissionNames.map((name: string) => ({ name })),
      });
      if (foundPermissions.length !== permissionNames.length) {
        return { error: "One or more permissions do not exist." };
      }
      role.permissions = foundPermissions;
    } else {
      role.permissions = [];
    }
    return role;
  }

  static async saveRole(role: Role): Promise<{
    success: boolean;
    message: string;
    role?: Partial<Role>;
    users?: Array<{
      userId: string;
      username: string;
      email: string;
      firstName: string;
      lastName: string;
      phoneNumber: string;
    }>;
    organizations?: Array<{
      organizationId: string;
      organizationName: string;
      description: string;
      contactEmail: string;
      contactPhone: string;
      address: string;
      organizationType: string;
    }>;
  }> {
    const roleRepository = AppDataSource.getRepository(Role);
    if (
      !role.roleName ||
      role.roleName.length < 3 ||
      role.roleName.length > 50
    ) {
      return {
        success: false,
        message: "Role name must be between 3 and 50 characters",
      };
    }
    try {
      await roleRepository.save(role);
      return {
        success: true,
        message: "Role saved successfully",
        role: {
          roleId: role.roleId,
          roleName: role.roleName,
          description: role.description,
          permissions: role.permissions,
        },
        users:
          role.users?.map((user: User) => ({
            userId: user.userId,
            username: user.username,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            phoneNumber: user.phoneNumber ?? "",
          })) || [],
      };
    } catch (err) {
      return {
        success: false,
        message:
          "Database error: " +
          (err instanceof Error ? err.message : "Unknown error"),
      };
    }
  }

  static async getAllRoles(): Promise<Role[]> {
    const roleRepository = AppDataSource.getRepository(Role);

    return await CacheService.getOrSetMultiple(
      this.ROLE_CACHE_KEY,
      roleRepository,
      async () => {
        return await roleRepository.find({
          relations: ["users"],
        });
      }
    );
  }

  static async getRoleById(id: RoleInterface["roleId"]): Promise<Role | null> {
    const roleRepository = AppDataSource.getRepository(Role);
    return await roleRepository.findOne({
      where: { roleId: id },
      relations: ["users"],
    });
  }

  static async updateRole(
    id: RoleInterface["roleId"],
    roleData: Partial<Omit<RoleInterface, "RoleID">>
  ): Promise<Role | { error: string }> {
    const roleRepository = AppDataSource.getRepository(Role);

    if (!id || typeof id !== "string" || id.trim() === "") {
      return { error: "Invalid Role ID provided." };
    }

    try {
      const role = await roleRepository.findOne({ where: { roleId: id } });
      if (!role) {
        return { error: "Role not found." };
      }

      // Structured updates
      role.roleName = roleData.roleName || role.roleName;
      role.description = roleData.description || role.description;
      role.permissions = roleData.permissions || role.permissions;

      const updatedRole = await roleRepository.save(role);
      return updatedRole;
    } catch (error) {
      console.error("Error updating role:", error);
      return { error: "An error occurred while updating the role." };
    }
  }

  static async deleteRole(
    roleId: string
  ): Promise<{ success: boolean } | { error: string }> {
    const roleRepository = AppDataSource.getRepository(Role);

    try {
      const role = await roleRepository.findOne({ where: { roleId } });

      if (!role) {
        return { error: "Role not found for deletion." };
      }

      // Proceed with deletion
      await roleRepository.remove(role);

      return { success: true };
    } catch (error) {
      console.error("Error deleting role:", error);
      return { error: "An error occurred while deleting the role." };
    }
  }

  // Invalidate cache when roles are updated, created, or deleted
  static async invalidateRolesCache(): Promise<void> {
    await CacheService.invalidate(this.ROLE_CACHE_KEY);
  }

  static async saveRoles(roles: Role[]): Promise<{
    success: boolean;
    message: string;
    roles?: Partial<Role>[];
    errors?: Array<{ roleName: string; message: string }>;
  }> {
    const invalidRoles = [];
    const validRoles = [];

    // Validate all roles first
    for (const role of roles) {
      if (
        !role.roleName ||
        role.roleName.length < 3 ||
        role.roleName.length > 50
      ) {
        invalidRoles.push({
          roleName: role.roleName || "undefined",
          message: "Role name must be between 3 and 50 characters",
        });
        continue;
      }
      validRoles.push(role);
    }

    try {
      const savedRoles = await AppDataSource.getRepository(Role).save(
        validRoles
      );

      // Invalidate cache
      await CacheService.invalidate("roles:all");

      return {
        success: true,
        message: `${savedRoles.length} roles created successfully`,
        roles: savedRoles.map((role) => ({
          roleId: role.roleId,
          roleName: role.roleName,
          description: role.description,
          permissions: role.permissions,
        })),
        ...(invalidRoles.length > 0 && {
          errors: invalidRoles,
        }),
      };
    } catch (err) {
      return {
        success: false,
        message:
          "Database error: " +
          (err instanceof Error ? err.message : "Unknown error"),
      };
    }
  }
}
