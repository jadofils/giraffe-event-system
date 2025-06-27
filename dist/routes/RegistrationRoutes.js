"use strict";
//@ts-check
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
const express_1 = __importDefault(require("express"));
const TicketService_1 = require("../services/registrations/TicketService");
const RegistrationController_1 = require("../controller/RegistrationController");
const IsAdmin_1 = require("../middlewares/IsAdmin");
const AuthMiddleware_1 = require("../middlewares/AuthMiddleware");
const RegistrationRepository_1 = require("../repositories/RegistrationRepository"); // <--- ADD THIS IMPORT
const router = express_1.default.Router();
// Core Registration Management
router.post('/', AuthMiddleware_1.authenticate, RegistrationController_1.RegistrationController.createRegistration);
router.get('/', RegistrationController_1.RegistrationController.getAllRegistrations);
router.get('/:userId', AuthMiddleware_1.authenticate, IsAdmin_1.isAdmin, RegistrationController_1.RegistrationController.getUserTicketCostSummary);
router.put('/:id', RegistrationController_1.RegistrationController.updateRegistration);
// --- Ticket Management Routes ---
// Get ticket details with calculated price
router.get("/:id/details", AuthMiddleware_1.authenticate, (req, res) => TicketService_1.TicketService.getTicketDetails(req, res));
// Transfer a ticket to another user
router.put("/:id/transfer", AuthMiddleware_1.authenticate, TicketService_1.TicketService.transferTicket.bind(TicketService_1.TicketService));
// Add tickets to a registration (increment quantity)
router.put("/:id/add-tickets", AuthMiddleware_1.authenticate, TicketService_1.TicketService.AddToCartTheNoOfTickets.bind(TicketService_1.TicketService));
// Cancel specific tickets within a registration
router.put("/:id/cancel", AuthMiddleware_1.authenticate, TicketService_1.TicketService.cancelRegistration.bind(TicketService_1.TicketService));
// Resend the ticket email for a registration
router.post("/:id/resend-ticket", AuthMiddleware_1.authenticate, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    try {
        // Use dRequest type if available, otherwise keep (req as any)
        const typedReq = req;
        const loggedInUserId = (_a = typedReq.user) === null || _a === void 0 ? void 0 : _a.userId;
        const loggedInUserRoles = ((_b = typedReq.user) === null || _b === void 0 ? void 0 : _b.role) ? [typeof typedReq.user.role === 'string' ? typedReq.user.role : typedReq.user.role.roleName] : [];
        const { id: registrationId } = typedReq.params;
        const { userEmail } = typedReq.body; // Optional: specific email to resend to
        if (!loggedInUserId) {
            res.status(401).json({ success: false, message: 'Unauthorized: User information is missing.' });
            return;
        }
        if (!registrationId) {
            res.status(400).json({ success: false, message: 'Registration ID is required.' });
            return;
        }
        // Authorization Check: Fetch registration to apply 'isAuthorizedForRegistration' logic
        // This ensures only admins, managers, or the owner/buyer can resend tickets.
        const registration = yield RegistrationRepository_1.RegistrationRepository.getRepository().findOne({
            where: { registrationId },
            relations: ['buyer', 'user'] // Need buyer/user for authorization
        });
        if (!registration) {
            res.status(404).json({ success: false, message: 'Registration not found.' });
            return;
        }
        // isAuthorizedForRegistration is a private method in TicketService, but can be accessed for testing purposes with []
        // In a real application, you might want to expose a public static `authorizeRegistrationAccess` helper on TicketService.
        if (!TicketService_1.TicketService['isAuthorizedForRegistration'](loggedInUserId, loggedInUserRoles, registration)) {
            res.status(403).json({ success: false, message: 'Forbidden: You do not have permission to resend this ticket.' });
            return;
        }
        const success = yield TicketService_1.TicketService.resendTicket(registrationId, userEmail);
        if (success) {
            res.status(200).json({ success: true, message: 'Ticket email resent successfully.' });
        }
        else {
            res.status(500).json({ success: false, message: 'Failed to resend ticket email. Check server logs.' });
        }
    }
    catch (error) {
        console.error(`Error in resend-ticket route for registration ${req.params.id}:`, error);
        next(error); // Pass the error to the next middleware (error handling middleware)
    }
}));
// Generate and download the ticket PDF for a registration
router.get("/:id/ticket-pdf", AuthMiddleware_1.authenticate, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    // Use dRequest type if available, otherwise keep (req as any)
    const typedReq = req;
    const loggedInUserId = (_a = typedReq.user) === null || _a === void 0 ? void 0 : _a.userId;
    const loggedInUserRoles = ((_b = typedReq.user) === null || _b === void 0 ? void 0 : _b.role) ? [typeof typedReq.user.role === 'string' ? typedReq.user.role : typedReq.user.role.roleName] : [];
    const { id: registrationId } = typedReq.params;
    if (!loggedInUserId) {
        res.status(401).json({ success: false, message: 'Unauthorized: User information is missing.' });
        return;
    }
    if (!registrationId) {
        res.status(400).json({ success: false, message: 'Registration ID is required.' });
        return;
    }
    try {
        // Authorization Check: Fetch registration to apply 'isAuthorizedForRegistration' logic
        // This ensures only admins, managers, or the owner/buyer can download the PDF.
        const registration = yield RegistrationRepository_1.RegistrationRepository.getRepository().findOne({
            where: { registrationId },
            relations: ['buyer', 'user']
        });
        if (!registration) {
            res.status(404).json({ success: false, message: 'Registration not found.' });
            return;
        }
        if (!TicketService_1.TicketService['isAuthorizedForRegistration'](loggedInUserId, loggedInUserRoles, registration)) {
            res.status(403).json({ success: false, message: 'Forbidden: You do not have permission to access this ticket PDF.' });
            return;
        }
        const pdfBuffer = yield TicketService_1.TicketService.generateTicketPdf(registrationId);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=ticket-${registrationId}.pdf`);
        res.send(pdfBuffer);
    }
    catch (error) {
        console.error(`Error in ticket-pdf route for registration ${registrationId}:`, error);
        res.status(500).json({ success: false, message: 'Failed to generate ticket PDF due to a server error.' });
    }
}));
// --- QR Code Management Routes ---
router.delete("/:registrationId", RegistrationController_1.RegistrationController.deleteRegistration);
router.get("/:id/qr-code/image", RegistrationController_1.RegistrationController.getRegistrationQrCodeImage);
router.get("/:id/qr-code", RegistrationController_1.RegistrationController.getRegistrationQrCode);
router.post("/:id/qr-code/regenerate", RegistrationController_1.RegistrationController.regenerateQrCode);
router.get("/qr-code/validate/:qrCode", RegistrationController_1.RegistrationController.validateQrCode);
exports.default = router;
