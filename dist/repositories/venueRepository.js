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
const User_1 = require("../models/User");
const Venue_1 = require("../models/Venue");
const VenueBooking_1 = require("../models/VenueBooking");
const CacheService_1 = require("../services/CacheService");
class VenueRepository {
    // Create venue
    static create(data) {
        var _a, _b, _c, _d;
        if (!data.venueName || !data.capacity || !data.location || !data.amount) {
            return { success: false, message: "Required fields: venueName, capacity, location, amount." };
        }
        const venue = new Venue_1.Venue();
        venue.venueName = data.venueName;
        venue.capacity = data.capacity;
        venue.location = data.location;
        venue.amount = data.amount;
        venue.managerId = (_a = data.managerId) !== null && _a !== void 0 ? _a : undefined;
        venue.latitude = (_b = data.latitude) !== null && _b !== void 0 ? _b : undefined;
        venue.longitude = (_c = data.longitude) !== null && _c !== void 0 ? _c : undefined;
        venue.googleMapsLink = (_d = data.googleMapsLink) !== null && _d !== void 0 ? _d : undefined;
        return { success: true, data: venue };
    }
    // Save venue
    static save(venue) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!venue.venueName || !venue.capacity || !venue.location || !venue.amount) {
                return { success: false, message: "Required fields: venueName, capacity, location, amount." };
            }
            try {
                const repo = Database_1.AppDataSource.getRepository(Venue_1.Venue);
                const existingVenue = yield repo.findOne({
                    where: { venueName: venue.venueName, location: venue.location },
                });
                if (existingVenue && existingVenue.venueId !== venue.venueId) {
                    return { success: false, message: "A venue with this name and location already exists.", data: existingVenue };
                }
                const savedVenue = yield repo.save(venue);
                // Invalidate caches
                yield CacheService_1.CacheService.invalidateMultiple([
                    `${this.CACHE_PREFIX}all`,
                    `${this.CACHE_PREFIX}${savedVenue.venueId}`,
                    `${this.CACHE_PREFIX}manager:${savedVenue.managerId}`,
                    `${this.CACHE_PREFIX}search:*`,
                ]);
                return { success: true, data: savedVenue, message: "Venue saved successfully" };
            }
            catch (error) {
                console.error("Error saving venue:", error);
                return { success: false, message: `Failed to save venue: ${error instanceof Error ? error.message : "Unknown error"}` };
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
                        relations: ["manager", "manager.role"],
                    });
                }), this.CACHE_TTL);
                if (!venue) {
                    return { success: false, message: "Venue not found or deleted." };
                }
                return { success: true, data: venue };
            }
            catch (error) {
                console.error("Error fetching venue by ID:", error);
                return { success: false, message: `Failed to fetch venue by ID: ${error instanceof Error ? error.message : "Unknown error"}` };
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
                return { success: false, message: `Failed to fetch all venues: ${error instanceof Error ? error.message : "Unknown error"}` };
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
                return { success: false, message: `Failed to fetch venues by manager ID: ${error instanceof Error ? error.message : "Unknown error"}` };
            }
        });
    }
    // Update venue
    static update(id, data) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
            if (!id) {
                return { success: false, message: "Venue ID is required." };
            }
            try {
                const repo = Database_1.AppDataSource.getRepository(Venue_1.Venue);
                const venue = yield repo.findOne({ where: { venueId: id, deletedAt: (0, typeorm_1.IsNull)() } });
                if (!venue) {
                    return { success: false, message: "Venue not found or deleted." };
                }
                if ((data.venueName && data.venueName !== venue.venueName) || (data.location && data.location !== venue.location)) {
                    const existingVenue = yield repo.findOne({
                        where: { venueName: (_a = data.venueName) !== null && _a !== void 0 ? _a : venue.venueName, location: (_b = data.location) !== null && _b !== void 0 ? _b : venue.location },
                    });
                    if (existingVenue && existingVenue.venueId !== id) {
                        return { success: false, message: "Another venue with the same name and location already exists." };
                    }
                }
                repo.merge(venue, {
                    venueName: (_c = data.venueName) !== null && _c !== void 0 ? _c : venue.venueName,
                    capacity: (_d = data.capacity) !== null && _d !== void 0 ? _d : venue.capacity,
                    location: (_e = data.location) !== null && _e !== void 0 ? _e : venue.location,
                    amount: (_f = data.amount) !== null && _f !== void 0 ? _f : venue.amount,
                    managerId: (_g = data.managerId) !== null && _g !== void 0 ? _g : venue.managerId,
                    latitude: (_h = data.latitude) !== null && _h !== void 0 ? _h : venue.latitude,
                    longitude: (_j = data.longitude) !== null && _j !== void 0 ? _j : venue.longitude,
                    googleMapsLink: (_k = data.googleMapsLink) !== null && _k !== void 0 ? _k : venue.googleMapsLink,
                });
                const updatedVenue = yield repo.save(venue);
                // Invalidate caches
                yield CacheService_1.CacheService.invalidateMultiple([
                    `${this.CACHE_PREFIX}all`,
                    `${this.CACHE_PREFIX}${id}`,
                    `${this.CACHE_PREFIX}manager:${venue.managerId}`,
                    `${this.CACHE_PREFIX}manager:${updatedVenue.managerId}`,
                    `${this.CACHE_PREFIX}search:*`,
                ]);
                return { success: true, data: updatedVenue, message: "Venue updated successfully" };
            }
            catch (error) {
                console.error("Error updating venue:", error);
                return { success: false, message: `Failed to update venue: ${error instanceof Error ? error.message : "Unknown error"}` };
            }
        });
    }
    // Update venue manager
    static updateVenueManager(venueId, managerId) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            if (!venueId || !managerId) {
                return { success: false, message: "Both venueId and managerId are required." };
            }
            try {
                const venueRepo = Database_1.AppDataSource.getRepository(Venue_1.Venue);
                const userRepo = Database_1.AppDataSource.getRepository(User_1.User);
                const venue = yield venueRepo.findOne({ where: { venueId, deletedAt: (0, typeorm_1.IsNull)() }, relations: ["manager"] });
                if (!venue) {
                    return { success: false, message: "Venue not found or deleted." };
                }
                const manager = yield userRepo.findOne({ where: { userId: managerId }, relations: ["role"] });
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
                return { success: true, data: updatedVenue, message: "Venue manager updated successfully" };
            }
            catch (error) {
                console.error("Error updating venue manager:", error);
                return { success: false, message: `Failed to update venue manager: ${error instanceof Error ? error.message : "Unknown error"}` };
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
                const venue = yield repo.findOne({ where: { venueId: id, deletedAt: (0, typeorm_1.IsNull)() } });
                if (!venue) {
                    return { success: false, message: "Venue not found or already deleted." };
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
                return { success: false, message: `Failed to soft-delete venue: ${error instanceof Error ? error.message : "Unknown error"}` };
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
                const venue = yield repo.findOne({ where: { venueId: id }, withDeleted: true });
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
                return { success: true, data: restoredVenue, message: "Venue restored successfully" };
            }
            catch (error) {
                console.error("Error restoring venue:", error);
                return { success: false, message: `Failed to restore venue: ${error instanceof Error ? error.message : "Unknown error"}` };
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
                return { success: false, message: `Failed to fetch deleted venues: ${error instanceof Error ? error.message : "Unknown error"}` };
            }
        });
    }
    // Search venues
    static searchVenues(criteria) {
        return __awaiter(this, void 0, void 0, function* () {
            const cacheKey = `${this.CACHE_PREFIX}search:${JSON.stringify(criteria)}`;
            try {
                const venues = yield CacheService_1.CacheService.getOrSetMultiple(cacheKey, Database_1.AppDataSource.getRepository(Venue_1.Venue), () => __awaiter(this, void 0, void 0, function* () {
                    const queryBuilder = Database_1.AppDataSource.getRepository(Venue_1.Venue).createQueryBuilder("venue")
                        .leftJoinAndSelect("venue.manager", "manager")
                        .leftJoinAndSelect("manager.role", "role")
                        .where("venue.deletedAt IS NULL");
                    if (criteria.name) {
                        queryBuilder.andWhere("LOWER(venue.venueName) LIKE LOWER(:name)", { name: `%${criteria.name}%` });
                    }
                    if (criteria.location) {
                        queryBuilder.andWhere("LOWER(venue.location) LIKE LOWER(:location)", { location: `%${criteria.location}%` });
                    }
                    if (criteria.minCapacity) {
                        queryBuilder.andWhere("venue.capacity >= :minCapacity", { minCapacity: criteria.minCapacity });
                    }
                    if (criteria.maxCapacity) {
                        queryBuilder.andWhere("venue.capacity <= :maxCapacity", { maxCapacity: criteria.maxCapacity });
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
                return { success: false, message: `Failed to search venues: ${error instanceof Error ? error.message : "Unknown error"}` };
            }
        });
    }
    // Get venue count
    static getVenueCount() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const count = yield Database_1.AppDataSource.getRepository(Venue_1.Venue).count({ where: { deletedAt: (0, typeorm_1.IsNull)() } });
                return { success: true, count };
            }
            catch (error) {
                console.error("Error getting venue count:", error);
                return { success: false, message: `Failed to get venue count: ${error instanceof Error ? error.message : "Unknown error"}` };
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
                const venue = yield repo.findOne({ where: { venueId, deletedAt: (0, typeorm_1.IsNull)() } });
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
                return { success: true, data: updatedVenue, message: "Venue manager removed successfully." };
            }
            catch (error) {
                console.error("Error removing venue manager:", error);
                return { success: false, message: `Failed to remove venue manager: ${error instanceof Error ? error.message : "Unknown error"}` };
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
                return { success: false, message: `Failed to fetch bookings: ${error instanceof Error ? error.message : "Unknown error"}` };
            }
        });
    }
    // Get venues by proximity
    static getVenuesByProximity(latitude, longitude, radiusKm) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!latitude || !longitude || !radiusKm) {
                return { success: false, message: "Latitude, longitude, and radius are required." };
            }
            const cacheKey = `${this.CACHE_PREFIX}proximity:${latitude}:${longitude}:${radiusKm}`;
            try {
                const venues = yield CacheService_1.CacheService.getOrSetMultiple(cacheKey, Database_1.AppDataSource.getRepository(Venue_1.Venue), () => __awaiter(this, void 0, void 0, function* () {
                    // Use PostGIS or simple Haversine formula for distance calculation
                    const earthRadiusKm = 6371;
                    const queryBuilder = Database_1.AppDataSource.getRepository(Venue_1.Venue).createQueryBuilder("venue")
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
                return { success: false, message: `Failed to fetch venues by proximity: ${error instanceof Error ? error.message : "Unknown error"}` };
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
                    errors.push({ data, message: error instanceof Error ? error.message : "Unknown error" });
                }
            }
            // Invalidate cache for all venues
            yield CacheService_1.CacheService.invalidate(`${this.CACHE_PREFIX}all`);
            return { success: errors.length === 0, venues, errors };
        });
    }
}
exports.VenueRepository = VenueRepository;
VenueRepository.CACHE_PREFIX = "venue:";
VenueRepository.CACHE_TTL = 3600; // 1 hour, as venues update less frequently
