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
import { In } from "typeorm";
import { VenueBooking } from "../models/VenueBooking";
import { BookingCondition } from "../models/Venue Tables/BookingCondition";
import { Event } from "../models/Event Tables/Event";
import { CloudinaryUploadService } from "../services/CloudinaryUploadService";

export class EventController {
  private static eventRepository = new EventRepository();

  static async createEvent(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    const uploadedCloudinaryUrls: string[] = [];
    try {
      if (!req.body) {
        res.status(400).json({ success: false, message: "No body provided" });
        return;
      }
      // Defensive destructuring
      const {
        eventTitle,
        eventType,
        dates,
        description,
        guests,
        venues,
        venueId, // Support both venues and venueId
        visibilityScope,
        eventOrganizerId,
        // Public event fields
        maxAttendees,
        socialMediaLinks,
        isEntryPaid,
        expectedGuests,
        specialNotes,
        eventPhoto,
        ignoreTransitionWarnings = false, // New parameter to allow proceeding despite warnings
      } = req.body;

      // Parse guests and dates if sent as JSON strings (from form-data)
      let parsedGuests = guests;
      if (typeof guests === "string") {
        try {
          parsedGuests = JSON.parse(guests);
        } catch (e) {
          parsedGuests = [];
        }
      }
      let parsedDates = dates;
      if (typeof dates === "string") {
        try {
          parsedDates = JSON.parse(dates);
        } catch (e) {
          parsedDates = [];
        }
      }

      // Handle Cloudinary upload for public event photo
      let finalEventPhoto = eventPhoto;
      if (visibilityScope === "PUBLIC") {
        const file =
          (req as any).file ||
          ((req as any).files && (req as any).files.eventPhoto);
        if (file && file.buffer) {
          const uploadResult = await CloudinaryUploadService.uploadBuffer(
            file.buffer,
            "events/photos"
          );
          finalEventPhoto = uploadResult.url;
          uploadedCloudinaryUrls.push(finalEventPhoto);
        } else if (Array.isArray(file) && file[0] && file[0].buffer) {
          const uploadResult = await CloudinaryUploadService.uploadBuffer(
            file[0].buffer,
            "events/photos"
          );
          finalEventPhoto = uploadResult.url;
          uploadedCloudinaryUrls.push(finalEventPhoto);
        }
      }

      // Handle Cloudinary upload for guest photos (public events only)
      let finalGuests = parsedGuests;
      if (visibilityScope === "PUBLIC" && Array.isArray(parsedGuests)) {
        finalGuests = await Promise.all(
          parsedGuests.map(async (guest, idx) => {
            let guestPhoto = guest.guestPhoto;
            const guestFiles =
              (req as any).files && (req as any).files.guestPhotos;
            if (
              guestFiles &&
              Array.isArray(guestFiles) &&
              guestFiles[idx] &&
              guestFiles[idx].buffer
            ) {
              const uploadResult = await CloudinaryUploadService.uploadBuffer(
                guestFiles[idx].buffer,
                "events/guests"
              );
              guestPhoto = uploadResult.url;
              uploadedCloudinaryUrls.push(guestPhoto);
            } else if (guestPhoto && guestPhoto.buffer) {
              const uploadResult = await CloudinaryUploadService.uploadBuffer(
                guestPhoto.buffer,
                "events/guests"
              );
              guestPhoto = uploadResult.url;
              uploadedCloudinaryUrls.push(guestPhoto);
            }
            return { ...guest, guestPhoto };
          })
        );
      }

      // Robustly parse venueId to support both single and multiple venues
      let venueIds = venues || venueId;
      if (typeof venueIds === "string") {
        try {
          const parsed = JSON.parse(venueIds);
          if (Array.isArray(parsed)) {
            venueIds = parsed;
          }
        } catch {
          // Not a JSON array, leave as is
        }
      }
      const venueIdsArray = Array.isArray(venueIds) ? venueIds : [venueIds];

      // Basic validation for required fields
      if (
        !eventTitle ||
        !eventType ||
        !venueIdsArray ||
        venueIdsArray.length === 0 ||
        !eventOrganizerId ||
        !parsedDates ||
        !description
      ) {
        res.status(400).json({
          success: false,
          message:
            "Missing required fields: eventTitle, eventType, venues/venueId (array or single), eventOrganizerId, dates, description",
        });
        return;
      }

      // Fetch all venues WITH venueVariables and bookingConditions
      const venueRepo = AppDataSource.getRepository(Venue);
      const selectedVenues = await venueRepo.find({
        where: { venueId: In(venueIdsArray) },
        relations: ["venueVariables", "bookingConditions"],
      });

      if (selectedVenues.length !== venueIdsArray.length) {
        res
          .status(404)
          .json({ success: false, message: "One or more venues not found." });
        return;
      }

      // Check if all venues belong to the same organization
      const organizationId = selectedVenues[0].organizationId;
      const allSameOrg = selectedVenues.every(
        (venue) => venue.organizationId === organizationId
      );

      if (!allSameOrg) {
        res.status(400).json({
          success: false,
          message: "All venues must belong to the same organization",
        });
        return;
      }

      // Convert dates to BookingDateDTO format based on venue booking types
      let bookingDates: BookingDateDTO[];
      const hasHourlyVenue = selectedVenues.some(
        (v) => v.bookingType === "HOURLY"
      );

      if (hasHourlyVenue) {
        // If any venue is hourly, require hours for all dates
        if (
          !Array.isArray(parsedDates) ||
          !parsedDates.every((d) => d.date && Array.isArray(d.hours))
        ) {
          res.status(400).json({
            success: false,
            message:
              "When booking hourly venues, each date must include hours array",
          });
          return;
        }
        bookingDates = parsedDates;
      } else {
        // For daily bookings, accept simple date strings
        if (
          !Array.isArray(parsedDates) ||
          !parsedDates.every(
            (d) => typeof d === "string" || typeof d.date === "string"
          )
        ) {
          res.status(400).json({
            success: false,
            message:
              "For daily bookings, dates should be an array of date strings",
          });
          return;
        }
        bookingDates = parsedDates.map((d) => ({
          date: typeof d === "string" ? d : d.date,
        }));
      }

      // Track transition time warnings
      const transitionWarnings: {
        venueId: string;
        venueName: string;
        warnings: Array<{
          date: string;
          message: string;
          alternatives?: Array<{
            date: string;
            hours?: number[];
            type: "TRANSITION" | "EVENT";
          }>;
        }>;
      }[] = [];

      // Validate dates for each venue
      for (const venue of selectedVenues) {
        try {
          const validation =
            await BookingValidationService.validateBookingDates(
              venue,
              bookingDates
            );

          if (!validation.isAvailable) {
            // If there are only transition warnings and user wants to proceed, continue
            const hasOnlyTransitionWarnings = validation.unavailableDates.every(
              (d) => d.warningType === "WARNING"
            );

            if (hasOnlyTransitionWarnings && ignoreTransitionWarnings) {
              // Collect warnings for response
              transitionWarnings.push({
                venueId: venue.venueId,
                venueName: venue.venueName,
                warnings: validation.unavailableDates.map((d) => ({
                  date: d.date,
                  message: d.reason,
                })),
              });
            } else {
              // If there are error-level unavailabilities or user hasn't acknowledged warnings
              res.status(400).json({
                success: false,
                message: `Venue ${venue.venueName} has unavailable dates`,
                unavailableDates: validation.unavailableDates,
                venueId: venue.venueId,
                hasTransitionWarnings: validation.hasTransitionTimeWarnings,
                transitionWarnings: validation.unavailableDates
                  .filter((d) => d.warningType === "WARNING")
                  .map((d) => ({
                    date: d.date,
                    message: d.reason,
                  })),
              });
              return;
            }
          }
        } catch (error) {
          res.status(400).json({
            success: false,
            message:
              error instanceof Error ? error.message : "Validation failed",
            venueId: venue.venueId,
          });
          return;
        }
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
      const eventData: any = {
        eventName: eventTitle,
        eventType,
        eventDescription: description,
        visibilityScope,
        eventStatus: EventStatus.DRAFTED,
        publishStatus: "DRAFT",
        eventOrganizerId,
        eventOrganizerType,
      };

      // Add fields based on visibility scope
      if (visibilityScope === "PUBLIC") {
        Object.assign(eventData, {
          maxAttendees,
          socialMediaLinks,
          isEntryPaid,
          expectedGuests,
          specialNotes,
          eventPhoto: finalEventPhoto,
        });
      }

      // Create events with booking dates for each venue
      const result = await EventRepository.createEventWithRelations(
        eventData,
        selectedVenues,
        visibilityScope === "PUBLIC" && Array.isArray(finalGuests)
          ? finalGuests
          : [],
        bookingDates
      );

      if (!result.success) {
        res.status(400).json({ success: false, message: result.message });
        return;
      }

      // Invalidate cache for all managers of these venues
      const venueVariableRepo = AppDataSource.getRepository(VenueVariable);
      const venueVariables = await venueVariableRepo.find({
        where: { venue: { venueId: In(venueIdsArray) } },
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
        message: `Successfully created ${result.data?.length || 0} event(s)`,
        transitionWarnings:
          transitionWarnings.length > 0 ? transitionWarnings : undefined,
      });
      return;
    } catch (error) {
      // Cleanup uploaded images if event creation fails
      for (const url of uploadedCloudinaryUrls) {
        try {
          await CloudinaryUploadService.deleteFromCloudinary(url, "image");
        } catch (e) {
          // Log and continue
          console.error("Failed to delete Cloudinary image:", url, e);
        }
      }
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
      // Filter out events with eventStatus 'DRAFTED'
      const filteredEvents = (result.data || []).filter(
        (event: any) => event.eventStatus !== "DRAFTED"
      );
      res.status(200).json({ success: true, data: filteredEvents });
      return;
    } catch (error) {
      next(error);
    }
  }

  static async getAllApprovedEvents(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const eventRepo = AppDataSource.getRepository(Event);
      const userRepo = AppDataSource.getRepository(User);
      const orgRepo = AppDataSource.getRepository(Organization);
      const events = await eventRepo.find({
        where: { eventStatus: EventStatus.APPROVED },
        relations: ["eventVenues", "eventVenues.venue", "eventGuests"],
        order: { createdAt: "DESC" },
      });
      const eventsWithOrganizer = await Promise.all(
        events.map(async (event) => {
          let organizer = null;
          if (event.eventOrganizerType === "USER") {
            organizer = await userRepo.findOne({
              where: { userId: event.eventOrganizerId },
            });
          } else if (event.eventOrganizerType === "ORGANIZATION") {
            organizer = await orgRepo.findOne({
              where: { organizationId: event.eventOrganizerId },
            });
          }
          return { ...event, organizer };
        })
      );
      res.status(200).json({ success: true, data: eventsWithOrganizer });
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
      const eventRepo = AppDataSource.getRepository(Event);
      const userRepo = AppDataSource.getRepository(User);
      const orgRepo = AppDataSource.getRepository(Organization);
      const event = await eventRepo.findOne({
        where: { eventId: req.params.id },
        relations: ["eventVenues", "eventVenues.venue", "eventGuests"],
      });
      if (!event) {
        res.status(404).json({ success: false, message: "Event not found" });
        return;
      }
      let organizer = null;
      if (event.eventOrganizerType === "USER") {
        organizer = await userRepo.findOne({
          where: { userId: event.eventOrganizerId },
        });
      } else if (event.eventOrganizerType === "ORGANIZATION") {
        organizer = await orgRepo.findOne({
          where: { organizationId: event.eventOrganizerId },
        });
      }
      res.status(200).json({ success: true, data: { ...event, organizer } });
      return;
    } catch (error) {
      next(error);
    }
  }

  static async requestPublish(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const eventRepo = AppDataSource.getRepository(Event);
    const event = await eventRepo.findOne({
      where: { eventId: id },
      relations: ["venueBookings"],
    });
    if (!event) {
      res.status(404).json({ success: false, message: "Event not found" });
      return;
    }
    if (event.eventStatus === EventStatus.REJECTED) {
      res.status(400).json({
        success: false,
        message: "Event has been rejected and cannot be requested again.",
      });
      return;
    }
    // Check all venue bookings
    const allApproved = event.venueBookings.every(
      (b) =>
        b.bookingStatus === "APPROVED_NOT_PAID" ||
        b.bookingStatus === "APPROVED_PAID"
    );
    if (!allApproved) {
      res.status(400).json({
        success: false,
        message: "All venue bookings must be approved to request publish.",
      });
      return;
    }
    event.eventStatus = EventStatus.REQUESTED;
    event.visibilityScope = "PUBLIC";
    event.cancellationReason = undefined;
    await eventRepo.save(event);
    res.status(200).json({
      success: true,
      data: event,
      message: "Event submitted for publishing/approval.",
    });
    return;
  }

  static async queryEvent(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const { cancellationReason } = req.body;
    const eventRepo = AppDataSource.getRepository(Event);
    const event = await eventRepo.findOne({ where: { eventId: id } });
    if (!event) {
      res.status(404).json({ success: false, message: "Event not found" });
      return;
    }
    event.eventStatus = EventStatus.QUERIED;
    event.cancellationReason = cancellationReason || "No reason provided";
    await eventRepo.save(event);
    res.status(200).json({
      success: true,
      data: event,
      message: "Event queried for more information.",
    });
    return;
  }

  static async rejectEvent(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const { cancellationReason } = req.body;
    const eventRepo = AppDataSource.getRepository(Event);
    const event = await eventRepo.findOne({ where: { eventId: id } });
    if (!event) {
      res.status(404).json({ success: false, message: "Event not found" });
      return;
    }
    event.eventStatus = EventStatus.REJECTED;
    event.cancellationReason = cancellationReason || "No reason provided";
    await eventRepo.save(event);
    res.status(200).json({
      success: true,
      data: event,
      message: "Event has been rejected.",
    });
    return;
  }

  static async approveEvent(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const eventRepo = AppDataSource.getRepository(Event);
    const event = await eventRepo.findOne({ where: { eventId: id } });
    if (!event) {
      res.status(404).json({ success: false, message: "Event not found" });
      return;
    }
    if (
      event.eventStatus !== EventStatus.REQUESTED &&
      event.eventStatus !== EventStatus.QUERIED
    ) {
      res.status(400).json({
        success: false,
        message: "Only events in REQUESTED or QUERIED status can be approved.",
      });
      return;
    }
    event.eventStatus = EventStatus.APPROVED;
    event.cancellationReason = undefined;
    await eventRepo.save(event);
    res.status(200).json({
      success: true,
      data: event,
      message: "Event has been approved.",
    });
    return;
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
  // }

  static async getGroupPaymentDetails(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { groupId } = req.params;

      // Get all events in the group
      const eventRepo = AppDataSource.getRepository(Event);
      const events = await eventRepo.find({
        where: { groupId },
        relations: [
          "venueBookings",
          "venueBookings.venue",
          "venueBookings.venue.bookingConditions",
          "venueBookings.venue.venueVariables",
        ],
      });

      if (!events || events.length === 0) {
        res.status(404).json({
          success: false,
          message: "No events found for this group",
        });
        return;
      }

      // Get payer details from the first event (all events in group share same payer)
      let payerDetails = null;
      if (events[0].eventOrganizerType === "USER") {
        const userRepo = AppDataSource.getRepository(User);
        const user = await userRepo.findOne({
          where: { userId: events[0].eventOrganizerId },
        });
        if (user) {
          payerDetails = {
            payerId: user.userId,
            payerType: "USER",
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            phoneNumber: user.phoneNumber,
          };
        }
      } else if (events[0].eventOrganizerType === "ORGANIZATION") {
        const orgRepo = AppDataSource.getRepository(Organization);
        const organization = await orgRepo.findOne({
          where: { organizationId: events[0].eventOrganizerId },
        });
        if (organization) {
          payerDetails = {
            payerId: organization.organizationId,
            payerType: "ORGANIZATION",
            organizationName: organization.organizationName,
            contactEmail: organization.contactEmail,
            contactPhone: organization.contactPhone,
            address: organization.address,
          };
        }
      }

      // Calculate totals and prepare booking details
      let totalAmount = 0;
      let totalDepositRequired = 0;
      const bookingDetails = [];

      for (const event of events) {
        for (const booking of event.venueBookings) {
          const venue = booking.venue;
          const bookingCondition = venue.bookingConditions[0];
          const baseVenueAmount = venue.venueVariables[0]?.venueAmount || 0;

          // Calculate total hours across all booking dates
          const totalHours = booking.bookingDates.reduce((sum, date) => {
            return sum + (date.hours?.length || 1); // If no hours specified, count as 1 day
          }, 0);

          // Calculate amounts based on venue booking type
          const venueAmount =
            venue.bookingType === "HOURLY"
              ? baseVenueAmount * totalHours
              : baseVenueAmount;

          const depositAmount = bookingCondition?.depositRequiredPercent
            ? (venueAmount * bookingCondition.depositRequiredPercent) / 100
            : venueAmount;

          totalAmount += venueAmount;
          totalDepositRequired += depositAmount;

          // Get earliest booking date for this booking
          const earliestDate = new Date(
            Math.min(
              ...booking.bookingDates.map((d) => new Date(d.date).getTime())
            )
          );
          const paymentDeadline =
            bookingCondition?.paymentComplementTimeBeforeEvent
              ? new Date(
                  earliestDate.getTime() -
                    bookingCondition.paymentComplementTimeBeforeEvent *
                      24 *
                      60 *
                      60 *
                      1000
                )
              : earliestDate;

          bookingDetails.push({
            bookingId: booking.bookingId,
            eventId: event.eventId,
            eventName: event.eventName,
            venue: {
              venueId: venue.venueId,
              venueName: venue.venueName,
              bookingType: venue.bookingType,
              baseAmount: baseVenueAmount,
              totalHours: totalHours,
              totalAmount: venueAmount,
              depositRequired: {
                percentage: bookingCondition?.depositRequiredPercent || 100,
                amount: depositAmount,
                description:
                  venue.bookingType === "HOURLY"
                    ? `Initial deposit required to secure the booking (${bookingCondition?.depositRequiredPercent}% of total amount for ${totalHours} hours)`
                    : "Initial deposit required to secure the booking",
              },
              paymentCompletionRequired: {
                daysBeforeEvent:
                  bookingCondition?.paymentComplementTimeBeforeEvent || 0,
                amount: venueAmount - depositAmount,
                deadline: paymentDeadline,
                description: `Remaining payment must be completed ${
                  bookingCondition?.paymentComplementTimeBeforeEvent || 0
                } days before the event`,
              },
              bookingDates: booking.bookingDates,
              bookingConditions: {
                depositRequiredPercent:
                  bookingCondition?.depositRequiredPercent || 100,
                paymentComplementTimeBeforeEvent:
                  bookingCondition?.paymentComplementTimeBeforeEvent || 0,
                description: bookingCondition?.descriptionCondition,
                notaBene: bookingCondition?.notaBene,
                transitionTime: bookingCondition?.transitionTime,
              },
            },
            paymentSummary: {
              totalAmount: venueAmount,
              depositAmount: depositAmount,
              remainingAmount: venueAmount - depositAmount,
              bookingStatus: booking.bookingStatus,
              isPaid: booking.isPaid,
              pricePerHour:
                venue.bookingType === "HOURLY" ? baseVenueAmount : null,
              totalHours: venue.bookingType === "HOURLY" ? totalHours : null,
            },
          });
        }
      }

      res.status(200).json({
        success: true,
        data: {
          groupId,
          payer: payerDetails,
          bookings: bookingDetails,
          groupTotals: {
            totalAmount,
            totalDepositRequired,
            totalRemainingAmount: totalAmount - totalDepositRequired,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }

  static async getBookingPaymentDetails(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { bookingId } = req.params;

      // Get booking with all necessary relations
      const bookingRepo = AppDataSource.getRepository(VenueBooking);
      const booking = await bookingRepo.findOne({
        where: { bookingId },
        relations: [
          "venue",
          "venue.bookingConditions",
          "venue.venueVariables",
          "event",
        ],
      });

      if (!booking) {
        res.status(404).json({
          success: false,
          message: "Booking not found",
        });
        return;
      }

      // If booking is part of a group, redirect to group payment details
      if (booking?.event?.groupId) {
        res.redirect(
          `/api/v1/event/group/${booking.event.groupId}/payment-details`
        );
        return;
      }

      // Fetch event to determine payer type
      const eventRepo = AppDataSource.getRepository(Event);
      const eventData = await eventRepo.findOne({
        where: { eventId: booking.eventId },
      });

      // Get payer details based on event organizer type
      let payerDetails = null;
      if (eventData) {
        if (eventData.eventOrganizerType === "USER") {
          const userRepo = AppDataSource.getRepository(User);
          const user = await userRepo.findOne({
            where: { userId: eventData.eventOrganizerId },
          });
          if (user) {
            payerDetails = {
              payerId: user.userId,
              payerType: "USER",
              firstName: user.firstName,
              lastName: user.lastName,
              email: user.email,
              phoneNumber: user.phoneNumber,
            };
          }
        } else if (eventData.eventOrganizerType === "ORGANIZATION") {
          const orgRepo = AppDataSource.getRepository(Organization);
          const organization = await orgRepo.findOne({
            where: { organizationId: eventData.eventOrganizerId },
          });
          if (organization) {
            payerDetails = {
              payerId: organization.organizationId,
              payerType: "ORGANIZATION",
              organizationName: organization.organizationName,
              contactEmail: organization.contactEmail,
              contactPhone: organization.contactPhone,
              address: organization.address,
            };
          }
        }
      }

      const venue = booking.venue;
      const bookingCondition = venue.bookingConditions[0];
      const baseVenueAmount = venue.venueVariables[0]?.venueAmount || 0;

      // Calculate total hours across all booking dates
      const totalHours = booking.bookingDates.reduce((sum, date) => {
        return sum + (date.hours?.length || 1); // If no hours specified, count as 1 day
      }, 0);

      // Calculate amounts based on venue booking type
      const venueAmount =
        venue.bookingType === "HOURLY"
          ? baseVenueAmount * totalHours
          : baseVenueAmount;

      // Calculate required deposit
      const depositAmount = bookingCondition?.depositRequiredPercent
        ? (venueAmount * bookingCondition.depositRequiredPercent) / 100
        : venueAmount;

      // Get earliest booking date to calculate payment deadline
      const earliestDate = new Date(
        Math.min(...booking.bookingDates.map((d) => new Date(d.date).getTime()))
      );
      const paymentDeadline = bookingCondition?.paymentComplementTimeBeforeEvent
        ? new Date(
            earliestDate.getTime() -
              bookingCondition.paymentComplementTimeBeforeEvent *
                24 *
                60 *
                60 *
                1000
          )
        : earliestDate;

      res.status(200).json({
        success: true,
        data: {
          bookingId: booking.bookingId,
          eventId: eventData?.eventId,
          eventName: eventData?.eventName,
          eventType: eventData?.eventType,
          eventStatus: eventData?.eventStatus,
          payer: payerDetails,
          venue: {
            venueId: venue.venueId,
            venueName: venue.venueName,
            bookingType: venue.bookingType,
            baseAmount: baseVenueAmount,
            totalHours: totalHours,
            totalAmount: venueAmount,
            depositRequired: {
              percentage: bookingCondition?.depositRequiredPercent || 100,
              amount: depositAmount,
              description:
                venue.bookingType === "HOURLY"
                  ? `Initial deposit required to secure the booking (${bookingCondition?.depositRequiredPercent}% of total amount for ${totalHours} hours)`
                  : "Initial deposit required to secure the booking",
            },
            paymentCompletionRequired: {
              daysBeforeEvent:
                bookingCondition?.paymentComplementTimeBeforeEvent || 0,
              amount: venueAmount - depositAmount,
              deadline: paymentDeadline,
              description: `Remaining payment must be completed ${
                bookingCondition?.paymentComplementTimeBeforeEvent || 0
              } days before the event`,
            },
            bookingDates: booking.bookingDates,
            bookingConditions: {
              depositRequiredPercent:
                bookingCondition?.depositRequiredPercent || 100,
              paymentComplementTimeBeforeEvent:
                bookingCondition?.paymentComplementTimeBeforeEvent || 0,
              description: bookingCondition?.descriptionCondition,
              notaBene: bookingCondition?.notaBene,
              transitionTime: bookingCondition?.transitionTime,
            },
          },
          paymentSummary: {
            totalAmount: venueAmount,
            depositAmount: depositAmount,
            remainingAmount: venueAmount - depositAmount,
            bookingStatus: booking.bookingStatus,
            isPaid: booking.isPaid,
            pricePerHour:
              venue.bookingType === "HOURLY" ? baseVenueAmount : null,
            totalHours: venue.bookingType === "HOURLY" ? totalHours : null,
            paymentHistory: [], // You can add payment history here if needed
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }

  static async getPaymentDetailsForSelectedBookings(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { bookingIds } = req.body;

      if (!Array.isArray(bookingIds) || bookingIds.length === 0) {
        res.status(400).json({
          success: false,
          message: "Please provide an array of booking IDs",
        });
        return;
      }

      // Get all bookings with their relations
      const bookingRepo = AppDataSource.getRepository(VenueBooking);
      const bookings = await bookingRepo.find({
        where: { bookingId: In(bookingIds) },
        relations: [
          "venue",
          "venue.bookingConditions",
          "venue.venueVariables",
          "event",
        ],
      });

      if (bookings.length !== bookingIds.length) {
        res.status(400).json({
          success: false,
          message: "One or more booking IDs are invalid",
        });
        return;
      }

      // Get payer details from the first booking's event
      const event = bookings[0].event;
      let payerDetails = null;

      if (event) {
        if (event.eventOrganizerType === "USER") {
          const userRepo = AppDataSource.getRepository(User);
          const user = await userRepo.findOne({
            where: { userId: event.eventOrganizerId },
          });
          if (user) {
            payerDetails = {
              payerId: user.userId,
              payerType: "USER",
              firstName: user.firstName,
              lastName: user.lastName,
              email: user.email,
              phoneNumber: user.phoneNumber,
            };
          }
        } else if (event.eventOrganizerType === "ORGANIZATION") {
          const orgRepo = AppDataSource.getRepository(Organization);
          const organization = await orgRepo.findOne({
            where: { organizationId: event.eventOrganizerId },
          });
          if (organization) {
            payerDetails = {
              payerId: organization.organizationId,
              payerType: "ORGANIZATION",
              organizationName: organization.organizationName,
              contactEmail: organization.contactEmail,
              contactPhone: organization.contactPhone,
              address: organization.address,
            };
          }
        }
      }

      // Calculate totals and prepare booking details
      let totalAmount = 0;
      let totalDepositRequired = 0;
      const bookingDetails = [];

      for (const booking of bookings) {
        const venue = booking.venue;
        const bookingCondition = venue.bookingConditions[0];
        const baseVenueAmount = venue.venueVariables[0]?.venueAmount || 0;

        // Calculate total hours across all booking dates
        const totalHours = booking.bookingDates.reduce((sum, date) => {
          return sum + (date.hours?.length || 1); // If no hours specified, count as 1 day
        }, 0);

        // Calculate amounts based on venue booking type
        const venueAmount =
          venue.bookingType === "HOURLY"
            ? baseVenueAmount * totalHours
            : baseVenueAmount;

        const depositAmount = bookingCondition?.depositRequiredPercent
          ? (venueAmount * bookingCondition.depositRequiredPercent) / 100
          : venueAmount;

        totalAmount += venueAmount;
        totalDepositRequired += depositAmount;

        // Get earliest booking date for this booking
        const earliestDate = new Date(
          Math.min(
            ...booking.bookingDates.map((d) => new Date(d.date).getTime())
          )
        );
        const paymentDeadline =
          bookingCondition?.paymentComplementTimeBeforeEvent
            ? new Date(
                earliestDate.getTime() -
                  bookingCondition.paymentComplementTimeBeforeEvent *
                    24 *
                    60 *
                    60 *
                    1000
              )
            : earliestDate;

        bookingDetails.push({
          bookingId: booking.bookingId,
          eventId: booking.event?.eventId,
          eventName: booking.event?.eventName,
          venue: {
            venueId: venue.venueId,
            venueName: venue.venueName,
            bookingType: venue.bookingType,
            baseAmount: baseVenueAmount,
            totalHours: totalHours,
            totalAmount: venueAmount,
            depositRequired: {
              percentage: bookingCondition?.depositRequiredPercent || 100,
              amount: depositAmount,
              description:
                venue.bookingType === "HOURLY"
                  ? `Initial deposit required to secure the booking (${bookingCondition?.depositRequiredPercent}% of total amount for ${totalHours} hours)`
                  : "Initial deposit required to secure the booking",
            },
            paymentCompletionRequired: {
              daysBeforeEvent:
                bookingCondition?.paymentComplementTimeBeforeEvent || 0,
              amount: venueAmount - depositAmount,
              deadline: paymentDeadline,
              description: `Remaining payment must be completed ${
                bookingCondition?.paymentComplementTimeBeforeEvent || 0
              } days before the event`,
            },
            bookingDates: booking.bookingDates,
            bookingConditions: {
              depositRequiredPercent:
                bookingCondition?.depositRequiredPercent || 100,
              paymentComplementTimeBeforeEvent:
                bookingCondition?.paymentComplementTimeBeforeEvent || 0,
              description: bookingCondition?.descriptionCondition,
              notaBene: bookingCondition?.notaBene,
              transitionTime: bookingCondition?.transitionTime,
            },
          },
          paymentSummary: {
            totalAmount: venueAmount,
            depositAmount: depositAmount,
            remainingAmount: venueAmount - depositAmount,
            bookingStatus: booking.bookingStatus,
            isPaid: booking.isPaid,
            pricePerHour:
              venue.bookingType === "HOURLY" ? baseVenueAmount : null,
            totalHours: venue.bookingType === "HOURLY" ? totalHours : null,
          },
        });
      }

      res.status(200).json({
        success: true,
        data: {
          payer: payerDetails,
          bookings: bookingDetails,
          totals: {
            totalAmount,
            totalDepositRequired,
            totalRemainingAmount: totalAmount - totalDepositRequired,
          },
          paymentInstructions: {
            description: "Please make payment to secure your bookings",
            depositDeadline: new Date(
              Math.min(
                ...bookings.map((b) =>
                  new Date(
                    Math.min(
                      ...b.bookingDates.map((d) => new Date(d.date).getTime())
                    )
                  ).getTime()
                )
              )
            ),
            paymentMethods: ["CARD", "BANK_TRANSFER", "MOBILE_MONEY"],
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }

  static async updateEventTextFields(
    req: Request,
    res: Response
  ): Promise<void> {
    const { id } = req.params;
    const updateFields = req.body;
    try {
      const eventRepo = AppDataSource.getRepository(Event);
      const event = await eventRepo.findOne({ where: { eventId: id } });
      if (!event) {
        res.status(404).json({ success: false, message: "Event not found" });
        return;
      }
      // Only update allowed text fields (not guests, eventPhoto, guestPhotos, dates)
      const forbiddenFields = [
        "guests",
        "eventPhoto",
        "guestPhotos",
        "dates",
        "bookingDates",
      ];
      for (const key of Object.keys(updateFields)) {
        if (!forbiddenFields.includes(key)) {
          (event as any)[key] = updateFields[key];
        }
      }
      await eventRepo.save(event);
      res.status(200).json({ success: true, data: event });
    } catch (error) {
      res.status(500).json({
        success: false,
        message:
          error instanceof Error ? error.message : "Failed to update event.",
      });
    }
  }

  static async updateEventDates(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    let { dates } = req.body;
    if (typeof dates === "string") {
      try {
        dates = JSON.parse(dates);
      } catch {
        dates = [];
      }
    }
    if (!Array.isArray(dates) || dates.length === 0) {
      res.status(400).json({ success: false, message: "No dates provided" });
      return;
    }

    // Find event and booking
    const eventRepo = AppDataSource.getRepository(Event);
    const event = await eventRepo.findOne({
      where: { eventId: id },
      relations: ["venueBookings", "eventVenues"],
    });
    if (!event) {
      res.status(404).json({ success: false, message: "Event not found" });
      return;
    }

    // Assume one booking per event for simplicity
    const booking = event.venueBookings?.[0];
    if (!booking) {
      res.status(404).json({ success: false, message: "Booking not found" });
      return;
    }
    if (booking.bookingStatus !== "PENDING") {
      res.status(400).json({
        success: false,
        message: "Booking must be in PENDING status to update dates",
      });
      return;
    }

    // Validate new dates for the venue
    const venueId = booking.venueId;
    const venueRepo = AppDataSource.getRepository(Venue);
    const venue = await venueRepo.findOne({ where: { venueId } });
    if (!venue) {
      res.status(404).json({ success: false, message: "Venue not found" });
      return;
    }

    // Use BookingValidationService to check date availability
    const validation = await BookingValidationService.validateBookingDates(
      venue,
      dates
    );
    if (!validation.isAvailable) {
      res.status(400).json({
        success: false,
        message: "Selected dates are not available for this venue",
        unavailableDates: validation.unavailableDates,
      });
      return;
    }

    // Update event and booking dates
    event.bookingDates = dates;
    booking.bookingDates = dates;
    await eventRepo.save(event);
    await AppDataSource.getRepository(VenueBooking).save(booking);

    res.status(200).json({ success: true, data: { event, booking } });
    return;
  }

  static async addEventGuest(req: Request, res: Response): Promise<void> {
    const { eventId } = req.params;
    const { guestName } = req.body;
    try {
      const eventRepo = AppDataSource.getRepository(Event);
      const event = await eventRepo.findOne({
        where: { eventId },
        relations: ["eventGuests"],
      });
      if (!event) {
        res.status(404).json({ success: false, message: "Event not found" });
        return;
      }
      if ((event.eventGuests?.length || 0) >= 5) {
        res.status(400).json({
          success: false,
          message: "Maximum of 5 guests allowed per event.",
        });
        return;
      }
      let guestPhotoUrl = undefined;
      const file = (req as any).file;
      if (file && file.buffer) {
        const uploadResult = await CloudinaryUploadService.uploadBuffer(
          file.buffer,
          "events/guests"
        );
        guestPhotoUrl = uploadResult.url;
      }
      const guestRepo = AppDataSource.getRepository(EventGuest);
      const newGuest = guestRepo.create({
        eventId,
        guestName,
        guestPhoto: guestPhotoUrl,
      });
      await guestRepo.save(newGuest);
      res.status(201).json({ success: true, data: newGuest });
    } catch (error) {
      res.status(500).json({
        success: false,
        message:
          error instanceof Error ? error.message : "Failed to add guest.",
      });
    }
  }

  static async updateEventGuestName(
    req: Request,
    res: Response
  ): Promise<void> {
    const { eventId, guestId } = req.params;
    const { guestName } = req.body;
    try {
      const guestRepo = AppDataSource.getRepository(EventGuest);
      const guest = await guestRepo.findOne({
        where: { id: guestId, eventId },
      });
      if (!guest) {
        res.status(404).json({ success: false, message: "Guest not found" });
        return;
      }
      guest.guestName = guestName;
      await guestRepo.save(guest);
      res.status(200).json({ success: true, data: guest });
    } catch (error) {
      res.status(500).json({
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Failed to update guest name.",
      });
    }
  }

  static async deleteEventGuest(req: Request, res: Response): Promise<void> {
    const { eventId, guestId } = req.params;
    try {
      const guestRepo = AppDataSource.getRepository(EventGuest);
      const guest = await guestRepo.findOne({
        where: { id: guestId, eventId },
      });
      if (!guest) {
        res.status(404).json({ success: false, message: "Guest not found" });
        return;
      }
      // Delete guest photo from Cloudinary if exists
      if (guest.guestPhoto) {
        try {
          await CloudinaryUploadService.deleteFromCloudinary(
            guest.guestPhoto,
            "image"
          );
        } catch (e) {
          // Log and continue
          console.error(
            "Failed to delete guest photo from Cloudinary:",
            guest.guestPhoto,
            e
          );
        }
      }
      await guestRepo.remove(guest);
      res.status(200).json({ success: true, message: "Guest deleted." });
    } catch (error) {
      res.status(500).json({
        success: false,
        message:
          error instanceof Error ? error.message : "Failed to delete guest.",
      });
    }
  }

  static async updateEventGuestPhoto(
    req: Request,
    res: Response
  ): Promise<void> {
    const { eventId, guestId } = req.params;
    try {
      const guestRepo = AppDataSource.getRepository(EventGuest);
      const guest = await guestRepo.findOne({
        where: { id: guestId, eventId },
      });
      if (!guest) {
        res.status(404).json({ success: false, message: "Guest not found" });
        return;
      }
      // Delete old photo from Cloudinary if exists
      if (guest.guestPhoto) {
        try {
          await CloudinaryUploadService.deleteFromCloudinary(
            guest.guestPhoto,
            "image"
          );
        } catch (e) {
          console.error(
            "Failed to delete old guest photo from Cloudinary:",
            guest.guestPhoto,
            e
          );
        }
      }
      // Upload new photo
      const file = (req as any).file;
      if (file && file.buffer) {
        const uploadResult = await CloudinaryUploadService.uploadBuffer(
          file.buffer,
          "events/guests"
        );
        guest.guestPhoto = uploadResult.url;
      }
      await guestRepo.save(guest);
      res.status(200).json({ success: true, data: guest });
    } catch (error) {
      res.status(500).json({
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Failed to update guest photo.",
      });
    }
  }

  static async getEventsByUserId(req: Request, res: Response): Promise<void> {
    const { userId } = req.params;
    try {
      const eventRepo = AppDataSource.getRepository(Event);
      const events = await eventRepo.find({
        where: { eventOrganizerId: userId },
        relations: ["venueBookings", "venueBookings.venue"],
        order: { createdAt: "DESC" },
      });
      res.status(200).json({ success: true, data: events });
    } catch (error) {
      res.status(500).json({
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Failed to fetch events by user.",
      });
    }
  }
}
