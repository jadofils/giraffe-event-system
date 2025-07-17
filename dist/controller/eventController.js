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
exports.EventController = void 0;
const eventRepository_1 = require("../repositories/eventRepository");
class EventController {
    static createEvent(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            // try {
            //   // Validate authentication
            //   if (!req.user || !req.user.userId || !req.user.organizationId) {
            //     res.status(401).json({
            //       success: false,
            //       message: "Unauthorized: User is not properly authenticated.",
            //     });
            //     return;
            //   }
            //   // Validate UUID format for organizationId and organizerId
            //   if (!UUID_REGEX.test(req.user.organizationId)) {
            //     res.status(400).json({
            //       success: false,
            //       message: "Invalid organization ID format in token.",
            //     });
            //     return;
            //   }
            //   if (!UUID_REGEX.test(req.user.userId)) {
            //     res.status(400).json({
            //       success: false,
            //       message: "Invalid user ID format in token.",
            //     });
            //     return;
            //   }
            //   // --- Conflict check before creating event ---
            //   const bookingRepo = AppDataSource.getRepository(VenueBooking);
            //   const { venues, startDate, endDate } = req.body;
            //   if (!venues || !Array.isArray(venues) || !startDate || !endDate) {
            //     res.status(400).json({
            //       success: false,
            //       message:
            //         "venues, startDate, and endDate are required for conflict check.",
            //     });
            //     return;
            //   }
            //   for (const venueId of venues) {
            //     const conflicts = await bookingRepo
            //       .createQueryBuilder("booking")
            //       .leftJoin("booking.event", "event")
            //       .where("booking.venueId = :venueId", { venueId })
            //       .andWhere("booking.bookingStatus = :bookingStatus", {
            //         //bookingStatus: BookingStatus.APPROVED,
            //       })
            //       .andWhere("event.status = :eventStatus", { eventStatus: "APPROVED" })
            //       .andWhere(
            //         "(event.startDate <= :endDate AND event.endDate >= :startDate)",
            //         { startDate, endDate }
            //       )
            //       .getCount();
            //     if (conflicts > 0) {
            //       res.status(409).json({
            //         success: false,
            //         message: `Venue ${venueId} is already booked for an approved event on the same date(s).`,
            //         venueId,
            //       });
            //       return;
            //     }
            //   }
            //   // --- End conflict check ---
            //   const eventData: Partial<EventInterface> = {
            //     ...req.body,
            //     organizerId: req.user.userId,
            //     status: EventStatus.REQUESTED,
            //   };
            //   // Create event with organizationId from token
            //   // const createResult = await EventRepository.create(
            //   //   eventData,
            //   //   req.user.organizationId
            //   // );
            //   if (!createResult.success || !createResult.data) {
            //     res.status(400).json({ success: false, message: createResult.message });
            //     return;
            //   }
            //   // Return the full event and venues
            //   res.status(201).json({
            //     success: true,
            //     data: {
            //       event: createResult.data.event, // full event object
            //       //venues: createResult.data.venues?.map(sanitizeVenue),
            //     },
            //     message: "Event and venues associated successfully.",
            //   });
            // } catch (error) {
            //   console.error("Error in createEvent:", error);
            //   next(error);
            // }
        });
    }
}
exports.EventController = EventController;
EventController.eventRepository = new eventRepository_1.EventRepository();
