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
const Index_1 = require("../interfaces/Index");
const eventRepository_1 = require("../repositories/eventRepository");
const venueRepository_1 = require("../repositories/venueRepository");
class EventController {
    // Create a single event
    static create(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const organizerId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.userId;
            const { eventTitle, eventType, organizationId, startDate, endDate, startTime, endTime, description, eventCategory, maxAttendees, status, isFeatured, qrCode, imageURL, venues, } = req.body;
            if (!organizerId) {
                res.status(401).json({ success: false, message: "Authentication required." });
                return;
            }
            if (!eventTitle || !eventType || !organizationId || !startDate || !endDate) {
                res.status(400).json({
                    success: false,
                    message: "Missing required fields: eventTitle, eventType, organizationId, startDate, endDate.",
                });
                return;
            }
            try {
                // Validate venues if provided
                if (venues && Array.isArray(venues) && venues.length > 0) {
                    const venueIds = venues.map(v => v.venueId).filter(Boolean);
                    for (const venueId of venueIds) {
                        const venueResult = yield venueRepository_1.VenueRepository.getById(venueId);
                        if (!venueResult) {
                            res.status(404).json({ success: false, message: `Venue with ID ${venueId} not found.` });
                            return;
                        }
                    }
                }
                const newEventData = {
                    eventTitle,
                    eventType,
                    organizerId,
                    organizationId,
                    startDate,
                    endDate,
                    startTime,
                    endTime,
                    description,
                    eventCategory,
                    maxAttendees,
                    status,
                    isFeatured,
                    qrCode,
                    imageURL,
                    venues,
                };
                const createResult = yield eventRepository_1.EventRepository.create(newEventData);
                if (!createResult.success || !createResult.data) {
                    res.status(400).json({ success: false, message: createResult.message });
                    return;
                }
                const saveResult = yield eventRepository_1.EventRepository.save(createResult.data);
                if (saveResult.success && saveResult.data) {
                    res.status(201).json({ success: true, message: "Event created successfully.", data: saveResult.data });
                }
                else {
                    res.status(500).json({ success: false, message: saveResult.message || "Failed to save event." });
                }
            }
            catch (err) {
                console.error("Error creating event:", err);
                res.status(500).json({ success: false, message: "Failed to create event due to a server error." });
            }
        });
    }
    // Create multiple events
    static createMultiple(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const organizerId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.userId;
            const eventsData = req.body.events;
            if (!organizerId) {
                res.status(401).json({ success: false, message: "Authentication required." });
                return;
            }
            if (!eventsData || !Array.isArray(eventsData) || eventsData.length === 0) {
                res.status(400).json({ success: false, message: "An array of event data is required." });
                return;
            }
            try {
                // Validate venues in each event
                for (const eventData of eventsData) {
                    if (eventData.venues && Array.isArray(eventData.venues) && eventData.venues.length > 0) {
                        const venueIds = eventData.venues.map(v => v.venueId).filter(Boolean);
                        for (const venueId of venueIds) {
                            const venueResult = yield venueRepository_1.VenueRepository.getById(venueId);
                            if (!venueResult) {
                                res.status(404).json({ success: false, message: `Venue with ID ${venueId} not found.` });
                                return;
                            }
                        }
                    }
                    // Ensure organizerId is set for each event
                    eventData.organizerId = organizerId;
                }
                const createResult = yield eventRepository_1.EventRepository.createMultiple(eventsData);
                res.status(createResult.success ? 201 : 207).json({
                    success: createResult.success,
                    message: createResult.success ? "All events created successfully." : "Some events failed to create.",
                    data: createResult.events,
                    errors: createResult.errors,
                });
            }
            catch (err) {
                console.error("Error creating multiple events:", err);
                res.status(500).json({ success: false, message: "Failed to create events due to a server error." });
            }
        });
    }
    // Get event by ID
    static getById(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            const { id } = req.params;
            if (!id) {
                res.status(400).json({ success: false, message: "Event ID is required." });
                return;
            }
            try {
                const result = yield eventRepository_1.EventRepository.getById(id);
                if (result.success && result.data) {
                    res.status(200).json({ success: true, data: result.data });
                }
                else {
                    res.status(404).json({ success: false, message: result.message || "Event not found." });
                }
            }
            catch (err) {
                console.error("Error getting event by ID:", err);
                res.status(500).json({ success: false, message: "Failed to get event by ID." });
            }
        });
    }
    // Get events by organizer ID
    static getByOrganizerId(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const organizerId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.userId;
            if (!organizerId) {
                res.status(401).json({ success: false, message: "Authentication required." });
                return;
            }
            try {
                const result = yield eventRepository_1.EventRepository.getByOrganizerId(organizerId);
                if (result.success && result.data) {
                    res.status(200).json({ success: true, data: result.data });
                }
                else {
                    res.status(404).json({ success: false, message: result.message || "No events found for this organizer." });
                }
            }
            catch (err) {
                console.error("Error getting events by organizer ID:", err);
                res.status(500).json({ success: false, message: "Failed to get events by organizer ID." });
            }
        });
    }
    // Get events by organization ID
    static getByOrganizationId(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            const { organizationId } = req.query;
            if (!organizationId || typeof organizationId !== 'string') {
                res.status(400).json({ success: false, message: "Organization ID is required." });
                return;
            }
            try {
                const result = yield eventRepository_1.EventRepository.getByOrganizationId(organizationId);
                if (result.success && result.data) {
                    res.status(200).json({ success: true, data: result.data });
                }
                else {
                    res.status(404).json({ success: false, message: result.message || "No events found for this organization." });
                }
            }
            catch (err) {
                console.error("Error getting events by organization ID:", err);
                res.status(500).json({ success: false, message: "Failed to get events by organization ID." });
            }
        });
    }
    // Get events by venue ID
    static getByVenueId(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            const { venueId } = req.query;
            if (!venueId || typeof venueId !== 'string') {
                res.status(400).json({ success: false, message: "Venue ID is required." });
                return;
            }
            try {
                const result = yield eventRepository_1.EventRepository.getByVenueId(venueId);
                if (result.success && result.data) {
                    res.status(200).json({ success: true, data: result.data });
                }
                else {
                    res.status(404).json({ success: false, message: result.message || "No events found for this venue." });
                }
            }
            catch (err) {
                console.error("Error getting events by venue ID:", err);
                res.status(500).json({ success: false, message: "Failed to get events by venue ID." });
            }
        });
    }
    // Get events by status
    static getByStatus(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            const { status } = req.query;
            if (!status || !Object.values(Index_1.EventStatus).includes(status)) {
                res.status(400).json({ success: false, message: "Valid event status is required." });
                return;
            }
            try {
                const result = yield eventRepository_1.EventRepository.getByStatus(status);
                if (result.success && result.data) {
                    res.status(200).json({ success: true, data: result.data });
                }
                else {
                    res.status(404).json({ success: false, message: result.message || `No events found with status ${status}.` });
                }
            }
            catch (err) {
                console.error("Error getting events by status:", err);
                res.status(500).json({ success: false, message: "Failed to get events by status." });
            }
        });
    }
    // Get events by date range
    static getByDateRange(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            const { startDate, endDate } = req.query;
            if (!startDate || !endDate || typeof startDate !== 'string' || typeof endDate !== 'string') {
                res.status(400).json({ success: false, message: "Start and end dates are required." });
                return;
            }
            try {
                const start = new Date(startDate);
                const end = new Date(endDate);
                if (isNaN(start.getTime()) || isNaN(end.getTime())) {
                    res.status(400).json({ success: false, message: "Invalid date format." });
                    return;
                }
                const result = yield eventRepository_1.EventRepository.getByDateRange(start, end);
                if (result.success && result.data) {
                    res.status(200).json({ success: true, data: result.data });
                }
                else {
                    res.status(404).json({ success: false, message: result.message || "No events found in the specified date range." });
                }
            }
            catch (err) {
                console.error("Error getting events by date range:", err);
                res.status(500).json({ success: false, message: "Failed to get events by date range." });
            }
        });
    }
    // Get all events
    static getAll(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const result = yield eventRepository_1.EventRepository.getAll();
                if (result.success && result.data) {
                    res.status(200).json({ success: true, data: result.data });
                }
                else {
                    res.status(200).json({ success: false, message: result.message || "No events found." });
                }
            }
            catch (err) {
                console.error("Error getting all events:", err);
                res.status(500).json({ success: false, message: "Failed to get all events." });
            }
        });
    }
    // Update event
    static update(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const { id } = req.params;
            const organizerId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.userId;
            const { eventTitle, eventType, organizationId, startDate, endDate, startTime, endTime, description, eventCategory, maxAttendees, status, isFeatured, qrCode, imageURL, venues, } = req.body;
            if (!id) {
                res.status(400).json({ success: false, message: "Event ID is required." });
                return;
            }
            if (!organizerId) {
                res.status(401).json({ success: false, message: "Authentication required." });
                return;
            }
            try {
                // Validate venues if provided
                if (venues && Array.isArray(venues) && venues.length > 0) {
                    const venueIds = venues.map(v => v.venueId).filter(Boolean);
                    for (const venueId of venueIds) {
                        const venueResult = yield venueRepository_1.VenueRepository.getById(venueId);
                        if (!venueResult) {
                            res.status(404).json({ success: false, message: `Venue with ID ${venueId} not found.` });
                            return;
                        }
                    }
                }
                const updateData = {
                    eventTitle,
                    eventType,
                    organizerId,
                    organizationId,
                    startDate,
                    endDate,
                    startTime,
                    endTime,
                    description,
                    eventCategory,
                    maxAttendees,
                    status,
                    isFeatured,
                    qrCode,
                    imageURL,
                    venues,
                };
                const updateResult = yield eventRepository_1.EventRepository.update(id, updateData);
                if (updateResult.success && updateResult.data) {
                    res.status(200).json({ success: true, message: "Event updated successfully.", data: updateResult.data });
                }
                else {
                    res.status(404).json({ success: false, message: updateResult.message || "Event not found." });
                }
            }
            catch (err) {
                console.error("Error updating event:", err);
                res.status(500).json({ success: false, message: "Failed to update event due to a server error." });
            }
        });
    }
    // Delete event
    static delete(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const { id } = req.params;
            const organizerId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.userId;
            if (!id) {
                res.status(400).json({ success: false, message: "Event ID is required." });
                return;
            }
            if (!organizerId) {
                res.status(401).json({ success: false, message: "Authentication required." });
                return;
            }
            try {
                const deleteResult = yield eventRepository_1.EventRepository.delete(id);
                if (deleteResult.success) {
                    res.status(200).json({ success: true, message: deleteResult.message || "Event deleted successfully." });
                }
                else {
                    res.status(404).json({ success: false, message: deleteResult.message || "Event not found." });
                }
            }
            catch (err) {
                console.error("Error deleting event:", err);
                res.status(500).json({ success: false, message: "Failed to delete event." });
            }
        });
    }
    // Assign venues to an event
    static assignVenues(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const organizerId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.userId;
            const { eventId, venueIds } = req.body;
            if (!organizerId) {
                res.status(401).json({ success: false, message: "Authentication required." });
                return;
            }
            if (!eventId || !venueIds || !Array.isArray(venueIds) || venueIds.length === 0) {
                res.status(400).json({ success: false, message: "Event ID and an array of venue IDs are required." });
                return;
            }
            try {
                // Validate venues
                for (const venueId of venueIds) {
                    const venueResult = yield venueRepository_1.VenueRepository.getById(venueId);
                    if (!venueResult) {
                        res.status(404).json({ success: false, message: `Venue with ID ${venueId} not found.` });
                        return;
                    }
                }
                const result = yield eventRepository_1.EventRepository.assignVenues(eventId, venueIds);
                if (result.success) {
                    res.status(200).json({ success: true, message: result.message || "Venues assigned successfully." });
                }
                else {
                    res.status(400).json({ success: false, message: result.message || "Failed to assign venues." });
                }
            }
            catch (err) {
                console.error("Error assigning venues:", err);
                res.status(500).json({ success: false, message: "Failed to assign venues due to a server error." });
            }
        });
    }
    // Remove venues from an event
    static removeVenues(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const organizerId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.userId;
            const { eventId, venueIds } = req.body;
            if (!organizerId) {
                res.status(401).json({ success: false, message: "Authentication required." });
                return;
            }
            if (!eventId || !venueIds || !Array.isArray(venueIds) || venueIds.length === 0) {
                res.status(400).json({ success: false, message: "Event ID and an array of venue IDs are required." });
                return;
            }
            try {
                // Validate venues
                for (const venueId of venueIds) {
                    const venueResult = yield venueRepository_1.VenueRepository.getById(venueId);
                    if (!venueResult) {
                        res.status(404).json({ success: false, message: `Venue with ID ${venueId} not found.` });
                        return;
                    }
                }
                const result = yield eventRepository_1.EventRepository.removeVenues(eventId, venueIds);
                if (result.success) {
                    res.status(200).json({ success: true, message: result.message || "Venues removed successfully." });
                }
                else {
                    res.status(400).json({ success: false, message: result.message || "Failed to remove venues." });
                }
            }
            catch (err) {
                console.error("Error removing venues:", err);
                res.status(500).json({ success: false, message: "Failed to remove venues due to a server error." });
            }
        });
    }
}
exports.EventController = EventController;
