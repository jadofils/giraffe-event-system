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
 * @param startTime - 'HH:mm' (optional, for HOURLY)
 * @param endTime - 'HH:mm' (optional, for HOURLY)
 * @returns {Promise<{available: boolean, unavailableDates?: string[]}>}
 */
export async function checkVenueAvailability({
  venueId,
  bookingType,
  startDate,
  endDate,
  startTime,
  endTime,
}: {
  venueId: string;
  bookingType: string;
  startDate: string;
  endDate: string;
  startTime?: string;
  endTime?: string;
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
  } else if (bookingType === "HOURLY") {
    // Query for any slot that overlaps with the requested time on any day
    const slots = await AppDataSource.getRepository(VenueAvailabilitySlot).find(
      {
        where: {
          venueId,
          Date: Between(start, end),
        },
      }
    );
    // Filter in JS for time overlap
    const unavailableDates: string[] = [];
    for (const slot of slots) {
      // slot.startTime and slot.endTime are Date objects (time only)
      // Convert to string 'HH:mm:ss' for comparison
      const slotStart = slot.startTime
        ? slot.startTime.toTimeString().slice(0, 5)
        : null;
      const slotEnd = slot.endTime
        ? slot.endTime.toTimeString().slice(0, 5)
        : null;
      if (
        slotStart &&
        slotEnd &&
        slotStart < (endTime || "23:59") &&
        slotEnd > (startTime || "00:00")
      ) {
        unavailableDates.push(slot.Date.toISOString().slice(0, 10));
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
