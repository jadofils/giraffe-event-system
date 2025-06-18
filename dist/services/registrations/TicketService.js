"use strict";
// src/services/registrations/TicketService.ts
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
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
exports.TicketService = void 0;
const RegistrationRepository_1 = require("../../repositories/RegistrationRepository");
const User_1 = require("../../models/User");
const Database_1 = require("../../config/Database");
const Registration_1 = require("../../models/Registration");
const class_validator_1 = require("class-validator");
const Invoice_1 = require("../../models/Invoice");
const pdfkit_1 = __importDefault(require("pdfkit"));
const EmailService_1 = __importDefault(require("../emails/EmailService"));
class TicketService {
    // Helper method to check authorization
    // Renamed for clarity on its purpose: Authorize access to a specific registration
    static isAuthorizedForRegistration(loggedInUserId, loggedInUserRoleNames, registration) {
        var _a, _b, _c, _d;
        const normalizedRoles = loggedInUserRoleNames.map(role => role.toLowerCase());
        const hasAdminAccess = normalizedRoles.includes('admin');
        const hasManagerAccess = normalizedRoles.includes('manager');
        // Admin and Manager have full access to any registration
        if (hasAdminAccess || hasManagerAccess) {
            return true;
        }
        // Normalize loggedInUserId for comparison
        const normalizedLoggedInUserId = loggedInUserId.toLowerCase();
        // Check if the logged-in user is the buyer of this registration
        const isBuyer = ((_b = (_a = registration.buyer) === null || _a === void 0 ? void 0 : _a.userId) === null || _b === void 0 ? void 0 : _b.toLowerCase()) === normalizedLoggedInUserId;
        // Check if the logged-in user is the primary attendee of this registration
        const isPrimaryAttendee = ((_d = (_c = registration.user) === null || _c === void 0 ? void 0 : _c.userId) === null || _d === void 0 ? void 0 : _d.toLowerCase()) === normalizedLoggedInUserId;
        // Check if the logged-in user is one of the "boughtFor" attendees
        const isInBoughtFor = Array.isArray(registration.boughtForIds) &&
            registration.boughtForIds.map(id => id.toLowerCase()).includes(normalizedLoggedInUserId);
        // A user is authorized if they are an admin, manager, the buyer, the primary attendee,
        // or one of the attendees for whom the ticket was bought.
        return isBuyer || isPrimaryAttendee || isInBoughtFor;
    }
    /**
     * Get ticket details for a registration
     */
    static getTicketDetails(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y;
            const loggedInUserId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.userId;
            // Ensure roles are mapped to an array of strings containing just the role names
            const loggedInUserRoles = ((_c = (_b = req.user) === null || _b === void 0 ? void 0 : _b.roles) === null || _c === void 0 ? void 0 : _c.map((role) => typeof role === 'string' ? role : role.roleName)) || [];
            console.log(`[TicketService:getTicketDetails] User ID: ${loggedInUserId}, Roles: ${JSON.stringify(loggedInUserRoles)}`);
            try {
                const { id: registrationId } = req.params;
                if (!loggedInUserId) {
                    res.status(401).json({ success: false, message: 'Unauthorized: User information is missing from the token.' });
                    return;
                }
                if (!registrationId) {
                    res.status(400).json({ success: false, message: 'Registration ID is required.' });
                    return;
                }
                // Find the registration with all necessary relations
                const registration = yield RegistrationRepository_1.RegistrationRepository.getRepository().findOne({
                    where: { registrationId },
                    relations: ['event', 'user', 'buyer', 'ticketType', 'venue']
                });
                if (!registration) {
                    res.status(404).json({ success: false, message: 'Registration not found.' });
                    return;
                }
                // Authorization Check
                if (!this.isAuthorizedForRegistration(loggedInUserId, loggedInUserRoles, registration)) {
                    res.status(403).json({ success: false, message: 'Forbidden: You do not have access to these registration details.' });
                    return;
                }
                // Fetch details for boughtForIds users
                let boughtForUsersDetails = [];
                if (registration.boughtForIds && registration.boughtForIds.length > 0) {
                    boughtForUsersDetails = yield Database_1.AppDataSource.getRepository(User_1.User).findByIds(registration.boughtForIds);
                }
                // Calculate total cost and include ticket type details
                const ticketPrice = registration.ticketType ? parseFloat(registration.ticketType.price.toString()) : 0;
                const totalCost = ticketPrice * registration.noOfTickets;
                // Construct the enhanced response data
                const responseData = {
                    registrationId: registration.registrationId,
                    noOfTickets: registration.noOfTickets,
                    registrationDate: registration.registrationDate,
                    paymentStatus: registration.paymentStatus,
                    attended: registration.attended,
                    checkDate: registration.checkDate,
                    qrCode: registration.qrCode,
                    ticketType: {
                        id: (_d = registration.ticketType) === null || _d === void 0 ? void 0 : _d.ticketTypeId, // Add null check
                        name: (_e = registration.ticketType) === null || _e === void 0 ? void 0 : _e.ticketName, // Add null check
                        description: (_f = registration.ticketType) === null || _f === void 0 ? void 0 : _f.description, // Add null check
                        price: ticketPrice,
                        availableQuantity: registration.noOfTickets
                    },
                    buyer: {
                        userId: (_g = registration.buyer) === null || _g === void 0 ? void 0 : _g.userId, // Add null check
                        lastName: (_h = registration.buyer) === null || _h === void 0 ? void 0 : _h.lastName, // Add null check
                        email: (_j = registration.buyer) === null || _j === void 0 ? void 0 : _j.email, // Add null check
                    },
                    primaryAttendee: {
                        userId: (_k = registration.user) === null || _k === void 0 ? void 0 : _k.userId, // Add null check
                        lastName: (_l = registration.user) === null || _l === void 0 ? void 0 : _l.lastName, // Add null check
                        email: (_m = registration.user) === null || _m === void 0 ? void 0 : _m.email, // Add null check
                    },
                    boughtForAttendees: boughtForUsersDetails.map(user => ({
                        userId: user.userId,
                        lastName: user.lastName,
                        email: user.email,
                    })),
                    event: {
                        eventId: (_o = registration.event) === null || _o === void 0 ? void 0 : _o.eventId, // Add null check
                        eventName: (_p = registration.event) === null || _p === void 0 ? void 0 : _p.eventTitle, // Add null check
                        eventType: (_q = registration.event) === null || _q === void 0 ? void 0 : _q.eventType, // Add null check
                        category: (_r = registration.event) === null || _r === void 0 ? void 0 : _r.eventCategoryId, // Add null check
                        description: (_s = registration.event) === null || _s === void 0 ? void 0 : _s.description, // Add null check
                    },
                    venue: {
                        venueId: (_t = registration.venue) === null || _t === void 0 ? void 0 : _t.venueId, // Add null check
                        venueName: (_u = registration.venue) === null || _u === void 0 ? void 0 : _u.venueName, // Add null check
                        address: (_v = registration.venue) === null || _v === void 0 ? void 0 : _v.location, // Add null check
                        capacity: (_w = registration.venue) === null || _w === void 0 ? void 0 : _w.capacity, // Add null check
                        manager: (_x = registration.venue) === null || _x === void 0 ? void 0 : _x.manager, // Add null check
                        location: (_y = registration.venue) === null || _y === void 0 ? void 0 : _y.location, // Add null check
                    },
                    totalCost: totalCost
                };
                res.status(200).json({
                    success: true,
                    message: 'Ticket details retrieved successfully.',
                    data: responseData
                });
            }
            catch (error) {
                console.error(`Error getting ticket details for registration ${req.params.id} by user ${loggedInUserId}:`, error);
                res.status(500).json({ success: false, message: 'Failed to retrieve ticket details due to a server error.' });
            }
        });
    }
    /**
     * Transfer a ticket to a new user
     */
    static transferTicket(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d, _e;
            const loggedInUserId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.userId;
            const loggedInUserRoles = ((_c = (_b = req.user) === null || _b === void 0 ? void 0 : _b.roles) === null || _c === void 0 ? void 0 : _c.map((role) => typeof role === 'string' ? role : role.roleName)) || [];
            console.log(`[TicketService:transferTicket] User ID: ${loggedInUserId}, Roles: ${JSON.stringify(loggedInUserRoles)}`);
            try {
                const { id: registrationId } = req.params;
                const { oldUserId, newUserId } = req.body;
                if (!loggedInUserId) {
                    res.status(401).json({ success: false, message: 'Unauthorized: User information is missing.' });
                    return;
                }
                if (!registrationId || !newUserId) {
                    res.status(400).json({ success: false, message: 'Registration ID and new User ID are required.' });
                    return;
                }
                // Find the registration with necessary relations
                const registration = yield RegistrationRepository_1.RegistrationRepository.getRepository().findOne({
                    where: { registrationId },
                    relations: ['buyer', 'user']
                });
                if (!registration) {
                    res.status(404).json({ success: false, message: 'Registration not found.' });
                    return;
                }
                // Authorization Check - Admin, Manager, or Buyer can transfer
                if (!this.isAuthorizedForRegistration(loggedInUserId, loggedInUserRoles, registration)) {
                    res.status(403).json({ success: false, message: 'Forbidden: You do not have permission to transfer tickets for this registration.' });
                    return;
                }
                // Validate newUserId
                const newUser = yield Database_1.AppDataSource.getRepository(User_1.User).findOne({ where: { userId: newUserId } });
                if (!newUser) {
                    res.status(400).json({ success: false, message: 'New user (newUserId) not found.' });
                    return;
                }
                // Ticket Transfer Logic
                let updatedBoughtForIds = registration.boughtForIds ? [...registration.boughtForIds] : [];
                let transferSuccessful = false;
                if (oldUserId) {
                    // Scenario 1: Replacing an existing boughtForId
                    const indexToRemove = updatedBoughtForIds.indexOf(oldUserId);
                    // Prevent replacing the primary attendee or buyer
                    if (((_d = registration.user) === null || _d === void 0 ? void 0 : _d.userId) === oldUserId || ((_e = registration.buyer) === null || _e === void 0 ? void 0 : _e.userId) === oldUserId) {
                        res.status(400).json({ success: false, message: 'Cannot transfer the primary attendee\'s or buyer\'s ticket directly using this method.' });
                        return;
                    }
                    if (indexToRemove !== -1) {
                        const otherBoughtForIds = updatedBoughtForIds.filter((_, idx) => idx !== indexToRemove);
                        if (otherBoughtForIds.includes(newUserId)) {
                            res.status(400).json({ success: false, message: 'The new user is already assigned a ticket for this registration.' });
                            return;
                        }
                        updatedBoughtForIds[indexToRemove] = newUserId;
                        transferSuccessful = true;
                    }
                    else {
                        if (updatedBoughtForIds.length < registration.noOfTickets) {
                            if (updatedBoughtForIds.includes(newUserId)) {
                                res.status(400).json({ success: false, message: 'The new user is already assigned a ticket for this registration.' });
                                return;
                            }
                            updatedBoughtForIds.push(newUserId);
                            transferSuccessful = true;
                        }
                        else {
                            res.status(400).json({ success: false, message: 'Old user not found in bought tickets, and no available slots for transfer.' });
                            return;
                        }
                    }
                }
                else {
                    // Scenario 2: Fill an empty slot
                    if (updatedBoughtForIds.length < registration.noOfTickets) {
                        if (updatedBoughtForIds.includes(newUserId)) {
                            res.status(400).json({ success: false, message: 'The new user is already assigned a ticket for this registration.' });
                            return;
                        }
                        updatedBoughtForIds.push(newUserId);
                        transferSuccessful = true;
                    }
                    else {
                        res.status(400).json({ success: false, message: 'Cannot transfer: All ticket slots are already assigned.' });
                        return;
                    }
                }
                if (transferSuccessful) {
                    registration.boughtForIds = updatedBoughtForIds;
                    yield RegistrationRepository_1.RegistrationRepository.getRepository().save(registration);
                    res.status(200).json({
                        success: true,
                        message: `Ticket successfully transferred for registration ${registrationId}.`,
                        data: {
                            registrationId: registration.registrationId,
                            noOfTickets: registration.noOfTickets,
                            updatedBoughtForIds: registration.boughtForIds
                        }
                    });
                }
                else {
                    res.status(400).json({ success: false, message: 'Ticket transfer failed due to logic error.' });
                }
            }
            catch (error) {
                console.error(`Error transferring ticket for registration ${req.params.id} by user ${loggedInUserId}:`, error);
                res.status(500).json({ success: false, message: 'Failed to transfer ticket due to a server error.' });
            }
        });
    }
    /**
     * Cancel specific tickets from a registration
     */
    static cancelRegistration(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d, _e;
            const loggedInUserId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.userId;
            const loggedInUserRoles = ((_c = (_b = req.user) === null || _b === void 0 ? void 0 : _b.roles) === null || _c === void 0 ? void 0 : _c.map((role) => typeof role === 'string' ? role : role.roleName)) || [];
            console.log(`[TicketService:cancelRegistration] User ID: ${loggedInUserId}, Roles: ${JSON.stringify(loggedInUserRoles)}`);
            try {
                const { id: registrationId } = req.params;
                const { idsToCancel } = req.body;
                if (!loggedInUserId) {
                    res.status(401).json({ success: false, message: 'Unauthorized: User information is missing.' });
                    return;
                }
                if (!registrationId) {
                    res.status(400).json({ success: false, message: 'Registration ID is required.' });
                    return;
                }
                // Validate the incoming request body
                const cancelDto = new CancelTicketsDto();
                cancelDto.idsToCancel = idsToCancel;
                const errors = yield (0, class_validator_1.validate)(cancelDto);
                if (errors.length > 0) {
                    res.status(400).json({ success: false, message: 'Invalid request body.', errors: errors.map(err => err.constraints) });
                    return;
                }
                const registrationRepository = Database_1.AppDataSource.getRepository(Registration_1.Registration);
                const invoiceRepository = Database_1.AppDataSource.getRepository(Invoice_1.Invoice);
                // Fetch Registration with all necessary relations
                const registration = yield registrationRepository.findOne({
                    where: { registrationId },
                    relations: ['payment', 'buyer', 'user', 'ticketType', 'invoice']
                });
                if (!registration) {
                    res.status(404).json({ success: false, message: 'Registration not found.' });
                    return;
                }
                // Authorization Check
                if (!this.isAuthorizedForRegistration(loggedInUserId, loggedInUserRoles, registration)) {
                    res.status(403).json({ success: false, message: 'Forbidden: You do not have permission to cancel tickets for this registration.' });
                    return;
                }
                // Payment Status Check: Must be 'pending' for direct cost reduction
                if (registration.paymentStatus !== 'pending') {
                    res.status(400).json({ success: false, message: `Cannot cancel tickets: Registration payment status is '${registration.paymentStatus}', not 'pending'. For paid registrations, a separate refund process is required.` });
                    return;
                }
                // Process Ticket Cancellation
                let currentBoughtForIds = registration.boughtForIds ? [...registration.boughtForIds] : [];
                const ticketPricePerUnit = registration.ticketType ? parseFloat(registration.ticketType.price.toString()) : 0;
                if (ticketPricePerUnit <= 0) {
                    res.status(500).json({ success: false, message: 'Invalid ticket price found for this registration.' });
                    return;
                }
                const newBoughtForIds = [];
                const cancelledUserIds = [];
                for (const existingId of currentBoughtForIds) {
                    if (idsToCancel.includes(existingId)) {
                        // Prevent cancellation of the primary attendee or buyer
                        if (existingId === ((_d = registration.user) === null || _d === void 0 ? void 0 : _d.userId) || existingId === ((_e = registration.buyer) === null || _e === void 0 ? void 0 : _e.userId)) {
                            console.warn(`Skipping cancellation of primary attendee/buyer (${existingId}) for registration ${registrationId}.`);
                            newBoughtForIds.push(existingId);
                        }
                        else {
                            cancelledUserIds.push(existingId);
                        }
                    }
                    else {
                        newBoughtForIds.push(existingId);
                    }
                }
                if (cancelledUserIds.length === 0) {
                    res.status(400).json({ success: false, message: 'No valid tickets found for cancellation.' });
                    return;
                }
                const ticketsActuallyCancelledCount = cancelledUserIds.length;
                const costReduction = ticketPricePerUnit * ticketsActuallyCancelledCount;
                // Update Registration details
                registration.boughtForIds = newBoughtForIds;
                registration.noOfTickets -= ticketsActuallyCancelledCount;
                registration.totalCost = parseFloat((registration.totalCost - costReduction).toFixed(2));
                // Update registration status
                if (registration.noOfTickets === 0) {
                    registration.registrationStatus = 'cancelled';
                    registration.paymentStatus = 'cancelled';
                }
                else {
                    registration.registrationStatus = 'partially_cancelled';
                }
                // Update linked invoice
                if (registration.invoice) {
                    registration.invoice.totalAmount = parseFloat((registration.invoice.totalAmount - costReduction).toFixed(2));
                    yield invoiceRepository.save(registration.invoice);
                }
                // Save the updated registration
                yield registrationRepository.save(registration);
                res.status(200).json({
                    success: true,
                    message: `Successfully cancelled ${ticketsActuallyCancelledCount} ticket(s).`,
                    data: {
                        registrationId: registration.registrationId,
                        newNoOfTickets: registration.noOfTickets,
                        newBoughtForIds: registration.boughtForIds,
                        newTotalCost: registration.totalCost,
                        newRegistrationStatus: registration.registrationStatus,
                        cancelledUserIds: cancelledUserIds
                    }
                });
            }
            catch (error) {
                console.error(`Error cancelling tickets for registration ${req.params.id} by user ${loggedInUserId}:`, error);
                res.status(500).json({ success: false, message: 'Failed to cancel tickets due to a server error.' });
            }
        });
    }
    /**
     * Resend ticket via email
     */
    /**
       * Resend ticket via email
       */
    static resendTicket(registrationId, userEmail) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d, _e;
            try {
                console.log(`[TicketService:resendTicket] Resending ticket for registration: ${registrationId}`);
                const registration = yield RegistrationRepository_1.RegistrationRepository.getRepository().findOne({
                    where: { registrationId },
                    relations: ['event', 'user', 'buyer', 'ticketType', 'venue']
                });
                if (!registration) {
                    console.error(`Registration not found: ${registrationId}`);
                    return false;
                }
                // Generate ticket PDF
                const ticketPdf = yield this.generateTicketPdf(registrationId);
                // Determine recipient email
                const recipientEmail = userEmail || ((_a = registration.user) === null || _a === void 0 ? void 0 : _a.email);
                // Send email with ticket attachment
                if (recipientEmail) {
                    yield EmailService_1.default.sendTicketEmail({
                        to: recipientEmail,
                        subject: `Your Ticket for ${(_b = registration.event) === null || _b === void 0 ? void 0 : _b.eventTitle}`,
                        eventName: (_c = registration.event) === null || _c === void 0 ? void 0 : _c.eventTitle,
                        eventDate: (_d = registration.event) === null || _d === void 0 ? void 0 : _d.createdAt,
                        venueName: (_e = registration.venue) === null || _e === void 0 ? void 0 : _e.venueName,
                        ticketPdf: ticketPdf,
                        qrCode: registration.qrCode
                    });
                }
                else {
                    console.warn(`No recipient email found for registration ${registrationId}. Skipping email send.`);
                    return false;
                }
                return true;
            }
            catch (error) {
                console.error(`Error resending ticket for registration ${registrationId}:`, error);
                return false;
            }
        });
    }
    /**
     * Generate ticket PDF
     */
    static generateTicketPdf(registrationId) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
            try {
                console.log(`[TicketService:generateTicketPdf] Generating PDF for registration: ${registrationId}`);
                const registration = yield RegistrationRepository_1.RegistrationRepository.getRepository().findOne({
                    where: { registrationId },
                    relations: ['event', 'user', 'buyer', 'ticketType', 'venue']
                });
                if (!registration) {
                    throw new Error(`Registration not found: ${registrationId}`);
                }
                // Create PDF document
                const doc = new pdfkit_1.default({ size: 'A4', margin: 50 });
                const chunks = [];
                doc.on('data', (chunk) => chunks.push(chunk));
                // PDF Header
                doc.fontSize(24).text('EVENT TICKET', { align: 'center' });
                doc.moveDown();
                // Event Information
                doc.fontSize(18).text(((_a = registration.event) === null || _a === void 0 ? void 0 : _a.eventTitle) || 'N/A', { align: 'center' });
                doc.moveDown();
                doc.fontSize(12);
                doc.text(`Event Date: ${new Date(((_b = registration.event) === null || _b === void 0 ? void 0 : _b.createdAt) || '').toLocaleDateString()}`);
                doc.text(`Event Type: ${((_c = registration.event) === null || _c === void 0 ? void 0 : _c.eventType) || 'N/A'}`);
                doc.text(`Category: ${((_d = registration.event) === null || _d === void 0 ? void 0 : _d.eventCategoryId) || 'N/A'}`);
                doc.moveDown();
                // Venue Information
                doc.text(`Venue: ${((_e = registration.venue) === null || _e === void 0 ? void 0 : _e.venueName) || 'N/A'}`);
                doc.text(`Location: ${((_f = registration.venue) === null || _f === void 0 ? void 0 : _f.location) || 'N/A'}`);
                doc.moveDown();
                // Ticket Information
                const ticketPrice = registration.ticketType ? parseFloat(registration.ticketType.price.toString()) : 0;
                const totalCost = ticketPrice * registration.noOfTickets;
                doc.text(`Ticket Type: ${((_g = registration.ticketType) === null || _g === void 0 ? void 0 : _g.ticketName) || 'N/A'}`);
                doc.text(`Number of Tickets: ${registration.noOfTickets}`);
                doc.text(`Price per Ticket: $${ticketPrice.toFixed(2)}`);
                doc.text(`Total Cost: $${totalCost.toFixed(2)}`);
                doc.moveDown();
                // Attendee Information
                doc.text(`Primary Attendee: ${((_h = registration.user) === null || _h === void 0 ? void 0 : _h.lastName) || 'N/A'}`);
                doc.text(`Email: ${((_j = registration.user) === null || _j === void 0 ? void 0 : _j.email) || 'N/A'}`);
                doc.text(`Buyer: ${((_k = registration.buyer) === null || _k === void 0 ? void 0 : _k.lastName) || 'N/A'}`);
                doc.moveDown();
                // Registration Details
                doc.text(`Registration ID: ${registration.registrationId}`);
                doc.text(`Registration Date: ${new Date(registration.registrationDate).toLocaleDateString()}`);
                doc.text(`Payment Status: ${registration.paymentStatus}`);
                doc.moveDown();
                // QR Code (if available)
                if (registration.qrCode) {
                    doc.text(`QR Code: ${registration.qrCode}`);
                }
                // Footer
                doc.moveDown();
                doc.text('Please present this ticket at the venue entrance.', { align: 'center' });
                doc.text('Thank you for your registration!', { align: 'center' });
                doc.end();
                return new Promise((resolve) => {
                    doc.on('end', () => {
                        resolve(Buffer.concat(chunks));
                    });
                });
            }
            catch (error) {
                console.error(`Error generating PDF for registration ${registrationId}:`, error);
                throw new Error(`PDF generation failed: ${error}`);
            }
        });
    }
    /**
     * Validate ticket
     */
    static validateTicket(registrationId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                console.log(`[TicketService:validateTicket] Validating ticket for registration: ${registrationId}`);
                const registration = yield RegistrationRepository_1.RegistrationRepository.getRepository().findOne({
                    where: { registrationId },
                    relations: ['event']
                });
                if (!registration) {
                    console.error(`Registration not found: ${registrationId}`);
                    return false;
                }
                // Check if registration is valid
                if (registration.registrationStatus === 'cancelled') {
                    console.error(`Registration is cancelled: ${registrationId}`);
                    return false;
                }
                // Check if payment is completed
                if (registration.paymentStatus !== 'completed' && registration.paymentStatus !== 'paid') {
                    console.error(`Payment not completed for registration: ${registrationId}`);
                    return false;
                }
                // Check if event date hasn't passed
                if (registration.event && new Date(registration.event.createdAt || registration.event.createdAt) < new Date()) {
                    console.error(`Event has already passed for registration: ${registrationId}`);
                    return false;
                }
                return true;
            }
            catch (error) {
                console.error(`Error validating ticket for registration ${registrationId}:`, error);
                return false;
            }
        });
    }
    /**
     * Get available ticket types for an event
     */
    static getAvailableTicketTypes(eventId) {
        return __awaiter(this, void 0, void 0, function* () {
            // TODO: Implement get available ticket types
            return []; // Placeholder return value
        });
    }
    /**
     * Check ticket availability
     */
    static checkTicketAvailability(ticketTypeId, quantity) {
        return __awaiter(this, void 0, void 0, function* () {
            // TODO: Implement check ticket availability
            return false; // Placeholder return value
        });
    }
    /**
     * Reserve tickets
     */
    static reserveTickets(ticketTypeId, quantity, userId) {
        return __awaiter(this, void 0, void 0, function* () {
            // TODO: Implement reserve tickets
            return false; // Placeholder return value
        });
    }
    /**
    * Add tickets to an existing registration (increment noOfTickets)
    * Allows adding 1 ticket by default, up to a maximum of 10 tickets per registration,
    * and also respects the ticket type's maxQuantity.
    */
    static AddToCartTheNoOfTickets(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d;
            const loggedInUserId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.userId;
            const loggedInUserRoles = ((_c = (_b = req.user) === null || _b === void 0 ? void 0 : _b.roles) === null || _c === void 0 ? void 0 : _c.map((role) => typeof role === 'string' ? role : role.roleName)) || [];
            console.log(`[TicketService:AddToCartTheNoOfTickets] User ID: ${loggedInUserId}, Roles: ${JSON.stringify(loggedInUserRoles)}`);
            try {
                const { id: registrationId } = req.params;
                const { quantityToAdd } = req.body;
                if (!loggedInUserId) {
                    res.status(401).json({ success: false, message: 'Unauthorized: User information is missing.' });
                    return;
                }
                if (!registrationId) {
                    res.status(400).json({ success: false, message: 'Registration ID is required.' });
                    return;
                }
                // Validate the incoming request body for quantityToAdd
                const addToCartDto = new AddToCartTicketsDto();
                addToCartDto.quantityToAdd = quantityToAdd;
                const errors = yield (0, class_validator_1.validate)(addToCartDto);
                if (errors.length > 0) {
                    // If quantityToAdd is not a number or less than 1, default to 1
                    if (typeof quantityToAdd !== 'number' || quantityToAdd < 1) {
                        addToCartDto.quantityToAdd = 1;
                    }
                    else {
                        res.status(400).json({ success: false, message: 'Invalid quantity to add.', errors: errors.map(err => err.constraints) });
                        return;
                    }
                }
                // Ensure quantityToAdd is at least 1 if it was valid but not provided
                const actualQuantityToAdd = addToCartDto.quantityToAdd || 1;
                // Find the registration with necessary relations
                const registration = yield RegistrationRepository_1.RegistrationRepository.getRepository().findOne({
                    where: { registrationId },
                    relations: ['ticketType', 'user', 'buyer', 'invoice']
                });
                if (!registration) {
                    res.status(404).json({ success: false, message: 'Registration not found.' });
                    return;
                }
                // Authorization Check - Only the buyer or authorized roles can add tickets to their cart
                // This is crucial: an admin/manager can add to anyone's cart, but a regular user
                // can only add to their own registration.
                if (!this.isAuthorizedForRegistration(loggedInUserId, loggedInUserRoles, registration)) {
                    res.status(403).json({ success: false, message: 'Forbidden: You do not have permission to modify tickets for this registration.' });
                    return;
                }
                // Ensure the registration is in a state where tickets can be added (e.g., not cancelled)
                if (registration.registrationStatus === 'cancelled' || registration.paymentStatus === 'completed' || registration.paymentStatus === 'paid') {
                    res.status(400).json({ success: false, message: `Cannot add tickets to a registration with status '${registration.registrationStatus}' or payment status '${registration.paymentStatus}'.` });
                    return;
                }
                const currentNoOfTickets = registration.noOfTickets;
                let newNoOfTickets = currentNoOfTickets + actualQuantityToAdd;
                let message = `Successfully added ${actualQuantityToAdd} ticket(s) to registration ${registrationId}.`;
                // Apply global maximum of 10 tickets per registration
                const GLOBAL_MAX_TICKETS_PER_REGISTRATION = 10;
                if (newNoOfTickets > GLOBAL_MAX_TICKETS_PER_REGISTRATION) {
                    newNoOfTickets = GLOBAL_MAX_TICKETS_PER_REGISTRATION;
                    message = `Added tickets. Reached maximum of ${GLOBAL_MAX_TICKETS_PER_REGISTRATION} tickets for registration ${registrationId}.`;
                }
                // Apply ticket type specific maximum quantity, if defined
                if (((_d = registration.ticketType) === null || _d === void 0 ? void 0 : _d.maxQuantity) && newNoOfTickets > registration.ticketType.maxQuantity) {
                    newNoOfTickets = registration.ticketType.maxQuantity;
                    message = `Added tickets. Reached maximum of ${registration.ticketType.maxQuantity} tickets for this ticket type.`;
                }
                // If no tickets were actually added due to limits
                if (newNoOfTickets === currentNoOfTickets) {
                    res.status(400).json({ success: false, message: 'No tickets were added as the maximum limit has already been reached.' });
                    return;
                }
                // Update Registration details
                registration.noOfTickets = newNoOfTickets;
                const ticketPricePerUnit = registration.ticketType ? parseFloat(registration.ticketType.price.toString()) : 0;
                registration.totalCost = parseFloat((newNoOfTickets * ticketPricePerUnit).toFixed(2));
                // Update linked invoice if it exists
                if (registration.invoice) {
                    registration.invoice.totalAmount = registration.totalCost; // Invoice total should reflect new total cost
                    yield Database_1.AppDataSource.getRepository(Invoice_1.Invoice).save(registration.invoice);
                }
                // Save the updated registration
                yield RegistrationRepository_1.RegistrationRepository.getRepository().save(registration);
                res.status(200).json({
                    success: true,
                    message: message,
                    data: {
                        registrationId: registration.registrationId,
                        newNoOfTickets: registration.noOfTickets,
                        newTotalCost: registration.totalCost
                    }
                });
            }
            catch (error) {
                console.error(`Error adding tickets to cart for registration ${req.params.id} by user ${loggedInUserId}:`, error);
                res.status(500).json({ success: false, message: 'Failed to add tickets to cart due to a server error.' });
            }
        });
    }
}
exports.TicketService = TicketService;
// DTO for validating the request body for cancellation
class CancelTicketsDto {
}
__decorate([
    (0, class_validator_1.IsArray)({ message: 'idsToCancel must be an array' }),
    (0, class_validator_1.ArrayNotEmpty)({ message: 'idsToCancel array cannot be empty' }),
    (0, class_validator_1.IsUUID)('4', { each: true, message: 'Each ID in idsToCancel must be a valid UUID' }),
    __metadata("design:type", Array)
], CancelTicketsDto.prototype, "idsToCancel", void 0);
// DTO for validating the request body for adding tickets to cart
class AddToCartTicketsDto {
}
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)({}, { message: 'quantityToAdd must be a number' }),
    (0, class_validator_1.Min)(1, { message: 'quantityToAdd must be at least 1' }),
    (0, class_validator_1.Max)(10, { message: 'quantityToAdd cannot exceed 10 in a single operation' }) // Optional: enforce max per operation
    ,
    __metadata("design:type", Number)
], AddToCartTicketsDto.prototype, "quantityToAdd", void 0);
