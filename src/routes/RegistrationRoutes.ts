import express from 'express';
import { RegistrationController } from '../controller/RegistrationController';
import { TicketService } from '../services/registrations/TicketService';

const router = express.Router();
// Core Registration Management
router.post('/', RegistrationController.createRegistration);
router.get('/', RegistrationController.getAllRegistrations);
router.get('/:id', RegistrationController.getUserTicketCostSummary);
router.put('/:id', RegistrationController.updateRegistration);
//get the tickect details with calculated price
router.get("/:id/details", TicketService.getTicketDetails);
//transfer the ticket to another user
router.put("/:id/transfer", TicketService.transferTicket);
//cancel the ticket
router.delete("/cancelling/:id/tickets", TicketService.cancelRegistration);




// Get QR code *image* for a specific registration
router.get("/:id/qr-code/image", RegistrationController.getRegistrationQrCodeImage); // New route to serve image

// Get QR code *data* (the string encoded in the QR, not the image itself)
// This might be what your `getRegistrationQrCode` method is intended for
router.get("/:id/qr-code", RegistrationController.getRegistrationQrCode); // Assuming this method exists and returns the 'qrCode' path from DB

// Regenerate QR code for a specific registration
router.post("/:id/qr-code/regenerate", RegistrationController.regenerateQrCode);

// Validate a QR code string (the raw data string, not the image URL)
router.get("/qr-code/validate/:qrCode", RegistrationController.validateQrCode);

export default router;