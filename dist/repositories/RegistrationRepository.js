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
exports.RegistrationRepository = void 0;
const Database_1 = require("../config/Database");
const Registration_1 = require("../models/Registration");
const QrCodeService_1 = require("../services/registrations/QrCodeService");
const Event_1 = require("../models/Event");
const User_1 = require("../models/User");
const TicketType_1 = require("../models/TicketType");
const Venue_1 = require("../models/Venue Tables/Venue");
class RegistrationRepository {
    // Get repository using the initialized AppDataSource
    static getRepository() {
        if (!Database_1.AppDataSource.isInitialized) {
            throw new Error("AppDataSource is not initialized. Call AppDataSource.initialize() first.");
        }
        return Database_1.AppDataSource.getRepository(Registration_1.Registration);
    }
    // Create a new registration
    static create(registrationData) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const repository = this.getRepository();
                // Fetch related entities
                const event = yield Database_1.AppDataSource.getRepository(Event_1.Event).findOne({
                    where: { eventId: registrationData.eventId },
                });
                const user = yield Database_1.AppDataSource.getRepository(User_1.User).findOne({
                    where: { userId: registrationData.userId },
                });
                const buyer = registrationData.buyerId
                    ? yield Database_1.AppDataSource.getRepository(User_1.User).findOne({
                        where: { userId: registrationData.buyerId },
                    })
                    : user; // Default to user if buyerId not provided
                const ticketType = yield Database_1.AppDataSource.getRepository(TicketType_1.TicketType).findOne({
                    where: { ticketTypeId: registrationData.ticketTypeId },
                });
                const venue = yield Database_1.AppDataSource.getRepository(Venue_1.Venue).findOne({
                    where: { venueId: registrationData.venueId },
                });
                if (!event || !user || !buyer || !ticketType || !venue) {
                    throw new Error("Missing required entity for registration after validation.");
                }
                // Create new registration instance
                const registration = repository.create({
                    registrationId: registrationData.registrationId,
                    event,
                    user,
                    buyer,
                    boughtForIds: registrationData.boughtForIds || [],
                    ticketType,
                    venue,
                    noOfTickets: registrationData.noOfTickets,
                    registrationDate: registrationData.registrationDate
                        ? new Date(registrationData.registrationDate)
                        : new Date(),
                    paymentStatus: registrationData.paymentStatus,
                    qrCode: registrationData.qrCode,
                    checkDate: registrationData.checkDate
                        ? new Date(registrationData.checkDate)
                        : undefined,
                    attended: registrationData.attended || false,
                    totalCost: registrationData.totalCost,
                    registrationStatus: registrationData.registrationStatus || "active",
                    paymentId: registrationData.paymentId,
                    invoiceId: registrationData.invoiceId,
                });
                return yield repository.save(registration);
            }
            catch (error) {
                console.error("Error creating registration:", error);
                throw error;
            }
        });
    }
    // Find all registrations
    static findAll() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const repository = this.getRepository();
                return yield repository.find({
                    relations: ["event", "user", "buyer", "ticketType", "venue"],
                });
            }
            catch (error) {
                console.error("Error finding all registrations:", error);
                throw error;
            }
        });
    }
    // Find registration by ID
    static findById(registrationId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const repository = this.getRepository();
                const registration = yield repository.findOne({
                    where: { registrationId },
                    relations: ["event", "user", "buyer", "ticketType", "venue"],
                });
                return registration || null;
            }
            catch (error) {
                console.error(`Error finding registration by ID ${registrationId}:`, error);
                throw error;
            }
        });
    }
    // Update a registration
    static update(registrationId, updateData) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const repository = this.getRepository();
                const registration = yield this.findById(registrationId);
                if (!registration) {
                    return null;
                }
                // Fetch related entities if their IDs are provided
                if (updateData.eventId) {
                    registration.event =
                        (yield Database_1.AppDataSource.getRepository(Event_1.Event).findOne({
                            where: { eventId: updateData.eventId },
                        })) || registration.event;
                }
                if (updateData.userId) {
                    registration.user =
                        (yield Database_1.AppDataSource.getRepository(User_1.User).findOne({
                            where: { userId: updateData.userId },
                        })) || registration.user;
                }
                if (updateData.buyerId) {
                    registration.buyer =
                        (yield Database_1.AppDataSource.getRepository(User_1.User).findOne({
                            where: { userId: updateData.buyerId },
                        })) || registration.buyer;
                }
                if (updateData.ticketTypeId) {
                    registration.ticketType =
                        (yield Database_1.AppDataSource.getRepository(TicketType_1.TicketType).findOne({
                            where: { ticketTypeId: updateData.ticketTypeId },
                        })) || registration.ticketType;
                }
                if (updateData.venueId) {
                    registration.venue =
                        (yield Database_1.AppDataSource.getRepository(Venue_1.Venue).findOne({
                            where: { venueId: updateData.venueId },
                        })) || registration.venue;
                }
                // Update primitive fields
                if (updateData.boughtForIds !== undefined)
                    registration.boughtForIds = updateData.boughtForIds;
                if (updateData.noOfTickets !== undefined)
                    registration.noOfTickets = updateData.noOfTickets;
                if (updateData.registrationDate)
                    registration.registrationDate = new Date(updateData.registrationDate);
                if (updateData.paymentStatus)
                    registration.paymentStatus = updateData.paymentStatus;
                if (updateData.qrCode)
                    registration.qrCode = updateData.qrCode;
                if (updateData.checkDate !== undefined)
                    registration.checkDate = new Date(updateData.checkDate);
                if (updateData.attended !== undefined)
                    registration.attended = updateData.attended;
                if (updateData.totalCost !== undefined)
                    registration.totalCost = updateData.totalCost;
                if (updateData.registrationStatus)
                    registration.registrationStatus = updateData.registrationStatus;
                if (updateData.paymentId !== undefined)
                    registration.paymentId = updateData.paymentId;
                if (updateData.invoiceId !== undefined)
                    registration.invoiceId = updateData.invoiceId;
                return yield repository.save(registration);
            }
            catch (error) {
                console.error(`Error updating registration ${registrationId}:`, error);
                throw error;
            }
        });
    }
    // Delete a registration
    static delete(registrationId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const repository = this.getRepository();
                const result = yield repository.delete(registrationId);
                return typeof result.affected === "number" && result.affected > 0;
            }
            catch (error) {
                console.error(`Error deleting registration ${registrationId}:`, error);
                throw error;
            }
        });
    }
    // Find registrations by event ID
    static findByEventId(eventId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const repository = this.getRepository();
                return yield repository.find({
                    where: { event: { eventId } },
                    relations: ["event", "user", "buyer", "ticketType", "venue"],
                });
            }
            catch (error) {
                console.error(`Error finding registrations for event ${eventId}:`, error);
                throw error;
            }
        });
    }
    // Find registration by QR code
    static findByQRCode(rawQrCodeDataString) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const qrPayload = yield QrCodeService_1.QrCodeService.validateQrCode(rawQrCodeDataString);
                if (!qrPayload) {
                    return null;
                }
                const { registrationId } = qrPayload;
                return yield this.findById(registrationId);
            }
            catch (error) {
                console.error(`Error finding registration by QR code:`, error);
                return null;
            }
        });
    }
}
exports.RegistrationRepository = RegistrationRepository;
