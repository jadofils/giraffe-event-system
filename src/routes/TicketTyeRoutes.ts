import { Router } from 'express';
import { authenticate } from '../middlewares/AuthMiddleware';
import { TicketTypeController } from '../controller/TicketTypeController';

const router = Router();
router.use(authenticate);

// Create a new ticket type (protected)
router.post('/', TicketTypeController.createTicketType);

// Get all active ticket types for an event
router.get('/event/:eventId', TicketTypeController.getTicketTypesByEvent);

// Get ticket count statistics by category (STATIC route - must be before :ticketTypeId)
router.get('/count-by-category', TicketTypeController.getTicketCountByCategory);

// Get all tickets (STATIC route - must be before :ticketTypeId)
router.get('/', TicketTypeController.getAllTickets);

// Update isActive (STATIC route - must be before :ticketTypeId)
router.patch('/:ticketTypeId/is-active', TicketTypeController.updateIsActive);

// Get a single ticket type by ID (DYNAMIC route - must be after all static routes)
router.get('/:ticketTypeId', TicketTypeController.getTicketTypeById);

// Update an existing ticket type (protected)
router.patch('/:ticketTypeId', authenticate, TicketTypeController.updateTicketType);

// Soft delete a ticket type (protected)
router.delete('/:ticketTypeId', authenticate, TicketTypeController.deleteTicketType);

export default router;