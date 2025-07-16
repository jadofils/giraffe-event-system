import { AppDataSource } from "../../config/Database";
import { VenueBooking } from "../../models/VenueBooking";
import { Event } from "../../models/Event Tables/Event";
import { Request } from "express";
import { VenueBookingInterface } from "../../interfaces/VenueBookingInterface";
import { checkConflict } from "./BookingService";

/**
 * Service to check availability of time slots for venue bookings.
 */
export class CheckAbsenceService {
  /**
   * Checks available days, hours, and minutes for a specific venue using the associated event's dates and times.
   * @param req - The request containing user token.
   * @param venueId - The venue ID to check availability for.
   * @param queryStartDate - The start date range for the availability check.
   * @param queryEndDate - The end date range for the availability check.
   * @returns Object containing available days, hours, and minutes, or an error response.
   */
  static async getAvailableSlots(
    req: Request,
    venueId: string,
    queryStartDate: Date,
    queryEndDate: Date
  ): Promise<
    | {
        availableDays: string[];
        availableHours: string[];
        availableMinutes: string[];
      }
    | { success: false; message: string }
  > {
    try {
      // Validate user authentication
      const user = req.user;
      if (!user) {
        return {
          success: false,
          message: "Unauthorized access. User token is required.",
        };
      }

      console.log(
        `Checking availability for User: ${user.userId}, Organization: ${user.organizationId}`
      );

      // Fetch approved bookings with their associated events
      const bookingRepo = AppDataSource.getRepository(VenueBooking);
      const bookedSlots = await bookingRepo
        .createQueryBuilder("booking")
        .leftJoinAndSelect("booking.event", "event")
        .where("booking.venueId = :venueId", { venueId })
        .andWhere("booking.approvalStatus = :status", { status: "approved" })
        .andWhere("event.startDate BETWEEN :queryStartDate AND :queryEndDate", {
          queryStartDate,
          queryEndDate,
        })
        .orderBy("event.startDate", "ASC")
        .addOrderBy("event.startTime", "ASC")
        .getMany();

      const availableDays: string[] = [];
      const availableHours: string[] = [];
      const availableMinutes: string[] = [];

      let currentDate = new Date(queryStartDate);
      currentDate.setHours(0, 0, 0, 0); // Normalize to start of day

      const endBoundaryDate = new Date(queryEndDate);
      endBoundaryDate.setHours(23, 59, 59, 999); // Normalize to end of day

      while (currentDate.getTime() <= endBoundaryDate.getTime()) {
        const currentDateStr = currentDate.toISOString().slice(0, 10);
        const dailyBookings = bookedSlots.filter(
          (booking) =>
            booking.event && booking.event.startDate === currentDateStr
        );

        if (dailyBookings.length === 0) {
          availableDays.push(currentDateStr); // Mark day as fully available
        } else {
          let previousEndTime = "00:00"; // Start of the day

          // Sort bookings by event start time
          dailyBookings.sort((a, b) => {
            const startA = a.event?.startTime ?? "";
            const startB = b.event?.startTime ?? "";
            return startA.localeCompare(startB);
          });

          for (const booking of dailyBookings) {
            if (!booking.event || !booking.event.endTime) {
              continue; // Skip bookings with incomplete event data
            }

            const { startTime, endTime } = booking.event;

            // Identify gaps before the current booking
            if (previousEndTime < startTime) {
              availableHours.push(
                `${previousEndTime} - ${startTime} on ${currentDateStr}`
              );
              availableMinutes.push(
                `${previousEndTime} - ${startTime} on ${currentDateStr}`
              );
            }

            previousEndTime = endTime;
          }

          // Check for availability after the last booking
          if (previousEndTime < "23:59") {
            availableHours.push(
              `${previousEndTime} - 23:59 on ${currentDateStr}`
            );
            availableMinutes.push(
              `${previousEndTime} - 23:59 on ${currentDateStr}`
            );
          }
        }

        currentDate.setDate(currentDate.getDate() + 1); // Move to next day
      }

      return { availableDays, availableHours, availableMinutes };
    } catch (error) {
      console.error("Error checking available slots:", error);
      return {
        success: false,
        message: "Failed to check booking availability.",
      };
    }
  }

  /**
   * Checks if the requested booking time is within available slots using the event's dates and times.
   * @param req - The request containing user token.
   * @param bookingData - The booking data including the associated event.
   * @returns Object indicating success and an optional message.
   */
  static async checkAvailability(
    req: Request,
    bookingData: VenueBookingInterface
  ): Promise<{ success: boolean; message?: string }> {
    try {
      // Fetch event data if not provided
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
          select: ["eventId", "startDate", "endDate", "startTime", "endTime"],
        });

        if (!foundEvent) {
          return {
            success: false,
            message: "Associated event not found. Cannot check availability.",
          };
        }
        event = foundEvent;
      }

      if (!event.startDate || !event.endDate) {
        return {
          success: false,
          message: "Event startDate or endDate is undefined.",
        };
      }
      const requestedStartDate = new Date(event.startDate);
      const requestedEndDate = new Date(event.endDate);
      const requestedDate = requestedStartDate.toISOString().slice(0, 10);
      const requestedStartTime = event.startTime;
      const requestedEndTime = event.endTime;

      if (
        isNaN(requestedStartDate.getTime()) ||
        isNaN(requestedEndDate.getTime())
      ) {
        return { success: false, message: "Invalid date format." };
      }

      if (requestedStartDate > requestedEndDate) {
        return {
          success: false,
          message: "Start date cannot be after end date.",
        };
      }

      // Fetch available slots
      const availableSlotsResult = await this.getAvailableSlots(
        req,
        bookingData.venueId,
        requestedStartDate,
        requestedEndDate
      );

      if ("success" in availableSlotsResult && !availableSlotsResult.success) {
        return availableSlotsResult;
      }

      const { availableDays, availableHours } = availableSlotsResult as {
        availableDays: string[];
        availableHours: string[];
        availableMinutes: string[];
      };

      // Check if the day is completely available
      if (availableDays.includes(requestedDate)) {
        return { success: true };
      }

      // Check if the requested time range falls within available hours
      let isAvailable = false;

      for (const timeSlot of availableHours) {
        if (timeSlot.includes(`on ${requestedDate}`)) {
          const timeRange = timeSlot.split(" on ")[0];
          const [availableStart, availableEnd] = timeRange.split(" - ");

          if (
            requestedStartTime !== undefined &&
            requestedEndTime !== undefined &&
            requestedStartTime >= availableStart &&
            requestedEndTime <= availableEnd
          ) {
            isAvailable = true;
            break;
          }
        }
      }

      if (!isAvailable) {
        let nearestSlot = "";
        for (const timeSlot of availableHours) {
          if (timeSlot.includes(`on ${requestedDate}`)) {
            nearestSlot = timeSlot.split(" on ")[0];
            break;
          }
        }

        const message = nearestSlot
          ? `The requested time (${requestedStartTime} - ${requestedEndTime}) is not available. The nearest available time slot on ${requestedDate} is ${nearestSlot}.`
          : `The requested time (${requestedStartTime} - ${requestedEndTime}) is not available on ${requestedDate}.`;

        return { success: false, message };
      }

      return { success: true };
    } catch (error) {
      console.error("Error checking availability:", error);
      return { success: false, message: "Failed to check availability." };
    }
  }

  /**
   * Validates a booking by checking both availability and conflicts.
   * Ensures event details are populated before validation.
   * @param req - The request containing user token.
   * @param bookingData - The booking data including the associated event.
   * @returns Object indicating success and an optional message.
   */
  static async validateBooking(
    req: Request,
    bookingData: VenueBookingInterface
  ): Promise<{ success: boolean; message?: string }> {
    try {
      // Ensure event details are populated
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
          select: [
            "eventId",
            "startDate",
            "endDate",
            "startTime",
            "endTime",
            "eventTitle",
          ],
        });

        if (!foundEvent) {
          return {
            success: false,
            message:
              "Associated event not found for booking validation. Cannot proceed.",
          };
        }
        event = foundEvent;
        bookingData.event = event; // Update for downstream use
      }

      // Check availability
      const availabilityCheck = await this.checkAvailability(req, bookingData);
      if (!availabilityCheck.success) {
        return availabilityCheck;
      }

      // Check for conflicts
      const conflictCheck = await checkConflict(bookingData);
      if (!conflictCheck.success) {
        return conflictCheck;
      }

      return { success: true, message: "Booking is valid and available." };
    } catch (error) {
      console.error("Error validating booking:", error);
      return { success: false, message: "Failed to validate booking." };
    }
  }
}
