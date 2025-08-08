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
import { TicketPurchaseService } from "../services/tickets/TicketPurchaseService"; // Import the updated service
import { FreeEventRegistrationRepository } from "../repositories/FreeEventRegistrationRepository";
import { RegistrationRepository } from "../repositories/RegistrationRepository";

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

      const authenticatedReq = req as any;
      const currentUserId = authenticatedReq.user?.userId; // Get userId from authenticated request

      if (!currentUserId) {
        res.status(401).json({
          success: false,
          message: "Unauthorized: User ID not found in token.",
        });
        return;
      }

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

      // Authorization checks
      if (eventOrganizerType === "USER") {
        if (eventOrganizerId !== currentUserId) {
          res.status(403).json({
            success: false,
            message: "Forbidden: You can only create events for yourself.",
          });
          return;
        }
      } else if (eventOrganizerType === "ORGANIZATION") {
        const currentUser = await userRepo.findOne({
          where: { userId: currentUserId },
          relations: ["organizations"], // Eager load organizations
        });

        if (!currentUser) {
          res
            .status(404)
            .json({ success: false, message: "Authenticated user not found." });
          return;
        }

        const belongsToOrg = currentUser.organizations.some(
          (org) => org.organizationId === eventOrganizerId
        );

        if (!belongsToOrg) {
          res.status(403).json({
            success: false,
            message:
              "Forbidden: You do not belong to the specified organization.",
          });
          return;
        }
      }

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
        bookingDates,
        currentUserId // Pass the current authenticated user's ID
      );

      // After event creation
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
        message: `Successfully created event for ${
          result.data?.eventVenues?.length || 0
        } venue(s)`,
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
        b.bookingStatus === "PARTIAL" || b.bookingStatus === "APPROVED_PAID"
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
        let venueAmount = 0;
        let totalHours = 0;
        if (venue.bookingType === "HOURLY") {
          totalHours = booking.bookingDates.reduce(
            (sum, date) => sum + (date.hours?.length || 1),
            0
          );
          venueAmount = baseVenueAmount * totalHours;
        } else if (venue.bookingType === "DAILY") {
          venueAmount = baseVenueAmount * booking.bookingDates.length;
        } else {
          venueAmount = baseVenueAmount;
        }
        const depositAmount = bookingCondition?.depositRequiredPercent
          ? (venueAmount * bookingCondition.depositRequiredPercent) / 100
          : venueAmount;
        // Fetch all payments for this booking
        const paymentRepo = AppDataSource.getRepository(
          require("../models/VenueBookingPayment").VenueBookingPayment
        );
        const payments = await paymentRepo.find({
          where: { bookingId: booking.bookingId },
        });
        const totalPaid = payments.reduce(
          (sum, p) => sum + Number(p.amountPaid || 0),
          0
        );
        const remainingAmount = venueAmount - totalPaid;
        totalAmount += venueAmount;
        totalDepositRequired += depositAmount;
        bookingDetails.push({
          ...booking,
          eventId: booking.event?.eventId,
          eventName: booking.event?.eventName,
          venue: {
            ...venue, // include all venue details
            depositRequired: {
              percentage: bookingCondition?.depositRequiredPercent || 100,
              amount: depositAmount,
              description:
                venue.bookingType === "HOURLY"
                  ? `Initial deposit required to secure the booking (${bookingCondition?.depositRequiredPercent}% of total amount for ${totalHours} hours)`
                  : `Initial deposit required to secure the booking (${bookingCondition?.depositRequiredPercent}% of total amount for ${booking.bookingDates.length} days)`,
            },
            paymentCompletionRequired: {
              daysBeforeEvent:
                bookingCondition?.paymentComplementTimeBeforeEvent || 0,
              deadline: (() => {
                const earliestDate = new Date(
                  Math.min(
                    ...booking.bookingDates.map((d) =>
                      new Date(d.date).getTime()
                    )
                  )
                );
                return bookingCondition?.paymentComplementTimeBeforeEvent
                  ? new Date(
                      earliestDate.getTime() -
                        bookingCondition.paymentComplementTimeBeforeEvent *
                          24 *
                          60 *
                          60 *
                          1000
                    )
                  : earliestDate;
              })(),
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
            baseAmount: baseVenueAmount,
            totalHours: venue.bookingType === "HOURLY" ? totalHours : null,
            totalAmount: venueAmount,
          },
          paymentSummary: {
            totalAmount: venueAmount,
            requiredDepositAmount: depositAmount,
            totalPaid: totalPaid,
            remainingAmount: remainingAmount,
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
            paymentMethods: ["CARD", "BANK_TRANSFER", "MOBILE_MONEY", "PayPal"],
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }

  static async getRegistrationsByEvent(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { eventId } = req.params as { eventId: string };

      if (!eventId) {
        res
          .status(400)
          .json({ success: false, message: "Event ID is required." });
        return;
      }

      const eventRepo = AppDataSource.getRepository(Event);
      const event = await eventRepo.findOne({ where: { eventId } });

      if (!event) {
        res.status(404).json({ success: false, message: "Event not found." });
        return;
      }

      const isPaidEvent = !!event.isEntryPaid;

      if (!isPaidEvent) {
        // Free event → return free event registrations
        const freeRegs =
          await FreeEventRegistrationRepository.getFreeRegistrationsByEventId(
            eventId
          );

        const mapped = freeRegs.map((r) => ({
          type: "FREE",
          freeRegistrationId: r.freeRegistrationId,
          eventId: r.eventId,
          fullName: r.fullName,
          email: r.email,
          phoneNumber: r.phoneNumber,
          nationalId: r.nationalId,
          gender: r.gender,
          address: r.address,
          qrCode: r.qrCode,
          barcode: r.barcode,
          sevenDigitCode: r.sevenDigitCode,
          pdfUrl: r.pdfUrl,
          attended: r.attended,
          attendedTimes: r.attendedTimes,
          checkInHistory: r.checkInHistory,
          isUsed: r.isUsed,
          registrationDate: r.registrationDate,
          registeredByDetails: r.registeredBy
            ? {
                userId: r.registeredBy.userId,
                username: r.registeredBy.username,
                email: r.registeredBy.email,
                firstName: r.registeredBy.firstName,
                lastName: r.registeredBy.lastName,
                phoneNumber: r.registeredBy.phoneNumber,
              }
            : null,
          checkedInByStaff: r.checkedInBy
            ? {
                staffId: r.checkedInBy.staffId,
                fullName: r.checkedInBy.fullName,
                phoneNumber: r.checkedInBy.phoneNumber,
                nationalId: r.checkedInBy.nationalId,
              }
            : null,
        }));

        res.status(200).json({
          success: true,
          data: {
            eventId,
            entryType: "FREE",
            registrations: mapped,
          },
        });
        return;
      }

      // Paid event → return paid registrations
      const paidRegs = await RegistrationRepository.findByEventId(eventId);
      const mapped = paidRegs.map((r) => ({
        type: "PAID",
        registrationId: r.registrationId,
        eventId: r.eventId,
        userId: r.userId,
        buyerId: r.buyerId,
        attendeeName: r.attendeeName,
        ticketTypeId: r.ticketTypeId,
        ticketTypeName: r.ticketType?.name,
        venueId: r.venueId,
        venueName: r.venue?.venueName,
        noOfTickets: r.noOfTickets,
        totalCost: r.totalCost,
        registrationDate: r.registrationDate,
        attendedDate: r.attendedDate,
        paymentStatus: r.paymentStatus,
        qrCode: r.qrCode,
        barcode: r.barcode,
        sevenDigitCode: r.sevenDigitCode,
        attended: r.attended,
        isUsed: r.isUsed,
        pdfUrl: r.pdfUrl,
      }));

      res.status(200).json({
        success: true,
        data: {
          eventId,
          entryType: "PAID",
          registrations: mapped,
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

  static async updateEventPhoto(req: Request, res: Response): Promise<void> {
    const { eventId } = req.params;
    try {
      const eventRepo = AppDataSource.getRepository(Event);
      const event = await eventRepo.findOne({ where: { eventId } });

      if (!event) {
        res.status(404).json({ success: false, message: "Event not found" });
        return;
      }

      let newPhotoUrl: string | undefined = undefined;
      const file = (req as any).file;

      if (file && file.buffer) {
        // Upload new photo
        const uploadResult = await CloudinaryUploadService.uploadBuffer(
          file.buffer,
          "events/photos"
        );
        newPhotoUrl = uploadResult.url;
      }

      // Delete old photo from Cloudinary if it exists and a new one was uploaded
      if (event.eventPhoto && newPhotoUrl) {
        try {
          await CloudinaryUploadService.deleteFromCloudinary(
            event.eventPhoto,
            "image"
          );
        } catch (e) {
          console.error(
            "Failed to delete old event photo from Cloudinary:",
            event.eventPhoto,
            e
          );
        }
      }

      // Update event with new photo URL
      event.eventPhoto = newPhotoUrl;
      await eventRepo.save(event);

      res.status(200).json({ success: true, data: event });
    } catch (error) {
      res.status(500).json({
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Failed to update event photo.",
      });
    }
  }

  static async getEventsByUserId(req: Request, res: Response): Promise<void> {
    const { userId } = req.params;
    try {
      const eventRepo = AppDataSource.getRepository(Event);
      const events = await eventRepo.find({
        where: {
          eventOrganizerId: userId,
          visibilityScope: "PUBLIC",
        },
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

  static async createEventForExternalUser(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      // Parse new structure: { client: {...}, event: {...} }
      const { client, event } = req.body;
      if (!client || !event) {
        res.status(400).json({
          success: false,
          message: "Missing 'client' or 'event' object in request body.",
        });
        return;
      }
      const { firstName, lastName, email, phoneNumber } = client;
      if (!firstName || !lastName || !email || !phoneNumber) {
        res.status(400).json({
          success: false,
          message:
            "Missing user info: firstName, lastName, email, phoneNumber are required.",
        });
        return;
      }
      // Fetch the GUEST role for new users
      const userRepo = AppDataSource.getRepository(User);
      const roleRepository = AppDataSource.getRepository(
        require("../models/Role").Role
      );
      const guestRole = await roleRepository.findOne({
        where: { roleName: "GUEST" },
      });
      if (!guestRole) {
        res.status(500).json({
          success: false,
          message: "Default GUEST role not found. Please initialize roles.",
        });
        return;
      }
      let user = await userRepo.findOne({
        where: [{ email }, { phoneNumber }],
      });
      if (!user) {
        const randomPassword = Math.random().toString(36).slice(-8);
        // Generate a username from email or name
        let username = email
          ? email.split("@")[0]
          : `${firstName}.${lastName}`.toLowerCase().replace(/\s+/g, "");
        // Ensure username is unique
        let usernameCandidate = username;
        let counter = 1;
        while (
          await userRepo.findOne({ where: { username: usernameCandidate } })
        ) {
          usernameCandidate = `${username}${Math.floor(Math.random() * 10000)}`;
          counter++;
          if (counter > 5) break; // avoid infinite loop
        }
        username = usernameCandidate;
        user = userRepo.create({
          username,
          firstName,
          lastName,
          email,
          phoneNumber,
          password: randomPassword, // You may want to hash this in a real system
          roleId: guestRole.roleId,
        });
        await userRepo.save(user);
      }
      // Only use allowed event fields for PRIVATE event
      const { eventTitle, eventType, description, venueId, dates } = event;
      if (!eventTitle || !eventType || !venueId || !dates || !description) {
        res.status(400).json({
          success: false,
          message:
            "Missing required event fields: eventTitle, eventType, venueId, dates, description",
        });
        return;
      }
      // Prepare venueIds array
      let venueIdsArray = Array.isArray(venueId) ? venueId : [venueId];
      // Fetch venues
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
      // Check all venues belong to same org
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
      // Dates validation (reuse logic)
      let bookingDates;
      const hasHourlyVenue = selectedVenues.some(
        (v) => v.bookingType === "HOURLY"
      );
      if (hasHourlyVenue) {
        if (
          !Array.isArray(dates) ||
          !dates.every((d) => d.date && Array.isArray(d.hours))
        ) {
          res.status(400).json({
            success: false,
            message:
              "When booking hourly venues, each date must include hours array",
          });
          return;
        }
        bookingDates = dates;
      } else {
        if (
          !Array.isArray(dates) ||
          !dates.every(
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
        bookingDates = dates.map((d) => ({
          date: typeof d === "string" ? d : d.date,
        }));
      }
      // Validate dates for each venue
      for (const venue of selectedVenues) {
        const validation = await BookingValidationService.validateBookingDates(
          venue,
          bookingDates
        );
        if (!validation.isAvailable) {
          res.status(400).json({
            success: false,
            message: `Venue ${venue.venueName} has unavailable dates`,
            unavailableDates: validation.unavailableDates,
            venueId: venue.venueId,
          });
          return;
        }
      }
      // Build event data
      const eventData: any = {
        eventName: eventTitle,
        eventType,
        eventDescription: description,
        visibilityScope: "PRIVATE",
        eventStatus: EventStatus.DRAFTED,
        publishStatus: "DRAFT",
        eventOrganizerId: user.userId,
        eventOrganizerType: "USER",
      };
      // Create event(s)
      const result = await EventRepository.createEventWithRelations(
        eventData,
        selectedVenues,
        [], // No guests for private event
        bookingDates,
        user.userId // Pass the current authenticated user's ID
      );
      if (!result.success) {
        res.status(400).json({ success: false, message: result.message });
        return;
      }
      // Approve all created bookings
      const VenueBookingRepository =
        require("../repositories/VenueBookingRepository").VenueBookingRepository;
      const approvalResults = [];
      if (!result.data) {
        res
          .status(500)
          .json({ success: false, message: "No bookings to approve." });
        return;
      }
      for (const booking of result.data.venueBookings ?? []) {
        const bookingId = booking.bookingId;
        const approval =
          await VenueBookingRepository.approveBookingWithTransition(bookingId);
        approvalResults.push({ bookingId, ...approval });
        if (!approval.success) {
          res.status(500).json({
            success: false,
            message: `Failed to approve booking ${bookingId}: ${approval.message}`,
          });
          return;
        }
      }
      res.status(201).json({
        success: true,
        user: {
          userId: user.userId,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          phoneNumber: user.phoneNumber,
        },
        event: result.data ?? [],
        bookingApprovals: approvalResults,
        message: `Successfully created PRIVATE event(s) for user and approved booking(s)`,
      });
    } catch (error) {
      next(error);
    }
  }

  static async purchaseTicket(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { recipientEmail, ticketsToPurchase, paymentDetails } = req.body;
      const authenticatedReq = req as any;
      const userId = authenticatedReq.user?.userId;

      if (!userId) {
        res.status(401).json({
          success: false,
          message: "Unauthorized: User ID not found.",
        });
        return;
      }

      if (
        !recipientEmail ||
        !ticketsToPurchase ||
        !Array.isArray(ticketsToPurchase) ||
        ticketsToPurchase.length === 0 ||
        !paymentDetails
      ) {
        res.status(400).json({
          success: false,
          message:
            "Missing required fields: recipientEmail, ticketsToPurchase (array of {ticketTypeId, attendeeName}), paymentDetails.",
        });
        return;
      }

      // Basic validation for each ticket in the array
      for (const ticket of ticketsToPurchase) {
        if (!ticket.ticketTypeId || !ticket.attendeeName) {
          res.status(400).json({
            success: false,
            message:
              "Each ticket in 'ticketsToPurchase' must have a 'ticketTypeId' and 'attendeeName'.",
          });
          return;
        }
      }

      const result = await TicketPurchaseService.purchaseTicket(
        userId, // buyerUserId
        recipientEmail,
        ticketsToPurchase,
        paymentDetails
      );

      if (result.success) {
        res.status(200).json(result);
      } else {
        res.status(400).json(result);
      }
    } catch (error) {
      next(error);
    }
  }

  static async updatePrivateEvent(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    const uploadedCloudinaryUrls: string[] = [];
    try {
      const { eventId } = req.params;
      if (!req.body) {
        res.status(400).json({ success: false, message: "No body provided" });
        return;
      }

      const eventRepo = AppDataSource.getRepository(Event);
      const event = await eventRepo.findOne({
        where: { eventId },
        relations: ["eventGuests"], // Eager load guests to check existing IDs
      });

      if (!event) {
        res.status(404).json({ success: false, message: "Event not found" });
        return;
      }

      let { dates, guests, eventStatus, eventName, eventType, ...otherFields } =
        req.body;

      // Handle eventName update explicitly
      if (eventName !== undefined) {
        event.eventName = eventName;
      }

      // Prevent updating dates
      if (dates) {
        res.status(400).json({
          success: false,
          message: "Booking dates cannot be updated for events.",
        });
        return;
      }

      // Prevent updating eventType
      if (eventType) {
        res.status(400).json({
          success: false,
          message: "Event type cannot be updated for private events.",
        });
        return;
      }

      // Handle eventPhoto upload
      const eventPhotoFile = (req as any).files?.eventPhoto?.[0];
      if (eventPhotoFile && eventPhotoFile.buffer) {
        if (event.eventPhoto) {
          await CloudinaryUploadService.deleteFromCloudinary(
            event.eventPhoto,
            "image"
          );
        }
        const uploadResult = await CloudinaryUploadService.uploadBuffer(
          eventPhotoFile.buffer,
          "events/photos"
        );
        event.eventPhoto = uploadResult.url;
        uploadedCloudinaryUrls.push(event.eventPhoto);
      }

      // Parse guests and dates if sent as JSON strings (from form-data)
      let parsedGuests: any[] = guests;
      if (typeof guests === "string") {
        try {
          parsedGuests = JSON.parse(guests);
        } catch (e) {
          parsedGuests = [];
        }
      }

      if (Array.isArray(parsedGuests)) {
        const guestRepo = AppDataSource.getRepository(EventGuest);
        const existingGuests = event.eventGuests || [];
        const incomingGuestIds = new Set(
          parsedGuests.map((g: any) => g.id).filter(Boolean)
        );

        // 1. Identify and delete guests that are no longer in the request
        for (const existingGuest of existingGuests) {
          if (!incomingGuestIds.has(existingGuest.id)) {
            // Delete photo from Cloudinary if exists
            if (existingGuest.guestPhoto) {
              try {
                await CloudinaryUploadService.deleteFromCloudinary(
                  existingGuest.guestPhoto,
                  "image"
                );
              } catch (e) {
                console.error(
                  "Failed to delete old guest photo from Cloudinary:",
                  existingGuest.guestPhoto,
                  e
                );
              }
            }
            await guestRepo.remove(existingGuest); // Delete from database
          }
        }

        // 2. Process new and updated guests
        const guestPhotoFiles = (req as any).files?.guestPhotos;
        const newAndUpdatedGuests = await Promise.all(
          parsedGuests.map(async (guest, index) => {
            let guestPhotoUrl = guest.guestPhoto;
            const file = guestPhotoFiles && guestPhotoFiles[index];

            if (file && file.buffer) {
              // If updating an existing guest with a new photo, delete the old one first
              if (
                guest.id &&
                existingGuests.some((g) => g.id === guest.id && g.guestPhoto)
              ) {
                const oldGuest = existingGuests.find((g) => g.id === guest.id);
                if (oldGuest?.guestPhoto) {
                  try {
                    await CloudinaryUploadService.deleteFromCloudinary(
                      oldGuest.guestPhoto,
                      "image"
                    );
                  } catch (e) {
                    console.error(
                      "Failed to delete old guest photo on update:",
                      oldGuest.guestPhoto,
                      e
                    );
                  }
                }
              }
              const uploadResult = await CloudinaryUploadService.uploadBuffer(
                file.buffer,
                "events/guests"
              );
              guestPhotoUrl = uploadResult.url;
              uploadedCloudinaryUrls.push(guestPhotoUrl);
            }

            if (guest.id && incomingGuestIds.has(guest.id)) {
              // Update existing guest: only update the photo if a new one was uploaded via file
              const updateData: any = { guestName: guest.guestName };
              if (guestPhotoUrl) {
                updateData.guestPhoto = guestPhotoUrl;
              }
              await guestRepo.update({ id: guest.id, eventId }, updateData);
              return {
                id: guest.id,
                guestName: guest.guestName,
                guestPhoto:
                  guestPhotoUrl ||
                  existingGuests.find((g) => g.id === guest.id)?.guestPhoto,
              };
            } else {
              // Create new guest
              const newGuest = guestRepo.create({
                eventId,
                guestName: guest.guestName,
                guestPhoto: guestPhotoUrl,
              });
              await guestRepo.save(newGuest);
              return newGuest;
            }
          })
        );

        // Reload guests to reflect all changes (deletions, creations, updates)
        event.eventGuests = await guestRepo.find({ where: { eventId } });
      }

      // Handle dates update - kept as is per instruction that dates cannot be updated
      let bookingDates = event.bookingDates; // default to existing
      // if (dates) { ... previous date update logic ... }

      // Update other text fields
      const allowedFields = [
        "eventDescription",
        "maxAttendees",
        "socialMediaLinks",
        "isEntryPaid",
        "expectedGuests",
        "specialNotes",
        "cancellationReason",
        "visibilityScope",
        "startTime", // Allow updating startTime
        "endTime", // Allow updating endTime
      ];
      for (const key of Object.keys(otherFields)) {
        if (allowedFields.includes(key)) {
          (event as any)[key] = otherFields[key];
        }
      }

      // If visibilityScope is not explicitly provided, default private events to PUBLIC
      if (
        event.visibilityScope === "PRIVATE" &&
        !("visibilityScope" in req.body)
      ) {
        event.visibilityScope = "PUBLIC";
      }

      // Logic to handle visibilityScope and eventStatus interaction
      if (event.visibilityScope === "PUBLIC") {
        if (eventStatus) {
          event.eventStatus = eventStatus;
        } else {
          event.eventStatus = EventStatus.DRAFTED;
        }
        event.cancellationReason = undefined;
      } else if (eventStatus) {
        const allowedPrivateStatuses = [
          EventStatus.DRAFTED,
          EventStatus.REQUESTED,
        ];
        if (!allowedPrivateStatuses.includes(eventStatus)) {
          res.status(400).json({
            success: false,
            message: `Event status can only be updated to DRAFTED or REQUESTED for private events.`,
          });
          return;
        }
        event.eventStatus = eventStatus;
      }

      // Ensure bookingDates is updated on the event object (even if not from request body)
      event.bookingDates = bookingDates;

      await eventRepo.save(event);
      res.status(200).json({ success: true, data: event });
    } catch (error) {
      for (const url of uploadedCloudinaryUrls) {
        try {
          await CloudinaryUploadService.deleteFromCloudinary(url, "image");
        } catch (e) {
          console.error("Failed to delete Cloudinary image on error:", url, e);
        }
      }
      next(error);
    }
  }

  static async enableEvent(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { eventId } = req.params;
      const authenticatedReq = req as any;
      const userId = authenticatedReq.user?.userId;
      const userRole = authenticatedReq.user?.role?.roleName; // Assuming role is available on user object

      if (!userId) {
        res.status(401).json({ success: false, message: "Unauthorized" });
        return;
      }

      const eventRepo = AppDataSource.getRepository(Event);
      const event = await eventRepo.findOne({
        where: { eventId },
      });

      if (!event) {
        res.status(404).json({ success: false, message: "Event not found." });
        return;
      }

      const isOrganizer =
        event.eventOrganizerType === "USER"
          ? event.eventOrganizerId === userId
          : false;

      const isAdminUser = userRole === "ADMIN"; // Assuming 'ADMIN' is the role name for administrators

      // Special handling for DISABLED_BY_ADMIN: only admin can re-enable
      if (event.enableStatus === "DISABLED_BY_ADMIN" && !isAdminUser) {
        res.status(403).json({
          success: false,
          message: "Only administrators can enable events disabled by admin.",
        });
        return;
      }

      // Allow organizer to enable their own event, or admin to enable any event not DISABLED_BY_ADMIN
      if (!isOrganizer && !isAdminUser) {
        res.status(403).json({
          success: false,
          message: "Forbidden: You are not authorized to enable this event.",
        });
        return;
      }

      const result = await EventRepository.updateEventEnableStatus(
        eventId,
        "ENABLE"
      );
      if (result.success) {
        res.status(200).json({
          success: true,
          message: "Event enabled successfully.",
          data: result.data,
        });
      } else {
        res.status(404).json({ success: false, message: result.message });
      }
    } catch (error) {
      next(error);
    }
  }

  static async disableEvent(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { eventId } = req.params;
      const authenticatedReq = req as any;
      const userId = authenticatedReq.user?.userId;
      const userRole = authenticatedReq.user?.role?.roleName; // Assuming role is available on user object

      if (!userId) {
        res.status(401).json({ success: false, message: "Unauthorized" });
        return;
      }

      const eventRepo = AppDataSource.getRepository(Event);
      const event = await eventRepo.findOne({
        where: { eventId },
      });

      if (!event) {
        res.status(404).json({ success: false, message: "Event not found." });
        return;
      }

      const isOrganizer =
        event.eventOrganizerType === "USER"
          ? event.eventOrganizerId === userId
          : false;

      const isAdminUser = userRole === "ADMIN";

      // Only allow organizer or admin to disable. Admins can disable events that are already DISABLED_BY_ADMIN.
      if (!isOrganizer && !isAdminUser) {
        res.status(403).json({
          success: false,
          message: "Forbidden: You are not authorized to disable this event.",
        });
        return;
      }

      // Prevent organizer from disabling an event that was disabled by admin
      if (event.enableStatus === "DISABLED_BY_ADMIN" && !isAdminUser) {
        res.status(403).json({
          success: false,
          message:
            "Only administrators can change the status of events disabled by admin.",
        });
        return;
      }

      const result = await EventRepository.updateEventEnableStatus(
        eventId,
        "DISABLE"
      );
      if (result.success) {
        res.status(200).json({
          success: true,
          message: "Event disabled successfully.",
          data: result.data,
        });
      } else {
        res.status(404).json({ success: false, message: result.message });
      }
    } catch (error) {
      next(error);
    }
  }

  static async disableEventByAdmin(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { eventId } = req.params;
      // isAdmin middleware already handles authorization for this route
      const result = await EventRepository.updateEventEnableStatus(
        eventId,
        "DISABLED_BY_ADMIN"
      );
      if (result.success) {
        res.status(200).json({
          success: true,
          message: "Event disabled by admin successfully.",
          data: result.data,
        });
      } else {
        res.status(404).json({ success: false, message: result.message });
      }
    } catch (error) {
      next(error);
    }
  }
}
