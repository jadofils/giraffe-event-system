import { Request, Response, NextFunction } from "express";
import { EventStatus } from "../interfaces/Enums/EventStatusEnum";
import { ApprovalStatus, VenueBooking } from "../models/VenueBooking";
import { EventInterface } from "../interfaces/EventInterface";
import { VenueBookingInterface } from "../interfaces/VenueBookingInterface";
import { EventRepository } from "../repositories/eventRepository";
import { AppDataSource } from "../config/Database";
import { Venue } from "../models/Venue";
import { In } from "typeorm";
import { UUID_REGEX } from "../utils/constants";
import { InvoiceService } from "../services/invoice/InvoiceService";
import { InvoiceStatus } from "../interfaces/Enums/InvoiceStatus";
import { VenueStatus } from "../models/Venue";

export class EventController {
  private static eventRepository = new EventRepository();

  static async createEvent(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      // Validate authentication
      if (!req.user || !req.user.userId || !req.user.organizationId) {
        res.status(401).json({
          success: false,
          message: "Unauthorized: User is not properly authenticated.",
        });
        return;
      }

      // Validate UUID format for organizationId and organizerId
      if (!UUID_REGEX.test(req.user.organizationId)) {
        res.status(400).json({
          success: false,
          message: "Invalid organization ID format in token.",
        });
        return;
      }
      if (!UUID_REGEX.test(req.user.userId)) {
        res.status(400).json({
          success: false,
          message: "Invalid user ID format in token.",
        });
        return;
      }

      const eventData: Partial<EventInterface> = {
        ...req.body,
        organizerId: req.user.userId,
        status: EventStatus.PENDING,
      };

      // Create event with organizationId from token
      const createResult = await EventRepository.create(
        eventData,
        req.user.organizationId
      );
      if (!createResult.success || !createResult.data) {
        res.status(400).json({ success: false, message: createResult.message });
        return;
      }

      // Sanitize the event and venues to avoid circular structure
      const sanitizedData = {
        event: sanitizeEvent(createResult.data.event),
        venues: createResult.data.venues?.map(sanitizeVenue),
      };

      res.status(201).json({
        success: true,
        data: sanitizedData,
        message: "Event and venues associated successfully.",
      });
    } catch (error) {
      console.error("Error in createEvent:", error);
      next(error);
    }
  }

  static async approveEvent(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { id } = req.params;
      // Fetch event with all relations needed
      const eventResult = await EventRepository.getById(id);
      if (!eventResult.success || !eventResult.data) {
        res.status(404).json({ message: eventResult.message });
        return;
      }
      // Approve the event
      const updateResult = await EventRepository.update(id, {
        status: EventStatus.APPROVED,
      });
      if (!updateResult.success || !updateResult.data) {
        res.status(500).json({ message: updateResult.message });
        return;
      }
      // Refetch event with all relations (including venueBookings, venues, organizer, organization)
      const event = (await EventRepository.getById(id)).data!;
      // Eager-load venueBookings with venue, user, organization, and venue.organization
      const bookings = await AppDataSource.getRepository(VenueBooking).find({
        where: { eventId: id },
        relations: ["venue", "venue.organization", "user", "organization"],
      });
      // Approve all venue bookings for this event
      for (const booking of bookings) {
        if (booking.approvalStatus !== ApprovalStatus.APPROVED) {
          booking.approvalStatus = ApprovalStatus.APPROVED;
          await AppDataSource.getRepository(VenueBooking).save(booking);
        }
      }
      // Approve all venues for this event
      if (event.venues && event.venues.length > 0) {
        const venueRepo = AppDataSource.getRepository("Venue");
        for (const venue of event.venues) {
          const dbVenue = await venueRepo.findOne({
            where: { venueId: venue.venueId },
          });
          if (dbVenue && dbVenue.status !== VenueStatus.APPROVED) {
            dbVenue.status = VenueStatus.APPROVED;
            await venueRepo.save(dbVenue);
          }
        }
      }
      // Create invoices for each booking (if not already invoiced)
      const invoices = [];
      for (const booking of bookings) {
        // Only create invoice if not already linked
        if (!booking.invoice) {
          const invoice = await InvoiceService.createInvoice({
            userId: booking.userId,
            eventId: booking.eventId,
            venueId: booking.venueId,
            totalAmount: booking.totalAmountDue,
            invoiceDate: new Date(),
            dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            status: InvoiceStatus.PENDING,
          });
          // Optionally, update booking to reference the invoice
          booking.venueInvoiceId = invoice.invoiceId;
          await AppDataSource.getRepository(VenueBooking).save(booking);
          // Attach details for response
          invoices.push({
            ...invoice,
            venue: {
              venueId: booking.venue.venueId,
              venueName: booking.venue.venueName,
              amount: booking.venue.amount,
              location: booking.venue.location,
              organization: booking.venue.organization
                ? {
                    organizationId: booking.venue.organization.organizationId,
                    organizationName:
                      booking.venue.organization.organizationName,
                    contactEmail: booking.venue.organization.contactEmail,
                    contactPhone: booking.venue.organization.contactPhone,
                  }
                : null,
            },
            requester: booking.user
              ? {
                  userId: booking.user.userId,
                  username: booking.user.username,
                  firstName: booking.user.firstName,
                  lastName: booking.user.lastName,
                  email: booking.user.email,
                  phoneNumber: booking.user.phoneNumber,
                }
              : null,
            bookingOrganization: booking.organization
              ? {
                  organizationId: booking.organization.organizationId,
                  organizationName: booking.organization.organizationName,
                  contactEmail: booking.organization.contactEmail,
                  contactPhone: booking.organization.contactPhone,
                }
              : null,
          });
        }
      }
      res.status(200).json({
        success: true,
        message: "Event approved and invoices generated.",
        data: {
          event: {
            eventId: event.eventId,
            eventTitle: event.eventTitle,
            startDate: event.startDate,
            endDate: event.endDate,
            organizer: event.organizer,
            organization: event.organization,
          },
          invoices,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  static async getEventById(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { id } = req.params;
      const result = await EventRepository.getById(id);
      if (!result.success || !result.data) {
        res.status(404).json({ message: result.message });
        return;
      }
      res.json(result.data);
    } catch (error) {
      next(error);
    }
  }

  static async getAllEvents(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const result = await EventRepository.getAll();
      if (!result.success || !result.data) {
        res.status(500).json({ message: result.message });
        return;
      }
      res.json(result.data);
    } catch (error) {
      next(error);
    }
  }

  static async updateEvent(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { id } = req.params;
      const eventData: Partial<EventInterface> = {
        ...req.body,
        status: EventStatus.PENDING,
      };

      const updateResult = await EventRepository.update(id, eventData);
      if (!updateResult.success || !updateResult.data) {
        res.status(500).json({ message: updateResult.message });
        return;
      }
      res.json(updateResult.data);
    } catch (error) {
      next(error);
    }
  }

  static async deleteEvent(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { id } = req.params;
      const result = await EventRepository.delete(id);
      if (!result.success) {
        res.status(500).json({ message: result.message });
        return;
      }
      res.json({ message: "Event deleted" });
    } catch (error) {
      next(error);
    }
  }

  static async bulkCreateVenueBookings(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { organizationId, bookings } = req.body;
      const userId = req.user?.userId; // From AuthMiddleware
      const eventId = req.params.eventId;

      if (!userId) {
        res.status(401).json({
          success: false,
          message: "Unauthorized: User ID not found in token",
        });
        return;
      }

      if (!organizationId) {
        res
          .status(400)
          .json({ success: false, message: "organizationId is required" });
        return;
      }

      if (!Array.isArray(bookings) || bookings.length === 0) {
        res
          .status(400)
          .json({ success: false, message: "Booking array is required" });
        return;
      }

      // Validate venues exist
      const venueRepo = AppDataSource.getRepository(Venue);
      const venueIds = bookings.map((b) => b.venueId);
      const venues = await venueRepo.find({
        where: { venueId: In(venueIds) },
        relations: ["organization"],
      });

      if (venues.length !== bookings.length) {
        res
          .status(404)
          .json({ success: false, message: "One or more venues not found" });
        return;
      }

      const result = await EventRepository.bulkCreateVenueBookings(
        bookings.map((b) => ({
          ...b,
          organizationId,
          approvalStatus: ApprovalStatus.PENDING,
        })),
        userId,
        eventId,
        organizationId
      );

      if (!result.success) {
        res.status(400).json({ success: false, message: result.message });
        return;
      }

      // Format response with full venue data
      const formattedBookings = result.data?.map((booking) => ({
        bookingId: booking.bookingId,
        venue: {
          venueId: booking.venue.venueId,
          venueName: booking.venue.venueName,
          location: booking.venue.location,
          capacity: booking.venue.capacity,
          amount: booking.venue.amount,
          latitude: booking.venue.latitude,
          longitude: booking.venue.longitude,
          googleMapsLink: booking.venue.googleMapsLink,
          managerId: booking.venue.managerId,
          organizationId: booking.venue.organizationId,
          amenities: booking.venue.amenities,
          venueType: booking.venue.venueType,
          contactPerson: booking.venue.contactPerson,
          contactEmail: booking.venue.contactEmail,
          contactPhone: booking.venue.contactPhone,
          websiteURL: booking.venue.websiteURL,
          createdAt: booking.venue.createdAt,
          updatedAt: booking.venue.updatedAt,
          deletedAt: booking.venue.deletedAt,
        },
        eventId: booking.eventId,
        userId: booking.userId,
        organizationId: booking.organizationId,
        totalAmountDue: booking.totalAmountDue,
        venueInvoiceId: booking.venueInvoiceId,
        approvalStatus: booking.approvalStatus,
        notes: booking.notes,
        createdAt: booking.createdAt,
        updatedAt: booking.updatedAt,
        deletedAt: booking.deletedAt,
      }));

      res.status(201).json({
        success: true,
        message: "Bookings created",
        data: formattedBookings,
      });
    } catch (error) {
      console.error("Error in bulkCreateVenueBookings:", error);
      next(error);
    }
  }
  static async approveVenueBooking(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { bookingId } = req.params;
      const updateResult = await EventRepository.updateVenueBooking(bookingId, {
        approvalStatus: ApprovalStatus.APPROVED,
      });
      if (!updateResult.success || !updateResult.data) {
        res.status(500).json({ message: updateResult.message });
        return;
      }

      res.json(updateResult.data);
    } catch (error) {
      next(error);
    }
  }

  static async getVenueBookings(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { eventId } = req.params;
      const eventResult = await EventRepository.getById(eventId);
      if (!eventResult.success || !eventResult.data) {
        res.status(404).json({ message: eventResult.message });
        return;
      }
      res.json(eventResult.data.venueBookings || []);
    } catch (error) {
      next(error);
    }
  }

  static async updateVenueBooking(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { bookingId } = req.params;
      const bookingData: Partial<VenueBookingInterface> = {
        ...req.body,
        approvalStatus: ApprovalStatus.PENDING,
      };

      const updateResult = await EventRepository.updateVenueBooking(
        bookingId,
        bookingData
      );
      if (!updateResult.success || !updateResult.data) {
        res.status(500).json({ message: updateResult.message });
        return;
      }
      res.json(updateResult.data);
    } catch (error) {
      next(error);
    }
  }

  static async deleteVenueBooking(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { eventId, bookingId } = req.params;
      const removeResult = await EventRepository.removeVenueBookings(eventId, [
        bookingId,
      ]);
      if (!removeResult.success) {
        res.status(500).json({ message: removeResult.message });
        return;
      }

      const deleteResult = await EventRepository.deleteVenueBooking(bookingId);
      if (!deleteResult.success) {
        res.status(500).json({ message: deleteResult.message });
        return;
      }
      res.json({ message: "Venue booking deleted" });
    } catch (error) {
      next(error);
    }
  }

  static validate(data: Partial<VenueBookingInterface>): string[] {
    const errors: string[] = [];
    if (!data.eventId) errors.push("eventId is required");
    if (!data.venueId) errors.push("venueId is required");
    // organizerId is set from the token, not required in request body
    if (!data.organizationId) errors.push("organizationId is required");
    return errors;
  }

}
function sanitizeVenue(venue: any) {
  if (!venue) return venue;
  const { events, ...venueWithoutEvents } = venue;
  return venueWithoutEvents;
}

function sanitizeEvent(event: any) {
  if (!event) return event;
  // Remove circular references for venues
  const sanitizedVenues = event.venues?.map(sanitizeVenue);
  return {
    ...event,
    venues: sanitizedVenues,
  };
}
