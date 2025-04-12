import { AppDataSource } from "../config/Database";
import { User } from "../models/User";
import { Role } from "../models/Role";
import { Organization } from "../models/Organization";
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
    user.phoneNumber = data.PhoneNumber ?? null;
    user.password = data.Password ?? '';

    return user;
  }

  /**
   * Save the user with a default GUEST role and optional organization
   */
  static async saveUser(
    user: User,
    organizationId?: string // Optional: pass if you want to assign org
  ): Promise<{ success: boolean; message: string; user?: User }> {
    if (!AppDataSource.isInitialized) {
      throw new Error("Database not initialized");
    }

    const userRepository = AppDataSource.getRepository(User);
    const roleRepository = AppDataSource.getRepository(Role);
    const orgRepository = AppDataSource.getRepository(Organization);

    try {
      // 1. Assign default role
      const guestRole = await roleRepository.findOne({ where: { roleName: 'GUEST' } });

      if (!guestRole) {
        console.warn('"GUEST" role not found. Please seed the roles first.');
        return { success: false, message: 'System configuration error: Default role not found' };
      }

      user.roles = [guestRole];

      // 2. Assign organization if provided
      if (organizationId) {
        const org = await orgRepository.findOne({ where: { organizationId } });

        if (!org) {
          return { success: false, message: 'Provided organization does not exist' };
        }

        user.organizations = [org]; // Assuming many-to-many User <-> Organization
      }

      // 3. Save the user
      const savedUser = await userRepository.save(user);

      return {
        success: true,
        message: 'User saved successfully with default role "GUEST"',
        user: savedUser,
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      console.error('Error saving user:', errorMessage);
      return { success: false, message: 'Database error: ' + errorMessage };
    }
  }

  static async getAllUsers(): Promise<Partial<User[]> | null> {
    const userRepository = AppDataSource.getRepository(User);
    return await userRepository.find({
      select: ["userId", "username", "firstName", "lastName", "email","phoneNumber"],
    });
  }

  static async getUserById(id: UserInterface["UserID"]): Promise<Partial<User> | null> {
    const userRepository = AppDataSource.getRepository(User);
    return await userRepository.findOne({
      where: { userId: id },
      select: ["userId", "username", "firstName", "lastName", "email", "phoneNumber"],
    });
  }
}
