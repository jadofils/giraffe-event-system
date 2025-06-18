import { AppDataSource } from "../config/Database";
import { Role } from "../models/Role";
import { Permission } from "../models/Permission";

export class AdminRoleSeeder {
  static async seed() {
    const roleRepository = AppDataSource.getRepository(Role);
    const permissionRepository = AppDataSource.getRepository(Permission);

    // Check if admin role exists
    let adminRole = await roleRepository.findOne({
      where: { roleName: "admin" },
      relations: ["permissions"],
    });

    if (!adminRole) {
      adminRole = new Role();
      adminRole.roleName = "admin";
      adminRole.description = "System administrator with all permissions";
    }

    // Get all permissions
    const allPermissions = await permissionRepository.find();
    adminRole.permissions = allPermissions;

    await roleRepository.save(adminRole);
    console.log("Admin role seeded with all permissions");
  }
}
