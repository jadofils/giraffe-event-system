import { AppDataSource } from '../config/Database';
import { TicketType } from '../models/TicketType';

export class TicketTypeRepository {
  private repository = AppDataSource.getRepository(TicketType);

  async create(ticketType: Partial<TicketType>): Promise<{
    success: boolean;
    message: string;
    data?: TicketType;
  }> {
    // Traditional validation
    if (!ticketType.ticketName) {
      return { success: false, message: 'Ticket name is required.' };
    }

    if (ticketType.price === undefined || ticketType.price === null) {
      return { success: false, message: 'Ticket price is required.' };
    }

    if (typeof ticketType.price !== 'number' || ticketType.price <= 0) {
      return { success: false, message: 'Ticket price must be a positive number.' };
    }

    if (!ticketType.description) {
      return { success: false, message: 'Ticket description is required.' };
    }

    try {
        //ticket already exists 

        const existingTicketType = await this.repository.findOneBy({ ticketName: ticketType.ticketName });
        if (existingTicketType) {
          return { success: false, message: 'Ticket type already exists.' };
        }
      const newTicketType = this.repository.create(ticketType);
      const saved = await this.repository.save(newTicketType);
      return { success: true, message: 'Ticket created successfully.', data: saved };
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : 'Unknown error during ticket creation.';
      return { success: false, message: errMsg };
    }
  }

  async findAll(): Promise<{ success: boolean; message: string; data: TicketType[] }> {
    try {
      const tickets = await this.repository.find();
      return { success: true, message: 'Ticket types fetched successfully', data: tickets };
    } catch (error) {
      console.error('Fetch error:', error);
      return { success: false, message: 'Failed to fetch ticket types', data: [] };
    }
  }

  async findById(ticketTypeId: string): Promise<{ success: boolean; message: string; data?: TicketType }> {
    try {
      console.log('Searching for ticketTypeId:', ticketTypeId);
  
      const ticket = await this.repository.createQueryBuilder('ticket')
        .where('ticket.ticketTypeId = :ticketTypeId', { ticketTypeId })
        .andWhere('ticket.deletedAt IS NULL')
        .getOne();
  
      if (!ticket) {
        return { success: false, message: 'Ticket type not found' };
      }
  
      return { success: true, message: 'Ticket type found', data: ticket };
    } catch (error) {
      console.error('FindById error:', error);
      return { success: false, message: 'Failed to find ticket type' };
    }
  }
  

  async update(ticketTypeId: string, updateData: Partial<TicketType>): Promise<{ success: boolean; message: string; data?: TicketType }> {
    const { success, data } = await this.findById(ticketTypeId);
    if (!success || !data) {
      return { success: false, message: 'Ticket type not found' };
    }

    try {
      Object.assign(data, updateData);
      const updated = await this.repository.save(data);
      return { success: true, message: 'Ticket type updated', data: updated };
    } catch (error) {
      console.error('Update error:', error);
      return { success: false, message: 'Failed to update ticket type' };
    }
  }

  async delete(ticketTypeId: string): Promise<{ success: boolean; message: string }> {
    try {
      // First check if the ticket type exists
      const existing = await this.repository.findOne({
        where: { ticketTypeId },
        relations: ['payments'] // Include related payments
      });
      
      if (!existing) {
        return { success: false, message: 'Ticket type not found' };
      }
      
      // Check if there are any related payments
      if (existing.payments && existing.payments.length > 0) {
        return { 
          success: false, 
          message: `Cannot delete this ticket type because it is associated with ${existing.payments.length} payment records` 
        };
      }
  
      // If no related payments, proceed with deletion
      const result = await this.repository.delete({ ticketTypeId });
      
      if (result.affected && result.affected > 0) {
        return { success: true, message: 'Ticket type deleted successfully' };
      } else {
        console.warn('Delete operation returned 0 affected rows despite existing record:', ticketTypeId);
        return { success: false, message: 'Ticket type could not be deleted for an unknown reason' };
      }
    } catch (error: any) {
      console.error('Delete error:', error);
      
      // Check for foreign key constraint violations
      if (error.message && (
        error.message.includes('foreign key constraint') || 
        error.message.includes('violates foreign key')
      )) {
        return { 
          success: false, 
          message: 'Cannot delete this ticket type because it is being used by existing payments' 
        };
      }
      
      return { 
        success: false, 
        message: 'Failed to delete ticket type. Check database constraints or ID format.' 
      };
    }
  }
}
