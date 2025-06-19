import { Request, Response } from "express";
import { AuthenticatedRequest } from "../middlewares/AuthMiddleware";
import { EventInterface } from "../interfaces/EventInterface";
import { EventStatus } from "../interfaces/Index";
import { EventRepository } from "../repositories/eventRepository";
import { VenueRepository } from "../repositories/venueRepository";

export class EventController {
  // Create a single event
  static async create(req: AuthenticatedRequest, res: Response): Promise<void> {
    const organizerId = req.user?.userId;
    const {
      eventTitle,
      eventType,
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
    }: Partial<EventInterface> = req.body;

    if (!organizerId) {
      res
        .status(401)
        .json({ success: false, message: "Authentication required." });
      return;
    }

    if (
      !eventTitle ||
      !eventType ||
      !organizationId ||
      !startDate ||
      !endDate
    ) {
      res.status(400).json({
        success: false,
        message:
          "Missing required fields: eventTitle, eventType, organizationId, startDate, endDate.",
      });
      return;
    }

    try {
      // Validate venues if provided
      if (venues && Array.isArray(venues) && venues.length > 0) {
        const venueIds = venues.map((v) => v.venueId).filter(Boolean);
        for (const venueId of venueIds) {
          const venueResult = await VenueRepository.getById(venueId);
          if (!venueResult) {
            res
              .status(404)
              .json({
                success: false,
                message: `Venue with ID ${venueId} not found.`,
              });
            return;
          }
          // --- Venue conflict check ---
          const eventsResult = await EventRepository.getByVenueId(venueId);
          if (eventsResult.success && eventsResult.data) {
            const newStart = startTime
              ? new Date(`${startDate}T${startTime}:00Z`)
              : new Date(startDate);
            const newEnd = endTime
              ? new Date(`${endDate}T${endTime}:00Z`)
              : new Date(endDate);
            const conflictingEvents = eventsResult.data.filter((event) => {
              const eventStart = event.startTime
                ? new Date(
                    `${event.startDate.toISOString().split("T")[0]}T${
                      event.startTime
                    }:00Z`
                  )
                : event.startDate;
              const eventEnd = event.endTime
                ? new Date(
                    `${event.endDate.toISOString().split("T")[0]}T${
                      event.endTime
                    }:00Z`
                  )
                : event.endDate;
              return (
                eventStart <= newEnd &&
                eventEnd >= newStart &&
                event.status !== "CANCELLED"
              );
            });
            if (conflictingEvents.length > 0) {
              return res.status(400).json({
                success: false,
                message: `Venue is already booked for the requested period by another event.`,
                conflicts: conflictingEvents.map((e) => ({
                  eventId: e.eventId,
                  eventTitle: e.eventTitle,
                  startDate: e.startDate,
                  endDate: e.endDate,
                  startTime: e.startTime,
                  endTime: e.endTime,
                  status: e.status,
                })),
              });
            }
          }
        }
      }

      const newEventData: Partial<EventInterface> = {
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

      const createResult = await EventRepository.create(newEventData);
      if (!createResult.success || !createResult.data) {
        res.status(400).json({ success: false, message: createResult.message });
        return;
      }

      const saveResult = await EventRepository.save(createResult.data);
      if (saveResult.success && saveResult.data) {
        res
          .status(201)
          .json({
            success: true,
            message: "Event created successfully.",
            data: saveResult.data,
          });
      } else {
        res
          .status(500)
          .json({
            success: false,
            message: saveResult.message || "Failed to save event.",
          });
      }
    } catch (err) {
      console.error("Error creating event:", err);
      res
        .status(500)
        .json({
          success: false,
          message: "Failed to create event due to a server error.",
        });
    }
  }

  // Create multiple events
  static async createMultiple(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    const organizerId = req.user?.userId;
    const eventsData: Partial<EventInterface>[] = req.body.events;

    if (!organizerId) {
      res
        .status(401)
        .json({ success: false, message: "Authentication required." });
      return;
    }

    if (!eventsData || !Array.isArray(eventsData) || eventsData.length === 0) {
      res
        .status(400)
        .json({
          success: false,
          message: "An array of event data is required.",
        });
      return;
    }

    try {
      // Validate venues in each event
      for (const eventData of eventsData) {
        if (
          eventData.venues &&
          Array.isArray(eventData.venues) &&
          eventData.venues.length > 0
        ) {
          const venueIds = eventData.venues
            .map((v) => v.venueId)
            .filter(Boolean);
          for (const venueId of venueIds) {
            const venueResult = await VenueRepository.getById(venueId);
            if (!venueResult) {
              res
                .status(404)
                .json({
                  success: false,
                  message: `Venue with ID ${venueId} not found.`,
                });
              return;
            }
          }
        }
        // Ensure organizerId is set for each event
        eventData.organizerId = organizerId;
      }

      const createResult = await EventRepository.createMultiple(eventsData);
      res.status(createResult.success ? 201 : 207).json({
        success: createResult.success,
        message: createResult.success
          ? "All events created successfully."
          : "Some events failed to create.",
        data: createResult.events,
        errors: createResult.errors,
      });
    } catch (err) {
      console.error("Error creating multiple events:", err);
      res
        .status(500)
        .json({
          success: false,
          message: "Failed to create events due to a server error.",
        });
    }
  }

  // Get event by ID
  static async getById(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    if (!id) {
      res
        .status(400)
        .json({ success: false, message: "Event ID is required." });
      return;
    }

    try {
      const result = await EventRepository.getById(id);
      if (result.success && result.data) {
        res.status(200).json({ success: true, data: result.data });
      } else {
        res
          .status(404)
          .json({
            success: false,
            message: result.message || "Event not found.",
          });
      }
    } catch (err) {
      console.error("Error getting event by ID:", err);
      res
        .status(500)
        .json({ success: false, message: "Failed to get event by ID." });
    }
  }

  // Get events by organizer ID
  static async getByOrganizerId(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    const organizerId = req.user?.userId;
    if (!organizerId) {
      res
        .status(401)
        .json({ success: false, message: "Authentication required." });
      return;
    }

    try {
      const result = await EventRepository.getByOrganizerId(organizerId);
      if (result.success && result.data) {
        res.status(200).json({ success: true, data: result.data });
      } else {
        res
          .status(404)
          .json({
            success: false,
            message: result.message || "No events found for this organizer.",
          });
      }
    } catch (err) {
      console.error("Error getting events by organizer ID:", err);
      res
        .status(500)
        .json({
          success: false,
          message: "Failed to get events by organizer ID.",
        });
    }
  }

  // Get events by organization ID
  static async getByOrganizationId(req: Request, res: Response): Promise<void> {
    const { organizationId } = req.query;
    if (!organizationId || typeof organizationId !== "string") {
      res
        .status(400)
        .json({ success: false, message: "Organization ID is required." });
      return;
    }

    try {
      const result = await EventRepository.getByOrganizationId(organizationId);
      if (result.success && result.data) {
        res.status(200).json({ success: true, data: result.data });
      } else {
        res
          .status(404)
          .json({
            success: false,
            message: result.message || "No events found for this organization.",
          });
      }
    } catch (err) {
      console.error("Error getting events by organization ID:", err);
      res
        .status(500)
        .json({
          success: false,
          message: "Failed to get events by organization ID.",
        });
    }
  }

  // Get events by venue ID
  static async getByVenueId(req: Request, res: Response): Promise<void> {
    const { venueId } = req.query;
    if (!venueId || typeof venueId !== "string") {
      res
        .status(400)
        .json({ success: false, message: "Venue ID is required." });
      return;
    }

    try {
      const result = await EventRepository.getByVenueId(venueId);
      if (result.success && result.data) {
        res.status(200).json({ success: true, data: result.data });
      } else {
        res
          .status(404)
          .json({
            success: false,
            message: result.message || "No events found for this venue.",
          });
      }
    } catch (err) {
      console.error("Error getting events by venue ID:", err);
      res
        .status(500)
        .json({ success: false, message: "Failed to get events by venue ID." });
    }
  }

  // Get events by status
  static async getByStatus(req: Request, res: Response): Promise<void> {
    const { status } = req.query;
    if (
      !status ||
      !Object.values(EventStatus).includes(status as EventStatus)
    ) {
      res
        .status(400)
        .json({ success: false, message: "Valid event status is required." });
      return;
    }

    try {
      const result = await EventRepository.getByStatus(status as EventStatus);
      if (result.success && result.data) {
        res.status(200).json({ success: true, data: result.data });
      } else {
        res
          .status(404)
          .json({
            success: false,
            message: result.message || `No events found with status ${status}.`,
          });
      }
    } catch (err) {
      console.error("Error getting events by status:", err);
      res
        .status(500)
        .json({ success: false, message: "Failed to get events by status." });
    }
  }

  // Get events by date range
  static async getByDateRange(req: Request, res: Response): Promise<void> {
    const { startDate, endDate } = req.query;
    if (
      !startDate ||
      !endDate ||
      typeof startDate !== "string" ||
      typeof endDate !== "string"
    ) {
      res
        .status(400)
        .json({ success: false, message: "Start and end dates are required." });
      return;
    }

    try {
      const start = new Date(startDate);
      const end = new Date(endDate);
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        res
          .status(400)
          .json({ success: false, message: "Invalid date format." });
        return;
      }

      const result = await EventRepository.getByDateRange(start, end);
      if (result.success && result.data) {
        res.status(200).json({ success: true, data: result.data });
      } else {
        res
          .status(404)
          .json({
            success: false,
            message:
              result.message || "No events found in the specified date range.",
          });
      }
    } catch (err) {
      console.error("Error getting events by date range:", err);
      res
        .status(500)
        .json({
          success: false,
          message: "Failed to get events by date range.",
        });
    }
  }

  // Get all events
  static async getAll(req: Request, res: Response): Promise<void> {
    try {
      const result = await EventRepository.getAll();
      if (result.success && result.data) {
        res.status(200).json({ success: true, data: result.data });
      } else {
        res
          .status(200)
          .json({
            success: false,
            message: result.message || "No events found.",
          });
      }
    } catch (err) {
      console.error("Error getting all events:", err);
      res
        .status(500)
        .json({ success: false, message: "Failed to get all events." });
    }
  }

  // Update event
  static async update(req: AuthenticatedRequest, res: Response): Promise<void> {
    const { id } = req.params;
    const organizerId = req.user?.userId;
    const {
      eventTitle,
      eventType,
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
    }: Partial<EventInterface> = req.body;

    if (!id) {
      res
        .status(400)
        .json({ success: false, message: "Event ID is required." });
      return;
    }

    if (!organizerId) {
      res
        .status(401)
        .json({ success: false, message: "Authentication required." });
      return;
    }

    try {
      // Validate venues if provided
      if (venues && Array.isArray(venues) && venues.length > 0) {
        const venueIds = venues.map((v) => v.venueId).filter(Boolean);
        for (const venueId of venueIds) {
          const venueResult = await VenueRepository.getById(venueId);
          if (!venueResult) {
            res
              .status(404)
              .json({
                success: false,
                message: `Venue with ID ${venueId} not found.`,
              });
            return;
          }
        }
      }

      const updateData: Partial<EventInterface> = {
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

      const updateResult = await EventRepository.update(id, updateData);
      if (updateResult.success && updateResult.data) {
        res
          .status(200)
          .json({
            success: true,
            message: "Event updated successfully.",
            data: updateResult.data,
          });
      } else {
        res
          .status(404)
          .json({
            success: false,
            message: updateResult.message || "Event not found.",
          });
      }
    } catch (err) {
      console.error("Error updating event:", err);
      res
        .status(500)
        .json({
          success: false,
          message: "Failed to update event due to a server error.",
        });
    }
  }

  // Delete event
  static async delete(req: AuthenticatedRequest, res: Response): Promise<void> {
    const { id } = req.params;
    const organizerId = req.user?.userId;

    if (!id) {
      res
        .status(400)
        .json({ success: false, message: "Event ID is required." });
      return;
    }

    if (!organizerId) {
      res
        .status(401)
        .json({ success: false, message: "Authentication required." });
      return;
    }

    try {
      const deleteResult = await EventRepository.delete(id);
      if (deleteResult.success) {
        res
          .status(200)
          .json({
            success: true,
            message: deleteResult.message || "Event deleted successfully.",
          });
      } else {
        res
          .status(404)
          .json({
            success: false,
            message: deleteResult.message || "Event not found.",
          });
      }
    } catch (err) {
      console.error("Error deleting event:", err);
      res
        .status(500)
        .json({ success: false, message: "Failed to delete event." });
    }
  }

  // Assign venues to an event
  static async assignVenues(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    const organizerId = req.user?.userId;
    const { eventId, venueIds }: { eventId: string; venueIds: string[] } =
      req.body;

    if (!organizerId) {
      res
        .status(401)
        .json({ success: false, message: "Authentication required." });
      return;
    }

    if (
      !eventId ||
      !venueIds ||
      !Array.isArray(venueIds) ||
      venueIds.length === 0
    ) {
      res
        .status(400)
        .json({
          success: false,
          message: "Event ID and an array of venue IDs are required.",
        });
      return;
    }

    try {
      // Validate venues
      for (const venueId of venueIds) {
        const venueResult = await VenueRepository.getById(venueId);
        if (!venueResult) {
          res
            .status(404)
            .json({
              success: false,
              message: `Venue with ID ${venueId} not found.`,
            });
          return;
        }
      }

      const result = await EventRepository.assignVenues(eventId, venueIds);
      if (result.success) {
        res
          .status(200)
          .json({
            success: true,
            message: result.message || "Venues assigned successfully.",
          });
      } else {
        res
          .status(400)
          .json({
            success: false,
            message: result.message || "Failed to assign venues.",
          });
      }
    } catch (err) {
      console.error("Error assigning venues:", err);
      res
        .status(500)
        .json({
          success: false,
          message: "Failed to assign venues due to a server error.",
        });
    }
  }

  // Remove venues from an event
  static async removeVenues(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    const organizerId = req.user?.userId;
    const { eventId, venueIds }: { eventId: string; venueIds: string[] } =
      req.body;

    if (!organizerId) {
      res
        .status(401)
        .json({ success: false, message: "Authentication required." });
      return;
    }

    if (
      !eventId ||
      !venueIds ||
      !Array.isArray(venueIds) ||
      venueIds.length === 0
    ) {
      res
        .status(400)
        .json({
          success: false,
          message: "Event ID and an array of venue IDs are required.",
        });
      return;
    }

    try {
      // Validate venues
      for (const venueId of venueIds) {
        const venueResult = await VenueRepository.getById(venueId);
        if (!venueResult) {
          res
            .status(404)
            .json({
              success: false,
              message: `Venue with ID ${venueId} not found.`,
            });
          return;
        }
      }

      const result = await EventRepository.removeVenues(eventId, venueIds);
      if (result.success) {
        res
          .status(200)
          .json({
            success: true,
            message: result.message || "Venues removed successfully.",
          });
      } else {
        res
          .status(400)
          .json({
            success: false,
            message: result.message || "Failed to remove venues.",
          });
      }
    } catch (err) {
      console.error("Error removing venues:", err);
      res
        .status(500)
        .json({
          success: false,
          message: "Failed to remove venues due to a server error.",
        });
    }
  }
}
