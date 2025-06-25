import { Router } from 'express';
import { authenticate } from '../middlewares/AuthMiddleware';
import { TicketTypeController } from '../controller/TicketTypeController';

const router = Router();

// Create a new ticket type (protected)
router.post('/',authenticate, TicketTypeController.createTicketType);

// Get all active ticket types for an event
router.get('/event/:eventId', TicketTypeController.getTicketTypesByEvent);

// Get a single ticket type by ID
router.get('/:ticketTypeId', TicketTypeController.getTicketTypeById);

// Update an existing ticket type (protected)
router.patch('/:ticketTypeId',authenticate, TicketTypeController.updateTicketType);

// Soft delete a ticket type (protected)
router.delete('/:ticketTypeId',authenticate, TicketTypeController.deleteTicketType);

// Get ticket count statistics by category
router.get('/count-by-category', TicketTypeController.getTicketCountByCategory);

export default router;