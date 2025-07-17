// import { NextFunction, Request, Response, RequestHandler } from 'express';
// import { RegistrationRepository } from '../repositories/RegistrationRepository';
// import { v4 as uuidv4 } from 'uuid';
// import { RegistrationService } from '../services/registrations/ValidationRegistrationService';
// import { QrCodeService } from '../services/registrations/QrCodeService';
// import path from 'path';
// import fs from 'fs';
// import { RegistrationRequestInterface, RegistrationResponseInterface } from '../interfaces/RegistrationInterface';
// import { PaymentStatus } from '../interfaces/Enums/PaymentStatusEnum';
// import { UserInterface } from '../interfaces/UserInterface';
// import { AppDataSource } from '../config/Database';
// import { User } from '../models/User';

// declare global {
//   namespace Express {
//     interface UserPayload {
//       userId: string;
//       roles?: { roleName: string }[];
//     }
//     interface Request {
//       user: UserInterface & { id: string; isAdmin?: boolean };
//     }
//   }
// }

// export class RegistrationController {
//   // Create Registration
//   static async createRegistration(req: Request, res: Response): Promise<void> {
//     try {
//       const registrationData = { ...req.body } as Partial<RegistrationRequestInterface>;
//       const loggedInUserId = req.user?.userId;

//       if (!loggedInUserId) {
//         res.status(401).json({ success: false, message: 'Unauthorized: User information missing.' });
//         return;
//       }

//       // Remove userId from body if present
//       delete registrationData.userId;

//       // Always use userId from token
//       const userId = loggedInUserId;
//       const buyerId = registrationData.buyerId ?? loggedInUserId;
//       const registrationId = uuidv4();

//       // Ensure noOfTickets is provided
//       if (registrationData.noOfTickets === undefined || registrationData.noOfTickets === null) {
//         res.status(400).json({ success: false, message: 'Number of tickets (noOfTickets) is required.' });
//         return;
//       }

//       const dataForService: RegistrationRequestInterface = {
//         ...registrationData,
//         registrationId,
//         userId, // always from token
//         buyerId,
//         paymentStatus: registrationData.paymentStatus || PaymentStatus.PENDING,
//         attended: registrationData.attended || false,
//         boughtForIds: registrationData.boughtForIds || [],
//         eventId: registrationData.eventId ?? '',
//         ticketTypeId: registrationData.ticketTypeId ?? '',
//         venueId: registrationData.venueId ?? '',
//         noOfTickets: Number(registrationData.noOfTickets),
//         registrationDate: registrationData.registrationDate || new Date().toISOString(),
//       };

//       // Step 1: Validate IDs
//       const validationResult = await RegistrationService.validateRegistrationIds(dataForService);
//       if (!validationResult.valid) {
//         res.status(400).json({
//           success: false,
//           message: validationResult.message,
//           errors: validationResult.errors,
//         });
//         return;
//       }

//       // Step 2: Validate event capacity
//       const capacityValidation = await RegistrationService.validateEventCapacity(
//         dataForService.eventId,
//         dataForService.venueId,
//         dataForService.noOfTickets
//       );
//       if (!capacityValidation.valid) {
//         res.status(400).json({
//           success: false,
//           message: capacityValidation.message,
//         });
//         return;
//       }

//       // Step 3: Validate ticket cost
//       const ticketCostValidation = await RegistrationService.validateAndCalculateTicketCost(
//         dataForService.ticketTypeId,
//         dataForService.noOfTickets
//       );
//       if (!ticketCostValidation.valid || ticketCostValidation.totalCost === undefined) {
//         res.status(400).json({
//           success: false,
//           message: ticketCostValidation.message || 'Could not validate ticket type or calculate cost.',
//         });
//         return;
//       }

//       dataForService.totalCost = ticketCostValidation.totalCost;

//       // Step 4: Check for duplicates
//       const duplicateValidation = await RegistrationService.validateDuplicateRegistration(
//         dataForService.eventId,
//         dataForService.userId,
//         dataForService.buyerId ?? '',
//         dataForService.boughtForIds
//       );
//       if (!duplicateValidation.valid) {
//         res.status(400).json({
//           success: false,
//           message: duplicateValidation.message,
//         });
//         return;
//       }

//       // Only now create the registration
//       const registration = await RegistrationService.createRegistration(dataForService);
//       res.status(201).json({ success: true, data: registration });
//     } catch (error: any) {
//       console.error('Error creating registration:', error);
//       res.status(500).json({
//         success: false,
//         message: 'Failed to create registration due to an unexpected server error.',
//         error: error.message,
//       });
//     }
//   }

//   // Get all registrations
//   static async getAllRegistrations(req: Request, res: Response): Promise<void> {
//     try {
//       const registrations = await RegistrationRepository.findAll();
//       res.status(200).json({ success: true, data: registrations });
//     } catch (error) {
//       console.error('Error getting all registrations:', error);
//       res.status(500).json({ success: false, message: 'Failed to retrieve registrations.' });
//     }
//   }

//   // Get ticket cost summary for a user
//   static async getUserTicketCostSummary(req: Request, res: Response): Promise<void> {
//     const loggedInUserId = req.user?.userId;
//     const loggedInUserRoles = req.user?.role ? [req.user.role] : [];
//     const { userId: targetUserId } = req.params;

//     try {
//       if (!loggedInUserId) {
//         res.status(401).json({ success: false, message: 'Unauthorized: User information missing.' });
//         return;
//       }

//       if (!targetUserId) {
//         res.status(400).json({ success: false, message: 'Target user ID is required.' });
//         return;
//       }

//       const targetUser = await AppDataSource.getRepository(User).findOne({ where: { userId: targetUserId } });
//       if (!targetUser) {
//         res.status(404).json({ success: false, message: 'Target user not found.' });
//         return;
//       }

//       const normalizedRoles = loggedInUserRoles.map((role: any) => typeof role === 'string' ? role.toLowerCase() : (role.roleName ? role.roleName.toLowerCase() : ''));
//       const hasAdminAccess = normalizedRoles.includes('admin');
//       const hasManagerAccess = normalizedRoles.includes('manager');
//       const isSelfAccess = loggedInUserId === targetUserId;

//       let hasBuyerAccess = false;
//       if (normalizedRoles.includes('buyer')) {
//         const buyerRegistrations = await RegistrationRepository.getRepository().find({
//           where: [
//             { buyer: { userId: loggedInUserId }, user: { userId: targetUserId } },
//             { buyer: { userId: loggedInUserId } },
//           ],
//           relations: ['buyer', 'user'],
//         });
//         hasBuyerAccess = buyerRegistrations.some(reg =>
//           reg.buyer.userId === loggedInUserId &&
//           (reg.user.userId === targetUserId || (reg.boughtForIds && reg.boughtForIds.includes(targetUserId)))
//         );
//       }

//       if (!hasAdminAccess && !hasManagerAccess && !isSelfAccess && !hasBuyerAccess) {
//         res.status(403).json({ success: false, message: 'Forbidden: You do not have permission to view this user\'s ticket cost summary.' });
//         return;
//       }

//       const registrations = await RegistrationRepository.getRepository().find({
//         where: [
//           { user: { userId: targetUserId } },
//           { buyer: { userId: targetUserId } },
//         ],
//         relations: ['event', 'user', 'buyer', 'ticketType', 'venue', 'payment'],
//         order: { registrationDate: 'DESC' },
//       });

//       const additionalRegistrations = await RegistrationRepository.getRepository()
//         .createQueryBuilder('registration')
//         .leftJoinAndSelect('registration.event', 'event')
//         .leftJoinAndSelect('registration.user', 'user')
//         .leftJoinAndSelect('registration.buyer', 'buyer')
//         .leftJoinAndSelect('registration.ticketType', 'ticketType')
//         .leftJoinAndSelect('registration.venue', 'venue')
//         .leftJoinAndSelect('registration.payment', 'payment')
//         .where('registration.boughtForIds @> ARRAY[:userId]::uuid[]', { userId: targetUserId })
//         .getMany();

//       const allRegistrations = [...registrations, ...additionalRegistrations].filter(
//         (reg, index, arr) => arr.findIndex(r => r.registrationId === reg.registrationId) === index
//       );

//       let totalTickets = 0;
//       let totalCost = 0;
//       let totalPaid = 0;
//       let totalPending = 0;
//       let totalRefunded = 0;

//       const registrationSummaries = allRegistrations.map(registration => {
//         const ticketPrice = registration.ticketType ? parseFloat(registration.ticketType.price.toString()) : 0;
//         const regTotalCost = ticketPrice * registration.noOfTickets;

//         totalTickets += registration.noOfTickets;
//         totalCost += regTotalCost;

//         switch (registration.paymentStatus?.toLowerCase()) {
//           case 'completed':
//           case 'paid':
//             totalPaid += regTotalCost;
//             break;
//           case 'pending':
//             totalPending += regTotalCost;
//             break;
//           case 'refunded':
//             totalRefunded += regTotalCost;
//             break;
//         }

//         return {
//           registrationId: registration.registrationId,
//           eventId: registration.eventId,
//           eventName: registration.event.eventTitle,
//           eventDate: registration.event.createdAt,
//           ticketType: registration.ticketType.ticketName,
//           noOfTickets: registration.noOfTickets,
//           ticketPrice: ticketPrice,
//           totalCost: regTotalCost,
//           paymentStatus: registration.paymentStatus,
//           registrationStatus: registration.registrationStatus,
//           registrationDate: registration.registrationDate,
//           isPrimaryAttendee: registration.user.userId === targetUserId,
//           isBuyer: registration.buyer.userId === targetUserId,
//           isInBoughtForIds: registration.boughtForIds ? registration.boughtForIds.includes(targetUserId) : false,
//         };
//       });

//       const summary = {
//         targetUser: {
//           userId: targetUser.userId,
//           fullName: targetUser.lastName,
//           email: targetUser.email,
//         },
//         totalRegistrations: allRegistrations.length,
//         totalTickets,
//         totalCost: parseFloat(totalCost.toFixed(2)),
//         totalPaid: parseFloat(totalPaid.toFixed(2)),
//         totalPending: parseFloat(totalPending.toFixed(2)),
//         totalRefunded: parseFloat(totalRefunded.toFixed(2)),
//         registrations: registrationSummaries,
//       };

//       res.status(200).json({
//         success: true,
//         message: 'User ticket cost summary retrieved successfully.',
//         data: summary,
//       });
//     } catch (error) {
//       console.error(`Error getting ticket cost summary for user ${targetUserId}:`, error);
//       res.status(500).json({ success: false, message: 'Failed to retrieve ticket cost summary.' });
//     }
//   }

//   // Update registration
//   static async updateRegistration(req: Request, res: Response): Promise<void> {
//     try {
//       const registrationId = req.params.id;
//       const updateData: Partial<RegistrationRequestInterface> = req.body;

//       const validationResult = await RegistrationService.validateRegistrationIds(updateData);
//       if (!validationResult.valid) {
//         res.status(400).json({
//           success: false,
//           message: validationResult.message,
//           errors: validationResult.errors,
//         });
//         return;
//       }

//       const updatedRegistration = await RegistrationRepository.update(registrationId, updateData);
//       if (!updatedRegistration) {
//         res.status(404).json({ success: false, message: 'Registration not found.' });
//         return;
//       }
//       res.status(200).json({ success: true, data: updatedRegistration });
//     } catch (error) {
//       console.error('Error updating registration:', error);
//       res.status(500).json({ success: false, message: 'Failed to update registration.' });
//     }
//   }

//   // Delete registration
//   static async deleteRegistration(req: Request, res: Response): Promise<void> {
//     const { registrationId } = req.params;
//     try {
//       if (!registrationId) {
//         res.status(400).json({ success: false, message: 'Registration ID is required.' });
//         return;
//       }

//       const success = await RegistrationRepository.delete(registrationId);
//       if (success) {
//         res.status(200).json({ success: true, message: 'Registration deleted successfully.' });
//       } else {
//         res.status(404).json({ success: false, message: 'Registration not found or could not be deleted.' });
//       }
//     } catch (error) {
//       console.error(`Error deleting registration ${registrationId}:`, error);
//       res.status(500).json({ success: false, message: 'Failed to delete registration.' });
//     }
//   }

//   // Regenerate QR code
//   static regenerateQrCode: RequestHandler<{ id: string }> = async (req, res) => {
//     try {
//       const { id: registrationId } = req.params;

//       const existingRegistration = await RegistrationRepository.findById(registrationId);
//       if (!existingRegistration) {
//         res.status(404).json({ success: false, message: 'Registration not found.' });
//         return;
//       }

//       if (existingRegistration.qrCode) {
//         const oldQrCodePath = path.join(__dirname, '..', '..', 'src', 'Uploads', 'qrcodes', existingRegistration.qrCode);
//         if (fs.existsSync(oldQrCodePath)) {
//           fs.unlinkSync(oldQrCodePath);
//           console.log(`Deleted old QR code file: ${oldQrCodePath}`);
//         }
//       }

//       const newQrCodeFileName = await QrCodeService.generateQrCode(
//         existingRegistration.registrationId,
//         existingRegistration.user.userId,
//         existingRegistration.event.eventId
//       );

//       const updatedRegistration = await RegistrationRepository.update(registrationId, { qrCode: newQrCodeFileName });
//       if (!updatedRegistration) {
//         throw new Error('Failed to update registration with new QR code path.');
//       }

//       res.status(200).json({
//         success: true,
//         message: 'QR code regenerated successfully.',
//         data: updatedRegistration,
//         qrCodeUrl: `/static/${newQrCodeFileName}`,
//       });
//     } catch (error) {
//       console.error(`Error regenerating QR code for registration ${req.params.id}:`, error);
//       res.status(500).json({ success: false, message: 'Failed to regenerate QR code.' });
//     }
//   }

//   // Validate QR code
//   static validateQrCode: RequestHandler<{ qrCode: string }> = async (req, res) => {
//     try {
//       const { qrCode } = req.params;
//       if (!qrCode) {
//         res.status(400).json({ success: false, message: 'QR code string is required.' });
//         return;
//       }

//       const registration = await RegistrationRepository.findByQRCode(qrCode);
//       if (!registration) {
//         res.status(404).json({ success: false, message: 'Invalid or expired QR code, or registration not found.' });
//         return;
//       }

//       res.status(200).json({
//         success: true,
//         message: 'QR code validated successfully.',
//         data: registration,
//       });
//     } catch (error) {
//       console.error(`Error validating QR code:`, error);
//       res.status(500).json({ success: false, message: 'Failed to validate QR code.' });
//     }
//   }

//   // Get QR code path
//   static async getRegistrationQrCode(req: Request, res: Response): Promise<void> {
//     try {
//       const { id } = req.params;
//       const registration = await RegistrationRepository.findById(id);
//       if (!registration || !registration.qrCode) {
//         res.status(404).json({ success: false, message: 'Registration or QR code not found.' });
//         return;
//       }

//       res.status(200).json({
//         success: true,
//         message: 'QR code path retrieved successfully.',
//         qrCodePath: registration.qrCode,
//         qrCodeUrl: `/static/${registration.qrCode}`,
//       });
//     } catch (error) {
//       console.error(`Error getting QR code path for registration ${req.params.id}:`, error);
//       res.status(500).json({ success: false, message: 'Failed to retrieve QR code path.' });
//     }
//   }

//   // Serve QR code image
//   static async getRegistrationQrCodeImage(req: Request, res: Response): Promise<void> {
//     try {
//       const { id } = req.params;
//       const registration = await RegistrationRepository.findById(id);
//       if (!registration || !registration.qrCode) {
//         res.status(404).json({ success: false, message: 'QR code not found for this registration.' });
//         return;
//       }

//       const QR_CODES_UPLOAD_BASE_DIR = path.join(__dirname, '..', '..', 'src', 'Uploads', 'qrcodes');
//       const absolutePath = path.join(QR_CODES_UPLOAD_BASE_DIR, registration.qrCode);

//       if (!fs.existsSync(absolutePath)) {
//         console.error(`QR code image file not found at: ${absolutePath}`);
//         res.status(404).json({ success: false, message: 'QR code image file not found on server.' });
//         return;
//       }

//       res.sendFile(absolutePath);
//     } catch (error) {
//       console.error(`Error retrieving QR code image for registration ${req.params.id}:`, error);
//       res.status(500).json({ success: false, message: 'Failed to retrieve QR code image.' });
//     }
//   }
// }