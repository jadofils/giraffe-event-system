import { Request, Response, NextFunction } from "express";
import { EventStatus } from "../interfaces/Enums/EventStatusEnum";
import { EventInterface } from "../interfaces/EventInterface";
import { EventRepository } from "../repositories/eventRepository";
import { AppDataSource } from "../config/Database";
import { UUID_REGEX } from "../utils/constants";
import { Venue } from "../models/Venue Tables/Venue";
import { EventVenue } from "../models/Event Tables/EventVenue";
import { EventGuest } from "../models/Event Tables/EventGuest";
import { User } from "../models/User";
import { Organization } from "../models/Organization";
import { VenueVariable } from "../models/Venue Tables/VenueVariable";
import { CacheService } from "../services/CacheService";
import { BookingValidationService } from "../services/bookings/BookingValidationService";
import { BookingDateDTO } from "../interfaces/BookingDateInterface";

export class EventController {
  private static eventRepository = new EventRepository();

  static async createEvent(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const {
        eventTitle,
        eventType,
        dates,
        startDate,
        endDate,
        startTime,
        endTime,
        description,
        guests,
        venueId,
        visibilityScope,
        eventOrganizerId,
      } = req.body;

      // Fetch venue WITH venueVariables
      const venueRepo = AppDataSource.getRepository(Venue);
      const venue = await venueRepo.findOne({
        where: { venueId },
        relations: ["venueVariables"],
      });
      if (!venue) {
        res.status(404).json({ success: false, message: "Venue not found." });
        return;
      }

      // Handle both old and new format
      let bookingDates: BookingDateDTO[] = [];

      if (dates) {
        // New format with explicit dates array
        bookingDates = dates;
      } else if (startDate && endDate) {
        // Old format with date range
        const start = new Date(startDate);
        const end = new Date(endDate);

        // Create array of dates between start and end
        for (
          let date = new Date(start);
          date <= end;
          date.setDate(date.getDate() + 1)
        ) {
          if (venue.bookingType === "HOURLY" && startTime && endTime) {
            // For hourly bookings, extract hours from time range
            const startHour = parseInt(startTime.split(":")[0]);
            const endHour = parseInt(endTime.split(":")[0]);
            const hours = [];
            for (let h = startHour; h <= endHour; h++) {
              hours.push(h);
            }
            bookingDates.push({
              date: date.toISOString().split("T")[0],
              hours,
            });
          } else {
            // For daily bookings, no hours needed
            bookingDates.push({
              date: date.toISOString().split("T")[0],
            });
          }
        }
      } else {
        res.status(400).json({
          success: false,
          message: "Either dates array or startDate/endDate is required",
        });
        return;
      }

      // Validate dates based on venue booking type
      try {
        const { isAvailable, unavailableDates } =
          await BookingValidationService.validateBookingDates(
            venue,
            bookingDates
          );

        if (!isAvailable) {
          res.status(400).json({
            success: false,
            message: "Some requested dates/hours are not available",
            unavailableDates,
          });
          return;
        }
      } catch (error) {
        res.status(400).json({
          success: false,
          message: error instanceof Error ? error.message : "Validation failed",
        });
        return;
      }

      // Get date range for event record
      const { startDate: firstDate, endDate: lastDate } =
        BookingValidationService.getDateRange(bookingDates);

      // Fetch venueAmount from VenueVariable
      if (!venue.venueVariables || venue.venueVariables.length === 0) {
        res.status(400).json({
          success: false,
          message: "No venue variable (amount) found for this venue.",
        });
        return;
      }
      const venueAmount = venue.venueVariables[0].venueAmount;

      // Determine if event is public
      const isPublic = visibilityScope === "PUBLIC";
      if (isPublic && !description) {
        res.status(400).json({
          success: false,
          message: "Description is required for public events.",
        });
        return;
      }

      // Determine eventOrganizerType
      let eventOrganizerType: "USER" | "ORGANIZATION" = "USER";
      const userRepo = AppDataSource.getRepository(User);
      const orgRepo = AppDataSource.getRepository(Organization);
      const user = await userRepo.findOne({
        where: { userId: eventOrganizerId },
      });
      if (!user) {
        const org = await orgRepo.findOne({
          where: { organizationId: eventOrganizerId },
        });
        if (org) {
          eventOrganizerType = "ORGANIZATION";
        } else {
          res.status(400).json({
            success: false,
            message:
              "Invalid eventOrganizerId: not found as user or organization.",
          });
          return;
        }
      }

      // Set event statuses and fields
      let eventStatus = EventStatus.DRAFTED;
      if (isPublic && req.body.eventStatus === EventStatus.REQUESTED) {
        eventStatus = EventStatus.REQUESTED;
      }

      const eventData: any = {
        eventName: eventTitle,
        eventType,
        startDate: firstDate,
        endDate: lastDate,
        visibilityScope,
        eventStatus,
        publishStatus: "DRAFT",
        eventOrganizerId,
        eventOrganizerType,
      };

      if (isPublic) {
        eventData.eventDescription = description;
        eventData.maxAttendees = req.body.maxAttendees;
        eventData.imageURL = req.body.imageURL;
        eventData.socialMediaLinks = req.body.socialMediaLinks;
        eventData.isEntryPaid = req.body.isEntryPaid;
        eventData.expectedGuests = req.body.expectedGuests;
        eventData.specialNotes = req.body.specialNotes;
        eventData.eventPhoto = req.body.eventPhoto;
        eventData.eventOtherType = req.body.eventOtherType;
      }

      const guestList = isPublic && Array.isArray(guests) ? guests : [];

      // Create event with booking dates
      const result = await EventRepository.createEventWithRelations(
        eventData,
        venue,
        guestList,
        venueAmount,
        bookingDates
      );

      if (!result.success) {
        res.status(400).json({ success: false, message: result.message });
        return;
      }

      // Invalidate cache for all managers of this venue
      const venueVariableRepo = AppDataSource.getRepository(VenueVariable);
      const venueVariables = await venueVariableRepo.find({
        where: { venue: { venueId: venue.venueId } },
        relations: ["manager"],
      });
      for (const vv of venueVariables) {
        if (vv.manager && vv.manager.userId) {
          await CacheService.invalidate(
            `venue-bookings:manager:${vv.manager.userId}`
          );
        }
      }

      res.status(201).json({
        success: true,
        data: result.data,
        message: "Event created successfully.",
      });
      return;
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
      const result = await EventRepository.getAllEventsWithRelations();
      if (!result.success) {
        res.status(500).json({ success: false, message: result.message });
        return;
      }
      res.status(200).json({ success: true, data: result.data });
      return;
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
      const result = await EventRepository.getEventByIdWithRelations(id);
      if (!result.success) {
        res.status(404).json({ success: false, message: result.message });
        return;
      }
      res.status(200).json({ success: true, data: result.data });
      return;
    } catch (error) {
      next(error);
    }
  }

  static async requestPublish(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { id } = req.params;
      // Optionally: validate all required fields for public events here
      const updateResult = await EventRepository.updateEventStatus(id, {
        eventStatus: EventStatus.REQUESTED,
        // publishStatus remains DRAFT
      });
      if (!updateResult.success) {
        res.status(400).json({ success: false, message: updateResult.message });
        return;
      }
      res.status(200).json({
        success: true,
        data: updateResult.data,
        message: "Event submitted for publishing/approval.",
      });
    } catch (error) {
      next(error);
    }
  }

  //   static async approveEvent(
  //     req: Request,
  //     res: Response,
  //     next: NextFunction
  //   ): Promise<void> {
  //     try {
  //       const { id } = req.params;
  //       // Fetch event with all relations needed
  //       const eventResult = await EventRepository.getById(id);
  //       if (!eventResult.success || !eventResult.data) {
  //         res.status(404).json({ message: eventResult.message });
  //         return;
  //       }
  //       // Approve the event
  //       const updateResult = await EventRepository.update(id, {
  //         status: EventStatus.APPROVED,
  //       });
  //       if (!updateResult.success || !updateResult.data) {
  //         res.status(500).json({ message: updateResult.message });
  //         return;
  //       }
  //       // Refetch event with all relations (including venueBookings, venues, organizer, organization)
  //       const event = (await EventRepository.getById(id)).data!;

  //       // === REJECT/CANCEL CONFLICTING PENDING EVENTS ===
  //       const { rejectConflictingPendingEvents } = await import(
  //         "../middlewares/rejectConflictingPendingEvents"
  //       );
  //       await rejectConflictingPendingEvents(event);
  //       // Eager-load venueBookings with venue, user, organization, and venue.organization
  //       const bookings = await AppDataSource.getRepository(VenueBooking).find({
  //         where: { eventId: id },
  //         relations: ["venue", "venue.organization", "user", "organization"],
  //       });
  //       // Approve all venue bookings for this event
  //       for (const booking of bookings) {
  //         if (booking.approvalStatus !== ApprovalStatus.APPROVED) {
  //           booking.approvalStatus = ApprovalStatus.APPROVED;
  //           await AppDataSource.getRepository(VenueBooking).save(booking);
  //         }
  //       }
  //       // Approve all venues for this event
  //       if (event.venues && event.venues.length > 0) {
  //         const venueRepo = AppDataSource.getRepository("Venue");
  //         for (const venue of event.venues) {
  //           const dbVenue = await venueRepo.findOne({
  //             where: { venueId: venue.venueId },
  //           });
  //           if (dbVenue && dbVenue.status !== VenueStatus.APPROVED) {
  //             dbVenue.status = VenueStatus.APPROVED;
  //             await venueRepo.save(dbVenue);
  //           }
  //         }
  //       }
  //       // Create invoices for each booking (if not already invoiced)
  //       const invoices = [];
  //       for (const booking of bookings) {
  //         // Only create invoice if not already linked
  //         if (!booking.invoice) {
  //           const invoice = await InvoiceService.createInvoice({
  //             userId: booking.userId,
  //             eventId: booking.eventId,
  //             venueId: booking.venueId,
  //             totalAmount: booking.totalAmountDue,
  //             invoiceDate: new Date(),
  //             dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  //             status: InvoiceStatus.PENDING,
  //           });
  //           // Optionally, update booking to reference the invoice
  //           booking.venueInvoiceId = invoice.invoiceId;
  //           await AppDataSource.getRepository(VenueBooking).save(booking);
  //           // Attach details for response
  //           invoices.push({
  //             ...invoice,
  //             venue: {
  //               venueId: booking.venue.venueId,
  //               venueName: booking.venue.venueName,
  //               amount: booking.venue.venueVariables,
  //               location: booking.venue.venueLocation,
  //               organization: booking.venue.organization
  //                 ? {
  //                     organizationId: booking.venue.organization.organizationId,
  //                     organizationName:
  //                       booking.venue.organization.organizationName,
  //                     contactEmail: booking.venue.organization.contactEmail,
  //                     contactPhone: booking.venue.organization.contactPhone,
  //                   }
  //                 : null,
  //             },
  //             requester: booking.user
  //               ? {
  //                   userId: booking.user.userId,
  //                   username: booking.user.username,
  //                   firstName: booking.user.firstName,
  //                   lastName: booking.user.lastName,
  //                   email: booking.user.email,
  //                   phoneNumber: booking.user.phoneNumber,
  //                 }
  //               : null,
  //             bookingOrganization: booking.organization
  //               ? {
  //                   organizationId: booking.organization.organizationId,
  //                   organizationName: booking.organization.organizationName,
  //                   contactEmail: booking.organization.contactEmail,
  //                   contactPhone: booking.organization.contactPhone,
  //                 }
  //               : null,
  //           });
  //         }
  //       }
  //       res.status(200).json({
  //         success: true,
  //         message: "Event approved and invoices generated.",
  //         data: {
  //           event: {
  //             eventId: event.eventId,
  //             eventTitle: event.eventTitle,
  //             startDate: event.startDate,
  //             endDate: event.endDate,
  //             organizer: event.organizer,
  //             organization: event.organization,
  //           },
  //           invoices,
  //         },
  //       });
  //     } catch (error) {
  //       next(error);
  //     }
  //   }

  //   static async getEventById(
  //     req: Request,
  //     res: Response,
  //     next: NextFunction
  //   ): Promise<void> {
  //     try {
  //       const { id } = req.params;
  //       const result = await EventRepository.getById(id);
  //       if (!result.success || !result.data) {
  //         res.status(404).json({ message: result.message });
  //         return;
  //       }
  //       res.json(result.data);
  //     } catch (error) {
  //       next(error);
  //     }
  //   }

  //   static async getAllEvents(
  //     req: Request,
  //     res: Response,
  //     next: NextFunction
  //   ): Promise<void> {
  //     try {
  //       const result = await EventRepository.getAll();
  //       if (!result.success || !result.data) {
  //         res.status(500).json({ message: result.message });
  //         return;
  //       }
  //       res.json(result.data);
  //     } catch (error) {
  //       next(error);
  //     }
  //   }

  //   static async updateEvent(
  //     req: Request,
  //     res: Response,
  //     next: NextFunction
  //   ): Promise<void> {
  //     try {
  //       const { id } = req.params;
  //       const eventData: Partial<EventInterface> = {
  //         ...req.body,
  //         status: EventStatus.PENDING,
  //       };

  //       const updateResult = await EventRepository.update(id, eventData);
  //       if (!updateResult.success || !updateResult.data) {
  //         res.status(500).json({ message: updateResult.message });
  //         return;
  //       }
  //       res.json(updateResult.data);
  //     } catch (error) {
  //       next(error);
  //     }
  //   }

  //   static async deleteEvent(
  //     req: Request,
  //     res: Response,
  //     next: NextFunction
  //   ): Promise<void> {
  //     try {
  //       const { id } = req.params;
  //       const result = await EventRepository.delete(id);
  //       if (!result.success) {
  //         res.status(500).json({ message: result.message });
  //         return;
  //       }
  //       res.json({ message: "Event deleted" });
  //     } catch (error) {
  //       next(error);
  //     }
  //   }

  //   static async bulkCreateVenueBookings(
  //     req: Request,
  //     res: Response,
  //     next: NextFunction
  //   ): Promise<void> {
  //     try {
  //       const { organizationId, bookings } = req.body;
  //       const userId = req.user?.userId; // From AuthMiddleware
  //       const eventId = req.params.eventId;

  //       if (!userId) {
  //         res.status(401).json({
  //           success: false,
  //           message: "Unauthorized: User ID not found in token",
  //         });
  //         return;
  //       }

  //       if (!organizationId) {
  //         res
  //           .status(400)
  //           .json({ success: false, message: "organizationId is required" });
  //         return;
  //       }

  //       if (!Array.isArray(bookings) || bookings.length === 0) {
  //         res
  //           .status(400)
  //           .json({ success: false, message: "Booking array is required" });
  //         return;
  //       }

  //       // Validate venues exist
  //       const venueRepo = AppDataSource.getRepository(Venue);
  //       const venueIds = bookings.map((b) => b.venueId);
  //       const venues = await venueRepo.find({
  //         where: { venueId: In(venueIds) },
  //         relations: ["organization"],
  //       });

  //       if (venues.length !== bookings.length) {
  //         res
  //           .status(404)
  //           .json({ success: false, message: "One or more venues not found" });
  //         return;
  //       }

  //       const result = await EventRepository.bulkCreateVenueBookings(
  //         bookings.map((b) => ({
  //           ...b,
  //           organizationId,
  //           approvalStatus: ApprovalStatus.PENDING,
  //         })),
  //         userId,
  //         eventId,
  //         organizationId
  //       );

  //       if (!result.success) {
  //         res.status(400).json({ success: false, message: result.message });
  //         return;
  //       }

  //       // Format response with full venue data
  //       const formattedBookings = result.data?.map((booking) => ({
  //         bookingId: booking.bookingId,
  //         venue: {
  //           venueId: booking.venue.venueId,
  //           venueName: booking.venue.venueName,
  //           location: booking.venue.venueLocation,
  //           capacity: booking.venue.capacity,
  //           amount: booking.venue.venueVariables,
  //           latitude: booking.venue.latitude,
  //           longitude: booking.venue.longitude,
  //           googleMapsLink: booking.venue.googleMapsLink,
  //           managerId: booking.venue.venueVariables,
  //           organizationId: booking.venue.organizationId,
  //           amenities: booking.venue.amenities,
  //           venueType: booking.venue.venueTypeId,
  //           createdAt: booking.venue.createdAt,
  //           updatedAt: booking.venue.updatedAt,
  //           deletedAt: booking.venue.deletedAt,
  //         },
  //         eventId: booking.eventId,
  //         userId: booking.userId,
  //         organizationId: booking.organizationId,
  //         totalAmountDue: booking.totalAmountDue,
  //         venueInvoiceId: booking.venueInvoiceId,
  //         approvalStatus: booking.approvalStatus,
  //         notes: booking.notes,
  //         createdAt: booking.createdAt,
  //         updatedAt: booking.updatedAt,
  //         deletedAt: booking.deletedAt,
  //       }));

  //       res.status(201).json({
  //         success: true,
  //         message: "Bookings created",
  //         data: formattedBookings,
  //       });
  //     } catch (error) {
  //       console.error("Error in bulkCreateVenueBookings:", error);
  //       next(error);
  //     }
  //   }
  //   static async approveVenueBooking(
  //     req: Request,
  //     res: Response,
  //     next: NextFunction
  //   ): Promise<void> {
  //     try {
  //       const { bookingId } = req.params;
  //       const updateResult = await EventRepository.updateVenueBooking(bookingId, {
  //         approvalStatus: ApprovalStatus.APPROVED,
  //       });
  //       if (!updateResult.success || !updateResult.data) {
  //         res.status(500).json({ message: updateResult.message });
  //         return;
  //       }

  //       res.json(updateResult.data);
  //     } catch (error) {
  //       next(error);
  //     }
  //   }

  //   static async getVenueBookings(
  //     req: Request,
  //     res: Response,
  //     next: NextFunction
  //   ): Promise<void> {
  //     try {
  //       const { eventId } = req.params;
  //       const eventResult = await EventRepository.getById(eventId);
  //       if (!eventResult.success || !eventResult.data) {
  //         res.status(404).json({ message: eventResult.message });
  //         return;
  //       }
  //       res.json(eventResult.data.venueBookings || []);
  //     } catch (error) {
  //       next(error);
  //     }
  //   }

  //   static async updateVenueBooking(
  //     req: Request,
  //     res: Response,
  //     next: NextFunction
  //   ): Promise<void> {
  //     try {
  //       const { bookingId } = req.params;
  //       const bookingData: Partial<VenueBookingInterface> = {
  //         ...req.body,
  //         approvalStatus: ApprovalStatus.PENDING,
  //       };

  //       const updateResult = await EventRepository.updateVenueBooking(
  //         bookingId,
  //         bookingData
  //       );
  //       if (!updateResult.success || !updateResult.data) {
  //         res.status(500).json({ message: updateResult.message });
  //         return;
  //       }
  //       res.json(updateResult.data);
  //     } catch (error) {
  //       next(error);
  //     }
  //   }

  //   static async deleteVenueBooking(
  //     req: Request,
  //     res: Response,
  //     next: NextFunction
  //   ): Promise<void> {
  //     try {
  //       const { eventId, bookingId } = req.params;
  //       const removeResult = await EventRepository.removeVenueBookings(eventId, [
  //         bookingId,
  //       ]);
  //       if (!removeResult.success) {
  //         res.status(500).json({ message: removeResult.message });
  //         return;
  //       }

  //       const deleteResult = await EventRepository.deleteVenueBooking(bookingId);
  //       if (!deleteResult.success) {
  //         res.status(500).json({ message: deleteResult.message });
  //         return;
  //       }
  //       res.json({ message: "Venue booking deleted" });
  //     } catch (error) {
  //       next(error);
  //     }
  //   }

  //   static validate(data: Partial<VenueBookingInterface>): string[] {
  //     const errors: string[] = [];
  //     if (!data.eventId) errors.push("eventId is required");
  //     if (!data.venueId) errors.push("venueId is required");
  //     // organizerId is set from the token, not required in request body
  //     if (!data.organizationId) errors.push("organizationId is required");
  //     return errors;
  //   }
  // }
  // function sanitizeVenue(venue: any) {
  //   if (!venue) return venue;
  //   const { events, ...venueWithoutEvents } = venue;
  //   return venueWithoutEvents;
  // }

  // function sanitizeEvent(event: any) {
  //   if (!event) return event;
  //   // Remove circular references for venues
  //   const sanitizedVenues = event.venues?.map(sanitizeVenue);
  //   return {
  //     ...event,
  //     venues: sanitizedVenues,
  //   };
}
