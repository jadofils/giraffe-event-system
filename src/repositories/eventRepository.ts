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
      // 1. Create one event for all dates and venues
      const createdByUserId = eventData.eventOrganizerId;
      const createdBy = createdByUserId
        ? await queryRunner.manager
            .getRepository(User)
            .findOne({ where: { userId: createdByUserId } })
        : undefined;

      const event = queryRunner.manager.create(Event, {
        ...eventData,
        bookingDates: dates, // all dates
        groupId: venues.length > 1 ? uuidv4() : undefined,
        createdByUserId,
        createdBy,
      });
      await queryRunner.manager.save(event);

      const createdBookings = [];
      const createdEventVenues = [];

      // 2. For each venue, create one booking and one eventVenue
      for (const venue of venues) {
        // Calculate total amount for all dates/hours
        let totalAmount = 0;
        for (const bookingDate of dates) {
          const totalHours = bookingDate.hours?.length || 1;
          const baseVenueAmount = venue.venueVariables[0]?.venueAmount || 0;
          totalAmount +=
            venue.bookingType === "HOURLY"
              ? baseVenueAmount * totalHours
              : baseVenueAmount;
        }

        // Create booking
        const userEntity = createdByUserId
          ? await queryRunner.manager
              .getRepository(User)
              .findOne({ where: { userId: createdByUserId } })
          : undefined;
        const venueBooking = queryRunner.manager.create(VenueBooking, {
          eventId: event.eventId,
          venueId: venue.venueId,
          venue: venue,
          bookingReason: eventData.eventType,
          bookingDates: dates, // all dates
          bookingStatus: BookingStatus.PENDING,
          isPaid: false,
          timezone: "UTC",
          createdBy: createdByUserId,
          user: userEntity || undefined,
          amountToBePaid: totalAmount,
        });
        await queryRunner.manager.save(venueBooking);
        createdBookings.push(venueBooking);

        // Create eventVenue
        const eventVenue = queryRunner.manager.create(EventVenue, {
          eventId: event.eventId,
          venueId: venue.venueId,
          bookingDates: dates,
          timezone: "UTC",
        });
        await queryRunner.manager.save(eventVenue);
        createdEventVenues.push(eventVenue);
      }

      // 3. Guests (as before)
      let eventGuests: EventGuest[] = [];
      if (guests && guests.length > 0) {
        eventGuests = await Promise.all(
          guests.map(async (guest: any) => {
            const eventGuest = queryRunner.manager.create(EventGuest, {
              eventId: event.eventId,
              guestName: guest.guestName,
              guestPhoto: guest.guestPhoto,
            });
            return await queryRunner.manager.save(eventGuest);
          })
        );
      }

      // 4. Return
      await queryRunner.commitTransaction();
      return {
        success: true,
        data: {
          event,
          eventVenues: createdEventVenues,
          venueBookings: createdBookings,
          eventGuests,
        },
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
