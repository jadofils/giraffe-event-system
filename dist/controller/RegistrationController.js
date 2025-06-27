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
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.RegistrationController = void 0;
const RegistrationRepository_1 = require("../repositories/RegistrationRepository");
const uuid_1 = require("uuid");
const ValidationRegistrationService_1 = require("../services/registrations/ValidationRegistrationService");
const QrCodeService_1 = require("../services/registrations/QrCodeService");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const PaymentStatusEnum_1 = require("../interfaces/Enums/PaymentStatusEnum");
const Database_1 = require("../config/Database");
const User_1 = require("../models/User");
class RegistrationController {
    // Create Registration
    static createRegistration(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            var _b, _c, _d, _e, _f, _g;
            try {
                const registrationData = Object.assign({}, req.body);
                const loggedInUserId = (_b = req.user) === null || _b === void 0 ? void 0 : _b.userId;
                if (!loggedInUserId) {
                    res.status(401).json({ success: false, message: 'Unauthorized: User information missing.' });
                    return;
                }
                // Remove userId from body if present
                delete registrationData.userId;
                // Always use userId from token
                const userId = loggedInUserId;
                const buyerId = (_c = registrationData.buyerId) !== null && _c !== void 0 ? _c : loggedInUserId;
                const registrationId = (0, uuid_1.v4)();
                // Ensure noOfTickets is provided
                if (registrationData.noOfTickets === undefined || registrationData.noOfTickets === null) {
                    res.status(400).json({ success: false, message: 'Number of tickets (noOfTickets) is required.' });
                    return;
                }
                const dataForService = Object.assign(Object.assign({}, registrationData), { registrationId,
                    userId, // always from token
                    buyerId, paymentStatus: registrationData.paymentStatus || PaymentStatusEnum_1.PaymentStatus.PENDING, attended: registrationData.attended || false, boughtForIds: registrationData.boughtForIds || [], eventId: (_d = registrationData.eventId) !== null && _d !== void 0 ? _d : '', ticketTypeId: (_e = registrationData.ticketTypeId) !== null && _e !== void 0 ? _e : '', venueId: (_f = registrationData.venueId) !== null && _f !== void 0 ? _f : '', noOfTickets: Number(registrationData.noOfTickets), registrationDate: registrationData.registrationDate || new Date().toISOString() });
                // Step 1: Validate IDs
                const validationResult = yield ValidationRegistrationService_1.RegistrationService.validateRegistrationIds(dataForService);
                if (!validationResult.valid) {
                    res.status(400).json({
                        success: false,
                        message: validationResult.message,
                        errors: validationResult.errors,
                    });
                    return;
                }
                // Step 2: Validate event capacity
                const capacityValidation = yield ValidationRegistrationService_1.RegistrationService.validateEventCapacity(dataForService.eventId, dataForService.venueId, dataForService.noOfTickets);
                if (!capacityValidation.valid) {
                    res.status(400).json({
                        success: false,
                        message: capacityValidation.message,
                    });
                    return;
                }
                // Step 3: Validate ticket cost
                const ticketCostValidation = yield ValidationRegistrationService_1.RegistrationService.validateAndCalculateTicketCost(dataForService.ticketTypeId, dataForService.noOfTickets);
                if (!ticketCostValidation.valid || ticketCostValidation.totalCost === undefined) {
                    res.status(400).json({
                        success: false,
                        message: ticketCostValidation.message || 'Could not validate ticket type or calculate cost.',
                    });
                    return;
                }
                dataForService.totalCost = ticketCostValidation.totalCost;
                // Step 4: Check for duplicates
                const duplicateValidation = yield ValidationRegistrationService_1.RegistrationService.validateDuplicateRegistration(dataForService.eventId, dataForService.userId, (_g = dataForService.buyerId) !== null && _g !== void 0 ? _g : '', dataForService.boughtForIds);
                if (!duplicateValidation.valid) {
                    res.status(400).json({
                        success: false,
                        message: duplicateValidation.message,
                    });
                    return;
                }
                // Only now create the registration
                const registration = yield ValidationRegistrationService_1.RegistrationService.createRegistration(dataForService);
                res.status(201).json({ success: true, data: registration });
            }
            catch (error) {
                console.error('Error creating registration:', error);
                res.status(500).json({
                    success: false,
                    message: 'Failed to create registration due to an unexpected server error.',
                    error: error.message,
                });
            }
        });
    }
    // Get all registrations
    static getAllRegistrations(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const registrations = yield RegistrationRepository_1.RegistrationRepository.findAll();
                res.status(200).json({ success: true, data: registrations });
            }
            catch (error) {
                console.error('Error getting all registrations:', error);
                res.status(500).json({ success: false, message: 'Failed to retrieve registrations.' });
            }
        });
    }
    // Get ticket cost summary for a user
    static getUserTicketCostSummary(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            var _b, _c;
            const loggedInUserId = (_b = req.user) === null || _b === void 0 ? void 0 : _b.userId;
            const loggedInUserRoles = ((_c = req.user) === null || _c === void 0 ? void 0 : _c.role) ? [req.user.role] : [];
            const { userId: targetUserId } = req.params;
            try {
                if (!loggedInUserId) {
                    res.status(401).json({ success: false, message: 'Unauthorized: User information missing.' });
                    return;
                }
                if (!targetUserId) {
                    res.status(400).json({ success: false, message: 'Target user ID is required.' });
                    return;
                }
                const targetUser = yield Database_1.AppDataSource.getRepository(User_1.User).findOne({ where: { userId: targetUserId } });
                if (!targetUser) {
                    res.status(404).json({ success: false, message: 'Target user not found.' });
                    return;
                }
                const normalizedRoles = loggedInUserRoles.map((role) => typeof role === 'string' ? role.toLowerCase() : (role.roleName ? role.roleName.toLowerCase() : ''));
                const hasAdminAccess = normalizedRoles.includes('admin');
                const hasManagerAccess = normalizedRoles.includes('manager');
                const isSelfAccess = loggedInUserId === targetUserId;
                let hasBuyerAccess = false;
                if (normalizedRoles.includes('buyer')) {
                    const buyerRegistrations = yield RegistrationRepository_1.RegistrationRepository.getRepository().find({
                        where: [
                            { buyer: { userId: loggedInUserId }, user: { userId: targetUserId } },
                            { buyer: { userId: loggedInUserId } },
                        ],
                        relations: ['buyer', 'user'],
                    });
                    hasBuyerAccess = buyerRegistrations.some(reg => reg.buyer.userId === loggedInUserId &&
                        (reg.user.userId === targetUserId || (reg.boughtForIds && reg.boughtForIds.includes(targetUserId))));
                }
                if (!hasAdminAccess && !hasManagerAccess && !isSelfAccess && !hasBuyerAccess) {
                    res.status(403).json({ success: false, message: 'Forbidden: You do not have permission to view this user\'s ticket cost summary.' });
                    return;
                }
                const registrations = yield RegistrationRepository_1.RegistrationRepository.getRepository().find({
                    where: [
                        { user: { userId: targetUserId } },
                        { buyer: { userId: targetUserId } },
                    ],
                    relations: ['event', 'user', 'buyer', 'ticketType', 'venue', 'payment'],
                    order: { registrationDate: 'DESC' },
                });
                const additionalRegistrations = yield RegistrationRepository_1.RegistrationRepository.getRepository()
                    .createQueryBuilder('registration')
                    .leftJoinAndSelect('registration.event', 'event')
                    .leftJoinAndSelect('registration.user', 'user')
                    .leftJoinAndSelect('registration.buyer', 'buyer')
                    .leftJoinAndSelect('registration.ticketType', 'ticketType')
                    .leftJoinAndSelect('registration.venue', 'venue')
                    .leftJoinAndSelect('registration.payment', 'payment')
                    .where('registration.boughtForIds @> ARRAY[:userId]::uuid[]', { userId: targetUserId })
                    .getMany();
                const allRegistrations = [...registrations, ...additionalRegistrations].filter((reg, index, arr) => arr.findIndex(r => r.registrationId === reg.registrationId) === index);
                let totalTickets = 0;
                let totalCost = 0;
                let totalPaid = 0;
                let totalPending = 0;
                let totalRefunded = 0;
                const registrationSummaries = allRegistrations.map(registration => {
                    var _b;
                    const ticketPrice = registration.ticketType ? parseFloat(registration.ticketType.price.toString()) : 0;
                    const regTotalCost = ticketPrice * registration.noOfTickets;
                    totalTickets += registration.noOfTickets;
                    totalCost += regTotalCost;
                    switch ((_b = registration.paymentStatus) === null || _b === void 0 ? void 0 : _b.toLowerCase()) {
                        case 'completed':
                        case 'paid':
                            totalPaid += regTotalCost;
                            break;
                        case 'pending':
                            totalPending += regTotalCost;
                            break;
                        case 'refunded':
                            totalRefunded += regTotalCost;
                            break;
                    }
                    return {
                        registrationId: registration.registrationId,
                        eventId: registration.eventId,
                        eventName: registration.event.eventTitle,
                        eventDate: registration.event.createdAt,
                        ticketType: registration.ticketType.ticketName,
                        noOfTickets: registration.noOfTickets,
                        ticketPrice: ticketPrice,
                        totalCost: regTotalCost,
                        paymentStatus: registration.paymentStatus,
                        registrationStatus: registration.registrationStatus,
                        registrationDate: registration.registrationDate,
                        isPrimaryAttendee: registration.user.userId === targetUserId,
                        isBuyer: registration.buyer.userId === targetUserId,
                        isInBoughtForIds: registration.boughtForIds ? registration.boughtForIds.includes(targetUserId) : false,
                    };
                });
                const summary = {
                    targetUser: {
                        userId: targetUser.userId,
                        fullName: targetUser.lastName,
                        email: targetUser.email,
                    },
                    totalRegistrations: allRegistrations.length,
                    totalTickets,
                    totalCost: parseFloat(totalCost.toFixed(2)),
                    totalPaid: parseFloat(totalPaid.toFixed(2)),
                    totalPending: parseFloat(totalPending.toFixed(2)),
                    totalRefunded: parseFloat(totalRefunded.toFixed(2)),
                    registrations: registrationSummaries,
                };
                res.status(200).json({
                    success: true,
                    message: 'User ticket cost summary retrieved successfully.',
                    data: summary,
                });
            }
            catch (error) {
                console.error(`Error getting ticket cost summary for user ${targetUserId}:`, error);
                res.status(500).json({ success: false, message: 'Failed to retrieve ticket cost summary.' });
            }
        });
    }
    // Update registration
    static updateRegistration(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const registrationId = req.params.id;
                const updateData = req.body;
                const validationResult = yield ValidationRegistrationService_1.RegistrationService.validateRegistrationIds(updateData);
                if (!validationResult.valid) {
                    res.status(400).json({
                        success: false,
                        message: validationResult.message,
                        errors: validationResult.errors,
                    });
                    return;
                }
                const updatedRegistration = yield RegistrationRepository_1.RegistrationRepository.update(registrationId, updateData);
                if (!updatedRegistration) {
                    res.status(404).json({ success: false, message: 'Registration not found.' });
                    return;
                }
                res.status(200).json({ success: true, data: updatedRegistration });
            }
            catch (error) {
                console.error('Error updating registration:', error);
                res.status(500).json({ success: false, message: 'Failed to update registration.' });
            }
        });
    }
    // Delete registration
    static deleteRegistration(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            const { registrationId } = req.params;
            try {
                if (!registrationId) {
                    res.status(400).json({ success: false, message: 'Registration ID is required.' });
                    return;
                }
                const success = yield RegistrationRepository_1.RegistrationRepository.delete(registrationId);
                if (success) {
                    res.status(200).json({ success: true, message: 'Registration deleted successfully.' });
                }
                else {
                    res.status(404).json({ success: false, message: 'Registration not found or could not be deleted.' });
                }
            }
            catch (error) {
                console.error(`Error deleting registration ${registrationId}:`, error);
                res.status(500).json({ success: false, message: 'Failed to delete registration.' });
            }
        });
    }
    // Get QR code path
    static getRegistrationQrCode(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { id } = req.params;
                const registration = yield RegistrationRepository_1.RegistrationRepository.findById(id);
                if (!registration || !registration.qrCode) {
                    res.status(404).json({ success: false, message: 'Registration or QR code not found.' });
                    return;
                }
                res.status(200).json({
                    success: true,
                    message: 'QR code path retrieved successfully.',
                    qrCodePath: registration.qrCode,
                    qrCodeUrl: `/static/${registration.qrCode}`,
                });
            }
            catch (error) {
                console.error(`Error getting QR code path for registration ${req.params.id}:`, error);
                res.status(500).json({ success: false, message: 'Failed to retrieve QR code path.' });
            }
        });
    }
    // Serve QR code image
    static getRegistrationQrCodeImage(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { id } = req.params;
                const registration = yield RegistrationRepository_1.RegistrationRepository.findById(id);
                if (!registration || !registration.qrCode) {
                    res.status(404).json({ success: false, message: 'QR code not found for this registration.' });
                    return;
                }
                const QR_CODES_UPLOAD_BASE_DIR = path_1.default.join(__dirname, '..', '..', 'src', 'Uploads', 'qrcodes');
                const absolutePath = path_1.default.join(QR_CODES_UPLOAD_BASE_DIR, registration.qrCode);
                if (!fs_1.default.existsSync(absolutePath)) {
                    console.error(`QR code image file not found at: ${absolutePath}`);
                    res.status(404).json({ success: false, message: 'QR code image file not found on server.' });
                    return;
                }
                res.sendFile(absolutePath);
            }
            catch (error) {
                console.error(`Error retrieving QR code image for registration ${req.params.id}:`, error);
                res.status(500).json({ success: false, message: 'Failed to retrieve QR code image.' });
            }
        });
    }
}
exports.RegistrationController = RegistrationController;
_a = RegistrationController;
// Regenerate QR code
RegistrationController.regenerateQrCode = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id: registrationId } = req.params;
        const existingRegistration = yield RegistrationRepository_1.RegistrationRepository.findById(registrationId);
        if (!existingRegistration) {
            res.status(404).json({ success: false, message: 'Registration not found.' });
            return;
        }
        if (existingRegistration.qrCode) {
            const oldQrCodePath = path_1.default.join(__dirname, '..', '..', 'src', 'Uploads', 'qrcodes', existingRegistration.qrCode);
            if (fs_1.default.existsSync(oldQrCodePath)) {
                fs_1.default.unlinkSync(oldQrCodePath);
                console.log(`Deleted old QR code file: ${oldQrCodePath}`);
            }
        }
        const newQrCodeFileName = yield QrCodeService_1.QrCodeService.generateQrCode(existingRegistration.registrationId, existingRegistration.user.userId, existingRegistration.event.eventId);
        const updatedRegistration = yield RegistrationRepository_1.RegistrationRepository.update(registrationId, { qrCode: newQrCodeFileName });
        if (!updatedRegistration) {
            throw new Error('Failed to update registration with new QR code path.');
        }
        res.status(200).json({
            success: true,
            message: 'QR code regenerated successfully.',
            data: updatedRegistration,
            qrCodeUrl: `/static/${newQrCodeFileName}`,
        });
    }
    catch (error) {
        console.error(`Error regenerating QR code for registration ${req.params.id}:`, error);
        res.status(500).json({ success: false, message: 'Failed to regenerate QR code.' });
    }
});
// Validate QR code
RegistrationController.validateQrCode = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { qrCode } = req.params;
        if (!qrCode) {
            res.status(400).json({ success: false, message: 'QR code string is required.' });
            return;
        }
        const registration = yield RegistrationRepository_1.RegistrationRepository.findByQRCode(qrCode);
        if (!registration) {
            res.status(404).json({ success: false, message: 'Invalid or expired QR code, or registration not found.' });
            return;
        }
        res.status(200).json({
            success: true,
            message: 'QR code validated successfully.',
            data: registration,
        });
    }
    catch (error) {
        console.error(`Error validating QR code:`, error);
        res.status(500).json({ success: false, message: 'Failed to validate QR code.' });
    }
});
