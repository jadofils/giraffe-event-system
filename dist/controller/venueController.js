"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.VenueController = void 0;
const eventRepository_1 = require("../repositories/eventRepository");
const venueRepository_1 = require("../repositories/venueRepository");
const VenueResourceRepository_1 = require("../repositories/VenueResourceRepository");
class VenueController {
    // Create a single venue
    static create(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.userId;
            const { venueName, capacity, location, amount, managerId, latitude, longitude, googleMapsLink, } = req.body;
            if (!userId) {
                res
                    .status(401)
                    .json({ success: false, message: "Authentication required." });
                return;
            }
            if (!venueName || !capacity || !location || !amount) {
                res.status(400).json({
                    success: false,
                    message: "Required fields: venueName, capacity, location, amount.",
                });
                return;
            }
            try {
                const newVenueData = {
                    venueName,
                    capacity,
                    location,
                    amount,
                    managerId,
                    latitude,
                    longitude,
                    googleMapsLink,
                };
                const createResult = yield venueRepository_1.VenueRepository.create(newVenueData);
                if (!createResult.success || !createResult.data) {
                    res.status(400).json({ success: false, message: createResult.message });
                    return;
                }
                const saveResult = yield venueRepository_1.VenueRepository.save(createResult.data);
                if (saveResult.success && saveResult.data) {
                    res.status(201).json({
                        success: true,
                        message: "Venue created successfully.",
                        data: saveResult.data,
                    });
                }
                else {
                    res.status(500).json({
                        success: false,
                        message: saveResult.message || "Failed to save venue.",
                    });
                }
            }
            catch (err) {
                console.error("Error creating venue:", err);
                res.status(500).json({
                    success: false,
                    message: "Failed to create venue due to a server error.",
                });
            }
        });
    }
    // Create multiple venues
    static createMultiple(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.userId;
            const venuesData = req.body.venues;
            if (!userId) {
                res
                    .status(401)
                    .json({ success: false, message: "Authentication required." });
                return;
            }
            if (!venuesData || !Array.isArray(venuesData) || venuesData.length === 0) {
                res.status(400).json({
                    success: false,
                    message: "An array of venue data is required.",
                });
                return;
            }
            try {
                const createResult = yield venueRepository_1.VenueRepository.createMultiple(venuesData);
                res.status(createResult.success ? 201 : 207).json({
                    success: createResult.success,
                    message: createResult.success
                        ? "All venues created successfully."
                        : "Some venues failed to create.",
                    data: createResult.venues,
                    errors: createResult.errors,
                });
            }
            catch (err) {
                console.error("Error creating multiple venues:", err);
                res.status(500).json({
                    success: false,
                    message: "Failed to create venues due to a server error.",
                });
            }
        });
    }
    // Get venue by ID
    static getById(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            const { id } = req.params;
            if (!id) {
                res
                    .status(400)
                    .json({ success: false, message: "Venue ID is required." });
                return;
            }
            try {
                const result = yield venueRepository_1.VenueRepository.getById(id);
                if (result.success && result.data) {
                    res.status(200).json({ success: true, data: result.data });
                }
                else {
                    res.status(404).json({
                        success: false,
                        message: result.message || "Venue not found.",
                    });
                }
            }
            catch (err) {
                console.error("Error getting venue by ID:", err);
                res
                    .status(500)
                    .json({ success: false, message: "Failed to get venue by ID." });
            }
        });
    }
    // Get venues by manager ID
    static getByManagerId(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.userId;
            if (!userId) {
                res
                    .status(401)
                    .json({ success: false, message: "Authentication required." });
                return;
            }
            try {
                const result = yield venueRepository_1.VenueRepository.getByManagerId(userId);
                if (result.success && result.data) {
                    res.status(200).json({ success: true, data: result.data });
                }
                else {
                    res.status(404).json({
                        success: false,
                        message: result.message || "No venues found for this manager.",
                    });
                }
            }
            catch (err) {
                console.error("Error getting venues by manager ID:", err);
                res.status(500).json({
                    success: false,
                    message: "Failed to get venues by manager ID.",
                });
            }
        });
    }
    // Get all venues
    static getAll(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const result = yield venueRepository_1.VenueRepository.getAll();
                if (result.success && result.data) {
                    res.status(200).json({ success: true, data: result.data });
                }
                else {
                    res.status(200).json({
                        success: false,
                        message: result.message || "No venues found.",
                    });
                }
            }
            catch (err) {
                console.error("Error getting all venues:", err);
                res
                    .status(500)
                    .json({ success: false, message: "Failed to get all venues." });
            }
        });
    }
    // Update venue
    static update(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const { id } = req.params;
            const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.userId;
            const { venueName, capacity, location, amount, managerId, latitude, longitude, googleMapsLink, } = req.body;
            if (!id) {
                res
                    .status(400)
                    .json({ success: false, message: "Venue ID is required." });
                return;
            }
            if (!userId) {
                res
                    .status(401)
                    .json({ success: false, message: "Authentication required." });
                return;
            }
            try {
                const updateData = {
                    venueName,
                    capacity,
                    location,
                    amount,
                    managerId,
                    latitude,
                    longitude,
                    googleMapsLink,
                };
                const updateResult = yield venueRepository_1.VenueRepository.update(id, updateData);
                if (updateResult.success && updateResult.data) {
                    res.status(200).json({
                        success: true,
                        message: "Venue updated successfully.",
                        data: updateResult.data,
                    });
                }
                else {
                    res.status(404).json({
                        success: false,
                        message: updateResult.message || "Venue not found.",
                    });
                }
            }
            catch (err) {
                console.error("Error updating venue:", err);
                res.status(500).json({
                    success: false,
                    message: "Failed to update venue due to a server error.",
                });
            }
        });
    }
    // Update venue manager
    static updateVenueManager(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.userId;
            const { venueId, managerId } = req.body;
            if (!userId) {
                res
                    .status(401)
                    .json({ success: false, message: "Authentication required." });
                return;
            }
            if (!venueId || !managerId) {
                res.status(400).json({
                    success: false,
                    message: "Venue ID and manager ID are required.",
                });
                return;
            }
            try {
                const result = yield venueRepository_1.VenueRepository.updateVenueManager(venueId, managerId);
                if (result.success && result.data) {
                    res.status(200).json({
                        success: true,
                        message: "Venue manager updated successfully.",
                        data: result.data,
                    });
                }
                else {
                    res.status(400).json({
                        success: false,
                        message: result.message || "Failed to update venue manager.",
                    });
                }
            }
            catch (err) {
                console.error("Error updating venue manager:", err);
                res.status(500).json({
                    success: false,
                    message: "Failed to update venue manager due to a server error.",
                });
            }
        });
    }
    // Remove venue manager
    static removeVenueManager(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.userId;
            const { venueId } = req.params;
            if (!userId) {
                res
                    .status(401)
                    .json({ success: false, message: "Authentication required." });
                return;
            }
            if (!venueId) {
                res
                    .status(400)
                    .json({ success: false, message: "Venue ID is required." });
                return;
            }
            try {
                const result = yield venueRepository_1.VenueRepository.removeVenueManager(venueId);
                if (result.success && result.data) {
                    res.status(200).json({
                        success: true,
                        message: "Venue manager removed successfully.",
                        data: result.data,
                    });
                }
                else {
                    res.status(400).json({
                        success: false,
                        message: result.message || "Failed to remove venue manager.",
                    });
                }
            }
            catch (err) {
                console.error("Error removing venue manager:", err);
                res.status(500).json({
                    success: false,
                    message: "Failed to remove venue manager due to a server error.",
                });
            }
        });
    }
    // Delete venue (soft delete)
    static delete(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const { id } = req.params;
            const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.userId;
            if (!id) {
                res
                    .status(400)
                    .json({ success: false, message: "Venue ID is required." });
                return;
            }
            if (!userId) {
                res
                    .status(401)
                    .json({ success: false, message: "Authentication required." });
                return;
            }
            try {
                const deleteResult = yield venueRepository_1.VenueRepository.delete(id);
                if (deleteResult.success) {
                    res.status(200).json({
                        success: true,
                        message: deleteResult.message || "Venue deleted successfully.",
                    });
                }
                else {
                    res.status(404).json({
                        success: false,
                        message: deleteResult.message || "Venue not found.",
                    });
                }
            }
            catch (err) {
                console.error("Error deleting venue:", err);
                res
                    .status(500)
                    .json({ success: false, message: "Failed to delete venue." });
            }
        });
    }
    // Restore soft-deleted venue
    static restore(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const { id } = req.params;
            const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.userId;
            if (!id) {
                res
                    .status(400)
                    .json({ success: false, message: "Venue ID is required." });
                return;
            }
            if (!userId) {
                res
                    .status(401)
                    .json({ success: false, message: "Authentication required." });
                return;
            }
            try {
                const restoreResult = yield venueRepository_1.VenueRepository.restore(id);
                if (restoreResult.success && restoreResult.data) {
                    res.status(200).json({
                        success: true,
                        message: "Venue restored successfully.",
                        data: restoreResult.data,
                    });
                }
                else {
                    res.status(404).json({
                        success: false,
                        message: restoreResult.message || "Venue not found or not deleted.",
                    });
                }
            }
            catch (err) {
                console.error("Error restoring venue:", err);
                res
                    .status(500)
                    .json({ success: false, message: "Failed to restore venue." });
            }
        });
    }
    // Get soft-deleted venues
    static getDeleted(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.userId;
            if (!userId) {
                res
                    .status(401)
                    .json({ success: false, message: "Authentication required." });
                return;
            }
            try {
                const result = yield venueRepository_1.VenueRepository.getDeleted();
                if (result.success && result.data) {
                    res.status(200).json({ success: true, data: result.data });
                }
                else {
                    res.status(200).json({
                        success: false,
                        message: result.message || "No deleted venues found.",
                    });
                }
            }
            catch (err) {
                console.error("Error getting deleted venues:", err);
                res
                    .status(500)
                    .json({ success: false, message: "Failed to get deleted venues." });
            }
        });
    }
    // Check venue event conflicts
    static checkVenueEventConflicts(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            const { venueId, startDate, endDate, startTime, endTime } = req.query;
            if (!venueId ||
                !startDate ||
                !endDate ||
                typeof venueId !== "string" ||
                typeof startDate !== "string" ||
                typeof endDate !== "string") {
                res.status(400).json({
                    success: false,
                    message: "Venue ID, startDate, and endDate are required.",
                });
                return;
            }
            try {
                const start = new Date(startDate);
                const end = new Date(endDate);
                if (isNaN(start.getTime()) || isNaN(end.getTime())) {
                    res
                        .status(400)
                        .json({ success: false, message: "Invalid date format." });
                    return;
                }
                const venueResult = yield venueRepository_1.VenueRepository.getById(venueId);
                if (!venueResult.success || !venueResult.data) {
                    res.status(404).json({ success: false, message: "Venue not found." });
                    return;
                }
                // Combine date and time for precise overlap check
                const startDateTime = startTime
                    ? new Date(`${startDate}T${startTime}:00Z`)
                    : start;
                const endDateTime = endTime ? new Date(`${endDate}T${endTime}:00Z`) : end;
                const eventsResult = yield eventRepository_1.EventRepository.getByVenueId(venueId);
                if (eventsResult.success && eventsResult.data) {
                    const conflictingEvents = eventsResult.data.filter((event) => {
                        const eventStart = event.startTime
                            ? new Date(`${event.startDate.toISOString().split("T")[0]}T${event.startTime}:00Z`)
                            : event.startDate;
                        const eventEnd = event.endTime
                            ? new Date(`${event.endDate.toISOString().split("T")[0]}T${event.endTime}:00Z`)
                            : event.endDate;
                        return (eventStart <= endDateTime &&
                            eventEnd >= startDateTime &&
                            event.status !== "CANCELLED");
                    });
                    if (conflictingEvents.length > 0) {
                        res.status(200).json({
                            success: true,
                            available: false,
                            message: "Venue is booked for the requested period.",
                            conflicts: conflictingEvents.map((e) => ({
                                eventId: e.eventId,
                                eventTitle: e.eventTitle,
                            })),
                        });
                        return;
                    }
                }
                res.status(200).json({
                    success: true,
                    available: true,
                    message: "Venue is available for the requested period.",
                });
            }
            catch (err) {
                console.error("Error checking venue event conflicts:", err);
                res.status(500).json({
                    success: false,
                    message: "Failed to check venue event conflicts.",
                });
            }
        });
    }
    // Search venues
    static searchVenues(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            const { name, location, minCapacity, maxCapacity, isAvailable, hasManager, } = req.query;
            const criteria = {};
            if (name && typeof name === "string")
                criteria.name = name;
            if (location && typeof location === "string")
                criteria.location = location;
            if (minCapacity && !isNaN(Number(minCapacity)))
                criteria.minCapacity = Number(minCapacity);
            if (maxCapacity && !isNaN(Number(maxCapacity)))
                criteria.maxCapacity = Number(maxCapacity);
            if (isAvailable !== undefined &&
                (isAvailable === "true" || isAvailable === "false"))
                criteria.isAvailable = isAvailable === "true";
            if (hasManager !== undefined &&
                (hasManager === "true" || hasManager === "false"))
                criteria.hasManager = hasManager === "true";
            try {
                const result = yield venueRepository_1.VenueRepository.searchVenues(criteria);
                if (result.success && result.data) {
                    res.status(200).json({ success: true, data: result.data });
                }
                else {
                    res.status(200).json({
                        success: false,
                        message: result.message || "No venues found.",
                    });
                }
            }
            catch (err) {
                console.error("Error searching venues:", err);
                res
                    .status(500)
                    .json({ success: false, message: "Failed to search venues." });
            }
        });
    }
    // Get venue count
    static getVenueCount(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const result = yield venueRepository_1.VenueRepository.getVenueCount();
                if (result.success && result.count !== undefined) {
                    res.status(200).json({ success: true, count: result.count });
                }
                else {
                    res.status(200).json({
                        success: false,
                        message: result.message || "Failed to get venue count.",
                    });
                }
            }
            catch (err) {
                console.error("Error getting venue count:", err);
                res
                    .status(500)
                    .json({ success: false, message: "Failed to get venue count." });
            }
        });
    }
    // Get venues by proximity
    static getVenuesByProximity(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            const { latitude, longitude, radius } = req.query;
            if (!latitude ||
                !longitude ||
                !radius ||
                typeof latitude !== "string" ||
                typeof longitude !== "string" ||
                typeof radius !== "string") {
                res.status(400).json({
                    success: false,
                    message: "Latitude, longitude, and radius are required.",
                });
                return;
            }
            try {
                const lat = parseFloat(latitude);
                const lon = parseFloat(longitude);
                const rad = parseFloat(radius);
                if (isNaN(lat) || isNaN(lon) || isNaN(rad)) {
                    res.status(400).json({
                        success: false,
                        message: "Invalid latitude, longitude, or radius format.",
                    });
                    return;
                }
                const result = yield venueRepository_1.VenueRepository.getVenuesByProximity(lat, lon, rad);
                if (result.success && result.data) {
                    res.status(200).json({ success: true, data: result.data });
                }
                else {
                    res.status(200).json({
                        success: false,
                        message: result.message || "No venues found within radius.",
                    });
                }
            }
            catch (err) {
                console.error("Error getting venues by proximity:", err);
                res.status(500).json({
                    success: false,
                    message: "Failed to get venues by proximity.",
                });
            }
        });
    }
    // Assign a user as manager to a venue (simple version)
    static assignManagerToVenue(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            const { venueId, userId } = req.body;
            if (!venueId || !userId) {
                res
                    .status(400)
                    .json({ success: false, message: "venueId and userId are required." });
                return;
            }
            try {
                // Find the venue
                const venueResult = yield venueRepository_1.VenueRepository.getById(venueId);
                if (!venueResult.success || !venueResult.data) {
                    res.status(404).json({ success: false, message: "Venue not found." });
                    return;
                }
                // Find the user
                const userRepo = require("../models/User");
                const { AppDataSource } = require("../config/Database");
                const user = yield AppDataSource.getRepository(userRepo.User).findOne({
                    where: { userId },
                });
                if (!user) {
                    res.status(404).json({ success: false, message: "User not found." });
                    return;
                }
                // Assign user as manager
                venueResult.data.managerId = userId;
                venueResult.data.manager = user;
                const saveResult = yield venueRepository_1.VenueRepository.save(venueResult.data);
                if (saveResult.success && saveResult.data) {
                    res.status(200).json({
                        success: true,
                        message: "User assigned as venue manager successfully.",
                        data: saveResult.data,
                    });
                }
                else {
                    res.status(500).json({
                        success: false,
                        message: saveResult.message || "Failed to assign manager.",
                    });
                }
            }
            catch (err) {
                console.error("Error assigning manager to venue:", err);
                res.status(500).json({
                    success: false,
                    message: "Failed to assign manager due to a server error.",
                });
            }
        });
    }
    // Get resources for a venue by ID
    static getResourcesByVenueId(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            const { id } = req.params;
            if (!id) {
                res
                    .status(400)
                    .json({ success: false, message: "Venue ID is required." });
                return;
            }
            try {
                const result = yield venueRepository_1.VenueRepository.getResourcesByVenueId(id);
                if (result.success) {
                    res.status(200).json({ success: true, data: result.data });
                }
                else {
                    res.status(404).json({
                        success: false,
                        message: result.message || "No resources found for this venue.",
                    });
                }
            }
            catch (err) {
                console.error("Error getting resources for venue:", err);
                res.status(500).json({
                    success: false,
                    message: "Failed to get resources for venue.",
                });
            }
        });
    }
    // Add resources to a venue (bulk)
    static addResourcesToVenue(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            const { resources } = req.body;
            const { venueId } = req.params;
            if (!venueId || !Array.isArray(resources) || resources.length === 0) {
                res.status(400).json({
                    success: false,
                    message: "venueId and a non-empty resources array are required",
                });
                return;
            }
            try {
                const created = yield VenueResourceRepository_1.VenueResourceRepository.addResourcesToVenue(venueId, resources);
                res.status(201).json({ success: true, data: created });
            }
            catch (error) {
                res
                    .status(500)
                    .json({ success: false, message: "Failed to add resources to venue" });
            }
        });
    }
    // Remove a resource from a venue
    static removeResourceFromVenue(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            const { venueId, resourceId } = req.params;
            if (!venueId || !resourceId) {
                res.status(400).json({
                    success: false,
                    message: "venueId and resourceId are required",
                });
                return;
            }
            try {
                const removed = yield VenueResourceRepository_1.VenueResourceRepository.removeResourceFromVenue(venueId, resourceId);
                if (removed) {
                    res
                        .status(200)
                        .json({ success: true, message: "Resource removed from venue" });
                }
                else {
                    res.status(404).json({
                        success: false,
                        message: "Resource not found for this venue",
                    });
                }
            }
            catch (error) {
                res.status(500).json({
                    success: false,
                    message: "Failed to remove resource from venue",
                });
            }
        });
    }
    // Get all resources assigned to a venue
    static getVenueResources(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            const { venueId } = req.params;
            if (!venueId) {
                res.status(400).json({ success: false, message: "venueId is required" });
                return;
            }
            try {
                const resources = yield VenueResourceRepository_1.VenueResourceRepository.getResourcesByVenueId(venueId);
                res.status(200).json({ success: true, data: resources });
            }
            catch (error) {
                res
                    .status(500)
                    .json({ success: false, message: "Failed to get resources for venue" });
            }
        });
    }
    // Create a venue and assign resources in one request
    static createVenueWithResources(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.userId;
            const _b = req.body, { resources } = _b, venueData = __rest(_b, ["resources"]);
            if (!userId) {
                res
                    .status(401)
                    .json({ success: false, message: "Authentication required." });
                return;
            }
            if (!venueData.venueName ||
                !venueData.capacity ||
                !venueData.location ||
                !venueData.amount) {
                res
                    .status(400)
                    .json({
                    success: false,
                    message: "Required fields: venueName, capacity, location, amount.",
                });
                return;
            }
            try {
                // Create the venue
                const createResult = yield venueRepository_1.VenueRepository.create(venueData);
                if (!createResult.success || !createResult.data) {
                    res.status(400).json({ success: false, message: createResult.message });
                    return;
                }
                const saveResult = yield venueRepository_1.VenueRepository.save(createResult.data);
                if (!saveResult.success || !saveResult.data) {
                    res
                        .status(500)
                        .json({
                        success: false,
                        message: saveResult.message || "Failed to save venue.",
                    });
                    return;
                }
                let assignedResources = [];
                if (Array.isArray(resources) && resources.length > 0) {
                    // Support creating new resources inline
                    const resourceAssignments = [];
                    for (const r of resources) {
                        if (r.resource) {
                            // Create the resource first
                            const created = yield Promise.resolve().then(() => __importStar(require("../repositories/ResourceRepository"))).then((m) => m.ResourceRepository.createResource(r.resource));
                            resourceAssignments.push({
                                resourceId: created.resourceId,
                                quantity: r.quantity,
                            });
                        }
                        else if (r.resourceId) {
                            resourceAssignments.push({
                                resourceId: r.resourceId,
                                quantity: r.quantity,
                            });
                        }
                    }
                    assignedResources = yield VenueResourceRepository_1.VenueResourceRepository.addResourcesToVenue(saveResult.data.venueId, resourceAssignments);
                }
                res.status(201).json({
                    success: true,
                    message: "Venue and resources created successfully.",
                    data: { venue: saveResult.data, resources: assignedResources },
                });
            }
            catch (err) {
                console.error("Error creating venue with resources:", err);
                res
                    .status(500)
                    .json({
                    success: false,
                    message: "Failed to create venue with resources.",
                });
            }
        });
    }
}
exports.VenueController = VenueController;
