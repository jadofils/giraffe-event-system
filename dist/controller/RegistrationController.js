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
exports.RegistrationController = void 0;
const QrCodeService_1 = require("../services/registrations/QrCodeService");
const Database_1 = require("../config/Database");
const Registration_1 = require("../models/Registration");
const EventVenue_1 = require("../models/Event Tables/EventVenue");
class RegistrationController {
    static validateTicketQrCode(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c;
            try {
                const { qrCodeData } = req.body; // Expecting the raw Base64 string from the QR code
                if (!qrCodeData) {
                    res
                        .status(400)
                        .json({ success: false, message: "QR code data is required." });
                    return;
                }
                // The qrCodeData from the scanned QR code is the Base64 encoded payload
                const validationResult = yield QrCodeService_1.QrCodeService.validateQrCode(qrCodeData);
                if (!validationResult.success || !validationResult.data) {
                    res
                        .status(400)
                        .json({ success: false, message: validationResult.message });
                    return;
                }
                // Fetch more details about the registration for the response
                const registrationRepo = Database_1.AppDataSource.getRepository(Registration_1.Registration);
                const registration = yield registrationRepo.findOne({
                    where: { registrationId: validationResult.data.registrationId },
                    relations: ["event", "ticketType", "user"], // Load necessary relations
                });
                if (!registration) {
                    res.status(404).json({
                        success: false,
                        message: "Registration not found after QR validation.",
                    });
                    return;
                }
                // Explicitly fetch EventVenues for the event to ensure venue details are loaded
                const eventVenueRepo = Database_1.AppDataSource.getRepository(EventVenue_1.EventVenue);
                const eventVenues = yield eventVenueRepo.find({
                    where: { eventId: registration.eventId },
                    relations: ["venue"], // Load the venue for each EventVenue
                });
                // Check if eventDate is an array and access the first element, or provide a fallback
                const eventDate = registration.event.bookingDates &&
                    registration.event.bookingDates.length > 0
                    ? registration.event.bookingDates[0].date
                    : null;
                res.status(200).json({
                    success: true,
                    message: "QR Code validated successfully!",
                    data: {
                        qrPayload: validationResult.data, // The decoded QR payload
                        registration: {
                            registrationId: registration.registrationId,
                            attendeeName: registration.attendeeName,
                            ticketTypeName: registration.ticketType.name,
                            eventName: registration.event.eventName,
                            eventDate: registration.attendedDate || null, // Specific date for THIS ticket
                            allEventBookingDates: ((_a = registration.event) === null || _a === void 0 ? void 0 : _a.bookingDates) || [], // All dates for the event
                            venueName: ((_c = (_b = eventVenues[0]) === null || _b === void 0 ? void 0 : _b.venue) === null || _c === void 0 ? void 0 : _c.venueName) || "N/A", // Use explicitly fetched venue name
                            paymentStatus: registration.paymentStatus,
                            registrationStatus: registration.registrationStatus,
                            qrCode: registration.qrCode,
                            buyerId: registration.buyerId,
                            attendedDate: registration.attendedDate || null, // Include the attended date
                            attended: registration.attended, // Include the attended status
                        },
                    },
                });
            }
            catch (error) {
                console.error("Error validating QR code:", error);
                res.status(500).json({
                    success: false,
                    message: error instanceof Error
                        ? error.message
                        : "An unexpected error occurred during QR code validation.",
                });
            }
        });
    }
    static getTicketsByUserId(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { userId } = req.params;
                if (!userId) {
                    res
                        .status(400)
                        .json({ success: false, message: "User ID is required." });
                    return;
                }
                const registrationRepo = Database_1.AppDataSource.getRepository(Registration_1.Registration);
                const tickets = yield registrationRepo.find({
                    where: { buyerId: userId },
                    relations: ["event", "ticketType", "venue", "payment"], // Load all necessary relations
                    order: { createdAt: "DESC" },
                });
                if (!tickets || tickets.length === 0) {
                    res
                        .status(404)
                        .json({ success: false, message: "No tickets found for this user." });
                    return;
                }
                const formattedTickets = tickets.map((ticket) => {
                    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y, _z;
                    return ({
                        registrationId: ticket.registrationId,
                        attendeeName: ticket.attendeeName,
                        ticketTypeName: ((_a = ticket.ticketType) === null || _a === void 0 ? void 0 : _a.name) || "N/A",
                        eventId: ticket.eventId,
                        eventName: ((_b = ticket.event) === null || _b === void 0 ? void 0 : _b.eventName) || "N/A",
                        eventPhoto: ((_c = ticket.event) === null || _c === void 0 ? void 0 : _c.eventPhoto) || undefined, // Include event photo
                        venueId: ticket.venueId,
                        venueName: ((_d = ticket.venue) === null || _d === void 0 ? void 0 : _d.venueName) || "N/A",
                        venueGoogleMapsLink: ((_e = ticket.venue) === null || _e === void 0 ? void 0 : _e.googleMapsLink) || undefined,
                        noOfTickets: ticket.noOfTickets,
                        totalCost: ticket.totalCost,
                        registrationDate: ticket.registrationDate,
                        attendedDate: ticket.attendedDate,
                        paymentStatus: ticket.paymentStatus,
                        qrCode: ticket.qrCode,
                        buyerId: ticket.buyerId,
                        attended: ticket.attended,
                        ticketTypeDetails: {
                            ticketTypeId: (_f = ticket.ticketType) === null || _f === void 0 ? void 0 : _f.ticketTypeId,
                            name: (_g = ticket.ticketType) === null || _g === void 0 ? void 0 : _g.name,
                            price: (_h = ticket.ticketType) === null || _h === void 0 ? void 0 : _h.price,
                            quantityAvailable: (_j = ticket.ticketType) === null || _j === void 0 ? void 0 : _j.quantityAvailable,
                            quantitySold: (_k = ticket.ticketType) === null || _k === void 0 ? void 0 : _k.quantitySold,
                            currency: (_l = ticket.ticketType) === null || _l === void 0 ? void 0 : _l.currency,
                            description: (_m = ticket.ticketType) === null || _m === void 0 ? void 0 : _m.description,
                            saleStartsAt: (_o = ticket.ticketType) === null || _o === void 0 ? void 0 : _o.saleStartsAt,
                            saleEndsAt: (_p = ticket.ticketType) === null || _p === void 0 ? void 0 : _p.saleEndsAt,
                            isPubliclyAvailable: (_q = ticket.ticketType) === null || _q === void 0 ? void 0 : _q.isPubliclyAvailable,
                            maxPerPerson: (_r = ticket.ticketType) === null || _r === void 0 ? void 0 : _r.maxPerPerson,
                            isActive: (_s = ticket.ticketType) === null || _s === void 0 ? void 0 : _s.isActive,
                            categoryDiscounts: (_t = ticket.ticketType) === null || _t === void 0 ? void 0 : _t.categoryDiscounts,
                            isRefundable: (_u = ticket.ticketType) === null || _u === void 0 ? void 0 : _u.isRefundable,
                            refundPolicy: (_v = ticket.ticketType) === null || _v === void 0 ? void 0 : _v.refundPolicy,
                            transferable: (_w = ticket.ticketType) === null || _w === void 0 ? void 0 : _w.transferable,
                            ageRestriction: (_x = ticket.ticketType) === null || _x === void 0 ? void 0 : _x.ageRestriction,
                            specialInstructions: (_y = ticket.ticketType) === null || _y === void 0 ? void 0 : _y.specialInstructions,
                            status: (_z = ticket.ticketType) === null || _z === void 0 ? void 0 : _z.status,
                        },
                        payment: ticket.payment
                            ? {
                                paymentId: ticket.payment.paymentId,
                                amountPaid: ticket.payment.amountPaid,
                                paymentMethod: ticket.payment.paymentMethod,
                                paymentStatus: ticket.payment.paymentStatus,
                                paymentReference: ticket.payment.paymentReference,
                                notes: ticket.payment.notes,
                            }
                            : null,
                    });
                });
                res.status(200).json({ success: true, data: formattedTickets });
            }
            catch (error) {
                console.error("Error fetching tickets by user ID:", error);
                res.status(500).json({
                    success: false,
                    message: error instanceof Error
                        ? error.message
                        : "An unexpected error occurred while fetching tickets.",
                });
            }
        });
    }
    static markTicketAttended(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { registrationId } = req.params;
                if (!registrationId) {
                    res
                        .status(400)
                        .json({ success: false, message: "Registration ID is required." });
                    return;
                }
                const registrationRepo = Database_1.AppDataSource.getRepository(Registration_1.Registration);
                const ticket = yield registrationRepo.findOne({
                    where: { registrationId },
                    relations: ["event", "ticketType", "venue", "payment"], // Load relevant relations
                });
                if (!ticket) {
                    res.status(404).json({ success: false, message: "Ticket not found." });
                    return;
                }
                if (ticket.attended) {
                    res.status(400).json({
                        success: false,
                        message: "Ticket has already been marked as attended.",
                        data: ticket, // Return the already-attended ticket details
                    });
                    return;
                }
                // You might add additional checks here, e.g., if paymentStatus is not PAID
                // if (ticket.paymentStatus !== "PAID") {
                //   res.status(400).json({ success: false, message: "Cannot mark an unpaid ticket as attended." });
                //   return;
                // }
                // Mark as attended
                ticket.attended = true;
                ticket.checkDate = new Date(); // Record the time of attendance
                yield registrationRepo.save(ticket);
                res.status(200).json({
                    success: true,
                    message: "Ticket marked as attended successfully.",
                    data: ticket,
                });
            }
            catch (error) {
                console.error("Error marking ticket as attended:", error);
                res.status(500).json({
                    success: false,
                    message: error instanceof Error
                        ? error.message
                        : "An unexpected error occurred while marking ticket attended.",
                });
            }
        });
    }
    static checkInTicket(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
            try {
                const { qrCodeData, eventId: requestedEventId } = req.body; // eventId is optional for extra context
                if (!qrCodeData) {
                    res
                        .status(400)
                        .json({ success: false, message: "QR code data is required." });
                    return;
                }
                // 1. Decode QR Code
                const validationResult = yield QrCodeService_1.QrCodeService.validateQrCode(qrCodeData);
                if (!validationResult.success || !validationResult.data) {
                    res.status(400).json({
                        success: false,
                        message: validationResult.message,
                        alertType: "error",
                    });
                    return;
                }
                const { registrationId, eventId: qrEventId } = validationResult.data;
                // 2. Fetch Ticket Details
                const registrationRepo = Database_1.AppDataSource.getRepository(Registration_1.Registration);
                const ticket = yield registrationRepo.findOne({
                    where: { registrationId },
                    relations: ["event", "ticketType", "venue", "payment"], // Load all necessary relations
                });
                if (!ticket) {
                    res.status(404).json({
                        success: false,
                        message: "Ticket not found in system.",
                        alertType: "error",
                    });
                    return;
                }
                // Explicitly fetch EventVenues for the event to ensure venue details are loaded
                const eventVenueRepo = Database_1.AppDataSource.getRepository(EventVenue_1.EventVenue);
                const eventVenues = yield eventVenueRepo.find({
                    where: { eventId: ticket.eventId },
                    relations: ["venue"], // Load the venue for each EventVenue
                });
                // 3. Security & Context Validation
                // Ensure the ticket is for the event being checked in (if eventId is provided by scanner app)
                if (requestedEventId && requestedEventId !== ticket.eventId) {
                    res.status(400).json({
                        success: false,
                        message: "Ticket is for a different event.",
                        alertType: "error",
                        data: { eventName: ((_a = ticket.event) === null || _a === void 0 ? void 0 : _a.eventName) || "Unknown Event" },
                    });
                    return;
                }
                // Check payment status
                if (ticket.paymentStatus !== "PAID") {
                    res.status(400).json({
                        success: false,
                        message: `Ticket payment status is '${ticket.paymentStatus}'. Payment required.`, // Customize message
                        alertType: "warning",
                        data: { paymentStatus: ticket.paymentStatus },
                    });
                    return;
                }
                // 4. Attendance Status Check (already used?)
                if (ticket.attended) {
                    res.status(400).json({
                        success: false,
                        message: "Ticket has already been used.",
                        alertType: "warning",
                        data: { checkDate: (_b = ticket.checkDate) === null || _b === void 0 ? void 0 : _b.toISOString() }, // Show when it was used
                    });
                    return;
                }
                // 5. Date Validity Check (for day-specific tickets at multi-day events)
                // const today = new Date().toISOString().split("T")[0]; // Current date in YYYY-MM-DD format (UTC)
                // const ticketAttendedDateISO = ticket.attendedDate
                //   ? new Date(ticket.attendedDate).toISOString().split("T")[0]
                //   : null;
                // if (ticketAttendedDateISO && ticketAttendedDateISO !== today) {
                //   res.status(400).json({
                //     success: false,
                //     message: `Ticket is for ${new Date(
                //       ticket.attendedDate!
                //     ).toDateString()}, not for today (${new Date().toDateString()}).`,
                //     alertType: "error",
                //     data: { ticketDate: ticket.attendedDate, todayDate: today },
                //   });
                //   return;
                // }
                // 6. Mark Attended (if all checks pass)
                ticket.attended = true;
                ticket.checkDate = new Date();
                yield registrationRepo.save(ticket);
                // 7. Comprehensive Success Response
                res.status(200).json({
                    success: true,
                    message: "Check-in successful!",
                    alertType: "success",
                    data: {
                        registrationId: ticket.registrationId,
                        attendeeName: ticket.attendeeName,
                        ticketTypeName: ((_c = ticket.ticketType) === null || _c === void 0 ? void 0 : _c.name) || "N/A",
                        eventName: ((_d = ticket.event) === null || _d === void 0 ? void 0 : _d.eventName) || "N/A",
                        ticketAttendedDate: ticket.attendedDate, // The specific date this ticket is valid for
                        allEventBookingDates: ((_e = ticket.event) === null || _e === void 0 ? void 0 : _e.bookingDates) || [], // All event dates
                        venueName: ((_g = (_f = eventVenues[0]) === null || _f === void 0 ? void 0 : _f.venue) === null || _g === void 0 ? void 0 : _g.venueName) || "N/A",
                        venueGoogleMapsLink: ((_j = (_h = eventVenues[0]) === null || _h === void 0 ? void 0 : _h.venue) === null || _j === void 0 ? void 0 : _j.googleMapsLink) || undefined,
                        paymentStatus: ticket.paymentStatus,
                        currentAttendanceStatus: ticket.attended, // Should be true
                        checkInTimestamp: (_k = ticket.checkDate) === null || _k === void 0 ? void 0 : _k.toISOString(),
                    },
                });
            }
            catch (error) {
                console.error("Error during ticket check-in:", error);
                res.status(500).json({
                    success: false,
                    message: error instanceof Error
                        ? error.message
                        : "An unexpected error occurred during check-in.",
                    alertType: "error",
                });
            }
        });
    }
}
exports.RegistrationController = RegistrationController;
