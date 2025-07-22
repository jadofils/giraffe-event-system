import { Venue } from "../../models/Venue Tables/Venue";
import { BookingDateDTO } from "../../interfaces/BookingDateInterface";
import { AppDataSource } from "../../config/Database";
import {
  VenueAvailabilitySlot,
  SlotStatus,
  SlotType,
} from "../../models/Venue Tables/VenueAvailabilitySlot";
import { Between, LessThanOrEqual, MoreThanOrEqual } from "typeorm";

export class BookingValidationService {
  static async validateBookingDates(
    venue: Venue,
    bookingDates: BookingDateDTO[],
    options = { checkTransitionTime: true }
  ) {
    try {
      const slotRepo = AppDataSource.getRepository(VenueAvailabilitySlot);
      const unavailableDates: Array<{
        date: string;
        hours?: number[];
        reason: string;
        warningType: "ERROR" | "WARNING";
        isTransitionWarning?: boolean;
      }> = [];

      // Get booking condition for transition time
      const bookingCondition = venue.bookingConditions?.[0];
      const transitionTime = bookingCondition?.transitionTime || 0;

      for (const bookingDate of bookingDates) {
        const eventDate = new Date(bookingDate.date);

        // Check event date availability first - this is mandatory
        const existingEventSlot = await slotRepo.findOne({
          where: {
            venueId: venue.venueId,
            Date: eventDate,
          },
        });

        if (
          existingEventSlot &&
          existingEventSlot.status !== SlotStatus.AVAILABLE
        ) {
          unavailableDates.push({
            date: bookingDate.date,
            hours: existingEventSlot.bookedHours,
            reason: `Event date ${bookingDate.date} is already booked`,
            warningType: "ERROR",
            isTransitionWarning: false,
          });
          continue;
        }

        // Check transition time availability - this is optional
        if (options.checkTransitionTime && transitionTime > 0) {
          const transitionDate = new Date(eventDate);
          transitionDate.setDate(transitionDate.getDate() - transitionTime);

          const transitionSlot = await slotRepo.findOne({
            where: {
              venueId: venue.venueId,
              Date: transitionDate,
            },
          });

          if (
            transitionSlot &&
            transitionSlot.status !== SlotStatus.AVAILABLE
          ) {
            unavailableDates.push({
              date: transitionDate.toISOString().split("T")[0],
              hours: transitionSlot.bookedHours,
              reason: `Transition time not available on ${
                transitionDate.toISOString().split("T")[0]
              } (day before event on ${
                bookingDate.date
              }). Event can still be booked but without transition time.`,
              warningType: "WARNING",
              isTransitionWarning: true,
            });
          }
        }
      }

      return {
        isAvailable: !unavailableDates.some((d) => d.warningType === "ERROR"),
        unavailableDates,
        hasTransitionTimeWarnings: unavailableDates.some(
          (d) => d.isTransitionWarning
        ),
      };
    } catch (error) {
      throw new Error(
        `Failed to validate booking dates: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  static async reserveEventAndTransitionSlots(
    venue: Venue,
    eventId: string,
    bookingDates: BookingDateDTO[],
    transitionTime: number
  ) {
    const slotRepo = AppDataSource.getRepository(VenueAvailabilitySlot);
    const reservedSlots: {
      eventSlots: VenueAvailabilitySlot[];
      transitionSlots: VenueAvailabilitySlot[];
    } = {
      eventSlots: [],
      transitionSlots: [],
    };

    for (const bookingDate of bookingDates) {
      const eventDate = new Date(bookingDate.date);

      // Always create event slot
      const eventSlot = slotRepo.create({
        venueId: venue.venueId,
        Date: eventDate,
        status: SlotStatus.BOOKED,
        eventId,
        slotType: SlotType.EVENT,
        bookedHours: bookingDate.hours,
        metadata: {
          originalEventHours: bookingDate.hours,
        },
      });
      reservedSlots.eventSlots.push(await slotRepo.save(eventSlot));

      // Only check and create transition slot BEFORE the event
      if (transitionTime > 0) {
        const transitionDate = new Date(eventDate);
        transitionDate.setDate(transitionDate.getDate() - transitionTime);

        // Check if transition slot before event is available
        const existingTransitionSlot = await slotRepo.findOne({
          where: {
            venueId: venue.venueId,
            Date: transitionDate,
          },
        });

        // Only create transition slot if the day before is available
        if (
          !existingTransitionSlot ||
          existingTransitionSlot.status === SlotStatus.AVAILABLE
        ) {
          const transitionSlot = slotRepo.create({
            venueId: venue.venueId,
            Date: transitionDate,
            status: SlotStatus.TRANSITION,
            eventId,
            slotType: SlotType.TRANSITION,
            metadata: {
              relatedEventId: eventId,
              transitionDirection: "before",
              originalEventHours: bookingDate.hours,
            },
          });
          reservedSlots.transitionSlots.push(
            await slotRepo.save(transitionSlot)
          );
        }
      }
    }

    return reservedSlots;
  }
}
