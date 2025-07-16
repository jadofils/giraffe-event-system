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
exports.TicketTypeRepository = void 0;
const Database_1 = require("../config/Database");
const TicketType_1 = require("../models/TicketType");
const Event_1 = require("../models/Event Tables/Event");
const User_1 = require("../models/User");
const typeorm_1 = require("typeorm");
const class_validator_1 = require("class-validator");
const CacheService_1 = require("../services/CacheService"); // Import CacheService
const EventStatusEnum_1 = require("../interfaces/Enums/EventStatusEnum"); // Ensure correct path
const TicketCategoryEnum_1 = require("../interfaces/Enums/TicketCategoryEnum"); // Ensure correct path
const ticketRelations = [
    "registrations",
    "event",
    "event.organization",
    "event.venues",
    "event.venueBookings",
    "event.registrations",
    "event.payments",
    "event.invoices",
    "organization",
];
class TicketTypeRepository {
    constructor() {
        this.repository = Database_1.AppDataSource.getRepository(TicketType_1.TicketType);
        this.eventRepository = Database_1.AppDataSource.getRepository(Event_1.Event);
        this.userRepository = Database_1.AppDataSource.getRepository(User_1.User);
        this.cacheService = new CacheService_1.CacheService(); // Initialize CacheService
    }
    /**
     * Creates a new TicketType record in the database.
     * Ensures only authorized users (event creator or organization member) can create tickets for approved events.
     * @param ticketType - The partial TicketType object containing data for creation.
     * @param userId - The ID of the logged-in user creating the ticket.
     * @returns An object indicating success, a message, and the created data if successful.
     */
    //get all tickets
    findAllTickects() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const tickets = yield this.repository.find({
                    where: { deletedAt: (0, typeorm_1.IsNull)() },
                    relations: ticketRelations,
                    order: { ticketName: "ASC" },
                });
                return {
                    success: true,
                    message: "Tickets fetched successfully.",
                    data: tickets,
                };
            }
            catch (error) {
                console.error("Error in TicketTypeRepository.findAllTickects:", error);
                return { success: false, message: "Failed to fetch tickets.", data: [] };
            }
        });
    }
    create(ticketType, userId) {
        return __awaiter(this, void 0, void 0, function* () {
            // --- Basic Validation ---
            if (!ticketType.ticketName) {
                return { success: false, message: "Ticket name is required." };
            }
            if (ticketType.price === undefined ||
                typeof ticketType.price !== "number" ||
                ticketType.price <= 0) {
                return {
                    success: false,
                    message: "Ticket price must be a positive number.",
                };
            }
            if (!ticketType.ticketCategory) {
                return { success: false, message: "Ticket category is required." };
            }
            if (!ticketType.eventId) {
                return { success: false, message: "Event ID is required." };
            }
            try {
                // --- Check if user exists and is logged in ---
                const user = yield this.userRepository.findOne({
                    where: { userId, deletedAt: (0, typeorm_1.IsNull)() },
                    relations: ["organizations"],
                });
                if (!user) {
                    return { success: false, message: "User not found or not logged in." };
                }
                // --- Check if event exists, is approved, and user is authorized ---
                const event = yield this.eventRepository.findOne({
                    where: {
                        eventId: ticketType.eventId,
                        deletedAt: (0, typeorm_1.IsNull)(),
                        status: EventStatusEnum_1.EventStatus.APPROVED,
                    },
                    relations: ["organization"],
                });
                if (!event) {
                    return {
                        success: false,
                        message: "Event not found, not approved, or deleted.",
                    };
                }
                // Check if user is the event creator or part of the event's organization
                const isCreator = event.createdByUserId === userId || event.organizerId === userId;
                const isInOrganization = user.organizations.some((org) => org.organizationId === event.organizationId);
                if (!isCreator && !isInOrganization) {
                    return {
                        success: false,
                        message: "Unauthorized: You cannot create tickets for this event.",
                    };
                }
                // --- Check for duplicate ticket name within the event ---
                const existingTicketType = yield this.repository.findOne({
                    where: {
                        ticketName: ticketType.ticketName,
                        eventId: ticketType.eventId,
                        deletedAt: (0, typeorm_1.IsNull)(),
                    },
                });
                if (existingTicketType) {
                    return {
                        success: false,
                        message: `Ticket type with name '${ticketType.ticketName}' already exists for this event.`,
                    };
                }
                // --- Validate TicketType entity ---
                const newTicketType = this.repository.create(ticketType);
                const validationErrors = yield (0, class_validator_1.validate)(newTicketType);
                if (validationErrors.length > 0) {
                    const errorMessages = validationErrors
                        .map((err) => Object.values(err.constraints || {}))
                        .flat();
                    return {
                        success: false,
                        message: `Validation failed: ${errorMessages.join(", ")}`,
                    };
                }
                // --- Save TicketType ---
                const saved = yield this.repository.save(newTicketType);
                // --- Fetch with relations for response ---
                const fullTicket = yield this.repository.findOne({
                    where: { ticketTypeId: saved.ticketTypeId },
                    relations: ticketRelations,
                });
                // --- Cache the ticket type ---
                yield CacheService_1.CacheService.set(`ticketType:${saved.ticketTypeId}`, fullTicket, 3600);
                yield CacheService_1.CacheService.invalidate(`ticketTypes:event:${ticketType.eventId}`);
                return {
                    success: true,
                    message: "Ticket type created successfully.",
                    data: fullTicket !== null && fullTicket !== void 0 ? fullTicket : undefined,
                };
            }
            catch (error) {
                console.error("Error in TicketTypeRepository.create:", error);
                return { success: false, message: "Failed to create ticket type." };
            }
        });
    }
    /**
     * Retrieves all active TicketType records for an event from the database, with caching.
     * @param eventId - The UUID of the event to fetch tickets for.
     * @returns An object indicating success, a message, and an array of TicketType data.
     */
    findAllByEvent(eventId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // --- Check cache first ---
                const cacheKey = `ticketTypes:event:${eventId}`;
                const cachedTickets = yield CacheService_1.CacheService.get(cacheKey);
                if (cachedTickets) {
                    return {
                        success: true,
                        message: "Ticket types fetched from cache.",
                        data: cachedTickets,
                    };
                }
                // --- Fetch from database ---
                const tickets = yield this.repository.find({
                    where: {
                        eventId,
                        deletedAt: (0, typeorm_1.IsNull)(),
                    },
                    relations: ticketRelations,
                    order: { ticketName: "ASC" },
                });
                // --- Cache the result ---
                yield CacheService_1.CacheService.set(cacheKey, tickets, 3600); // Cache for 1 hour
                return {
                    success: true,
                    message: "Ticket types fetched successfully.",
                    data: tickets,
                };
            }
            catch (error) {
                console.error("Error in TicketTypeRepository.findAllByEvent:", error);
                return {
                    success: false,
                    message: "Failed to fetch ticket types.",
                    data: [],
                };
            }
        });
    }
    /**
     * Finds a single active TicketType record by its ID, with caching.
     * @param ticketTypeId - The UUID of the ticket type to find.
     * @returns An object indicating success, a message, and the TicketType data if found.
     */
    findById(ticketTypeId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // --- Check cache first ---
                const cacheKey = `ticketType:${ticketTypeId}`;
                const cachedTicket = yield CacheService_1.CacheService.get(cacheKey);
                if (cachedTicket) {
                    return {
                        success: true,
                        message: "Ticket type fetched from cache.",
                        data: cachedTicket,
                    };
                }
                // --- Fetch from database ---
                const ticket = yield this.repository.findOne({
                    where: {
                        ticketTypeId,
                        deletedAt: (0, typeorm_1.IsNull)(),
                    },
                    relations: ticketRelations,
                });
                if (!ticket) {
                    return { success: false, message: "Ticket type found or is deleted." };
                }
                // --- Cache the ticket ---
                yield CacheService_1.CacheService.set(cacheKey, ticket, 3600); // Cache for 1 hour
                return { success: true, message: "Ticket type found.", data: ticket };
            }
            catch (error) {
                console.error("Error in TicketTypeRepository.findById:", error);
                return { success: false, message: "Failed to find ticket type." };
            }
        });
    }
    /**
     * Updates an existing TicketType record, invalidating cache.
     * @param ticketTypeId - The ID of the ticket type to update.
     * @param updateData - The partial data to apply.
     * @param userId - The ID of the user performing the update.
     * @returns An object indicating success, a message, and the updated ticket type.
     */
    update(ticketTypeId, updateData, userId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // --- Find the ticket type ---
                const { success, data: ticketType } = yield this.findById(ticketTypeId);
                if (!success || !ticketType) {
                    return { success: false, message: "Ticket type not found or deleted." };
                }
                // --- Check user authorization ---
                const event = yield this.eventRepository.findOne({
                    where: {
                        eventId: ticketType.eventId,
                        deletedAt: (0, typeorm_1.IsNull)(),
                        status: EventStatusEnum_1.EventStatus.APPROVED,
                    },
                    relations: ["organization"],
                });
                if (!event) {
                    return {
                        success: false,
                        message: "Event not found, not approved, or deleted.",
                    };
                }
                const user = yield this.userRepository.findOne({
                    where: { userId, deletedAt: (0, typeorm_1.IsNull)() },
                    relations: ["organizations"],
                });
                if (!user) {
                    return { success: false, message: "User not found." };
                }
                const isCreator = event.createdByUserId === userId || event.organizerId === userId;
                const isInOrganization = user.organizations.some((org) => org.organizationId === event.organizationId);
                if (!isCreator && !isInOrganization) {
                    return {
                        success: false,
                        message: "Unauthorized: You cannot update tickets for this event.",
                    };
                }
                // --- Validate updates ---
                if (updateData.price !== undefined &&
                    (typeof updateData.price !== "number" || updateData.price <= 0)) {
                    return {
                        success: false,
                        message: "Ticket price must be a positive number if provided.",
                    };
                }
                if (updateData.ticketCategory &&
                    !Object.values(TicketCategoryEnum_1.TicketCategory).includes(updateData.ticketCategory)) {
                    return { success: false, message: "Invalid ticket category provided." };
                }
                const updatedTicketType = this.repository.create(Object.assign(Object.assign({}, ticketType), updateData));
                const validationErrors = yield (0, class_validator_1.validate)(updatedTicketType);
                if (validationErrors.length > 0) {
                    const errorMessages = validationErrors
                        .map((err) => Object.values(err.constraints || {}))
                        .flat();
                    return {
                        success: false,
                        message: `Validation failed: ${errorMessages.join(", ")}`,
                    };
                }
                // --- Save updates ---
                Object.assign(ticketType, updateData);
                const updated = yield this.repository.save(ticketType);
                // Fetch with relations for response
                const fullTicket = yield this.repository.findOne({
                    where: { ticketTypeId: updated.ticketTypeId },
                    relations: ticketRelations,
                });
                yield CacheService_1.CacheService.set(`ticketType:${ticketTypeId}`, fullTicket, 3600);
                yield CacheService_1.CacheService.invalidate(`ticketTypes:event:${ticketType.eventId}`); // Invalidate event tickets cache
                return {
                    success: true,
                    message: "Ticket type updated successfully.",
                    data: fullTicket !== null && fullTicket !== void 0 ? fullTicket : undefined,
                };
            }
            catch (error) {
                console.error("Error in TicketTypeRepository.update:", error);
                return { success: false, message: "Failed to update ticket type." };
            }
        });
    }
    /**
     * Soft deletes a TicketType record, checking for active registrations and invalidating cache.
     * @param ticketTypeId - The UUID of the ticket type to delete.
     * @param userId - The ID of the user performing the deletion.
     * @returns An object indicating success and a message.
     */
    delete(ticketTypeId, userId) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                // --- Find the ticket type ---
                const { success, data: ticketType } = yield this.findById(ticketTypeId);
                if (!success || !ticketType) {
                    return {
                        success: false,
                        message: "Ticket type not found or already deleted.",
                    };
                }
                // --- Check user authorization ---
                const event = yield this.eventRepository.findOne({
                    where: {
                        eventId: ticketType.eventId,
                        deletedAt: (0, typeorm_1.IsNull)(),
                        status: EventStatusEnum_1.EventStatus.APPROVED,
                    },
                    relations: ["organization"],
                });
                if (!event) {
                    return {
                        success: false,
                        message: "Event not found, not approved, or deleted.",
                    };
                }
                const user = yield this.userRepository.findOne({
                    where: { userId, deletedAt: (0, typeorm_1.IsNull)() },
                    relations: ["organizations"],
                });
                if (!user) {
                    return { success: false, message: "User not found." };
                }
                const isCreator = event.createdByUserId === userId || event.organizerId === userId;
                const isInOrganization = user.organizations.some((org) => org.organizationId === event.organizationId);
                if (!isCreator && !isInOrganization) {
                    return {
                        success: false,
                        message: "Unauthorized: You cannot delete tickets for this event.",
                    };
                }
                // --- Check for active registrations ---
                const activeRegistrations = (_a = ticketType.registrations) === null || _a === void 0 ? void 0 : _a.filter((reg) => !reg.deletedAt);
                if (activeRegistrations && activeRegistrations.length > 0) {
                    return {
                        success: false,
                        message: `Cannot delete ticket type used in ${activeRegistrations.length} active registrations.`,
                    };
                }
                // --- Perform soft deletion ---
                ticketType.deletedAt = new Date();
                yield this.repository.save(ticketType);
                // --- Invalidate cache ---
                yield CacheService_1.CacheService.invalidate(`ticketType:${ticketTypeId}`);
                yield CacheService_1.CacheService.invalidate(`ticketTypes:event:${ticketType.eventId}`);
                return {
                    success: true,
                    message: "Ticket type soft-deleted successfully.",
                };
            }
            catch (error) {
                console.error("Error in TicketTypeRepository.delete:", error);
                return { success: false, message: "Failed to soft delete ticket type." };
            }
        });
    }
    updateIsActive(ticketTypeId, isActive, userId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Find the ticket type with all relations
                const { success, data: ticketType } = yield this.findById(ticketTypeId);
                if (!success || !ticketType) {
                    return {
                        success: false,
                        message: `Ticket type with ID '${ticketTypeId}' not found or deleted.`,
                    };
                }
                // Authorization: Only event creator or org member can update
                const event = yield this.eventRepository.findOne({
                    where: {
                        eventId: ticketType.eventId,
                        deletedAt: (0, typeorm_1.IsNull)(),
                        status: EventStatusEnum_1.EventStatus.APPROVED,
                    },
                    relations: ["organization"],
                });
                if (!event) {
                    return {
                        success: false,
                        message: "Event not found, not approved, or deleted.",
                    };
                }
                const user = yield this.userRepository.findOne({
                    where: { userId, deletedAt: (0, typeorm_1.IsNull)() },
                    relations: ["organizations"],
                });
                if (!user) {
                    return { success: false, message: "User not found." };
                }
                const isCreator = event.createdByUserId === userId || event.organizerId === userId;
                const isInOrganization = user.organizations.some((org) => org.organizationId === event.organizationId);
                if (!isCreator && !isInOrganization) {
                    return {
                        success: false,
                        message: "Unauthorized: You cannot update tickets for this event.",
                    };
                }
                // --- Time window check for activation ---
                const now = new Date();
                const { availableFrom, availableUntil } = ticketType;
                const canActivate = isActive
                    ? (!availableFrom || now >= new Date(availableFrom)) &&
                        (!availableUntil || now <= new Date(availableUntil))
                    : true;
                if (!canActivate) {
                    return {
                        success: false,
                        message: "Cannot activate: Ticket is not within available time window.",
                    };
                }
                // Update isActive
                ticketType.isActive = isActive;
                const updated = yield this.repository.save(ticketType);
                // Fetch with relations for response
                const fullTicket = yield this.repository.findOne({
                    where: { ticketTypeId: updated.ticketTypeId },
                    relations: ticketRelations,
                });
                yield CacheService_1.CacheService.set(`ticketType:${ticketTypeId}`, fullTicket, 3600);
                yield CacheService_1.CacheService.invalidate(`ticketTypes:event:${ticketType.eventId}`);
                return {
                    success: true,
                    message: "Ticket type isActive updated successfully.",
                    data: fullTicket !== null && fullTicket !== void 0 ? fullTicket : undefined,
                };
            }
            catch (error) {
                console.error("Error in TicketTypeRepository.updateIsActive:", error);
                return { success: false, message: "Failed to update isActive." };
            }
        });
    }
}
exports.TicketTypeRepository = TicketTypeRepository;
