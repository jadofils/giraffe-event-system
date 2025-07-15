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
exports.EventController = void 0;
const EventStatusEnum_1 = require("../interfaces/Enums/EventStatusEnum");
const VenueBooking_1 = require("../models/VenueBooking");
const eventRepository_1 = require("../repositories/eventRepository");
const Database_1 = require("../config/Database");
const Venue_1 = require("../models/Venue Tables/Venue");
const typeorm_1 = require("typeorm");
const constants_1 = require("../utils/constants");
const InvoiceService_1 = require("../services/invoice/InvoiceService");
const InvoiceStatus_1 = require("../interfaces/Enums/InvoiceStatus");
const Venue_2 = require("../models/Venue Tables/Venue");
class EventController {
    static createEvent(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                // Validate authentication
                if (!req.user || !req.user.userId || !req.user.organizationId) {
                    res.status(401).json({
                        success: false,
                        message: "Unauthorized: User is not properly authenticated.",
                    });
                    return;
                }
                // Validate UUID format for organizationId and organizerId
                if (!constants_1.UUID_REGEX.test(req.user.organizationId)) {
                    res.status(400).json({
                        success: false,
                        message: "Invalid organization ID format in token.",
                    });
                    return;
                }
                if (!constants_1.UUID_REGEX.test(req.user.userId)) {
                    res.status(400).json({
                        success: false,
                        message: "Invalid user ID format in token.",
                    });
                    return;
                }
                // --- Conflict check before creating event ---
                const bookingRepo = Database_1.AppDataSource.getRepository(VenueBooking_1.VenueBooking);
                const { venues, startDate, endDate } = req.body;
                if (!venues || !Array.isArray(venues) || !startDate || !endDate) {
                    res.status(400).json({
                        success: false,
                        message: "venues, startDate, and endDate are required for conflict check.",
                    });
                    return;
                }
                for (const venueId of venues) {
                    const conflicts = yield bookingRepo
                        .createQueryBuilder("booking")
                        .leftJoin("booking.event", "event")
                        .where("booking.venueId = :venueId", { venueId })
                        .andWhere("booking.approvalStatus = :bookingStatus", {
                        bookingStatus: VenueBooking_1.ApprovalStatus.APPROVED,
                    })
                        .andWhere("event.status = :eventStatus", { eventStatus: "APPROVED" })
                        .andWhere("(event.startDate <= :endDate AND event.endDate >= :startDate)", { startDate, endDate })
                        .getCount();
                    if (conflicts > 0) {
                        res.status(409).json({
                            success: false,
                            message: `Venue ${venueId} is already booked for an approved event on the same date(s).`,
                            venueId,
                        });
                        return;
                    }
                }
                // --- End conflict check ---
                const eventData = Object.assign(Object.assign({}, req.body), { organizerId: req.user.userId, status: EventStatusEnum_1.EventStatus.PENDING });
                // Create event with organizationId from token
                const createResult = yield eventRepository_1.EventRepository.create(eventData, req.user.organizationId);
                if (!createResult.success || !createResult.data) {
                    res.status(400).json({ success: false, message: createResult.message });
                    return;
                }
                // Return the full event and venues
                res.status(201).json({
                    success: true,
                    data: {
                        event: createResult.data.event, // full event object
                        venues: (_a = createResult.data.venues) === null || _a === void 0 ? void 0 : _a.map(sanitizeVenue),
                    },
                    message: "Event and venues associated successfully.",
                });
            }
            catch (error) {
                console.error("Error in createEvent:", error);
                next(error);
            }
        });
    }
    static approveEvent(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { id } = req.params;
                // Fetch event with all relations needed
                const eventResult = yield eventRepository_1.EventRepository.getById(id);
                if (!eventResult.success || !eventResult.data) {
                    res.status(404).json({ message: eventResult.message });
                    return;
                }
                // Approve the event
                const updateResult = yield eventRepository_1.EventRepository.update(id, {
                    status: EventStatusEnum_1.EventStatus.APPROVED,
                });
                if (!updateResult.success || !updateResult.data) {
                    res.status(500).json({ message: updateResult.message });
                    return;
                }
                // Refetch event with all relations (including venueBookings, venues, organizer, organization)
                const event = (yield eventRepository_1.EventRepository.getById(id)).data;
                // === REJECT/CANCEL CONFLICTING PENDING EVENTS ===
                const { rejectConflictingPendingEvents } = yield Promise.resolve().then(() => __importStar(require("../middlewares/rejectConflictingPendingEvents")));
                yield rejectConflictingPendingEvents(event);
                // Eager-load venueBookings with venue, user, organization, and venue.organization
                const bookings = yield Database_1.AppDataSource.getRepository(VenueBooking_1.VenueBooking).find({
                    where: { eventId: id },
                    relations: ["venue", "venue.organization", "user", "organization"],
                });
                // Approve all venue bookings for this event
                for (const booking of bookings) {
                    if (booking.approvalStatus !== VenueBooking_1.ApprovalStatus.APPROVED) {
                        booking.approvalStatus = VenueBooking_1.ApprovalStatus.APPROVED;
                        yield Database_1.AppDataSource.getRepository(VenueBooking_1.VenueBooking).save(booking);
                    }
                }
                // Approve all venues for this event
                if (event.venues && event.venues.length > 0) {
                    const venueRepo = Database_1.AppDataSource.getRepository("Venue");
                    for (const venue of event.venues) {
                        const dbVenue = yield venueRepo.findOne({
                            where: { venueId: venue.venueId },
                        });
                        if (dbVenue && dbVenue.status !== Venue_2.VenueStatus.APPROVED) {
                            dbVenue.status = Venue_2.VenueStatus.APPROVED;
                            yield venueRepo.save(dbVenue);
                        }
                    }
                }
                // Create invoices for each booking (if not already invoiced)
                const invoices = [];
                for (const booking of bookings) {
                    // Only create invoice if not already linked
                    if (!booking.invoice) {
                        const invoice = yield InvoiceService_1.InvoiceService.createInvoice({
                            userId: booking.userId,
                            eventId: booking.eventId,
                            venueId: booking.venueId,
                            totalAmount: booking.totalAmountDue,
                            invoiceDate: new Date(),
                            dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
                            status: InvoiceStatus_1.InvoiceStatus.PENDING,
                        });
                        // Optionally, update booking to reference the invoice
                        booking.venueInvoiceId = invoice.invoiceId;
                        yield Database_1.AppDataSource.getRepository(VenueBooking_1.VenueBooking).save(booking);
                        // Attach details for response
                        invoices.push(Object.assign(Object.assign({}, invoice), { venue: {
                                venueId: booking.venue.venueId,
                                venueName: booking.venue.venueName,
                                amount: booking.venue.venueVariables,
                                location: booking.venue.venueLocation,
                                organization: booking.venue.organization
                                    ? {
                                        organizationId: booking.venue.organization.organizationId,
                                        organizationName: booking.venue.organization.organizationName,
                                        contactEmail: booking.venue.organization.contactEmail,
                                        contactPhone: booking.venue.organization.contactPhone,
                                    }
                                    : null,
                            }, requester: booking.user
                                ? {
                                    userId: booking.user.userId,
                                    username: booking.user.username,
                                    firstName: booking.user.firstName,
                                    lastName: booking.user.lastName,
                                    email: booking.user.email,
                                    phoneNumber: booking.user.phoneNumber,
                                }
                                : null, bookingOrganization: booking.organization
                                ? {
                                    organizationId: booking.organization.organizationId,
                                    organizationName: booking.organization.organizationName,
                                    contactEmail: booking.organization.contactEmail,
                                    contactPhone: booking.organization.contactPhone,
                                }
                                : null }));
                    }
                }
                res.status(200).json({
                    success: true,
                    message: "Event approved and invoices generated.",
                    data: {
                        event: {
                            eventId: event.eventId,
                            eventTitle: event.eventTitle,
                            startDate: event.startDate,
                            endDate: event.endDate,
                            organizer: event.organizer,
                            organization: event.organization,
                        },
                        invoices,
                    },
                });
            }
            catch (error) {
                next(error);
            }
        });
    }
    static getEventById(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { id } = req.params;
                const result = yield eventRepository_1.EventRepository.getById(id);
                if (!result.success || !result.data) {
                    res.status(404).json({ message: result.message });
                    return;
                }
                res.json(result.data);
            }
            catch (error) {
                next(error);
            }
        });
    }
    static getAllEvents(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const result = yield eventRepository_1.EventRepository.getAll();
                if (!result.success || !result.data) {
                    res.status(500).json({ message: result.message });
                    return;
                }
                res.json(result.data);
            }
            catch (error) {
                next(error);
            }
        });
    }
    static updateEvent(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { id } = req.params;
                const eventData = Object.assign(Object.assign({}, req.body), { status: EventStatusEnum_1.EventStatus.PENDING });
                const updateResult = yield eventRepository_1.EventRepository.update(id, eventData);
                if (!updateResult.success || !updateResult.data) {
                    res.status(500).json({ message: updateResult.message });
                    return;
                }
                res.json(updateResult.data);
            }
            catch (error) {
                next(error);
            }
        });
    }
    static deleteEvent(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { id } = req.params;
                const result = yield eventRepository_1.EventRepository.delete(id);
                if (!result.success) {
                    res.status(500).json({ message: result.message });
                    return;
                }
                res.json({ message: "Event deleted" });
            }
            catch (error) {
                next(error);
            }
        });
    }
    static bulkCreateVenueBookings(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            try {
                const { organizationId, bookings } = req.body;
                const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.userId; // From AuthMiddleware
                const eventId = req.params.eventId;
                if (!userId) {
                    res.status(401).json({
                        success: false,
                        message: "Unauthorized: User ID not found in token",
                    });
                    return;
                }
                if (!organizationId) {
                    res
                        .status(400)
                        .json({ success: false, message: "organizationId is required" });
                    return;
                }
                if (!Array.isArray(bookings) || bookings.length === 0) {
                    res
                        .status(400)
                        .json({ success: false, message: "Booking array is required" });
                    return;
                }
                // Validate venues exist
                const venueRepo = Database_1.AppDataSource.getRepository(Venue_1.Venue);
                const venueIds = bookings.map((b) => b.venueId);
                const venues = yield venueRepo.find({
                    where: { venueId: (0, typeorm_1.In)(venueIds) },
                    relations: ["organization"],
                });
                if (venues.length !== bookings.length) {
                    res
                        .status(404)
                        .json({ success: false, message: "One or more venues not found" });
                    return;
                }
                const result = yield eventRepository_1.EventRepository.bulkCreateVenueBookings(bookings.map((b) => (Object.assign(Object.assign({}, b), { organizationId, approvalStatus: VenueBooking_1.ApprovalStatus.PENDING }))), userId, eventId, organizationId);
                if (!result.success) {
                    res.status(400).json({ success: false, message: result.message });
                    return;
                }
                // Format response with full venue data
                const formattedBookings = (_b = result.data) === null || _b === void 0 ? void 0 : _b.map((booking) => ({
                    bookingId: booking.bookingId,
                    venue: {
                        venueId: booking.venue.venueId,
                        venueName: booking.venue.venueName,
                        location: booking.venue.venueLocation,
                        capacity: booking.venue.capacity,
                        amount: booking.venue.venueVariables,
                        latitude: booking.venue.latitude,
                        longitude: booking.venue.longitude,
                        googleMapsLink: booking.venue.googleMapsLink,
                        managerId: booking.venue.venueVariables,
                        organizationId: booking.venue.organizationId,
                        amenities: booking.venue.amenities,
                        venueType: booking.venue.venueTypeId,
                        createdAt: booking.venue.createdAt,
                        updatedAt: booking.venue.updatedAt,
                        deletedAt: booking.venue.deletedAt,
                    },
                    eventId: booking.eventId,
                    userId: booking.userId,
                    organizationId: booking.organizationId,
                    totalAmountDue: booking.totalAmountDue,
                    venueInvoiceId: booking.venueInvoiceId,
                    approvalStatus: booking.approvalStatus,
                    notes: booking.notes,
                    createdAt: booking.createdAt,
                    updatedAt: booking.updatedAt,
                    deletedAt: booking.deletedAt,
                }));
                res.status(201).json({
                    success: true,
                    message: "Bookings created",
                    data: formattedBookings,
                });
            }
            catch (error) {
                console.error("Error in bulkCreateVenueBookings:", error);
                next(error);
            }
        });
    }
    static approveVenueBooking(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { bookingId } = req.params;
                const updateResult = yield eventRepository_1.EventRepository.updateVenueBooking(bookingId, {
                    approvalStatus: VenueBooking_1.ApprovalStatus.APPROVED,
                });
                if (!updateResult.success || !updateResult.data) {
                    res.status(500).json({ message: updateResult.message });
                    return;
                }
                res.json(updateResult.data);
            }
            catch (error) {
                next(error);
            }
        });
    }
    static getVenueBookings(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { eventId } = req.params;
                const eventResult = yield eventRepository_1.EventRepository.getById(eventId);
                if (!eventResult.success || !eventResult.data) {
                    res.status(404).json({ message: eventResult.message });
                    return;
                }
                res.json(eventResult.data.venueBookings || []);
            }
            catch (error) {
                next(error);
            }
        });
    }
    static updateVenueBooking(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { bookingId } = req.params;
                const bookingData = Object.assign(Object.assign({}, req.body), { approvalStatus: VenueBooking_1.ApprovalStatus.PENDING });
                const updateResult = yield eventRepository_1.EventRepository.updateVenueBooking(bookingId, bookingData);
                if (!updateResult.success || !updateResult.data) {
                    res.status(500).json({ message: updateResult.message });
                    return;
                }
                res.json(updateResult.data);
            }
            catch (error) {
                next(error);
            }
        });
    }
    static deleteVenueBooking(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { eventId, bookingId } = req.params;
                const removeResult = yield eventRepository_1.EventRepository.removeVenueBookings(eventId, [
                    bookingId,
                ]);
                if (!removeResult.success) {
                    res.status(500).json({ message: removeResult.message });
                    return;
                }
                const deleteResult = yield eventRepository_1.EventRepository.deleteVenueBooking(bookingId);
                if (!deleteResult.success) {
                    res.status(500).json({ message: deleteResult.message });
                    return;
                }
                res.json({ message: "Venue booking deleted" });
            }
            catch (error) {
                next(error);
            }
        });
    }
    static validate(data) {
        const errors = [];
        if (!data.eventId)
            errors.push("eventId is required");
        if (!data.venueId)
            errors.push("venueId is required");
        // organizerId is set from the token, not required in request body
        if (!data.organizationId)
            errors.push("organizationId is required");
        return errors;
    }
}
exports.EventController = EventController;
EventController.eventRepository = new eventRepository_1.EventRepository();
function sanitizeVenue(venue) {
    if (!venue)
        return venue;
    const { events } = venue, venueWithoutEvents = __rest(venue, ["events"]);
    return venueWithoutEvents;
}
function sanitizeEvent(event) {
    var _a;
    if (!event)
        return event;
    // Remove circular references for venues
    const sanitizedVenues = (_a = event.venues) === null || _a === void 0 ? void 0 : _a.map(sanitizeVenue);
    return Object.assign(Object.assign({}, event), { venues: sanitizedVenues });
}
