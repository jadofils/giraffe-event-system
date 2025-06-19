import { AppDataSource } from "../config/Database";
import { Role } from "../models/Role";
import { Permission } from "../models/Permission";
import { User } from "../models/User";

export class AdminRoleSeeder {
  static async seed() {
    const queryRunner = AppDataSource.createQueryRunner();
    const roleRepository = AppDataSource.getRepository(Role);
    const permissionRepository = AppDataSource.getRepository(Permission);
    const userRepository = AppDataSource.getRepository(User);

    try {
      await queryRunner.connect();
      await queryRunner.startTransaction();

      // Step 1: Handle deletion of the specific role
      const roleIdToDelete = '23f5ad33-f337-49cd-872c-82ca6854f16d';
      const roleToDelete = await roleRepository.findOne({ where: { roleId: roleIdToDelete } });

      if (roleToDelete) {
        console.log(`🧹 Found role with ID '${roleIdToDelete}'. Handling dependent users...`);

        // Update users referencing this role to set roleId to NULL
        const updatedUsers = await userRepository.update(
          { roleId: roleIdToDelete },
          { roleId: undefined  }
        );
        console.log(`🔄 Updated ${updatedUsers.affected} users to remove reference to role ID '${roleIdToDelete}'`);

        // Delete the role
        await roleRepository.delete({ roleId: roleIdToDelete });
        console.log(`🗑️ Role with ID '${roleIdToDelete}' deleted successfully.`);
      } else {
        console.log(`ℹ️ Role with ID '${roleIdToDelete}' not found. Skipping deletion.`);
      }

      // Step 2: Seed or update the ADMIN role
      let adminRole = await roleRepository.findOne({
        where: { roleName: "ADMIN" },
        relations: ["permissions"],
      });

      if (!adminRole) {
        console.log("🌱 Creating new ADMIN role...");
        adminRole = new Role();
        adminRole.roleName = "ADMIN";
        adminRole.description = "System administrator with all permissions";
      } else {
        console.log("ℹ️ ADMIN role already exists. Updating permissions...");
      }

      // Get all permissions
      const allPermissions = await permissionRepository.find();
      if (!allPermissions.length) {
        console.warn("⚠️ No permissions found. Ensure PermissionSeeder runs first.");
      }

      // Assign all permissions to the ADMIN role
      adminRole.permissions = allPermissions;

      // Save the ADMIN role
      await roleRepository.save(adminRole);
      console.log("🎉 ADMIN role seeded/updated with all permissions.");

      await queryRunner.commitTransaction();
    } catch (error) {
      console.error("Error during AdminRoleSeeder:", error);
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
}