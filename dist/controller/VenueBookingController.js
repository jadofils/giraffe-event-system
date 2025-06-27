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
exports.VenueBookingController = void 0;
const VenueBookingRepository_1 = require("../repositories/VenueBookingRepository");
const VenueBookingInterface_1 = require("../interfaces/VenueBookingInterface");
const VenueBooking_1 = require("../models/VenueBooking");
const class_validator_1 = require("class-validator");
const Database_1 = require("../config/Database"); // adjust path as needed
const Venue_1 = require("../models/Venue");
class VenueBookingController {
    // Create a single booking
    static createBooking(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Extract fields one by one from req.body
                const bookingData = {
                    eventId: req.body.eventId,
                    venueId: req.body.venueId,
                    venueInvoiceId: req.body.venueInvoiceId,
                    approvalStatus: req.body.approvalStatus,
                    notes: req.body.notes,
                    totalAmountDue: req.body.totalAmountDue,
                    event: req.body.event,
                };
                // Set fields from token
                if (!req.user) {
                    res.status(401).json({ success: false, message: 'Unauthorized: User token required.' });
                    return;
                }
                bookingData.userId = req.user.id;
                bookingData.organizerId = req.user.id;
                bookingData.organizationId = req.user.organizationId;
                // Create and validate instance
                const bookingInstance = new VenueBookingInterface_1.VenueBookingInterface(bookingData);
                const errors = yield (0, class_validator_1.validate)(bookingInstance, { forbidUnknownValues: true });
                if (errors.length > 0) {
                    res.status(400).json({
                        success: false,
                        message: `Validation errors: ${errors.map(e => Object.values(e.constraints || {})).join(', ')}`,
                    });
                    return;
                }
                // Validate custom logic
                const validationErrors = VenueBookingInterface_1.VenueBookingInterface.validate(bookingData);
                if (validationErrors.length > 0) {
                    res.status(400).json({
                        success: false,
                        message: `Validation errors: ${validationErrors.join(', ')}`,
                    });
                    return;
                }
                // Create booking
                const result = yield VenueBookingRepository_1.VenueBookingRepository.createBooking(bookingInstance);
                if (!result.success) {
                    res.status(400).json({ success: false, message: result.message });
                    return;
                }
                res.status(201).json({
                    success: true,
                    message: result.message,
                    data: result.data,
                });
            }
            catch (error) {
                console.error('Error creating booking:', error);
                res.status(500).json({
                    success: false,
                    message: `Failed to create booking: ${error instanceof Error ? error.message : 'Unknown error'}`,
                });
            }
        });
    }
    // Create multiple bookings
    static createMultipleBookings(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                const bookingsData = req.body;
                // Validate each booking and build a list of venueIds
                const venueIds = [];
                for (let i = 0; i < bookingsData.length; i++) {
                    bookingsData[i].organizerId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
                    const bookingInstance = new VenueBookingInterface_1.VenueBookingInterface(bookingsData[i]);
                    const errors = yield (0, class_validator_1.validate)(bookingInstance);
                    if (errors.length > 0) {
                        res.status(400).json({
                            success: false,
                            message: `Validation errors in booking at index ${i} (eventId: ${bookingsData[i].eventId}, venueId: ${bookingsData[i].venueId}): ${errors.map(e => Object.values(e.constraints || {})).join(', ')}`,
                        });
                        return;
                    }
                    bookingsData[i] = bookingInstance;
                    venueIds.push(bookingInstance.venueId);
                }
                // Fetch all venues in one query
                const venueRepo = Database_1.AppDataSource.getRepository(Venue_1.Venue);
                const venues = yield venueRepo.findByIds(venueIds);
                if (venues.length !== bookingsData.length) {
                    res.status(400).json({
                        success: false,
                        message: 'One or more venues do not exist.',
                    });
                    return;
                }
                // Check all venues have the same organizationId and location
                const firstOrgId = venues[0].organizationId;
                const firstLocation = venues[0].location;
                const invalidVenue = venues.find(v => v.organizationId !== firstOrgId || v.location !== firstLocation);
                if (invalidVenue) {
                    res.status(400).json({
                        success: false,
                        message: `All venues must belong to the same organization and have the same location. Venue ${invalidVenue.venueId} does not match.`,
                    });
                    return;
                }
                const result = yield VenueBookingRepository_1.VenueBookingRepository.createMultipleBookings(bookingsData);
                res.status(result.success ? 201 : 400).json({
                    success: result.success,
                    message: result.success ? 'Bookings created successfully.' : 'Some bookings failed to create.',
                    data: { bookings: result.bookings, errors: result.errors },
                });
            }
            catch (error) {
                console.error('Error creating multiple bookings:', error);
                res.status(500).json({
                    success: false,
                    message: `Failed to create multiple bookings: ${error instanceof Error ? error.message : 'Unknown error'}`,
                });
            }
        });
    }
    // Get all bookings
    static getAllBookings(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const result = yield VenueBookingRepository_1.VenueBookingRepository.getAllBookings();
                res.status(200).json({
                    success: result.success,
                    message: result.message,
                    data: result.data,
                });
            }
            catch (error) {
                console.error('Error fetching all bookings:', error);
                res.status(500).json({
                    success: false,
                    message: `Failed to fetch bookings: ${error instanceof Error ? error.message : 'Unknown error'}`,
                });
            }
        });
    }
    // Get booking by ID
    static getBookingById(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { id } = req.params;
                const result = yield VenueBookingRepository_1.VenueBookingRepository.getBookingById(id);
                res.status(result.success ? 200 : 404).json({
                    success: result.success,
                    message: result.message,
                    data: result.data,
                });
            }
            catch (error) {
                console.error('Error fetching booking by ID:', error);
                res.status(500).json({
                    success: false,
                    message: `Failed to fetch booking: ${error instanceof Error ? error.message : 'Unknown error'}`,
                });
            }
        });
    }
    // Update a booking
    static updateBooking(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { id } = req.params;
                const bookingData = req.body;
                // Validate request body
                const errors = yield (0, class_validator_1.validate)(bookingData);
                if (errors.length > 0) {
                    res.status(400).json({
                        success: false,
                        message: `Validation errors: ${errors.map(e => Object.values(e.constraints || {})).join(', ')}`,
                    });
                    return;
                }
                const result = yield VenueBookingRepository_1.VenueBookingRepository.updateBooking(id, bookingData);
                res.status(result.success ? 200 : 400).json({
                    success: result.success,
                    message: result.message,
                    data: result.data,
                });
            }
            catch (error) {
                console.error('Error updating booking:', error);
                res.status(500).json({
                    success: false,
                    message: `Failed to update booking: ${error instanceof Error ? error.message : 'Unknown error'}`,
                });
            }
        });
    }
    // Delete a booking
    static deleteBooking(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { id } = req.params;
                const result = yield VenueBookingRepository_1.VenueBookingRepository.deleteBooking(id);
                res.status(result.success ? 200 : 404).json({
                    success: result.success,
                    message: result.message,
                });
            }
            catch (error) {
                console.error('Error deleting booking:', error);
                res.status(500).json({
                    success: false,
                    message: `Failed to delete booking: ${error instanceof Error ? error.message : 'Unknown error'}`,
                });
            }
        });
    }
    // Update booking status
    static updateBookingStatus(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { id } = req.params;
                const { status } = req.body;
                const normalizedStatus = typeof status === 'string' ? status.toLowerCase() : status;
                console.log(`[updateBookingStatus] PATCH /venue-bookings/${id}/status with status:`, status, `(normalized: ${normalizedStatus})`);
                if (!Object.values(VenueBooking_1.ApprovalStatus).includes(normalizedStatus)) {
                    console.error(`[updateBookingStatus] Invalid approval status received:`, status);
                    res.status(400).json({
                        success: false,
                        message: 'Invalid approval status.',
                    });
                    return;
                }
                const result = yield VenueBookingRepository_1.VenueBookingRepository.updateBookingStatus(id, normalizedStatus);
                if (!result.success) {
                    console.error(`[updateBookingStatus] Failed to update booking status for ID ${id}:`, result.message);
                }
                res.status(result.success ? 200 : 400).json({
                    success: result.success,
                    message: result.message,
                    data: result.data,
                });
            }
            catch (error) {
                console.error('Error updating booking status:', error);
                res.status(500).json({
                    success: false,
                    message: `Failed to update booking status: ${error instanceof Error ? error.message : 'Unknown error'}`,
                });
            }
        });
    }
    // Get bookings by event ID
    static getBookingsByEventId(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { eventId } = req.params;
                const result = yield VenueBookingRepository_1.VenueBookingRepository.getBookingsByEventId(eventId);
                res.status(result.success ? 200 : 404).json({
                    success: result.success,
                    message: result.message,
                    data: result.data,
                });
            }
            catch (error) {
                console.error('Error fetching bookings by event ID:', error);
                res.status(500).json({
                    success: false,
                    message: `Failed to fetch bookings: ${error instanceof Error ? error.message : 'Unknown error'}`,
                });
            }
        });
    }
    // Get bookings by venue ID
    static getBookingsByVenueId(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { venueId } = req.params;
                const result = yield VenueBookingRepository_1.VenueBookingRepository.getBookingsByVenueId(venueId);
                res.status(result.success ? 200 : 404).json({
                    success: result.success,
                    message: result.message,
                    data: result.data,
                });
            }
            catch (error) {
                console.error('Error fetching bookings by venue ID:', error);
                res.status(500).json({
                    success: false,
                    message: `Failed to fetch bookings: ${error instanceof Error ? error.message : 'Unknown error'}`,
                });
            }
        });
    }
    // Get bookings by organizer ID
    static getBookingsByOrganizerId(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { organizerId } = req.params;
                const result = yield VenueBookingRepository_1.VenueBookingRepository.getBookingsByOrganizerId(organizerId);
                res.status(result.success ? 200 : 404).json({
                    success: result.success,
                    message: result.message,
                    data: result.data,
                });
            }
            catch (error) {
                console.error('Error fetching bookings by organizer ID:', error);
                res.status(500).json({
                    success: false,
                    message: `Failed to fetch bookings: ${error instanceof Error ? error.message : 'Unknown error'}`,
                });
            }
        });
    }
    // Get bookings by organization ID
    static getBookingsByOrganizationId(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { organizationId } = req.params;
                const result = yield VenueBookingRepository_1.VenueBookingRepository.getBookingsByOrganizationId(organizationId);
                res.status(result.success ? 200 : 404).json({
                    success: result.success,
                    message: result.message,
                    data: result.data,
                });
            }
            catch (error) {
                console.error('Error fetching bookings by organization ID:', error);
                res.status(500).json({
                    success: false,
                    message: `Failed to fetch bookings: ${error instanceof Error ? error.message : 'Unknown error'}`,
                });
            }
        });
    }
    // Get bookings by status
    static getBookingsByStatus(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { status } = req.params;
                if (!Object.values(VenueBooking_1.ApprovalStatus).includes(status)) {
                    res.status(400).json({
                        success: false,
                        message: 'Invalid approval status.',
                    });
                    return;
                }
                const result = yield VenueBookingRepository_1.VenueBookingRepository.getBookingsByStatus(status);
                res.status(result.success ? 200 : 404).json({
                    success: result.success,
                    message: result.message,
                    data: result.data,
                });
            }
            catch (error) {
                console.error('Error fetching bookings by status:', error);
                res.status(500).json({
                    success: false,
                    message: `Failed to fetch bookings: ${error instanceof Error ? error.message : 'Unknown error'}`,
                });
            }
        });
    }
    // Get bookings by date range
    static getBookingsByDateRange(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                const { startDate, endDate } = req.params;
                const filterOptions = ((_a = req.query.filterOptions) === null || _a === void 0 ? void 0 : _a.split(',')) || ['all'];
                const start = new Date(startDate);
                const end = new Date(endDate);
                if (isNaN(start.getTime()) || isNaN(end.getTime())) {
                    res.status(400).json({
                        success: false,
                        message: 'Invalid date format.',
                    });
                    return;
                }
                const result = yield VenueBookingRepository_1.VenueBookingRepository.getBookingsByDateRange(start, end, filterOptions);
                res.status(result.success ? 200 : 404).json({
                    success: result.success,
                    message: result.message,
                    data: result.data,
                });
            }
            catch (error) {
                console.error('Error fetching bookings by date range:', error);
                res.status(500).json({
                    success: false,
                    message: `Failed to fetch bookings: ${error instanceof Error ? error.message : 'Unknown error'}`,
                });
            }
        });
    }
    // Get total booking amount for an event
    static getTotalBookingAmountForEvent(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { eventId } = req.params;
                const result = yield VenueBookingRepository_1.VenueBookingRepository.getTotalBookingAmountForEvent(eventId);
                res.status(result.success ? 200 : 404).json({
                    success: result.success,
                    message: result.message,
                    data: { totalAmount: result.totalAmount },
                });
            }
            catch (error) {
                console.error('Error fetching total booking amount:', error);
                res.status(500).json({
                    success: false,
                    message: `Failed to fetch total amount: ${error instanceof Error ? error.message : 'Unknown error'}`,
                });
            }
        });
    }
}
exports.VenueBookingController = VenueBookingController;
