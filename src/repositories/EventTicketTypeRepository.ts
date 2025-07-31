import { AppDataSource } from "../config/Database";
import { EventTicketType } from "../models/Event Tables/EventTicketType";
import { FindManyOptions, Repository, Not, DeleteResult } from "typeorm";
import { TicketStatus } from "../interfaces/Enums/TicketEnums";

export class EventTicketTypeRepository {
  private static repository: Repository<EventTicketType> =
    AppDataSource.getRepository(EventTicketType);

  static async createEventTicketType(
    ticketTypeData: Partial<EventTicketType>
  ): Promise<EventTicketType> {
    const newTicketTypes = this.repository.create(ticketTypeData);
    const savedTicketTypes = await this.repository.save(newTicketTypes);
    return savedTicketTypes; // Assuming save returns the single entity if passed a single entity
  }

  static async getEventTicketTypesByEventId(
    eventId: string
  ): Promise<EventTicketType[]> {
    return await this.repository.find({ where: { eventId } });
  }

  static async getEventTicketTypeById(
    ticketTypeId: string
  ): Promise<EventTicketType | null> {
    return await this.repository.findOne({ where: { ticketTypeId } });
  }

  static async updateEventTicketType(
    ticketTypeId: string,
    updateData: Partial<EventTicketType>
  ): Promise<EventTicketType | null> {
    const result = await this.repository.update(ticketTypeId, updateData);
    if (result.affected === 0) {
      return null; // No rows updated
    }
    return await this.getEventTicketTypeById(ticketTypeId); // Fetch the updated entity
  }

  // Method to delete a ticket type
  static async deleteEventTicketType(
    ticketTypeId: string
  ): Promise<DeleteResult> {
    return await this.repository.delete(ticketTypeId);
  }

  // Method to get ticket types that are not INACTIVE
  static async getNonInactiveTicketTypesByEventId(
    eventId: string
  ): Promise<EventTicketType[]> {
    return await this.repository.find({
      where: { eventId, status: Not(TicketStatus.INACTIVE) },
    });
  }

  // Method for batch creation of ticket types
  static async createEventTicketTypeBatch(
    ticketTypesData: Partial<EventTicketType>[]
  ): Promise<EventTicketType[]> {
    const newTicketTypes = this.repository.create(ticketTypesData);
    return await this.repository.save(newTicketTypes);
  }

  static async findByNameAndEventId(
    name: string,
    eventId: string
  ): Promise<EventTicketType | null> {
    return await this.repository.findOne({ where: { name, eventId } });
  }

  static async getTotalTicketsAvailableByEventId(
    eventId: string,
    excludeTicketTypeId?: string
  ): Promise<number> {
    let query = this.repository
      .createQueryBuilder("ticketType")
      .select("SUM(ticketType.quantityAvailable)", "totalAvailable")
      .where("ticketType.eventId = :eventId", { eventId });

    if (excludeTicketTypeId) {
      query = query.andWhere(
        "ticketType.ticketTypeId != :excludeTicketTypeId",
        { excludeTicketTypeId }
      );
    }

    const result = await query.getRawOne();
    return Number(result?.totalAvailable) || 0;
  }
}
