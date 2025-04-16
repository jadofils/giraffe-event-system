import { AppDataSource } from "../config/Database";
import { User } from "../models/User";
import { Role } from "../models/Role";
import { UserInterface } from "../interfaces/interface";

export class UserRepository {
 
  /**
   * Find existing user by email or username
   */
  static async findExistingUser(email: string, username: string): Promise<User | null> {
    if (!AppDataSource.isInitialized) {
      throw new Error("Database not initialized");
    }

    const userRepository = AppDataSource.getRepository(User);
    try {
      return await userRepository.findOne({
        where: [{ email }, { username }],
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      throw new Error('Error finding existing user: ' + errorMessage);
    }
  }

  /**
   * Create a user entity from request data
   */
  static createUser(data: Partial<UserInterface>): User {
    const user = new User();
    user.username = data.Username ?? '';
    user.firstName = data.FirstName ?? '';
    user.lastName = data.LastName ?? '';
    user.email = data.Email ?? '';
    user.phoneNumber = data.PhoneNumber ?? undefined;

    return user;
  }

  /**
   */
  static async saveUser(user: User): Promise<{ message: string; user?: User }> {
    if (!AppDataSource.isInitialized) {
      throw new Error("Database not initialized");
    }
  
    const userRepository = AppDataSource.getRepository(User);
    const roleRepository = AppDataSource.getRepository(Role);
  
    try {
      // 1. Assign default role
      const guestRole = await roleRepository.findOne({ where: { roleName: 'GUEST' } });
  
      if (!guestRole) {
        console.warn('"GUEST" role not found. Please seed the roles first.');
        return { message: 'System configuration error: Default role not found' };
      }
  
      // Assign the GUEST role to the user
      user.role = guestRole;
  
      // 2. Save the user
      const savedUser = await userRepository.save(user);
  
      return {
        message: 'User saved successfully with default role "GUEST"',
        user: savedUser,
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      console.error('Error saving user:', errorMessage);
      return { message: 'Database error: ' + errorMessage };
    }
  }
  



  static async getAllUsers(): Promise<Partial<User[]> | null> {
    const userRepository = AppDataSource.getRepository(User);
    return await userRepository.find({
      select: ["userId", "username", "firstName", "lastName", "email","phoneNumber"],
      relations: ["role", "organizations"], // Correct the relation names      order: { username: "DESC" }, // Sort by username

    });
  }

  static async getUserById(id: UserInterface["UserID"]): Promise<Partial<User> | null> {
    const userRepository = AppDataSource.getRepository(User);
    return await userRepository.findOne({
      where: { userId: id },
      select: ["userId", "username", "firstName", "lastName", "email", "phoneNumber"],
      relations: ["role", "organizations"], // Correct the relation names
    });
  }

  static async deleteUser(id: UserInterface["UserID"]): Promise<{ success: boolean; message: string }> {
    const userRepository = AppDataSource.getRepository(User);
  
    try {
      const user = await userRepository.findOne({ where: { userId: id } });
  
      if (!user) {
        return { success: false, message: "User not found" };
      }
  
      await userRepository.remove(user);
      return { success: true, message: "User deleted successfully" };
    } catch (error) {
      console.error("Error deleting user:", error);
      return { success: false, message: "Failed to delete user" };
    }
  }


  static async assignUserRole(userId: string, newRoleId: string): Promise<{ success: boolean; message: string }> {
    const userRepository = AppDataSource.getRepository(User);
    const roleRepository = AppDataSource.getRepository(Role);
  
    try {
      // Fetch the user by their ID
      const user = await userRepository.findOne({
        where: { userId },
        relations: ['role'], // Ensure the current role is fetched
      });
  
      if (!user) {
        return { success: false, message: 'User not found' };
      }
  
      // Fetch the new role by its ID
      const newRole = await roleRepository.findOne({
        where: { roleId: newRoleId },
      });
  
      if (!newRole) {
        return { success: false, message: 'Role not found' };
      }
  
      // Check if the user's current role is GUEST, null, or empty (case-insensitive)
      const currentRoleName = user.role?.roleName?.toLowerCase() || '';
      if (!user.role || currentRoleName === '' || currentRoleName === 'guest') {
        // Assign the new role to the user
        user.role = newRole;
  
        // Save the updated user
        await userRepository.save(user);
  
        return { success: true, message: 'User role updated successfully' };
      } else {
        return { success: false, message: 'User is not currently assigned the GUEST role or has no role assigned' };
      }
    } catch (error) {
      console.error('Error assigning user role:', error);
      return { success: false, message: 'Failed to assign user role' };
    }
  }

// Repository method
static async updateUserRole(userId: string, newRoleId: string): Promise<{ 
  success: boolean; 
  message: string; 
  user?: User;
  newRole?: Role;
}> {
  const userRepository = AppDataSource.getRepository(User);
  const roleRepository = AppDataSource.getRepository(Role);

  try {
    // Fetch the user by their ID
    const user = await userRepository.findOne({
      where: { userId },
      relations: ['role'], // Ensure the current role is fetched
    });

    if (!user) {
      return { success: false, message: 'User not found' };
    }

    // Fetch the new role by its ID
    const newRole = await roleRepository.findOne({
      where: { roleId: newRoleId },
    });

    if (!newRole) {
      return { success: false, message: 'Role not found' };
    }

    // Get the old role name for the response message
    const oldRoleName = user.role?.roleName || 'none';

    // Update the user's role without any restriction
    user.role = newRole;

    // Save the updated user
    await userRepository.save(user);

    // Return the successful result with details
    return { 
      success: true, 
      message: `User role updated successfully from ${oldRoleName} to ${newRole.roleName}`,
      user,
      newRole
    };
  } catch (error) {
    console.error('Error updating user role:', error);
    return { success: false, message: 'Failed to update user role' };
  }
}



}
