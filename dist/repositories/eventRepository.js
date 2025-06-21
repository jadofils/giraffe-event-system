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
const Event_1 = require("../models/Event");
const Venue_1 = require("../models/Venue");
const VenueBooking_1 = require("../models/VenueBooking");
const CacheService_1 = require("../services/CacheService");
const Index_1 = require("../interfaces/Index");
const typeorm_1 = require("typeorm");
const VenueBooking_2 = require("../models/VenueBooking");
const User_1 = require("../models/User");
class EventRepository {
    static create(data) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                if (!data.eventTitle || !data.eventType || !data.organizerId || !data.organizationId || !data.startDate || !data.endDate) {
                    return { success: false, message: "Missing required fields: eventTitle, eventType, organizerId, organizationId, startDate, endDate" };
                }
                const eventTypeMap = {
                    public: Index_1.EventType.PUBLIC,
                    private: Index_1.EventType.PRIVATE,
                };
                const mappedEventType = eventTypeMap[data.eventType.toLowerCase()];
                if (!mappedEventType) {
                    return { success: false, message: "Invalid event type" };
                }
                const eventStatusMap = {
                    pending: Index_1.EventStatus.PENDING,
                    approved: Index_1.EventStatus.APPROVED,
                    cancelled: Index_1.EventStatus.CANCELLED,
                    completed: Index_1.EventStatus.COMPLETED,
                };
                const mappedStatus = data.status ? eventStatusMap[data.status.toLowerCase()] : Index_1.EventStatus.PENDING;
                if (data.status && !mappedStatus) {
                    return { success: false, message: "Invalid event status" };
                }
                const event = new Event_1.Event();
                event.eventTitle = data.eventTitle;
                event.eventType = mappedEventType;
                event.organizerId = data.organizerId;
                event.organizationId = data.organizationId;
                event.startDate = new Date(data.startDate);
                event.endDate = new Date(data.endDate);
                event.startTime = data.startTime || '';
                event.endTime = data.endTime || '';
                event.description = data.description;
                event.maxAttendees = data.maxAttendees;
                event.status = mappedStatus;
                event.isFeatured = data.isFeatured || false;
                event.qrCode = data.qrCode;
                event.imageURL = data.imageURL;
                if (data.venues && Array.isArray(data.venues)) {
                    const venueIds = data.venues.map((v) => v.venueId).filter(Boolean);
                    if (venueIds.length > 0) {
                        const venues = yield Database_1.AppDataSource.getRepository(Venue_1.Venue).find({ where: { venueId: (0, typeorm_1.In)(venueIds) } });
                        if (venues.length !== venueIds.length) {
                            return { success: false, message: "One or more venues not found" };
                        }
                        event.venues = venues;
                    }
                }
                if (data.venueBookings && Array.isArray(data.venueBookings)) {
                    const bookingIds = data.venueBookings.map((b) => b.bookingId).filter(Boolean);
                    if (bookingIds.length > 0) {
                        const bookings = yield Database_1.AppDataSource.getRepository(VenueBooking_1.VenueBooking).find({ where: { bookingId: (0, typeorm_1.In)(bookingIds) } });
                        if (bookings.length !== bookingIds.length) {
                            return { success: false, message: "One or more venue bookings not found" };
                        }
                        event.venueBookings = bookings;
                    }
                }
                return { success: true, data: event };
            }
            catch (error) {
                console.error("Error creating event:", error);
                return { success: false, message: "Failed to create event" };
            }
        });
    }
    static save(event) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const savedEvent = yield Database_1.AppDataSource.getRepository(Event_1.Event).save(event);
                yield CacheService_1.CacheService.invalidateMultiple([
                    `${this.CACHE_PREFIX}all`,
                    `${this.CACHE_PREFIX}${savedEvent.eventId}`,
                    `${this.CACHE_PREFIX}org:${savedEvent.organizationId}`,
                    `${this.CACHE_PREFIX}organizer:${savedEvent.organizerId}`,
                    `${this.CACHE_PREFIX}${savedEvent.eventId}:venues`,
                    `${this.CACHE_PREFIX}${savedEvent.eventId}:bookings`,
                ]);
                return { success: true, data: savedEvent, message: "Event saved successfully" };
            }
            catch (error) {
                console.error("Error saving event:", error);
                return { success: false, message: "Failed to save event" };
            }
        });
    }
    static getById(id) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!id) {
                return { success: false, message: "Event ID is required" };
            }
            const cacheKey = `${this.CACHE_PREFIX}${id}`;
            try {
                const event = yield CacheService_1.CacheService.getOrSetSingle(cacheKey, Database_1.AppDataSource.getRepository(Event_1.Event), () => __awaiter(this, void 0, void 0, function* () {
                    return yield Database_1.AppDataSource.getRepository(Event_1.Event).findOne({
                        where: { eventId: id },
                        relations: ["organizer", "organizer.role", "venues", "venueBookings", "organization"],
                    });
                }), this.CACHE_TTL);
                if (!event) {
                    return { success: false, message: "Event not found" };
                }
                return { success: true, data: event };
            }
            catch (error) {
                console.error("Error fetching event by ID:", error);
                return { success: false, message: "Failed to fetch event" };
            }
        });
    }
    static getAll() {
        return __awaiter(this, void 0, void 0, function* () {
            const cacheKey = `${this.CACHE_PREFIX}all`;
            try {
                const events = yield CacheService_1.CacheService.getOrSetMultiple(cacheKey, Database_1.AppDataSource.getRepository(Event_1.Event), () => __awaiter(this, void 0, void 0, function* () {
                    return yield Database_1.AppDataSource.getRepository(Event_1.Event).find({
                        relations: ["organizer", "organizer.role", "venues", "venueBookings", "organization"],
                        order: { startDate: "ASC" },
                    });
                }), this.CACHE_TTL);
                return { success: true, data: events };
            }
            catch (error) {
                console.error("Error fetching all events:", error);
                return { success: false, message: "Failed to fetch events" };
            }
        });
    }
    static getByOrganizerId(organizerId) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!organizerId) {
                return { success: false, message: "Organizer ID is required" };
            }
            const cacheKey = `${this.CACHE_PREFIX}organizer:${organizerId}`;
            try {
                const events = yield CacheService_1.CacheService.getOrSetMultiple(cacheKey, Database_1.AppDataSource.getRepository(Event_1.Event), () => __awaiter(this, void 0, void 0, function* () {
                    return yield Database_1.AppDataSource.getRepository(Event_1.Event).find({
                        where: { organizerId },
                        relations: ["organizer", "organizer.role", "venues", "venueBookings", "organization"],
                        order: { startDate: "ASC" },
                    });
                }), this.CACHE_TTL);
                if (events.length === 0) {
                    return { success: false, message: "No events found for this organizer" };
                }
                return { success: true, data: events };
            }
            catch (error) {
                console.error("Error fetching events by organizer:", error);
                return { success: false, message: "Failed to fetch events" };
            }
        });
    }
    static getByOrganizationId(organizationId) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!organizationId) {
                return { success: false, message: "Organization ID is required" };
            }
            const cacheKey = `${this.CACHE_PREFIX}org:${organizationId}`;
            try {
                const events = yield CacheService_1.CacheService.getOrSetMultiple(cacheKey, Database_1.AppDataSource.getRepository(Event_1.Event), () => __awaiter(this, void 0, void 0, function* () {
                    return yield Database_1.AppDataSource.getRepository(Event_1.Event).find({
                        where: { organizationId },
                        relations: ["organizer", "organizer.role", "venues", "venueBookings", "organization"],
                        order: { startDate: "ASC" },
                    });
                }), this.CACHE_TTL);
                if (events.length === 0) {
                    return { success: false, message: "No events found for this organization" };
                }
                return { success: true, data: events };
            }
            catch (error) {
                console.error("Error fetching events by organization:", error);
                return { success: false, message: "Failed to fetch events" };
            }
        });
    }
    static getByVenueId(venueId) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!venueId) {
                return { success: false, message: "Venue ID is required" };
            }
            const cacheKey = `${this.CACHE_PREFIX}venue:${venueId}`;
            try {
                const events = yield CacheService_1.CacheService.getOrSetMultiple(cacheKey, Database_1.AppDataSource.getRepository(Event_1.Event), () => __awaiter(this, void 0, void 0, function* () {
                    return yield Database_1.AppDataSource.getRepository(Event_1.Event).createQueryBuilder("event")
                        .leftJoinAndSelect("event.venues", "venue")
                        .leftJoinAndSelect("event.organizer", "organizer")
                        .leftJoinAndSelect("organizer.role", "role")
                        .leftJoinAndSelect("event.organization", "organization")
                        .leftJoinAndSelect("event.venueBookings", "venueBookings")
                        .where("venue.venueId = :venueId", { venueId })
                        .orderBy("event.startDate", "ASC")
                        .getMany();
                }), this.CACHE_TTL);
                if (events.length === 0) {
                    return { success: false, message: "No events found for this venue" };
                }
                return { success: true, data: events };
            }
            catch (error) {
                console.error("Error fetching events by venue:", error);
                return { success: false, message: "Failed to fetch events" };
            }
        });
    }
    static getByStatus(status) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!status) {
                return { success: false, message: "Event status is required" };
            }
            const cacheKey = `${this.CACHE_PREFIX}status:${status}`;
            try {
                const events = yield CacheService_1.CacheService.getOrSetMultiple(cacheKey, Database_1.AppDataSource.getRepository(Event_1.Event), () => __awaiter(this, void 0, void 0, function* () {
                    return yield Database_1.AppDataSource.getRepository(Event_1.Event).find({
                        where: { status },
                        relations: ["organizer", "organizer.role", "venues", "venueBookings", "organization"],
                        order: { startDate: "ASC" },
                    });
                }), this.CACHE_TTL);
                if (events.length === 0) {
                    return { success: false, message: `No events found with status ${status}` };
                }
                return { success: true, data: events };
            }
            catch (error) {
                console.error("Error fetching events by status:", error);
                return { success: false, message: "Failed to fetch events" };
            }
        });
    }
    static getByDateRange(startDate, endDate) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!startDate || !endDate) {
                return { success: false, message: "Start and end dates are required" };
            }
            const cacheKey = `${this.CACHE_PREFIX}date:${startDate.toISOString()}:${endDate.toISOString()}`;
            try {
                const events = yield CacheService_1.CacheService.getOrSetMultiple(cacheKey, Database_1.AppDataSource.getRepository(Event_1.Event), () => __awaiter(this, void 0, void 0, function* () {
                    return yield Database_1.AppDataSource.getRepository(Event_1.Event).find({
                        where: { startDate: (0, typeorm_1.Between)(startDate, endDate) },
                        relations: ["organizer", "organizer.role", "venues", "venueBookings", "organization"],
                        order: { startDate: "ASC" },
                    });
                }), this.CACHE_TTL);
                if (events.length === 0) {
                    return { success: false, message: "No events found in date range" };
                }
                return { success: true, data: events };
            }
            catch (error) {
                console.error("Error fetching events by date range:", error);
                return { success: false, message: "Failed to fetch events" };
            }
        });
    }
    static update(id, data) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
            if (!id) {
                return { success: false, message: "Event ID is required" };
            }
            try {
                const repo = Database_1.AppDataSource.getRepository(Event_1.Event);
                const event = yield repo.findOne({ where: { eventId: id }, relations: ["venues", "venueBookings"] });
                if (!event) {
                    return { success: false, message: "Event not found" };
                }
                let updatedEventType = event.eventType;
                if (data.eventType) {
                    const eventTypeMap = {
                        public: Index_1.EventType.PUBLIC,
                        private: Index_1.EventType.PRIVATE,
                    };
                    updatedEventType = eventTypeMap[data.eventType.toLowerCase()];
                    if (!updatedEventType) {
                        return { success: false, message: "Invalid event type" };
                    }
                }
                let updatedStatus = event.status;
                if (data.status) {
                    const eventStatusMap = {
                        pending: Index_1.EventStatus.PENDING,
                        approved: Index_1.EventStatus.APPROVED,
                        cancelled: Index_1.EventStatus.CANCELLED,
                        completed: Index_1.EventStatus.COMPLETED,
                    };
                    updatedStatus = eventStatusMap[data.status.toLowerCase()];
                    if (!updatedStatus) {
                        return { success: false, message: "Invalid event status" };
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
                    maxAttendees: (_g = data.maxAttendees) !== null && _g !== void 0 ? _g : event.maxAttendees,
                    status: updatedStatus,
                    isFeatured: (_h = data.isFeatured) !== null && _h !== void 0 ? _h : event.isFeatured,
                    qrCode: (_j = data.qrCode) !== null && _j !== void 0 ? _j : event.qrCode,
                    imageURL: (_k = data.imageURL) !== null && _k !== void 0 ? _k : event.imageURL,
                });
                if (data.venues && Array.isArray(data.venues)) {
                    const venueIds = data.venues.map((v) => v.venueId).filter(Boolean);
                    const venues = venueIds.length > 0
                        ? yield Database_1.AppDataSource.getRepository(Venue_1.Venue).find({ where: { venueId: (0, typeorm_1.In)(venueIds) } })
                        : [];
                    if (venueIds.length > 0 && venues.length !== venueIds.length) {
                        return { success: false, message: "One or more venues not found" };
                    }
                    event.venues = venues;
                }
                if (data.venueBookings && Array.isArray(data.venueBookings)) {
                    const bookingIds = data.venueBookings.map((b) => b.bookingId).filter(Boolean);
                    const bookings = bookingIds.length > 0
                        ? yield Database_1.AppDataSource.getRepository(VenueBooking_1.VenueBooking).find({ where: { bookingId: (0, typeorm_1.In)(bookingIds) } })
                        : [];
                    if (bookingIds.length > 0 && bookings.length !== bookingIds.length) {
                        return { success: false, message: "One or more venue bookings not found" };
                    }
                    event.venueBookings = bookings;
                }
                const updatedEvent = yield repo.save(event);
                yield CacheService_1.CacheService.invalidateMultiple([
                    `${this.CACHE_PREFIX}all`,
                    `${this.CACHE_PREFIX}${id}`,
                    `${this.CACHE_PREFIX}org:${updatedEvent.organizationId}`,
                    `${this.CACHE_PREFIX}organizer:${updatedEvent.organizerId}`,
                    `${this.CACHE_PREFIX}${id}:venues`,
                    `${this.CACHE_PREFIX}${id}:bookings`,
                ]);
                return { success: true, data: updatedEvent, message: "Event updated successfully" };
            }
            catch (error) {
                console.error("Error updating event:", error);
                return { success: false, message: "Failed to update event" };
            }
        });
    }
    static delete(id) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!id) {
                return { success: false, message: "Event ID is required" };
            }
            try {
                const repo = Database_1.AppDataSource.getRepository(Event_1.Event);
                const event = yield repo.findOne({ where: { eventId: id } });
                if (!event) {
                    return { success: false, message: "Event not found" };
                }
                yield repo.softRemove(event);
                yield CacheService_1.CacheService.invalidateMultiple([
                    `${this.CACHE_PREFIX}all`,
                    `${this.CACHE_PREFIX}${id}`,
                    `${this.CACHE_PREFIX}org:${event.organizationId}`,
                    `${this.CACHE_PREFIX}organizer:${event.organizerId}`,
                    `${this.CACHE_PREFIX}${id}:venues`,
                    `${this.CACHE_PREFIX}${id}:bookings`,
                ]);
                return { success: true, message: "Event deleted successfully" };
            }
            catch (error) {
                console.error("Error deleting event:", error);
                return { success: false, message: "Failed to delete event" };
            }
        });
    }
    static assignVenues(eventId, venueIds) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!eventId || !venueIds || !Array.isArray(venueIds) || venueIds.length === 0) {
                return { success: false, message: "Event ID and valid venue IDs are required" };
            }
            try {
                const repo = Database_1.AppDataSource.getRepository(Event_1.Event);
                const event = yield repo.findOne({ where: { eventId }, relations: ["venues"] });
                if (!event) {
                    return { success: false, message: "Event not found" };
                }
                const venues = yield Database_1.AppDataSource.getRepository(Venue_1.Venue).find({ where: { venueId: (0, typeorm_1.In)(venueIds) } });
                if (venues.length !== venueIds.length) {
                    return { success: false, message: "One or more venues not found" };
                }
                event.venues = venues;
                yield repo.save(event);
                yield CacheService_1.CacheService.invalidateMultiple([
                    `${this.CACHE_PREFIX}${eventId}`,
                    `${this.CACHE_PREFIX}${eventId}:venues`,
                    `${this.CACHE_PREFIX}all`,
                    `${this.CACHE_PREFIX}org:${event.organizationId}`,
                    `${this.CACHE_PREFIX}organizer:${event.organizerId}`,
                    ...venueIds.map(id => `${this.CACHE_PREFIX}venue:${id}`),
                ]);
                return { success: true, message: "Venues assigned successfully" };
            }
            catch (error) {
                console.error("Error assigning venues:", error);
                return { success: false, message: "Failed to assign venues" };
            }
        });
    }
    static removeVenues(eventId, venueIds) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!eventId || !venueIds || !Array.isArray(venueIds) || venueIds.length === 0) {
                return { success: false, message: "Event ID and valid venue IDs are required" };
            }
            try {
                const repo = Database_1.AppDataSource.getRepository(Event_1.Event);
                const event = yield repo.findOne({ where: { eventId }, relations: ["venues"] });
                if (!event) {
                    return { success: false, message: "Event not found" };
                }
                event.venues = event.venues.filter(venue => !venueIds.includes(venue.venueId));
                yield repo.save(event);
                yield CacheService_1.CacheService.invalidateMultiple([
                    `${this.CACHE_PREFIX}${eventId}`,
                    `${this.CACHE_PREFIX}${eventId}:venues`,
                    `${this.CACHE_PREFIX}all`,
                    `${this.CACHE_PREFIX}org:${event.organizationId}`,
                    `${this.CACHE_PREFIX}organizer:${event.organizerId}`,
                    ...venueIds.map(id => `${this.CACHE_PREFIX}venue:${id}`),
                ]);
                return { success: true, message: "Venues removed successfully" };
            }
            catch (error) {
                console.error("Error removing venues:", error);
                return { success: false, message: "Failed to remove venues" };
            }
        });
    }
    static assignVenueBookings(eventId, bookingIds) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!eventId || !bookingIds || !Array.isArray(bookingIds) || bookingIds.length === 0) {
                return { success: false, message: "Event ID and valid booking IDs are required" };
            }
            try {
                const repo = Database_1.AppDataSource.getRepository(Event_1.Event);
                const event = yield repo.findOne({ where: { eventId }, relations: ["venueBookings"] });
                if (!event) {
                    return { success: false, message: "Event not found" };
                }
                const bookings = yield Database_1.AppDataSource.getRepository(VenueBooking_1.VenueBooking).find({ where: { bookingId: (0, typeorm_1.In)(bookingIds) } });
                if (bookings.length !== bookingIds.length) {
                    return { success: false, message: "One or more venue bookings not found" };
                }
                event.venueBookings = bookings;
                yield repo.save(event);
                yield CacheService_1.CacheService.invalidateMultiple([
                    `${this.CACHE_PREFIX}${eventId}`,
                    `${this.CACHE_PREFIX}${eventId}:bookings`,
                    `${this.CACHE_PREFIX}all`,
                    `${this.CACHE_PREFIX}org:${event.organizationId}`,
                    `${this.CACHE_PREFIX}organizer:${event.organizerId}`,
                    ...bookingIds.map(id => `${this.CACHE_PREFIX}booking:${id}`),
                ]);
                return { success: true, message: "Venue bookings assigned successfully" };
            }
            catch (error) {
                console.error("Error assigning venue bookings:", error);
                return { success: false, message: "Failed to assign venue bookings" };
            }
        });
    }
    static removeVenueBookings(eventId, bookingIds) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!eventId || !bookingIds || !Array.isArray(bookingIds) || bookingIds.length === 0) {
                return { success: false, message: "Event ID and valid booking IDs are required" };
            }
            try {
                const repo = Database_1.AppDataSource.getRepository(Event_1.Event);
                const event = yield repo.findOne({ where: { eventId }, relations: ["venueBookings"] });
                if (!event) {
                    return { success: false, message: "Event not found" };
                }
                event.venueBookings = event.venueBookings.filter(booking => !bookingIds.includes(booking.bookingId));
                yield repo.save(event);
                yield CacheService_1.CacheService.invalidateMultiple([
                    `${this.CACHE_PREFIX}${eventId}`,
                    `${this.CACHE_PREFIX}${eventId}:bookings`,
                    `${this.CACHE_PREFIX}all`,
                    `${this.CACHE_PREFIX}org:${event.organizationId}`,
                    `${this.CACHE_PREFIX}organizer:${event.organizerId}`,
                    ...bookingIds.map(id => `${this.CACHE_PREFIX}booking:${id}`),
                ]);
                return { success: true, message: "Venue bookings removed successfully" };
            }
            catch (error) {
                console.error("Error removing venue bookings:", error);
                return { success: false, message: "Failed to remove venue bookings" };
            }
        });
    }
    static bulkCreateVenueBookings(bookings, userId, eventId, organizationId) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            try {
                const bookingRepo = Database_1.AppDataSource.getRepository(VenueBooking_1.VenueBooking);
                const venueRepo = Database_1.AppDataSource.getRepository(Venue_1.Venue);
                const eventRepo = Database_1.AppDataSource.getRepository(Event_1.Event);
                const userRepo = Database_1.AppDataSource.getRepository(User_1.User);
                if (!organizationId) {
                    return { success: false, message: "Organization ID is required" };
                }
                // Check user membership in organization
                const user = yield userRepo.findOne({
                    where: { userId },
                    relations: ["organizations"]
                });
                if (!user) {
                    return { success: false, message: `User ${userId} not found` };
                }
                const userOrgIds = user.organizations.map(org => org.organizationId);
                if (!userOrgIds.includes(organizationId)) {
                    return { success: false, message: "You are not a member of this organization" };
                }
                // Fetch the event to get its time window
                const event = yield eventRepo.findOne({ where: { eventId } });
                if (!event) {
                    return { success: false, message: `Event ${eventId} not found` };
                }
                const eventStart = new Date(event.startDate).getTime();
                const eventEnd = new Date(event.endDate).getTime();
                // Fetch all venues for the organization
                const orgVenues = yield venueRepo.find({
                    where: { organization: { organizationId } },
                    relations: ["bookings", "bookings.event"]
                });
                const orgVenueIds = orgVenues.map(v => v.venueId);
                // Filter requested venueIds to only those in the organization
                const requestedVenueIds = bookings.map(b => b.venueId);
                const validVenueIds = requestedVenueIds.filter(id => orgVenueIds.includes(id));
                if (validVenueIds.length === 0) {
                    return { success: false, message: "No valid venues found in the selected organization" };
                }
                // Check for conflicts for each venue using event's time window
                const conflictingVenues = [];
                for (const venue of orgVenues) {
                    if (!validVenueIds.includes(venue.venueId))
                        continue;
                    for (const booking of venue.bookings || []) {
                        for (const event of booking.events || []) {
                            if (!event.startDate || !event.endDate)
                                continue;
                            // Only consider events with APPROVED or COMPLETED status
                            if (["APPROVED", "COMPLETED"].includes(event.status)) {
                                const existingStart = new Date(event.startDate).getTime();
                                const existingEnd = new Date(event.endDate).getTime();
                                // Check time conflict
                                if (existingStart < eventEnd && eventStart < existingEnd) {
                                    conflictingVenues.push(venue.venueId);
                                    break;
                                }
                            }
                        }
                        if (conflictingVenues.includes(venue.venueId))
                            break; // Exit early if conflict found
                    }
                }
                if (conflictingVenues.length > 0) {
                    return { success: false, message: `Venues with IDs [${conflictingVenues.join(", ")}] are already booked for the requested time.` };
                }
                // Create bookings for valid venues, all with status PENDING
                const validBookings = [];
                for (const data of bookings) {
                    if (!validVenueIds.includes(data.venueId))
                        continue;
                    const venue = orgVenues.find(v => v.venueId === data.venueId);
                    if (!venue)
                        continue;
                    const booking = new VenueBooking_1.VenueBooking();
                    booking.venueId = data.venueId;
                    booking.userId = userId;
                    booking.organizationId = organizationId;
                    booking.eventId = eventId;
                    booking.totalAmountDue = (_b = (_a = data.totalAmountDue) !== null && _a !== void 0 ? _a : venue.amount) !== null && _b !== void 0 ? _b : 0;
                    booking.venueInvoiceId = data.venueInvoiceId;
                    booking.approvalStatus = VenueBooking_2.ApprovalStatus.PENDING;
                    booking.venue = venue;
                    validBookings.push(booking);
                }
                const saved = yield bookingRepo.save(validBookings);
                return { success: true, data: saved };
            }
            catch (error) {
                console.error("Bulk booking failed:", error);
                return { success: false, message: `Failed to save bookings: ${error instanceof Error ? error.message : "Unknown error"}` };
            }
        });
    }
    static getVenueBookingById(bookingId) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!bookingId) {
                return { success: false, message: "Booking ID is required" };
            }
            const cacheKey = `${this.CACHE_PREFIX}booking:${bookingId}`;
            try {
                const booking = yield CacheService_1.CacheService.getOrSetSingle(cacheKey, Database_1.AppDataSource.getRepository(VenueBooking_1.VenueBooking), () => __awaiter(this, void 0, void 0, function* () {
                    return yield Database_1.AppDataSource.getRepository(VenueBooking_1.VenueBooking).findOne({
                        where: { bookingId },
                        relations: ["venue", "user", "organization", "venueInvoice", "events"],
                    });
                }), this.CACHE_TTL);
                if (!booking) {
                    return { success: false, message: "Venue booking not found" };
                }
                return { success: true, data: booking };
            }
            catch (error) {
                console.error("Error fetching venue booking:", error);
                return { success: false, message: "Failed to fetch venue booking" };
            }
        });
    }
    static updateVenueBooking(bookingId, data) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d, _e, _f;
            if (!bookingId) {
                return { success: false, message: "Booking ID is required" };
            }
            try {
                const repo = Database_1.AppDataSource.getRepository(VenueBooking_1.VenueBooking);
                const booking = yield repo.findOne({ where: { bookingId }, relations: ["events"] });
                if (!booking) {
                    return { success: false, message: "Venue booking not found" };
                }
                repo.merge(booking, {
                    venueId: (_a = data.venueId) !== null && _a !== void 0 ? _a : booking.venueId,
                    userId: (_b = data.userId) !== null && _b !== void 0 ? _b : booking.userId,
                    organizationId: (_c = data.organizationId) !== null && _c !== void 0 ? _c : booking.organizationId,
                    totalAmountDue: (_d = data.totalAmountDue) !== null && _d !== void 0 ? _d : booking.totalAmountDue,
                    venueInvoiceId: (_e = data.venueInvoiceId) !== null && _e !== void 0 ? _e : booking.venueInvoiceId,
                    approvalStatus: (_f = data.approvalStatus) !== null && _f !== void 0 ? _f : VenueBooking_2.ApprovalStatus.PENDING,
                });
                const updatedBooking = yield repo.save(booking);
                yield CacheService_1.CacheService.invalidateMultiple([
                    `${this.CACHE_PREFIX}booking:${bookingId}`,
                    ...booking.events.map(event => `${this.CACHE_PREFIX}${event.eventId}:bookings`),
                ]);
                return { success: true, data: updatedBooking, message: "Venue booking updated successfully" };
            }
            catch (error) {
                console.error("Error updating venue booking:", error);
                return { success: false, message: "Failed to update venue booking" };
            }
        });
    }
    static deleteVenueBooking(bookingId) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!bookingId) {
                return { success: false, message: "Booking ID is required" };
            }
            try {
                const repo = Database_1.AppDataSource.getRepository(VenueBooking_1.VenueBooking);
                const booking = yield repo.findOne({ where: { bookingId }, relations: ["events"] });
                if (!booking) {
                    return { success: false, message: "Venue booking not found" };
                }
                yield repo.softRemove(booking);
                yield CacheService_1.CacheService.invalidateMultiple([
                    `${this.CACHE_PREFIX}booking:${bookingId}`,
                    ...booking.events.map(event => `${this.CACHE_PREFIX}${event.eventId}:bookings`),
                ]);
                return { success: true, message: "Venue booking deleted successfully" };
            }
            catch (error) {
                console.error("Error deleting venue booking:", error);
                return { success: false, message: "Failed to delete venue booking" };
            }
        });
    }
}
exports.EventRepository = EventRepository;
EventRepository.CACHE_PREFIX = 'event:';
EventRepository.CACHE_TTL = 1800; // 30 minutes in seconds
