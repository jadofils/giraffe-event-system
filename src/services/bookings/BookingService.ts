import { VenueBookingRepository } from '../../repositories/VenueBookingRepository';
import { VenueBookingInterface } from '../../interfaces/VenueBookingInterface';

/**
 * Checks for conflicts with existing bookings based on the event's date and time.
 * @param bookingData - The booking data including the associated event.
 * @returns Object indicating success and an optional message if a conflict is found.
 */
export async function checkConflict(
  bookingData: VenueBookingInterface
): Promise<{ success: boolean; message?: string }> {
  try {
    // Validate event data
    if (
      !bookingData.event ||
      !bookingData.event.startDate ||
      !bookingData.event.endDate ||
      !bookingData.event.startTime ||
      !bookingData.event.endTime
    ) {
      return {
        success: false,
        message: 'Booking event data (dates/times) is missing or incomplete.',
      };
    }

    const startDate = new Date(bookingData.event.startDate);
    const endDate = new Date(bookingData.event.endDate);
    const startTimeParts = bookingData.event.startTime.split(':');
    const endTimeParts = bookingData.event.endTime.split(':');

    const startHour = parseInt(startTimeParts[0], 10);
    const startMinute = parseInt(startTimeParts[1], 10);
    const endHour = parseInt(endTimeParts[0], 10);
    const endMinute = parseInt(endTimeParts[1], 10);

    // Validate time format and ranges
    if (isNaN(startHour) || isNaN(startMinute) || isNaN(endHour) || isNaN(endMinute)) {
      return {
        success: false,
        message: 'Invalid time format: Start time and end time must be in HH:mm format.',
      };
    }
    if (startDate > endDate) {
      return {
        success: false,
        message: 'Invalid date range: Start date cannot be after end date.',
      };
    }
    if (
      startDate.getTime() === endDate.getTime() &&
      (startHour > endHour || (startHour === endHour && startMinute >= endMinute))
    ) {
      return {
        success: false,
        message: 'Invalid time range: Start time must be before end time on the same day.',
      };
    }

    // Convert to total minutes for comparison
    const startTotalMinutes = startHour * 60 + startMinute;
    const endTotalMinutes = endHour * 60 + endMinute;

    const bookingRepo = VenueBookingRepository.getVenueBookingRepository();

    // Check for duplicate booking (same venue, event, date, and time)
    const existingBooking = await bookingRepo
      .createQueryBuilder('booking')
      .leftJoinAndSelect('booking.event', 'event')
      .where('booking.venueVenueId = :venueId', { venueId: bookingData.venueId })
      .andWhere('booking.eventEventId = :eventId', { eventId: bookingData.eventId })
      .andWhere('event.startDate = :startDate', { startDate: startDate.toISOString().split('T')[0] })
      .andWhere('event.startTime = :startTime AND event.endTime = :endTime', {
        startTime: bookingData.event.startTime,
        endTime: bookingData.event.endTime,
      })
      .getOne();

    if (existingBooking) {
      return {
        success: false,
        message: 'Booking already exists with the same venue, event, date, and time.',
      };
    }

    // Check for time conflicts with existing bookings
    const conflictingBookings = await bookingRepo
      .createQueryBuilder('booking')
      .leftJoinAndSelect('booking.event', 'event')
      .where('booking.venueVenueId = :venueId', { venueId: bookingData.venueId })
      .andWhere('booking.approvalStatus = :status', { status: 'approved' })
      .andWhere('(event.startDate <= :endDate AND event.endDate >= :startDate)', {
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
      })
      .getMany();

    const bufferTimeMinutes = 30; // Buffer time between bookings

    for (const booking of conflictingBookings) {
      if (!booking.events || !booking.events[0] || !booking.events[0].startTime || !booking.events[0].endTime) {
        continue; // Skip bookings with incomplete event data
      }

      const existingStartTimeParts = booking.events[0].startTime.split(':');
      const existingEndTimeParts = booking.events[0].endTime.split(':');

      const existingStartHour = parseInt(existingStartTimeParts[0], 10);
      const existingStartMinute = parseInt(existingStartTimeParts[1], 10);
      const existingEndHour = parseInt(existingEndTimeParts[0], 10);
      const existingEndMinute = parseInt(existingEndTimeParts[1], 10);

      if (
        isNaN(existingStartHour) ||
        isNaN(existingStartMinute) ||
        isNaN(existingEndHour) ||
        isNaN(existingEndMinute)
      ) {
        continue; // Skip invalid time formats
      }

      const existingStartTotalMinutes = existingStartHour * 60 + existingStartMinute;
      const existingEndTotalMinutes = existingEndHour * 60 + existingEndMinute;

      // Check for time overlap
      if (
        startTotalMinutes < existingEndTotalMinutes &&
        endTotalMinutes > existingStartTotalMinutes
      ) {
        return {
          success: false,
          message: `Time conflict detected with existing booking from ${booking.events[0].startTime} to ${booking.events[0].endTime}. Please choose another time slot.`,
        };
      }

      // Check buffer time after existing booking
      if (
        existingEndTotalMinutes <= startTotalMinutes &&
        startTotalMinutes < existingEndTotalMinutes + bufferTimeMinutes
      ) {
        return {
          success: false,
          message: `Your booking starts too soon after an existing booking that ends at ${booking.events[0].endTime}. Please allow at least 30 minutes between bookings.`,
        };
      }

      // Check buffer time before existing booking
      if (
        endTotalMinutes <= existingStartTotalMinutes &&
        existingStartTotalMinutes < endTotalMinutes + bufferTimeMinutes
      ) {
        return {
          success: false,
          message: `Your booking ends too close to another booking that starts at ${booking.events[0].startTime}. Please allow at least 30 minutes between bookings.`,
        };
      }
    }

    return { success: true };
  } catch (error) {
    console.error('Error checking conflicts:', error);
    return { success: false, message: 'Failed to check booking conflicts.' };
  }
}