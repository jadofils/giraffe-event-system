import { Request, Response } from "express";
import { EventTicketTypeRepository } from "../repositories/EventTicketTypeRepository";
import { AppDataSource } from "../config/Database";
import { Event } from "../models/Event Tables/Event";
import { EventTicketType } from "../models/Event Tables/EventTicketType";

export class EventTicketTypeController {
  static async createEventTicketType(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const { eventId } = req.params; // Assuming eventId comes from params now
      let ticketTypesData = req.body; // Can be a single object or an array

      if (!eventId) {
        res
          .status(400)
          .json({ success: false, message: "Event ID is required." });
        return;
      }

      // Ensure ticketTypesData is an array for consistent processing
      if (!Array.isArray(ticketTypesData)) {
        ticketTypesData = [ticketTypesData];
      }

      const eventRepo = AppDataSource.getRepository(Event);
      const event = await eventRepo.findOne({
        where: { eventId },
        relations: ["eventVenues", "ticketTypes"], // Ensure both relations are loaded
      });

      if (!event) {
        res.status(404).json({ success: false, message: "Event not found." });
        return;
      }

      if (!event.isEntryPaid) {
        res.status(400).json({
          success: false,
          message:
            "Cannot create ticket types for a free event. Please mark the event as 'isEntryPaid: true' first.",
        });
        return;
      }

      const results: {
        success: boolean;
        data?: any;
        message: string;
        name?: string;
      }[] = [];
      const newTicketTypesToSave: Partial<EventTicketType>[] = [];

      for (const ticketTypeData of ticketTypesData) {
        const {
          name,
          price,
          quantityAvailable,
          currency,
          description,
          saleStartsAt,
          saleEndsAt,
          isPubliclyAvailable,
          maxPerPerson,
          isActive,
          categoryDiscounts,
          isRefundable,
          refundPolicy,
          transferable,
          ageRestriction,
          specialInstructions,
          status,
          validForDate,
        } = ticketTypeData;

        // Basic validation for individual ticket type
        if (!name || !price || quantityAvailable === undefined) {
          results.push({
            success: false,
            message: `Missing required fields for ticket type: name, price, quantityAvailable. Ticket name attempted: ${
              name || "N/A"
            }`,
            name: name || "N/A",
          });
          continue; // Skip to next ticket type
        }

        // Check for existing ticket type with the same name for this event
        const existingTicketType =
          await EventTicketTypeRepository.findByNameAndEventId(name, eventId);
        if (existingTicketType) {
          results.push({
            success: false,
            message: `Ticket type '${name}': A ticket type with this name already exists for this event.`,
            name: name,
          });
          continue; // Skip to next ticket type
        }

        // Validate total quantity available against event max attendees if it's a public event
        // This block replaces the two previous, potentially conflicting, validation blocks.
        if (event.visibilityScope === "PUBLIC") {
          const currentTotalTicketsAvailable = (event.ticketTypes || []).reduce(
            (sum, tt) => sum + tt.quantityAvailable,
            0
          );
          if (
            event.maxAttendees &&
            currentTotalTicketsAvailable + quantityAvailable >
              event.maxAttendees
          ) {
            results.push({
              success: false,
              message: `Ticket type '${name}': Total quantity of tickets (${
                currentTotalTicketsAvailable + quantityAvailable
              }) would exceed event's maximum attendees (${
                event.maxAttendees
              }).`,
              name: name,
            });
            continue; // Skip to next ticket type
          }
        }

        newTicketTypesToSave.push({
          eventId,
          name,
          price,
          quantityAvailable,
          currency,
          description,
          saleStartsAt: saleStartsAt ? new Date(saleStartsAt) : undefined,
          saleEndsAt: saleEndsAt ? new Date(saleEndsAt) : undefined,
          validForDate: validForDate, // Pass as string (YYYY-MM-DD) or undefined/null
          isPubliclyAvailable,
          maxPerPerson,
          isActive,
          categoryDiscounts,
          isRefundable,
          refundPolicy,
          transferable,
          ageRestriction,
          specialInstructions,
          status,
        });
      }

      if (newTicketTypesToSave.length === 0) {
        res.status(400).json({
          success: false,
          message: "No valid ticket types to create.",
          details: results,
        });
        return;
      }

      const createdTicketTypes =
        await EventTicketTypeRepository.createEventTicketTypeBatch(
          newTicketTypesToSave
        );

      createdTicketTypes.forEach((tt) => {
        results.push({
          success: true,
          data: tt,
          message: `Ticket type '${tt.name}' created successfully.`,
          name: tt.name,
        });
      });

      const allSuccessful = results.every((r) => r.success);
      const finalStatus = allSuccessful ? 201 : 207; // 207 Multi-Status if some failed

      res.status(finalStatus).json({
        success: allSuccessful, // Overall success status
        message: allSuccessful
          ? "All ticket types created successfully."
          : "Some ticket types could not be created.",
        details: results, // Detailed results for each ticket type
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Failed to create event ticket type(s).",
      });
    }
  }

  static async getEventTicketTypesByEventId(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const { eventId } = req.params;
      if (!eventId) {
        res
          .status(400)
          .json({ success: false, message: "Event ID is required." });
        return;
      }

      const ticketTypes =
        await EventTicketTypeRepository.getEventTicketTypesByEventId(eventId);
      if (!ticketTypes || ticketTypes.length === 0) {
        res.status(404).json({
          success: false,
          message: "No ticket types found for this event.",
        });
        return;
      }

      res.status(200).json({ success: true, data: ticketTypes });
    } catch (error) {
      res.status(500).json({
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Failed to fetch event ticket types.",
      });
    }
  }

  static async getNonInactiveEventTicketTypes(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const { eventId } = req.params;
      if (!eventId) {
        res
          .status(400)
          .json({ success: false, message: "Event ID is required." });
        return;
      }

      const ticketTypes =
        await EventTicketTypeRepository.getNonInactiveTicketTypesByEventId(
          eventId
        );
      if (!ticketTypes || ticketTypes.length === 0) {
        res.status(404).json({
          success: false,
          message: "No active ticket types found for this event.",
        });
        return;
      }

      res.status(200).json({ success: true, data: ticketTypes });
    } catch (error) {
      res.status(500).json({
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Failed to fetch non-inactive event ticket types.",
      });
    }
  }

  static async getEventTicketTypeById(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const { ticketTypeId } = req.params;
      if (!ticketTypeId) {
        res
          .status(400)
          .json({ success: false, message: "Ticket type ID is required." });
        return;
      }

      const ticketType = await EventTicketTypeRepository.getEventTicketTypeById(
        ticketTypeId
      );
      if (!ticketType) {
        res
          .status(404)
          .json({ success: false, message: "Ticket type not found." });
        return;
      }

      res.status(200).json({ success: true, data: ticketType });
    } catch (error) {
      res.status(500).json({
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Failed to fetch event ticket type.",
      });
    }
  }

  static async updateEventTicketType(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const { ticketTypeId } = req.params;
      const updates = req.body;

      if (!ticketTypeId) {
        res
          .status(400)
          .json({ success: false, message: "Ticket type ID is required." });
        return;
      }

      // Fetch existing ticket type to get current quantities and event ID
      const existingTicketType =
        await EventTicketTypeRepository.getEventTicketTypeById(ticketTypeId);
      if (!existingTicketType) {
        res
          .status(404)
          .json({ success: false, message: "Ticket type not found." });
        return;
      }

      // If quantityAvailable is being updated, perform maxAttendees validation
      if (updates.quantityAvailable !== undefined) {
        const eventRepo = AppDataSource.getRepository(Event);
        const event = await eventRepo.findOne({
          where: { eventId: existingTicketType.eventId },
        });
        if (
          event &&
          event.maxAttendees !== null &&
          event.maxAttendees !== undefined
        ) {
          const currentTotalTicketsExcludingThisType =
            await EventTicketTypeRepository.getTotalTicketsAvailableByEventId(
              existingTicketType.eventId,
              ticketTypeId // Exclude current ticket type from total for accurate calculation
            );
          const newTotalTickets =
            currentTotalTicketsExcludingThisType + updates.quantityAvailable;

          if (newTotalTickets > event.maxAttendees) {
            res.status(400).json({
              success: false,
              message: `Updating quantity to ${updates.quantityAvailable} would make total tickets for event (${newTotalTickets}) exceed event's maximum attendees (${event.maxAttendees}).`,
            });
            return;
          }
        }
      }

      // Handle date string to Date object conversion for saleStartsAt and saleEndsAt
      if (updates.saleStartsAt) {
        updates.saleStartsAt = new Date(updates.saleStartsAt);
      }
      if (updates.saleEndsAt) {
        updates.saleEndsAt = new Date(updates.saleEndsAt);
      }
      if (updates.validForDate) {
        // validForDate is a 'date' column in DB, so pass as string directly
        updates.validForDate = updates.validForDate;
      }
      // Handle categoryDiscounts which might be sent as a string (if from form-data)
      if (typeof updates.categoryDiscounts === "string") {
        try {
          updates.categoryDiscounts = JSON.parse(updates.categoryDiscounts);
        } catch (e) {
          // Log error or handle invalid JSON gracefully
          console.error("Failed to parse categoryDiscounts JSON string:", e);
          res.status(400).json({
            success: false,
            message: "Invalid format for categoryDiscounts.",
          });
          return;
        }
      }

      const updatedTicketType =
        await EventTicketTypeRepository.updateEventTicketType(
          ticketTypeId,
          updates
        );

      if (!updatedTicketType) {
        res.status(404).json({
          success: false,
          message: "Ticket type not found or failed to update.",
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: updatedTicketType,
        message: "Event ticket type updated successfully.",
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Failed to update event ticket type.",
      });
    }
  }

  static async deleteEventTicketType(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const { ticketTypeId } = req.params;
      const authenticatedReq = req as any;
      const currentUser = authenticatedReq.user; // User from authentication middleware

      if (!ticketTypeId) {
        res
          .status(400)
          .json({ success: false, message: "Ticket type ID is required." });
        return;
      }

      const ticketTypeRepo = AppDataSource.getRepository(EventTicketType);
      const ticketType = await ticketTypeRepo.findOne({
        where: { ticketTypeId },
        relations: ["registrations"], // Load registrations to check if tickets are sold
      });

      if (!ticketType) {
        res.status(404).json({
          success: false,
          message: "Ticket type not found.",
        });
        return;
      }

      // Check if there are any registrations (sold tickets) for this ticket type
      if (ticketType.registrations && ticketType.registrations.length > 0) {
        // If registrations exist, only allow deletion by an admin
        if (currentUser?.role?.roleName !== "ADMIN") {
          res.status(403).json({
            success: false,
            message:
              "Cannot delete ticket type: Tickets have already been sold. Only administrators can delete sold ticket types.",
          });
          return;
        }
        // Admin can proceed, but maybe with a warning or forced flag in a real scenario.
        // For now, simply allow if admin.
      }

      const deleteResult = await EventTicketTypeRepository.deleteEventTicketType(
        ticketTypeId
      );

      if (deleteResult.affected === 0) {
        res.status(404).json({
          success: false,
          message: "Ticket type not found or already deleted.",
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: "Event ticket type deleted successfully.",
      });
    } catch (error) {
      console.error("Error deleting event ticket type:", error);
      res.status(500).json({
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Failed to delete event ticket type.",
      });
    }
  }
}
