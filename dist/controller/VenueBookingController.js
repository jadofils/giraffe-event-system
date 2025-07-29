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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.VenueBookingController = void 0;
const VenueBookingRepository_1 = require("../repositories/VenueBookingRepository");
const Database_1 = require("../config/Database");
const typeorm_1 = require("typeorm");
const VenueBooking_1 = require("../models/VenueBooking");
const Event_1 = require("../models/Event Tables/Event");
const VenueVariable_1 = require("../models/Venue Tables/VenueVariable");
const User_1 = require("../models/User");
const VenueBookingPaymentService_1 = require("../services/payments/VenueBookingPaymentService");
const Venue_1 = require("../models/Venue Tables/Venue");
const VenueBookingPayment_1 = require("../models/VenueBookingPayment");
const SimpleNotificationService_1 = require("../services/notifications/SimpleNotificationService");
const EmailService_1 = __importDefault(require("../services/emails/EmailService"));
const VenueBooking_2 = require("../models/VenueBooking");
const EventStatusEnum_1 = require("../interfaces/Enums/EventStatusEnum");
class VenueBookingController {
    static getAllBookings(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const result = yield VenueBookingRepository_1.VenueBookingRepository.getAllBookings();
                res.status(200).json({
                    success: result.success,
                    message: result.message,
                    data: result.data,
                });
            }
            catch (error) {
                res.status(500).json({
                    success: false,
                    message: `Failed to fetch bookings: ${error instanceof Error ? error.message : "Unknown error"}`,
                });
            }
        });
    }
    static getBookingsByManagerId(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { managerId } = req.params;
                // First, get all venues managed by this manager
                const venueVariableRepo = Database_1.AppDataSource.getRepository(VenueVariable_1.VenueVariable);
                const managedVenues = yield venueVariableRepo.find({
                    where: { manager: { userId: managerId } },
                    relations: ["venue", "venue.bookingConditions"],
                });
                if (!managedVenues.length) {
                    res.status(200).json({
                        success: true,
                        data: {
                            bookings: [],
                            summary: {
                                totalVenues: 0,
                                totalBookings: 0,
                                totalAmount: 0,
                                pendingBookings: 0,
                                approvedBookings: 0,
                                cancelledBookings: 0,
                            },
                        },
                        message: "No venues found for this manager",
                    });
                    return;
                }
                const venueIds = managedVenues.map((vv) => vv.venue.venueId);
                // Get all bookings for these venues with necessary relations
                const bookingRepo = Database_1.AppDataSource.getRepository(VenueBooking_1.VenueBooking);
                const bookings = yield bookingRepo.find({
                    where: { venueId: (0, typeorm_1.In)(venueIds) },
                    relations: [
                        "venue",
                        "venue.bookingConditions",
                        "venue.venueVariables",
                        "event",
                        "user",
                    ],
                    order: {
                        createdAt: "DESC", // Most recent first
                    },
                });
                // Get payment details for each booking
                const paymentRepo = Database_1.AppDataSource.getRepository(VenueBookingPayment_1.VenueBookingPayment);
                const enrichedBookings = yield Promise.all(bookings.map((booking) => __awaiter(this, void 0, void 0, function* () {
                    var _a;
                    const venue = booking.venue;
                    const event = booking.event;
                    const bookingCondition = venue.bookingConditions[0];
                    // Calculate total hours and amount for hourly venues
                    const totalHours = booking.bookingDates.reduce((sum, date) => {
                        var _a;
                        return sum + (((_a = date.hours) === null || _a === void 0 ? void 0 : _a.length) || 1);
                    }, 0);
                    const baseVenueAmount = ((_a = venue.venueVariables[0]) === null || _a === void 0 ? void 0 : _a.venueAmount) || 0;
                    const totalVenueAmount = venue.bookingType === "HOURLY"
                        ? baseVenueAmount * totalHours
                        : baseVenueAmount;
                    const depositAmount = (bookingCondition === null || bookingCondition === void 0 ? void 0 : bookingCondition.depositRequiredPercent)
                        ? (totalVenueAmount * bookingCondition.depositRequiredPercent) / 100
                        : totalVenueAmount;
                    // Get all payments for this booking
                    const payments = yield paymentRepo.find({
                        where: { bookingId: booking.bookingId },
                        order: { paymentDate: "ASC" },
                    });
                    const totalPaid = payments.reduce((sum, p) => sum + Number(p.amountPaid), 0);
                    // Get earliest booking date
                    const earliestDate = new Date(Math.min(...booking.bookingDates.map((d) => new Date(d.date).getTime())));
                    const paymentDeadline = (bookingCondition === null || bookingCondition === void 0 ? void 0 : bookingCondition.paymentComplementTimeBeforeEvent)
                        ? new Date(earliestDate.getTime() -
                            bookingCondition.paymentComplementTimeBeforeEvent *
                                24 *
                                60 *
                                60 *
                                1000)
                        : earliestDate;
                    // Format payment history with running balance
                    let runningBalance = totalVenueAmount;
                    const paymentHistory = payments.map((payment) => {
                        runningBalance -= Number(payment.amountPaid);
                        return {
                            paymentId: payment.paymentId,
                            amountPaid: payment.amountPaid,
                            paymentDate: payment.paymentDate,
                            paymentMethod: payment.paymentMethod,
                            paymentStatus: payment.paymentStatus,
                            paymentReference: payment.paymentReference,
                            balanceAfterPayment: runningBalance,
                            notes: payment.notes,
                        };
                    });
                    return {
                        bookingId: booking.bookingId,
                        eventDetails: {
                            eventId: event === null || event === void 0 ? void 0 : event.eventId,
                            eventName: event === null || event === void 0 ? void 0 : event.eventName,
                            eventType: event === null || event === void 0 ? void 0 : event.eventType,
                            eventDescription: event === null || event === void 0 ? void 0 : event.eventDescription,
                        },
                        venue: {
                            venueId: venue.venueId,
                            venueName: venue.venueName,
                            location: venue.venueLocation,
                            bookingType: venue.bookingType,
                            baseAmount: baseVenueAmount,
                            totalHours: venue.bookingType === "HOURLY" ? totalHours : null,
                            totalAmount: totalVenueAmount,
                            depositRequired: {
                                percentage: (bookingCondition === null || bookingCondition === void 0 ? void 0 : bookingCondition.depositRequiredPercent) || 100,
                                amount: depositAmount,
                                description: venue.bookingType === "HOURLY"
                                    ? `Initial deposit required (${bookingCondition === null || bookingCondition === void 0 ? void 0 : bookingCondition.depositRequiredPercent}% of total amount ${totalVenueAmount} for ${totalHours} hours)`
                                    : `Initial deposit required (${bookingCondition === null || bookingCondition === void 0 ? void 0 : bookingCondition.depositRequiredPercent}% of total amount ${totalVenueAmount})`,
                            },
                            paymentCompletionRequired: {
                                daysBeforeEvent: (bookingCondition === null || bookingCondition === void 0 ? void 0 : bookingCondition.paymentComplementTimeBeforeEvent) || 0,
                                amount: totalVenueAmount - depositAmount,
                                deadline: paymentDeadline,
                            },
                        },
                        bookingDates: booking.bookingDates,
                        bookingStatus: booking.bookingStatus,
                        isPaid: booking.isPaid,
                        createdAt: booking.createdAt,
                        requester: booking.user
                            ? {
                                userId: booking.user.userId,
                                firstName: booking.user.firstName,
                                lastName: booking.user.lastName,
                                email: booking.user.email,
                                phoneNumber: booking.user.phoneNumber,
                            }
                            : null,
                        paymentSummary: {
                            totalAmount: totalVenueAmount,
                            depositAmount: depositAmount,
                            totalPaid: totalPaid,
                            remainingAmount: totalVenueAmount - totalPaid,
                            paymentStatus: booking.isPaid
                                ? "PAID"
                                : totalPaid >= depositAmount
                                    ? "DEPOSIT_PAID"
                                    : "PENDING",
                            paymentProgress: ((totalPaid / totalVenueAmount) * 100).toFixed(2) + "%",
                            depositStatus: totalPaid >= depositAmount ? "FULFILLED" : "PENDING",
                            paymentHistory: paymentHistory,
                            nextPaymentDue: totalPaid < totalVenueAmount ? totalVenueAmount - totalPaid : 0,
                            paymentDeadline: paymentDeadline,
                        },
                    };
                })));
                // Calculate summary statistics
                const summary = {
                    totalVenues: venueIds.length,
                    totalBookings: bookings.length,
                    totalAmount: enrichedBookings.reduce((sum, b) => sum + b.paymentSummary.totalAmount, 0),
                    totalPaid: enrichedBookings.reduce((sum, b) => sum + b.paymentSummary.totalPaid, 0),
                    totalRemaining: enrichedBookings.reduce((sum, b) => sum + b.paymentSummary.remainingAmount, 0),
                    pendingBookings: enrichedBookings.filter((b) => b.bookingStatus === "PENDING").length,
                    approvedBookings: enrichedBookings.filter((b) => ["APPROVED_PAID", "APPROVED_NOT_PAID", "PARTIAL"].includes(b.bookingStatus)).length,
                    partialBookings: enrichedBookings.filter((b) => b.bookingStatus === "PARTIAL").length,
                    cancelledBookings: enrichedBookings.filter((b) => b.bookingStatus === "CANCELLED").length,
                    bookingsByVenue: venueIds.map((venueId) => {
                        var _a;
                        return ({
                            venueId,
                            venueName: (_a = managedVenues.find((v) => v.venue.venueId === venueId)) === null || _a === void 0 ? void 0 : _a.venue.venueName,
                            totalBookings: enrichedBookings.filter((b) => b.venue.venueId === venueId).length,
                            totalAmount: enrichedBookings
                                .filter((b) => b.venue.venueId === venueId)
                                .reduce((sum, b) => sum + b.paymentSummary.totalAmount, 0),
                            totalPaid: enrichedBookings
                                .filter((b) => b.venue.venueId === venueId)
                                .reduce((sum, b) => sum + b.paymentSummary.totalPaid, 0),
                        });
                    }),
                    paymentSummary: {
                        totalExpectedAmount: enrichedBookings.reduce((sum, b) => sum + b.paymentSummary.totalAmount, 0),
                        totalPaidAmount: enrichedBookings.reduce((sum, b) => sum + b.paymentSummary.totalPaid, 0),
                        totalPendingAmount: enrichedBookings.reduce((sum, b) => sum + b.paymentSummary.remainingAmount, 0),
                        collectionProgress: ((enrichedBookings.reduce((sum, b) => sum + b.paymentSummary.totalPaid, 0) /
                            enrichedBookings.reduce((sum, b) => sum + b.paymentSummary.totalAmount, 0)) *
                            100).toFixed(2) + "%",
                    },
                };
                res.status(200).json({
                    success: true,
                    data: {
                        bookings: enrichedBookings,
                        summary,
                    },
                    message: "Venue bookings fetched successfully",
                });
            }
            catch (error) {
                res.status(500).json({
                    success: false,
                    message: error instanceof Error ? error.message : "Failed to fetch bookings",
                });
            }
        });
    }
    static getBookingById(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { bookingId } = req.params;
                const result = yield VenueBookingRepository_1.VenueBookingRepository.getBookingById(bookingId);
                if (!result.success) {
                    res.status(404).json({ success: false, message: result.message });
                    return;
                }
                res.status(200).json({ success: true, data: result.data });
            }
            catch (error) {
                res.status(500).json({ success: false, message: "Server error." });
            }
        });
    }
    static approveBooking(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                const { bookingId } = req.params;
                const authenticatedReq = req;
                const userId = (_a = authenticatedReq.user) === null || _a === void 0 ? void 0 : _a.userId;
                // Fetch booking with venue
                const bookingRepo = Database_1.AppDataSource.getRepository(VenueBooking_1.VenueBooking);
                const booking = yield bookingRepo.findOne({
                    where: { bookingId },
                    relations: ["venue"],
                });
                if (!booking) {
                    res.status(404).json({ success: false, message: "Booking not found." });
                    return;
                }
                // Check if user is the manager of the venue
                const venueVariableRepo = Database_1.AppDataSource.getRepository(VenueVariable_1.VenueVariable);
                const venueVariable = yield venueVariableRepo.findOne({
                    where: { venue: { venueId: booking.venue.venueId } },
                    relations: ["manager"],
                });
                if (!venueVariable || venueVariable.manager.userId !== userId) {
                    res.status(403).json({
                        success: false,
                        message: "You are not the manager of this venue.",
                    });
                    return;
                }
                // Approve booking and create slots with transition time logic
                const result = yield VenueBookingRepository_1.VenueBookingRepository.approveBookingWithTransition(bookingId);
                if (!result.success) {
                    res.status(400).json({ success: false, message: result.message });
                    return;
                }
                res.status(200).json({ success: true, message: result.message });
            }
            catch (error) {
                res.status(500).json({ success: false, message: "Server error." });
            }
        });
    }
    static getPaymentsByManagerId(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { managerId } = req.params;
                const result = yield VenueBookingRepository_1.VenueBookingRepository.getPaymentsByManagerId(managerId);
                res.status(200).json(result);
            }
            catch (error) {
                res.status(500).json({ success: false, message: "Server error." });
            }
        });
    }
    static addPaymentToBooking(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { bookingId } = req.params;
                // Check if booking is canceled
                const bookingRepo = Database_1.AppDataSource.getRepository(VenueBooking_1.VenueBooking);
                const booking = yield bookingRepo.findOne({ where: { bookingId } });
                if (!booking) {
                    res.status(404).json({ success: false, message: "Booking not found." });
                    return;
                }
                if (booking.bookingStatus === "CANCELLED") {
                    res.status(400).json({
                        success: false,
                        message: "Cannot create payment for a canceled booking.",
                    });
                    return;
                }
                const paymentData = Object.assign(Object.assign({}, req.body), { bookingId });
                const result = yield VenueBookingRepository_1.VenueBookingRepository.createVenueBookingPaymentWithDepositValidation(paymentData);
                res.status(201).json(result);
            }
            catch (error) {
                res.status(400).json({
                    success: false,
                    message: error instanceof Error ? error.message : "Failed to add payment.",
                });
            }
        });
    }
    static getPaymentsForBooking(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { bookingId } = req.params;
                const paymentRepo = Database_1.AppDataSource.getRepository(require("../models/VenueBookingPayment").VenueBookingPayment);
                const bookingRepo = Database_1.AppDataSource.getRepository(require("../models/VenueBooking").VenueBooking);
                const conditionRepo = Database_1.AppDataSource.getRepository(require("../models/Venue Tables/BookingCondition").BookingCondition);
                const userRepo = Database_1.AppDataSource.getRepository(require("../models/User").User);
                const orgRepo = Database_1.AppDataSource.getRepository(require("../models/Organization").Organization);
                const payments = yield paymentRepo.find({ where: { bookingId } });
                const booking = yield bookingRepo.findOne({ where: { bookingId } });
                if (!booking) {
                    res.status(404).json({ success: false, message: "Booking not found" });
                    return;
                }
                const condition = yield conditionRepo.findOne({
                    where: { venue: { venueId: booking.venueId } },
                });
                const totalPaid = payments.reduce((sum, p) => sum + (p.amountPaid || 0), 0);
                const requiredDeposit = ((booking.amountToBePaid || 0) *
                    ((condition === null || condition === void 0 ? void 0 : condition.depositRequiredPercent) || 0)) /
                    100;
                let depositPaidAt = null;
                let runningTotal = 0;
                for (const p of payments.sort((a, b) => a.paymentDate.getTime() - b.paymentDate.getTime())) {
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
                    hoursSinceBooking <= ((condition === null || condition === void 0 ? void 0 : condition.depositRequiredTime) || 0);
                // Enrich payments with payer info
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
                res.status(200).json({
                    success: true,
                    payments: enrichedPayments,
                    totalPaid,
                    requiredDeposit,
                    depositFulfilled,
                    booking,
                });
            }
            catch (error) {
                res.status(500).json({
                    success: false,
                    message: "Failed to fetch payments for booking.",
                });
            }
        });
    }
    static getPaymentsForUserBookings(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { userId } = req.params;
                const paymentRepo = Database_1.AppDataSource.getRepository(require("../models/VenueBookingPayment").VenueBookingPayment);
                const bookingRepo = Database_1.AppDataSource.getRepository(require("../models/VenueBooking").VenueBooking);
                const venueRepo = Database_1.AppDataSource.getRepository(require("../models/Venue Tables/Venue").Venue);
                // Find all bookings by this user
                const bookings = yield bookingRepo.find({ where: { createdBy: userId } });
                const bookingIds = bookings.map((b) => b.bookingId);
                if (bookingIds.length === 0) {
                    res.status(200).json({ success: true, payments: [] });
                    return;
                }
                // Find all payments for these bookings
                const payments = yield paymentRepo.find({
                    where: { bookingId: (0, typeorm_1.In)(bookingIds) },
                });
                // Enrich with booking and venue info
                const enrichedPayments = yield Promise.all(payments.map((payment) => __awaiter(this, void 0, void 0, function* () {
                    const booking = bookings.find((b) => b.bookingId === payment.bookingId);
                    let venue = null;
                    if (booking) {
                        venue = yield venueRepo.findOne({
                            where: { venueId: booking.venueId },
                        });
                    }
                    return Object.assign(Object.assign({}, payment), { booking, venue });
                })));
                res.status(200).json({ success: true, payments: enrichedPayments });
            }
            catch (error) {
                res
                    .status(500)
                    .json({ success: false, message: "Failed to fetch user payments." });
            }
        });
    }
    static getUserBookings(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { userId } = req.params;
                const bookingRepo = Database_1.AppDataSource.getRepository(VenueBooking_1.VenueBooking);
                const paymentRepo = Database_1.AppDataSource.getRepository(VenueBookingPayment_1.VenueBookingPayment);
                const bookings = yield bookingRepo.find({
                    where: { createdBy: userId },
                    relations: [
                        "venue",
                        "venue.bookingConditions",
                        "venue.venueVariables",
                        "event",
                    ],
                    order: {
                        createdAt: "DESC", // Most recent bookings first
                    },
                });
                // Enrich booking data with event details and payment info
                const enrichedBookings = yield Promise.all(bookings.map((booking) => __awaiter(this, void 0, void 0, function* () {
                    var _a;
                    const venue = booking.venue;
                    const event = booking.event;
                    const bookingCondition = venue.bookingConditions[0];
                    const venueAmount = ((_a = venue.venueVariables[0]) === null || _a === void 0 ? void 0 : _a.venueAmount) || 0;
                    // Calculate deposit amount
                    const depositAmount = (bookingCondition === null || bookingCondition === void 0 ? void 0 : bookingCondition.depositRequiredPercent)
                        ? (venueAmount * bookingCondition.depositRequiredPercent) / 100
                        : venueAmount;
                    // Get earliest booking date
                    const earliestDate = new Date(Math.min(...booking.bookingDates.map((d) => new Date(d.date).getTime())));
                    const paymentDeadline = (bookingCondition === null || bookingCondition === void 0 ? void 0 : bookingCondition.paymentComplementTimeBeforeEvent)
                        ? new Date(earliestDate.getTime() -
                            bookingCondition.paymentComplementTimeBeforeEvent *
                                24 *
                                60 *
                                60 *
                                1000)
                        : earliestDate;
                    // Fetch all payments for this booking
                    const payments = yield paymentRepo.find({
                        where: { bookingId: booking.bookingId },
                        order: { paymentDate: "ASC" },
                    });
                    const totalPaid = payments.reduce((sum, p) => sum + Number(p.amountPaid || 0), 0);
                    const remainingAmount = venueAmount - totalPaid;
                    // Determine refund status if cancelled
                    let refundStatus = null;
                    if (booking.bookingStatus === "CANCELLED") {
                        // If any payment is in refund process, show that
                        if (payments.some((p) => p.paymentStatus === "REFUND_IN_PROGRESS")) {
                            refundStatus = "REFUND_IN_PROGRESS";
                        }
                        else if (payments.every((p) => p.paymentStatus === "REFUNDED")) {
                            refundStatus = "REFUNDED";
                        }
                        else if (payments.length > 0) {
                            refundStatus = "PENDING_REFUND";
                        }
                    }
                    return {
                        bookingId: booking.bookingId,
                        eventId: event === null || event === void 0 ? void 0 : event.eventId,
                        eventName: event === null || event === void 0 ? void 0 : event.eventName,
                        eventType: event === null || event === void 0 ? void 0 : event.eventType,
                        eventStatus: event === null || event === void 0 ? void 0 : event.eventStatus,
                        venue: {
                            venueId: venue.venueId,
                            venueName: venue.venueName,
                            location: venue.venueLocation,
                            totalAmount: venueAmount,
                            depositRequired: {
                                percentage: (bookingCondition === null || bookingCondition === void 0 ? void 0 : bookingCondition.depositRequiredPercent) || 100,
                                amount: depositAmount,
                                description: "Initial deposit required to secure the booking",
                            },
                            paymentCompletionRequired: {
                                daysBeforeEvent: (bookingCondition === null || bookingCondition === void 0 ? void 0 : bookingCondition.paymentComplementTimeBeforeEvent) || 0,
                                amount: venueAmount - depositAmount,
                                deadline: paymentDeadline,
                                description: `Remaining payment must be completed ${(bookingCondition === null || bookingCondition === void 0 ? void 0 : bookingCondition.paymentComplementTimeBeforeEvent) || 0} days before the event`,
                            },
                        },
                        bookingDates: booking.bookingDates,
                        bookingStatus: booking.bookingStatus,
                        isPaid: booking.isPaid,
                        createdAt: booking.createdAt,
                        payments: payments.map((p) => ({
                            paymentId: p.paymentId,
                            amountPaid: Number(p.amountPaid),
                            paymentDate: p.paymentDate,
                            paymentMethod: p.paymentMethod,
                            paymentStatus: p.paymentStatus,
                            paymentReference: p.paymentReference,
                            notes: p.notes,
                        })),
                        totalPaid,
                        remainingAmount,
                        refundStatus,
                        paymentSummary: {
                            totalAmount: venueAmount,
                            depositAmount: depositAmount,
                            totalPaid,
                            remainingAmount,
                            refundStatus,
                        },
                    };
                })));
                // Calculate totals across all bookings
                const totals = enrichedBookings.reduce((acc, booking) => {
                    acc.totalBookings += 1;
                    acc.totalAmount += booking.paymentSummary.totalAmount;
                    acc.totalDepositRequired += booking.paymentSummary.depositAmount;
                    acc.totalRemainingAmount += booking.paymentSummary.remainingAmount;
                    acc.pendingBookings += booking.bookingStatus === "PENDING" ? 1 : 0;
                    acc.paidBookings += booking.isPaid ? 1 : 0;
                    return acc;
                }, {
                    totalBookings: 0,
                    totalAmount: 0,
                    totalDepositRequired: 0,
                    totalRemainingAmount: 0,
                    pendingBookings: 0,
                    paidBookings: 0,
                });
                res.status(200).json({
                    success: true,
                    data: {
                        bookings: enrichedBookings,
                        summary: Object.assign(Object.assign({}, totals), { unpaidBookings: totals.totalBookings - totals.paidBookings }),
                    },
                    message: "User bookings fetched successfully",
                });
            }
            catch (error) {
                res.status(500).json({
                    success: false,
                    message: error instanceof Error
                        ? error.message
                        : "Failed to fetch user bookings",
                });
            }
        });
    }
    static processPayment(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { bookingId } = req.params;
                // Check if booking is canceled
                const bookingRepo = Database_1.AppDataSource.getRepository(VenueBooking_1.VenueBooking);
                const booking = yield bookingRepo.findOne({
                    where: { bookingId },
                    relations: ["event"],
                });
                if (!booking) {
                    res.status(404).json({ success: false, message: "Booking not found." });
                    return;
                }
                if (booking.bookingStatus === "CANCELLED") {
                    res.status(400).json({
                        success: false,
                        message: "Cannot create payment for a canceled booking.",
                    });
                    return;
                }
                // Extract payerId and payerType from the event
                const event = booking.event;
                if (!event) {
                    res.status(400).json({
                        success: false,
                        message: "Booking does not have an associated event.",
                    });
                    return;
                }
                const paymentData = Object.assign(Object.assign({}, req.body), { bookingId, payerId: event.eventOrganizerId, payerType: event.eventOrganizerType });
                const result = yield VenueBookingPaymentService_1.VenueBookingPaymentService.processPayment(paymentData);
                res.status(200).json({
                    success: true,
                    data: result.data,
                    message: result.message,
                });
            }
            catch (error) {
                const errorResponse = {
                    success: false,
                    message: error instanceof Error ? error.message : "Failed to process payment",
                };
                res.status(400).json(errorResponse);
            }
        });
    }
    static getPaymentHistory(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { bookingId } = req.params;
                const result = yield VenueBookingPaymentService_1.VenueBookingPaymentService.getPaymentHistory(bookingId);
                res.status(200).json({
                    success: true,
                    data: result,
                    message: "Payment history fetched successfully",
                });
            }
            catch (error) {
                res.status(400).json({
                    success: false,
                    message: error instanceof Error
                        ? error.message
                        : "Failed to fetch payment history",
                });
            }
        });
    }
    static calculateBookingAmount(venue, bookingDates) {
        var _a;
        const variable = (_a = venue.venueVariables) === null || _a === void 0 ? void 0 : _a[0];
        if (variable === null || variable === void 0 ? void 0 : variable.isFree)
            return 0;
        const baseAmount = (variable === null || variable === void 0 ? void 0 : variable.venueAmount) || 0;
        if (venue.bookingType === "HOURLY") {
            // Calculate total hours across all booking dates
            const totalHours = bookingDates.reduce((sum, date) => {
                var _a;
                return sum + (((_a = date.hours) === null || _a === void 0 ? void 0 : _a.length) || 1); // If no hours specified, count as 1
            }, 0);
            return baseAmount * totalHours;
        }
        return baseAmount;
    }
    static createBooking(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const booking = req.body;
                const venue = yield Database_1.AppDataSource.getRepository(Venue_1.Venue).findOne({
                    where: { venueId: booking.venueId },
                    relations: ["venueVariables"],
                });
                if (!venue) {
                    res.status(404).json({ success: false, message: "Venue not found" });
                    return;
                }
                // Calculate total amount based on venue type and hours
                const totalAmount = this.calculateBookingAmount(venue, booking.bookingDates);
                const newBooking = yield Database_1.AppDataSource.getRepository(VenueBooking_1.VenueBooking).create(Object.assign(Object.assign({}, booking), { amountToBePaid: totalAmount }));
                yield Database_1.AppDataSource.getRepository(VenueBooking_1.VenueBooking).save(newBooking);
                res.status(201).json({
                    success: true,
                    data: newBooking,
                    message: "Booking created successfully",
                });
            }
            catch (error) {
                res.status(500).json({
                    success: false,
                    message: error instanceof Error ? error.message : "Failed to create booking",
                });
            }
        });
    }
    static updateBooking(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { bookingId } = req.params;
                const updates = req.body;
                const booking = yield Database_1.AppDataSource.getRepository(VenueBooking_1.VenueBooking).findOne({
                    where: { bookingId },
                    relations: ["venue", "venue.venueVariables"],
                });
                if (!booking) {
                    res.status(404).json({ success: false, message: "Booking not found" });
                    return;
                }
                // Recalculate amount if booking dates are being updated
                if (updates.bookingDates) {
                    updates.amountToBePaid = this.calculateBookingAmount(booking.venue, updates.bookingDates);
                }
                yield Database_1.AppDataSource.getRepository(VenueBooking_1.VenueBooking).update(bookingId, updates);
                res.status(200).json({
                    success: true,
                    message: "Booking updated successfully",
                });
            }
            catch (error) {
                res.status(500).json({
                    success: false,
                    message: error instanceof Error ? error.message : "Failed to update booking",
                });
            }
        });
    }
    static cancelByManager(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c;
            try {
                const { bookingId } = req.params;
                const { reason } = req.body;
                const authenticatedReq = req;
                const userId = (_a = authenticatedReq.user) === null || _a === void 0 ? void 0 : _a.userId;
                if (!reason) {
                    res.status(400).json({
                        success: false,
                        message: "Cancellation reason is required.",
                    });
                    return;
                }
                // Fetch booking with venue, event, and user
                const bookingRepo = Database_1.AppDataSource.getRepository(VenueBooking_1.VenueBooking);
                const booking = yield bookingRepo.findOne({
                    where: { bookingId },
                    relations: ["venue", "event", "user"],
                });
                if (!booking) {
                    res.status(404).json({ success: false, message: "Booking not found." });
                    return;
                }
                // Check if user is the manager of the venue
                const venueVariableRepo = Database_1.AppDataSource.getRepository(VenueVariable_1.VenueVariable);
                const venueVariable = yield venueVariableRepo.findOne({
                    where: { venue: { venueId: booking.venue.venueId } },
                    relations: ["manager"],
                });
                if (!venueVariable || venueVariable.manager.userId !== userId) {
                    res.status(403).json({
                        success: false,
                        message: "You are not the manager of this venue.",
                    });
                    return;
                }
                // Only allow if status is APPROVED_PAID or APPROVED_NOT_PAID
                if (!["APPROVED_PAID", "APPROVED_NOT_PAID"].includes(booking.bookingStatus)) {
                    res.status(400).json({
                        success: false,
                        message: "Only approved bookings can be cancelled by manager.",
                    });
                    return;
                }
                // Cancel booking
                booking.bookingStatus = VenueBooking_2.BookingStatus.CANCELLED;
                booking.cancellationReason = reason;
                yield bookingRepo.save(booking);
                // Set all payments for this booking to REFUND_IN_PROGRESS
                const paymentRepo = Database_1.AppDataSource.getRepository(VenueBookingPayment_1.VenueBookingPayment);
                const payments = yield paymentRepo.find({ where: { bookingId } });
                for (const payment of payments) {
                    payment.paymentStatus = VenueBookingPayment_1.VenueBookingPaymentStatus.REFUND_IN_PROGRESS;
                    yield paymentRepo.save(payment);
                }
                // Cancel event
                if (booking.event) {
                    booking.event.eventStatus = EventStatusEnum_1.EventStatus.CANCELLED;
                    booking.event.cancellationReason = `Event cancelled because the venue is no longer available: ${reason}`;
                    yield Database_1.AppDataSource.getRepository(Event_1.Event).save(booking.event);
                }
                // Debug: log booking.user
                console.log("booking.user before notification:", booking.user);
                if (!booking.user) {
                    // Try to load the user manually using createdBy
                    if (booking.createdBy) {
                        const foundUser = yield Database_1.AppDataSource.getRepository(User_1.User).findOne({
                            where: { userId: booking.createdBy },
                        });
                        if (foundUser) {
                            booking.user = foundUser;
                            console.log("booking.user after manual load:", booking.user);
                        }
                        else {
                            console.log("User not found for createdBy:", booking.createdBy);
                        }
                    }
                    else {
                        console.log("No user relation and no createdBy on booking.");
                    }
                }
                // System notification
                try {
                    if (booking.user && booking.user.userId) {
                        yield SimpleNotificationService_1.SimpleNotificationService.notifyUser(booking.user, `Your booking for venue '${booking.venue.venueName}' has been cancelled by the manager. Reason: ${reason}`);
                    }
                }
                catch (e) {
                    // Log but do not block
                    console.error("Failed to send system notification:", e);
                }
                // Email notification
                try {
                    if (booking.user && booking.user.email) {
                        yield EmailService_1.default.sendBookingCancellationEmail({
                            to: booking.user.email,
                            userName: booking.user.firstName || booking.user.username || "User",
                            venueName: booking.venue.venueName,
                            eventName: ((_b = booking.event) === null || _b === void 0 ? void 0 : _b.eventName) || "Event",
                            reason,
                            refundInfo: booking.isPaid
                                ? "Your payment will be refunded as soon as possible."
                                : undefined,
                            managerPhone: (_c = venueVariable === null || venueVariable === void 0 ? void 0 : venueVariable.manager) === null || _c === void 0 ? void 0 : _c.phoneNumber,
                        });
                    }
                }
                catch (e) {
                    // Log but do not block
                    console.error("Failed to send email notification:", e);
                }
                res.status(200).json({
                    success: true,
                    message: "Booking and related event cancelled.",
                    booking,
                    event: booking.event,
                    payments, // Return updated payments for user visibility
                });
            }
            catch (error) {
                res.status(500).json({
                    success: false,
                    message: error instanceof Error ? error.message : "Failed to cancel booking.",
                });
            }
        });
    }
    static cancelAndDeleteSlotsByManager(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d, _e;
            try {
                const { bookingId } = req.params;
                const { reason } = req.body;
                const authenticatedReq = req;
                const userId = (_a = authenticatedReq.user) === null || _a === void 0 ? void 0 : _a.userId;
                if (!reason) {
                    res.status(400).json({
                        success: false,
                        message: "Cancellation reason is required.",
                    });
                    return;
                }
                // Fetch booking with venue, event, and user
                const bookingRepo = Database_1.AppDataSource.getRepository(VenueBooking_1.VenueBooking);
                const booking = yield bookingRepo.findOne({
                    where: { bookingId },
                    relations: ["venue", "event", "user"],
                });
                if (!booking) {
                    res.status(404).json({ success: false, message: "Booking not found." });
                    return;
                }
                // Check if user is the manager of the venue
                const venueVariableRepo = Database_1.AppDataSource.getRepository(VenueVariable_1.VenueVariable);
                const venueVariable = yield venueVariableRepo.findOne({
                    where: { venue: { venueId: booking.venue.venueId } },
                    relations: ["manager"],
                });
                if (!venueVariable || venueVariable.manager.userId !== userId) {
                    res.status(403).json({
                        success: false,
                        message: "You are not the manager of this venue.",
                    });
                    return;
                }
                // Only allow if status is APPROVED_PAID or APPROVED_NOT_PAID
                if (!["APPROVED_PAID", "APPROVED_NOT_PAID"].includes(booking.bookingStatus)) {
                    res.status(400).json({
                        success: false,
                        message: "Only approved bookings can be cancelled by manager.",
                    });
                    return;
                }
                // Cancel booking
                booking.bookingStatus = VenueBooking_2.BookingStatus.CANCELLED;
                booking.cancellationReason = reason;
                yield bookingRepo.save(booking);
                // Cancel event
                if (booking.event) {
                    booking.event.eventStatus = EventStatusEnum_1.EventStatus.CANCELLED;
                    booking.event.cancellationReason = `Event cancelled because the venue is no longer available: ${reason}`;
                    yield Database_1.AppDataSource.getRepository(Event_1.Event).save(booking.event);
                }
                // Delete all VenueAvailabilitySlot entries for this booking (booked and transition)
                const slotRepo = Database_1.AppDataSource.getRepository(require("../models/Venue Tables/VenueAvailabilitySlot")
                    .VenueAvailabilitySlot);
                // Find all slots for this venue and event
                const slots = yield slotRepo.find({
                    where: {
                        venueId: booking.venue.venueId,
                        eventId: (_b = booking.event) === null || _b === void 0 ? void 0 : _b.eventId,
                    },
                });
                for (const slot of slots) {
                    yield slotRepo.remove(slot);
                }
                // Also remove transition slots (slotType: TRANSITION, eventId: null, but notes reference this event)
                const transitionSlots = yield slotRepo.find({
                    where: { venueId: booking.venue.venueId, slotType: "TRANSITION" },
                });
                for (const slot of transitionSlots) {
                    if (slot.notes && slot.notes.includes((_c = booking.event) === null || _c === void 0 ? void 0 : _c.eventId)) {
                        yield slotRepo.remove(slot);
                    }
                }
                // Email notification
                try {
                    if (booking.user && booking.user.email) {
                        yield EmailService_1.default.sendBookingCancellationEmail({
                            to: booking.user.email,
                            userName: booking.user.firstName || booking.user.username || "User",
                            venueName: booking.venue.venueName,
                            eventName: ((_d = booking.event) === null || _d === void 0 ? void 0 : _d.eventName) || "Event",
                            reason,
                            refundInfo: booking.isPaid
                                ? "Your payment will be refunded as soon as possible."
                                : undefined,
                            managerPhone: (_e = venueVariable === null || venueVariable === void 0 ? void 0 : venueVariable.manager) === null || _e === void 0 ? void 0 : _e.phoneNumber,
                        });
                    }
                }
                catch (e) {
                    // Log but do not block
                    console.error("Failed to send email notification:", e);
                }
                res.status(200).json({
                    success: true,
                    message: "Booking, event, and slots cancelled/deleted.",
                    booking,
                    event: booking.event,
                });
            }
            catch (error) {
                res.status(500).json({
                    success: false,
                    message: error instanceof Error ? error.message : "Failed to cancel booking.",
                });
            }
        });
    }
    static cancelByManagerWithoutSlotDeletion(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c;
            try {
                const { bookingId } = req.params;
                const { reason } = req.body;
                const authenticatedReq = req;
                const userId = (_a = authenticatedReq.user) === null || _a === void 0 ? void 0 : _a.userId;
                if (!reason) {
                    res.status(400).json({
                        success: false,
                        message: "Cancellation reason is required.",
                    });
                    return;
                }
                // Fetch booking with venue, event, and user
                const bookingRepo = Database_1.AppDataSource.getRepository(VenueBooking_1.VenueBooking);
                const booking = yield bookingRepo.findOne({
                    where: { bookingId },
                    relations: ["venue", "event", "user"],
                });
                if (!booking) {
                    res.status(404).json({ success: false, message: "Booking not found." });
                    return;
                }
                // Check if user is the manager of the venue
                const venueVariableRepo = Database_1.AppDataSource.getRepository(VenueVariable_1.VenueVariable);
                const venueVariable = yield venueVariableRepo.findOne({
                    where: { venue: { venueId: booking.venue.venueId } },
                    relations: ["manager"],
                });
                if (!venueVariable || venueVariable.manager.userId !== userId) {
                    res.status(403).json({
                        success: false,
                        message: "You are not the manager of this venue.",
                    });
                    return;
                }
                // Only allow if status is APPROVED_PAID or APPROVED_NOT_PAID
                if (!["APPROVED_PAID", "APPROVED_NOT_PAID"].includes(booking.bookingStatus)) {
                    res.status(400).json({
                        success: false,
                        message: "Only approved bookings can be cancelled by manager.",
                    });
                    return;
                }
                // Cancel booking
                booking.bookingStatus = VenueBooking_2.BookingStatus.CANCELLED;
                booking.cancellationReason = reason;
                yield bookingRepo.save(booking);
                // Cancel event
                if (booking.event) {
                    booking.event.eventStatus = EventStatusEnum_1.EventStatus.CANCELLED;
                    booking.event.cancellationReason = `Event cancelled because the venue is no longer available: ${reason}`;
                    yield Database_1.AppDataSource.getRepository(Event_1.Event).save(booking.event);
                }
                // Email notification
                try {
                    if (booking.user && booking.user.email) {
                        yield EmailService_1.default.sendBookingCancellationEmail({
                            to: booking.user.email,
                            userName: booking.user.firstName || booking.user.username || "User",
                            venueName: booking.venue.venueName,
                            eventName: ((_b = booking.event) === null || _b === void 0 ? void 0 : _b.eventName) || "Event",
                            reason,
                            refundInfo: booking.isPaid
                                ? "Your payment will be refunded as soon as possible."
                                : undefined,
                            managerPhone: (_c = venueVariable === null || venueVariable === void 0 ? void 0 : venueVariable.manager) === null || _c === void 0 ? void 0 : _c.phoneNumber,
                        });
                    }
                }
                catch (e) {
                    // Log but do not block
                    console.error("Failed to send email notification:", e);
                }
                res.status(200).json({
                    success: true,
                    message: "Booking and event cancelled (slots not deleted).",
                    booking,
                    event: booking.event,
                });
            }
            catch (error) {
                res.status(500).json({
                    success: false,
                    message: error instanceof Error ? error.message : "Failed to cancel booking.",
                });
            }
        });
    }
    static getPendingBookingsByManager(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            const { managerId } = req.params;
            if (!managerId) {
                return res
                    .status(400)
                    .json({ success: false, message: "managerId is required" });
            }
            const bookings = yield VenueBookingRepository_1.VenueBookingRepository.getPendingBookingsByManager(managerId);
            res.json({ success: true, data: bookings });
        });
    }
    static getFormattedPaymentsByManager(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            const { managerId } = req.params;
            if (!managerId) {
                return res
                    .status(400)
                    .json({ success: false, message: "managerId is required" });
            }
            // Get all payments for this manager (reuse existing logic)
            const result = yield VenueBookingRepository_1.VenueBookingRepository.getPaymentsByManagerId(managerId);
            if (!result.success) {
                return res.status(500).json({ success: false, message: result.message });
            }
            // Group payments by bookingId
            const bookingsMap = {};
            const payments = Array.isArray(result.data) ? result.data : [];
            for (const payment of payments) {
                const b = payment.booking;
                if (!b)
                    continue;
                if (!bookingsMap[b.bookingId]) {
                    bookingsMap[b.bookingId] = {
                        bookingId: b.bookingId,
                        bookingReason: b.bookingReason,
                        bookingDate: ((_b = (_a = b.bookingDates) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.date) || null,
                        amountToBePaid: b.amountToBePaid,
                        totalAmountPaid: 0,
                        remainingAmount: b.amountToBePaid,
                        isFullyPaid: false,
                        payments: [],
                        payer: payment.payer
                            ? {
                                userId: payment.payer.userId,
                                username: payment.payer.username,
                                fullName: `${payment.payer.firstName} ${payment.payer.lastName}`.trim(),
                                email: payment.payer.email,
                                phoneNumber: payment.payer.phoneNumber,
                                role: payment.payer.roleId || undefined,
                                location: {
                                    city: payment.payer.city || undefined,
                                    country: payment.payer.country || undefined,
                                },
                            }
                            : undefined,
                    };
                }
                bookingsMap[b.bookingId].payments.push({
                    paymentId: payment.paymentId,
                    amountPaid: Number(payment.amountPaid),
                    paymentMethod: payment.paymentMethod,
                    paymentStatus: payment.paymentStatus,
                    paymentReference: payment.paymentReference,
                    paymentDate: payment.paymentDate,
                    notes: payment.notes,
                });
                bookingsMap[b.bookingId].totalAmountPaid += Number(payment.amountPaid);
            }
            // Finalize remainingAmount and isFullyPaid
            for (const booking of Object.values(bookingsMap)) {
                booking.remainingAmount =
                    booking.amountToBePaid - booking.totalAmountPaid;
                booking.isFullyPaid = booking.remainingAmount <= 0;
            }
            res.json({ success: true, data: Object.values(bookingsMap) });
        });
    }
    static refundAllPaymentsByManager(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                const { bookingId } = req.params;
                const authenticatedReq = req;
                const userId = (_a = authenticatedReq.user) === null || _a === void 0 ? void 0 : _a.userId;
                // Fetch booking with venue
                const bookingRepo = Database_1.AppDataSource.getRepository(VenueBooking_1.VenueBooking);
                const booking = yield bookingRepo.findOne({
                    where: { bookingId },
                    relations: ["venue"],
                });
                if (!booking) {
                    res.status(404).json({ success: false, message: "Booking not found." });
                    return;
                }
                // Check if user is the manager of the venue
                const venueVariableRepo = Database_1.AppDataSource.getRepository(VenueVariable_1.VenueVariable);
                const venueVariable = yield venueVariableRepo.findOne({
                    where: { venue: { venueId: booking.venue.venueId } },
                    relations: ["manager"],
                });
                if (!venueVariable || venueVariable.manager.userId !== userId) {
                    res.status(403).json({
                        success: false,
                        message: "You are not the manager of this venue.",
                    });
                    return;
                }
                // Set all payments for this booking to REFUNDED
                const paymentRepo = Database_1.AppDataSource.getRepository(VenueBookingPayment_1.VenueBookingPayment);
                const payments = yield paymentRepo.find({ where: { bookingId } });
                for (const payment of payments) {
                    payment.paymentStatus = VenueBookingPayment_1.VenueBookingPaymentStatus.REFUNDED;
                    yield paymentRepo.save(payment);
                }
                res.status(200).json({
                    success: true,
                    message: "All payments for this booking have been marked as refunded.",
                    payments,
                });
            }
            catch (error) {
                res.status(500).json({
                    success: false,
                    message: error instanceof Error ? error.message : "Failed to refund payments.",
                });
            }
        });
    }
    static getAllAccessiblePaymentsForUser(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { userId } = req.params;
                // Get all organizations for user
                const orgRepo = require("../repositories/OrganizationRepository");
                const orgsResult = yield orgRepo.OrganizationRepository.getOrganizationsByUserId(userId);
                if (!orgsResult.success || !orgsResult.data) {
                    console.log(`[DEBUG] No organizations found for userId: ${userId}`);
                    res.status(404).json({
                        success: false,
                        message: "Could not fetch organizations for user.",
                    });
                    return;
                }
                // Filter out 'Independent' organizations
                const organizations = orgsResult.data.filter((org) => { var _a; return ((_a = org.organizationName) === null || _a === void 0 ? void 0 : _a.toLowerCase()) !== "independent"; });
                // Always get userPayments, even if organizations is empty
                const paymentRepo = Database_1.AppDataSource.getRepository(VenueBookingPayment_1.VenueBookingPayment);
                const userPayments = yield paymentRepo.find({
                    where: { payerId: userId, payerType: VenueBookingPayment_1.PayerType.USER },
                    order: { paymentDate: "DESC" },
                });
                // Only get organizationPayments if there are non-Independent organizations
                const organizationPayments = {};
                for (const org of organizations) {
                    const orgPayments = yield paymentRepo.find({
                        where: {
                            payerId: org.organizationId,
                            payerType: VenueBookingPayment_1.PayerType.ORGANIZATION,
                        },
                        order: { paymentDate: "DESC" },
                    });
                    organizationPayments[org.organizationId] = orgPayments;
                }
                res
                    .status(200)
                    .json({ success: true, organizationPayments, userPayments });
            }
            catch (error) {
                res.status(500).json({
                    success: false,
                    message: error instanceof Error ? error.message : "Failed to fetch payments.",
                });
            }
        });
    }
    static getBookingsByVenueId(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { venueId } = req.params;
                if (!venueId) {
                    res
                        .status(400)
                        .json({ success: false, message: "venueId is required" });
                    return;
                }
                const bookingRepo = Database_1.AppDataSource.getRepository(VenueBooking_1.VenueBooking);
                const bookings = yield bookingRepo.find({
                    where: { venueId },
                    order: { createdAt: "DESC" },
                    relations: ["user"],
                });
                // Fetch venue summary
                const venueRepo = Database_1.AppDataSource.getRepository(Venue_1.Venue);
                const venue = yield venueRepo.findOne({ where: { venueId } });
                // Enhanced venue summary with payment stats
                let venueSummary = null;
                if (venue) {
                    // Calculate payment stats
                    let fullPaidCount = 0;
                    let partialPaidCount = 0; // Not available without payment history
                    let unpaidCount = 0;
                    let totalRevenue = 0;
                    let totalExpectedRevenue = 0;
                    let totalPaidBookings = 0;
                    let totalUnpaidAmount = 0;
                    for (const booking of bookings) {
                        totalExpectedRevenue += Number(booking.amountToBePaid || 0);
                        if (booking.isPaid) {
                            fullPaidCount++;
                            totalRevenue += Number(booking.amountToBePaid || 0);
                            totalPaidBookings++;
                        }
                        else {
                            unpaidCount++;
                            totalUnpaidAmount += Number(booking.amountToBePaid || 0);
                        }
                        // To support partialPaidCount, you would need to sum payments for each booking
                    }
                    venueSummary = {
                        venueId: venue.venueId,
                        venueName: venue.venueName,
                        capacity: venue.capacity,
                        location: venue.venueLocation,
                        totalBookings: bookings.length,
                        fullPaidCount,
                        partialPaidCount, // Always 0 unless payment history is added
                        unpaidCount,
                        totalRevenue,
                        totalExpectedRevenue,
                        totalPaidBookings,
                        totalUnpaidAmount,
                        occupancyRate: venue.capacity
                            ? ((bookings.length / venue.capacity) * 100).toFixed(2) + "%"
                            : null,
                    };
                }
                const userRepo = Database_1.AppDataSource.getRepository(User_1.User);
                res.status(200).json({
                    success: true,
                    venueSummary,
                    bookings: yield Promise.all(bookings.map((booking) => __awaiter(this, void 0, void 0, function* () {
                        let userInfo = null;
                        if (booking.user) {
                            userInfo = {
                                userId: booking.user.userId,
                                firstName: booking.user.firstName,
                                lastName: booking.user.lastName,
                                email: booking.user.email,
                                phoneNumber: booking.user.phoneNumber,
                            };
                        }
                        else if (booking.createdBy) {
                            const user = yield userRepo.findOne({
                                where: { userId: booking.createdBy },
                            });
                            if (user) {
                                userInfo = {
                                    userId: user.userId,
                                    firstName: user.firstName,
                                    lastName: user.lastName,
                                    email: user.email,
                                    phoneNumber: user.phoneNumber,
                                };
                            }
                        }
                        return Object.assign(Object.assign({}, booking), { user: userInfo });
                    }))),
                });
            }
            catch (error) {
                res.status(500).json({
                    success: false,
                    message: error instanceof Error
                        ? error.message
                        : "Failed to fetch bookings by venueId.",
                });
            }
        });
    }
}
exports.VenueBookingController = VenueBookingController;
