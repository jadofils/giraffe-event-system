import { Request, Response } from 'express';
import { TicketTypeRepository } from '../repositories/TicketTypeRepository';

const ticketTypeRepo = new TicketTypeRepository();

export class TicketTypeController {
  async createTicketType(req: Request, res: Response): Promise<void> {
    try {
      const ticketTypeData = req.body;
      const result = await ticketTypeRepo.create(ticketTypeData);

      if (!result.success) {
        res.status(400).json({ success: false, message: result.message });
        return;
      }

      res.status(201).json({
        success: true,
        message: result.message,
        data: result.data
      });
    } catch (error) {
      console.error('Controller error:', error);
      res.status(500).json({ success: false, message: 'Failed to create ticket type' });
    }
  }

  async getAllTicketTypes(req: Request, res: Response): Promise<void> {
    try {
      const result = await ticketTypeRepo.findAll();
      
      res.status(200).json({
        success: result.success,
        message: result.message,
        data: result.data
      });
    } catch (error) {
      console.error('Controller error:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch ticket types' });
    }
  }

  async getTicketTypeById(req: Request, res: Response): Promise<void> {
    try {
      const { ticketTypeId } = req.params;
      const result = await ticketTypeRepo.findById(ticketTypeId);

      if (!result.success) {
        res.status(404).json({ success: false, message: result.message });
        return;
      }

      res.status(200).json({
        success: true,
        message: result.message,
        data: result.data
      });
    } catch (error) {
      console.error('Controller error:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch ticket type' });
    }
  }

  async updateTicketType(req: Request, res: Response): Promise<void> {
    try {
      const { ticketTypeId } = req.params;
      const updateData = req.body;
      const result = await ticketTypeRepo.update(ticketTypeId, updateData);

      if (!result.success) {
        res.status(404).json({ success: false, message: result.message });
        return;
      }

      res.status(200).json({
        success: true,
        message: result.message,
        data: result.data
      });
    } catch (error) {
      console.error('Controller error:', error);
      res.status(500).json({ success: false, message: 'Failed to update ticket type' });
    }
  }

  async deleteTicketType(req: Request, res: Response): Promise<void> {
    try {
      const { ticketTypeId } = req.params;
      const result = await ticketTypeRepo.delete(ticketTypeId);

      if (!result.success) {
        res.status(404).json({ success: false, message: result.message });
        return;
      }

      res.status(200).json({ 
        success: true, 
        message: result.message 
      });
    } catch (error) {
      console.error('Controller error:', error);
      res.status(500).json({ success: false, message: 'Failed to delete ticket type' });
    }
  }
}