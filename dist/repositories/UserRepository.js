"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserRepository = void 0;
const Database_1 = require("../config/Database");
const User_1 = require("../models/User");
const Role_1 = require("../models/Role");
const typeorm_1 = require("typeorm");
const CacheService_1 = require("../services/CacheService");
class UserRepository {
    /**
     * Find existing user by email or username
     */
    static findExistingUser(email, username) {
        return __awaiter(this, void 0, void 0, function* () {
            const cacheKey = `${this.CACHE_PREFIX}find:${email}:${username}`;
            return yield CacheService_1.CacheService.getOrSetSingle(cacheKey, Database_1.AppDataSource.getRepository(User_1.User), () => __awaiter(this, void 0, void 0, function* () {
                if (!Database_1.AppDataSource.isInitialized) {
                    throw new Error("Database not initialized");
                }
                const userRepository = Database_1.AppDataSource.getRepository(User_1.User);
                try {
                    return yield userRepository.findOne({
                        where: [{ email }, { username }],
                        relations: ["role"],
                    });
                }
                catch (err) {
                    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
                    throw new Error('Error finding existing user: ' + errorMessage);
                }
            }), this.CACHE_TTL);
        });
    }
    /**
     * Create a user entity from request data, assigning all fields.
     */
    static createUser(data) {
        var _a, _b, _c, _d, _e;
        const user = new User_1.User();
        user.username = (_a = data.username) !== null && _a !== void 0 ? _a : '';
        user.firstName = (_b = data.firstName) !== null && _b !== void 0 ? _b : '';
        user.lastName = (_c = data.lastName) !== null && _c !== void 0 ? _c : '';
        user.email = (_d = data.email) !== null && _d !== void 0 ? _d : '';
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
        user.roleId = (_e = data.roleId) !== null && _e !== void 0 ? _e : '';
        return user;
    }
    /**
     * Saves a user, assigning a default 'GUEST' role if not already assigned.
     */
    static saveUser(user) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!Database_1.AppDataSource.isInitialized) {
                throw new Error("Database not initialized");
            }
            const userRepository = Database_1.AppDataSource.getRepository(User_1.User);
            const roleRepository = Database_1.AppDataSource.getRepository(Role_1.Role);
            try {
                if (!user.roleId && !user.role) {
                    const guestRole = yield roleRepository.findOne({ where: { roleName: 'GUEST' } });
                    if (!guestRole) {
                        console.warn('"GUEST" role not found. Please seed the roles first.');
                        return { message: 'System configuration error: Default role not found' };
                    }
                    user.role = guestRole;
                    user.roleId = guestRole.roleId;
                }
                else if (user.roleId && !user.role) {
                    const existingRole = yield roleRepository.findOne({ where: { roleId: user.roleId } });
                    if (existingRole) {
                        user.role = existingRole;
                    }
                    else {
                        console.warn(`Role with ID ${user.roleId} not found. Assigning GUEST role.`);
                        const guestRole = yield roleRepository.findOne({ where: { roleName: 'GUEST' } });
                        if (guestRole) {
                            user.role = guestRole;
                            user.roleId = guestRole.roleId;
                        }
                        else {
                            return { message: 'System configuration error: Default role not found and provided roleId is invalid.' };
                        }
                    }
                }
                const savedUser = yield userRepository.save(user);
                // Invalidate caches
                yield CacheService_1.CacheService.invalidateMultiple([
                    `${this.CACHE_PREFIX}all`,
                    `${this.CACHE_PREFIX}${savedUser.userId}`,
                    `${this.CACHE_PREFIX}find:${savedUser.email}:${savedUser.username}`,
                    `${this.CACHE_PREFIX}${savedUser.userId}:organizations`,
                ]);
                return {
                    message: 'User saved successfully',
                    user: savedUser,
                };
            }
            catch (err) {
                const errorMessage = err instanceof Error ? err.message : 'Unknown error';
                console.error('Error saving user:', errorMessage);
                return { message: 'Database error: ' + errorMessage };
            }
        });
    }
    /**
     * Retrieves all users with selected fields and relations.
     */
    static getAllUsers() {
        return __awaiter(this, void 0, void 0, function* () {
            const cacheKey = `${this.CACHE_PREFIX}all`;
            const users = yield CacheService_1.CacheService.getOrSetMultiple(cacheKey, Database_1.AppDataSource.getRepository(User_1.User), () => __awaiter(this, void 0, void 0, function* () {
                const userRepository = Database_1.AppDataSource.getRepository(User_1.User);
                return yield userRepository.find({
                    select: [
                        "userId", "username", "firstName", "lastName", "email", "phoneNumber",
                        "bio", "profilePictureURL", "preferredLanguage", "timezone",
                        "emailNotificationsEnabled", "smsNotificationsEnabled", "socialMediaLinks",
                        "dateOfBirth", "gender", "addressLine1", "addressLine2", "city",
                        "stateProvince", "postalCode", "country",
                        "createdAt", "updatedAt", "deletedAt"
                    ],
                    relations: ["role", "organizations"],
                    order: { username: "DESC" },
                });
            }), this.CACHE_TTL);
            return users.length > 0 ? users : null;
        });
    }
    /**
     * Retrieves a user by ID with specified relations.
     */
    static getUserById(id) {
        return __awaiter(this, void 0, void 0, function* () {
            const cacheKey = `${this.CACHE_PREFIX}${id}`;
            return yield CacheService_1.CacheService.getOrSetSingle(cacheKey, Database_1.AppDataSource.getRepository(User_1.User), () => __awaiter(this, void 0, void 0, function* () {
                const userRepository = Database_1.AppDataSource.getRepository(User_1.User);
                const user = yield userRepository.findOne({
                    where: { userId: id },
                    select: [
                        "userId", "username", "firstName", "lastName", "email", "phoneNumber",
                        "bio", "profilePictureURL", "preferredLanguage", "timezone",
                        "emailNotificationsEnabled", "smsNotificationsEnabled", "socialMediaLinks",
                        "dateOfBirth", "gender", "addressLine1", "addressLine2", "city",
                        "stateProvince", "postalCode", "country",
                        "createdAt", "updatedAt", "deletedAt"
                    ],
                    relations: [
                        "role",
                        "organizations",
                        "registrationsAsAttendee",
                        "registrationsAsAttendee.event",
                        "registrationsAsAttendee.ticketType",
                        "registrationsAsAttendee.venue",
                    ],
                });
                if (!user) {
                    return null;
                }
                const allBoughtForUserIds = [];
                if (user.registrationsAsAttendee) {
                    user.registrationsAsAttendee.forEach(reg => {
                        if (reg.boughtForIds) {
                            reg.boughtForIds.forEach(boughtForId => {
                                if (!allBoughtForUserIds.includes(boughtForId)) {
                                    allBoughtForUserIds.push(boughtForId);
                                }
                            });
                        }
                    });
                }
                let boughtForUsersMap = new Map();
                if (allBoughtForUserIds.length > 0) {
                    const boughtUsers = yield userRepository.find({
                        where: { userId: (0, typeorm_1.In)(allBoughtForUserIds) },
                        select: ["userId", "username", "firstName", "lastName", "email", "phoneNumber"],
                    });
                    boughtUsers.forEach(bUser => boughtForUsersMap.set(bUser.userId, bUser));
                }
                user._fetchedBoughtForUsersMap = boughtForUsersMap;
                return user;
            }), this.CACHE_TTL);
        });
    }
    /**
     * Deletes a user by ID.
     */
    static deleteUser(id) {
        return __awaiter(this, void 0, void 0, function* () {
            const userRepository = Database_1.AppDataSource.getRepository(User_1.User);
            try {
                const user = yield userRepository.findOne({ where: { userId: id } });
                if (!user) {
                    return { success: false, message: "User not found" };
                }
                yield userRepository.remove(user);
                // Invalidate caches
                yield CacheService_1.CacheService.invalidateMultiple([
                    `${this.CACHE_PREFIX}all`,
                    `${this.CACHE_PREFIX}${id}`,
                    `${this.CACHE_PREFIX}find:${user.email}:${user.username}`,
                    `${this.CACHE_PREFIX}${id}:organizations`,
                ]);
                return { success: true, message: "User deleted successfully" };
            }
            catch (error) {
                console.error("Error deleting user:", error);
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                return { success: false, message: "Failed to delete user: " + errorMessage };
            }
        });
    }
    /**
     * Assigns a role to a user, typically when they are a new user or a 'GUEST'.
     */
    static assignUserRole(userId, newRoleId) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            const userRepository = Database_1.AppDataSource.getRepository(User_1.User);
            const roleRepository = Database_1.AppDataSource.getRepository(Role_1.Role);
            try {
                const user = yield userRepository.findOne({
                    where: { userId },
                    relations: ['role'],
                });
                if (!user) {
                    return { success: false, message: 'User not found' };
                }
                const newRole = yield roleRepository.findOne({
                    where: { roleId: newRoleId },
                });
                if (!newRole) {
                    return { success: false, message: 'Role not found' };
                }
                const currentRoleName = ((_b = (_a = user.role) === null || _a === void 0 ? void 0 : _a.roleName) === null || _b === void 0 ? void 0 : _b.toLowerCase()) || '';
                if (!user.role || currentRoleName === '' || currentRoleName === 'guest') {
                    user.role = newRole;
                    user.roleId = newRole.roleId;
                    yield userRepository.save(user);
                    // Invalidate caches
                    yield CacheService_1.CacheService.invalidateMultiple([
                        `${this.CACHE_PREFIX}${userId}`,
                        `${this.CACHE_PREFIX}all`,
                        `${this.CACHE_PREFIX}find:${user.email}:${user.username}`,
                    ]);
                    return { success: true, message: 'User role updated successfully' };
                }
                else {
                    return { success: false, message: 'User is not currently assigned the GUEST role or has no role assigned. Use updateUserRole for general updates.' };
                }
            }
            catch (error) {
                console.error('Error assigning user role:', error);
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                return { success: false, message: 'Failed to assign user role: ' + errorMessage };
            }
        });
    }
    /**
     * Updates a user's role to any new valid role.
     */
    static updateUserRole(userId, newRoleId) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const userRepository = Database_1.AppDataSource.getRepository(User_1.User);
            const roleRepository = Database_1.AppDataSource.getRepository(Role_1.Role);
            try {
                const user = yield userRepository.findOne({
                    where: { userId },
                    relations: ['role'],
                });
                if (!user) {
                    return { success: false, message: 'User not found' };
                }
                const newRole = yield roleRepository.findOne({
                    where: { roleId: newRoleId },
                });
                if (!newRole) {
                    return { success: false, message: 'Role not found' };
                }
                const oldRoleName = ((_a = user.role) === null || _a === void 0 ? void 0 : _a.roleName) || 'none';
                user.role = newRole;
                user.roleId = newRole.roleId;
                yield userRepository.save(user);
                // Invalidate caches
                yield CacheService_1.CacheService.invalidateMultiple([
                    `${this.CACHE_PREFIX}${userId}`,
                    `${this.CACHE_PREFIX}all`,
                    `${this.CACHE_PREFIX}find:${user.email}:${user.username}`,
                ]);
                return {
                    success: true,
                    message: `User role updated successfully from ${oldRoleName} to ${newRole.roleName}`,
                    user,
                    newRole
                };
            }
            catch (error) {
                console.error('Error updating user role:', error);
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                return { success: false, message: 'Failed to update user role: ' + errorMessage };
            }
        });
    }
    /**
     * Create multiple users from an array of user data
     */
    static createUsers(usersData) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!Database_1.AppDataSource.isInitialized) {
                throw new Error("Database not initialized");
            }
            const userRepository = Database_1.AppDataSource.getRepository(User_1.User);
            const createdUsers = [];
            const errors = [];
            for (const data of usersData) {
                try {
                    const user = this.createUser(data);
                    const savedResult = yield this.saveUser(user);
                    if (savedResult.user) {
                        createdUsers.push(savedResult.user);
                    }
                    else {
                        errors.push({
                            data,
                            error: savedResult.message,
                        });
                    }
                }
                catch (error) {
                    errors.push({
                        data,
                        error: error instanceof Error ? error.message : 'Unknown error',
                    });
                }
            }
            // Invalidate cache for user list
            yield CacheService_1.CacheService.invalidate(`${this.CACHE_PREFIX}all`);
            return {
                success: errors.length === 0,
                users: createdUsers,
                errors,
            };
        });
    }
    /**
     * Find multiple existing users by email or username
     */
    static findExistingUsers(usersData) {
        return __awaiter(this, void 0, void 0, function* () {
            const cacheKey = `${this.CACHE_PREFIX}findMultiple:${JSON.stringify(usersData.map(u => `${u.email}:${u.username}`).sort())}`;
            return (yield CacheService_1.CacheService.getOrSetMap(cacheKey, () => __awaiter(this, void 0, void 0, function* () {
                if (!Database_1.AppDataSource.isInitialized) {
                    throw new Error("Database not initialized");
                }
                const userRepository = Database_1.AppDataSource.getRepository(User_1.User);
                const existingUsers = new Map();
                try {
                    const emails = usersData.map(u => u.email);
                    const usernames = usersData.map(u => u.username);
                    const users = yield userRepository.find({
                        where: [
                            { email: (0, typeorm_1.In)(emails) },
                            { username: (0, typeorm_1.In)(usernames) },
                        ],
                        relations: ["role"],
                    });
                    users.forEach(user => {
                        existingUsers.set(user.email, user);
                        existingUsers.set(user.username, user);
                    });
                    return existingUsers;
                }
                catch (err) {
                    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
                    throw new Error('Error finding existing users: ' + errorMessage);
                }
            }), this.CACHE_TTL)) || new Map();
        });
    }
}
exports.UserRepository = UserRepository;
UserRepository.CACHE_PREFIX = 'user:';
UserRepository.CACHE_TTL = 3600; // 1 hour
