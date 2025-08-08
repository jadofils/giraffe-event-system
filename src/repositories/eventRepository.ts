import { AppDataSource } from "../config/Database";
import { Event } from "../models/Event Tables/Event";
import { Venue } from "../models/Venue Tables/Venue";
import { VenueBooking, BookingStatus } from "../models/VenueBooking";
import { CacheService } from "../services/CacheService";
import { EventInterface } from "../interfaces/EventInterface";
import { VenueInterface } from "../interfaces/VenueInterface";
import { VenueBookingInterface } from "../interfaces/VenueBookingInterface";
import { EventStatus, EventType } from "../interfaces/Index";
import { In, Between, Not, IsNull, Raw } from "typeorm";
import { User } from "../models/User";
import { Organization } from "../models/Organization";
import { UUID_REGEX } from "../utils/constants";
import { EventVenue } from "../models/Event Tables/EventVenue";
import { EventGuest } from "../models/Event Tables/EventGuest";
import { BookingDateDTO } from "../interfaces/BookingDateInterface";
import { BookingValidationService } from "../services/bookings/BookingValidationService";
import { v4 as uuidv4 } from "uuid";
import {
  VenueAvailabilitySlot,
  SlotStatus,
  SlotType,
} from "../models/Venue Tables/VenueAvailabilitySlot";
import { BookingType } from "../models/Venue Tables/Venue"; // Correct import path for BookingType

export class EventRepository {
  private static readonly CACHE_PREFIX = "event:";
  private static readonly CACHE_TTL = 1800; // 30 minutes in seconds

  static async createEventWithRelations(
    eventData: any,
    venues: Venue[],
    guests: any[],
    dates: BookingDateDTO[],
    currentUserId: string // New parameter for the authenticated user's ID
  ) {
    const queryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Create one event for all dates and venues
      // createdByUserId should be the authenticated user making the request
      const createdByUser = await queryRunner.manager
        .getRepository(User)
        .findOne({ where: { userId: currentUserId } });

      if (!createdByUser) {
        throw new Error("Authenticated user not found.");
      }

      const event = queryRunner.manager.create(Event, {
        ...eventData,
        bookingDates: dates, // all dates
        groupId: venues.length > 1 ? uuidv4() : undefined,
        createdByUserId: currentUserId, // Use the authenticated user's ID for event creation
        createdBy: createdByUser,
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

        // Get bookingPaymentTimeoutMinutes from venue's booking condition, or default to 15 minutes
        const bookingCondition = venue.bookingConditions?.[0];
        const bookingPaymentTimeoutMinutes =
          bookingCondition?.bookingPaymentTimeoutMinutes || 15;

        // holdingExpiresAt will be computed precisely from the persisted createdAt after initial save

        // Create booking
        // createdBy should be the authenticated user making the request
        const userEntityForBooking = await queryRunner.manager
          .getRepository(User)
          .findOne({ where: { userId: currentUserId } });

        if (!userEntityForBooking) {
          throw new Error("Authenticated user not found for booking.");
        }

        let venueBooking = queryRunner.manager.create(VenueBooking, {
          eventId: event.eventId,
          venueId: venue.venueId,
          venue: venue,
          bookingReason: eventData.eventType,
          bookingDates: dates, // all dates
          bookingStatus: BookingStatus.HOLDING,
          isPaid: false,
          timezone: "UTC",
          createdBy: currentUserId, // Use the authenticated user's ID for booking creation
          user: userEntityForBooking, // Link to User entity
          amountToBePaid: totalAmount,
          // holdingExpiresAt set after initial save to align exactly with createdAt
        });
        venueBooking = await queryRunner.manager.save(venueBooking);
        // Compute holdingExpiresAt based on persisted createdAt to ensure exact timeout window
        if (venueBooking.createdAt) {
          venueBooking.holdingExpiresAt = new Date(
            venueBooking.createdAt.getTime() +
              bookingPaymentTimeoutMinutes * 60 * 1000
          );
          await queryRunner.manager.save(venueBooking);
        }
        createdBookings.push(venueBooking);

        // Create or update VenueAvailabilitySlots
        const vaSlotRepo = queryRunner.manager.getRepository(
          VenueAvailabilitySlot
        );
        for (const bookingDate of dates) {
          const existingSlot = await vaSlotRepo.findOne({
            where: {
              venueId: venue.venueId,
              Date: new Date(bookingDate.date), // Compare by date only
              eventId: IsNull(), // Only consider slots not yet associated with an event
            },
          });

          if (existingSlot) {
            // Update existing slot to HOLDING
            if (venue.bookingType === BookingType.HOURLY && bookingDate.hours) {
              existingSlot.bookedHours = [
                ...(existingSlot.bookedHours || []),
                ...bookingDate.hours,
              ];
              existingSlot.status = SlotStatus.HOLDING;
              existingSlot.eventId = event.eventId;
              existingSlot.slotType = SlotType.EVENT;
            } else if (venue.bookingType === BookingType.DAILY) {
              existingSlot.status = SlotStatus.HOLDING;
              existingSlot.eventId = event.eventId;
              existingSlot.slotType = SlotType.EVENT;
            }
            await queryRunner.manager.save(existingSlot);
          } else {
            // Create new slot as HOLDING
            const newSlot = vaSlotRepo.create({
              venueId: venue.venueId,
              Date: new Date(bookingDate.date),
              bookedHours:
                venue.bookingType === BookingType.HOURLY
                  ? bookingDate.hours
                  : undefined,
              status: SlotStatus.HOLDING,
              eventId: event.eventId,
              slotType: SlotType.EVENT,
              notes: "Held for new event creation",
            });
            await queryRunner.manager.save(newSlot);
          }
        }

        // Create HOLDING transition slots
        const transitionTime = bookingCondition?.transitionTime || 0;
        if (transitionTime > 0) {
          if (venue.bookingType === BookingType.DAILY) {
            // For DAILY, add transition days before the first booking date
            const firstBookingDate = new Date(
              Math.min(...dates.map((d) => new Date(d.date).getTime()))
            );
            for (let i = 1; i <= transitionTime; i++) {
              const transitionDate = new Date(firstBookingDate);
              transitionDate.setDate(transitionDate.getDate() - i);

              // Check if a slot already exists for this transition date
              const existingTransitionSlot = await vaSlotRepo.findOne({
                where: {
                  venueId: venue.venueId,
                  Date: transitionDate,
                  eventId: IsNull(), // Only consider truly available slots
                },
              });

              if (!existingTransitionSlot) {
                const newTransitionSlot = vaSlotRepo.create({
                  venueId: venue.venueId,
                  Date: transitionDate,
                  status: SlotStatus.HOLDING,
                  slotType: SlotType.TRANSITION,
                  eventId: event.eventId, // Link transition slot to the event
                  notes: `Transition time for event ${event.eventId}`,
                  metadata: {
                    relatedEventId: event.eventId,
                    transitionDirection: "before",
                  },
                });
                await queryRunner.manager.save(newTransitionSlot);
              } else {
                // If a slot exists, update it to HOLDING if it's available
                if (existingTransitionSlot.status === SlotStatus.AVAILABLE) {
                  existingTransitionSlot.status = SlotStatus.HOLDING;
                  existingTransitionSlot.eventId = event.eventId; // Correctly link to the event
                  existingTransitionSlot.slotType = SlotType.TRANSITION;
                  existingTransitionSlot.notes = `Transition time for event ${event.eventId}`;
                  existingTransitionSlot.metadata = {
                    relatedEventId: event.eventId,
                    transitionDirection: "before",
                  };
                  await queryRunner.manager.save(existingTransitionSlot);
                } else {
                  // This implies a conflict. For now, we'll log a warning.
                  console.warn(
                    `Conflict detected for transition slot at ${transitionDate
                      .toISOString()
                      .slice(0, 10)} for venue ${venue.venueId}. Already ${
                      existingTransitionSlot.status
                    }`
                  );
                }
              }
            }
          } else if (venue.bookingType === BookingType.HOURLY) {
            for (const bookingDate of dates) {
              if (bookingDate.hours && bookingDate.hours.length > 0) {
                const sortedEventHours = [...bookingDate.hours].sort(
                  (a, b) => a - b
                );
                const firstEventHour = sortedEventHours[0];

                const transitionHoursToHold: number[] = [];
                for (let i = 1; i <= transitionTime; i++) {
                  const tHour = firstEventHour - i;
                  if (tHour >= 0) {
                    transitionHoursToHold.unshift(tHour); // Add to the beginning
                  }
                }

                const allHoursToHold = [
                  ...transitionHoursToHold,
                  ...sortedEventHours,
                ];

                // Find an existing slot that is either AVAILABLE or already HOLDING for this specific event
                const existingSlot = await vaSlotRepo.findOne({
                  where: [
                    {
                      venueId: venue.venueId,
                      Date: new Date(bookingDate.date),
                      status: SlotStatus.AVAILABLE,
                    },
                    {
                      venueId: venue.venueId,
                      Date: new Date(bookingDate.date),
                      status: SlotStatus.HOLDING,
                      eventId: event.eventId, // Ensure it's for this event
                      slotType: SlotType.EVENT, // It would be an event slot holding these hours
                    },
                  ],
                });

                if (existingSlot) {
                  // Update existing slot to HOLDING and combine hours
                  const currentBookedHours = existingSlot.bookedHours || [];
                  const mergedHours = [
                    ...new Set([...currentBookedHours, ...allHoursToHold]),
                  ].sort((a, b) => a - b);

                  existingSlot.bookedHours = mergedHours;
                  existingSlot.status = SlotStatus.HOLDING;
                  existingSlot.eventId = event.eventId;
                  existingSlot.slotType = SlotType.EVENT; // Ensure it's marked as an EVENT slot
                  existingSlot.notes = "Held for new event creation (hourly)";
                  await queryRunner.manager.save(existingSlot);
                } else {
                  // Create new slot as HOLDING for combined hours
                  const newSlot = vaSlotRepo.create({
                    venueId: venue.venueId,
                    Date: new Date(bookingDate.date),
                    bookedHours: allHoursToHold,
                    status: SlotStatus.HOLDING,
                    eventId: event.eventId,
                    slotType: SlotType.EVENT, // Mark as an EVENT slot
                    notes: "Held for new event creation (hourly)",
                  });
                  await queryRunner.manager.save(newSlot);
                }
              }
            }
          }
        }

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

  static async updateEventEnableStatus(
    eventId: string,
    status: "ENABLE" | "DISABLE" | "DISABLED_BY_ADMIN"
  ) {
    try {
      const eventRepo = AppDataSource.getRepository(Event);
      const event = await eventRepo.findOne({ where: { eventId } });

      if (!event) {
        return { success: false, message: "Event not found." };
      }

      event.enableStatus = status;
      await eventRepo.save(event);

      return { success: true, data: event };
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to update event enable status.";
      return { success: false, message };
    }
  }
}
