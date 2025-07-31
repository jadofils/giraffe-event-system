import { Router } from "express";
import { EventTicketTypeController } from "../controller/EventTicketTypeController";
import { authenticate } from "../middlewares/AuthMiddleware";

const router = Router();

router.get(
  "/:eventId/ticket-types/active", // New route for non-inactive ticket types
  EventTicketTypeController.getNonInactiveEventTicketTypes
);

router.use(authenticate); // Apply authentication middleware to all routes

// Create a new ticket type for a specific event
router.post(
  "/:eventId/ticket-types",
  EventTicketTypeController.createEventTicketType
);

// Get all ticket types for a specific event
router.get(
  "/:eventId/ticket-types",
  EventTicketTypeController.getEventTicketTypesByEventId
);

// Get a single ticket type by its ID
router.get(
  "/ticket-types/:ticketTypeId",
  EventTicketTypeController.getEventTicketTypeById
);

// Update a ticket type by its ID
router.patch(
  "/ticket-types/:ticketTypeId",
  EventTicketTypeController.updateEventTicketType
);

// Delete a ticket type by its ID
router.delete(
  "/ticket-types/:ticketTypeId",
  EventTicketTypeController.deleteEventTicketType
);

export default router;
