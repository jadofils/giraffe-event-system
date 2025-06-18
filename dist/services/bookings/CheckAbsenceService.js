"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CheckAbsenceService = void 0;
exports.checkAvailability = checkAvailability;
exports.validateBooking = validateBooking;
const Database_1 = require("../../config/Database");
const VenueBooking_1 = require("../../models/VenueBooking");
const Event_1 = require("../../models/Event");
const BookingService_1 = require("./BookingService");
/**
 * Service to check availability of time slots for venue bookings.
 */
class CheckAbsenceService {
    /**
     * Checks available days, hours, and minutes for a specific venue using the associated event's dates and times.
     * @param req - Authenticated request containing user token.
     * @param venueId - The venue ID to check availability for.
     * @param queryStartDate - The start date range for the availability check.
     * @param queryEndDate - The end date range for the availability check.
     * @returns Object containing available days, hours, and minutes, or an error response.
     */
    static getAvailableSlots(req, venueId, queryStartDate, queryEndDate) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Validate user authentication
                const user = req.user;
                if (!user) {
                    return { success: false, message: 'Unauthorized access. User token is required.' };
                }
                console.log(`Checking availability for User: ${user.userId}, Organization: ${user.organizationId}`);
                // Fetch approved bookings with their associated events
                const bookingRepo = Database_1.AppDataSource.getRepository(VenueBooking_1.VenueBooking);
                const bookedSlots = yield bookingRepo
                    .createQueryBuilder('booking')
                    .leftJoinAndSelect('booking.event', 'event')
                    .where('booking.venueVenueId = :venueId', { venueId })
                    .andWhere('booking.approvalStatus = :status', { status: 'approved' })
                    .andWhere('event.startDate BETWEEN :queryStartDate AND :queryEndDate', {
                    queryStartDate,
                    queryEndDate,
                })
                    .orderBy('event.startDate', 'ASC')
                    .addOrderBy('event.startTime', 'ASC')
                    .getMany();
                const availableDays = [];
                const availableHours = [];
                const availableMinutes = [];
                let currentDate = new Date(queryStartDate);
                currentDate.setHours(0, 0, 0, 0); // Normalize to start of day
                const endBoundaryDate = new Date(queryEndDate);
                endBoundaryDate.setHours(23, 59, 59, 999); // Normalize to end of day
                while (currentDate.getTime() <= endBoundaryDate.getTime()) {
                    const currentDateStr = currentDate.toISOString().slice(0, 10);
                    const dailyBookings = bookedSlots.filter((booking) => { var _a; return booking.event && ((_a = booking.event.startDate) === null || _a === void 0 ? void 0 : _a.toISOString().slice(0, 10)) === currentDateStr; });
                    if (dailyBookings.length === 0) {
                        availableDays.push(currentDateStr); // Mark day as fully available
                    }
                    else {
                        let previousEndTime = '00:00'; // Start of the day
                        // Sort bookings by event start time
                        dailyBookings.sort((a, b) => {
                            var _a, _b, _c, _d;
                            const startA = (_b = (_a = a.event) === null || _a === void 0 ? void 0 : _a.startTime) !== null && _b !== void 0 ? _b : ""; // Default to empty string if undefined
                            const startB = (_d = (_c = b.event) === null || _c === void 0 ? void 0 : _c.startTime) !== null && _d !== void 0 ? _d : "";
                            return startA.localeCompare(startB);
                        });
                        for (const booking of dailyBookings) {
                            if (!booking.event || !booking.event.startTime || !booking.event.endTime) {
                                continue; // Skip bookings with incomplete event data
                            }
                            const { startTime, endTime } = booking.event;
                            // Identify gaps before the current booking
                            if (previousEndTime < startTime) {
                                availableHours.push(`${previousEndTime} - ${startTime} on ${currentDateStr}`);
                                availableMinutes.push(`${previousEndTime} - ${startTime} on ${currentDateStr}`);
                            }
                            previousEndTime = endTime;
                        }
                        // Check for availability after the last booking
                        if (previousEndTime < '23:59') {
                            availableHours.push(`${previousEndTime} - 23:59 on ${currentDateStr}`);
                            availableMinutes.push(`${previousEndTime} - 23:59 on ${currentDateStr}`);
                        }
                    }
                    currentDate.setDate(currentDate.getDate() + 1); // Move to next day
                }
                return { availableDays, availableHours, availableMinutes };
            }
            catch (error) {
                console.error('Error checking available slots:', error);
                return { success: false, message: 'Failed to check booking availability.' };
            }
        });
    }
}
exports.CheckAbsenceService = CheckAbsenceService;
/**
 * Checks if the requested booking time is within available slots using the event's dates and times.
 * @param req - Authenticated request containing user token.
 * @param bookingData - The booking data including the associated event.
 * @returns Object indicating success and an optional message.
 */
function checkAvailability(req, bookingData) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            // Validate event data
            if (!bookingData.event ||
                !bookingData.event.startDate ||
                !bookingData.event.endDate ||
                !bookingData.event.startTime ||
                !bookingData.event.endTime) {
                return {
                    success: false,
                    message: 'Booking event data (dates/times) is missing or incomplete, cannot check availability.',
                };
            }
            const requestedStartDate = new Date(bookingData.event.startDate);
            const requestedEndDate = new Date(bookingData.event.endDate);
            const requestedDate = requestedStartDate.toISOString().slice(0, 10);
            const requestedStartTime = bookingData.event.startTime;
            const requestedEndTime = bookingData.event.endTime;
            // Fetch available slots
            const availableSlotsResult = yield CheckAbsenceService.getAvailableSlots(req, bookingData.venueId, requestedStartDate, requestedEndDate);
            if ('success' in availableSlotsResult && !availableSlotsResult.success) {
                return availableSlotsResult;
            }
            const { availableDays, availableHours } = availableSlotsResult;
            // Check if the day is completely available
            if (availableDays.includes(requestedDate)) {
                return { success: true };
            }
            // Check if the requested time range falls within available hours
            let isAvailable = false;
            for (const timeSlot of availableHours) {
                if (timeSlot.includes(`on ${requestedDate}`)) {
                    const timeRange = timeSlot.split(' on ')[0];
                    const [availableStart, availableEnd] = timeRange.split(' - ');
                    if (requestedStartTime >= availableStart && requestedEndTime <= availableEnd) {
                        isAvailable = true;
                        break;
                    }
                }
            }
            if (!isAvailable) {
                let nearestSlot = '';
                for (const timeSlot of availableHours) {
                    if (timeSlot.includes(`on ${requestedDate}`)) {
                        nearestSlot = timeSlot.split(' on ')[0];
                        break;
                    }
                }
                const message = nearestSlot
                    ? `The requested time (${requestedStartTime} - ${requestedEndTime}) is not available. The nearest available time slot on ${requestedDate} is ${nearestSlot}.`
                    : `The requested time (${requestedStartTime} - ${requestedEndTime}) is not available on ${requestedDate}.`;
                return { success: false, message };
            }
            return { success: true };
        }
        catch (error) {
            console.error('Error checking availability:', error);
            return { success: false, message: 'Failed to check availability.' };
        }
    });
}
/**
 * Validates a booking by checking both availability and conflicts.
 * Ensures event details are populated before validation.
 * @param req - Authenticated request containing user token.
 * @param bookingData - The booking data including the associated event.
 * @returns Object indicating success and an optional message.
 */
function validateBooking(req, bookingData) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            // Ensure event details are populated
            if (!bookingData.event ||
                !bookingData.event.startDate ||
                !bookingData.event.endDate ||
                !bookingData.event.startTime ||
                !bookingData.event.endTime) {
                const eventRepo = Database_1.AppDataSource.getRepository(Event_1.Event);
                const event = yield eventRepo.findOne({
                    where: { eventId: bookingData.eventId },
                    select: ['eventId', 'startDate', 'endDate', 'startTime', 'endTime', 'eventTitle']
                });
                if (!event) {
                    return {
                        success: false,
                        message: 'Associated event not found for booking validation. Cannot proceed.',
                    };
                }
                // bookingData.event=event
            }
            // Check availability
            const availabilityCheck = yield checkAvailability(req, bookingData);
            if (!availabilityCheck.success) {
                return availabilityCheck;
            }
            // Check for conflicts
            const conflictCheck = yield (0, BookingService_1.checkConflict)(bookingData);
            if (!conflictCheck.success) {
                return conflictCheck;
            }
            return { success: true, message: 'Booking is valid and available.' };
        }
        catch (error) {
            console.error('Error validating booking:', error);
            return { success: false, message: 'Failed to validate booking.' };
        }
    });
}
