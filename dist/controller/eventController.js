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
exports.EventController = void 0;
const EventStatusEnum_1 = require("../interfaces/Enums/EventStatusEnum");
const VenueBooking_1 = require("../models/VenueBooking");
const eventRepository_1 = require("../repositories/eventRepository");
const Database_1 = require("../config/Database");
const Venue_1 = require("../models/Venue");
const typeorm_1 = require("typeorm");
class EventController {
    static createEvent(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const eventData = Object.assign(Object.assign({}, req.body), { status: EventStatusEnum_1.EventStatus.PENDING });
                const createResult = yield eventRepository_1.EventRepository.create(eventData);
                if (!createResult.success || !createResult.data) {
                    res.status(400).json({ message: createResult.message });
                    return;
                }
                const saveResult = yield eventRepository_1.EventRepository.save(createResult.data);
                if (!saveResult.success || !saveResult.data) {
                    res.status(500).json({ message: saveResult.message });
                    return;
                }
                res.status(201).json(saveResult.data);
            }
            catch (error) {
                next(error);
            }
        });
    }
    static approveEvent(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { id } = req.params;
                const eventResult = yield eventRepository_1.EventRepository.getById(id);
                if (!eventResult.success || !eventResult.data) {
                    res.status(404).json({ message: eventResult.message });
                    return;
                }
                const updateResult = yield eventRepository_1.EventRepository.update(id, { status: EventStatusEnum_1.EventStatus.APPROVED });
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
                res.json({ message: 'Event deleted' });
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
                    res.status(401).json({ success: false, message: "Unauthorized: User ID not found in token" });
                    return;
                }
                if (!organizationId) {
                    res.status(400).json({ success: false, message: "organizationId is required" });
                    return;
                }
                if (!Array.isArray(bookings) || bookings.length === 0) {
                    res.status(400).json({ success: false, message: "Booking array is required" });
                    return;
                }
                // Validate venues exist
                const venueRepo = Database_1.AppDataSource.getRepository(Venue_1.Venue);
                const venueIds = bookings.map(b => b.venueId);
                const venues = yield venueRepo.find({
                    where: { venueId: (0, typeorm_1.In)(venueIds) },
                    relations: ["organization"],
                });
                if (venues.length !== bookings.length) {
                    res.status(404).json({ success: false, message: "One or more venues not found" });
                    return;
                }
                const result = yield eventRepository_1.EventRepository.bulkCreateVenueBookings(bookings.map(b => (Object.assign(Object.assign({}, b), { organizationId, approvalStatus: VenueBooking_1.ApprovalStatus.PENDING }))), userId, eventId, organizationId);
                if (!result.success) {
                    res.status(400).json({ success: false, message: result.message });
                    return;
                }
                // Format response with full venue data
                const formattedBookings = (_b = result.data) === null || _b === void 0 ? void 0 : _b.map(booking => ({
                    bookingId: booking.bookingId,
                    venue: {
                        venueId: booking.venue.venueId,
                        venueName: booking.venue.venueName,
                        location: booking.venue.location,
                        capacity: booking.venue.capacity,
                        amount: booking.venue.amount,
                        latitude: booking.venue.latitude,
                        longitude: booking.venue.longitude,
                        googleMapsLink: booking.venue.googleMapsLink,
                        managerId: booking.venue.managerId,
                        organizationId: booking.venue.organizationId,
                        amenities: booking.venue.amenities,
                        venueType: booking.venue.venueType,
                        contactPerson: booking.venue.contactPerson,
                        contactEmail: booking.venue.contactEmail,
                        contactPhone: booking.venue.contactPhone,
                        websiteURL: booking.venue.websiteURL,
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
                res.status(201).json({ success: true, message: "Bookings created", data: formattedBookings });
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
                const updateResult = yield eventRepository_1.EventRepository.updateVenueBooking(bookingId, { approvalStatus: VenueBooking_1.ApprovalStatus.APPROVED });
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
                const removeResult = yield eventRepository_1.EventRepository.removeVenueBookings(eventId, [bookingId]);
                if (!removeResult.success) {
                    res.status(500).json({ message: removeResult.message });
                    return;
                }
                const deleteResult = yield eventRepository_1.EventRepository.deleteVenueBooking(bookingId);
                if (!deleteResult.success) {
                    res.status(500).json({ message: deleteResult.message });
                    return;
                }
                res.json({ message: 'Venue booking deleted' });
            }
            catch (error) {
                next(error);
            }
        });
    }
    static validate(data) {
        const errors = [];
        if (!data.eventId)
            errors.push('eventId is required');
        if (!data.venueId)
            errors.push('venueId is required');
        if (!data.organizerId)
            errors.push('organizerId is required');
        if (!data.organizationId)
            errors.push('organizationId is required');
        return errors;
    }
}
exports.EventController = EventController;
EventController.eventRepository = new eventRepository_1.EventRepository();
