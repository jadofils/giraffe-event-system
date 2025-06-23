import { AppDataSource } from '../../config/Database';
import { VenueBookingInterface } from '../../interfaces/VenueBookingInterface';
import { Event } from '../../models/Event';
import { ApprovalStatus, VenueBooking } from '../../models/VenueBooking';

/**
 * Checks for conflicts with existing bookings based on the event's date and time.
 * @param bookingData - The booking data including the associated event or eventId.
 * @returns Object indicating success and an optional message if a conflict is found.
 */
export async function checkConflict(
  bookingData: VenueBookingInterface
): Promise<{ success: boolean; message?: string }> {
  try {
    // Validate required fields
    if (!bookingData.eventId || !bookingData.venueId) {
      return {
        success: false,
        message: 'Missing required fields: eventId and venueId.',
      };
    }

    // Fetch event details
    let event = bookingData.event;
    if (
      !event ||
      !event.startDate ||
      !event.endDate ||
      !event.startTime ||
      !event.endTime
    ) {
      const eventRepo = AppDataSource.getRepository(Event);
      const foundEvent = await eventRepo.findOne({
        where: { eventId: bookingData.eventId },
        select: ['eventId', 'startDate', 'endDate', 'startTime', 'endTime'],
      });
      if (!foundEvent) {
        return {
          success: false,
          message: 'Event not found or incomplete data.',
        };
      }
      event = foundEvent;
    }

    const startDate = new Date(event.startDate!);
    const endDate = new Date(event.endDate!);
    const startTime = event.startTime;
    const endTime = event.endTime;

    // Validate dates
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return {
        success: false,
        message: 'Invalid date format for startDate or endDate.',
      };
    }
    if (startDate > endDate) {
      return {
        success: false,
        message: 'Start date cannot be after end date.',
      };
    }

    // Parse time
    if (!startTime || !endTime) {
      return {
        success: false,
        message: 'Start time and end time must be provided.',
      };
    }
    const startTimeParts = startTime.split(':');
    const endTimeParts = endTime.split(':');
    const startHour = parseInt(startTimeParts[0], 10);
    const startMinute = parseInt(startTimeParts[1], 10);
    const endHour = parseInt(endTimeParts[0], 10);
    const endMinute = parseInt(endTimeParts[1], 10);

    if (
      isNaN(startHour) ||
      isNaN(startMinute) ||
      isNaN(endHour) ||
      isNaN(endMinute) ||
      startTimeParts.length < 2 ||
      endTimeParts.length < 2
    ) {
      return {
        success: false,
        message: 'Invalid time format: Start time and end time must be in HH:mm format.',
      };
    }

    // Validate time range
    const startTotalMinutes = startHour * 60 + startMinute;
    const endTotalMinutes = endHour * 60 + endMinute;
    if (
      startDate.getTime() === endDate.getTime() &&
      startTotalMinutes >= endTotalMinutes
    ) {
      return {
        success: false,
        message: 'Start time must be before end time on the same day.',
      };
    }

    const bookingRepo = AppDataSource.getRepository(VenueBooking);

    // Check for exact duplicate booking
    const existingBooking = await bookingRepo
      .createQueryBuilder('booking')
      .leftJoinAndSelect('booking.event', 'event')
      .where('booking.venueId = :venueId', { venueId: bookingData.venueId })
      .andWhere('booking.eventId = :eventId', { eventId: bookingData.eventId })
      .andWhere('event.startDate = :startDate', { startDate })
      .andWhere('event.startTime = :startTime', { startTime })
      .andWhere('event.endTime = :endTime', { endTime })
      .getOne();

    if (existingBooking) {
      return {
        success: false,
        message: 'Booking already exists with the same venue, event, date, and time.',
      };
    }

    // Check for time conflicts
    const conflictingBookings = await bookingRepo
      .createQueryBuilder('booking')
      .leftJoinAndSelect('booking.event', 'event')
      .where('booking.venueId = :venueId', { venueId: bookingData.venueId })
      .andWhere('booking.approvalStatus = :status', { status: ApprovalStatus.APPROVED })
      .andWhere('(event.startDate <= :endDate AND event.endDate >= :startDate)', {
        startDate,
        endDate,
      })
      .andWhere(
        '((event.startTime <= :endTime AND event.endTime >= :startTime) OR ' +
        '(:startTime IS NULL AND :endTime IS NULL))',
        { startTime, endTime }
      )
      .getMany();

    const bufferTimeMinutes = 30;

    for (const booking of conflictingBookings) {
      if (!booking.event || !booking.event.startTime || !booking.event.endTime) {
        continue;
      }

      const existingStartTimeParts = booking.event.startTime.split(':');
      const existingEndTimeParts = booking.event.endTime.split(':');
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
        continue;
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
          message: `Time conflict detected with existing booking from ${booking.event.startTime} to ${booking.event.endTime}.`,
        };
      }

      // Check buffer time after existing booking
      if (
        existingEndTotalMinutes <= startTotalMinutes &&
        startTotalMinutes < existingEndTotalMinutes + bufferTimeMinutes
      ) {
        return {
          success: false,
          message: `Booking starts too soon after an existing booking ending at ${booking.event.endTime}. Allow at least 30 minutes.`,
        };
      }

      // Check buffer time before existing booking
      if (
        endTotalMinutes <= existingStartTotalMinutes &&
        existingStartTotalMinutes < endTotalMinutes + bufferTimeMinutes
      ) {
        return {
          success: false,
          message: `Booking ends too close to an existing booking starting at ${booking.event.startTime}. Allow at least 30 minutes.`,
        };
      }
    }

    return { success: true };
  } catch (error) {
    console.error('Error checking conflicts:', error);
    return {
      success: false,
      message: `Failed to check conflicts: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}