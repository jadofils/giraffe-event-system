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
exports.RoleRepository = void 0;
// src/repositories/RoleRepository.ts
const Database_1 = require("../config/Database");
const Role_1 = require("../models/Role");
const typeorm_1 = require("typeorm"); // Import ILike for case-insensitive search
const CacheService_1 = require("../services/CacheService");
const Permission_1 = require("../models/Permission");
class RoleRepository {
    static findRoleByName(roleName) {
        return __awaiter(this, void 0, void 0, function* () {
            const roleRepository = Database_1.AppDataSource.getRepository(Role_1.Role);
            return yield roleRepository.findOne({
                where: { roleName },
                relations: ["users"],
            });
        });
    }
    // --- NEW METHOD FOR CASE-INSENSITIVE SEARCH ---
    static findRolesByNameIgnoreCase(roleName) {
        return __awaiter(this, void 0, void 0, function* () {
            const roleRepository = Database_1.AppDataSource.getRepository(Role_1.Role);
            return yield roleRepository.find({
                where: { roleName: (0, typeorm_1.ILike)(`%${roleName}%`) }, // Using ILike for case-insensitive LIKE
                relations: ["users"], // Include relations if needed
            });
        });
    }
    // --- END NEW METHOD ---
    static createRole(data) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            const role = new Role_1.Role();
            role.roleName = (_a = data.roleName) !== null && _a !== void 0 ? _a : "";
            role.description = (_b = data.description) !== null && _b !== void 0 ? _b : "";
            if (data.permissions && Array.isArray(data.permissions)) {
                // Accept permissions as array of names (string[]) or Permission[]
                let permissionNames = [];
                if (data.permissions.every((p) => typeof p === "string")) {
                    permissionNames = data.permissions;
                }
                else if (data.permissions.every((p) => typeof p === "object" && p !== null && "name" in p)) {
                    permissionNames = data.permissions.map((p) => p.name);
                }
                else {
                    return { error: "Invalid permissions format." };
                }
                const permissionRepo = Database_1.AppDataSource.getRepository(Permission_1.Permission);
                const foundPermissions = yield permissionRepo.find({
                    where: permissionNames.map((name) => ({ name })),
                });
                if (foundPermissions.length !== permissionNames.length) {
                    return { error: "One or more permissions do not exist." };
                }
                role.permissions = foundPermissions;
            }
            else {
                role.permissions = [];
            }
            return role;
        });
    }
    static saveRole(role) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const roleRepository = Database_1.AppDataSource.getRepository(Role_1.Role);
            if (!role.roleName ||
                role.roleName.length < 3 ||
                role.roleName.length > 50) {
                return {
                    success: false,
                    message: "Role name must be between 3 and 50 characters",
                };
            }
            try {
                yield roleRepository.save(role);
                return {
                    success: true,
                    message: "Role saved successfully",
                    role: {
                        roleId: role.roleId,
                        roleName: role.roleName,
                        description: role.description,
                        permissions: role.permissions,
                    },
                    users: ((_a = role.users) === null || _a === void 0 ? void 0 : _a.map((user) => {
                        var _a;
                        return ({
                            userId: user.userId,
                            username: user.username,
                            email: user.email,
                            firstName: user.firstName,
                            lastName: user.lastName,
                            phoneNumber: (_a = user.phoneNumber) !== null && _a !== void 0 ? _a : "",
                        });
                    })) || [],
                };
            }
            catch (err) {
                return {
                    success: false,
                    message: "Database error: " +
                        (err instanceof Error ? err.message : "Unknown error"),
                };
            }
        });
    }
    static getAllRoles() {
        return __awaiter(this, void 0, void 0, function* () {
            const roleRepository = Database_1.AppDataSource.getRepository(Role_1.Role);
            return yield CacheService_1.CacheService.getOrSetMultiple(this.ROLE_CACHE_KEY, roleRepository, () => __awaiter(this, void 0, void 0, function* () {
                return yield roleRepository.find({
                    relations: ["users"],
                });
            }));
        });
    }
    static getRoleById(id) {
        return __awaiter(this, void 0, void 0, function* () {
            const roleRepository = Database_1.AppDataSource.getRepository(Role_1.Role);
            return yield roleRepository.findOne({
                where: { roleId: id },
                relations: ["users"],
            });
        });
    }
    static updateRole(id, roleData) {
        return __awaiter(this, void 0, void 0, function* () {
            const roleRepository = Database_1.AppDataSource.getRepository(Role_1.Role);
            if (!id || typeof id !== "string" || id.trim() === "") {
                return { error: "Invalid Role ID provided." };
            }
            try {
                const role = yield roleRepository.findOne({ where: { roleId: id } });
                if (!role) {
                    return { error: "Role not found." };
                }
                // Structured updates
                role.roleName = roleData.roleName || role.roleName;
                role.description = roleData.description || role.description;
                role.permissions = roleData.permissions || role.permissions;
                const updatedRole = yield roleRepository.save(role);
                return updatedRole;
            }
            catch (error) {
                console.error("Error updating role:", error);
                return { error: "An error occurred while updating the role." };
            }
        });
    }
    static deleteRole(roleId) {
        return __awaiter(this, void 0, void 0, function* () {
            const roleRepository = Database_1.AppDataSource.getRepository(Role_1.Role);
            try {
                const role = yield roleRepository.findOne({ where: { roleId } });
                if (!role) {
                    return { error: "Role not found for deletion." };
                }
                // Proceed with deletion
                yield roleRepository.remove(role);
                return { success: true };
            }
            catch (error) {
                console.error("Error deleting role:", error);
                return { error: "An error occurred while deleting the role." };
            }
        });
    }
    // Invalidate cache when roles are updated, created, or deleted
    static invalidateRolesCache() {
        return __awaiter(this, void 0, void 0, function* () {
            yield CacheService_1.CacheService.invalidate(this.ROLE_CACHE_KEY);
        });
    }
    static saveRoles(roles) {
        return __awaiter(this, void 0, void 0, function* () {
            const invalidRoles = [];
            const validRoles = [];
            // Validate all roles first
            for (const role of roles) {
                if (!role.roleName ||
                    role.roleName.length < 3 ||
                    role.roleName.length > 50) {
                    invalidRoles.push({
                        roleName: role.roleName || "undefined",
                        message: "Role name must be between 3 and 50 characters",
                    });
                    continue;
                }
                validRoles.push(role);
            }
            try {
                const savedRoles = yield Database_1.AppDataSource.getRepository(Role_1.Role).save(validRoles);
                // Invalidate cache
                yield CacheService_1.CacheService.invalidate("roles:all");
                return Object.assign({ success: true, message: `${savedRoles.length} roles created successfully`, roles: savedRoles.map((role) => ({
                        roleId: role.roleId,
                        roleName: role.roleName,
                        description: role.description,
                        permissions: role.permissions,
                    })) }, (invalidRoles.length > 0 && {
                    errors: invalidRoles,
                }));
            }
            catch (err) {
                return {
                    success: false,
                    message: "Database error: " +
                        (err instanceof Error ? err.message : "Unknown error"),
                };
            }
        });
    }
}
exports.RoleRepository = RoleRepository;
RoleRepository.ROLE_CACHE_KEY = "roles:all";
