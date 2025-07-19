import { BookingType, Venue } from "../../models/Venue Tables/Venue";
import { BookingDateDTO } from "../../interfaces/BookingDateInterface";
import { VenueAvailabilitySlot } from "../../models/Venue Tables/VenueAvailabilitySlot";
import { AppDataSource } from "../../config/Database";
import { Between, In } from "typeorm";

export class BookingValidationService {
  static async validateBookingDates(venue: Venue, dates: BookingDateDTO[]) {
    // Validate based on booking type
    if (venue.bookingType === BookingType.DAILY) {
      const hasHours = dates.some(
        (date) => date.hours && date.hours.length > 0
      );
      if (hasHours) {
        throw new Error("Daily venues cannot have specific hours in booking");
      }
    } else if (venue.bookingType === BookingType.HOURLY) {
      const missingHours = dates.some(
        (date) => !date.hours || date.hours.length === 0
      );
      if (missingHours) {
        throw new Error("Hourly venues must specify hours for each date");
      }
    }

    // Check availability for each date
    const slotRepo = AppDataSource.getRepository(VenueAvailabilitySlot);
    const unavailableDates: string[] = [];

    for (const bookingDate of dates) {
      const date = new Date(bookingDate.date);

      // Find existing slots for this date
      const existingSlots = await slotRepo.find({
        where: {
          venueId: venue.venueId,
          Date: date,
          isAvailable: false,
        },
      });

      if (venue.bookingType === BookingType.DAILY) {
        // For daily bookings, if any slot exists for this date, it's unavailable
        if (existingSlots.length > 0) {
          unavailableDates.push(bookingDate.date);
        }
      } else if (venue.bookingType === BookingType.HOURLY) {
        // For hourly bookings, check each requested hour
        const requestedHours = bookingDate.hours || [];
        const unavailableHours = existingSlots.filter((slot) => {
          const slotHour = new Date(slot.startTime!).getHours();
          return requestedHours.includes(slotHour);
        });

        if (unavailableHours.length > 0) {
          unavailableDates.push(bookingDate.date);
        }
      }
    }

    return {
      isAvailable: unavailableDates.length === 0,
      unavailableDates,
    };
  }

  static async createAvailabilitySlots(venue: Venue, dates: BookingDateDTO[]) {
    const slotRepo = AppDataSource.getRepository(VenueAvailabilitySlot);
    const slots: VenueAvailabilitySlot[] = [];

    for (const bookingDate of dates) {
      if (venue.bookingType === BookingType.DAILY) {
        // Create one slot for the entire day
        const slot = slotRepo.create({
          venueId: venue.venueId,
          Date: new Date(bookingDate.date),
          isAvailable: false,
        });
        slots.push(slot);
      } else if (venue.bookingType === BookingType.HOURLY) {
        // Create a slot for each hour
        for (const hour of bookingDate.hours || []) {
          const date = new Date(bookingDate.date);
          const startTime = new Date(date);
          startTime.setHours(hour, 0, 0, 0);

          const endTime = new Date(date);
          endTime.setHours(hour + 1, 0, 0, 0);

          const slot = slotRepo.create({
            venueId: venue.venueId,
            Date: date,
            startTime,
            endTime,
            isAvailable: false,
          });
          slots.push(slot);
        }
      }
    }

    await slotRepo.save(slots);
    return slots;
  }

  static getDateRange(dates: BookingDateDTO[]): {
    startDate: string;
    endDate: string;
  } {
    const sortedDates = [...dates].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    return {
      startDate: sortedDates[0].date,
      endDate: sortedDates[sortedDates.length - 1].date,
    };
  }
}
