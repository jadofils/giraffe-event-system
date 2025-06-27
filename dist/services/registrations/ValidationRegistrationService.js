"use strict";
// src/services/registrations/RegistrationService.ts
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
exports.RegistrationService = void 0;
const Event_1 = require("../../models/Event");
const User_1 = require("../../models/User");
const TicketType_1 = require("../../models/TicketType");
const Venue_1 = require("../../models/Venue");
const Registration_1 = require("../../models/Registration");
const Database_1 = require("../../config/Database");
const typeorm_1 = require("typeorm");
const Index_1 = require("../../interfaces/Index");
class RegistrationService {
    /**
     * Helper to ensure repositories are initialized.
     */
    static ensureRepositoriesInitialized() {
        if (!Database_1.AppDataSource.isInitialized) {
            throw new Error("Database connection not initialized.");
        }
        if (!RegistrationService.registrationRepository) {
            RegistrationService.registrationRepository =
                Database_1.AppDataSource.getRepository(Registration_1.Registration);
            RegistrationService.eventRepository = Database_1.AppDataSource.getRepository(Event_1.Event);
            RegistrationService.userRepository = Database_1.AppDataSource.getRepository(User_1.User);
            RegistrationService.ticketTypeRepository =
                Database_1.AppDataSource.getRepository(TicketType_1.TicketType);
            RegistrationService.venueRepository = Database_1.AppDataSource.getRepository(Venue_1.Venue);
        }
    }
    /**
     * Creates a new registration record in the database.
     */
    static createRegistration(data) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p;
            this.ensureRepositoriesInitialized();
            try {
                // Fetch related entities
                const [event, user, buyer, ticketType, venue] = yield Promise.all([
                    this.eventRepository.findOne({ where: { eventId: data.eventId } }),
                    this.userRepository.findOne({ where: { userId: data.userId } }),
                    this.userRepository.findOne({
                        where: { userId: data.buyerId },
                    }),
                    this.ticketTypeRepository.findOne({
                        where: { ticketTypeId: data.ticketTypeId },
                    }),
                    this.venueRepository.findOne({ where: { venueId: data.venueId } }),
                ]);
                if (!event || !user || !buyer || !ticketType || !venue) {
                    throw new Error("One or more required related entities (Event, User, Buyer, TicketType, Venue) not found during registration creation.");
                }
                // Calculate totalCost based on fetched ticketType price
                const totalCost = (data.noOfTickets || 0) * (ticketType.price || 0);
                // Create a new instance of the Registration entity
                const newRegistration = this.registrationRepository.create({
                    noOfTickets: data.noOfTickets,
                    registrationDate: data.registrationDate
                        ? new Date(data.registrationDate)
                        : new Date(),
                    paymentStatus: data.paymentStatus || Index_1.PaymentStatus.PENDING,
                    qrCode: data.qrCode,
                    checkDate: data.checkDate ? new Date(data.checkDate) : undefined,
                    attended: (_a = data.attended) !== null && _a !== void 0 ? _a : false,
                    boughtForIds: data.boughtForIds && data.boughtForIds.length > 0
                        ? data.boughtForIds
                        : [],
                    totalCost: totalCost,
                    registrationStatus: data.registrationStatus || "active",
                    event: event,
                    user: user,
                    buyer: buyer,
                    ticketType: ticketType,
                    venue: venue,
                    paymentId: data.paymentId,
                    invoiceId: data.invoiceId,
                });
                // Save the new registration to the database
                const savedRegistration = yield this.registrationRepository.save(newRegistration);
                // Re-fetch with relations
                const fullyPopulatedRegistration = yield this.registrationRepository.findOne({
                    where: { registrationId: savedRegistration.registrationId },
                    relations: [
                        "event",
                        "user",
                        "buyer",
                        "ticketType",
                        "venue",
                        "payment",
                        "invoice",
                    ],
                });
                if (!fullyPopulatedRegistration) {
                    throw new Error("Failed to retrieve fully populated registration after save.");
                }
                // Transform to response interface
                const response = {
                    registrationId: fullyPopulatedRegistration.registrationId,
                    event: {
                        eventId: fullyPopulatedRegistration.event.eventId,
                        eventTitle: fullyPopulatedRegistration.event.eventTitle,
                        description: fullyPopulatedRegistration.event.description,
                        eventType: fullyPopulatedRegistration.event.eventType,
                        organizerId: fullyPopulatedRegistration.event.organizationId,
                        venueId: (_c = (_b = fullyPopulatedRegistration.event.venues) === null || _b === void 0 ? void 0 : _b[0]) === null || _c === void 0 ? void 0 : _c.venueId,
                        maxAttendees: fullyPopulatedRegistration.event.maxAttendees,
                        status: fullyPopulatedRegistration.event.status,
                        isFeatured: fullyPopulatedRegistration.event.isFeatured,
                        qrCode: fullyPopulatedRegistration.event.qrCode,
                    },
                    user: {
                        userId: fullyPopulatedRegistration.user.userId,
                        username: fullyPopulatedRegistration.user.username,
                        firstName: fullyPopulatedRegistration.user.firstName,
                        lastName: fullyPopulatedRegistration.user.lastName,
                        email: fullyPopulatedRegistration.user.email,
                        phoneNumber: fullyPopulatedRegistration.user.phoneNumber,
                        createdAt: fullyPopulatedRegistration.user.createdAt,
                        updatedAt: fullyPopulatedRegistration.user.updatedAt,
                        deletedAt: fullyPopulatedRegistration.user.deletedAt,
                    },
                    buyer: {
                        userId: fullyPopulatedRegistration.buyer.userId,
                        username: fullyPopulatedRegistration.buyer.username,
                        firstName: fullyPopulatedRegistration.buyer.firstName,
                        lastName: fullyPopulatedRegistration.buyer.lastName,
                        email: fullyPopulatedRegistration.buyer.email,
                        phoneNumber: fullyPopulatedRegistration.buyer.phoneNumber,
                        createdAt: fullyPopulatedRegistration.buyer.createdAt,
                        updatedAt: fullyPopulatedRegistration.buyer.updatedAt,
                        deletedAt: fullyPopulatedRegistration.buyer.deletedAt,
                    },
                    boughtForIds: fullyPopulatedRegistration.boughtForIds || [],
                    ticketType: {
                        ticketTypeId: fullyPopulatedRegistration.ticketType.ticketTypeId,
                        ticketName: fullyPopulatedRegistration.ticketType.ticketName,
                        price: fullyPopulatedRegistration.ticketType.price,
                        ticketCategory: fullyPopulatedRegistration.ticketType.ticketCategory,
                        description: fullyPopulatedRegistration.ticketType.description,
                        promoName: fullyPopulatedRegistration.ticketType.promoName,
                        promoDescription: fullyPopulatedRegistration.ticketType.promoDescription,
                        capacity: fullyPopulatedRegistration.ticketType.capacity,
                        availableFrom: fullyPopulatedRegistration.ticketType.availableFrom,
                        availableUntil: fullyPopulatedRegistration.ticketType.availableUntil,
                        isActive: fullyPopulatedRegistration.ticketType.isActive,
                        minQuantity: fullyPopulatedRegistration.ticketType.minQuantity,
                        maxQuantity: fullyPopulatedRegistration.ticketType.maxQuantity,
                        requiresVerification: fullyPopulatedRegistration.ticketType.requiresVerification,
                        perks: fullyPopulatedRegistration.ticketType.perks,
                        createdAt: fullyPopulatedRegistration.ticketType.createdAt,
                        updatedAt: fullyPopulatedRegistration.ticketType.updatedAt,
                        deletedAt: fullyPopulatedRegistration.ticketType.deletedAt,
                    },
                    venue: {
                        venueId: fullyPopulatedRegistration.venue.venueId,
                        venueName: fullyPopulatedRegistration.venue.venueName,
                        capacity: fullyPopulatedRegistration.venue.capacity,
                        location: fullyPopulatedRegistration.venue.location,
                        managerId: fullyPopulatedRegistration.venue.managerId,
                        createdAt: (_d = fullyPopulatedRegistration.venue.createdAt) === null || _d === void 0 ? void 0 : _d.toISOString(),
                        updatedAt: (_e = fullyPopulatedRegistration.venue.updatedAt) === null || _e === void 0 ? void 0 : _e.toISOString(),
                        deletedAt: ((_f = fullyPopulatedRegistration.venue.deletedAt) === null || _f === void 0 ? void 0 : _f.toISOString()) ||
                            undefined,
                    },
                    noOfTickets: fullyPopulatedRegistration.noOfTickets,
                    registrationDate: fullyPopulatedRegistration.registrationDate.toISOString(),
                    paymentStatus: fullyPopulatedRegistration.paymentStatus,
                    qrCode: fullyPopulatedRegistration.qrCode || undefined,
                    checkDate: fullyPopulatedRegistration.checkDate
                        ? fullyPopulatedRegistration.checkDate.toISOString()
                        : undefined,
                    attended: fullyPopulatedRegistration.attended,
                    totalCost: fullyPopulatedRegistration.totalCost,
                    registrationStatus: fullyPopulatedRegistration.registrationStatus,
                    payment: fullyPopulatedRegistration.payment
                        ? {
                            paymentId: fullyPopulatedRegistration.payment.paymentId,
                            invoiceId: fullyPopulatedRegistration.payment.invoiceId,
                            paymentDate: ((_g = fullyPopulatedRegistration.payment) !== null && _g !== void 0 ? _g : {}) instanceof Date
                                ? fullyPopulatedRegistration.payment.paymentDate.toString()
                                : fullyPopulatedRegistration.payment.paymentDate,
                            paidAmount: fullyPopulatedRegistration.payment.paidAmount,
                            paymentMethod: fullyPopulatedRegistration.payment.paymentMethod,
                            paymentStatus: fullyPopulatedRegistration.payment.paymentStatus,
                            description: fullyPopulatedRegistration.payment.description,
                            createdAt: (_h = fullyPopulatedRegistration.payment.createdAt) === null || _h === void 0 ? void 0 : _h.toISOString(),
                            updatedAt: (_j = fullyPopulatedRegistration.payment.updatedAt) === null || _j === void 0 ? void 0 : _j.toISOString(),
                            deletedAt: ((_k = fullyPopulatedRegistration.payment.deletedAt) === null || _k === void 0 ? void 0 : _k.toISOString()) ||
                                undefined,
                            invoice: undefined,
                        }
                        : undefined,
                    invoice: fullyPopulatedRegistration.invoice
                        ? {
                            invoiceId: fullyPopulatedRegistration.invoice.invoiceId,
                            eventId: fullyPopulatedRegistration.invoice.eventId,
                            userId: fullyPopulatedRegistration.invoice.userId,
                            invoiceDate: (_l = fullyPopulatedRegistration.invoice.invoiceDate) === null || _l === void 0 ? void 0 : _l.toISOString(),
                            dueDate: (_m = fullyPopulatedRegistration.invoice.dueDate) === null || _m === void 0 ? void 0 : _m.toISOString(),
                            totalAmount: fullyPopulatedRegistration.invoice.totalAmount,
                            status: fullyPopulatedRegistration.invoice.status,
                            createdAt: (_o = fullyPopulatedRegistration.invoice.createdAt) === null || _o === void 0 ? void 0 : _o.toISOString(),
                            updatedAt: (_p = fullyPopulatedRegistration.invoice.updatedAt) === null || _p === void 0 ? void 0 : _p.toISOString(),
                            deletedAt: fullyPopulatedRegistration.invoice.deletedAt
                                ? fullyPopulatedRegistration.invoice.deletedAt.toISOString()
                                : undefined,
                        }
                        : undefined,
                    paymentId: fullyPopulatedRegistration.paymentId || undefined,
                    invoiceId: fullyPopulatedRegistration.invoiceId || undefined,
                    createdAt: fullyPopulatedRegistration.createdAt.toISOString(),
                    updatedAt: fullyPopulatedRegistration.updatedAt.toISOString(),
                    deletedAt: fullyPopulatedRegistration.deletedAt
                        ? fullyPopulatedRegistration.deletedAt.toISOString()
                        : undefined,
                };
                return response;
            }
            catch (error) {
                console.error("Error saving registration to database:", error);
                throw new Error(`Failed to create registration: ${error.message || "An unexpected database error occurred."}`);
            }
        });
    }
    /**
     * Validates that all referenced IDs in the registration data exist in the database.
     */
    static validateRegistrationIds(registrationData) {
        return __awaiter(this, void 0, void 0, function* () {
            this.ensureRepositoriesInitialized();
            const errors = [];
            const { eventId, ticketTypeId, venueId, noOfTickets } = registrationData;
            const userId = registrationData.userId;
            let buyerId = registrationData.buyerId;
            const boughtForIds = registrationData.boughtForIds || [];
            // Basic validation
            if (!eventId)
                errors.push("Event ID is required.");
            if (!ticketTypeId)
                errors.push("Ticket Type ID is required.");
            if (!venueId)
                errors.push("Venue ID is required.");
            if (noOfTickets === undefined ||
                typeof noOfTickets !== "number" ||
                noOfTickets <= 0) {
                errors.push("Number of tickets must be a positive number.");
            }
            if (!userId)
                errors.push("User ID (account owner) is required.");
            // Set default buyerId if not provided
            if (buyerId === null || buyerId === undefined) {
                buyerId = userId;
                registrationData.buyerId = userId;
            }
            if (errors.length > 0) {
                return {
                    valid: false,
                    message: `Validation failed: ${errors.join(" ")}`,
                    errors: errors,
                };
            }
            // Validate existence of IDs in DB
            const [event, user, actualBuyerUser, ticketType, venue] = yield Promise.all([
                this.eventRepository.findOne({ where: { eventId } }),
                this.userRepository.findOne({ where: { userId } }),
                this.userRepository.findOne({ where: { userId: buyerId } }),
                this.ticketTypeRepository.findOne({ where: { ticketTypeId } }),
                this.venueRepository.findOne({ where: { venueId } }),
            ]);
            if (!event)
                errors.push(`Event with ID '${eventId}' does not exist.`);
            if (!user)
                errors.push(`User (account owner) with ID '${userId}' does not exist.`);
            if (!actualBuyerUser)
                errors.push(`Buyer with ID '${buyerId}' does not exist.`);
            if (!ticketType)
                errors.push(`Ticket Type with ID '${ticketTypeId}' does not exist.`);
            if (!venue)
                errors.push(`Venue with ID '${venueId}' does not exist.`);
            if (errors.length > 0) {
                return {
                    valid: false,
                    message: `Validation failed: ${errors.join(" ")}`,
                    errors: errors,
                };
            }
            // --- CUSTOMIZED LOGIC BELOW ---
            // If boughtForIds is empty or not provided, tickets are for the logged-in user only
            if (!boughtForIds || boughtForIds.length === 0) {
                if (noOfTickets !== 1) {
                    errors.push("If no 'boughtForIds' are provided, you can only buy 1 ticket for yourself.");
                }
            }
            else {
                // If boughtForIds is provided, it must match the number of tickets
                const uniqueBoughtForIds = [...new Set(boughtForIds)];
                if (uniqueBoughtForIds.length !== noOfTickets) {
                    errors.push(`When 'boughtForIds' is provided, it must contain exactly ${noOfTickets} unique attendee IDs. Found: ${uniqueBoughtForIds.length}.`);
                }
                // Check that all boughtForIds exist as users
                const existingAttendees = yield this.userRepository.find({
                    where: { userId: (0, typeorm_1.In)(uniqueBoughtForIds) },
                });
                if (existingAttendees.length !== uniqueBoughtForIds.length) {
                    const foundIds = existingAttendees.map((u) => u.userId);
                    const notFound = uniqueBoughtForIds.filter((id) => !foundIds.includes(id));
                    errors.push(`Attendee User(s) with ID(s) '${notFound.join(", ")}' specified in 'boughtForIds' do not exist.`);
                }
            }
            return {
                valid: errors.length === 0,
                message: errors.length > 0
                    ? `Validation failed: ${errors.join(" ")}`
                    : undefined,
                errors: errors.length > 0 ? errors : undefined,
            };
        });
    }
    /**
     * Checks if a user with the given `userId` exists in the database.
     */
    static checkUserExists(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            this.ensureRepositoriesInitialized();
            try {
                const user = yield this.userRepository.findOne({
                    where: { userId: userId },
                });
                return !!user;
            }
            catch (error) {
                console.error(`Error checking if user ${userId} exists:`, error);
                return false;
            }
        });
    }
    /**
     * Validates if there's enough capacity at the venue for the requested number of tickets for an event.
     */
    static validateEventCapacity(eventId, venueId, requestedTickets) {
        return __awaiter(this, void 0, void 0, function* () {
            this.ensureRepositoriesInitialized();
            try {
                const venue = yield this.venueRepository.findOne({ where: { venueId } });
                if (!venue) {
                    return {
                        valid: false,
                        message: `Venue with ID '${venueId}' does not exist.`,
                    };
                }
                const event = yield this.eventRepository.findOne({ where: { eventId } });
                if (!event) {
                    return {
                        valid: false,
                        message: `Event with ID '${eventId}' does not exist.`,
                    };
                }
                // Get total tickets sold for this event with 'COMPLETED' payment status
                const totalTicketsSoldResult = yield this.registrationRepository
                    .createQueryBuilder("registration")
                    .select("SUM(registration.noOfTickets)", "sum")
                    .where("registration.eventId = :eventId", { eventId })
                    .andWhere("registration.paymentStatus = :status", {
                    status: Index_1.PaymentStatus.COMPLETED,
                })
                    .getRawOne();
                const ticketsSold = parseInt((totalTicketsSoldResult === null || totalTicketsSoldResult === void 0 ? void 0 : totalTicketsSoldResult.sum) || "0", 10);
                const remainingCapacity = venue.capacity - ticketsSold;
                if (requestedTickets > remainingCapacity) {
                    return {
                        valid: false,
                        message: `Not enough capacity. Only ${remainingCapacity} tickets left for event '${event.eventTitle}'.`,
                    };
                }
                return { valid: true };
            }
            catch (error) {
                console.error("Error validating event capacity:", error);
                return {
                    valid: false,
                    message: "An error occurred while checking event capacity.",
                };
            }
        });
    }
    /**
     * FIXED: Validates if there are duplicate registrations for the given event and attendees.
     * This method now correctly identifies actual attendees based on the business rules.
     */
    static validateDuplicateRegistration(eventId, primaryUserId, buyerId, boughtForIds) {
        return __awaiter(this, void 0, void 0, function* () {
            this.ensureRepositoriesInitialized();
            try {
                // Determine who will actually be attending this event based on business rules
                const actualAttendees = new Set();
                // Rule: buyerId is always an attendee (they get a ticket)
                actualAttendees.add(buyerId);
                // Rule: boughtForIds are additional attendees (if any)
                if (boughtForIds && boughtForIds.length > 0) {
                    boughtForIds.forEach((id) => actualAttendees.add(id));
                }
                // Convert to array for database query
                const attendeeIdsToCheck = Array.from(actualAttendees);
                console.log(`Checking for duplicate registrations for event ${eventId}`);
                console.log(`Actual attendees to check: ${attendeeIdsToCheck.join(", ")}`);
                console.log(`Primary user ID (account owner): ${primaryUserId} - NOT checked for duplicates unless they are an attendee`);
                // Query for existing registrations where any of our actual attendees are already registered
                const existingRegistrations = yield this.registrationRepository
                    .createQueryBuilder("registration")
                    .leftJoinAndSelect("registration.user", "user")
                    .leftJoinAndSelect("registration.buyer", "buyer")
                    .where("registration.eventId = :eventId", { eventId })
                    .andWhere(
                // Check if any of our attendees are already registered as:
                // 1. A buyer in another registration
                // 2. Someone in a boughtForIds array in another registration
                "(buyer.userId IN (:...attendeeIds) OR registration.boughtForIds && ARRAY[:...attendeeIds]::uuid[])", { attendeeIds: attendeeIdsToCheck })
                    // Optionally filter by active registrations only
                    .andWhere("registration.registrationStatus IN (:...activeStatuses)", {
                    activeStatuses: ["active", "completed"],
                })
                    .getMany();
                if (existingRegistrations.length > 0) {
                    const duplicatedUserIds = [];
                    existingRegistrations.forEach((reg) => {
                        // Check if any of our attendees is the buyer in an existing registration
                        if (reg.buyer && attendeeIdsToCheck.includes(reg.buyer.userId)) {
                            duplicatedUserIds.push(reg.buyer.userId);
                        }
                        // Check if any of our attendees is in the boughtForIds of an existing registration
                        if (reg.boughtForIds && reg.boughtForIds.length > 0) {
                            reg.boughtForIds.forEach((boughtForId) => {
                                if (attendeeIdsToCheck.includes(boughtForId)) {
                                    duplicatedUserIds.push(boughtForId);
                                }
                            });
                        }
                    });
                    const uniqueDuplicatedUserIds = [...new Set(duplicatedUserIds)];
                    if (uniqueDuplicatedUserIds.length > 0) {
                        return {
                            valid: false,
                            message: `The following user(s) are already registered for event ID '${eventId}': ${uniqueDuplicatedUserIds.join(", ")}.`,
                        };
                    }
                }
                return { valid: true };
            }
            catch (error) {
                console.error("Error validating duplicate registration:", error);
                return {
                    valid: false,
                    message: "An error occurred while checking for duplicate registrations.",
                };
            }
        });
    }
    /**
     * Validates the ticket type and quantity, then calculates the total cost.
     */
    static validateAndCalculateTicketCost(ticketTypeId, quantity) {
        return __awaiter(this, void 0, void 0, function* () {
            this.ensureRepositoriesInitialized();
            try {
                const ticketType = yield this.ticketTypeRepository.findOne({
                    where: { ticketTypeId },
                });
                if (!ticketType) {
                    return {
                        valid: false,
                        message: `Ticket Type with ID '${ticketTypeId}' does not exist.`,
                    };
                }
                if (quantity <= 0) {
                    return { valid: false, message: "Quantity must be a positive number." };
                }
                const totalCost = ticketType.price * quantity;
                return { valid: true, totalCost, ticketType };
            }
            catch (error) {
                console.error("Error validating ticket cost:", error);
                return {
                    valid: false,
                    message: "An error occurred while calculating ticket cost.",
                };
            }
        });
    }
}
exports.RegistrationService = RegistrationService;
