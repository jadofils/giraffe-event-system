import { AppDataSource } from "../config/Database";
import { Event } from "../models/Event Tables/Event";
import { Venue } from "../models/Venue Tables/Venue";
import { VenueBooking, BookingStatus } from "../models/VenueBooking";
import { CacheService } from "../services/CacheService";
import { EventInterface } from "../interfaces/EventInterface";
import { VenueInterface } from "../interfaces/VenueInterface";
import { VenueBookingInterface } from "../interfaces/VenueBookingInterface";
import { EventStatus, EventType } from "../interfaces/Index";
import { In, Between, Not } from "typeorm";
import { User } from "../models/User";
import { Organization } from "../models/Organization";
import { UUID_REGEX } from "../utils/constants";
import { EventVenue } from "../models/Event Tables/EventVenue";
import { EventGuest } from "../models/Event Tables/EventGuest";
import { BookingDateDTO } from "../interfaces/BookingDateInterface";
import { BookingValidationService } from "../services/bookings/BookingValidationService";
import { v4 as uuidv4 } from "uuid";

export class EventRepository {
  private static readonly CACHE_PREFIX = "event:";
  private static readonly CACHE_TTL = 1800; // 30 minutes in seconds

  static async createEventWithRelations(
    eventData: any,
    venues: Venue[],
    guests: any[],
    dates: BookingDateDTO[]
  ) {
    const queryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const createdEvents = [];
      // Generate a groupId for all related events
      const groupId =
        dates.length > 1 || venues.length > 1 ? uuidv4() : undefined;

      // Create separate events for each date and venue combination
      for (const bookingDate of dates) {
        for (const venue of venues) {
          // 1. Create Event for this specific date and venue
          let createdByUserId = eventData.eventOrganizerId;
          let createdBy = undefined;
          if (createdByUserId) {
            createdBy = await queryRunner.manager
              .getRepository(User)
              .findOne({ where: { userId: createdByUserId } });
          }
          const singleDateEvent = queryRunner.manager.create(Event, {
            ...eventData,
            bookingDates: [bookingDate], // Only use this single date
            groupId: groupId, // Set the groupId for related events
            createdByUserId,
            createdBy,
          });
          await queryRunner.manager.save(singleDateEvent);

          // 2. Create EventVenue for this date and venue
          const eventVenue = queryRunner.manager.create(EventVenue, {
            eventId: singleDateEvent.eventId,
            venueId: venue.venueId,
            bookingDates: [bookingDate], // Only use this single date
            timezone: "UTC",
          });
          await queryRunner.manager.save(eventVenue);

          // Calculate total hours and amount for hourly venues
          const totalHours = bookingDate.hours?.length || 1;
          const baseVenueAmount = venue.venueVariables[0]?.venueAmount || 0;
          const totalAmount =
            venue.bookingType === "HOURLY"
              ? baseVenueAmount * totalHours
              : baseVenueAmount;

          // Create VenueBooking for this date and venue
          const venueBooking = queryRunner.manager.create(VenueBooking, {
            eventId: singleDateEvent.eventId,
            venueId: venue.venueId,
            venue: venue,
            bookingReason: eventData.eventType,
            bookingDates: [bookingDate], // Only use this single date
            bookingStatus: BookingStatus.PENDING,
            isPaid: false,
            timezone: "UTC",
            createdBy: eventData.eventOrganizerId,
            amountToBePaid: totalAmount, // Use calculated total amount
          });
          await queryRunner.manager.save(venueBooking);

          // 4. Create EventGuests if public (copy guests to each event)
          let eventGuests: EventGuest[] = [];
          if (guests && guests.length > 0) {
            eventGuests = await Promise.all(
              guests.map(async (guest: any) => {
                const eventGuest = queryRunner.manager.create(EventGuest, {
                  eventId: singleDateEvent.eventId,
                  guestName: guest.guestName,
                  guestPhoto: guest.guestPhoto,
                });
                return await queryRunner.manager.save(eventGuest);
              })
            );
          }

          // Add this event's data to our results
          createdEvents.push({
            event: singleDateEvent,
            eventVenue,
            venueBooking,
            eventGuests,
          });
        }
      }

      await queryRunner.commitTransaction();
      return {
        success: true,
        data: createdEvents, // Return array of all created events and their related records
      };
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to create event and related records.";
      await queryRunner.rollbackTransaction();
      return {
        success: false,
        message,
      };
    } finally {
      await queryRunner.release();
    }
  }

  static async getAllEventsWithRelations() {
    try {
      const events = await AppDataSource.getRepository(Event).find({
        relations: ["venueBookings", "eventVenues", "eventGuests"],
        order: { createdAt: "DESC" },
      });
      return { success: true, data: events };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to fetch events.";
      return {
        success: false,
        message,
      };
    }
  }

  static async getEventByIdWithRelations(id: string) {
    try {
      const event = await AppDataSource.getRepository(Event).findOne({
        where: { eventId: id },
        relations: ["eventVenues", "eventGuests"],
      });
      if (!event) {
        return { success: false, message: "Event not found" };
      }
      // Fetch venue details for each eventVenue
      const venueRepo = AppDataSource.getRepository(
        require("../models/Venue Tables/Venue").Venue
      );
      const venues = [];
      for (const ev of event.eventVenues || []) {
        if (ev.venueId) {
          const venue = await venueRepo.findOne({
            where: { venueId: ev.venueId },
          });
          if (venue) venues.push(venue);
        }
      }
      return { success: true, data: { ...event, venues } };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to fetch event.";
      return {
        success: false,
        message,
      };
    }
  }

  static async updateEventStatus(id: string, updateFields: Partial<Event>) {
    try {
      const repo = AppDataSource.getRepository(Event);
      const event = await repo.findOne({ where: { eventId: id } });
      if (!event) {
        return { success: false, message: "Event not found" };
      }
      Object.assign(event, updateFields);
      await repo.save(event);
      return { success: true, data: event };
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to update event status.";
      return {
        success: false,
        message,
      };
    }
  }
}
