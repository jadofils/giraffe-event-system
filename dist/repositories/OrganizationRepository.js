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
exports.OrganizationRepository = void 0;
const Database_1 = require("../config/Database");
const Organization_1 = require("../models/Organization");
const User_1 = require("../models/User");
const typeorm_1 = require("typeorm");
const CacheService_1 = require("../services/CacheService");
const CACHE_TTL = 3600; // 1 hour
class OrganizationRepository {
    /**
     * Get all organizations
     * @returns List of organizations with users
     */
    static getAll() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const cacheKey = "org:all";
                const organizations = yield CacheService_1.CacheService.getOrSetMultiple(cacheKey, Database_1.AppDataSource.getRepository(Organization_1.Organization), () => __awaiter(this, void 0, void 0, function* () {
                    return yield Database_1.AppDataSource.getRepository(Organization_1.Organization).find({
                        relations: ["users", "users.role"],
                    });
                }), CACHE_TTL);
                return { success: true, data: organizations };
            }
            catch (error) {
                console.error("[Organization Fetch Error]:", error);
                return { success: false, message: "Failed to fetch organizations" };
            }
        });
    }
    /**
     * Get an organization by ID
     * @param id Organization UUID
     * @returns Organization with users
     */
    static getById(id) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!id || !this.UUID_REGEX.test(id)) {
                return { success: false, message: "Valid organization ID is required" };
            }
            try {
                const cacheKey = `org:id:${id}`;
                const organization = yield CacheService_1.CacheService.getOrSetSingle(cacheKey, Database_1.AppDataSource.getRepository(Organization_1.Organization), () => __awaiter(this, void 0, void 0, function* () {
                    return yield Database_1.AppDataSource.getRepository(Organization_1.Organization).findOne({
                        where: { organizationId: id },
                        relations: ["users", "users.role"],
                    });
                }), CACHE_TTL);
                if (!organization) {
                    return { success: false, message: "Organization not found" };
                }
                return { success: true, data: organization };
            }
            catch (error) {
                console.error(`[Organization Fetch Error] ID: ${id}:`, error);
                return { success: false, message: "Failed to fetch organization" };
            }
        });
    }
    /**
     * Create a new organization (not saved)
     * @param data Organization data
     * @returns Organization entity
     */
    static create(data) {
        var _a, _b;
        if (!data.organizationName || !data.contactEmail || !data.address || !data.organizationType) {
            return { success: false, message: "Required fields (name, email, address, type) are missing" };
        }
        const organization = new Organization_1.Organization();
        organization.organizationName = data.organizationName;
        organization.description = (_a = data.description) !== null && _a !== void 0 ? _a : "";
        organization.contactEmail = data.contactEmail;
        organization.contactPhone = (_b = data.contactPhone) !== null && _b !== void 0 ? _b : "";
        organization.address = data.address;
        organization.organizationType = data.organizationType;
        organization.createdAt = new Date();
        organization.updatedAt = new Date();
        return { success: true, data: organization };
    }
    /**
     * Create multiple organizations
     * @param data Array of organization data
     * @returns Created organizations
     */
    static bulkCreate(data) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            if (!data.length) {
                return { success: false, message: "At least one organization is required" };
            }
            try {
                const repo = Database_1.AppDataSource.getRepository(Organization_1.Organization);
                const organizations = [];
                const existingNames = new Set();
                const existingEmails = new Set();
                // Validate and create entities
                for (const item of data) {
                    if (!item.organizationName ||
                        !item.contactEmail ||
                        !item.address ||
                        !item.organizationType) {
                        return { success: false, message: "Required fields missing in one or more organizations" };
                    }
                    if (existingNames.has(item.organizationName) || existingEmails.has(item.contactEmail)) {
                        return { success: false, message: "Duplicate organization name or email in bulk data" };
                    }
                    existingNames.add(item.organizationName);
                    existingEmails.add(item.contactEmail);
                    const org = repo.create({
                        organizationName: item.organizationName,
                        description: (_a = item.description) !== null && _a !== void 0 ? _a : "",
                        contactEmail: item.contactEmail,
                        contactPhone: (_b = item.contactPhone) !== null && _b !== void 0 ? _b : "",
                        address: item.address,
                        organizationType: item.organizationType,
                        createdAt: new Date(),
                        updatedAt: new Date(),
                    });
                    organizations.push(org);
                }
                // Check existing organizations
                const existing = yield repo.find({
                    where: [
                        { organizationName: (0, typeorm_1.In)([...existingNames]) },
                        { contactEmail: (0, typeorm_1.In)([...existingEmails]) },
                    ],
                });
                if (existing.length) {
                    return {
                        success: false,
                        message: "One or more organizations already exist with provided name or email",
                    };
                }
                // Save all organizations
                const savedOrganizations = yield repo.save(organizations);
                // Invalidate cache
                yield CacheService_1.CacheService.invalidateMultiple(["org:all", ...savedOrganizations.map((org) => `org:id:${org.organizationId}`)]);
                return { success: true, data: savedOrganizations, message: "Organizations created successfully" };
            }
            catch (error) {
                console.error("[Organization Bulk Create Error]:", error);
                return { success: false, message: "Failed to create organizations" };
            }
        });
    }
    /**
     * Save an organization
     * @param org Organization entity
     * @returns Saved organization
     */
    static save(org) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!org.organizationName || !org.contactEmail || !org.address || !org.organizationType) {
                return { success: false, message: "Required fields (name, email, address, type) are missing" };
            }
            try {
                const repo = Database_1.AppDataSource.getRepository(Organization_1.Organization);
                // Check for duplicates
                const existing = yield repo.findOne({
                    where: [
                        { organizationName: org.organizationName },
                        { contactEmail: org.contactEmail },
                    ],
                });
                if (existing && existing.organizationId !== org.organizationId) {
                    return {
                        success: false,
                        message: "Organization with this name or email already exists",
                        data: existing,
                    };
                }
                org.updatedAt = new Date();
                const savedOrganization = yield repo.save(org);
                // Invalidate cache
                yield CacheService_1.CacheService.invalidateMultiple([
                    "org:all",
                    `org:id:${savedOrganization.organizationId}`,
                ]);
                return { success: true, data: savedOrganization, message: "Organization saved successfully" };
            }
            catch (error) {
                console.error("[Organization Save Error]:", error);
                return { success: false, message: "Failed to save organization" };
            }
        });
    }
    /**
     * Update an organization
     * @param id Organization UUID
     * @param data Partial organization data
     * @returns Updated organization
     */
    static update(id, data) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d, _e, _f;
            if (!id || !this.UUID_REGEX.test(id)) {
                return { success: false, message: "Valid organization ID is required" };
            }
            try {
                const repo = Database_1.AppDataSource.getRepository(Organization_1.Organization);
                const organization = yield repo.findOne({
                    where: { organizationId: id },
                    relations: ["users"],
                });
                if (!organization) {
                    return { success: false, message: "Organization not found" };
                }
                // Check for duplicate name/email
                if (data.organizationName || data.contactEmail) {
                    const existing = yield repo.findOne({
                        where: [
                            { organizationName: data.organizationName || "" },
                            { contactEmail: data.contactEmail || "" },
                        ],
                    });
                    if (existing && existing.organizationId !== id) {
                        return { success: false, message: "Organization name or email already exists" };
                    }
                }
                repo.merge(organization, {
                    organizationName: (_a = data.organizationName) !== null && _a !== void 0 ? _a : organization.organizationName,
                    description: (_b = data.description) !== null && _b !== void 0 ? _b : organization.description,
                    contactEmail: (_c = data.contactEmail) !== null && _c !== void 0 ? _c : organization.contactEmail,
                    contactPhone: (_d = data.contactPhone) !== null && _d !== void 0 ? _d : organization.contactPhone,
                    address: (_e = data.address) !== null && _e !== void 0 ? _e : organization.address,
                    organizationType: (_f = data.organizationType) !== null && _f !== void 0 ? _f : organization.organizationType,
                    updatedAt: new Date(),
                });
                const updatedOrganization = yield repo.save(organization);
                // Invalidate cache
                yield CacheService_1.CacheService.invalidateMultiple([
                    "org:all",
                    `org:id:${id}`,
                    ...organization.users.map((user) => `org:user:${user.userId}`),
                ]);
                return { success: true, data: updatedOrganization, message: "Organization updated successfully" };
            }
            catch (error) {
                console.error(`[Organization Update Error] ID: ${id}:`, error);
                return { success: false, message: "Failed to update organization" };
            }
        });
    }
    /**
     * Update multiple organizations
     * @param updates Array of organization ID and partial data
     * @returns Updated organizations
     */
    static bulkUpdate(updates) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d, _e, _f;
            if (!updates.length) {
                return { success: false, message: "At least one organization update is required" };
            }
            try {
                const repo = Database_1.AppDataSource.getRepository(Organization_1.Organization);
                const updatedOrganizations = [];
                const invalidateKeys = ["org:all"];
                for (const { id, data } of updates) {
                    if (!id || !this.UUID_REGEX.test(id)) {
                        return { success: false, message: `Invalid organization ID: ${id}` };
                    }
                    const organization = yield repo.findOne({
                        where: { organizationId: id },
                        relations: ["users"],
                    });
                    if (!organization) {
                        return { success: false, message: `Organization not found: ${id}` };
                    }
                    // Check for duplicate name/email
                    if (data.organizationName || data.contactEmail) {
                        const existing = yield repo.findOne({
                            where: [
                                { organizationName: data.organizationName || "" },
                                { contactEmail: data.contactEmail || "" },
                            ],
                        });
                        if (existing && existing.organizationId !== id) {
                            return { success: false, message: "Organization name or email already exists" };
                        }
                    }
                    repo.merge(organization, {
                        organizationName: (_a = data.organizationName) !== null && _a !== void 0 ? _a : organization.organizationName,
                        description: (_b = data.description) !== null && _b !== void 0 ? _b : organization.description,
                        contactEmail: (_c = data.contactEmail) !== null && _c !== void 0 ? _c : organization.contactEmail,
                        contactPhone: (_d = data.contactPhone) !== null && _d !== void 0 ? _d : organization.contactPhone,
                        address: (_e = data.address) !== null && _e !== void 0 ? _e : organization.address,
                        organizationType: (_f = data.organizationType) !== null && _f !== void 0 ? _f : organization.organizationType,
                        updatedAt: new Date(),
                    });
                    const updatedOrg = yield repo.save(organization);
                    updatedOrganizations.push(updatedOrg);
                    invalidateKeys.push(`org:id:${id}`, ...organization.users.map((user) => `org:user:${user.userId}`));
                }
                // Invalidate cache
                yield CacheService_1.CacheService.invalidateMultiple(invalidateKeys);
                return { success: true, data: updatedOrganizations, message: "Organizations updated successfully" };
            }
            catch (error) {
                console.error("[Organization Bulk Update Error]:", error);
                return { success: false, message: "Failed to update organizations" };
            }
        });
    }
    /**
     * Delete an organization
     * @param id Organization UUID
     * @returns Deletion result
     */
    static delete(id) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!id || !this.UUID_REGEX.test(id)) {
                return { success: false, message: "Valid organization ID is required" };
            }
            try {
                const repo = Database_1.AppDataSource.getRepository(Organization_1.Organization);
                const organization = yield repo.findOne({
                    where: { organizationId: id },
                    relations: ["users"],
                });
                if (!organization) {
                    return { success: false, message: "Organization not found" };
                }
                const result = yield repo.delete(id);
                if (result.affected === 0) {
                    return { success: false, message: "Organization not found or already deleted" };
                }
                // Invalidate cache
                yield CacheService_1.CacheService.invalidateMultiple([
                    "org:all",
                    `org:id:${id}`,
                    ...organization.users.map((user) => `org:user:${user.userId}`),
                ]);
                return { success: true, message: "Organization deleted successfully" };
            }
            catch (error) {
                console.error(`[Organization Delete Error] ID: ${id}:`, error);
                return { success: false, message: "Failed to delete organization" };
            }
        });
    }
    /**
     * Assign users to an organization
     * @param userIds Array of user UUIDs
     * @param organizationId Organization UUID
     * @returns Assignment result
     */
    static assignUsersToOrganization(userIds, organizationId) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!organizationId || !this.UUID_REGEX.test(organizationId)) {
                return { success: false, message: "Valid organization ID is required" };
            }
            if (!(userIds === null || userIds === void 0 ? void 0 : userIds.length) || userIds.some((id) => !this.UUID_REGEX.test(id))) {
                return { success: false, message: "Valid user IDs are required" };
            }
            try {
                const organizationRepo = Database_1.AppDataSource.getRepository(Organization_1.Organization);
                const userRepo = Database_1.AppDataSource.getRepository(User_1.User);
                // Fetch organization with existing users
                const organization = yield organizationRepo.findOne({
                    where: { organizationId },
                    relations: ["users"],
                });
                if (!organization) {
                    return { success: false, message: "Organization not found" };
                }
                // Fetch users
                const users = yield userRepo.find({
                    where: { userId: (0, typeorm_1.In)(userIds) },
                    relations: ["organizations"],
                });
                if (users.length !== userIds.length) {
                    return { success: false, message: "One or more users not found" };
                }
                // Filter out already assigned users
                const newUsers = users.filter((user) => !user.organizations.some((org) => org.organizationId === organizationId));
                if (!newUsers.length) {
                    return { success: true, message: "All users are already assigned to this organization", data: organization };
                }
                // Assign users
                organization.users = [...(organization.users || []), ...newUsers];
                const updatedOrganization = yield organizationRepo.save(organization);
                // Invalidate cache
                yield CacheService_1.CacheService.invalidateMultiple([
                    "org:all",
                    `org:id:${organizationId}`,
                    ...userIds.map((id) => `org:user:${id}`),
                    ...userIds.map((id) => `user:id:${id}`),
                ]);
                return {
                    success: true,
                    message: `${newUsers.length} users assigned to organization`,
                    data: updatedOrganization,
                };
            }
            catch (error) {
                console.error(`[Organization Assign Users Error] Org ID: ${organizationId}:`, error);
                return { success: false, message: "Failed to assign users to organization" };
            }
        });
    }
    /**
     * Remove users from an organization
     * @param userIds Array of user UUIDs
     * @param organizationId Organization UUID
     * @returns Removal result
     */
    static removeUsersFromOrganization(userIds, organizationId) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!organizationId || !this.UUID_REGEX.test(organizationId)) {
                return { success: false, message: "Valid organization ID is required" };
            }
            if (!(userIds === null || userIds === void 0 ? void 0 : userIds.length) || userIds.some((id) => !this.UUID_REGEX.test(id))) {
                return { success: false, message: "Valid user IDs are required" };
            }
            try {
                const organizationRepo = Database_1.AppDataSource.getRepository(Organization_1.Organization);
                const organization = yield organizationRepo.findOne({
                    where: { organizationId },
                    relations: ["users"],
                });
                if (!organization) {
                    return { success: false, message: "Organization not found" };
                }
                // Filter users to remove
                organization.users = organization.users.filter((user) => !userIds.includes(user.userId));
                const updatedOrganization = yield organizationRepo.save(organization);
                // Invalidate cache
                yield CacheService_1.CacheService.invalidateMultiple([
                    "org:all",
                    `org:id:${organizationId}`,
                    ...userIds.map((id) => `org:user:${id}`),
                    ...userIds.map((id) => `user:id:${id}`),
                ]);
                return {
                    success: true,
                    message: `${userIds.length} users removed from organization`,
                    data: updatedOrganization,
                };
            }
            catch (error) {
                console.error(`[Organization Remove Users Error] Org ID: ${organizationId}:`, error);
                return { success: false, message: "Failed to remove users from organization" };
            }
        });
    }
    /**
     * Get users by organization
     * @param organizationId Organization UUID
     * @returns Users associated with organization
     */
    static getUsersByOrganization(organizationId) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!organizationId || !this.UUID_REGEX.test(organizationId)) {
                return { success: false, message: "Valid organization ID is required" };
            }
            try {
                const cacheKey = `org:users:${organizationId}`;
                const users = yield CacheService_1.CacheService.getOrSetMultiple(cacheKey, Database_1.AppDataSource.getRepository(User_1.User), () => __awaiter(this, void 0, void 0, function* () {
                    const organization = yield Database_1.AppDataSource.getRepository(Organization_1.Organization).findOne({
                        where: { organizationId },
                        relations: ["users", "users.role"],
                    });
                    return (organization === null || organization === void 0 ? void 0 : organization.users) || [];
                }), CACHE_TTL);
                return { success: true, data: users };
            }
            catch (error) {
                console.error(`[Organization Fetch Users Error] Org ID: ${organizationId}:`, error);
                return { success: false, message: "Failed to fetch users for organization" };
            }
        });
    }
}
exports.OrganizationRepository = OrganizationRepository;
OrganizationRepository.UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
