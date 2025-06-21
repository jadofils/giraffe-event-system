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
const Index_1 = require("../interfaces/Index");
const eventRepository_1 = require("../repositories/eventRepository");
class TicketTypeController {
    // No need for service instance since all methods are static
    /**
     * Handles the creation of a new TicketType.
     * Delegates to the TicketTypeService for business logic and data persistence.
     */
    static createTicketType(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const ticketTypeData = req.body;
                // --- Basic input validation before hitting the service ---
                if (!ticketTypeData.eventId) {
                    return res.status(400).json({ message: 'Missing required field: eventId.' });
                }
                // Check if event exists
                const eventResult = yield eventRepository_1.EventRepository.getById(ticketTypeData.eventId);
                if (!eventResult.success || !eventResult.data) {
                    return res.status(404).json({ message: `Event with ID ${ticketTypeData.eventId} not found.` });
                }
                if (!ticketTypeData.ticketName || !ticketTypeData.price || !ticketTypeData.ticketCategory) {
                    return res.status(400).json({ message: 'Missing required fields: ticketName, price, and ticketCategory.' });
                }
                if (typeof ticketTypeData.price !== 'number' || ticketTypeData.price <= 0) {
                    return res.status(400).json({ message: 'Price must be a positive number.' });
                }
                if (!Object.values(Index_1.TicketCategory).includes(ticketTypeData.ticketCategory)) {
                    return res.status(400).json({ message: 'Invalid ticket category provided.' });
                }
                // --- End validation ---
                const newTicketType = yield TicketTypeService_1.TicketTypeService.createTicketType(ticketTypeData);
                // Convert to response format using the service's method
                const responseData = {
                    ticketTypeId: newTicketType.ticketTypeId,
                    ticketName: newTicketType.ticketName,
                    price: newTicketType.price,
                    description: newTicketType.description,
                    ticketCategory: newTicketType.ticketCategory,
                    promoName: newTicketType.promoName,
                    promoDescription: newTicketType.promoDescription,
                    deletedAt: newTicketType.deletedAt ? newTicketType.deletedAt.toISOString() : undefined,
                };
                return res.status(201).json(responseData);
            }
            catch (error) {
                console.error('Error creating ticket type:', error);
                return res.status(500).json({ message: 'Failed to create ticket type', error: error.message || 'Internal server error' });
            }
        });
    }
    /**
     * Retrieves all active TicketTypes.
     * Delegates to the TicketTypeService.
     */
    static getAllTicketTypes(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const ticketTypes = yield TicketTypeService_1.TicketTypeService.getAllTicketTypeResponses();
                return res.status(200).json(ticketTypes);
            }
            catch (error) {
                console.error('Error fetching all ticket types:', error);
                return res.status(500).json({ message: 'Failed to fetch ticket types', error: error.message || 'Internal server error' });
            }
        });
    }
    /**
     * Retrieves a single TicketType by ID.
     * Delegates to the TicketTypeService.
     */
    static getTicketTypeById(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { ticketTypeId } = req.params;
                const ticketType = yield TicketTypeService_1.TicketTypeService.getTicketTypeResponseById(ticketTypeId);
                if (!ticketType) {
                    return res.status(404).json({ message: `Ticket type with ID ${ticketTypeId} not found.` });
                }
                return res.status(200).json(ticketType);
            }
            catch (error) {
                console.error('Error fetching ticket type by ID:', error);
                return res.status(500).json({ message: 'Failed to fetch ticket type', error: error.message || 'Internal server error' });
            }
        });
    }
    /**
     * Updates an existing TicketType.
     * Delegates to the TicketTypeService.
     */
    static updateTicketType(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { ticketTypeId } = req.params;
                const updateData = req.body;
                if (!updateData.eventId) {
                    return res.status(400).json({ message: 'Missing required field: eventId.' });
                }
                // Check if event exists
                const eventResult = yield eventRepository_1.EventRepository.getById(updateData.eventId);
                if (!eventResult.success || !eventResult.data) {
                    return res.status(404).json({ message: `Event with ID ${updateData.eventId} not found.` });
                }
                // --- Basic input validation for updates ---
                if (updateData.ticketCategory && !Object.values(Index_1.TicketCategory).includes(updateData.ticketCategory)) {
                    return res.status(400).json({ message: 'Invalid ticket category provided for update.' });
                }
                if (updateData.price !== undefined && (typeof updateData.price !== 'number' || updateData.price <= 0)) {
                    return res.status(400).json({ message: 'Price must be a positive number if provided.' });
                }
                // --- End validation ---
                const updatedTicketType = yield TicketTypeService_1.TicketTypeService.updateTicketType(ticketTypeId, updateData);
                if (!updatedTicketType) {
                    return res.status(404).json({ message: `Ticket type with ID ${ticketTypeId} not found.` });
                }
                // Convert to response format
                const responseData = {
                    ticketTypeId: updatedTicketType.ticketTypeId,
                    ticketName: updatedTicketType.ticketName,
                    price: updatedTicketType.price,
                    description: updatedTicketType.description,
                    ticketCategory: updatedTicketType.ticketCategory,
                    promoName: updatedTicketType.promoName,
                    promoDescription: updatedTicketType.promoDescription,
                    deletedAt: updatedTicketType.deletedAt ? updatedTicketType.deletedAt.toISOString() : undefined,
                };
                return res.status(200).json(responseData);
            }
            catch (error) {
                console.error('Error updating ticket type:', error);
                return res.status(500).json({ message: 'Failed to update ticket type', error: error.message || 'Internal server error' });
            }
        });
    }
    /**
     * Soft deletes a TicketType.
     * Delegates to the TicketTypeService.
     */
    static deleteTicketType(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { ticketTypeId } = req.params;
                const success = yield TicketTypeService_1.TicketTypeService.deleteTicketType(ticketTypeId);
                if (!success) {
                    return res.status(404).json({ message: `Ticket type with ID ${ticketTypeId} not found or could not be deleted.` });
                }
                return res.status(204).send();
            }
            catch (error) {
                console.error('Error deleting ticket type:', error);
                return res.status(500).json({ message: 'Failed to delete ticket type', error: error.message || 'Internal server error' });
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
                return res.status(200).json(counts);
            }
            catch (error) {
                console.error('Error fetching ticket counts by category:', error);
                return res.status(500).json({ message: 'Failed to fetch ticket counts', error: error.message || 'Internal server error' });
            }
        });
    }
}
exports.TicketTypeController = TicketTypeController;
