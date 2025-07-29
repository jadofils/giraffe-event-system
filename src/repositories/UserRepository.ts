import { AppDataSource } from "../config/Database";
import { User } from "../models/User";
import { Role } from "../models/Role";
import { UserInterface } from "../interfaces/UserInterface";
import { In, IsNull } from "typeorm";
import { Organization } from "../models/Organization";
import { CacheService } from "../services/CacheService";

export class UserRepository {
  private static readonly CACHE_PREFIX = "user:";
  private static readonly CACHE_TTL = 3600; // 1 hour

  /**
   * Find existing user by email or username
   */
  static async findExistingUser(
    email: string,
    username: string
  ): Promise<User | null> {
    const cacheKey = `${this.CACHE_PREFIX}find:${email}:${username}`;

    return await CacheService.getOrSetSingle(
      cacheKey,
      AppDataSource.getRepository(User),
      async () => {
        if (!AppDataSource.isInitialized) {
          throw new Error("Database not initialized");
        }

        const userRepository = AppDataSource.getRepository(User);
        try {
          return await userRepository.findOne({
            where: [{ email }, { username }],
            relations: ["role"],
          });
        } catch (err) {
          const errorMessage =
            err instanceof Error ? err.message : "Unknown error";
          throw new Error("Error finding existing user: " + errorMessage);
        }
      },
      this.CACHE_TTL
    );
  }

  /**
   * Create a user entity from request data, assigning all fields.
   */
  static createUser(data: Partial<UserInterface>): User {
    const user = new User();
    user.username = data.username ?? "";
    user.firstName = data.firstName ?? "";
    user.lastName = data.lastName ?? "";
    user.email = data.email ?? "";
    user.password = data.password;
    user.phoneNumber = data.phoneNumber;
    user.bio = data.bio;
    user.profilePictureURL = data.profilePictureURL;
    user.preferredLanguage = data.preferredLanguage;
    user.timezone = data.timezone;
    user.emailNotificationsEnabled = data.emailNotificationsEnabled;
    user.smsNotificationsEnabled = data.smsNotificationsEnabled;
    user.socialMediaLinks = data.socialMediaLinks;
    user.dateOfBirth = data.dateOfBirth;
    user.gender = data.gender;
    user.addressLine1 = data.addressLine1;
    user.addressLine2 = data.addressLine2;
    user.city = data.city;
    user.stateProvince = data.stateProvince;
    user.postalCode = data.postalCode;
    user.country = data.country;
    user.roleId = data.roleId ?? "";

    return user;
  }

  /**
   * Saves a user, assigning a default 'GUEST' role if not already assigned.
   */
  static async saveUser(user: User): Promise<{ message: string; user?: User }> {
    if (!AppDataSource.isInitialized) {
      throw new Error("Database not initialized");
    }

    const userRepository = AppDataSource.getRepository(User);
    const roleRepository = AppDataSource.getRepository(Role);

    try {
      if (!user.roleId && !user.role) {
        const guestRole = await roleRepository.findOne({
          where: { roleName: "GUEST" },
        });
        if (!guestRole) {
          console.warn('"GUEST" role not found. Please seed the roles first.');
          return {
            message: "System configuration error: Default role not found",
          };
        }
        user.role = guestRole;
        user.roleId = guestRole.roleId;
      } else if (user.roleId && !user.role) {
        const existingRole = await roleRepository.findOne({
          where: { roleId: user.roleId },
        });
        if (existingRole) {
          user.role = existingRole;
        } else {
          console.warn(
            `Role with ID ${user.roleId} not found. Assigning GUEST role.`
          );
          const guestRole = await roleRepository.findOne({
            where: { roleName: "GUEST" },
          });
          if (guestRole) {
            user.role = guestRole;
            user.roleId = guestRole.roleId;
          } else {
            return {
              message:
                "System configuration error: Default role not found and provided roleId is invalid.",
            };
          }
        }
      }

      const savedUser = await userRepository.save(user);

      // Invalidate caches
      await CacheService.invalidateMultiple([
        `${this.CACHE_PREFIX}all`,
        `${this.CACHE_PREFIX}${savedUser.userId}`,
        `${this.CACHE_PREFIX}find:${savedUser.email}:${savedUser.username}`,
        `${this.CACHE_PREFIX}${savedUser.userId}:organizations`,
      ]);

      return {
        message: "User saved successfully",
        user: savedUser,
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      console.error("Error saving user:", errorMessage);
      return { message: "Database error: " + errorMessage };
    }
  }

  /**
   * Retrieves all users with selected fields and relations.
   */
  static async getAllUsers(): Promise<Partial<User[]> | null> {
    const cacheKey = `${this.CACHE_PREFIX}all`;

    const users = await CacheService.getOrSetMultiple(
      cacheKey,
      AppDataSource.getRepository(User),
      async () => {
        const userRepository = AppDataSource.getRepository(User);
        return await userRepository.find({
          select: [
            "userId",
            "username",
            "firstName",
            "lastName",
            "email",
            "phoneNumber",
            "bio",
            "profilePictureURL",
            "preferredLanguage",
            "timezone",
            "emailNotificationsEnabled",
            "smsNotificationsEnabled",
            "socialMediaLinks",
            "dateOfBirth",
            "gender",
            "addressLine1",
            "addressLine2",
            "city",
            "stateProvince",
            "postalCode",
            "country",
            "createdAt",
            "updatedAt",
            "deletedAt",
          ],
          relations: ["role", "organizations"],
          order: { username: "DESC" },
        });
      },
      this.CACHE_TTL
    );

    return users.length > 0 ? users : null;
  }

  /**
   * Retrieves a user by ID with specified relations.
   */
  static async getUserById(
    id: UserInterface["userId"]
  ): Promise<Partial<User> | null> {
    const cacheKey = `${this.CACHE_PREFIX}${id}`;

    return await CacheService.getOrSetSingle(
      cacheKey,
      AppDataSource.getRepository(User),
      async () => {
        const userRepository = AppDataSource.getRepository(User);
        const user = await userRepository.findOne({
          where: { userId: id },
          select: [
            "userId",
            "username",
            "firstName",
            "lastName",
            "email",
            "phoneNumber",
            "bio",
            "profilePictureURL",
            "preferredLanguage",
            "timezone",
            "emailNotificationsEnabled",
            "smsNotificationsEnabled",
            "socialMediaLinks",
            "dateOfBirth",
            "gender",
            "addressLine1",
            "addressLine2",
            "city",
            "stateProvince",
            "postalCode",
            "country",
            "createdAt",
            "updatedAt",
            "deletedAt",
          ],
          relations: ["role", "role.permissions", "organizations"],
        });

        if (!user) {
          return null;
        }

        const allBoughtForUserIds: string[] = [];
        if (user.registrationsAsAttendee) {
          user.registrationsAsAttendee.forEach((reg) => {
            if (reg.boughtForIds) {
              reg.boughtForIds.forEach((boughtForId) => {
                if (!allBoughtForUserIds.includes(boughtForId)) {
                  allBoughtForUserIds.push(boughtForId);
                }
              });
            }
          });
        }

        let boughtForUsersMap: Map<string, Partial<User>> = new Map();
        if (allBoughtForUserIds.length > 0) {
          const boughtUsers = await userRepository.find({
            where: { userId: In(allBoughtForUserIds) },
            select: [
              "userId",
              "username",
              "firstName",
              "lastName",
              "email",
              "phoneNumber",
            ],
          });
          boughtUsers.forEach((bUser) =>
            boughtForUsersMap.set(bUser.userId, bUser)
          );
        }

        (user as any)._fetchedBoughtForUsersMap = boughtForUsersMap;
        return user;
      },
      this.CACHE_TTL
    );
  }

  /**
   * Deletes a user by ID.
   */
  static async deleteUser(
    id: UserInterface["userId"]
  ): Promise<{ success: boolean; message: string }> {
    const userRepository = AppDataSource.getRepository(User);

    try {
      const user = await userRepository.findOne({ where: { userId: id } });

      if (!user) {
        return { success: false, message: "User not found" };
      }

      await userRepository.remove(user);

      // Invalidate caches
      await CacheService.invalidateMultiple([
        `${this.CACHE_PREFIX}all`,
        `${this.CACHE_PREFIX}${id}`,
        `${this.CACHE_PREFIX}find:${user.email}:${user.username}`,
        `${this.CACHE_PREFIX}${id}:organizations`,
      ]);

      return { success: true, message: "User deleted successfully" };
    } catch (error) {
      console.error("Error deleting user:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      return {
        success: false,
        message: "Failed to delete user: " + errorMessage,
      };
    }
  }

  /**
   * Assigns a role to a user, typically when they are a new user or a 'GUEST'.
   */
  static async assignUserRole(
    userId: string,
    newRoleId: string
  ): Promise<{ success: boolean; message: string }> {
    const userRepository = AppDataSource.getRepository(User);
    const roleRepository = AppDataSource.getRepository(Role);

    try {
      const user = await userRepository.findOne({
        where: { userId },
        relations: ["role"],
      });

      if (!user) {
        return { success: false, message: "User not found" };
      }

      const newRole = await roleRepository.findOne({
        where: { roleId: newRoleId },
      });

      if (!newRole) {
        return { success: false, message: "Role not found" };
      }

      const currentRoleName = user.role?.roleName?.toLowerCase() || "";
      if (!user.role || currentRoleName === "" || currentRoleName === "guest") {
        user.role = newRole;
        user.roleId = newRole.roleId;
        await userRepository.save(user);

        // Invalidate caches
        await CacheService.invalidateMultiple([
          `${this.CACHE_PREFIX}${userId}`,
          `${this.CACHE_PREFIX}all`,
          `${this.CACHE_PREFIX}find:${user.email}:${user.username}`,
        ]);

        return { success: true, message: "User role updated successfully" };
      } else {
        return {
          success: false,
          message:
            "User is not currently assigned the GUEST role or has no role assigned. Use updateUserRole for general updates.",
        };
      }
    } catch (error) {
      console.error("Error assigning user role:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      return {
        success: false,
        message: "Failed to assign user role: " + errorMessage,
      };
    }
  }

  /**
   * Updates a user's role to any new valid role.
   */
  static async updateUserRole(
    userId: string,
    newRoleId: string
  ): Promise<{
    success: boolean;
    message: string;
    user?: User;
    newRole?: Role;
  }> {
    const userRepository = AppDataSource.getRepository(User);
    const roleRepository = AppDataSource.getRepository(Role);

    try {
      const user = await userRepository.findOne({
        where: { userId },
        relations: ["role"],
      });

      if (!user) {
        return { success: false, message: "User not found" };
      }

      const newRole = await roleRepository.findOne({
        where: { roleId: newRoleId },
      });

      if (!newRole) {
        return { success: false, message: "Role not found" };
      }

      const oldRoleName = user.role?.roleName || "none";
      user.role = newRole;
      user.roleId = newRole.roleId;

      await userRepository.save(user);

      // Invalidate caches
      await CacheService.invalidateMultiple([
        `${this.CACHE_PREFIX}${userId}`,
        `${this.CACHE_PREFIX}all`,
        `${this.CACHE_PREFIX}find:${user.email}:${user.username}`,
      ]);

      return {
        success: true,
        message: `User role updated successfully from ${oldRoleName} to ${newRole.roleName}`,
        user,
        newRole,
      };
    } catch (error) {
      console.error("Error updating user role:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      return {
        success: false,
        message: "Failed to update user role: " + errorMessage,
      };
    }
  }

  /**
   * Create multiple users from an array of user data
   */
  static async createUsers(
    usersData: Partial<UserInterface>[]
  ): Promise<{ success: boolean; users: User[]; errors: any[] }> {
    if (!AppDataSource.isInitialized) {
      throw new Error("Database not initialized");
    }

    const userRepository = AppDataSource.getRepository(User);
    const createdUsers: User[] = [];
    const errors: any[] = [];

    for (const data of usersData) {
      try {
        const user = this.createUser(data);
        const savedResult = await this.saveUser(user);
        if (savedResult.user) {
          createdUsers.push(savedResult.user);
        } else {
          errors.push({
            data,
            error: savedResult.message,
          });
        }
      } catch (error) {
        errors.push({
          data,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    // Invalidate cache for user list
    await CacheService.invalidate(`${this.CACHE_PREFIX}all`);

    return {
      success: errors.length === 0,
      users: createdUsers,
      errors,
    };
  }

  /**
   * Find multiple existing users by email or username
   * NOTE: For registration, we do NOT cache this check to avoid stale cache issues.
   * Only users with deletedAt IS NULL are considered existing.
   */
  static async findExistingUsers(
    usersData: { email: string; username: string }[]
  ): Promise<Map<string, User>> {
    if (!AppDataSource.isInitialized) {
      throw new Error("Database not initialized");
    }
    const userRepository = AppDataSource.getRepository(User);
    const existingUsers = new Map<string, User>();
    try {
      const emails = usersData.map((u) => u.email);
      const usernames = usersData.map((u) => u.username);
      const users = await userRepository.find({
        where: [
          { email: In(emails), deletedAt: IsNull() },
          { username: In(usernames), deletedAt: IsNull() },
        ],
        relations: ["role"],
      });
      users.forEach((user) => {
        existingUsers.set(user.email, user);
        existingUsers.set(user.username, user);
      });
      return existingUsers;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      throw new Error("Error finding existing users: " + errorMessage);
    }
  }
}
