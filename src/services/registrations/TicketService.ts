// src/services/registrations/TicketService.ts (or wherever TicketService resides)

import { AuthenticatedRequest } from '../../middlewares/AuthMiddleware';
import { TicketType } from '../../models/TicketType'; // Adjust path
import { Response } from 'express';
import { RegistrationRepository } from '../../repositories/RegistrationRepository'; // Adjust path
import { User } from '../../models/User'; // Adjust path
import { AppDataSource } from '../../config/Database';
import { Registration } from '../../models/Registration';
import { validate, IsArray, ArrayNotEmpty, IsUUID } from 'class-validator';
import { Invoice } from '../../models/Invoice';
// Import your AppDataSource instance

export class TicketService {
    /**
     * Get ticket details for a registration
     */
    static async getTicketDetails(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            const { id: registrationId } = req.params;
            const loggedInUserId = req.user?.userId;

            if (!loggedInUserId) {
                res.status(401).json({ success: false, message: 'Unauthorized: User information is missing from the token.' });
                return;
            }

            if (!registrationId) {
                res.status(400).json({ success: false, message: 'Registration ID is required.' });
                return;
            }

            // --- Step 1: Find the registration with all necessary relations ---
            const registration = await RegistrationRepository.getRepository().findOne({
                where: { registrationId },
                relations: ['event', 'user', 'buyer', 'ticketType', 'venue']
            });

            if (!registration) {
                res.status(404).json({ success: false, message: 'Registration not found.' });
                return;
            }

            // --- Step 2: Authorization Check ---
            const isAuthorized = (
                (registration.buyer && registration.buyer.userId === loggedInUserId) ||
                (registration.user && registration.user.userId === loggedInUserId) ||
                (Array.isArray(registration.boughtForIds) && registration.boughtForIds.includes(loggedInUserId))
            );

            if (!isAuthorized) {
                res.status(403).json({ success: false, message: 'Forbidden: You do not have access to these registration details.' });
                return;
            }

            // --- Step 3: Fetch details for boughtForIds users ---
            let boughtForUsersDetails: User[] = [];
            if (registration.boughtForIds && registration.boughtForIds.length > 0) {
                // *** CRITICAL CHANGE HERE: Use AppDataSource.getRepository() ***
                boughtForUsersDetails = await AppDataSource.getRepository(User).findByIds(registration.boughtForIds);
            }

            // --- Step 4: Calculate total cost and include ticket type details ---
            const ticketPrice = registration.ticketType ? parseFloat(registration.ticketType.price.toString()) : 0;
            const totalCost = ticketPrice * registration.noOfTickets;

            // --- Step 5: Construct the enhanced response data ---
            const responseData = {
                registrationId: registration.registrationId,
                noOfTickets: registration.noOfTickets,
                registrationDate: registration.registrationDate,
                paymentStatus: registration.paymentStatus,
                attended: registration.attended,
                checkDate: registration.checkDate,
                qrCode: registration.qrCode,

                ticketType: {
                    id: registration.ticketType.ticketTypeId,
                    name: registration.ticketType.ticketName, // Corrected from ticketName if that's your model
                    description: registration.ticketType.description,
                    price: ticketPrice,
                    // If you want actual available quantity, you need to use ticketType.availableQuantity from the model
                    // registration.noOfTickets here reflects how many tickets THIS registration has
                    availableQuantity: registration.noOfTickets
                },

                buyer: {
                    userId: registration.buyer.userId,
                    fullName: registration.buyer.fullName,
                    email: registration.buyer.email,
                },

                primaryAttendee: {
                    userId: registration.user.userId,
                    fullName: registration.user.fullName,
                    email: registration.user.email,
                },

                boughtForAttendees: boughtForUsersDetails.map(user => ({
                    userId: user.userId,
                    fullName: user.fullName,
                    email: user.email,
                })),

                event: {
                    eventId: registration.event.eventId,
                    eventName: registration.event.eventTitle, // Corrected from eventName if that's your model
                    eventType: registration.event.eventType,
                    category: registration.event.eventCategory,
                    description: registration.event.description, // Corrected from descrption typo
                },

                venue: {
                    venueId: registration.venue.venueId,
                    venueName: registration.venue.venueName,
                    address: registration.venue.location, // Corrected from venue.bookings if that's your model
                    capacity: registration.venue.capacity, // Corrected from venue.capacity if that's your model
                    manager: registration.venue.manager,
                    location: registration.venue.location,
                    isAvailable: registration.venue.isAvailable, // Corrected from isAvailabe typo
                },
                totalCost: totalCost
            };

            res.status(200).json({
                success: true,
                message: 'Ticket details retrieved successfully.',
                data: responseData
            });

        } catch (error) {
            console.error(`Error getting ticket details for registration ${req.params.id} by user ${req.user?.userId}:`, error);
            res.status(500).json({ success: false, message: 'Failed to retrieve ticket details due to a server error.' });
        }
    }
  /**
   * Transfer ticket to another user
   */
 /**
     * Transfer a ticket (represented by a slot in boughtForIds) to a new user.
     * This method assumes a specific boughtForId is being replaced, or a new slot is being filled.
     *
     * @param req The authenticated request object containing user ID and registrationId in params.
     * @param res The express response object.
     */
    static async transferTicket(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            const { id: registrationId } = req.params; // The ID of the registration record
            const { oldUserId, newUserId } = req.body; // Expecting oldUserId (optional) and newUserId in the request body
            const loggedInUserId = req.user?.userId;

            if (!loggedInUserId) {
                res.status(401).json({ success: false, message: 'Unauthorized: User information is missing.' });
                return;
            }

            if (!registrationId || !newUserId) {
                res.status(400).json({ success: false, message: 'Registration ID and new User ID are required.' });
                return;
            }

            // Find the registration with necessary relations
            const registration = await RegistrationRepository.getRepository().findOne({
                where: { registrationId },
                relations: ['buyer', 'user'] // Need buyer/user for authorization
            });

            if (!registration) {
                res.status(404).json({ success: false, message: 'Registration not found.' });
                return;
            }

            // --- Authorization Check ---
            // Only the buyer of the ticket can initiate a transfer.
            const isAuthorizedBuyer = (registration.buyer && registration.buyer.userId === loggedInUserId);

            if (!isAuthorizedBuyer) {
                res.status(403).json({ success: false, message: 'Forbidden: Only the buyer can transfer tickets for this registration.' });
                return;
            }

            // --- Validate newUserId ---
            const newUser = await AppDataSource.getRepository(User).findOne({ where: { userId: newUserId } });
            if (!newUser) {
                res.status(400).json({ success: false, message: 'New user (newUserId) not found.' });
                return;
            }

            // --- Ticket Transfer Logic ---
            let updatedBoughtForIds = registration.boughtForIds ? [...registration.boughtForIds] : [];
            let transferSuccessful = false;

            if (oldUserId) {
                // Scenario 1: Replacing an existing boughtForId
                const indexToRemove = updatedBoughtForIds.indexOf(oldUserId);

                // Prevent replacing the primary attendee or buyer if they're in boughtForIds and not the oldUserId
                if (registration.user.userId === oldUserId || registration.buyer.userId === oldUserId) {
                    res.status(400).json({ success: false, message: 'Can not transfer the primary attendee\'s or buyer\'s ticket directly using this method.\n Please contact support if needed.' });
                    return;
                }

                if (indexToRemove !== -1) {
                    updatedBoughtForIds[indexToRemove] = newUserId; // Replace the old user with the new user
                    transferSuccessful = true;
                } else {
                    // If oldUserId was provided but not found, check if there's an empty slot or if we can add
                    if (updatedBoughtForIds.length < registration.noOfTickets) {
                        // If current count is less than noOfTickets, it implies a "slot" can be filled
                        updatedBoughtForIds.push(newUserId);
                        transferSuccessful = true;
                    } else {
                        res.status(400).json({ success: false, message: 'Old user not found in bought tickets, and no available slots for transfer.' });
                        return;
                    }
                }
            } else {
                // Scenario 2: No specific oldUserId provided, so try to fill an empty slot
                // This means checking if noOfTickets allows more attendees than currently listed
                if (updatedBoughtForIds.length < registration.noOfTickets) {
                    updatedBoughtForIds.push(newUserId);
                    transferSuccessful = true;
                } else {
                    res.status(400).json({ success: false, message: 'Cannot transfer: All ticket slots are already assigned, and no specific old user was provided to replace.' });
                    return;
                }
            }

            // Prevent duplicate entries for the same new user
            if (updatedBoughtForIds.filter(id => id === newUserId).length > 1) {
                res.status(400).json({ success: false, message: 'The new user is already assigned a ticket for this registration.' });
                return;
            }


            if (transferSuccessful) {
                registration.boughtForIds = updatedBoughtForIds;
                await RegistrationRepository.getRepository().save(registration); // Save the updated registration

                res.status(200).json({
                    success: true,
                    message: `Ticket successfully transferred for registration ${registrationId}.`,
                    data: {
                        registrationId: registration.registrationId,
                        noOfTickets: registration.noOfTickets,
                        updatedBoughtForIds: registration.boughtForIds
                    }
                });
            } else {
                res.status(400).json({ success: false, message: 'Ticket transfer failed due to logic error.' });
            }

        } catch (error) {
            console.error(`Error transferring ticket for registration ${req.params.id}:`, error);
            res.status(500).json({ success: false, message: 'Failed to transfer ticket due to a server error.' });
        }
    }


 /**
     * Cancels specific tickets from a group registration by removing IDs from boughtForIds.
     * Only the buyer or the primary attendee can initiate this.
     * Only allows cost reduction if the registration's paymentStatus is 'pending'.
     *
     * @param req The authenticated request object, containing registrationId in params and userId from token.
     * @param res The Express response object.
     */
    static async cancelRegistration(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            const { id: registrationId } = req.params;
            const loggedInUserId = req.user?.userId;
            const { idsToCancel } = req.body;

            // 1. Basic Request Validation
            if (!loggedInUserId) {
                res.status(401).json({ success: false, message: 'Unauthorized: User information is missing.' });
                return;
            }
            if (!registrationId) {
                res.status(400).json({ success: false, message: 'Registration ID is required.' });
                return;
            }

            // Validate the incoming request body using the DTO
            const cancelDto = new CancelTicketsDto();
            cancelDto.idsToCancel = idsToCancel;
            const errors = await validate(cancelDto);
            if (errors.length > 0) {
                res.status(400).json({ success: false, message: 'Invalid request body.', errors: errors.map(err => err.constraints) });
                return;
            }

            const registrationRepository = AppDataSource.getRepository(Registration);
            const invoiceRepository = AppDataSource.getRepository(Invoice);

            // 2. Fetch Registration with all necessary relations
            const registration = await registrationRepository.findOne({
                where: { registrationId },
                relations: ['payment', 'buyer', 'user', 'ticketType', 'invoice']
            });

            if (!registration) {
                res.status(404).json({ success: false, message: 'Registration not found.' });
                return;
            }

            // 3. Authorization Check: Only buyer or primary attendee can cancel
            const isAuthorized = (
                registration.buyer.userId === loggedInUserId ||
                registration.user.userId === loggedInUserId
            );
            if (!isAuthorized) {
                res.status(403).json({ success: false, message: 'Forbidden: Only the buyer or primary attendee can cancel tickets for this registration.' });
                return;
            }

            // 4. Payment Status Check: Must be 'pending' for direct cost reduction
            if (registration.paymentStatus !== 'pending') {
                res.status(400).json({ success: false, message: `Cannot cancel tickets: Registration payment status is '${registration.paymentStatus}', not 'pending'. For paid registrations, a separate refund process is required.` });
                return;
            }

            // 5. Process Ticket Cancellation within boughtForIds
            let currentBoughtForIds = registration.boughtForIds ? [...registration.boughtForIds] : [];
            let ticketsActuallyCancelledCount = 0;
            let costReduction = 0;

            const ticketPricePerUnit = registration.ticketType ? parseFloat(registration.ticketType.price.toString()) : 0;
            if (ticketPricePerUnit <= 0) {
                 res.status(500).json({ success: false, message: 'Invalid ticket price found for this registration.' });
                 return;
            }

            const newBoughtForIds: string[] = [];
            const cancelledUserIds: string[] = [];

            for (const existingId of currentBoughtForIds) {
                if (idsToCancel.includes(existingId)) {
                    // Prevent cancellation of the primary attendee or buyer via boughtForIds
                    if (existingId === registration.user.userId || existingId === registration.buyer.userId) {
                        console.warn(`Skipping cancellation of primary attendee/buyer (${existingId}) via boughtForIds for registration ${registrationId}.`);
                        newBoughtForIds.push(existingId); // Keep this ID
                    } else {
                        cancelledUserIds.push(existingId); // Mark for cancellation
                    }
                } else {
                    newBoughtForIds.push(existingId); // Keep this ID
                }
            }

            // If no valid IDs were found to cancel, respond with an error
            if (cancelledUserIds.length === 0) {
                res.status(400).json({ success: false, message: 'No valid boughtForIds found for cancellation or provided IDs are not part of this registration.' });
                return;
            }

            ticketsActuallyCancelledCount = cancelledUserIds.length;
            costReduction = ticketPricePerUnit * ticketsActuallyCancelledCount;

            // Update Registration details
            registration.boughtForIds = newBoughtForIds;
            registration.noOfTickets -= ticketsActuallyCancelledCount;
            registration.totalCost = parseFloat((registration.totalCost - costReduction).toFixed(2));

            // Update overall registration status
            if (registration.noOfTickets === 0) {
                registration.registrationStatus = 'cancelled';
                registration.paymentStatus = 'cancelled';
            } else {
                registration.registrationStatus = 'partially_cancelled';
            }

            // 6. Update Linked Invoice (if exists and linked)
            if (registration.invoice) {
                registration.invoice.totalAmount = parseFloat((registration.invoice.totalAmount - costReduction).toFixed(2));
                await invoiceRepository.save(registration.invoice);
            }

            // 7. Save the updated Registration
            await registrationRepository.save(registration);

            // 8. Respond with success
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

        } catch (error) {
            console.error(`Error cancelling tickets for registration ${req.params.id} by user ${req.user?.userId}:`, error);
            res.status(500).json({ success: false, message: 'Failed to cancel tickets due to a server error.' });
        }
    }







  /**
   * Resend ticket via email
   */
  static async resendTicket(registrationId: string): Promise<boolean> {
    // TODO: Implement resend ticket
    return false; // Placeholder return value
  }

  /**
   * Generate ticket PDF
   */
  static async generateTicketPdf(registrationId: string): Promise<Buffer> {
    // TODO: Implement ticket PDF generation
    return Buffer.from(''); // Placeholder return value
  }

  /**
   * Validate ticket
   */
  static async validateTicket(registrationId: string): Promise<boolean> {
    // TODO: Implement ticket validation
    return false; // Placeholder return value
  }

  /**
   * Get available ticket types for an event
   */
  static async getAvailableTicketTypes(eventId: string): Promise<TicketType[]> {
    // TODO: Implement get available ticket types
    return []; // Placeholder return value
  }

  /**
   * Check ticket availability
   */
  static async checkTicketAvailability(ticketTypeId: string, quantity: number): Promise<boolean> {
    // TODO: Implement check ticket availability
    return false; // Placeholder return value
  }

  /**
   * Reserve tickets
   */
  static async reserveTickets(ticketTypeId: string, quantity: number, userId: string): Promise<boolean> {
    // TODO: Implement reserve tickets
    return false; // Placeholder return value
  }
}


    // DTO for validating the request body for cancellation
class CancelTicketsDto {
    @IsArray({ message: 'idsToCancel must be an array' })
    @ArrayNotEmpty({ message: 'idsToCancel array cannot be empty' })
    @IsUUID('4', { each: true, message: 'Each ID in idsToCancel must be a valid UUID' })
    idsToCancel!: string[];
}