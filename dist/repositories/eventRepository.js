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
exports.EventRepository = void 0;
const Database_1 = require("../config/Database");
const Event_1 = require("../models/Event Tables/Event");
const VenueBooking_1 = require("../models/VenueBooking");
const User_1 = require("../models/User");
const EventVenue_1 = require("../models/Event Tables/EventVenue");
const EventGuest_1 = require("../models/Event Tables/EventGuest");
const uuid_1 = require("uuid");
class EventRepository {
    static createEventWithRelations(eventData, venues, guests, dates) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            const queryRunner = Database_1.AppDataSource.createQueryRunner();
            yield queryRunner.connect();
            yield queryRunner.startTransaction();
            try {
                const createdEvents = [];
                // Generate a groupId for all related events
                const groupId = dates.length > 1 || venues.length > 1 ? (0, uuid_1.v4)() : undefined;
                // Create separate events for each date and venue combination
                for (const bookingDate of dates) {
                    for (const venue of venues) {
                        // 1. Create Event for this specific date and venue
                        let createdByUserId = eventData.eventOrganizerId;
                        let createdBy = undefined;
                        if (createdByUserId) {
                            createdBy = yield queryRunner.manager
                                .getRepository(User_1.User)
                                .findOne({ where: { userId: createdByUserId } });
                        }
                        const singleDateEvent = queryRunner.manager.create(Event_1.Event, Object.assign(Object.assign({}, eventData), { bookingDates: [bookingDate], groupId: groupId, // Set the groupId for related events
                            createdByUserId,
                            createdBy }));
                        yield queryRunner.manager.save(singleDateEvent);
                        // 2. Create EventVenue for this date and venue
                        const eventVenue = queryRunner.manager.create(EventVenue_1.EventVenue, {
                            eventId: singleDateEvent.eventId,
                            venueId: venue.venueId,
                            bookingDates: [bookingDate], // Only use this single date
                            timezone: "UTC",
                        });
                        yield queryRunner.manager.save(eventVenue);
                        // Calculate total hours and amount for hourly venues
                        const totalHours = ((_a = bookingDate.hours) === null || _a === void 0 ? void 0 : _a.length) || 1;
                        const baseVenueAmount = ((_b = venue.venueVariables[0]) === null || _b === void 0 ? void 0 : _b.venueAmount) || 0;
                        const totalAmount = venue.bookingType === "HOURLY"
                            ? baseVenueAmount * totalHours
                            : baseVenueAmount;
                        // Create VenueBooking for this date and venue
                        // Fetch the user entity for the createdBy field
                        let userEntity = undefined;
                        if (eventData.eventOrganizerId) {
                            userEntity = yield queryRunner.manager.getRepository(User_1.User).findOne({
                                where: { userId: eventData.eventOrganizerId },
                            });
                        }
                        const venueBooking = queryRunner.manager.create(VenueBooking_1.VenueBooking, {
                            eventId: singleDateEvent.eventId,
                            venueId: venue.venueId,
                            venue: venue,
                            bookingReason: eventData.eventType,
                            bookingDates: [bookingDate], // Only use this single date
                            bookingStatus: VenueBooking_1.BookingStatus.PENDING,
                            isPaid: false,
                            timezone: "UTC",
                            createdBy: eventData.eventOrganizerId,
                            user: userEntity || undefined, // <-- set the user relation
                            amountToBePaid: totalAmount, // Use calculated total amount
                        });
                        yield queryRunner.manager.save(venueBooking);
                        // 4. Create EventGuests if public (copy guests to each event)
                        let eventGuests = [];
                        if (guests && guests.length > 0) {
                            eventGuests = yield Promise.all(guests.map((guest) => __awaiter(this, void 0, void 0, function* () {
                                const eventGuest = queryRunner.manager.create(EventGuest_1.EventGuest, {
                                    eventId: singleDateEvent.eventId,
                                    guestName: guest.guestName,
                                    guestPhoto: guest.guestPhoto,
                                });
                                return yield queryRunner.manager.save(eventGuest);
                            })));
                        }
                        // Add this event's data to our results
                        createdEvents.push({
                            event: singleDateEvent,
                            eventVenue,
                            venueBooking,
                            eventGuests,
                        });
                    }
                }
                yield queryRunner.commitTransaction();
                return {
                    success: true,
                    data: createdEvents, // Return array of all created events and their related records
                };
            }
            catch (error) {
                const message = error instanceof Error
                    ? error.message
                    : "Failed to create event and related records.";
                yield queryRunner.rollbackTransaction();
                return {
                    success: false,
                    message,
                };
            }
            finally {
                yield queryRunner.release();
            }
        });
    }
    static getAllEventsWithRelations() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const events = yield Database_1.AppDataSource.getRepository(Event_1.Event).find({
                    relations: ["venueBookings", "eventVenues", "eventGuests"],
                    order: { createdAt: "DESC" },
                });
                return { success: true, data: events };
            }
            catch (error) {
                const message = error instanceof Error ? error.message : "Failed to fetch events.";
                return {
                    success: false,
                    message,
                };
            }
        });
    }
    static getEventByIdWithRelations(id) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const event = yield Database_1.AppDataSource.getRepository(Event_1.Event).findOne({
                    where: { eventId: id },
                    relations: ["eventVenues", "eventGuests"],
                });
                if (!event) {
                    return { success: false, message: "Event not found" };
                }
                // Fetch venue details for each eventVenue
                const venueRepo = Database_1.AppDataSource.getRepository(require("../models/Venue Tables/Venue").Venue);
                const venues = [];
                for (const ev of event.eventVenues || []) {
                    if (ev.venueId) {
                        const venue = yield venueRepo.findOne({
                            where: { venueId: ev.venueId },
                        });
                        if (venue)
                            venues.push(venue);
                    }
                }
                return { success: true, data: Object.assign(Object.assign({}, event), { venues }) };
            }
            catch (error) {
                const message = error instanceof Error ? error.message : "Failed to fetch event.";
                return {
                    success: false,
                    message,
                };
            }
        });
    }
    static updateEventStatus(id, updateFields) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const repo = Database_1.AppDataSource.getRepository(Event_1.Event);
                const event = yield repo.findOne({ where: { eventId: id } });
                if (!event) {
                    return { success: false, message: "Event not found" };
                }
                Object.assign(event, updateFields);
                yield repo.save(event);
                return { success: true, data: event };
            }
            catch (error) {
                const message = error instanceof Error
                    ? error.message
                    : "Failed to update event status.";
                return {
                    success: false,
                    message,
                };
            }
        });
    }
}
exports.EventRepository = EventRepository;
EventRepository.CACHE_PREFIX = "event:";
EventRepository.CACHE_TTL = 1800; // 30 minutes in seconds
