import { EventBookingInterface } from "../interfaces/interface";
import { EventBookingRepository } from "../repositories/EventBookingRepository";

export async function checkConflict(bookingData: EventBookingInterface): Promise<{ success: boolean; message?: string }> {
    try {
        const bookingRepo = EventBookingRepository.getEventBookingRepository();
        const startDate = new Date(bookingData.startDate);
        const endDate = new Date(bookingData.endDate);
        const startTimeParts = bookingData.startTime.split(":");
        const endTimeParts = bookingData.endTime.split(":");

        const startHour = parseInt(startTimeParts[0]);
        const startMinute = parseInt(startTimeParts[1]);
        const endHour = parseInt(endTimeParts[0]);
        const endMinute = parseInt(endTimeParts[1]);

        if (isNaN(startHour) || isNaN(startMinute) || isNaN(endHour) || isNaN(endMinute)) {
            return { success: false, message: "Invalid time format: Start time and end time must be in HH:mm format." };
        }
        if (startDate > endDate) {
            return { success: false, message: "Invalid date range: Start date cannot be after end date." };
        }
        if (startDate.getTime() === endDate.getTime() && startHour >= endHour) {
            return { success: false, message: "Invalid time range: Start time cannot be after or equal to end time on the same day." };
        }
        if (startDate.getTime() === endDate.getTime() && startHour === endHour && startMinute >= endMinute) {
            return { success: false, message: "Invalid time range: Start time cannot be after or equal to end time on the same day." };
        }

//checking for time conflicts
        const startTime = new Date(startDate);
        startTime.setHours(startHour, startMinute, 0, 0);
        const endTime = new Date(endDate);
        endTime.setHours(endHour, endMinute, 0, 0);
        const bookings = await bookingRepo.createQueryBuilder("booking")
            .where("booking.venueVenueId = :venueId", { venueId: bookingData.venueId })
            .andWhere("booking.startDate = :startDate", { startDate })
            .andWhere("booking.endDate = :endDate", { endDate })
            .andWhere(
                "(EXTRACT(HOUR FROM booking.startTime) BETWEEN :startHour AND :endHour) OR " +
                "(EXTRACT(HOUR FROM booking.endTime) BETWEEN :startHour AND :endHour)",
                { startHour, endHour }
            )
            .getMany();
            //the next booking should start after 15 to 30 minutes of the previous booking
        const bookingDuration = (endTime.getTime() - startTime.getTime()) / (1000 * 60); // in minutes
        const bufferTime = 30; // 30 minutes buffer time
        const nextBookingStartTime = new Date(endTime.getTime() + bufferTime * 60 * 1000);
        const nextBookings = await bookingRepo.createQueryBuilder("booking")
            .where("booking.venueVenueId = :venueId", { venueId: bookingData.venueId })
            .andWhere("booking.startDate = :startDate", { startDate })
            .andWhere("booking.endDate = :endDate", { endDate })
            .andWhere(
                "(EXTRACT(HOUR FROM booking.startTime) BETWEEN :nextStartHour AND :nextEndHour) OR " +
                "(EXTRACT(HOUR FROM booking.endTime) BETWEEN :nextStartHour AND :nextEndHour)",
                { nextStartHour: startHour + 1, nextEndHour: endHour + 1 }
            )
            .getMany();
            //should be start in next 15-30 minutes
            
        if (nextBookings.length > 0) {
            return { success: false, message: "Time conflict detected with existing bookings.Next should be start in 15-to 30 minutes" };
        }
       

        return { success: true };
    } catch (error) {
        console.error("Error checking time conflicts:", error);
        return { success: false, message: "Failed to check time conflicts." };
    }
}
