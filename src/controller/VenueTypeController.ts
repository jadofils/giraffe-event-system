import { Request, Response } from "express";
import { VenueTypeRepository } from "../repositories/VenueTypeRepository";

export class VenueTypeController {
  static async createVenueType(req: Request, res: Response): Promise<void> {
    try {
      const { name, description, isActive } = req.body;
      if (!name) {
        res.status(400).json({ success: false, message: "Name is required" });
        return;
      }
      const venueType = await VenueTypeRepository.create({ 
        name, 
        description, 
        isActive: isActive !== undefined ? isActive : true // default to true if not provided
      });
      res.status(201).json({ success: true, data: venueType });
    } catch (err) {
      res.status(500).json({ success: false, message: "Failed to create venue type", error: err instanceof Error ? err.message : err });
    }
  }

  static async getAllVenueTypes(req: Request, res: Response): Promise<void> {
    try {
      const venueTypes = await VenueTypeRepository.findAll();
      res.status(200).json({ success: true, data: venueTypes });
    } catch (err) {
      res.status(500).json({ success: false, message: "Failed to fetch venue types", error: err instanceof Error ? err.message : err });
    }
  }

  static async getVenueTypeById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const venueType = await VenueTypeRepository.findById(id);
      if (!venueType) {
        res.status(404).json({ success: false, message: "Venue type not found" });
        return;
      }
      res.status(200).json({ success: true, data: venueType });
    } catch (err) {
      res.status(500).json({ success: false, message: "Failed to fetch venue type", error: err instanceof Error ? err.message : err });
    }
  }

  static async updateVenueType(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { name, description, isActive } = req.body;
      const updated = await VenueTypeRepository.update(id, { name, description, isActive });
      if (!updated) {
        res.status(404).json({ success: false, message: "Venue type not found" });
        return;
      }
      res.status(200).json({ success: true, data: updated });
    } catch (err) {
      res.status(500).json({ success: false, message: "Failed to update venue type", error: err instanceof Error ? err.message : err });
    }
  }

  static async deleteVenueType(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const deleted = await VenueTypeRepository.delete(id);
      if (!deleted) {
        res.status(404).json({ success: false, message: "Venue type not found" });
        return;
      }
      res.status(200).json({ success: true, message: "Venue type deleted (soft)" });
    } catch (err) {
      res.status(500).json({ success: false, message: "Failed to delete venue type", error: err instanceof Error ? err.message : err });
    }
  }
} 