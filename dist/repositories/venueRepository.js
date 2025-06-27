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
exports.VenueRepository = void 0;
const typeorm_1 = require("typeorm");
const Database_1 = require("../config/Database");
const VenueInterface_1 = require("../interfaces/VenueInterface");
const User_1 = require("../models/User");
const Venue_1 = require("../models/Venue");
const VenueBooking_1 = require("../models/VenueBooking");
const Event_1 = require("../models/Event");
const CacheService_1 = require("../services/CacheService");
class VenueRepository {
    // Create venue
    static create(data) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o;
        if (!data.venueName || !data.capacity || !data.location || !data.amount) {
            return {
                success: false,
                message: "Required fields: venueName, capacity, location, amount.",
            };
        }
        const capacityNum = typeof data.capacity === "string" ? Number(data.capacity) : data.capacity;
        if (typeof capacityNum !== "number" ||
            isNaN(capacityNum) ||
            capacityNum <= 0) {
            return { success: false, message: "Capacity must be a positive number." };
        }
        data.capacity = capacityNum;
        const amountNum = typeof data.amount === "string" ? Number(data.amount) : data.amount;
        if (typeof amountNum !== "number" || isNaN(amountNum) || amountNum <= 0) {
            return { success: false, message: "Amount must be a positive number." };
        }
        data.amount = amountNum;
        if (data.managerId && !this.UUID_REGEX.test(data.managerId)) {
            return { success: false, message: "Invalid managerId format." };
        }
        if (data.organizationId && !this.UUID_REGEX.test(data.organizationId)) {
            return { success: false, message: "Invalid organizationId format." };
        }
        if (data.latitude !== undefined &&
            (typeof data.latitude !== "number" ||
                data.latitude < -90 ||
                data.latitude > 90)) {
            return {
                success: false,
                message: "Invalid latitude. Must be a number between -90 and 90.",
            };
        }
        if (data.longitude !== undefined &&
            (typeof data.longitude !== "number" ||
                data.longitude < -180 ||
                data.longitude > 180)) {
            return {
                success: false,
                message: "Invalid longitude. Must be a number between -180 and 180.",
            };
        }
        const venue = new Venue_1.Venue();
        Object.assign(venue, {
            venueName: data.venueName,
            capacity: data.capacity,
            location: data.location,
            amount: data.amount,
            managerId: (_a = data.managerId) !== null && _a !== void 0 ? _a : undefined,
            organizationId: (_b = data.organizationId) !== null && _b !== void 0 ? _b : undefined,
            latitude: (_c = data.latitude) !== null && _c !== void 0 ? _c : undefined,
            longitude: (_d = data.longitude) !== null && _d !== void 0 ? _d : undefined,
            googleMapsLink: (_e = data.googleMapsLink) !== null && _e !== void 0 ? _e : undefined,
            amenities: (_f = data.amenities) !== null && _f !== void 0 ? _f : undefined,
            venueType: (_g = data.venueType) !== null && _g !== void 0 ? _g : undefined,
            contactPerson: (_h = data.contactPerson) !== null && _h !== void 0 ? _h : undefined,
            contactEmail: (_j = data.contactEmail) !== null && _j !== void 0 ? _j : undefined,
            contactPhone: (_k = data.contactPhone) !== null && _k !== void 0 ? _k : undefined,
            websiteURL: (_l = data.websiteURL) !== null && _l !== void 0 ? _l : undefined,
            mainPhotoUrl: (_m = data.mainPhotoUrl) !== null && _m !== void 0 ? _m : undefined,
            subPhotoUrls: (_o = data.subPhotoUrls) !== null && _o !== void 0 ? _o : undefined,
            status: typeof data.status === "string" &&
                data.status.toUpperCase() === Venue_1.VenueStatus.APPROVED
                ? Venue_1.VenueStatus.APPROVED
                : Venue_1.VenueStatus.PENDING,
        });
        return { success: true, data: venue };
    }
    // Save venue
    static save(venue) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!venue.venueName ||
                !venue.capacity ||
                !venue.location ||
                !venue.amount) {
                return {
                    success: false,
                    message: "Required fields: venueName, capacity, location, amount.",
                };
            }
            try {
                const repo = Database_1.AppDataSource.getRepository(Venue_1.Venue);
                // Find any venue with same name and location, regardless of organization
                const duplicate = yield repo.findOne({
                    where: {
                        venueName: venue.venueName,
                        location: venue.location,
                    },
                });
                if (duplicate && duplicate.venueId !== venue.venueId) {
                    const sameOrg = duplicate.organizationId === venue.organizationId;
                    return {
                        success: false,
                        message: sameOrg
                            ? `Venue "${venue.venueName}" at "${venue.location}" already exists in your organization.`
                            : `Venue "${venue.venueName}" at "${venue.location}" is already registered under another organization.`,
                        data: duplicate,
                    };
                }
                const savedVenue = yield repo.save(venue);
                yield CacheService_1.CacheService.invalidateMultiple([
                    `${this.CACHE_PREFIX}all`,
                    `${this.CACHE_PREFIX}${savedVenue.venueId}`,
                    `${this.CACHE_PREFIX}manager:${savedVenue.managerId}`,
                    `${this.CACHE_PREFIX}search:*`,
                ]);
                return {
                    success: true,
                    data: savedVenue,
                    message: "Venue saved successfully",
                };
            }
            catch (error) {
                console.error("Error saving venue:", error);
                return {
                    success: false,
                    message: "Failed to save venue.",
                };
            }
        });
    }
    // Get venue by ID
    static getById(id) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!id) {
                return { success: false, message: "Venue ID is required." };
            }
            const cacheKey = `${this.CACHE_PREFIX}${id}`;
            try {
                const venue = yield CacheService_1.CacheService.getOrSetSingle(cacheKey, Database_1.AppDataSource.getRepository(Venue_1.Venue), () => __awaiter(this, void 0, void 0, function* () {
                    return yield Database_1.AppDataSource.getRepository(Venue_1.Venue).findOne({
                        where: { venueId: id, deletedAt: (0, typeorm_1.IsNull)() },
                        relations: ["manager", "manager.role", "resources", "organization"],
                    });
                }), this.CACHE_TTL);
                if (!venue) {
                    return { success: false, message: "Venue not found or deleted." };
                }
                return { success: true, data: venue };
            }
            catch (error) {
                console.error("Error fetching venue by ID:", error);
                return {
                    success: false,
                    message: `Failed to fetch venue by ID: ${error instanceof Error ? error.message : "Unknown error"}`,
                };
            }
        });
    }
    // Alias for getById to match EventController expectations
    static findById(id) {
        return __awaiter(this, void 0, void 0, function* () {
            const result = yield this.getById(id);
            return result.success && result.data ? result.data : null;
        });
    }
    // Get all venues
    static getAll() {
        return __awaiter(this, void 0, void 0, function* () {
            const cacheKey = `${this.CACHE_PREFIX}all`;
            try {
                const venues = yield CacheService_1.CacheService.getOrSetMultiple(cacheKey, Database_1.AppDataSource.getRepository(Venue_1.Venue), () => __awaiter(this, void 0, void 0, function* () {
                    return yield Database_1.AppDataSource.getRepository(Venue_1.Venue).find({
                        where: { deletedAt: (0, typeorm_1.IsNull)() },
                        relations: ["manager", "manager.role"],
                        order: { venueName: "ASC" },
                    });
                }), this.CACHE_TTL);
                return { success: true, data: venues };
            }
            catch (error) {
                console.error("Error fetching all venues:", error);
                return {
                    success: false,
                    message: `Failed to fetch all venues: ${error instanceof Error ? error.message : "Unknown error"}`,
                };
            }
        });
    }
    // Get venues by manager ID
    static getByManagerId(managerId) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!managerId) {
                return { success: false, message: "Manager ID is required." };
            }
            const cacheKey = `${this.CACHE_PREFIX}manager:${managerId}`;
            try {
                const venues = yield CacheService_1.CacheService.getOrSetMultiple(cacheKey, Database_1.AppDataSource.getRepository(Venue_1.Venue), () => __awaiter(this, void 0, void 0, function* () {
                    return yield Database_1.AppDataSource.getRepository(Venue_1.Venue).find({
                        where: { managerId: managerId, deletedAt: (0, typeorm_1.IsNull)() },
                        relations: ["manager", "manager.role"],
                        order: { venueName: "ASC" },
                    });
                }), this.CACHE_TTL);
                if (venues.length === 0) {
                    return { success: false, message: "No venues found for this manager." };
                }
                return { success: true, data: venues };
            }
            catch (error) {
                console.error("Error fetching venues by manager ID:", error);
                return {
                    success: false,
                    message: `Failed to fetch venues by manager ID: ${error instanceof Error ? error.message : "Unknown error"}`,
                };
            }
        });
    }
    static update(id, data) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!id) {
                return { success: false, message: "Venue ID is required." };
            }
            // Only validate if updating fields other than status/cancellationReason
            const updatableKeys = Object.keys(data);
            const skipValidation = updatableKeys.every((key) => ["status", "cancellationReason"].includes(key));
            if (!skipValidation) {
                const validationErrors = VenueInterface_1.VenueInterface.validate(data);
                if (validationErrors.length > 0) {
                    return {
                        success: false,
                        message: `Validation errors: ${validationErrors.join(", ")}`,
                    };
                }
            }
            const queryRunner = Database_1.AppDataSource.createQueryRunner();
            yield queryRunner.connect();
            yield queryRunner.startTransaction();
            try {
                const repo = queryRunner.manager.getRepository(Venue_1.Venue);
                const venue = yield repo.findOne({
                    where: { venueId: id, deletedAt: (0, typeorm_1.IsNull)() },
                });
                if (!venue) {
                    yield queryRunner.rollbackTransaction();
                    return { success: false, message: "Venue not found or deleted." };
                }
                // Log input data for debugging
                console.log("Update input data:", data);
                // Check for duplicate name and location
                const nameChanged = data.venueName && data.venueName !== venue.venueName;
                const locationChanged = data.location && data.location !== venue.location;
                if (nameChanged && locationChanged) {
                    const existing = yield repo.findOne({
                        where: {
                            venueName: data.venueName,
                            location: data.location,
                            deletedAt: (0, typeorm_1.IsNull)(),
                        },
                    });
                    if (existing && existing.venueId !== id) {
                        yield queryRunner.rollbackTransaction();
                        return {
                            success: false,
                            message: "Another venue with the same name and location already exists.",
                        };
                    }
                }
                // Merge changes
                const mergedVenue = repo.merge(venue, Object.assign(Object.assign({}, data), { updatedAt: new Date() }));
                // Log merged entity for debugging
                console.log("Merged venue:", mergedVenue);
                // Save changes
                const updatedVenue = yield repo.save(mergedVenue);
                // Invalidate cache
                yield CacheService_1.CacheService.invalidateMultiple([
                    `${this.CACHE_PREFIX}all`,
                    `${this.CACHE_PREFIX}${id}`,
                    `${this.CACHE_PREFIX}manager:${updatedVenue.managerId}`,
                    `${this.CACHE_PREFIX}search:*`,
                ]);
                yield queryRunner.commitTransaction();
                return {
                    success: true,
                    data: updatedVenue,
                    message: "Venue updated successfully.",
                };
            }
            catch (error) {
                yield queryRunner.rollbackTransaction();
                console.error("Error updating venue:", error);
                return {
                    success: false,
                    message: `Failed to update venue: ${error instanceof Error ? error.message : "Unknown error"}`,
                };
            }
            finally {
                yield queryRunner.release();
            }
        });
    }
    // Update venue manager
    static updateVenueManager(venueId, managerId) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            if (!venueId || !managerId) {
                return {
                    success: false,
                    message: "Both venueId and managerId are required.",
                };
            }
            try {
                const venueRepo = Database_1.AppDataSource.getRepository(Venue_1.Venue);
                const userRepo = Database_1.AppDataSource.getRepository(User_1.User);
                const venue = yield venueRepo.findOne({
                    where: { venueId, deletedAt: (0, typeorm_1.IsNull)() },
                    relations: ["manager"],
                });
                if (!venue) {
                    return { success: false, message: "Venue not found or deleted." };
                }
                const manager = yield userRepo.findOne({
                    where: { userId: managerId },
                    relations: ["role"],
                });
                if (!manager) {
                    return { success: false, message: "Manager user not found." };
                }
                if (((_b = (_a = manager.role) === null || _a === void 0 ? void 0 : _a.roleName) === null || _b === void 0 ? void 0 : _b.toLowerCase()) !== "venue_manager") {
                    return { success: false, message: "User is not a venue manager." };
                }
                venue.manager = manager;
                venue.managerId = manager.userId;
                const updatedVenue = yield venueRepo.save(venue);
                // Invalidate caches
                yield CacheService_1.CacheService.invalidateMultiple([
                    `${this.CACHE_PREFIX}all`,
                    `${this.CACHE_PREFIX}${venueId}`,
                    `${this.CACHE_PREFIX}manager:${venue.managerId}`,
                    `${this.CACHE_PREFIX}manager:${managerId}`,
                    `${this.CACHE_PREFIX}search:*`,
                ]);
                return {
                    success: true,
                    data: updatedVenue,
                    message: "Venue manager updated successfully",
                };
            }
            catch (error) {
                console.error("Error updating venue manager:", error);
                return {
                    success: false,
                    message: `Failed to update venue manager: ${error instanceof Error ? error.message : "Unknown error"}`,
                };
            }
        });
    }
    // Delete venue (soft delete)
    static delete(id) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!id) {
                return { success: false, message: "Venue ID is required." };
            }
            try {
                const repo = Database_1.AppDataSource.getRepository(Venue_1.Venue);
                const venue = yield repo.findOne({
                    where: { venueId: id, deletedAt: (0, typeorm_1.IsNull)() },
                });
                if (!venue) {
                    return {
                        success: false,
                        message: "Venue not found or already deleted.",
                    };
                }
                yield repo.softRemove(venue);
                // Invalidate caches
                yield CacheService_1.CacheService.invalidateMultiple([
                    `${this.CACHE_PREFIX}all`,
                    `${this.CACHE_PREFIX}${id}`,
                    `${this.CACHE_PREFIX}manager:${venue.managerId}`,
                    `${this.CACHE_PREFIX}search:*`,
                ]);
                return { success: true, message: "Venue soft-deleted successfully" };
            }
            catch (error) {
                console.error("Error soft-deleting venue:", error);
                return {
                    success: false,
                    message: `Failed to soft-delete venue: ${error instanceof Error ? error.message : "Unknown error"}`,
                };
            }
        });
    }
    // Restore soft-deleted venue
    static restore(id) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!id) {
                return { success: false, message: "Venue ID is required." };
            }
            try {
                const repo = Database_1.AppDataSource.getRepository(Venue_1.Venue);
                const venue = yield repo.findOne({
                    where: { venueId: id },
                    withDeleted: true,
                });
                if (!venue || !venue.deletedAt) {
                    return { success: false, message: "Venue not found or not deleted." };
                }
                venue.deletedAt = undefined;
                const restoredVenue = yield repo.save(venue);
                // Invalidate caches
                yield CacheService_1.CacheService.invalidateMultiple([
                    `${this.CACHE_PREFIX}all`,
                    `${this.CACHE_PREFIX}${id}`,
                    `${this.CACHE_PREFIX}manager:${venue.managerId}`,
                    `${this.CACHE_PREFIX}search:*`,
                ]);
                return {
                    success: true,
                    data: restoredVenue,
                    message: "Venue restored successfully",
                };
            }
            catch (error) {
                console.error("Error restoring venue:", error);
                return {
                    success: false,
                    message: `Failed to restore venue: ${error instanceof Error ? error.message : "Unknown error"}`,
                };
            }
        });
    }
    // Get soft-deleted venues
    static getDeleted() {
        return __awaiter(this, void 0, void 0, function* () {
            const cacheKey = `${this.CACHE_PREFIX}deleted`;
            try {
                const venues = yield CacheService_1.CacheService.getOrSetMultiple(cacheKey, Database_1.AppDataSource.getRepository(Venue_1.Venue), () => __awaiter(this, void 0, void 0, function* () {
                    return yield Database_1.AppDataSource.getRepository(Venue_1.Venue).find({
                        where: { deletedAt: (0, typeorm_1.Not)((0, typeorm_1.IsNull)()) },
                        relations: ["manager", "manager.role"],
                        withDeleted: true,
                    });
                }), this.CACHE_TTL);
                return { success: true, data: venues };
            }
            catch (error) {
                console.error("Error fetching deleted venues:", error);
                return {
                    success: false,
                    message: `Failed to fetch deleted venues: ${error instanceof Error ? error.message : "Unknown error"}`,
                };
            }
        });
    }
    // Search venues
    static searchVenues(criteria) {
        return __awaiter(this, void 0, void 0, function* () {
            const cacheKey = `${this.CACHE_PREFIX}search:${JSON.stringify(criteria)}`;
            try {
                const venues = yield CacheService_1.CacheService.getOrSetMultiple(cacheKey, Database_1.AppDataSource.getRepository(Venue_1.Venue), () => __awaiter(this, void 0, void 0, function* () {
                    const queryBuilder = Database_1.AppDataSource.getRepository(Venue_1.Venue)
                        .createQueryBuilder("venue")
                        .leftJoinAndSelect("venue.manager", "manager")
                        .leftJoinAndSelect("manager.role", "role")
                        .where("venue.deletedAt IS NULL");
                    if (criteria.name) {
                        queryBuilder.andWhere("LOWER(venue.venueName) LIKE LOWER(:name)", {
                            name: `%${criteria.name}%`,
                        });
                    }
                    if (criteria.location) {
                        queryBuilder.andWhere("LOWER(venue.location) LIKE LOWER(:location)", { location: `%${criteria.location}%` });
                    }
                    if (criteria.minCapacity) {
                        queryBuilder.andWhere("venue.capacity >= :minCapacity", {
                            minCapacity: criteria.minCapacity,
                        });
                    }
                    if (criteria.maxCapacity) {
                        queryBuilder.andWhere("venue.capacity <= :maxCapacity", {
                            maxCapacity: criteria.maxCapacity,
                        });
                    }
                    if (typeof criteria.hasManager === "boolean") {
                        queryBuilder.andWhere(`venue.managerId ${criteria.hasManager ? "IS NOT NULL" : "IS NULL"}`);
                    }
                    return yield queryBuilder.orderBy("venue.venueName", "ASC").getMany();
                }), this.CACHE_TTL);
                return { success: true, data: venues };
            }
            catch (error) {
                console.error("Error searching venues:", error);
                return {
                    success: false,
                    message: `Failed to search venues: ${error instanceof Error ? error.message : "Unknown error"}`,
                };
            }
        });
    }
    // Get venue count
    static getVenueCount() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const count = yield Database_1.AppDataSource.getRepository(Venue_1.Venue).count({
                    where: { deletedAt: (0, typeorm_1.IsNull)() },
                });
                return { success: true, count };
            }
            catch (error) {
                console.error("Error getting venue count:", error);
                return {
                    success: false,
                    message: `Failed to get venue count: ${error instanceof Error ? error.message : "Unknown error"}`,
                };
            }
        });
    }
    // Remove venue manager
    static removeVenueManager(venueId) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!venueId) {
                return { success: false, message: "Venue ID is required." };
            }
            try {
                const repo = Database_1.AppDataSource.getRepository(Venue_1.Venue);
                const venue = yield repo.findOne({
                    where: { venueId, deletedAt: (0, typeorm_1.IsNull)() },
                });
                if (!venue) {
                    return { success: false, message: "Venue not found or deleted." };
                }
                const oldManagerId = venue.managerId;
                venue.manager = undefined;
                venue.managerId = undefined;
                const updatedVenue = yield repo.save(venue);
                // Invalidate caches
                yield CacheService_1.CacheService.invalidateMultiple([
                    `${this.CACHE_PREFIX}all`,
                    `${this.CACHE_PREFIX}${venueId}`,
                    `${this.CACHE_PREFIX}manager:${oldManagerId}`,
                    `${this.CACHE_PREFIX}search:*`,
                ]);
                return {
                    success: true,
                    data: updatedVenue,
                    message: "Venue manager removed successfully.",
                };
            }
            catch (error) {
                console.error("Error removing venue manager:", error);
                return {
                    success: false,
                    message: `Failed to remove venue manager: ${error instanceof Error ? error.message : "Unknown error"}`,
                };
            }
        });
    }
    // Get bookings by venue
    static getBookingsByVenue(venueId) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!venueId) {
                return { success: false, message: "Venue ID is required." };
            }
            const cacheKey = `${this.CACHE_PREFIX}${venueId}:bookings`;
            try {
                const bookings = yield CacheService_1.CacheService.getOrSetMultiple(cacheKey, Database_1.AppDataSource.getRepository(VenueBooking_1.VenueBooking), () => __awaiter(this, void 0, void 0, function* () {
                    return yield Database_1.AppDataSource.getRepository(VenueBooking_1.VenueBooking).find({
                        where: { venueId },
                        relations: ["venue", "event"],
                        order: { createdAt: "ASC" },
                    });
                }), this.CACHE_TTL);
                return { success: true, data: bookings };
            }
            catch (error) {
                console.error("Error fetching bookings by venue:", error);
                return {
                    success: false,
                    message: `Failed to fetch bookings: ${error instanceof Error ? error.message : "Unknown error"}`,
                };
            }
        });
    }
    // Get venues by proximity
    static getVenuesByProximity(latitude, longitude, radiusKm) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!latitude || !longitude || !radiusKm) {
                return {
                    success: false,
                    message: "Latitude, longitude, and radius are required.",
                };
            }
            const cacheKey = `${this.CACHE_PREFIX}proximity:${latitude}:${longitude}:${radiusKm}`;
            try {
                const venues = yield CacheService_1.CacheService.getOrSetMultiple(cacheKey, Database_1.AppDataSource.getRepository(Venue_1.Venue), () => __awaiter(this, void 0, void 0, function* () {
                    // Use PostGIS or simple Haversine formula for distance calculation
                    const earthRadiusKm = 6371;
                    const queryBuilder = Database_1.AppDataSource.getRepository(Venue_1.Venue)
                        .createQueryBuilder("venue")
                        .leftJoinAndSelect("venue.manager", "manager")
                        .leftJoinAndSelect("manager.role", "role")
                        .where("venue.deletedAt IS NULL")
                        .andWhere("venue.latitude IS NOT NULL")
                        .andWhere("venue.longitude IS NOT NULL");
                    // Haversine formula
                    queryBuilder.select([
                        "venue.*",
                        `(${earthRadiusKm} * 2 * ASIN(SQRT(
              POW(SIN((RADIANS(:latitude - venue.latitude)) / 2), 2) +
              COS(RADIANS(venue.latitude)) * COS(RADIANS(:latitude)) *
              POW(SIN((RADIANS(:longitude - venue.longitude)) / 2), 2)
            ))) AS distance`,
                    ]);
                    queryBuilder.setParameters({ latitude, longitude });
                    queryBuilder.having("distance <= :radiusKm", { radiusKm });
                    queryBuilder.orderBy("distance", "ASC");
                    return yield queryBuilder.getRawMany();
                }), this.CACHE_TTL);
                return { success: true, data: venues };
            }
            catch (error) {
                console.error("Error fetching venues by proximity:", error);
                return {
                    success: false,
                    message: `Failed to fetch venues by proximity: ${error instanceof Error ? error.message : "Unknown error"}`,
                };
            }
        });
    }
    // Create multiple venues
    static createMultiple(venuesData) {
        return __awaiter(this, void 0, void 0, function* () {
            const venues = [];
            const errors = [];
            for (const data of venuesData) {
                try {
                    const createResult = this.create(data);
                    if (!createResult.success || !createResult.data) {
                        errors.push({ data, message: createResult.message });
                        continue;
                    }
                    const saveResult = yield this.save(createResult.data);
                    if (saveResult.success && saveResult.data) {
                        venues.push(saveResult.data);
                    }
                    else {
                        errors.push({ data, message: saveResult.message });
                    }
                }
                catch (error) {
                    errors.push({
                        data,
                        message: error instanceof Error ? error.message : "Unknown error",
                    });
                }
            }
            // Invalidate cache for all venues
            yield CacheService_1.CacheService.invalidate(`${this.CACHE_PREFIX}all`);
            return { success: errors.length === 0, venues, errors };
        });
    }
    // Get resources by venue ID
    static getResourcesByVenueId(venueId) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!venueId) {
                return { success: false, message: "Venue ID is required." };
            }
            try {
                // Find all events at this venue
                const eventRepo = Database_1.AppDataSource.getRepository("Event");
                const eventResourceRepo = Database_1.AppDataSource.getRepository("EventResource");
                const resourceRepo = Database_1.AppDataSource.getRepository("Resource");
                // Get all eventIds for this venue
                const events = yield eventRepo
                    .createQueryBuilder("event")
                    .leftJoin("event.venues", "venue")
                    .where("venue.venueId = :venueId", { venueId })
                    .getMany();
                const eventIds = events.map((e) => e.eventId);
                if (eventIds.length === 0) {
                    return {
                        success: true,
                        data: [],
                        message: "No events for this venue.",
                    };
                }
                // Get all resources for these events
                const eventResources = yield eventResourceRepo
                    .createQueryBuilder("eventResource")
                    .leftJoinAndSelect("eventResource.resource", "resource")
                    .where("eventResource.eventId IN (:...eventIds)", { eventIds })
                    .getMany();
                // Map to unique resources
                const resourcesMap = new Map();
                for (const er of eventResources) {
                    if (er.resource)
                        resourcesMap.set(er.resource.resourceId, er.resource);
                }
                return { success: true, data: Array.from(resourcesMap.values()) };
            }
            catch (error) {
                console.error("Error fetching resources by venue ID:", error);
                return {
                    success: false,
                    message: `Failed to fetch resources: ${error instanceof Error ? error.message : "Unknown error"}`,
                };
            }
        });
    }
    static findAvailableVenues(startDate_1, endDate_1, startTime_1, endTime_1) {
        return __awaiter(this, arguments, void 0, function* (startDate, endDate, startTime, endTime, bufferMinutes = 30) {
            const cacheKey = `${this.CACHE_PREFIX}available:${startDate.toISOString()}:${endDate.toISOString()}:${startTime}:${endTime}:${bufferMinutes}`;
            try {
                // Combine date and time into full Date objects
                const parseTime = (date, time) => {
                    const [hours, minutes] = time.split(":").map(Number);
                    const newDate = new Date(date);
                    newDate.setHours(hours, minutes, 0, 0);
                    return newDate;
                };
                const eventStart = parseTime(startDate, startTime);
                const eventEnd = parseTime(endDate, endTime);
                // Validate input: start must be in the future
                if (eventStart <= new Date()) {
                    return {
                        success: false,
                        message: "Start date/time must be in the future.",
                    };
                }
                // Validate input: end must be after start
                if (eventEnd <= eventStart) {
                    return {
                        success: false,
                        message: "End date/time must be after start date/time.",
                    };
                }
                let cachedResult = yield CacheService_1.CacheService.get(cacheKey);
                if (!cachedResult) {
                    // Get all venues that are not deleted (regardless of status)
                    const allVenues = yield Database_1.AppDataSource.getRepository(Venue_1.Venue).find({
                        where: { deletedAt: (0, typeorm_1.IsNull)() },
                        relations: ["manager"],
                    });
                    const availableVenues = [];
                    const conflictingVenues = [];
                    // Check each venue for availability
                    for (const venue of allVenues) {
                        // Check for conflicting bookings (approved)
                        const conflictingBookings = yield Database_1.AppDataSource.getRepository(VenueBooking_1.VenueBooking)
                            .createQueryBuilder("booking")
                            .leftJoinAndSelect("booking.event", "event")
                            .where("booking.venueId = :venueId", { venueId: venue.venueId })
                            .andWhere("booking.approvalStatus = :status", {
                            status: "approved",
                        })
                            .andWhere("((event.startDate < :eventEnd AND event.endDate > :eventStart) OR " +
                            "(event.startDate = :eventStart AND event.startTime <= :endTime AND event.endTime >= :startTime))", {
                            eventStart,
                            eventEnd,
                            startTime: typeof startTime === "string" ? startTime : String(startTime),
                            endTime: typeof endTime === "string" ? endTime : String(endTime),
                        })
                            .getMany();
                        // Check for conflicting events directly (even if no booking exists)
                        const conflictingEvents = yield Database_1.AppDataSource.getRepository(Event_1.Event)
                            .createQueryBuilder("event")
                            .leftJoin("event.venues", "venue")
                            .where("venue.venueId = :venueId", { venueId: venue.venueId })
                            .andWhere("event.status = :status", { status: "APPROVED" })
                            .andWhere("((event.startDate < :eventEnd AND event.endDate > :eventStart) OR " +
                            "(event.startDate = :eventStart AND event.startTime <= :endTime AND event.endTime >= :startTime))", {
                            eventStart,
                            eventEnd,
                            startTime: typeof startTime === "string" ? startTime : String(startTime),
                            endTime: typeof endTime === "string" ? endTime : String(endTime),
                        })
                            .getMany();
                        if (conflictingBookings.length === 0 &&
                            conflictingEvents.length === 0) {
                            // Find the latest event that ends before the requested start time
                            const previousBooking = yield Database_1.AppDataSource.getRepository(VenueBooking_1.VenueBooking)
                                .createQueryBuilder("booking")
                                .leftJoinAndSelect("booking.event", "event")
                                .where("booking.venueId = :venueId", { venueId: venue.venueId })
                                .andWhere("booking.approvalStatus = :status", {
                                status: "approved",
                            })
                                .andWhere("((event.endDate < :eventStart) OR (event.endDate = :eventStart AND event.endTime < :startTime))", {
                                eventStart,
                                startTime: typeof startTime === "string"
                                    ? startTime
                                    : String(startTime),
                            })
                                .orderBy("event.endDate", "DESC")
                                .addOrderBy("event.endTime", "DESC")
                                .getOne();
                            let previousEvent = undefined;
                            let nextAvailableTime = undefined;
                            if (previousBooking && previousBooking.event) {
                                previousEvent = {
                                    startDate: previousBooking.event.startDate || "",
                                    startTime: previousBooking.event.startTime || "",
                                    endDate: previousBooking.event.endDate || "",
                                    endTime: previousBooking.event.endTime || "",
                                };
                                // Calculate next available time: previous event's end + 15 minutes
                                function parseDateTime(dateStr, timeStr) {
                                    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr))
                                        return null;
                                    let [hour, minute] = [0, 0];
                                    let t = timeStr.trim();
                                    let ampm = null;
                                    if (/am|pm/i.test(t)) {
                                        ampm = t.slice(-2).toLowerCase();
                                        t = t.slice(0, -2).trim();
                                    }
                                    const parts = t.split(":");
                                    if (parts.length !== 2)
                                        return null;
                                    hour = parseInt(parts[0], 10);
                                    minute = parseInt(parts[1], 10);
                                    if (isNaN(hour) || isNaN(minute))
                                        return null;
                                    if (ampm) {
                                        if (ampm === "pm" && hour !== 12)
                                            hour += 12;
                                        if (ampm === "am" && hour === 12)
                                            hour = 0;
                                    }
                                    const date = new Date(`${dateStr}T00:00:00Z`);
                                    if (isNaN(date.getTime()))
                                        return null;
                                    return date.getTime() + hour * 60 * 60 * 1000 + minute * 60 * 1000;
                                }
                                const prevEndMillis = parseDateTime(previousBooking.event.endDate, previousBooking.event.endTime || "00:00");
                                if (prevEndMillis !== null) {
                                    const nextMillis = prevEndMillis + 15 * 60 * 1000;
                                    nextAvailableTime = new Date(nextMillis).toISOString();
                                }
                            }
                            availableVenues.push(Object.assign(Object.assign({}, venue), { previousEvent, nextAvailableTime: nextAvailableTime || "" }));
                        }
                        else {
                            conflictingVenues.push({
                                venue,
                                conflictingEvents: [
                                    ...conflictingBookings.map((booking) => booking.event),
                                    ...conflictingEvents,
                                ],
                            });
                        }
                    }
                    // Check future availability (e.g., 30 minutes after event start)
                    const futureTime = new Date(eventStart.getTime() + bufferMinutes * 60 * 1000);
                    const futureConflicts = yield Database_1.AppDataSource.getRepository(VenueBooking_1.VenueBooking)
                        .createQueryBuilder("booking")
                        .leftJoin("booking.event", "event")
                        .where("booking.approvalStatus = :status", { status: "approved" })
                        .andWhere("((event.startDate < :futureTime AND event.endDate > :futureTime) OR " +
                        "(event.startDate = :futureTime AND event.startTime <= :futureTimeStr AND event.endTime >= :futureTimeStr))", {
                        futureTime,
                        futureTimeStr: futureTime.toISOString().substring(11, 16), // "HH:mm"
                    })
                        .getCount();
                    cachedResult = {
                        availableVenues,
                        isAvailableInFuture: futureConflicts === 0,
                        conflictingVenues,
                    };
                    yield CacheService_1.CacheService.set(cacheKey, cachedResult, this.CACHE_TTL);
                }
                let nextAvailableTime = undefined;
                if (cachedResult.availableVenues.length === 0 &&
                    cachedResult.isAvailableInFuture) {
                    // Find the soonest time after the requested slot when any venue is free
                    // Find the earliest end time among all conflicting events, add 15 minutes
                    let minEndDate = null;
                    let minEndTime = null;
                    for (const conflict of cachedResult.conflictingVenues) {
                        for (const event of conflict.conflictingEvents) {
                            // event.endDate is always a string now; no instanceof Date check needed
                            const endDate = typeof event.endDate === 'string'
                                ? event.endDate
                                : new Date(event.endDate).toISOString(); // fallback if needed
                            const endTime = event.endTime || "00:00";
                            let eventEnd = new Date(endDate);
                            const [h, m] = endTime.split(":").map(Number);
                            eventEnd.setHours(h, m, 0, 0);
                            if (!minEndDate || eventEnd < minEndDate) {
                                minEndDate = eventEnd;
                                minEndTime = endTime;
                            }
                        }
                    }
                    if (minEndDate) {
                        // Add 15 minutes to the earliest end time
                        minEndDate = new Date(minEndDate.getTime() + 15 * 60 * 1000);
                        nextAvailableTime = minEndDate.toISOString();
                    }
                    else {
                        // fallback: 15 minutes after requested end
                        const fallback = new Date(eventEnd.getTime() + 15 * 60 * 1000);
                        nextAvailableTime = fallback.toISOString();
                    }
                }
                return {
                    success: true,
                    data: Object.assign(Object.assign({}, cachedResult), { nextAvailableTime }),
                    message: cachedResult.availableVenues.length
                        ? `${cachedResult.availableVenues.length} venue(s) available for the requested time slot.`
                        : "No venues available for the requested time slot.",
                };
            }
            catch (error) {
                console.error("Error finding available venues:", error);
                return {
                    success: false,
                    message: `Failed to find available venues: ${error instanceof Error ? error.message : "Unknown error"}`,
                };
            }
        });
    }
    static findFullyAvailableVenues(startDate_1, endDate_1, startTime_1, endTime_1) {
        return __awaiter(this, arguments, void 0, function* (startDate, endDate, startTime, endTime, bufferMinutes = 30) {
            // Helper to parse date and time (YYYY-MM-DD, HH:mm or HH:mm AM/PM) to minutes since epoch
            function parseDateTime(dateStr, timeStr) {
                if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr))
                    return null;
                let [hour, minute] = [0, 0];
                let t = timeStr.trim();
                let ampm = null;
                if (/am|pm/i.test(t)) {
                    ampm = t.slice(-2).toLowerCase();
                    t = t.slice(0, -2).trim();
                }
                const parts = t.split(":");
                if (parts.length !== 2)
                    return null;
                hour = parseInt(parts[0], 10);
                minute = parseInt(parts[1], 10);
                if (isNaN(hour) || isNaN(minute))
                    return null;
                if (ampm) {
                    if (ampm === "pm" && hour !== 12)
                        hour += 12;
                    if (ampm === "am" && hour === 12)
                        hour = 0;
                }
                const date = new Date(`${dateStr}T00:00:00Z`);
                if (isNaN(date.getTime()))
                    return null;
                return date.getTime() + hour * 60 * 60 * 1000 + minute * 60 * 1000;
            }
            try {
                const venues = yield Database_1.AppDataSource.getRepository(Venue_1.Venue).find({
                    where: { status: Venue_1.VenueStatus.APPROVED, deletedAt: (0, typeorm_1.IsNull)() },
                    relations: ["manager", "organization"],
                });
                if (!venues || venues.length === 0) {
                    return {
                        success: false,
                        message: "No approved venues found in the system.",
                        error: {
                            code: "NO_VENUES",
                            details: "VenueRepository returned 0 records.",
                        },
                    };
                }
                const reqStart = parseDateTime(startDate, startTime);
                const reqEnd = parseDateTime(endDate, endTime);
                if (reqStart === null || reqEnd === null) {
                    return {
                        success: false,
                        message: "Invalid date or time format.",
                    };
                }
                // Validate input: start must be in the future
                if (reqStart <= Date.now()) {
                    return {
                        success: false,
                        message: "Start date/time must be in the future.",
                    };
                }
                // Validate input: end must be after start
                if (reqEnd <= reqStart) {
                    return {
                        success: false,
                        message: "End date/time must be after start date/time.",
                    };
                }
                const availableVenues = [];
                for (const venue of venues) {
                    const bookings = yield Database_1.AppDataSource.getRepository(VenueBooking_1.VenueBooking)
                        .createQueryBuilder("booking")
                        .leftJoinAndSelect("booking.event", "event")
                        .where("booking.venueId = :venueId", { venueId: venue.venueId })
                        .andWhere("booking.approvalStatus = :status", { status: "approved" })
                        .andWhere("event.status = :eventStatus", { eventStatus: "APPROVED" })
                        .getMany();
                    let isAvailableAllDays = true;
                    for (const booking of bookings) {
                        if (!booking.event)
                            continue;
                        const eventStart = parseDateTime(booking.event.startDate, booking.event.startTime || "00:00");
                        const eventEnd = parseDateTime(booking.event.endDate, booking.event.endTime || "23:59");
                        if (eventStart === null || eventEnd === null)
                            continue;
                        // Check for overlap with buffer
                        if (eventStart - bufferMinutes * 60000 < reqEnd && reqStart < eventEnd + bufferMinutes * 60000) {
                            isAvailableAllDays = false;
                            break;
                        }
                    }
                    if (isAvailableAllDays) {
                        availableVenues.push(venue);
                    }
                }
                return {
                    success: true,
                    data: availableVenues,
                    message: `${availableVenues.length} venue(s) available for requested time range.`,
                };
            }
            catch (error) {
                console.error("Repository error: findFullyAvailableVenues ->", error);
                return {
                    success: false,
                    message: "Error occurred while checking venue availability.",
                    error: {
                        message: (error === null || error === void 0 ? void 0 : error.message) || "Unknown error",
                        stack: (error === null || error === void 0 ? void 0 : error.stack) || null,
                    },
                };
            }
        });
    }
    /**
     * Retrieves all venues with an 'APPROVED' status, not soft-deleted,
     * including their manager, organization, users, and resources.
     * This method is cached.
     *
     * @returns A result object containing approved venues or an error message.
     */
    static getApprovedVenues() {
        return __awaiter(this, void 0, void 0, function* () {
            const cacheKey = `${this.CACHE_PREFIX}approved`; // Specific cache key for approved venues
            try {
                const cachedVenues = yield CacheService_1.CacheService.get(cacheKey);
                if (cachedVenues) {
                    return {
                        success: true,
                        data: cachedVenues,
                        message: "Approved venues fetched from cache.",
                    };
                }
                const venues = yield Database_1.AppDataSource.getRepository(Venue_1.Venue).find({
                    where: {
                        status: Venue_1.VenueStatus.APPROVED,
                        deletedAt: (0, typeorm_1.IsNull)(), // Ensure only non-soft-deleted venues are returned
                    },
                    relations: [
                        "manager",
                        "organization", // Corrected: A venue has one organization, not 'organizations' array
                        "users", // Corrected: 'users' is the relation to the User entity directly
                        "resources", // Added: To fetch associated resources
                    ],
                });
                yield CacheService_1.CacheService.set(cacheKey, venues); // Cache the result
                return {
                    success: true,
                    data: venues,
                    message: "Approved venues retrieved successfully.",
                };
            }
            catch (error) {
                console.error("Error finding approved venues:", error.message);
                return {
                    success: false,
                    message: `Failed to find approved venues due to a server error: ${error.message || "Unknown error"}`,
                };
            }
        });
    }
    static getVenuesWithApprovedEvents() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const venues = yield Database_1.AppDataSource.getRepository(Venue_1.Venue)
                    .createQueryBuilder("venue")
                    .leftJoinAndSelect("venue.events", "event")
                    .where("venue.deletedAt IS NULL")
                    .andWhere("event.status = :status", { status: "APPROVED" })
                    .getMany();
                return { success: true, data: venues };
            }
            catch (error) {
                console.error("Error fetching venues with approved events:", error);
                return { success: false, message: "Failed to fetch venues with approved events." };
            }
        });
    }
    static getVenuesWithApprovedEventsViaBookings() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const venues = yield Database_1.AppDataSource.getRepository(Venue_1.Venue)
                    .createQueryBuilder("venue")
                    .leftJoinAndSelect("venue.bookings", "booking")
                    .leftJoinAndSelect("booking.event", "event")
                    .where("event.status = :status", { status: "APPROVED" })
                    .andWhere("venue.deletedAt IS NULL")
                    .getMany();
                // Filter out venues with no approved events
                const venuesWithApprovedEvents = venues.filter(v => v.bookings && v.bookings.some(b => b.event && b.event.status === "APPROVED"));
                return { success: true, data: venuesWithApprovedEvents };
            }
            catch (error) {
                console.error("Error fetching venues with approved events via bookings:", error);
                return { success: false, message: "Failed to fetch venues with approved events via bookings." };
            }
        });
    }
}
exports.VenueRepository = VenueRepository;
VenueRepository.CACHE_PREFIX = "venue:";
VenueRepository.CACHE_TTL = 3600; // 1 hour, as venues update less frequently
VenueRepository.UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
