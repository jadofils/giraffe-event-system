import { Repository } from "typeorm";
import { AppDataSource } from "../config/Database";
import { Registration } from "../models/Registration";
import { RegistrationRequestInterface } from "../interfaces/RegistrationInterface";
import { QrCodeService } from "../services/registrations/QrCodeService";
import { Event } from "../models/Event";
import { User } from "../models/User";
import { TicketType } from "../models/TicketType";
import { Venue } from "../models/Venue Tables/Venue";

export class RegistrationRepository {
  // Get repository using the initialized AppDataSource
  public static getRepository(): Repository<Registration> {
    if (!AppDataSource.isInitialized) {
      throw new Error(
        "AppDataSource is not initialized. Call AppDataSource.initialize() first."
      );
    }
    return AppDataSource.getRepository(Registration);
  }

  // Create a new registration
  static async create(
    registrationData: Partial<RegistrationRequestInterface>
  ): Promise<Registration> {
    try {
      const repository = this.getRepository();

      // Fetch related entities
      const event = await AppDataSource.getRepository(Event).findOne({
        where: { eventId: registrationData.eventId },
      });
      const user = await AppDataSource.getRepository(User).findOne({
        where: { userId: registrationData.userId },
      });
      const buyer = registrationData.buyerId
        ? await AppDataSource.getRepository(User).findOne({
            where: { userId: registrationData.buyerId },
          })
        : user; // Default to user if buyerId not provided
      const ticketType = await AppDataSource.getRepository(TicketType).findOne({
        where: { ticketTypeId: registrationData.ticketTypeId },
      });
      const venue = await AppDataSource.getRepository(Venue).findOne({
        where: { venueId: registrationData.venueId },
      });

      if (!event || !user || !buyer || !ticketType || !venue) {
        throw new Error(
          "Missing required entity for registration after validation."
        );
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

      return await repository.save(registration);
    } catch (error) {
      console.error("Error creating registration:", error);
      throw error;
    }
  }

  // Find all registrations
  static async findAll(): Promise<Registration[]> {
    try {
      const repository = this.getRepository();
      return await repository.find({
        relations: ["event", "user", "buyer", "ticketType", "venue"],
      });
    } catch (error) {
      console.error("Error finding all registrations:", error);
      throw error;
    }
  }

  // Find registration by ID
  static async findById(registrationId: string): Promise<Registration | null> {
    try {
      const repository = this.getRepository();
      const registration = await repository.findOne({
        where: { registrationId },
        relations: ["event", "user", "buyer", "ticketType", "venue"],
      });
      return registration || null;
    } catch (error) {
      console.error(
        `Error finding registration by ID ${registrationId}:`,
        error
      );
      throw error;
    }
  }

  // Update a registration
  static async update(
    registrationId: string,
    updateData: Partial<RegistrationRequestInterface>
  ): Promise<Registration | null> {
    try {
      const repository = this.getRepository();
      const registration = await this.findById(registrationId);
      if (!registration) {
        return null;
      }

      // Fetch related entities if their IDs are provided
      if (updateData.eventId) {
        registration.event =
          (await AppDataSource.getRepository(Event).findOne({
            where: { eventId: updateData.eventId },
          })) || registration.event;
      }
      if (updateData.userId) {
        registration.user =
          (await AppDataSource.getRepository(User).findOne({
            where: { userId: updateData.userId },
          })) || registration.user;
      }
      if (updateData.buyerId) {
        registration.buyer =
          (await AppDataSource.getRepository(User).findOne({
            where: { userId: updateData.buyerId },
          })) || registration.buyer;
      }
      if (updateData.ticketTypeId) {
        registration.ticketType =
          (await AppDataSource.getRepository(TicketType).findOne({
            where: { ticketTypeId: updateData.ticketTypeId },
          })) || registration.ticketType;
      }
      if (updateData.venueId) {
        registration.venue =
          (await AppDataSource.getRepository(Venue).findOne({
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
      if (updateData.qrCode) registration.qrCode = updateData.qrCode;
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

      return await repository.save(registration);
    } catch (error) {
      console.error(`Error updating registration ${registrationId}:`, error);
      throw error;
    }
  }

  // Delete a registration
  static async delete(registrationId: string): Promise<boolean> {
    try {
      const repository = this.getRepository();
      const result = await repository.delete(registrationId);
      return typeof result.affected === "number" && result.affected > 0;
    } catch (error) {
      console.error(`Error deleting registration ${registrationId}:`, error);
      throw error;
    }
  }

  // Find registrations by event ID
  static async findByEventId(eventId: string): Promise<Registration[]> {
    try {
      const repository = this.getRepository();
      return await repository.find({
        where: { event: { eventId } },
        relations: ["event", "user", "buyer", "ticketType", "venue"],
      });
    } catch (error) {
      console.error(`Error finding registrations for event ${eventId}:`, error);
      throw error;
    }
  }

  // Find registration by QR code
  static async findByQRCode(
    rawQrCodeDataString: string
  ): Promise<Registration | null> {
    try {
      const qrPayload = await QrCodeService.validateQrCode(rawQrCodeDataString);
      if (!qrPayload) {
        return null;
      }
      const { registrationId } = qrPayload;
      return await this.findById(registrationId);
    } catch (error) {
      console.error(`Error finding registration by QR code:`, error);
      return null;
    }
  }
}
