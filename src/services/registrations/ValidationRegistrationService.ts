// src/services/registrations/ValidationRegistrationService.ts

import { Event } from "../../models/Event";
import { User } from "../../models/User";
import { TicketType } from "../../models/TicketType";
import { Venue } from "../../models/Venue";
import { Registration } from "../../models/Registration";
import { AppDataSource } from "../../config/Database"; // Make sure AppDataSource is imported
import type { RegistrationRequestInterface } from "../../interfaces/interface";
import { In } from "typeorm";

export class ValidationService {
  /**
   * Validate that all referenced IDs exist in the database for a new registration.
   */
  static async validateRegistrationIds(
    registrationData: Partial<RegistrationRequestInterface>,
  ): Promise<{
    valid: boolean;
    message?: string;
    errors?: string[];
  }> {
    const errors: string[] = [];

    // Get repositories using AppDataSource
    // Ensure AppDataSource is initialized before calling getRepository
    if (!AppDataSource.isInitialized) {
        errors.push("Database connection not initialized for validation.");
        return { valid: false, message: errors.join(" "), errors: errors };
    }
    const eventRepository = AppDataSource.getRepository(Event);
    const userRepository = AppDataSource.getRepository(User);
    const ticketTypeRepository = AppDataSource.getRepository(TicketType);
    const venueRepository = AppDataSource.getRepository(Venue);

    try {
      // ... (rest of the validateRegistrationIds logic remains the same as previously corrected)
      // All calls like `eventRepository.findOne(...)` will now use the correct AppDataSource instance.
      // Make sure all `getRepository(Entity)` calls are replaced with `AppDataSource.getRepository(Entity)`.

      // Validate Event exists
      const eventId = registrationData.eventId;
      if (!eventId) {
        errors.push("Event ID is required.");
      } else {
        const event = await eventRepository.findOne({ where: { eventId } });
        if (!event) {
          errors.push(`Event with ID '${eventId}' does not exist.`);
        }
      }

      // Validate User (primary attendee) exists
      const userId = registrationData.userId;
      if (!userId) {
        errors.push("User ID (attendee) is required.");
      } else {
        const user = await userRepository.findOne({ where: { userId } });
        if (!user) {
          errors.push(`User (attendee) with ID '${userId}' does not exist.`);
        }
      }

      // Validate Buyer exists
      const buyerId = registrationData.buyerId;
      if (!buyerId) {
        errors.push("Buyer ID is required.");
      } else {
        const buyer = await userRepository.findOne({ where: { userId: buyerId } });
        if (!buyer) {
          errors.push(`Buyer with ID '${buyerId}' does not exist.`);
        }
      }

      // Basic checks for noOfTickets
      const noOfTickets = registrationData.noOfTickets;
      if (noOfTickets === undefined || noOfTickets <= 0) {
        errors.push("Number of tickets must be a positive number.");
      }

      // --- CRITICAL LOGIC FOR noOfTickets and boughtForIds ---
      const boughtForIds = registrationData.boughtForIds;

      if (noOfTickets === 1) {
        if (boughtForIds && boughtForIds.length > 0) {
          if (boughtForIds.length !== 1 || boughtForIds[0] !== userId) {
            errors.push(`If noOfTickets is 1, boughtForIds must be empty or contain only the primary attendee's ID (${userId}).`);
          }
        }
      } else if (noOfTickets !== undefined && noOfTickets > 1) {
        if (!boughtForIds || !Array.isArray(boughtForIds) || boughtForIds.length === 0) {
          errors.push(`For ${noOfTickets} tickets, boughtForIds must be a non-empty array of attendee IDs.`);
        } else {
          if (boughtForIds.length !== noOfTickets) {
            errors.push(`Number of attendees in boughtForIds (${boughtForIds.length}) must exactly match noOfTickets (${noOfTickets}).`);
          }

          if (userId && !boughtForIds.includes(userId)) {
            errors.push(`The primary attendee (User ID: ${userId}) must be included in boughtForIds.`);
          }

          const uniqueBoughtForIds = [...new Set(boughtForIds)];
          if (uniqueBoughtForIds.length !== boughtForIds.length) {
            errors.push("boughtForIds contains duplicate user IDs.");
          }

          const users = await userRepository.find({
            where: { userId: In(uniqueBoughtForIds) },
          });

          if (users.length !== uniqueBoughtForIds.length) {
            const foundIds = users.map((u) => u.userId);
            const notFound = uniqueBoughtForIds.filter((id) => !foundIds.includes(id));
            errors.push(`User(s) with ID(s) '${notFound.join(", ")}' specified in boughtForIds do not exist.`);
          }
        }
      }
      // --- END CRITICAL LOGIC ---

      // Validate single TicketType
      const ticketTypeId = registrationData.ticketTypeId;
      if (!ticketTypeId) {
        errors.push("Ticket Type ID is required.");
      } else {
        const ticketType = await ticketTypeRepository.findOne({ where: { ticketTypeId } });
        if (!ticketType) {
          errors.push(`Ticket Type with ID '${ticketTypeId}' does not exist.`);
        }
      }

      // Validate Venue exists
      const venueId = registrationData.venueId;
      if (!venueId) {
        errors.push("Venue ID is required.");
      } else {
        const venue = await venueRepository.findOne({ where: { venueId } });
        if (!venue) {
          errors.push(`Venue with ID '${venueId}' does not exist.`);
        }
      }

      return {
        valid: errors.length === 0,
        message: errors.length > 0 ? `Validation failed: ${errors.join(" ")}` : undefined,
        errors: errors.length > 0 ? errors : undefined,
      };
    } catch (error) {
      console.error("Error validating registration IDs:", error);
      return {
        valid: false,
        message: "An internal server error occurred during ID validation.",
        errors: ["Internal validation error"],
      };
    }
  }

  // ... (rest of the methods like checkUserExists, validateEventCapacity, validateDuplicateRegistration, validateCompleteRegistration, validateAndCalculateTicketCost remain the same, but ensure they use AppDataSource.getRepository(Entity) for all repository access)
  // For example, in checkUserExists:
  static async checkUserExists(userId: string): Promise<boolean> {
    try {
      if (!AppDataSource.isInitialized) {
        throw new Error("AppDataSource is not initialized.");
      }
      const userRepository = AppDataSource.getRepository(User);
      const user = await userRepository.findOne({ where: { userId: userId } });
      return !!user;
    } catch (error) {
      console.error(`Error checking if user ${userId} exists:`, error);
      return false;
    }
  }

    // Similarly for validateEventCapacity, validateDuplicateRegistration, and validateAndCalculateTicketCost
    // ensure AppDataSource.getRepository is used.
    static async validateEventCapacity(
        eventId: string,
        venueId: string,
        requestedTickets: number,
    ): Promise<{ valid: boolean; message?: string }> {
        try {
            if (!AppDataSource.isInitialized) {
                return { valid: false, message: "Database connection not initialized for capacity check." };
            }
            const venueRepository = AppDataSource.getRepository(Venue);
            const venue = await venueRepository.findOne({ where: { venueId } });
            // ... rest of the logic
            const registrationRepository = AppDataSource.getRepository(Registration);
            // ...
            return { valid: true };
        } catch (error) {
            console.error("Error validating event capacity:", error);
            return { valid: false, message: "Error checking event capacity" };
        }
    }

    static async validateDuplicateRegistration(
        eventId: string,
        primaryUserId: string,
        boughtForIds?: string[],
    ): Promise<{ valid: boolean; message?: string }> {
        try {
            if (!AppDataSource.isInitialized) {
                return { valid: false, message: "Database connection not initialized for duplicate registration check." };
            }
            const registrationRepository = AppDataSource.getRepository(Registration);
            // ... rest of the logic
            return { valid: true };
        } catch (error) {
            console.error("Error validating duplicate registration:", error);
            return { valid: false, message: "Error checking duplicate registration" };
        }
    }

    static async validateAndCalculateTicketCost(ticketTypeId: string, quantity: number): Promise<{
        valid: boolean;
        totalCost?: number;
        ticketType?: TicketType;
        message?: string;
    }> {
        try {
            if (!AppDataSource.isInitialized) {
                return { valid: false, message: "Database connection not initialized for ticket cost calculation." };
            }
            const ticketTypeRepository = AppDataSource.getRepository(TicketType);
            // ... rest of the logic
            return { valid: true };
        } catch (error) {
            console.error("Error validating ticket cost:", error);
            return { valid: false, message: "Error calculating ticket cost" };
        }
    }
}