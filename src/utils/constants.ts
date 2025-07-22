export const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

import { AppDataSource } from "../config/Database";
import { VenueAvailabilitySlot } from "../models/Venue Tables/VenueAvailabilitySlot";
import { Between, Raw } from "typeorm";

/**
 * Checks if a venue is available for the requested date/time range.
 * @param venueId - The venue's UUID
 * @param bookingType - 'DAILY' or 'HOURLY'
 * @param startDate - 'YYYY-MM-DD'
 * @param endDate - 'YYYY-MM-DD'
 * @param hours - number[] (for HOURLY)
 * @returns {Promise<{available: boolean, unavailableDates?: string[]}>}
 */
export async function checkVenueAvailability({
  venueId,
  bookingType,
  startDate,
  endDate,
  hours,
}: {
  venueId: string;
  bookingType: string;
  startDate: string;
  endDate: string;
  hours?: number[];
}): Promise<{ available: boolean; unavailableDates?: string[] }> {
  // Convert date strings to Date objects for typeorm query
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (bookingType === "DAILY") {
    // Query for any unavailable slot in the date range
    const slots = await AppDataSource.getRepository(VenueAvailabilitySlot).find(
      {
        where: {
          venueId,
          Date: Between(start, end),
        },
        select: ["Date"],
      }
    );
    if (slots.length > 0) {
      // Return the unavailable dates
      const unavailableDates = slots.map((s: { Date: any }) => {
        if (s.Date instanceof Date) {
          return s.Date.toISOString().slice(0, 10);
        }
        if (typeof s.Date === "string") {
          return s.Date.slice(0, 10);
        }
        // Fallback: always convert to string before slicing, and handle undefined/null
        return (s.Date ? String(s.Date) : "").slice(0, 10);
      });
      return { available: false, unavailableDates };
    }
    return { available: true };
  } else if (
    bookingType === "HOURLY" &&
    Array.isArray(hours) &&
    hours.length > 0
  ) {
    // Query for any slot that overlaps with the requested hours on any day
    const slots = await AppDataSource.getRepository(VenueAvailabilitySlot).find(
      {
        where: {
          venueId,
          Date: Between(start, end),
        },
      }
    );
    // Filter in JS for hour overlap
    const unavailableDates: string[] = [];
    for (const slot of slots) {
      if (Array.isArray(slot.bookedHours) && slot.bookedHours.length > 0) {
        const overlap = hours.some((h) => (slot.bookedHours ?? []).includes(h));
        if (overlap) {
          unavailableDates.push(
            slot.Date instanceof Date
              ? slot.Date.toISOString().slice(0, 10)
              : String(slot.Date).slice(0, 10)
          );
        }
      }
    }
    if (unavailableDates.length > 0) {
      return { available: false, unavailableDates };
    }
    return { available: true };
  }
  // Unknown booking type
  return { available: false };
}

// Instead of using slot.startTime and slot.endTime, use slot.bookedHours
// Example: to get a string of booked hours
export function getSlotHoursString(slot: any): string {
  if (Array.isArray(slot.bookedHours) && slot.bookedHours.length > 0) {
    return slot.bookedHours
      .map((h: number) => `${h.toString().padStart(2, "0")}:00`)
      .join(", ");
  }
  return "";
}
