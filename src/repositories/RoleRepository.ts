// src/repositories/RoleRepository.ts
import { AppDataSource } from "../config/Database";
import { Role } from "../models/Role";
import { RoleInterface } from "../interfaces/interface";

export class RoleRepository {
  static async findRoleByName(roleName: string): Promise<Role | null> {
    const roleRepository = AppDataSource.getRepository(Role);
    return await roleRepository.findOne({ where: { roleName } });
  }

  static createRole(data: Partial<RoleInterface>): Role {
    const role = new Role();
    role.roleName = data.RoleName ?? '';
    role.description = data.Description ?? '';
    role.permissions = data.Permissions ?? [];
    return role;
  }

  static async saveRole(role: Role): Promise<{ success: boolean; message: string }> {
    const roleRepository = AppDataSource.getRepository(Role);

    if (!role.roleName || role.roleName.length < 3 || role.roleName.length > 50) {
      return { success: false, message: 'Role name must be between 3 and 50 characters' };
    }

    try {
      await roleRepository.save(role);
      return { success: true, message: 'Role saved successfully' };
    } catch (err) {
      return { success: false, message: 'Database error: ' + (err instanceof Error ? err.message : 'Unknown error') };
    }
  }

  static async getAllRoles(): Promise<Role[]> {
    const roleRepository = AppDataSource.getRepository(Role);
    return await roleRepository.find();
  }

  static async getRoleById(id: RoleInterface["RoleID"]): Promise<Role | null> {
    const roleRepository = AppDataSource.getRepository(Role);
    return await roleRepository.findOne({ where: { roleId: id } });
  }
  static async updateRole(
    id: RoleInterface["RoleID"],
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
  
      console.log("Role Before Update:", role);
  
      // Use structured updates
      role.roleName = roleData.RoleName || role.roleName;
      role.description = roleData.Description || role.description;
      role.permissions = roleData.Permissions || role.permissions;
  
      const updatedRole = await roleRepository.save(role);
      console.log("Role After Update:", updatedRole);
  
      return updatedRole;
    } catch (error) {
      console.error("Error updating role:", error);
      return { error: "An error occurred while updating the role." };
    }
  }
  
  static async deleteRole(roleId: string): Promise<{ success: boolean } | { error: string }> {
    const roleRepository = AppDataSource.getRepository(Role);
  
    try {
      const role = await roleRepository.findOne({ where: { roleId } });
  
      if (!role) {
        return { error: 'Role not found for deletion.' };
      }
  
      // Proceed with deletion
      await roleRepository.remove(role);
  
      return { success: true };
    } catch (error) {
      console.error('Error deleting role:', error);
      return { error: 'An error occurred while deleting the role.' };
    }
  }
  
}

