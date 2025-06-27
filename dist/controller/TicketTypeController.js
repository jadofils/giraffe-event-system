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
exports.TicketTypeController = void 0;
const TicketTypeService_1 = require("../services/tickets/TicketTypeService");
const TicketTypeInterface_1 = require("../interfaces/TicketTypeInterface");
const Index_1 = require("../interfaces/Index");
const class_validator_1 = require("class-validator");
const TicketType_1 = require("../models/TicketType");
const eventRepository_1 = require("../repositories/eventRepository");
const TicketTypeRepository_1 = require("../repositories/TicketTypeRepository");
class TicketTypeController {
    /**
     * Handles the creation of a new TicketType.
     * Only logged-in users who created the event or are in the event's organization can create tickets for approved events.
     */
    static createTicketType(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.userId;
            const tokenOrgId = (_b = req.user) === null || _b === void 0 ? void 0 : _b.organizationId; // If your auth middleware sets this
            // Allow if either userId or organizationId is present
            if (!userId && !tokenOrgId) {
                res.status(401).json({ success: false, message: 'Unauthorized: User or organization not logged in.' });
                return;
            }
            const ticketTypeData = req.body;
            try {
                // --- Basic input validation ---
                if (!ticketTypeData.eventId) {
                    res.status(400).json({ success: false, message: 'Missing required field: eventId.' });
                    return;
                }
                if (!ticketTypeData.ticketName || !ticketTypeData.price || !ticketTypeData.ticketCategory) {
                    res.status(400).json({ success: false, message: 'Missing required fields: ticketName, price, and ticketCategory.' });
                    return;
                }
                if (typeof ticketTypeData.price !== 'number' || ticketTypeData.price <= 0) {
                    res.status(400).json({ success: false, message: 'Price must be a positive number.' });
                    return;
                }
                if (!Object.values(Index_1.TicketCategory).includes(ticketTypeData.ticketCategory)) {
                    res.status(400).json({ success: false, message: 'Invalid ticket category provided.' });
                    return;
                }
                // --- Check if event exists and is approved ---
                const eventResult = yield eventRepository_1.EventRepository.getById(ticketTypeData.eventId);
                if (!eventResult.success || !eventResult.data) {
                    res.status(404).json({ success: false, message: `Event with ID ${ticketTypeData.eventId} not found.` });
                    return;
                }
                if (eventResult.data.status !== 'APPROVED') {
                    res.status(400).json({ success: false, message: 'Tickets can only be created for approved events.' });
                    return;
                }
                // --- Check user authorization ---
                const isCreator = eventResult.data.createdByUserId === userId || eventResult.data.organizerId === userId;
                const isInOrganization = eventResult.data.organizationId &&
                    eventResult.data.organization &&
                    Array.isArray(eventResult.data.organization.users) &&
                    eventResult.data.organization.users.some(u => u.userId === userId);
                // Allow if user is creator, in organization, or tokenOrgId matches event's organizationId
                const isOrgTokenMatch = tokenOrgId && eventResult.data.organizationId === tokenOrgId;
                if (!isCreator && !isInOrganization && !isOrgTokenMatch) {
                    res.status(403).json({ success: false, message: 'Unauthorized: You cannot create tickets for this event.' });
                    return;
                }
                // --- Create ticket type ---
                const eventEntity = eventResult.data;
                const ticketType = new TicketType_1.TicketType();
                Object.assign(ticketType, ticketTypeData);
                ticketType.createdByUserId = userId;
                ticketType.eventId = eventEntity.eventId;
                ticketType.event = eventEntity;
                // Always set organizationId from the event (not from the body or token)
                ticketType.organizationId = eventEntity.organizationId;
                const validationErrors = yield (0, class_validator_1.validate)(ticketType, { skipMissingProperties: true });
                if (validationErrors.length > 0) {
                    const errorMessages = validationErrors.map(err => Object.values(err.constraints || {})).flat();
                    res.status(400).json({ success: false, message: `Validation failed: ${errorMessages.join(', ')}` });
                    return;
                }
                const newTicketType = yield TicketTypeService_1.TicketTypeService.createTicketType(ticketType);
                // --- Convert to response format ---
                const responseData = TicketTypeInterface_1.TicketTypeResponseInterface.fromEntity(Object.assign(Object.assign({}, newTicketType), { createdByUserId: newTicketType.createdByUserId || userId, organizationId: newTicketType.organizationId }));
                res.status(201).json({ success: true, message: 'Ticket type created successfully.', data: responseData });
            }
            catch (error) {
                console.error('Error creating ticket type:', error);
                res.status(500).json({ success: false, message: 'Failed to create ticket type', error: error.message || 'Internal server error' });
            }
        });
    }
    /**
     * Retrieves all active TicketTypes for an event.
     */
    static getTicketTypesByEvent(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            const { eventId } = req.params;
            try {
                // --- Validate eventId ---
                if (!eventId) {
                    res.status(400).json({ success: false, message: 'Missing required parameter: eventId.' });
                    return;
                }
                // --- Check if event exists ---
                const eventResult = yield eventRepository_1.EventRepository.getById(eventId);
                if (!eventResult.success || !eventResult.data) {
                    res.status(404).json({ success: false, message: `Event with ID ${eventId} not found.` });
                    return;
                }
                // --- Fetch ticket types ---
                const ticketTypes = yield TicketTypeService_1.TicketTypeService.getAllTicketTypeResponses();
                const eventTicketTypes = ticketTypes.filter(t => t.eventId === eventId);
                res.status(200).json({ success: true, message: 'Ticket types fetched successfully.', data: eventTicketTypes });
            }
            catch (error) {
                console.error('Error fetching ticket types by event:', error);
                res.status(500).json({ success: false, message: 'Failed to fetch ticket types', error: error.message || 'Internal server error' });
            }
        });
    }
    /**
     * Retrieves a single TicketType by ID.
     */
    static getTicketTypeById(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            const { ticketTypeId } = req.params;
            try {
                const ticketType = yield TicketTypeService_1.TicketTypeService.getTicketTypeResponseById(ticketTypeId);
                if (!ticketType) {
                    res.status(404).json({ success: false, message: `Ticket type with ID ${ticketTypeId} not found.` });
                    return;
                }
                res.status(200).json({ success: true, message: 'Ticket type fetched successfully.', data: ticketType });
            }
            catch (error) {
                console.error('Error fetching ticket type by ID:', error);
                res.status(500).json({ success: false, message: 'Failed to fetch ticket type', error: error.message || 'Internal server error' });
            }
        });
    }
    /**
     * Updates an existing TicketType.
     * Only authorized users can update tickets.
     */
    static updateTicketType(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.userId;
            if (!userId) {
                res.status(401).json({ success: false, message: 'Unauthorized: User not logged in.' });
                return;
            }
            const { ticketTypeId } = req.params;
            const updateData = req.body;
            try {
                // --- Basic input validation ---
                if (updateData.ticketCategory && !Object.values(Index_1.TicketCategory).includes(updateData.ticketCategory)) {
                    res.status(400).json({ success: false, message: 'Invalid ticket category provided.' });
                    return;
                }
                if (updateData.price !== undefined && (typeof updateData.price !== 'number' || updateData.price <= 0)) {
                    res.status(400).json({ success: false, message: 'Price must be a positive number if provided.' });
                    return;
                }
                // --- Validate against TicketType model ---
                const ticketType = new TicketType_1.TicketType();
                Object.assign(ticketType, updateData);
                const validationErrors = yield (0, class_validator_1.validate)(ticketType, { skipMissingProperties: true });
                if (validationErrors.length > 0) {
                    const errorMessages = validationErrors.map(err => Object.values(err.constraints || {})).flat();
                    res.status(400).json({ success: false, message: `Validation failed: ${errorMessages.join(', ')}` });
                    return;
                }
                // --- Check if ticket type exists ---
                const existingTicketType = yield TicketTypeService_1.TicketTypeService.getTicketTypeById(ticketTypeId);
                if (!existingTicketType) {
                    res.status(404).json({ success: false, message: `Ticket type with ID ${ticketTypeId} not found.` });
                    return;
                }
                // --- Check if event exists and is approved ---
                const eventId = updateData.eventId || existingTicketType.eventId;
                const eventResult = yield eventRepository_1.EventRepository.getById(eventId);
                if (!eventResult.success || !eventResult.data) {
                    res.status(404).json({ success: false, message: `Event with ID ${eventId} not found.` });
                    return;
                }
                if (eventResult.data.status !== 'APPROVED') {
                    res.status(400).json({ success: false, message: 'Tickets can only be updated for approved events.' });
                    return;
                }
                // --- Check user authorization ---
                const isCreator = eventResult.data.createdByUserId === userId || eventResult.data.organizerId === userId;
                const isInOrganization = eventResult.data.organizationId &&
                    eventResult.data.organization &&
                    Array.isArray(eventResult.data.organization.users) &&
                    eventResult.data.organization.users.some(u => u.userId === userId);
                if (!isCreator && !isInOrganization) {
                    res.status(403).json({ success: false, message: 'Unauthorized: You cannot update tickets for this event.' });
                    return;
                }
                // --- Update ticket type ---
                const updatedTicketType = yield TicketTypeService_1.TicketTypeService.updateTicketType(ticketTypeId, updateData);
                if (!updatedTicketType) {
                    res.status(404).json({ success: false, message: `Ticket type with ID ${ticketTypeId} not found.` });
                    return;
                }
                // --- Convert to response format ---
                const responseData = TicketTypeInterface_1.TicketTypeResponseInterface.fromEntity(Object.assign(Object.assign({}, updatedTicketType), { createdByUserId: updatedTicketType.createdByUserId || userId }));
                res.status(200).json({ success: true, message: 'Ticket type updated successfully.', data: responseData });
            }
            catch (error) {
                console.error('Error updating ticket type:', error);
                res.status(500).json({ success: false, message: 'Failed to update ticket type', error: error.message || 'Internal server error' });
            }
        });
    }
    /**
     * Soft deletes a TicketType.
     * Only authorized users can delete tickets.
     */
    static deleteTicketType(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.userId;
            if (!userId) {
                res.status(401).json({ success: false, message: 'Unauthorized: User not logged in.' });
                return;
            }
            const { ticketTypeId } = req.params;
            try {
                // --- Check if ticket type exists ---
                const existingTicketType = yield TicketTypeService_1.TicketTypeService.getTicketTypeById(ticketTypeId);
                if (!existingTicketType) {
                    res.status(404).json({ success: false, message: `Ticket type with ID ${ticketTypeId} not found.` });
                    return;
                }
                // --- Check if event exists and is approved ---
                const eventResult = yield eventRepository_1.EventRepository.getById(existingTicketType.eventId);
                if (!eventResult.success || !eventResult.data) {
                    res.status(404).json({ success: false, message: `Event with ID ${existingTicketType.eventId} not found.` });
                    return;
                }
                if (eventResult.data.status !== 'APPROVED') {
                    res.status(400).json({ success: false, message: 'Tickets can only be deleted for approved events.' });
                    return;
                }
                // --- Check user authorization ---
                const isCreator = eventResult.data.createdByUserId === userId || eventResult.data.organizerId === userId;
                const isInOrganization = eventResult.data.organizationId &&
                    eventResult.data.organization &&
                    Array.isArray(eventResult.data.organization.users) &&
                    eventResult.data.organization.users.some(u => u.userId === userId);
                if (!isCreator && !isInOrganization) {
                    res.status(403).json({ success: false, message: 'Unauthorized: You cannot delete tickets for this event.' });
                    return;
                }
                // --- Delete ticket type ---
                const success = yield TicketTypeService_1.TicketTypeService.deleteTicketType(ticketTypeId);
                if (!success) {
                    res.status(404).json({ success: false, message: `Ticket type with ID ${ticketTypeId} not found or could not be deleted.` });
                    return;
                }
                res.status(200).json({ success: true, message: 'Ticket type deleted successfully.' });
            }
            catch (error) {
                console.error('Error deleting ticket type:', error);
                res.status(500).json({ success: false, message: 'Failed to delete ticket type', error: error.message || 'Internal server error' });
            }
        });
    }
    /**
     * Gets ticket count statistics by category.
     */
    static getTicketCountByCategory(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const counts = yield TicketTypeService_1.TicketTypeService.countTicketsByCategory();
                res.status(200).json({ success: true, message: 'Ticket counts fetched successfully.', data: counts });
            }
            catch (error) {
                console.error('Error fetching ticket counts by category:', error);
                res.status(500).json({ success: false, message: 'Failed to fetch ticket counts', error: error.message || 'Internal server error' });
            }
        });
    }
    /**
     * Retrieves all TicketTypes.
     */
    static getAllTickets(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const ticketRepo = new TicketTypeRepository_1.TicketTypeRepository();
                const result = yield ticketRepo.findAllTickects();
                res.status(result.success ? 200 : 400).json(result);
            }
            catch (error) {
                console.error('Error in TicketTypeController.getAllTickets:', error);
                res.status(500).json({
                    success: false,
                    message: 'Internal server error',
                    error: error instanceof Error ? error.message : 'Unknown error',
                });
            }
        });
    }
    static updateIsActive(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.userId;
            const { ticketTypeId } = req.params;
            const { isActive } = (_b = req.body) !== null && _b !== void 0 ? _b : {};
            if (!userId) {
                res.status(401).json({ success: false, message: 'Unauthorized: User not logged in.' });
                return;
            }
            if (typeof isActive !== 'boolean') {
                res.status(400).json({ success: false, message: 'isActive must be a boolean.' });
                return;
            }
            try {
                const ticketRepo = new TicketTypeRepository_1.TicketTypeRepository();
                const ticketResult = yield ticketRepo.findById(ticketTypeId);
                if (!ticketResult.success || !ticketResult.data) {
                    res.status(404).json({ success: false, message: 'Ticket type not found.' });
                    return;
                }
                const { availableFrom, availableUntil } = ticketResult.data;
                const now = new Date();
                // Only check time window if activating
                const canActivate = isActive
                    ? (!availableFrom || now >= new Date(availableFrom)) &&
                        (!availableUntil || now <= new Date(availableUntil))
                    : true;
                if (!canActivate) {
                    res.status(400).json({ success: false, message: 'Cannot activate: Ticket is not within available time window.' });
                    return;
                }
                const result = yield ticketRepo.updateIsActive(ticketTypeId, isActive, userId);
                if (!result.success) {
                    res.status(400).json(result);
                    return;
                }
                res.status(200).json(result);
            }
            catch (error) {
                res.status(500).json({ success: false, message: 'Failed to update isActive', error: error.message });
            }
        });
    }
}
exports.TicketTypeController = TicketTypeController;
