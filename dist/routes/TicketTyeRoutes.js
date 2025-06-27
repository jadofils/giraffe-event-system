"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const AuthMiddleware_1 = require("../middlewares/AuthMiddleware");
const TicketTypeController_1 = require("../controller/TicketTypeController");
const router = (0, express_1.Router)();
router.use(AuthMiddleware_1.authenticate);
// Create a new ticket type (protected)
router.post('/', TicketTypeController_1.TicketTypeController.createTicketType);
// Get all active ticket types for an event
router.get('/event/:eventId', TicketTypeController_1.TicketTypeController.getTicketTypesByEvent);
// Get ticket count statistics by category (STATIC route - must be before :ticketTypeId)
router.get('/count-by-category', TicketTypeController_1.TicketTypeController.getTicketCountByCategory);
// Get all tickets (STATIC route - must be before :ticketTypeId)
router.get('/', TicketTypeController_1.TicketTypeController.getAllTickets);
// Update isActive (STATIC route - must be before :ticketTypeId)
router.patch('/:ticketTypeId/is-active', TicketTypeController_1.TicketTypeController.updateIsActive);
// Get a single ticket type by ID (DYNAMIC route - must be after all static routes)
router.get('/:ticketTypeId', TicketTypeController_1.TicketTypeController.getTicketTypeById);
// Update an existing ticket type (protected)
router.patch('/:ticketTypeId', AuthMiddleware_1.authenticate, TicketTypeController_1.TicketTypeController.updateTicketType);
// Soft delete a ticket type (protected)
router.delete('/:ticketTypeId', AuthMiddleware_1.authenticate, TicketTypeController_1.TicketTypeController.deleteTicketType);
exports.default = router;
