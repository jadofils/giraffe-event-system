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
exports.EventRepository = void 0;
const Database_1 = require("../config/Database");
const Index_1 = require("../interfaces/Index");
const Event_1 = require("../models/Event");
const Venue_1 = require("../models/Venue");
const CacheService_1 = require("../services/CacheService");
const typeorm_1 = require("typeorm");
class EventRepository {
    /**
     * Creates a new Event instance from provided data.
     * @param data Partial<EventInterface> - The data for creating the event.
     * @returns {success: boolean; data?: Event; message?: string} - Result object with success status, Event entity, or error message.
     */
    static create(data) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d, _e, _f;
            if (!data.eventTitle || !data.eventType || !data.organizerId || !data.organizationId || !data.startDate || !data.endDate) {
                return { success: false, message: "Missing required event fields: eventTitle, eventType, organizerId, organizationId, startDate, endDate" };
            }
            const eventTypeMap = {
                public: Index_1.EventType.PUBLIC,
                private: Index_1.EventType.PRIVATE,
            };
            const mappedEventType = eventTypeMap[data.eventType.toLowerCase()];
            if (!mappedEventType) {
                return { success: false, message: "Invalid event type provided." };
            }
            const eventStatusMap = {
                draft: Index_1.EventStatus.DRAFT,
                published: Index_1.EventStatus.PUBLISHED,
                cancelled: Index_1.EventStatus.CANCELLED,
                completed: Index_1.EventStatus.COMPLETED,
                archived: Index_1.EventStatus.ARCHIVED,
            };
            const mappedStatus = data.status ? eventStatusMap[data.status.toLowerCase()] : Index_1.EventStatus.DRAFT;
            if (data.status && !mappedStatus) {
                return { success: false, message: "Invalid event status provided." };
            }
            const event = new Event_1.Event();
            event.eventTitle = data.eventTitle;
            event.eventType = mappedEventType;
            event.organizerId = data.organizerId;
            event.organizationId = data.organizationId;
            event.startDate = new Date(data.startDate);
            event.endDate = new Date(data.endDate);
            event.startTime = data.startTime ? String(data.startTime) : '';
            event.endTime = data.endTime ? String(data.endTime) : '';
            event.description = (_a = data.description) !== null && _a !== void 0 ? _a : undefined;
            event.eventCategoryId = (_b = data.eventCategory) !== null && _b !== void 0 ? _b : undefined;
            event.maxAttendees = (_c = data.maxAttendees) !== null && _c !== void 0 ? _c : undefined;
            event.status = mappedStatus;
            event.isFeatured = (_d = data.isFeatured) !== null && _d !== void 0 ? _d : false;
            event.qrCode = (_e = data.qrCode) !== null && _e !== void 0 ? _e : undefined;
            event.imageURL = (_f = data.imageURL) !== null && _f !== void 0 ? _f : undefined;
            // Handle venues array if provided
            if (data.venues && Array.isArray(data.venues)) {
                const venueRepository = Database_1.AppDataSource.getRepository(Venue_1.Venue);
                const venueIds = data.venues.map((v) => v.venueId).filter(Boolean);
                if (venueIds.length > 0) {
                    const venues = yield venueRepository.find({ where: { venueId: (0, typeorm_1.In)(venueIds) } });
                    if (venues.length !== venueIds.length) {
                        return { success: false, message: "One or more venues not found." };
                    }
                    event.venues = venues;
                }
            }
            return { success: true, data: event };
        });
    }
    /**
     * Saves an Event entity to the database.
     * @param event Event - The Event entity to be saved.
     * @returns {Promise<{success: boolean; data?: Event; message?: string}>} - Result object with success status, saved Event entity, or error message.
     */
    static save(event) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const savedEvent = yield Database_1.AppDataSource.getRepository(Event_1.Event).save(event);
                // Invalidate caches
                yield CacheService_1.CacheService.invalidateMultiple([
                    `${this.CACHE_PREFIX}all`,
                    `${this.CACHE_PREFIX}${savedEvent.eventId}`,
                    `${this.CACHE_PREFIX}org:${savedEvent.organizationId}`,
                    `${this.CACHE_PREFIX}organizer:${savedEvent.organizerId}`,
                    `${this.CACHE_PREFIX}${savedEvent.eventId}:venues`,
                ]);
                return { success: true, data: savedEvent, message: "Event saved successfully" };
            }
            catch (error) {
                console.error("Error saving event:", error);
                return { success: false, message: "Failed to save this event." };
            }
        });
    }
    /**
     * Retrieves an event by its ID.
     * @param id string - The ID of the event to retrieve.
     * @returns {Promise<{success: boolean; data?: Event; message?: string}>} - Result object with success status, Event entity, or error message.
     */
    static getById(id) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!id) {
                return { success: false, message: "Event ID is required." };
            }
            const cacheKey = `${this.CACHE_PREFIX}${id}`;
            try {
                const event = yield CacheService_1.CacheService.getOrSetSingle(cacheKey, Database_1.AppDataSource.getRepository(Event_1.Event), () => __awaiter(this, void 0, void 0, function* () {
                    return yield Database_1.AppDataSource.getRepository(Event_1.Event).findOne({
                        where: { eventId: id },
                        relations: ["organizer", "organizer.role", "venues", "organization"],
                    });
                }), this.CACHE_TTL);
                if (!event) {
                    return { success: false, message: "Event not found." };
                }
                return { success: true, data: event };
            }
            catch (error) {
                console.error("Error fetching event by ID:", error);
                return { success: false, message: "Failed to retrieve event by ID." };
            }
        });
    }
    /**
     * Retrieves events by organizer ID.
     * @param organizerId string - The ID of the organizer.
     * @returns {Promise<{success: boolean; data?: Event[]; message?: string}>} - Result object with success status, array of Event entities, or error message.
     */
    static getByOrganizerId(organizerId) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!organizerId) {
                return { success: false, message: "Organizer ID is required." };
            }
            const cacheKey = `${this.CACHE_PREFIX}organizer:${organizerId}`;
            try {
                const events = yield CacheService_1.CacheService.getOrSetMultiple(cacheKey, Database_1.AppDataSource.getRepository(Event_1.Event), () => __awaiter(this, void 0, void 0, function* () {
                    return yield Database_1.AppDataSource.getRepository(Event_1.Event).find({
                        where: { organizerId },
                        relations: ["organizer", "organizer.role", "venues", "organization"],
                        order: { startDate: "ASC" },
                    });
                }), this.CACHE_TTL);
                if (events.length === 0) {
                    return { success: false, message: "No events found for this organizer." };
                }
                return { success: true, data: events };
            }
            catch (error) {
                console.error("Error fetching events by organizer ID:", error);
                return { success: false, message: "Failed to fetch events by organizer ID." };
            }
        });
    }
    /**
     * Retrieves events by organization ID.
     * @param organizationId string - The ID of the organization.
     * @returns {Promise<{success: boolean; data?: Event[]; message?: string}>} - Result object with success status, array of Event entities, or error message.
     */
    static getByOrganizationId(organizationId) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!organizationId) {
                return { success: false, message: "Organization ID is required." };
            }
            const cacheKey = `${this.CACHE_PREFIX}org:${organizationId}`;
            try {
                const events = yield CacheService_1.CacheService.getOrSetMultiple(cacheKey, Database_1.AppDataSource.getRepository(Event_1.Event), () => __awaiter(this, void 0, void 0, function* () {
                    return yield Database_1.AppDataSource.getRepository(Event_1.Event).find({
                        where: { organizationId },
                        relations: ["organizer", "organizer.role", "venues", "organization"],
                        order: { startDate: "ASC" },
                    });
                }), this.CACHE_TTL);
                if (events.length === 0) {
                    return { success: false, message: "No events found for this organization." };
                }
                return { success: true, data: events };
            }
            catch (error) {
                console.error("Error fetching events by organization ID:", error);
                return { success: false, message: "Failed to fetch events by organization ID." };
            }
        });
    }
    /**
     * Retrieves all events.
     * @returns {Promise<{success: boolean; data?: Event[]; message?: string}>} - Result object with success status, array of Event entities, or error message.
     */
    static getAll() {
        return __awaiter(this, void 0, void 0, function* () {
            const cacheKey = `${this.CACHE_PREFIX}all`;
            try {
                const events = yield CacheService_1.CacheService.getOrSetMultiple(cacheKey, Database_1.AppDataSource.getRepository(Event_1.Event), () => __awaiter(this, void 0, void 0, function* () {
                    return yield Database_1.AppDataSource.getRepository(Event_1.Event).find({
                        relations: ["organizer", "organizer.role", "venues", "organization"],
                        order: { startDate: "ASC" },
                    });
                }), this.CACHE_TTL);
                return { success: true, data: events };
            }
            catch (error) {
                console.error("Error fetching all events:", error);
                return { success: false, message: "Failed to retrieve all events." };
            }
        });
    }
    /**
     * Updates an existing event.
     * @param id string - The ID of the event to update.
     * @param data Partial<EventInterface> - The partial data to update the event with.
     * @returns {Promise<{success: boolean; data?: Event; message?: string}>} - Result object with success status, updated Event entity, or error message.
     */
    static update(id, data) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l;
            if (!id) {
                return { success: false, message: "Event ID is required for update." };
            }
            try {
                const repo = Database_1.AppDataSource.getRepository(Event_1.Event);
                const event = yield repo.findOne({ where: { eventId: id }, relations: ["venues"] });
                if (!event) {
                    return { success: false, message: "Event not found." };
                }
                let updatedEventType = event.eventType;
                if (data.eventType) {
                    const eventTypeMap = {
                        public: Index_1.EventType.PUBLIC,
                        private: Index_1.EventType.PRIVATE,
                    };
                    const mappedType = eventTypeMap[data.eventType.toLowerCase()];
                    if (mappedType) {
                        updatedEventType = mappedType;
                    }
                    else {
                        return { success: false, message: "Invalid event type for update." };
                    }
                }
                let updatedStatus = event.status;
                if (data.status) {
                    const eventStatusMap = {
                        draft: Index_1.EventStatus.DRAFT,
                        published: Index_1.EventStatus.PUBLISHED,
                        cancelled: Index_1.EventStatus.CANCELLED,
                        completed: Index_1.EventStatus.COMPLETED,
                        archived: Index_1.EventStatus.ARCHIVED,
                    };
                    const mappedStatus = eventStatusMap[data.status.toLowerCase()];
                    if (mappedStatus) {
                        updatedStatus = mappedStatus;
                    }
                    else {
                        return { success: false, message: "Invalid event status for update." };
                    }
                }
                repo.merge(event, {
                    eventTitle: (_a = data.eventTitle) !== null && _a !== void 0 ? _a : event.eventTitle,
                    eventType: updatedEventType,
                    organizerId: (_b = data.organizerId) !== null && _b !== void 0 ? _b : event.organizerId,
                    organizationId: (_c = data.organizationId) !== null && _c !== void 0 ? _c : event.organizationId,
                    startDate: data.startDate ? new Date(data.startDate) : event.startDate,
                    endDate: data.endDate ? new Date(data.endDate) : event.endDate,
                    startTime: (_d = data.startTime) !== null && _d !== void 0 ? _d : event.startTime,
                    endTime: (_e = data.endTime) !== null && _e !== void 0 ? _e : event.endTime,
                    description: (_f = data.description) !== null && _f !== void 0 ? _f : event.description,
                    eventCategoryId: (_g = data.eventCategory) !== null && _g !== void 0 ? _g : event.eventCategoryId,
                    maxAttendees: (_h = data.maxAttendees) !== null && _h !== void 0 ? _h : event.maxAttendees,
                    status: updatedStatus,
                    isFeatured: (_j = data.isFeatured) !== null && _j !== void 0 ? _j : event.isFeatured,
                    qrCode: (_k = data.qrCode) !== null && _k !== void 0 ? _k : event.qrCode,
                    imageURL: (_l = data.imageURL) !== null && _l !== void 0 ? _l : event.imageURL,
                });
                if (data.venues && Array.isArray(data.venues)) {
                    const venueRepository = Database_1.AppDataSource.getRepository(Venue_1.Venue);
                    const venueIds = data.venues.map((v) => v.venueId).filter(Boolean);
                    if (venueIds.length > 0) {
                        const venues = yield venueRepository.find({ where: { venueId: (0, typeorm_1.In)(venueIds) } });
                        if (venues.length !== venueIds.length) {
                            return { success: false, message: "One or more venues not found." };
                        }
                        event.venues = venues;
                    }
                    else {
                        event.venues = [];
                    }
                }
                const updatedEvent = yield repo.save(event);
                // Invalidate caches
                yield CacheService_1.CacheService.invalidateMultiple([
                    `${this.CACHE_PREFIX}all`,
                    `${this.CACHE_PREFIX}${id}`,
                    `${this.CACHE_PREFIX}org:${updatedEvent.organizationId}`,
                    `${this.CACHE_PREFIX}organizer:${updatedEvent.organizerId}`,
                    `${this.CACHE_PREFIX}${id}:venues`,
                ]);
                return { success: true, data: updatedEvent, message: "Event updated successfully." };
            }
            catch (error) {
                console.error("Error updating event:", error);
                return { success: false, message: "Failed to update event." };
            }
        });
    }
    /**
   * Deletes an event by its ID (soft delete if DeleteDateColumn exists).
     * @param id string - The ID of the event to delete.
   * @returns {Promise<{success: boolean; message?: string}>} - Result object with success status or error message.
     */
    static delete(id) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!id) {
                return { success: false, message: "Event ID is required." };
            }
            try {
                const repo = Database_1.AppDataSource.getRepository(Event_1.Event);
                const event = yield repo.findOne({ where: { eventId: id } });
                if (!event) {
                    return { success: false, message: "Event not found." };
                }
                yield repo.softRemove(event); // Soft delete if DeleteDateColumn exists
                // Invalidate caches
                yield CacheService_1.CacheService.invalidateMultiple([
                    `${this.CACHE_PREFIX}all`,
                    `${this.CACHE_PREFIX}${id}`,
                    `${this.CACHE_PREFIX}org:${event.organizationId}`,
                    `${this.CACHE_PREFIX}organizer:${event.organizerId}`,
                    `${this.CACHE_PREFIX}${id}:venues`,
                ]);
                return { success: true, message: "Event deleted successfully." };
            }
            catch (error) {
                console.error("Error deleting event:", error);
                return { success: false, message: "Failed to delete event." };
            }
        });
    }
    /**
     * Retrieves events by venue ID.
     * @param venueId string - The ID of the venue.
     * @returns {Promise<{success: boolean; data?: Event[]; message?: string}>} - Result object with success status, array of Event entities, or error message.
     */
    static getByVenueId(venueId) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!venueId) {
                return { success: false, message: "Venue ID is required." };
            }
            const cacheKey = `${this.CACHE_PREFIX}venue:${venueId}`;
            try {
                const events = yield CacheService_1.CacheService.getOrSetMultiple(cacheKey, Database_1.AppDataSource.getRepository(Event_1.Event), () => __awaiter(this, void 0, void 0, function* () {
                    return yield Database_1.AppDataSource.getRepository(Event_1.Event).createQueryBuilder("event")
                        .leftJoinAndSelect("event.venues", "venue")
                        .leftJoinAndSelect("event.organizer", "organizer")
                        .leftJoinAndSelect("organizer.role", "role")
                        .leftJoinAndSelect("event.organization", "organization")
                        .where("venue.venueId = :venueId", { venueId })
                        .orderBy("event.startDate", "ASC")
                        .getMany();
                }), this.CACHE_TTL);
                if (events.length === 0) {
                    return { success: false, message: "No events found for this venue." };
                }
                return { success: true, data: events };
            }
            catch (error) {
                console.error("Error fetching events by venue ID:", error);
                return { success: false, message: "Failed to fetch events by venue ID." };
            }
        });
    }
    /**
     * Retrieves events by status.
     * @param status EventStatus - The status of the events to retrieve.
     * @returns {Promise<{success: boolean; data?: Event[]; message?: string}>} - Result object with success status, array of Event entities, or error message.
     */
    static getByStatus(status) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!status) {
                return { success: false, message: "Event status is required." };
            }
            const cacheKey = `${this.CACHE_PREFIX}status:${status}`;
            try {
                const events = yield CacheService_1.CacheService.getOrSetMultiple(cacheKey, Database_1.AppDataSource.getRepository(Event_1.Event), () => __awaiter(this, void 0, void 0, function* () {
                    return yield Database_1.AppDataSource.getRepository(Event_1.Event).find({
                        where: { status },
                        relations: ["organizer", "organizer.role", "venues", "organization"],
                        order: { startDate: "ASC" },
                    });
                }), this.CACHE_TTL);
                if (events.length === 0) {
                    return { success: false, message: `No events found with status ${status}.` };
                }
                return { success: true, data: events };
            }
            catch (error) {
                console.error("Error fetching events by status:", error);
                return { success: false, message: "Failed to fetch events by status." };
            }
        });
    }
    /**
     * Retrieves events within a date range.
     * @param startDate Date - The start of the date range.
     * @param endDate Date - The end of the date range.
     * @returns {Promise<{success: boolean; data?: Event[]; message?: string}>} - Result object with success status, array of Event entities, or error message.
     */
    static getByDateRange(startDate, endDate) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!startDate || !endDate) {
                return { success: false, message: "Start and end dates are required." };
            }
            const cacheKey = `${this.CACHE_PREFIX}date:${startDate.toISOString()}:${endDate.toISOString()}`;
            try {
                const events = yield CacheService_1.CacheService.getOrSetMultiple(cacheKey, Database_1.AppDataSource.getRepository(Event_1.Event), () => __awaiter(this, void 0, void 0, function* () {
                    return yield Database_1.AppDataSource.getRepository(Event_1.Event).find({
                        where: { startDate: (0, typeorm_1.Between)(startDate, endDate) },
                        relations: ["organizer", "organizer.role", "venues", "organization"],
                        order: { startDate: "ASC" },
                    });
                }), this.CACHE_TTL);
                if (events.length === 0) {
                    return { success: false, message: "No events found in the specified date range." };
                }
                return { success: true, data: events };
            }
            catch (error) {
                console.error("Error fetching events by date range:", error);
                return { success: false, message: "Failed to fetch events by date range." };
            }
        });
    }
    /**
     * Assigns venues to an event.
     * @param eventId string - The ID of the event.
     * @param venueIds string[] - Array of venue IDs to assign.
     * @returns {Promise<{success: boolean; message?: string}>} - Result object with success status or error message.
     */
    static assignVenues(eventId, venueIds) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!eventId || !venueIds || !Array.isArray(venueIds) || venueIds.length === 0) {
                return { success: false, message: "Event ID and valid venue IDs are required." };
            }
            try {
                const repo = Database_1.AppDataSource.getRepository(Event_1.Event);
                const event = yield repo.findOne({ where: { eventId }, relations: ["venues"] });
                if (!event) {
                    return { success: false, message: "Event not found." };
                }
                const venueRepository = Database_1.AppDataSource.getRepository(Venue_1.Venue);
                const venues = yield venueRepository.find({ where: { venueId: (0, typeorm_1.In)(venueIds) } });
                if (venues.length !== venueIds.length) {
                    return { success: false, message: "One or more venues not found." };
                }
                event.venues = venues;
                yield repo.save(event);
                // Invalidate caches
                yield CacheService_1.CacheService.invalidateMultiple([
                    `${this.CACHE_PREFIX}${eventId}`,
                    `${this.CACHE_PREFIX}${eventId}:venues`,
                    `${this.CACHE_PREFIX}all`,
                    `${this.CACHE_PREFIX}org:${event.organizationId}`,
                    `${this.CACHE_PREFIX}organizer:${event.organizerId}`,
                    ...venueIds.map(venueId => `${this.CACHE_PREFIX}venue:${venueId}`),
                ]);
                return { success: true, message: "Venues assigned successfully." };
            }
            catch (error) {
                console.error("Error assigning venues:", error);
                return { success: false, message: "Failed to assign venues." };
            }
        });
    }
    /**
     * Removes venues from an event.
     * @param eventId string - The ID of the event.
     * @param venueIds string[] - Array of venue IDs to remove.
     * @returns {Promise<{success: boolean; message?: string}>} - Result object with success status or error message.
     */
    static removeVenues(eventId, venueIds) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!eventId || !venueIds || !Array.isArray(venueIds) || venueIds.length === 0) {
                return { success: false, message: "Event ID and valid venue IDs are required." };
            }
            try {
                const repo = Database_1.AppDataSource.getRepository(Event_1.Event);
                const event = yield repo.findOne({ where: { eventId }, relations: ["venues"] });
                if (!event) {
                    return { success: false, message: "Event not found." };
                }
                event.venues = event.venues.filter(venue => !venueIds.includes(venue.venueId));
                yield repo.save(event);
                // Invalidate caches
                yield CacheService_1.CacheService.invalidateMultiple([
                    `${this.CACHE_PREFIX}${eventId}`,
                    `${this.CACHE_PREFIX}${eventId}:venues`,
                    `${this.CACHE_PREFIX}all`,
                    `${this.CACHE_PREFIX}org:${event.organizationId}`,
                    `${this.CACHE_PREFIX}organizer:${event.organizerId}`,
                    ...venueIds.map(venueId => `${this.CACHE_PREFIX}venue:${venueId}`),
                ]);
                return { success: true, message: "Venues removed successfully." };
            }
            catch (error) {
                console.error("Error removing venues:", error);
                return { success: false, message: "Failed to remove venues." };
            }
        });
    }
    /**
     * Creates multiple events from an array of event data.
     * @param eventsData Partial<EventInterface>[] - Array of event data.
     * @returns {Promise<{success: boolean; events: Event[]; errors: any[]}>} - Result object with success status, created events, and errors.
     */
    static createMultiple(eventsData) {
        return __awaiter(this, void 0, void 0, function* () {
            const events = [];
            const errors = [];
            for (const data of eventsData) {
                try {
                    const createResult = yield this.create(data);
                    if (!createResult.success || !createResult.data) {
                        errors.push({ data, message: createResult.message });
                        continue;
                    }
                    const saveResult = yield this.save(createResult.data);
                    if (saveResult.success && saveResult.data) {
                        events.push(saveResult.data);
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
            // Invalidate cache for all events
            yield CacheService_1.CacheService.invalidate(`${this.CACHE_PREFIX}all`);
            return {
                success: errors.length === 0,
                events,
                errors,
            };
        });
    }
}
exports.EventRepository = EventRepository;
EventRepository.CACHE_PREFIX = 'event:';
EventRepository.CACHE_TTL = 1800; // 30 minutes, due to frequent updates
