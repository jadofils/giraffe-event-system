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
exports.VenueBookingRepository = void 0;
const VenueBooking_1 = require("../models/VenueBooking");
const Database_1 = require("../config/Database");
const typeorm_1 = require("typeorm");
const VenueVariable_1 = require("../models/Venue Tables/VenueVariable");
const CacheService_1 = require("../services/CacheService");
const VenueAvailabilitySlot_1 = require("../models/Venue Tables/VenueAvailabilitySlot");
class VenueBookingRepository {
    static getAllBookings() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const repo = Database_1.AppDataSource.getRepository(VenueBooking_1.VenueBooking);
                const bookings = yield repo.find();
                // For each booking, fetch the event, its organizer, and the venue
                const eventRepo = Database_1.AppDataSource.getRepository(require("../models/Event Tables/Event").Event);
                const userRepo = Database_1.AppDataSource.getRepository(require("../models/User").User);
                const orgRepo = Database_1.AppDataSource.getRepository(require("../models/Organization").Organization);
                const venueRepo = Database_1.AppDataSource.getRepository(require("../models/Venue Tables/Venue").Venue);
                const bookingsWithOrganizerAndVenue = yield Promise.all(bookings.map((booking) => __awaiter(this, void 0, void 0, function* () {
                    let organizer = null;
                    const event = yield eventRepo.findOne({
                        where: { eventId: booking.eventId },
                    });
                    if (event) {
                        if (event.eventOrganizerType === "USER") {
                            organizer = yield userRepo.findOne({
                                where: { userId: event.eventOrganizerId },
                            });
                        }
                        else if (event.eventOrganizerType === "ORGANIZATION") {
                            organizer = yield orgRepo.findOne({
                                where: { organizationId: event.eventOrganizerId },
                            });
                        }
                    }
                    let venue = booking.venue;
                    if (!venue) {
                        const foundVenue = yield venueRepo.findOne({
                            where: { venueId: booking.venueId },
                            relations: ["venueVariables"],
                        });
                        venue = (foundVenue || null);
                    }
                    else if (!venue.venueVariables) {
                        // If venue is present but venueVariables is not loaded, fetch them
                        const foundVenue = yield venueRepo.findOne({
                            where: { venueId: booking.venueId },
                            relations: ["venueVariables"],
                        });
                        if (foundVenue)
                            venue.venueVariables = foundVenue.venueVariables;
                    }
                    return Object.assign(Object.assign({}, booking), { organizer, venue });
                })));
                return {
                    success: true,
                    message: "All bookings fetched successfully.",
                    data: bookingsWithOrganizerAndVenue,
                };
            }
            catch (error) {
                return { success: false, message: "Failed to fetch bookings.", data: [] };
            }
        });
    }
    static getBookingsByManagerId(managerId) {
        return __awaiter(this, void 0, void 0, function* () {
            const cacheKey = `venue-bookings:manager:${managerId}`;
            return yield CacheService_1.CacheService.getOrSetMultiple(cacheKey, Database_1.AppDataSource.getRepository(VenueBooking_1.VenueBooking), () => __awaiter(this, void 0, void 0, function* () {
                // Find all venues managed by this manager
                const venueVariables = yield Database_1.AppDataSource.getRepository(VenueVariable_1.VenueVariable).find({
                    where: { manager: { userId: managerId } },
                    relations: ["venue"],
                });
                const venueIds = venueVariables.map((vv) => vv.venue.venueId);
                if (venueIds.length === 0) {
                    return [];
                }
                // Find all bookings for these venues
                const bookings = yield Database_1.AppDataSource.getRepository(VenueBooking_1.VenueBooking).find({
                    where: { venueId: (0, typeorm_1.In)(venueIds) },
                });
                // For each booking, fetch the event, its organizer, and the venue
                const eventRepo = Database_1.AppDataSource.getRepository(require("../models/Event Tables/Event").Event);
                const userRepo = Database_1.AppDataSource.getRepository(require("../models/User").User);
                const orgRepo = Database_1.AppDataSource.getRepository(require("../models/Organization").Organization);
                const venueRepo = Database_1.AppDataSource.getRepository(require("../models/Venue Tables/Venue").Venue);
                const bookingsWithOrganizerAndVenue = yield Promise.all(bookings.map((booking) => __awaiter(this, void 0, void 0, function* () {
                    let organizer = null;
                    const event = yield eventRepo.findOne({
                        where: { eventId: booking.eventId },
                    });
                    if (event) {
                        if (event.eventOrganizerType === "USER") {
                            organizer = yield userRepo.findOne({
                                where: { userId: event.eventOrganizerId },
                            });
                        }
                        else if (event.eventOrganizerType === "ORGANIZATION") {
                            organizer = yield orgRepo.findOne({
                                where: { organizationId: event.eventOrganizerId },
                            });
                        }
                    }
                    let venue = booking.venue;
                    if (!venue) {
                        const foundVenue = yield venueRepo.findOne({
                            where: { venueId: booking.venueId },
                            relations: ["venueVariables"],
                        });
                        venue = (foundVenue || null);
                    }
                    else if (!venue.venueVariables) {
                        // If venue is present but venueVariables is not loaded, fetch them
                        const foundVenue = yield venueRepo.findOne({
                            where: { venueId: booking.venueId },
                            relations: ["venueVariables"],
                        });
                        if (foundVenue)
                            venue.venueVariables = foundVenue.venueVariables;
                    }
                    return Object.assign(Object.assign({}, booking), { organizer, venue });
                })));
                return bookingsWithOrganizerAndVenue;
            }));
        });
    }
    static getBookingById(bookingId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const repo = Database_1.AppDataSource.getRepository(VenueBooking_1.VenueBooking);
                const booking = yield repo.findOne({
                    where: { bookingId },
                    relations: ["user", "venue"], // include user (organizer) and venue
                });
                if (!booking) {
                    return { success: false, message: "Booking not found.", data: null };
                }
                // Fetch the event to get the organizer
                const eventRepo = Database_1.AppDataSource.getRepository(require("../models/Event Tables/Event").Event);
                const event = yield eventRepo.findOne({
                    where: { eventId: booking.eventId },
                });
                let organizer = null;
                if (event) {
                    if (event.eventOrganizerType === "USER") {
                        const userRepo = Database_1.AppDataSource.getRepository(require("../models/User").User);
                        organizer = yield userRepo.findOne({
                            where: { userId: event.eventOrganizerId },
                        });
                    }
                    else if (event.eventOrganizerType === "ORGANIZATION") {
                        const orgRepo = Database_1.AppDataSource.getRepository(require("../models/Organization").Organization);
                        organizer = yield orgRepo.findOne({
                            where: { organizationId: event.eventOrganizerId },
                        });
                    }
                }
                // Attach organizer to booking data
                const bookingWithOrganizer = Object.assign(Object.assign({}, booking), { organizer });
                return {
                    success: true,
                    message: "Booking fetched successfully.",
                    data: bookingWithOrganizer,
                };
            }
            catch (error) {
                return {
                    success: false,
                    message: "Failed to fetch booking.",
                    data: null,
                };
            }
        });
    }
    static approveBooking(bookingId) {
        return __awaiter(this, void 0, void 0, function* () {
            const queryRunner = Database_1.AppDataSource.createQueryRunner();
            yield queryRunner.connect();
            yield queryRunner.startTransaction();
            try {
                // 1. Fetch booking, venue, and booking condition
                const bookingRepo = queryRunner.manager.getRepository(require("../models/VenueBooking").VenueBooking);
                const venueRepo = queryRunner.manager.getRepository(require("../models/Venue Tables/Venue").Venue);
                const slotRepo = queryRunner.manager.getRepository(require("../models/Venue Tables/VenueAvailabilitySlot")
                    .VenueAvailabilitySlot);
                const conditionRepo = queryRunner.manager.getRepository(require("../models/Venue Tables/BookingCondition").BookingCondition);
                const paymentRepo = queryRunner.manager.getRepository(require("../models/VenueBookingPayment").VenueBookingPayment);
                const invoiceRepo = queryRunner.manager.getRepository(require("../models/Invoice").Invoice);
                const userRepo = queryRunner.manager.getRepository(require("../models/User").User);
                const booking = yield bookingRepo.findOne({ where: { bookingId } });
                if (!booking)
                    throw new Error("Booking not found");
                const venue = yield venueRepo.findOne({
                    where: { venueId: booking.venueId },
                });
                if (!venue)
                    throw new Error("Venue not found");
                const condition = yield conditionRepo.findOne({
                    where: { venue: { venueId: venue.venueId } },
                });
                // 2. Set booking status to APPROVED_NOT_PAID
                booking.bookingStatus = "APPROVED_NOT_PAID";
                yield bookingRepo.save(booking);
                // 3. Create slots
                const startDate = new Date(booking.eventStartDate);
                const endDate = new Date(booking.eventEndDate);
                const transitionTime = (condition === null || condition === void 0 ? void 0 : condition.transitionTime) || 0;
                const slotsToCreate = [];
                if (venue.bookingType === "DAILY") {
                    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
                        const slot = yield slotRepo.create({
                            venueId: venue.venueId,
                            Date: new Date(d),
                            status: VenueAvailabilitySlot_1.SlotStatus.BOOKED,
                            eventId: booking.eventId,
                            notes: `Booked for event ${booking.eventId}`,
                        });
                        slotsToCreate.push(slot);
                    }
                    // Add transition time slots after last date if specified
                    if (transitionTime > 0) {
                        let transitionDate = new Date(endDate);
                        for (let i = 1; i <= transitionTime; i++) {
                            transitionDate.setDate(transitionDate.getDate() + 1);
                            const slot = yield slotRepo.create({
                                venueId: venue.venueId,
                                Date: new Date(transitionDate),
                                status: VenueAvailabilitySlot_1.SlotStatus.BOOKED,
                                eventId: booking.eventId,
                                notes: `Booked for event ${booking.eventId}`,
                            });
                            slotsToCreate.push(slot);
                        }
                    }
                }
                else if (venue.bookingType === "HOURLY") {
                    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
                        const slot = yield slotRepo.create({
                            venueId: venue.venueId,
                            Date: new Date(d),
                            startTime: booking.startTime
                                ? new Date(`1970-01-01T${booking.startTime}`)
                                : null,
                            endTime: booking.endTime
                                ? new Date(`1970-01-01T${booking.endTime}`)
                                : null,
                            status: VenueAvailabilitySlot_1.SlotStatus.BOOKED,
                            eventId: booking.eventId,
                            notes: `Booked for event ${booking.eventId}`,
                        });
                        slotsToCreate.push(slot);
                        // Add transition time between each day's slot if specified
                        if (transitionTime > 0) {
                            // For hourly, transition time could be added as a gap after endTime
                            // This is a placeholder; adjust as needed for your business logic
                        }
                    }
                }
                for (const slot of slotsToCreate) {
                    yield slotRepo.save(slot);
                }
                // 4. Create payment record
                let payerId;
                let payerType;
                // Fetch event to determine organizer type
                const eventRepo = queryRunner.manager.getRepository(require("../models/Event Tables/Event").Event);
                const event = yield eventRepo.findOne({
                    where: { eventId: booking.eventId },
                });
                if ((event === null || event === void 0 ? void 0 : event.eventOrganizerType) === "USER") {
                    payerId = event.eventOrganizerId;
                    payerType = "USER";
                }
                else if ((event === null || event === void 0 ? void 0 : event.eventOrganizerType) === "ORGANIZATION") {
                    payerId = event.eventOrganizerId;
                    payerType = "ORGANIZATION";
                }
                else {
                    throw new Error("Could not determine payer for payment record");
                }
                const amount = booking.amountToBePaid || 0;
                yield paymentRepo.save({
                    bookingId: booking.bookingId,
                    payerId,
                    payerType,
                    amountPaid: 0,
                    paymentStatus: "PENDING",
                    paymentMethod: null,
                    paymentReference: null,
                });
                // 5. Cancel conflicting bookings
                const conflictBookings = yield bookingRepo.find({
                    where: {
                        venueId: booking.venueId,
                        eventStartDate: booking.eventStartDate,
                        bookingStatus: (0, typeorm_1.In)(["PENDING", "APPROVED_NOT_PAID"]),
                    },
                });
                for (const conflict of conflictBookings) {
                    if (conflict.bookingId !== booking.bookingId) {
                        conflict.bookingStatus = "CANCELLED";
                        conflict.venueStatus = "AVAILABLE";
                        conflict.cancellationReason =
                            "Sorry, unfortunately you lost your slot. Please book another slot.";
                        yield bookingRepo.save(conflict);
                    }
                }
                // 6. Generate invoice
                const invoiceDate = new Date();
                const dueDate = new Date(invoiceDate);
                if (condition === null || condition === void 0 ? void 0 : condition.depositRequiredTime) {
                    dueDate.setDate(dueDate.getDate() + condition.depositRequiredTime);
                }
                yield invoiceRepo.save({
                    eventId: booking.eventId,
                    payerId,
                    payerType,
                    invoiceDate,
                    dueDate,
                    totalAmount: amount,
                    status: "PENDING",
                    venueId: booking.venueId,
                    bookingId: booking.bookingId,
                });
                yield queryRunner.commitTransaction();
                return {
                    success: true,
                    message: "Booking approved and all related records created.",
                };
            }
            catch (error) {
                yield queryRunner.rollbackTransaction();
                return {
                    success: false,
                    message: error instanceof Error ? error.message : "Failed to approve booking.",
                };
            }
            finally {
                yield queryRunner.release();
            }
        });
    }
    static getPaymentsByManagerId(managerId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // 1. Find all venues managed by this manager
                const venueVariables = yield Database_1.AppDataSource.getRepository(VenueVariable_1.VenueVariable).find({
                    where: { manager: { userId: managerId } },
                    relations: ["venue"],
                });
                const venueIds = venueVariables.map((vv) => vv.venue.venueId);
                if (venueIds.length === 0) {
                    return {
                        success: true,
                        data: [],
                        message: "No venues managed by this manager.",
                    };
                }
                // 2. Find all bookings for these venues
                const bookings = yield Database_1.AppDataSource.getRepository(VenueBooking_1.VenueBooking).find({
                    where: { venueId: (0, typeorm_1.In)(venueIds) },
                });
                const bookingIds = bookings.map((b) => b.bookingId);
                if (bookingIds.length === 0) {
                    return {
                        success: true,
                        data: [],
                        message: "No bookings for venues managed by this manager.",
                    };
                }
                // 3. Find all payments for these bookings
                const VenueBookingPayment = require("../models/VenueBookingPayment").VenueBookingPayment;
                const payments = yield Database_1.AppDataSource.getRepository(VenueBookingPayment).find({
                    where: { bookingId: (0, typeorm_1.In)(bookingIds) },
                    relations: ["booking"],
                });
                // 4. Enrich each payment with payer info
                const userRepo = Database_1.AppDataSource.getRepository(require("../models/User").User);
                const orgRepo = Database_1.AppDataSource.getRepository(require("../models/Organization").Organization);
                const enrichedPayments = yield Promise.all(payments.map((payment) => __awaiter(this, void 0, void 0, function* () {
                    let payer = null;
                    if (payment.payerType === "USER") {
                        payer = yield userRepo.findOne({
                            where: { userId: payment.payerId },
                        });
                    }
                    else if (payment.payerType === "ORGANIZATION") {
                        payer = yield orgRepo.findOne({
                            where: { organizationId: payment.payerId },
                        });
                    }
                    return Object.assign(Object.assign({}, payment), { payer });
                })));
                return {
                    success: true,
                    data: enrichedPayments,
                    message: "Payments fetched successfully.",
                };
            }
            catch (error) {
                return {
                    success: false,
                    data: [],
                    message: "Failed to fetch payments by manager.",
                };
            }
        });
    }
    static createVenueBookingPaymentWithDepositValidation(paymentData) {
        return __awaiter(this, void 0, void 0, function* () {
            // 1. Save the payment
            const paymentRepo = Database_1.AppDataSource.getRepository(require("../models/VenueBookingPayment").VenueBookingPayment);
            let newPayment = paymentRepo.create(paymentData);
            yield paymentRepo.save(newPayment);
            // Always fetch the saved payment by bookingId, payerId, and latest paymentDate
            newPayment = (yield paymentRepo.findOne({
                where: {
                    bookingId: paymentData.bookingId,
                    payerId: paymentData.payerId,
                },
                order: { paymentDate: "DESC" },
            }));
            // 2. Fetch all payments for this booking
            const allPayments = yield paymentRepo.find({
                where: { bookingId: paymentData.bookingId },
            });
            const totalPaid = allPayments.reduce((sum, p) => sum + (p.amountPaid || 0), 0);
            // 3. Fetch booking and condition
            const bookingRepo = Database_1.AppDataSource.getRepository(require("../models/VenueBooking").VenueBooking);
            const booking = yield bookingRepo.findOne({
                where: { bookingId: paymentData.bookingId },
            });
            if (!booking)
                throw new Error("Booking not found");
            const conditionRepo = Database_1.AppDataSource.getRepository(require("../models/Venue Tables/BookingCondition").BookingCondition);
            const condition = yield conditionRepo.findOne({
                where: { venue: { venueId: booking.venueId } },
            });
            if (!condition)
                throw new Error("Booking condition not found");
            // 4. Calculate required deposit
            const requiredDeposit = ((booking.amountToBePaid || 0) *
                (condition.depositRequiredPercent || 0)) /
                100;
            // 5. Check if deposit is fulfilled and on time
            let depositPaidAt = null;
            let runningTotal = 0;
            for (const p of allPayments.sort((a, b) => a.paymentDate.getTime() - b.paymentDate.getTime())) {
                runningTotal += p.amountPaid || 0;
                if (runningTotal >= requiredDeposit) {
                    depositPaidAt = p.paymentDate;
                    break;
                }
            }
            const hoursSinceBooking = depositPaidAt
                ? (depositPaidAt.getTime() - booking.createdAt.getTime()) /
                    (1000 * 60 * 60)
                : null;
            const depositFulfilled = totalPaid >= requiredDeposit &&
                hoursSinceBooking !== null &&
                hoursSinceBooking <= (condition.depositRequiredTime || 0);
            // 6. If deposit fulfilled, update booking status
            if (depositFulfilled) {
                booking.bookingStatus = "APPROVED_PAID";
                yield bookingRepo.save(booking);
            }
            // 7. If total paid >= amountToBePaid, mark all payments as COMPLETED
            if (totalPaid >= (booking.amountToBePaid || 0)) {
                for (const p of allPayments) {
                    if (p.paymentStatus !== "COMPLETED") {
                        p.paymentStatus = "COMPLETED";
                        yield paymentRepo.save(p);
                    }
                }
            }
            // 8. Get payer info
            let payer = null;
            if (newPayment && newPayment.payerType === "USER") {
                payer = yield Database_1.AppDataSource.getRepository(require("../models/User").User).findOne({ where: { userId: newPayment.payerId } });
            }
            else if (newPayment && newPayment.payerType === "ORGANIZATION") {
                payer = yield Database_1.AppDataSource.getRepository(require("../models/Organization").Organization).findOne({ where: { organizationId: newPayment.payerId } });
            }
            // 9. Return enriched response
            return {
                payment: newPayment,
                booking,
                payer,
                totalPaid,
                requiredDeposit,
                depositFulfilled,
                bookingStatus: booking.bookingStatus,
                message: depositFulfilled
                    ? "Deposit paid in full and on time. Booking approved."
                    : "Payment recorded. Deposit not yet fully paid or not within allowed time.",
            };
        });
    }
    static getPendingBookingsByManager(managerId) {
        return __awaiter(this, void 0, void 0, function* () {
            const venueVariableRepo = Database_1.AppDataSource.getRepository(require("../models/Venue Tables/VenueVariable").VenueVariable);
            const managedVenues = yield venueVariableRepo.find({
                where: { manager: { userId: managerId } },
                relations: ["venue"],
            });
            const venueIds = managedVenues.map((vv) => vv.venue.venueId);
            if (!venueIds.length)
                return [];
            const bookingRepo = Database_1.AppDataSource.getRepository(require("../models/VenueBooking").VenueBooking);
            return yield bookingRepo.find({
                where: { venueId: (0, typeorm_1.In)(venueIds), bookingStatus: "PENDING" },
                relations: ["venue", "user", "event"],
                order: { createdAt: "DESC" },
            });
        });
    }
}
exports.VenueBookingRepository = VenueBookingRepository;
