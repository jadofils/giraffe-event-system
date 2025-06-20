// src/repositories/PermissionRepository.ts
import { AppDataSource } from "../config/Database";
import { Permission } from "../models/Permission";
import { CacheService } from "../services/CacheService";

export class PermissionRepository {
  private static readonly CACHE_PREFIX = "permission:";
  private static readonly CACHE_TTL = 3600;

  static async getAllPermissions(): Promise<{ success: boolean; message?: string; data?: Permission[] }> {
    const cacheKey = `${this.CACHE_PREFIX}all`;
    try {
      const permissions = await CacheService.getOrSetMultiple(
        cacheKey,
        AppDataSource.getRepository(Permission),
        async () => {
          return await AppDataSource.getRepository(Permission).find({
            select: ["id", "name", "description"],
            order: { name: "ASC" },
          });
        },
        this.CACHE_TTL
      );

      return {
        success: true,
        data: permissions,
        message: permissions.length ? undefined : "No permissions found.",
      };
    } catch (error) {
      console.error("Error fetching all permissions:", error);
      return { success: false, message: `Failed to fetch permissions: ${error instanceof Error ? error.message : "Unknown error"}` };
    }
  }
}