import { AppDataSource } from '../config/Database';
import { TicketType } from '../models/TicketType';
import { Registration } from '../models/Registration';

export class TicketTypeRepository {
  private repository = AppDataSource.getRepository(TicketType);

  async create(ticketType: Partial<TicketType>): Promise<{
    success: boolean;
    message: string;
    data?: TicketType;
  }> {
    if (!ticketType.ticketName) {
      return { success: false, message: 'Ticket name is required.' };
    }

    if (ticketType.price === undefined || ticketType.price === null) {
      return { success: false, message: 'Ticket price is required.' };
    }

    if (typeof ticketType.price !== 'number' || ticketType.price <= 0) {
      return { success: false, message: 'Ticket price must be a positive number.' };
    }

    try {
      // Check if ticket type already exists
      const existingTicketType = await this.repository.findOneBy({ ticketName: ticketType.ticketName });
      if (existingTicketType) {
        return { success: false, message: 'Ticket type already exists.' };
      }

      const newTicketType = this.repository.create(ticketType);
      const saved = await this.repository.save(newTicketType);
      return { success: true, message: 'Ticket type created successfully.', data: saved };
    } catch (error) {
      return { success: false, message: error instanceof Error ? error.message : 'Unknown error during ticket creation.' };
    }
  }

  async findAll(): Promise<{ success: boolean; message: string; data: TicketType[] }> {
    try {
      const tickets = await this.repository.find();
      return { success: true, message: 'Ticket types fetched successfully.', data: tickets };
    } catch (error) {
      return { success: false, message: 'Failed to fetch ticket types.', data: [] };
    }
  }

  async findById(ticketTypeId: string): Promise<{ success: boolean; message: string; data?: TicketType }> {
    try {
      const ticket = await this.repository.findOne({ where: { ticketTypeId } });

      if (!ticket) {
        return { success: false, message: 'Ticket type not found.' };
      }

      return { success: true, message: 'Ticket type found.', data: ticket };
    } catch (error) {
      return { success: false, message: 'Failed to find ticket type.' };
    }
  }

  async update(ticketTypeId: string, updateData: Partial<TicketType>): Promise<{ success: boolean; message: string; data?: TicketType }> {
    const { success, data } = await this.findById(ticketTypeId);
    if (!success || !data) {
      return { success: false, message: 'Ticket type not found.' };
    }

    try {
      Object.assign(data, updateData);
      const updated = await this.repository.save(data);
      return { success: true, message: 'Ticket type updated.', data: updated };
    } catch (error) {
      return { success: false, message: 'Failed to update ticket type.' };
    }
  }

  async delete(ticketTypeId: string): Promise<{ success: boolean; message: string }> {
    try {
      // Check if ticket type exists and if it is linked to registrations
      const existing = await this.repository.findOne({
        where: { ticketTypeId },
        relations: ['registrations'], // Ensure TicketType is linked properly to Registrations
      });

      if (!existing) {
        return { success: false, message: 'Ticket type not found.' };
      }

      // Prevent deletion if ticket type is used in registrations
      if (existing.registrations && existing.registrations.length > 0) {
        return { success: false, message: `Cannot delete this ticket type because it is used in ${existing.registrations.length} registrations.` };
      }

      // Proceed with deletion
      const result = await this.repository.delete({ ticketTypeId });

      if (result.affected && result.affected > 0) {
        return { success: true, message: 'Ticket type deleted successfully.' };
      } else {
        return { success: false, message: 'Ticket type could not be deleted for an unknown reason.' };
      }
    } catch (error) {
      return { success: false, message: 'Failed to delete ticket type. Check database constraints or ID format.' };
    }
  }
}
