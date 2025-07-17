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

export class EventRepository {
  private static readonly CACHE_PREFIX = "event:";
  private static readonly CACHE_TTL = 1800; // 30 minutes in seconds

  static async createEventWithRelations(
    eventData: any,
    venue: any,
    guests: any[],
    venueAmount: number
  ) {
    const queryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Create Event
      const event = queryRunner.manager.create(Event, eventData);
      await queryRunner.manager.save(event);

      // 2. Create EventVenue
      const eventVenue = queryRunner.manager.create(EventVenue, {
        eventId: event.eventId,
        venueId: venue.venueId,
        eventStartDate: event.startDate,
        eventEndDate: event.endDate,
        startTime: venue.bookingType === "HOURLY" ? event.startTime : undefined,
        endTime: venue.bookingType === "HOURLY" ? event.endTime : undefined,
        timezone: "UTC",
      });
      await queryRunner.manager.save(eventVenue);

      // 3. Create VenueBooking
      if (!venue.venueId) {
        throw new Error(
          "VenueBooking creation failed: venue.venueId is missing or undefined."
        );
      }
      // Debug log
      console.log("Creating VenueBooking with venueId:", venue.venueId);
      const venueBooking = queryRunner.manager.create(VenueBooking, {
        eventId: event.eventId,
        venueId: venue.venueId,
        venue: venue,
        bookingReason: event.eventType,
        eventStartDate: event.startDate,
        eventEndDate: event.endDate,
        startTime: venue.bookingType === "HOURLY" ? event.startTime : undefined,
        endTime: venue.bookingType === "HOURLY" ? event.endTime : undefined,
        bookingStatus: BookingStatus.PENDING,
        isPaid: false,
        timezone: "UTC",
        createdBy: event.eventOrganizerId,
        amountToBePaid: venueAmount,
      });
      await queryRunner.manager.save(venueBooking);

      // 4. Create EventGuests if public
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

      await queryRunner.commitTransaction();
      return {
        success: true,
        data: { event, eventVenue, venueBooking, eventGuests },
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
        order: { startDate: "ASC" },
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
      return { success: true, data: event };
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
