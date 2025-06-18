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
exports.VenueBookingRepository = void 0;
const Database_1 = require("../config/Database");
const Event_1 = require("../models/Event");
const Organization_1 = require("../models/Organization");
const Venue_1 = require("../models/Venue");
const User_1 = require("../models/User");
const VenueBooking_1 = require("../models/VenueBooking");
const CacheService_1 = require("../services/CacheService");
class VenueBookingRepository {
    // Initialize venue booking repository
    static getVenueBookingRepository() {
        if (!this.venueBookingRepository) {
            if (!Database_1.AppDataSource.isInitialized) {
                throw new Error("Database not initialized.");
            }
            this.venueBookingRepository = Database_1.AppDataSource.getRepository(VenueBooking_1.VenueBooking);
        }
        return this.venueBookingRepository;
    }
    // Initialize event repository
    static getEventRepository() {
        if (!this.eventRepository) {
            this.eventRepository = Database_1.AppDataSource.getRepository(Event_1.Event);
        }
        return this.eventRepository;
    }
    // Initialize organization repository
    static getOrganizationRepository() {
        if (!this.organizationRepository) {
            this.organizationRepository = Database_1.AppDataSource.getRepository(Organization_1.Organization);
        }
        return this.organizationRepository;
    }
    // Initialize user repository
    static getUserRepository() {
        if (!this.userRepository) {
            this.userRepository = Database_1.AppDataSource.getRepository(User_1.User);
        }
        return this.userRepository;
    }
    // Initialize venue repository
    static getVenueRepository() {
        if (!this.venueRepository) {
            this.venueRepository = Database_1.AppDataSource.getRepository(Venue_1.Venue);
        }
        return this.venueRepository;
    }
    // Check for duplicate bookings
    static checkDuplicateBookings(venueId, startDate, endDate, startTime, endTime, excludeBookingId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                if (!venueId || !startDate || !endDate) {
                    return { success: false, message: "Venue ID, start date, and end date are required." };
                }
                if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
                    return { success: false, message: "Invalid date format." };
                }
                if (startDate > endDate) {
                    return { success: false, message: "Start date cannot be after end date." };
                }
                const bookingRepo = this.getVenueBookingRepository();
                const query = bookingRepo.createQueryBuilder("booking")
                    .leftJoinAndSelect("booking.event", "event")
                    .leftJoinAndSelect("booking.venue", "venue")
                    .where("booking.venueId = :venueId", { venueId })
                    .andWhere("booking.approvalStatus = :status", { status: "approved" });
                if (excludeBookingId) {
                    query.andWhere("booking.bookingId != :excludeBookingId", { excludeBookingId });
                }
                const bookings = yield query.getMany();
                const conflicts = bookings.filter(booking => {
                    if (!booking.event)
                        return false;
                    const eventStart = booking.event.startTime
                        ? new Date(`${booking.event.startDate.toISOString().split("T")[0]}T${booking.event.startTime}:00Z`)
                        : booking.event.startDate;
                    const eventEnd = booking.event.endTime
                        ? new Date(`${booking.event.endDate.toISOString().split("T")[0]}T${booking.event.endTime}:00Z`)
                        : booking.event.endDate;
                    const proposedStart = startTime
                        ? new Date(`${startDate.toISOString().split("T")[0]}T${startTime}:00Z`)
                        : startDate;
                    const proposedEnd = endTime
                        ? new Date(`${endDate.toISOString().split("T")[0]}T${endTime}:00Z`)
                        : endDate;
                    return eventStart <= proposedEnd && eventEnd >= proposedStart;
                });
                if (conflicts.length > 0) {
                    return {
                        success: false,
                        message: "Conflicting bookings found for the requested period.",
                        conflicts,
                    };
                }
                return { success: true, message: "No conflicting bookings found." };
            }
            catch (error) {
                console.error("Error checking duplicate bookings:", error);
                return { success: false, message: `Failed to check duplicate bookings: ${error instanceof Error ? error.message : "Unknown error"}` };
            }
        });
    }
    // Create a single booking
    static createBooking(bookingData) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d, _e;
            try {
                // Validate required fields
                if (!bookingData.eventId ||
                    !bookingData.venueId ||
                    !bookingData.organizerId ||
                    !bookingData.organizationId ||
                    !((_a = bookingData.event) === null || _a === void 0 ? void 0 : _a.startDate) ||
                    !((_b = bookingData.event) === null || _b === void 0 ? void 0 : _b.endDate) ||
                    !((_c = bookingData.event) === null || _c === void 0 ? void 0 : _c.startTime) ||
                    !((_d = bookingData.event) === null || _d === void 0 ? void 0 : _d.endTime)) {
                    return { success: false, message: "Missing required booking fields: eventId, venueId, organizerId, organizationId, startDate, endDate, startTime, endTime." };
                }
                // Parse and validate dates
                const startDate = new Date(bookingData.event.startDate);
                const endDate = new Date(bookingData.event.endDate);
                if (isNaN(startDate.getTime()) || isNaN(endDate.getTime()) || startDate > endDate) {
                    return { success: false, message: "Invalid or inconsistent date format." };
                }
                // Initialize repositories
                const eventRepo = this.getEventRepository();
                const venueRepo = this.getVenueRepository();
                const userRepo = this.getUserRepository();
                const orgRepo = this.getOrganizationRepository();
                const bookingRepo = this.getVenueBookingRepository();
                // Fetch related entities
                const event = yield eventRepo.findOne({ where: { eventId: bookingData.eventId } });
                if (!event)
                    return { success: false, message: "Event does not exist." };
                const venue = yield venueRepo.findOne({ where: { venueId: bookingData.venueId } });
                if (!venue)
                    return { success: false, message: "Venue does not exist." };
                if (event.maxAttendees && event.maxAttendees > venue.capacity) {
                    return { success: false, message: "Venue capacity is insufficient for the expected attendance." };
                }
                const user = yield userRepo.findOne({ where: { userId: bookingData.organizerId } });
                if (!user)
                    return { success: false, message: "Organizer does not exist." };
                const organization = yield orgRepo.findOne({ where: { organizationId: bookingData.organizationId } });
                if (!organization)
                    return { success: false, message: "Organization does not exist." };
                // Check for duplicate bookings
                const conflictCheck = yield this.checkDuplicateBookings(bookingData.venueId, startDate, endDate, bookingData.event.startTime, bookingData.event.endTime);
                if (!conflictCheck.success) {
                    return { success: false, message: conflictCheck.message, data: (_e = conflictCheck.conflicts) === null || _e === void 0 ? void 0 : _e[0] };
                }
                // Set default approval status
                bookingData.approvalStatus = bookingData.approvalStatus || "pending";
                // Create booking entity
                const newBooking = bookingRepo.create({
                    event,
                    venue,
                    user,
                    organization,
                    approvalStatus: bookingData.approvalStatus, // Enum compatibility
                });
                // Save booking
                const savedBooking = yield bookingRepo.save(newBooking);
                // Invalidate caches
                yield CacheService_1.CacheService.invalidateMultiple([
                    `${this.CACHE_PREFIX}all`,
                    `${this.CACHE_PREFIX}${savedBooking.bookingId}`,
                    `${this.CACHE_PREFIX}event:${bookingData.eventId}`,
                    `${this.CACHE_PREFIX}venue:${bookingData.venueId}`,
                    `${this.CACHE_PREFIX}organizer:${bookingData.organizerId}`,
                    `${this.CACHE_PREFIX}organization:${bookingData.organizationId}`,
                    `${this.CACHE_PREFIX}status:*`,
                ]);
                return { success: true, data: savedBooking, message: "Booking created successfully." };
            }
            catch (error) {
                console.error("Error creating booking:", error);
                return { success: false, message: `Failed to create booking: ${error instanceof Error ? error.message : "Unknown error"}` };
            }
        });
    }
    // Create multiple bookings
    static createMultipleBookings(bookingsData) {
        return __awaiter(this, void 0, void 0, function* () {
            const bookings = [];
            const errors = [];
            for (const bookingData of bookingsData) {
                try {
                    const createResult = yield this.createBooking(bookingData);
                    if (createResult.success && createResult.data) {
                        bookings.push(createResult.data);
                    }
                    else {
                        errors.push({ data: bookingData, message: createResult.message || "Failed to create booking." });
                    }
                }
                catch (error) {
                    errors.push({
                        data: bookingData,
                        message: `Failed to create booking: ${error instanceof Error ? error.message : "Unknown error"}`,
                    });
                }
            }
            // Invalidate cache for all bookings
            yield CacheService_1.CacheService.invalidateMultiple([
                `${this.CACHE_PREFIX}all`,
                `${this.CACHE_PREFIX}status:*`,
            ]);
            return { success: errors.length === 0, bookings, errors };
        });
    }
    // Get all bookings
    static getAllBookings() {
        return __awaiter(this, void 0, void 0, function* () {
            const cacheKey = `${this.CACHE_PREFIX}all`;
            try {
                const bookings = yield CacheService_1.CacheService.getOrSetMultiple(cacheKey, this.getVenueBookingRepository(), () => __awaiter(this, void 0, void 0, function* () {
                    return yield this.getVenueBookingRepository().find({
                        relations: ["event", "venue", "user", "organization"],
                        order: { createdAt: "DESC" },
                    });
                }), this.CACHE_TTL);
                return {
                    success: true,
                    data: bookings,
                    message: bookings.length ? undefined : "No bookings found.",
                };
            }
            catch (error) {
                console.error("Error fetching all bookings:", error);
                return { success: false, message: `Failed to get all bookings: ${error instanceof Error ? error.message : "Unknown error"}` };
            }
        });
    }
    // Get booking by ID
    static getBookingById(id) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!id) {
                return { success: false, message: "Booking ID is required." };
            }
            const cacheKey = `${this.CACHE_PREFIX}${id}`;
            try {
                const booking = yield CacheService_1.CacheService.getOrSetSingle(cacheKey, this.getVenueBookingRepository(), () => __awaiter(this, void 0, void 0, function* () {
                    return yield this.getVenueBookingRepository().findOne({
                        where: { bookingId: id },
                        relations: ["event", "venue", "user", "organization"],
                    });
                }), this.CACHE_TTL);
                if (!booking) {
                    return { success: false, message: "Booking not found." };
                }
                return { success: true, data: booking };
            }
            catch (error) {
                console.error("Error fetching booking by ID:", error);
                return { success: false, message: `Failed to get booking by ID: ${error instanceof Error ? error.message : "Unknown error"}` };
            }
        });
    }
    // Update booking
    static updateBooking(id, bookingData) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d, _e, _f, _g, _h;
            try {
                if (!id) {
                    return { success: false, message: "Booking ID is required." };
                }
                const bookingRepo = this.getVenueBookingRepository();
                const existingBooking = yield bookingRepo.findOne({
                    where: { bookingId: id },
                    relations: ["event", "venue", "user", "organization"],
                });
                if (!existingBooking) {
                    return { success: false, message: "Booking not found." };
                }
                // Validate new entities if provided
                if (bookingData.eventId && bookingData.eventId !== existingBooking.event.eventId) {
                    const event = yield this.getEventRepository().findOne({ where: { eventId: bookingData.eventId } });
                    if (!event)
                        return { success: false, message: "Event does not exist." };
                    existingBooking.event = event;
                }
                if (bookingData.venueId && bookingData.venueId !== existingBooking.venue.venueId) {
                    const venue = yield this.getVenueRepository().findOne({ where: { venueId: bookingData.venueId } });
                    if (!venue)
                        return { success: false, message: "Venue does not exist." };
                    if (existingBooking.event.maxAttendees && existingBooking.event.maxAttendees > venue.capacity) {
                        return { success: false, message: "Venue capacity is insufficient for the expected attendance." };
                    }
                    existingBooking.venue = venue;
                }
                if (bookingData.organizerId && bookingData.organizerId !== existingBooking.user.userId) {
                    const user = yield this.getUserRepository().findOne({ where: { userId: bookingData.organizerId } });
                    if (!user)
                        return { success: false, message: "Organizer does not exist." };
                    existingBooking.user = user;
                }
                if (bookingData.organizationId && bookingData.organizationId !== existingBooking.organization.organizationId) {
                    const org = yield this.getOrganizationRepository().findOne({ where: { organizationId: bookingData.organizationId } });
                    if (!org)
                        return { success: false, message: "Organization does not exist." };
                    existingBooking.organization = org;
                }
                // Validate approval status
                if (bookingData.approvalStatus &&
                    !["pending", "approved", "rejected"].includes(bookingData.approvalStatus)) {
                    return { success: false, message: "Invalid approval status." };
                }
                // Check conflicts if event dates/times change
                if (((_a = bookingData.event) === null || _a === void 0 ? void 0 : _a.startDate) || ((_b = bookingData.event) === null || _b === void 0 ? void 0 : _b.endDate) || ((_c = bookingData.event) === null || _c === void 0 ? void 0 : _c.startTime) || ((_d = bookingData.event) === null || _d === void 0 ? void 0 : _d.endTime)) {
                    const startDate = ((_e = bookingData.event) === null || _e === void 0 ? void 0 : _e.startDate)
                        ? new Date(bookingData.event.startDate)
                        : existingBooking.event.startDate;
                    const endDate = ((_f = bookingData.event) === null || _f === void 0 ? void 0 : _f.endDate)
                        ? new Date(bookingData.event.endDate)
                        : existingBooking.event.endDate;
                    const startTime = ((_g = bookingData.event) === null || _g === void 0 ? void 0 : _g.startTime) || existingBooking.event.startTime;
                    const endTime = ((_h = bookingData.event) === null || _h === void 0 ? void 0 : _h.endTime) || existingBooking.event.endTime;
                    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime()) || startDate > endDate) {
                        return { success: false, message: "Invalid or inconsistent date format." };
                    }
                    const conflictCheck = yield this.checkDuplicateBookings(bookingData.venueId || existingBooking.venue.venueId, startDate, endDate, startTime, endTime, id);
                    if (!conflictCheck.success) {
                        return { success: false, message: conflictCheck.message };
                    }
                }
                // Merge updates
                if (bookingData.approvalStatus) {
                    existingBooking.approvalStatus = bookingData.approvalStatus;
                }
                const updatedBooking = yield bookingRepo.save(existingBooking);
                // Invalidate caches
                yield CacheService_1.CacheService.invalidateMultiple([
                    `${this.CACHE_PREFIX}all`,
                    `${this.CACHE_PREFIX}${id}`,
                    `${this.CACHE_PREFIX}event:${existingBooking.event.eventId}`,
                    `${this.CACHE_PREFIX}venue:${existingBooking.venue.venueId}`,
                    `${this.CACHE_PREFIX}organizer:${existingBooking.user.userId}`,
                    `${this.CACHE_PREFIX}organization:${existingBooking.organization.organizationId}`,
                    `${this.CACHE_PREFIX}status:${existingBooking.approvalStatus}`,
                    `${this.CACHE_PREFIX}status:${updatedBooking.approvalStatus}`,
                ]);
                return { success: true, data: updatedBooking, message: "Booking updated successfully." };
            }
            catch (error) {
                console.error("Error updating booking:", error);
                return { success: false, message: `Failed to update booking: ${error instanceof Error ? error.message : "Unknown error"}` };
            }
        });
    }
    // Update booking status
    static updateBookingStatus(id, status) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                if (!id) {
                    return { success: false, message: "Booking ID is required." };
                }
                if (!["pending", "approved", "rejected"].includes(status)) {
                    return { success: false, message: "Invalid approval status." };
                }
                const bookingRepo = this.getVenueBookingRepository();
                const existingBooking = yield bookingRepo.findOne({
                    where: { bookingId: id },
                    relations: ["event", "venue", "user", "organization"],
                });
                if (!existingBooking) {
                    return { success: false, message: "Booking not found." };
                }
                const oldStatus = existingBooking.approvalStatus;
                existingBooking.approvalStatus = status;
                const updatedBooking = yield bookingRepo.save(existingBooking);
                // Invalidate caches
                yield CacheService_1.CacheService.invalidateMultiple([
                    `${this.CACHE_PREFIX}all`,
                    `${this.CACHE_PREFIX}${id}`,
                    `${this.CACHE_PREFIX}event:${existingBooking.event.eventId}`,
                    `${this.CACHE_PREFIX}venue:${existingBooking.venue.venueId}`,
                    `${this.CACHE_PREFIX}organizer:${existingBooking.user.userId}`,
                    `${this.CACHE_PREFIX}organization:${existingBooking.organization.organizationId}`,
                    `${this.CACHE_PREFIX}status:${oldStatus}`,
                    `${this.CACHE_PREFIX}status:${status}`,
                ]);
                return { success: true, data: updatedBooking, message: "Booking status updated successfully." };
            }
            catch (error) {
                console.error("Error updating booking status:", error);
                return { success: false, message: `Failed to update booking status: ${error instanceof Error ? error.message : "Unknown error"}` };
            }
        });
    }
    // Delete booking
    static deleteBooking(id) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                if (!id) {
                    return { success: false, message: "Booking ID is required." };
                }
                const bookingRepo = this.getVenueBookingRepository();
                const existingBooking = yield bookingRepo.findOne({
                    where: { bookingId: id },
                    relations: ["event", "venue", "user", "organization"],
                });
                if (!existingBooking) {
                    return { success: false, message: "Booking not found." };
                }
                yield bookingRepo.delete(id);
                // Invalidate caches
                yield CacheService_1.CacheService.invalidateMultiple([
                    `${this.CACHE_PREFIX}all`,
                    `${this.CACHE_PREFIX}${id}`,
                    `${this.CACHE_PREFIX}event:${existingBooking.event.eventId}`,
                    `${this.CACHE_PREFIX}venue:${existingBooking.venue.venueId}`,
                    `${this.CACHE_PREFIX}organizer:${existingBooking.user.userId}`,
                    `${this.CACHE_PREFIX}organization:${existingBooking.organization.organizationId}`,
                    `${this.CACHE_PREFIX}status:${existingBooking.approvalStatus}`,
                ]);
                return { success: true, message: "Booking deleted successfully." };
            }
            catch (error) {
                console.error("Error deleting booking:", error);
                return { success: false, message: `Failed to delete booking: ${error instanceof Error ? error.message : "Unknown error"}` };
            }
        });
    }
    // Get bookings by event ID
    static getBookingsByEventId(eventId) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!eventId) {
                return { success: false, message: "Event ID is required." };
            }
            const cacheKey = `${this.CACHE_PREFIX}event:${eventId}`;
            try {
                const bookings = yield CacheService_1.CacheService.getOrSetMultiple(cacheKey, this.getVenueBookingRepository(), () => __awaiter(this, void 0, void 0, function* () {
                    const event = yield this.getEventRepository().findOne({ where: { eventId } });
                    if (!event) {
                        throw new Error("Event does not exist.");
                    }
                    return yield this.getVenueBookingRepository().find({
                        where: { event: { eventId } },
                        relations: ["event", "venue", "user", "organization"],
                        order: { createdAt: "DESC" },
                    });
                }), this.CACHE_TTL);
                return {
                    success: true,
                    data: bookings,
                    message: bookings.length ? undefined : "No bookings found for this event.",
                };
            }
            catch (error) {
                console.error("Error fetching bookings by event ID:", error);
                return { success: false, message: `Failed to get bookings by event ID: ${error instanceof Error ? error.message : "Unknown error"}` };
            }
        });
    }
    // Get bookings by venue ID
    static getBookingsByVenueId(venueId) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!venueId) {
                return { success: false, message: "Venue ID is required." };
            }
            const cacheKey = `${this.CACHE_PREFIX}venue:${venueId}`;
            try {
                const bookings = yield CacheService_1.CacheService.getOrSetMultiple(cacheKey, this.getVenueBookingRepository(), () => __awaiter(this, void 0, void 0, function* () {
                    return yield this.getVenueBookingRepository().find({
                        where: { venue: { venueId } },
                        relations: ["event", "venue", "user", "organization"],
                        order: { createdAt: "DESC" },
                    });
                }), this.CACHE_TTL);
                return {
                    success: true,
                    data: bookings,
                    message: bookings.length ? undefined : "No bookings found for this venue.",
                };
            }
            catch (error) {
                console.error("Error fetching bookings by venue ID:", error);
                return { success: false, message: `Failed to get bookings by venue ID: ${error instanceof Error ? error.message : "Unknown error"}` };
            }
        });
    }
    // Get bookings by organizer ID
    static getBookingsByOrganizerId(organizerId) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!organizerId) {
                return { success: false, message: "Organizer ID is required." };
            }
            const cacheKey = `${this.CACHE_PREFIX}organizer:${organizerId}`;
            try {
                const bookings = yield CacheService_1.CacheService.getOrSetMultiple(cacheKey, this.getVenueBookingRepository(), () => __awaiter(this, void 0, void 0, function* () {
                    return yield this.getVenueBookingRepository().find({
                        where: { user: { userId: organizerId } },
                        relations: ["event", "venue", "user", "organization"],
                        order: { createdAt: "DESC" },
                    });
                }), this.CACHE_TTL);
                return {
                    success: true,
                    data: bookings,
                    message: bookings.length ? undefined : "No bookings found for this organizer.",
                };
            }
            catch (error) {
                console.error("Error fetching bookings by organizer ID:", error);
                return { success: false, message: `Failed to get bookings by organizer ID: ${error instanceof Error ? error.message : "Unknown error"}` };
            }
        });
    }
    // Get bookings by organization ID
    static getBookingsByOrganizationId(organizationId) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!organizationId) {
                return { success: false, message: "Organization ID is required." };
            }
            const cacheKey = `${this.CACHE_PREFIX}organization:${organizationId}`;
            try {
                const bookings = yield CacheService_1.CacheService.getOrSetMultiple(cacheKey, this.getVenueBookingRepository(), () => __awaiter(this, void 0, void 0, function* () {
                    return yield this.getVenueBookingRepository().find({
                        where: { organization: { organizationId } },
                        relations: ["event", "venue", "user", "organization"],
                        order: { createdAt: "DESC" },
                    });
                }), this.CACHE_TTL);
                return {
                    success: true,
                    data: bookings,
                    message: bookings.length ? undefined : "No bookings found for this organization.",
                };
            }
            catch (error) {
                console.error("Error fetching bookings by organization ID:", error);
                return { success: false, message: `Failed to get bookings by organization ID: ${error instanceof Error ? error.message : "Unknown error"}` };
            }
        });
    }
    // Get bookings by approval status
    static getBookingsByStatus(approvalStatus) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!["pending", "approved", "rejected"].includes(approvalStatus)) {
                return { success: false, message: "Invalid approval status." };
            }
            const cacheKey = `${this.CACHE_PREFIX}status:${approvalStatus}`;
            try {
                const bookings = yield CacheService_1.CacheService.getOrSetMultiple(cacheKey, this.getVenueBookingRepository(), () => __awaiter(this, void 0, void 0, function* () {
                    return yield this.getVenueBookingRepository().find({
                        where: { approvalStatus: approvalStatus },
                        relations: ["event", "venue", "user", "organization"],
                        order: { createdAt: "DESC" },
                    });
                }), this.CACHE_TTL);
                return {
                    success: true,
                    data: bookings,
                    message: bookings.length ? undefined : `No bookings found with status: ${approvalStatus}.`,
                };
            }
            catch (error) {
                console.error("Error fetching bookings by status:", error);
                return { success: false, message: `Failed to get bookings by status: ${error instanceof Error ? error.message : "Unknown error"}` };
            }
        });
    }
    // Get bookings by date range (based on Event dates)
    static getBookingsByDateRange(startDate, endDate, filterOptions) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
                    return { success: false, message: "Invalid date format." };
                }
                if (startDate > endDate) {
                    return { success: false, message: "Start date cannot be after end date." };
                }
                const cacheKey = `${this.CACHE_PREFIX}date:${startDate.toISOString()}:${endDate.toISOString()}:${filterOptions.join(",")}`;
                const bookingRepo = this.getVenueBookingRepository();
                const bookings = yield CacheService_1.CacheService.getOrSetMultiple(cacheKey, bookingRepo, () => __awaiter(this, void 0, void 0, function* () {
                    let query = bookingRepo.createQueryBuilder("booking")
                        .leftJoinAndSelect("booking.event", "event")
                        .leftJoinAndSelect("booking.venue", "venue")
                        .leftJoinAndSelect("booking.user", "user")
                        .leftJoinAndSelect("booking.organization", "organization")
                        .where("event.startDate <= :endDate", { endDate })
                        .andWhere("event.endDate >= :startDate", { startDate });
                    if (filterOptions.includes("min") && !filterOptions.includes("all")) {
                        query.andWhere("EXTRACT(MINUTE FROM event.startTime) >= 0");
                    }
                    if (filterOptions.includes("hours") && !filterOptions.includes("all")) {
                        query.andWhere("EXTRACT(HOUR FROM event.startTime) >= 0");
                    }
                    if (filterOptions.includes("days") && !filterOptions.includes("all")) {
                        query.andWhere("EXTRACT(DAY FROM event.startDate) >= 0");
                    }
                    return yield query.orderBy("booking.createdAt", "DESC").getMany();
                }), this.CACHE_TTL);
                return {
                    success: true,
                    data: bookings,
                    message: bookings.length ? undefined : "No bookings found in this date range.",
                };
            }
            catch (error) {
                console.error("Error fetching bookings by date range:", error);
                return { success: false, message: `Failed to get bookings by date range: ${error instanceof Error ? error.message : "Unknown error"}` };
            }
        });
    }
    // Helper method to convert time string (HH:MM or HH:MM:SS) to minutes
    static timeToMinutes(timeStr) {
        const [hours, minutes] = timeStr.split(":").map(Number);
        return hours * 60 + minutes;
    }
}
exports.VenueBookingRepository = VenueBookingRepository;
VenueBookingRepository.CACHE_PREFIX = "booking:";
VenueBookingRepository.CACHE_TTL = 3600; // 1 hour, consistent with VenueRepository
