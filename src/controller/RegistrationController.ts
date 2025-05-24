// src/controller/RegistrationController.ts
import { RequestHandler, Response } from "express";
import { RegistrationRepository } from "../repositories/RegistrationRepository";
import { AuthenticatedRequest } from "../middlewares/AuthMiddleware";
import { v4 as uuidv4 } from 'uuid';
import { ValidationService } from "../services/registrations/ValidationRegistrationService";
// You DON'T need to import AppDataSource, User, Event, TicketType, Venue here anymore
// because RegistrationRepository and ValidationService will handle getting repositories.
import { RegistrationRequestInterface } from "../interfaces/interface"; // Assuming this is your DTO interface
import { QrCodeService } from "../services/registrations/QrCodeService";
import path from "path";
import fs from "fs";
import { AppDataSource } from "../config/Database";
import { Registration } from "../models/Registration";
import { Invoice } from "../models/Invoice";
import { User } from "../models/User";
import { isAdmin } from "../middlewares/IsAdmin";

export class RegistrationController {

    // Create Registration
    static async createRegistration(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            // Cast req.body to the expected interface for type safety
            // IMPORTANT: req.body already contains the flat IDs like eventId, userId, ticketTypeId, venueId
            const registrationData: RegistrationRequestInterface = req.body;

            // Get buyer from authenticated user token
            const buyerId = req.user?.userId;
            if (!buyerId) {
                res.status(401).json({
                    success: false,
                    message: "Authentication required. Buyer information not found."
                });
                return;
            }

            // Generate registration ID
            const registrationId = uuidv4();

            // Prepare data for validation. It already has the flat IDs.
            // We just add the generated registrationId and the buyerId from the token.
            const dataForValidation: RegistrationRequestInterface = {
                ...registrationData,
                registrationId: registrationId, // Add generated ID for validation/creation
                buyerId: buyerId, // Override/ensure buyerId from token
                // Ensure default values are handled if not provided in the request body
                registrationDate: registrationData.registrationDate || new Date().toISOString(),
                paymentStatus: registrationData.paymentStatus || 'pending',
                attended: registrationData.attended || false,
                boughtForIds: registrationData.boughtForIds || [] // Ensure array even if empty
            };

            // Validate that all referenced IDs exist and other business rules
            const validationResult = await ValidationService.validateRegistrationIds(dataForValidation);
            if (!validationResult.valid) {
                res.status(400).json({
                    success: false,
                    message: validationResult.message,
                    errors: validationResult.errors
                });
                return;
            }

            // At this point, `dataForValidation` contains all necessary flat IDs and values.
            // Pass this validated data to the RegistrationRepository to create the entity.
            const result = await RegistrationRepository.create(dataForValidation);

            res.status(201).json({
                success: true,
                message: "Registration created successfully",
                data: result
            });

        } catch (error) {
            console.error('Error creating registration:', error);
            // Distinguish between validation errors (400) and other server errors (500)
            if (error instanceof Error && error.message.startsWith("Validation failed")) {
                 res.status(400).json({
                    success: false,
                    message: error.message,
                    errors: error.message.split(". ") // Simple split for display, consider more robust parsing if needed
                 });
            } else {
                res.status(500).json({
                    success: false,
                    message: "Failed to create registration due to an unexpected error."
                });
            }
        }
    }

    // --- Add other controller methods here, ensuring they use the flat data structure
    //     and call the appropriate RegistrationRepository methods. ---

    // Example for getAllRegistrations (add to RegistrationController class)
    static async getAllRegistrations(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            const registrations = await RegistrationRepository.findAll();
            res.status(200).json({ success: true, data: registrations });
        } catch (error) {
            console.error('Error getting all registrations:', error);
            res.status(500).json({ success: false, message: "Failed to retrieve registrations." });
        }
    } /**
     * Retrieves a user's details and the total cost of all tickets associated with them.
     * This includes registrations where they are the buyer or the primary attendee.
     * @param req The authenticated request object, containing userId in params.
     * @param res The Express response object.
     */
    static async getUserTicketCostSummary(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            const targetUserId = req.params.id; // The ID of the user whose summary is requested
            const loggedInUserId = req.user?.userId; // The ID of the user making the request

            const userRepository = AppDataSource.getRepository(User);
            const registrationRepository = AppDataSource.getRepository(Registration);

            // 1️⃣ Fetch the target user's details, including roles
            const user = await userRepository.findOne({
                where: { userId: targetUserId },
                relations: ["role"] // Assuming 'role' is a direct relation on User
            });

            if (!user) {
                res.status(404).json({ success: false, message: "User not found." });
                return;
            }

            // 2️⃣ Authorization Check (Ensuring User Can View Data)
            // Ensure req.user.roles is correctly populated by your authentication middleware
            const isAdmin = req.user?.roles?.some(role => role === "admin"); // Adjust based on how your role object is structured (e.g., role.name or just role string)
            if (targetUserId !== loggedInUserId && !isAdmin) {
                res.status(403).json({ success: false, message: "Forbidden: You can only view your own registrations or require admin privileges." });
                return;
            }

            // 3️⃣ Retrieve all registrations linked to the user (buyer or attendee)
            // Ensure you load 'ticketType' and 'event' as relations
            const registrations = await registrationRepository.find({
                where: [
                    { buyer: { userId: targetUserId } },
                    { user: { userId: targetUserId } }
                ],
                relations: ["ticketType", "event"] // Crucial for accessing price and eventTitle
            });

            // 4️⃣ Calculate Total Ticket Cost
            let totalTicketsCost = 0;
            const registrationDetails = [];

            for (const registration of registrations) {
                // Ensure ticketType and its price exist before calculating
                const ticketPrice = registration.ticketType?.price ?? 0; // Use nullish coalescing to default to 0 if price is null/undefined
                const costForThisRegistration = ticketPrice * registration.noOfTickets;

                totalTicketsCost += costForThisRegistration;

                // Add details for the response's 'registrations' array
                registrationDetails.push({
                    registrationId: registration.registrationId,
                    noOfTickets: registration.noOfTickets,
                    // Use the calculated cost for this specific registration
                    totalCost: parseFloat(costForThisRegistration.toFixed(2)),
                    eventTitle: registration.event?.eventTitle // Ensure event exists before accessing title
                });
            }

            // 5️⃣ Format Total Cost to Two Decimal Places
            const formattedTotalTicketsCost = parseFloat(totalTicketsCost.toFixed(2));

            // 6️⃣ Build Response JSON
            res.status(200).json({
                success: true,
                data: {
                    user: {
                        userId: user.userId,
                        username: user.username,
                        firstName: user.firstName,
                        lastName: user.lastName,
                        email: user.email,
                        phoneNumber: user.phoneNumber
                        // Include other user details as needed
                    },
                    totalCostOfAllTickets: formattedTotalTicketsCost,
                    registrations: registrationDetails // The prepared array of registration details
                }
            });

        } catch (error) {
            console.error(`Error fetching ticket cost summary for user ${req.params.id}:`, error);
            res.status(500).json({ success: false, message: "Failed to retrieve user ticket summary due to a server error." });
        }
    }


    //update registration
    static async updateRegistration(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            const registrationId = req.params.id;
            const updateData: RegistrationRequestInterface = req.body;

            // Validate the update data if necessary
            const validationResult = await ValidationService.validateRegistrationIds(updateData);
            if (!validationResult.valid) {
                res.status(400).json({
                    success: false,
                    message: validationResult.message,
                    errors: validationResult.errors
                });
                return;
            }

            const updatedRegistration = await RegistrationRepository.update(registrationId, updateData);
            if (!updatedRegistration) {
                res.status(404).json({ success: false, message: "Registration not found." });
                return;
            }
            res.status(200).json({ success: true, data: updatedRegistration });
        } catch (error) {
            console.error('Error updating registration:', error);
            res.status(500).json({ success: false, message: "Failed to update registration." });
        }
    
    }


// ... continue for other methods like getRegistrationById, updateRegistration, deleteRegistration, etc.

    // --- New/Implemented QR Code Controller Methods ---

    /**
     * Regenerates the QR code for a specific registration.
     * Deletes the old QR code file and saves the new one.
     */
    static regenerateQrCode: RequestHandler<{ id: string }> = async (req, res) => {
        try {
            const { id: registrationId } = req.params;

            // 1. Find the existing registration
            const existingRegistration = await RegistrationRepository.findById(registrationId);
            if (!existingRegistration) {
                res.status(404).json({ success: false, message: "Registration not found." });
                return;
            }

            // 2. Delete the old QR code file if it exists
            if (existingRegistration.qrCode) {
                const oldQrCodePath = path.join(__dirname, '..', '..', existingRegistration.qrCode);
                if (fs.existsSync(oldQrCodePath)) {
                    fs.unlinkSync(oldQrCodePath); // Synchronous for simplicity, async for production
                    console.log(`Deleted old QR code file: ${oldQrCodePath}`);
                }
            }

            // 3. Generate a new QR code
            const newQrCodeFilePath = await QrCodeService.generateQrCode(
                existingRegistration.registrationId,
                existingRegistration.user.id,
                existingRegistration.event.eventId
            );

            // 4. Update the registration with the new QR code file path
            const updatedRegistration = await RegistrationRepository.update(registrationId, { qrCode: newQrCodeFilePath });

            if (!updatedRegistration) {
                // This case should ideally not be hit if existingRegistration was found
                throw new Error("Failed to update registration with new QR code path.");
            }

            res.status(200).json({
                success: true,
                message: "QR code regenerated successfully.",
                data: updatedRegistration,
                qrCodeUrl: `/static/${newQrCodeFilePath}`
            });

        } catch (error) {
            console.error(`Error regenerating QR code for registration ${req.params.id}:`, error);
            res.status(500).json({ success: false, message: "Failed to regenerate QR code." });
        }
    };

    /**
     * Validates a raw QR code string (the base64 encoded data) and returns the associated registration.
     * This is typically used for check-in scenarios.
     */
    static validateQrCode: RequestHandler<{ qrCode: string }> = async (req, res) => {
        try {
            const { qrCode } = req.params; // Expecting the raw base64 string from the QR code

            if (!qrCode) {
                res.status(400).json({ success: false, message: "QR code string is required." });
                return;
            }

            // Use the repository method that leverages QrCodeService for validation
            const registration = await RegistrationRepository.findByQRCode(qrCode);

            if (registration=== null) {
                res.status(404).json({ success: false, message: "Invalid or expired QR code, or registration not found." });
                return;
            }

            res.status(200).json({
                success: true,
                message: "QR code validated successfully.",
                data: registration
            });

        } catch (error) {
            console.error(`Error validating QR code:`, error);
            res.status(500).json({ success: false, message: "Failed to validate QR code." });
        }
    };

    /**
     * Gets the QR code path stored for a specific registration.
     * This method retrieves the path from the database, not the image itself.
     */
    static async getRegistrationQrCode(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            const { id } = req.params;
            const registration = await RegistrationRepository.findById(id);

            if (!registration) {
                res.status(404).json({ success: false, message: "Registration not found." });
                return;
            }

            if (!registration.qrCode) {
                res.status(404).json({ success: false, message: "QR code not generated for this registration." });
                return;
            }

            res.status(200).json({
                success: true,
                message: "QR code path retrieved successfully.",
                qrCodePath: registration.qrCode,
                qrCodeUrl: `/static/${registration.qrCode}` // Provide a full URL
            });

        } catch (error) {
            console.error(`Error getting QR code path for registration ${req.params.id}:`, error);
            res.status(500).json({ success: false, message: "Failed to retrieve QR code path." });
        }
    }

    /**
     * Serves the actual QR code image file for a given registration ID.
     */
    static async getRegistrationQrCodeImage(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            const { id } = req.params;
            const registration = await RegistrationRepository.findById(id);

            if (!registration || !registration.qrCode) {
                res.status(404).json({ success: false, message: "QR code not found for this registration, or it hasn't been generated yet." });
                return;
            }

            // CRITICAL LINE TO CHECK:
            // __dirname in 'src/controller' -> 'path.join(__dirname, '..')' goes to 'src/'
            // Then 'uploads/qrcodes' is appended.
            const QR_CODES_UPLOAD_BASE_DIR = path.join(__dirname, '..', 'uploads', 'qrcodes'); // THIS MUST BE CORRECT!

            const absolutePath = path.join(QR_CODES_UPLOAD_BASE_DIR, registration.qrCode);

            // This log will now show the path the controller is *actually checking*
            console.error(`QR code image file not found at: ${absolutePath}`); // This log will still appear if the path is wrong

            if (!fs.existsSync(absolutePath)) {
                // This message means the file is not at 'absolutePath'
                res.status(404).json({ success: false, message: "QR code image file not found on server." });
                return;
            }

            // If we reach here, the file should exist at 'absolutePath'
            res.sendFile(absolutePath);

        } catch (error) {
            console.error(`Error retrieving QR code image for registration ${req.params.id}:`, error);
            res.status(500).json({ success: false, message: "Failed to retrieve QR code image due to a server error." });
        }
    }

}