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
class VenueBookingController {
    /**
     * Create a new event booking
     * @route POST /api/bookings
     * @access Private (d Users)
     */
    static createVenueBooking(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d;
            try {
                const bookingData = req.body;
                // Validate authentication
                if (!req.user || !req.user.userId || !req.user.organizationId) {
                    console.log("User token data:", req.user);
                    res.status(401).json({ success: false, message: "Unauthorized: User is not properly d." });
                    return;
                }
                const organizerId = req.user.userId;
                const organizationId = req.user.organizationId;
                // Validate UUIDs
                if (!this.UUID_REGEX.test(organizerId)) {
                    console.log("Invalid UUID format for organizerId:", organizerId);
                    res.status(400).json({ success: false, message: "Invalid user ID format in token." });
                    return;
                }
                if (!this.UUID_REGEX.test(organizationId)) {
                    console.log("Invalid UUID format for organizationId:", organizationId);
                    res.status(400).json({ success: false, message: "Invalid organization ID format in token." });
                    return;
                }
                // Validate required fields
                if (!bookingData.eventId ||
                    !bookingData.venueId ||
                    !((_a = bookingData.event) === null || _a === void 0 ? void 0 : _a.startDate) ||
                    !((_b = bookingData.event) === null || _b === void 0 ? void 0 : _b.endDate) ||
                    !((_c = bookingData.event) === null || _c === void 0 ? void 0 : _c.startTime) ||
                    !((_d = bookingData.event) === null || _d === void 0 ? void 0 : _d.endTime)) {
                    res.status(400).json({ success: false, message: "Missing required fields: eventId, venueId, startDate, endDate, startTime, endTime." });
                    return;
                }
                // Validate UUIDs for eventId and venueId
                if (!this.UUID_REGEX.test(bookingData.eventId)) {
                    res.status(400).json({ success: false, message: "Invalid event ID format." });
                    return;
                }
                if (!this.UUID_REGEX.test(bookingData.venueId)) {
                    res.status(400).json({ success: false, message: "Invalid venue ID format." });
                    return;
                }
                // Validate dates
                const startDate = new Date(bookingData.event.startDate);
                const endDate = new Date(bookingData.event.endDate);
                if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
                    res.status(400).json({ success: false, message: "Invalid date format." });
                    return;
                }
                if (startDate > endDate) {
                    res.status(400).json({ success: false, message: "Start date cannot be after end date." });
                    return;
                }
                // Check organization existence
                const organization = yield VenueBookingRepository_1.VenueBookingRepository.getOrganizationRepository().findOne({
                    where: { organizationId },
                });
                if (!organization) {
                    console.log("Organization not found:", organizationId);
                    res.status(404).json({ success: false, message: "Organization not found." });
                    return;
                }
                // Validate organizer and organization membership
                const organizer = yield VenueBookingRepository_1.VenueBookingRepository.getUserRepository().findOne({
                    where: { userId: organizerId },
                    relations: ["organizations"],
                });
                if (!organizer) {
                    res.status(404).json({ success: false, message: "Organizer not found." });
                    return;
                }
                const userBelongsToOrg = organizer.organizations.some(org => org.organizationId === organizationId);
                if (!userBelongsToOrg) {
                    res.status(403).json({ success: false, message: "Forbidden: User is not part of the specified organization." });
                    return;
                }
                // Check for duplicate bookings
                const conflictCheck = yield VenueBookingRepository_1.VenueBookingRepository.checkDuplicateBookings(bookingData.venueId, startDate, endDate, bookingData.event.startTime, bookingData.event.endTime);
                if (!conflictCheck.success) {
                    res.status(400).json({ success: false, message: conflictCheck.message });
                    return;
                }
                // Create booking
                const result = yield VenueBookingRepository_1.VenueBookingRepository.createBooking(Object.assign(Object.assign({}, bookingData), { organizerId,
                    organizationId, approvalStatus: bookingData.approvalStatus || "pending" }));
                if (result.success && result.data) {
                    res.status(201).json({ success: true, message: "Event booking created successfully.", data: result.data });
                }
                else {
                    res.status(500).json({ success: false, message: result.message || "Failed to create event booking." });
                }
            }
            catch (error) {
                console.error("Error in createVenueBooking:", error);
                res.status(500).json({ success: false, message: "Internal Server Error." });
            }
        });
    }
    /**
     * Create multiple event bookings
     * @route POST /api/bookings/bulk
     * @access Private (d Users)
     */
    static createMultipleVenueBookings(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const bookingsData = req.body.bookings;
                // Validate authentication
                if (!req.user || !req.user.userId || !req.user.organizationId) {
                    res.status(401).json({ success: false, message: "Unauthorized: User is not properly d." });
                    return;
                }
                const organizerId = req.user.userId;
                const organizationId = req.user.organizationId;
                // Validate input
                if (!bookingsData || !Array.isArray(bookingsData) || bookingsData.length === 0) {
                    res.status(400).json({ success: false, message: "An array of booking data is required." });
                    return;
                }
                // Validate UUIDs and organization
                const organization = yield VenueBookingRepository_1.VenueBookingRepository.getOrganizationRepository().findOne({
                    where: { organizationId },
                });
                if (!organization) {
                    res.status(404).json({ success: false, message: "Organization not found." });
                    return;
                }
                const organizer = yield VenueBookingRepository_1.VenueBookingRepository.getUserRepository().findOne({
                    where: { userId: organizerId },
                    relations: ["organizations"],
                });
                if (!organizer || !organizer.organizations.some(org => org.organizationId === organizationId)) {
                    res.status(403).json({ success: false, message: "Forbidden: User is not part of the specified organization." });
                    return;
                }
                // Prepare bookings with organizerId and organizationId
                const preparedBookings = bookingsData.map(booking => (Object.assign(Object.assign({}, booking), { organizerId,
                    organizationId, approvalStatus: booking.approvalStatus || "pending" })));
                // Create bookings
                const result = yield VenueBookingRepository_1.VenueBookingRepository.createMultipleBookings(preparedBookings);
                res.status(result.success ? 201 : 207).json({
                    success: result.success,
                    message: result.success ? "All bookings created successfully." : "Some bookings failed to create.",
                    data: result.bookings,
                    errors: result.errors,
                });
            }
            catch (error) {
                console.error("Error in createMultipleVenueBookings:", error);
                res.status(500).json({ success: false, message: "Internal Server Error." });
            }
        });
    }
    /**
     * Get all event bookings
     * @route GET /api/bookings
     * @access Private (Admins)
     */
    static getAllVenueBookings(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                if (!req.user || !req.user.userId) {
                    res.status(401).json({ success: false, message: "Unauthorized: Authentication required." });
                    return;
                }
                const result = yield VenueBookingRepository_1.VenueBookingRepository.getAllBookings();
                if (result.success && result.data) {
                    res.status(200).json({
                        success: true,
                        message: result.data.length ? "Event bookings retrieved successfully." : "No event bookings found.",
                        data: result.data,
                    });
                }
                else {
                    res.status(500).json({ success: false, message: result.message || "Failed to retrieve event bookings." });
                }
            }
            catch (error) {
                console.error("Error in getAllVenueBookings:", error);
                res.status(500).json({ success: false, message: "Internal Server Error." });
            }
        });
    }
    /**
     * Get event booking by ID
     * @route GET /api/bookings/:id
     * @access Private (Booking Owner, Event Organizer, Admins)
     */
    static getVenueBookingById(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { id } = req.params;
                if (!id || !this.UUID_REGEX.test(id)) {
                    res.status(400).json({ success: false, message: "Invalid or missing booking ID." });
                    return;
                }
                const result = yield VenueBookingRepository_1.VenueBookingRepository.getBookingById(id);
                if (result.success && result.data) {
                    res.status(200).json({ success: true, message: "Event booking retrieved successfully.", data: result.data });
                }
                else {
                    res.status(404).json({ success: false, message: result.message || "Event booking not found." });
                }
            }
            catch (error) {
                console.error("Error in getVenueBookingById:", error);
                res.status(500).json({ success: false, message: "Internal Server Error." });
            }
        });
    }
    /**
     * Update event booking
     * @route PUT /api/bookings/:id
     * @access Private (Booking Owner, Event Organizer, Admins)
     */
    static updateVenueBooking(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d;
            try {
                const { id } = req.params;
                const updates = req.body;
                if (!req.user || !req.user.userId) {
                    res.status(401).json({ success: false, message: "Unauthorized: Authentication required." });
                    return;
                }
                if (!id || !this.UUID_REGEX.test(id)) {
                    res.status(400).json({ success: false, message: "Invalid or missing booking ID." });
                    return;
                }
                if (Object.keys(updates).length === 0) {
                    res.status(400).json({ success: false, message: "No update data provided." });
                    return;
                }
                // Validate UUIDs if provided
                if (updates.eventId && !this.UUID_REGEX.test(updates.eventId)) {
                    res.status(400).json({ success: false, message: "Invalid event ID format." });
                    return;
                }
                if (updates.venueId && !this.UUID_REGEX.test(updates.venueId)) {
                    res.status(400).json({ success: false, message: "Invalid venue ID format." });
                    return;
                }
                // Validate dates if provided
                if (((_a = updates.event) === null || _a === void 0 ? void 0 : _a.startDate) || ((_b = updates.event) === null || _b === void 0 ? void 0 : _b.endDate)) {
                    const startDate = ((_c = updates.event) === null || _c === void 0 ? void 0 : _c.startDate) ? new Date(updates.event.startDate) : undefined;
                    const endDate = ((_d = updates.event) === null || _d === void 0 ? void 0 : _d.endDate) ? new Date(updates.event.endDate) : undefined;
                    if ((startDate && isNaN(startDate.getTime())) || (endDate && isNaN(endDate.getTime()))) {
                        res.status(400).json({ success: false, message: "Invalid date format." });
                        return;
                    }
                    if (startDate && endDate && startDate > endDate) {
                        res.status(400).json({ success: false, message: "Start date cannot be after end date." });
                        return;
                    }
                }
                // Validate approval status
                if (updates.approvalStatus && !["pending", "approved", "rejected"].includes(updates.approvalStatus)) {
                    res.status(400).json({ success: false, message: "Invalid approval status." });
                    return;
                }
                const result = yield VenueBookingRepository_1.VenueBookingRepository.updateBooking(id, updates);
                if (result.success && result.data) {
                    res.status(200).json({ success: true, message: "Event booking updated successfully.", data: result.data });
                }
                else {
                    res.status(404).json({ success: false, message: result.message || "Event booking not found." });
                }
            }
            catch (error) {
                console.error("Error in updateVenueBooking:", error);
                res.status(500).json({ success: false, message: "Internal Server Error." });
            }
        });
    }
    /**
     * Update event booking status
     * @route PATCH /api/bookings/:id/status
     * @access Private (Event Organizer, Admins)
     */
    static updateVenueBookingStatus(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { id } = req.params;
                const { approvalStatus } = req.body;
                if (!req.user || !req.user.userId) {
                    res.status(401).json({ success: false, message: "Unauthorized: Authentication required." });
                    return;
                }
                if (!id || !this.UUID_REGEX.test(id)) {
                    res.status(400).json({ success: false, message: "Invalid or missing booking ID." });
                    return;
                }
                if (!approvalStatus || !["pending", "approved", "rejected"].includes(approvalStatus)) {
                    res.status(400).json({ success: false, message: "Invalid or missing approval status." });
                    return;
                }
                const result = yield VenueBookingRepository_1.VenueBookingRepository.updateBookingStatus(id, approvalStatus);
                if (result.success && result.data) {
                    res.status(200).json({ success: true, message: "Event booking status updated successfully.", data: result.data });
                }
                else {
                    res.status(404).json({ success: false, message: result.message || "Event booking not found." });
                }
            }
            catch (error) {
                console.error("Error in updateVenueBookingStatus:", error);
                res.status(500).json({ success: false, message: "Internal Server Error." });
            }
        });
    }
    /**
     * Delete an event booking
     * @route DELETE /api/bookings/:id
     * @access Private (Booking Owner, Event Organizer, Admins)
     */
    static deleteVenueBooking(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { id } = req.params;
                if (!req.user || !req.user.userId) {
                    res.status(401).json({ success: false, message: "Unauthorized: Authentication required." });
                    return;
                }
                if (!id || !this.UUID_REGEX.test(id)) {
                    res.status(400).json({ success: false, message: "Invalid or missing booking ID." });
                    return;
                }
                const result = yield VenueBookingRepository_1.VenueBookingRepository.deleteBooking(id);
                if (result.success) {
                    res.status(204).send();
                }
                else {
                    res.status(404).json({ success: false, message: result.message || "Event booking not found." });
                }
            }
            catch (error) {
                console.error("Error in deleteVenueBooking:", error);
                res.status(500).json({ success: false, message: "Internal Server Error." });
            }
        });
    }
    /**
     * Get bookings by event ID
     * @route GET /api/events/:eventId/bookings
     * @access Private (Event Organizer, Admins)
     */
    static getBookingsByEventId(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { eventId } = req.params;
                if (!req.user || !req.user.userId) {
                    res.status(401).json({ success: false, message: "Unauthorized: Authentication required." });
                    return;
                }
                if (!eventId || !this.UUID_REGEX.test(eventId)) {
                    res.status(400).json({ success: false, message: "Invalid or missing event ID." });
                    return;
                }
                const result = yield VenueBookingRepository_1.VenueBookingRepository.getBookingsByEventId(eventId);
                if (result.success && result.data) {
                    res.status(200).json({
                        success: true,
                        message: result.data.length ? "Bookings retrieved successfully." : "No bookings found for this event.",
                        data: result.data,
                    });
                }
                else {
                    res.status(500).json({ success: false, message: result.message || "Failed to retrieve bookings." });
                }
            }
            catch (error) {
                console.error("Error in getBookingsByEventId:", error);
                res.status(500).json({ success: false, message: "Internal Server Error." });
            }
        });
    }
    /**
     * Get bookings by venue ID
     * @route GET /api/venues/:venueId/bookings
     * @access Private (Venue Owner, Admins)
     */
    static getBookingsByVenueId(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { venueId } = req.params;
                if (!req.user || !req.user.userId) {
                    res.status(401).json({ success: false, message: "Unauthorized: Authentication required." });
                    return;
                }
                if (!venueId || !this.UUID_REGEX.test(venueId)) {
                    res.status(400).json({ success: false, message: "Invalid or missing venue ID." });
                    return;
                }
                const result = yield VenueBookingRepository_1.VenueBookingRepository.getBookingsByVenueId(venueId);
                if (result.success && result.data) {
                    res.status(200).json({
                        success: true,
                        message: result.data.length ? "Bookings retrieved successfully." : "No bookings found for this venue.",
                        data: result.data,
                    });
                }
                else {
                    res.status(500).json({ success: false, message: result.message || "Failed to retrieve bookings." });
                }
            }
            catch (error) {
                console.error("Error in getBookingsByVenueId:", error);
                res.status(500).json({ success: false, message: "Internal Server Error." });
            }
        });
    }
    /**
     * Get bookings by organizer ID
     * @route GET /api/bookings/organizer
     * @access Private (d Organizer)
     */
    static getBookingsByOrganizerId(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                if (!req.user || !req.user.userId) {
                    res.status(401).json({ success: false, message: "Unauthorized: Authentication required." });
                    return;
                }
                const organizerId = req.user.userId;
                if (!this.UUID_REGEX.test(organizerId)) {
                    res.status(400).json({ success: false, message: "Invalid organizer ID format." });
                    return;
                }
                const result = yield VenueBookingRepository_1.VenueBookingRepository.getBookingsByOrganizerId(organizerId);
                if (result.success && result.data) {
                    res.status(200).json({
                        success: true,
                        message: result.data.length ? "Bookings retrieved successfully." : "No bookings found for this organizer.",
                        data: result.data,
                    });
                }
                else {
                    res.status(500).json({ success: false, message: result.message || "Failed to retrieve bookings." });
                }
            }
            catch (error) {
                console.error("Error in getBookingsByOrganizerId:", error);
                res.status(500).json({ success: false, message: "Internal Server Error." });
            }
        });
    }
    /**
     * Get bookings by organization ID
     * @route GET /api/organizations/:organizationId/bookings
     * @access Private (Organization Members, Admins)
     */
    static getBookingsByOrganizationId(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { organizationId } = req.params;
                if (!req.user || !req.user.userId) {
                    res.status(401).json({ success: false, message: "Unauthorized: Authentication required." });
                    return;
                }
                if (!organizationId || !this.UUID_REGEX.test(organizationId)) {
                    res.status(400).json({ success: false, message: "Invalid or missing organization ID." });
                    return;
                }
                // Verify user belongs to organization
                const user = yield VenueBookingRepository_1.VenueBookingRepository.getUserRepository().findOne({
                    where: { userId: req.user.userId },
                    relations: ["organizations"],
                });
                if (!user || !user.organizations.some(org => org.organizationId === organizationId)) {
                    res.status(403).json({ success: false, message: "Forbidden: User is not part of the specified organization." });
                    return;
                }
                const result = yield VenueBookingRepository_1.VenueBookingRepository.getBookingsByOrganizationId(organizationId);
                if (result.success && result.data) {
                    res.status(200).json({
                        success: true,
                        message: result.data.length ? "Bookings retrieved successfully." : "No bookings found for this organization.",
                        data: result.data,
                    });
                }
                else {
                    res.status(500).json({ success: false, message: result.message || "Failed to retrieve bookings." });
                }
            }
            catch (error) {
                console.error("Error in getBookingsByOrganizationId:", error);
                res.status(500).json({ success: false, message: "Internal Server Error." });
            }
        });
    }
    /**
     * Get bookings by approval status
     * @route GET /api/bookings/status/:status
     * @access Private (Admins)
     */
    static getBookingsByStatus(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { status } = req.params;
                if (!req.user || !req.user.userId) {
                    res.status(401).json({ success: false, message: "Unauthorized: Authentication required." });
                    return;
                }
                if (!status || !["pending", "approved", "rejected"].includes(status)) {
                    res.status(400).json({ success: false, message: "Invalid or missing status." });
                    return;
                }
                const result = yield VenueBookingRepository_1.VenueBookingRepository.getBookingsByStatus(status);
                if (result.success && result.data) {
                    res.status(200).json({
                        success: true,
                        message: result.data.length ? `Bookings with status '${status}' retrieved successfully.` : `No bookings found with status: ${status}.`,
                        data: result.data,
                    });
                }
                else {
                    res.status(500).json({ success: false, message: result.message || "Failed to retrieve bookings." });
                }
            }
            catch (error) {
                console.error("Error in getBookingsByStatus:", error);
                res.status(500).json({ success: false, message: "Internal Server Error." });
            }
        });
    }
    /**
     * Get bookings by date range
     * @route GET /api/bookings/date-range
     * @access Private (Admins)
     */
    static getBookingsByDateRange(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { startDate, endDate, filterOptions } = req.query;
                if (!req.user || !req.user.userId) {
                    res.status(401).json({ success: false, message: "Unauthorized: Authentication required." });
                    return;
                }
                if (!startDate || !endDate) {
                    res.status(400).json({ success: false, message: "Start date and end date are required." });
                    return;
                }
                const parsedStartDate = new Date(startDate);
                const parsedEndDate = new Date(endDate);
                if (isNaN(parsedStartDate.getTime()) || isNaN(parsedEndDate.getTime())) {
                    res.status(400).json({ success: false, message: "Invalid date format." });
                    return;
                }
                if (parsedStartDate > parsedEndDate) {
                    res.status(400).json({ success: false, message: "Start date cannot be after end date." });
                    return;
                }
                // Parse filter options
                let filters = ["all"];
                if (filterOptions) {
                    const options = Array.isArray(filterOptions) ? filterOptions : [filterOptions];
                    filters = options.filter(opt => ["min", "hours", "days", "all"].includes(opt));
                    if (filters.length === 0) {
                        res.status(400).json({ success: false, message: "Invalid filter options. Use 'min', 'hours', 'days', or 'all'." });
                        return;
                    }
                }
                const result = yield VenueBookingRepository_1.VenueBookingRepository.getBookingsByDateRange(parsedStartDate, parsedEndDate, filters);
                if (result.success && result.data) {
                    res.status(200).json({
                        success: true,
                        message: result.data.length ? "Bookings retrieved successfully." : "No bookings found for the selected date range.",
                        data: result.data,
                    });
                }
                else {
                    res.status(500).json({ success: false, message: result.message || "Failed to retrieve bookings." });
                }
            }
            catch (error) {
                console.error("Error in getBookingsByDateRange:", error);
                res.status(500).json({ success: false, message: "Internal Server Error." });
            }
        });
    }
    /**
     * Check for duplicate bookings in a specific time range
     * @route GET /api/bookings/check-duplicates
     * @access Private (d Users)
     */
    static checkDuplicateBookings(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { venueId, startDate, endDate, startTime, endTime } = req.query;
                if (!req.user || !req.user.userId) {
                    res.status(401).json({ success: false, message: "Unauthorized: Authentication required." });
                    return;
                }
                if (!venueId || !startDate || !endDate) {
                    res.status(400).json({ success: false, message: "Venue ID, start date, and end date are required." });
                    return;
                }
                if (!this.UUID_REGEX.test(venueId)) {
                    res.status(400).json({ success: false, message: "Invalid venue ID format." });
                    return;
                }
                const parsedStartDate = new Date(startDate);
                const parsedEndDate = new Date(endDate);
                if (isNaN(parsedStartDate.getTime()) || isNaN(parsedEndDate.getTime())) {
                    res.status(400).json({ success: false, message: "Invalid date format." });
                    return;
                }
                if (parsedStartDate > parsedEndDate) {
                    res.status(400).json({ success: false, message: "Start date cannot be after end date." });
                    return;
                }
                const result = yield VenueBookingRepository_1.VenueBookingRepository.checkDuplicateBookings(venueId, parsedStartDate, parsedEndDate, startTime, endTime);
                if (result.success) {
                    res.status(200).json({ success: true, message: "No conflicting bookings found.", data: [] });
                }
                else {
                    res.status(200).json({
                        success: false,
                        message: result.message || "Conflicting bookings found.",
                        data: result.conflicts || [],
                    });
                }
            }
            catch (error) {
                console.error("Error in checkDuplicateBookings:", error);
                res.status(500).json({ success: false, message: "Internal Server Error." });
            }
        });
    }
    /**
     * Handle Method Not Allowed
     * @route Any unsupported HTTP method
     * @access Public
     */
    static methodNotAllowed(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            res.status(405).json({ success: false, message: "Method Not Allowed: This HTTP method is not supported for this endpoint." });
        });
    }
    /**
     * Handle Unauthorized
     * @route Any route requiring authentication
     * @access Public
     */
    static unauthorized(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            res.status(401).json({ success: false, message: "Unauthorized: Authentication is required or has failed." });
        });
    }
    /**
     * Handle Forbidden
     * @route Any route requiring specific permissions
     * @access Private (d Users)
     */
    static forbidden(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            res.status(403).json({ success: false, message: "Forbidden: You do not have permission to perform this action." });
        });
    }
}
exports.VenueBookingController = VenueBookingController;
VenueBookingController.UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
