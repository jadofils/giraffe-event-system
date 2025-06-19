import { Request, Response } from "express";
import { AuthenticatedRequest } from "../middlewares/AuthMiddleware";

import { VenueInterface } from "../interfaces/VenueInterface";
import { EventRepository } from "../repositories/eventRepository";
import { VenueRepository } from "../repositories/venueRepository";

export class VenueController {
  // Create a single venue
  static async create(req: AuthenticatedRequest, res: Response): Promise<void> {
    const userId = req.user?.userId;
    const {
      venueName,
      capacity,
      location,
      amount,
      managerId,
      latitude,
      longitude,
      googleMapsLink,
    }: Partial<VenueInterface> = req.body;

    if (!userId) {
      res
        .status(401)
        .json({ success: false, message: "Authentication required." });
      return;
    }

    if (!venueName || !capacity || !location || !amount) {
      res.status(400).json({
        success: false,
        message: "Required fields: venueName, capacity, location, amount.",
      });
      return;
    }

    try {
      const newVenueData: Partial<VenueInterface> = {
        venueName,
        capacity,
        location,
        amount,
        managerId,
        latitude,
        longitude,
        googleMapsLink,
      };

      const createResult = await VenueRepository.create(newVenueData);
      if (!createResult.success || !createResult.data) {
        res.status(400).json({ success: false, message: createResult.message });
        return;
      }

      const saveResult = await VenueRepository.save(createResult.data);
      if (saveResult.success && saveResult.data) {
        res.status(201).json({
          success: true,
          message: "Venue created successfully.",
          data: saveResult.data,
        });
      } else {
        res.status(500).json({
          success: false,
          message: saveResult.message || "Failed to save venue.",
        });
      }
    } catch (err) {
      console.error("Error creating venue:", err);
      res.status(500).json({
        success: false,
        message: "Failed to create venue due to a server error.",
      });
    }
  }

  // Create multiple venues
  static async createMultiple(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    const userId = req.user?.userId;
    const venuesData: Partial<VenueInterface>[] = req.body.venues;

    if (!userId) {
      res
        .status(401)
        .json({ success: false, message: "Authentication required." });
      return;
    }

    if (!venuesData || !Array.isArray(venuesData) || venuesData.length === 0) {
      res.status(400).json({
        success: false,
        message: "An array of venue data is required.",
      });
      return;
    }

    try {
      const createResult = await VenueRepository.createMultiple(venuesData);
      res.status(createResult.success ? 201 : 207).json({
        success: createResult.success,
        message: createResult.success
          ? "All venues created successfully."
          : "Some venues failed to create.",
        data: createResult.venues,
        errors: createResult.errors,
      });
    } catch (err) {
      console.error("Error creating multiple venues:", err);
      res.status(500).json({
        success: false,
        message: "Failed to create venues due to a server error.",
      });
    }
  }

  // Get venue by ID
  static async getById(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    if (!id) {
      res
        .status(400)
        .json({ success: false, message: "Venue ID is required." });
      return;
    }

    try {
      const result = await VenueRepository.getById(id);
      if (result.success && result.data) {
        res.status(200).json({ success: true, data: result.data });
      } else {
        res.status(404).json({
          success: false,
          message: result.message || "Venue not found.",
        });
      }
    } catch (err) {
      console.error("Error getting venue by ID:", err);
      res
        .status(500)
        .json({ success: false, message: "Failed to get venue by ID." });
    }
  }

  // Get venues by manager ID
  static async getByManagerId(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    const userId = req.user?.userId;
    if (!userId) {
      res
        .status(401)
        .json({ success: false, message: "Authentication required." });
      return;
    }

    try {
      const result = await VenueRepository.getByManagerId(userId);
      if (result.success && result.data) {
        res.status(200).json({ success: true, data: result.data });
      } else {
        res.status(404).json({
          success: false,
          message: result.message || "No venues found for this manager.",
        });
      }
    } catch (err) {
      console.error("Error getting venues by manager ID:", err);
      res.status(500).json({
        success: false,
        message: "Failed to get venues by manager ID.",
      });
    }
  }

  // Get all venues
  static async getAll(req: Request, res: Response): Promise<void> {
    try {
      const result = await VenueRepository.getAll();
      if (result.success && result.data) {
        res.status(200).json({ success: true, data: result.data });
      } else {
        res.status(200).json({
          success: false,
          message: result.message || "No venues found.",
        });
      }
    } catch (err) {
      console.error("Error getting all venues:", err);
      res
        .status(500)
        .json({ success: false, message: "Failed to get all venues." });
    }
  }

  // Update venue
  static async update(req: AuthenticatedRequest, res: Response): Promise<void> {
    const { id } = req.params;
    const userId = req.user?.userId;
    const {
      venueName,
      capacity,
      location,
      amount,
      managerId,
      latitude,
      longitude,
      googleMapsLink,
    }: Partial<VenueInterface> = req.body;

    if (!id) {
      res
        .status(400)
        .json({ success: false, message: "Venue ID is required." });
      return;
    }

    if (!userId) {
      res
        .status(401)
        .json({ success: false, message: "Authentication required." });
      return;
    }

    try {
      const updateData: Partial<VenueInterface> = {
        venueName,
        capacity,
        location,
        amount,
        managerId,
        latitude,
        longitude,
        googleMapsLink,
      };

      const updateResult = await VenueRepository.update(id, updateData);
      if (updateResult.success && updateResult.data) {
        res.status(200).json({
          success: true,
          message: "Venue updated successfully.",
          data: updateResult.data,
        });
      } else {
        res.status(404).json({
          success: false,
          message: updateResult.message || "Venue not found.",
        });
      }
    } catch (err) {
      console.error("Error updating venue:", err);
      res.status(500).json({
        success: false,
        message: "Failed to update venue due to a server error.",
      });
    }
  }

  // Update venue manager
  static async updateVenueManager(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    const userId = req.user?.userId;
    const { venueId, managerId } = req.body;

    if (!userId) {
      res
        .status(401)
        .json({ success: false, message: "Authentication required." });
      return;
    }

    if (!venueId || !managerId) {
      res.status(400).json({
        success: false,
        message: "Venue ID and manager ID are required.",
      });
      return;
    }

    try {
      const result = await VenueRepository.updateVenueManager(
        venueId,
        managerId
      );
      if (result.success && result.data) {
        res.status(200).json({
          success: true,
          message: "Venue manager updated successfully.",
          data: result.data,
        });
      } else {
        res.status(400).json({
          success: false,
          message: result.message || "Failed to update venue manager.",
        });
      }
    } catch (err) {
      console.error("Error updating venue manager:", err);
      res.status(500).json({
        success: false,
        message: "Failed to update venue manager due to a server error.",
      });
    }
  }

  // Remove venue manager
  static async removeVenueManager(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    const userId = req.user?.userId;
    const { venueId } = req.params;

    if (!userId) {
      res
        .status(401)
        .json({ success: false, message: "Authentication required." });
      return;
    }

    if (!venueId) {
      res
        .status(400)
        .json({ success: false, message: "Venue ID is required." });
      return;
    }

    try {
      const result = await VenueRepository.removeVenueManager(venueId);
      if (result.success && result.data) {
        res.status(200).json({
          success: true,
          message: "Venue manager removed successfully.",
          data: result.data,
        });
      } else {
        res.status(400).json({
          success: false,
          message: result.message || "Failed to remove venue manager.",
        });
      }
    } catch (err) {
      console.error("Error removing venue manager:", err);
      res.status(500).json({
        success: false,
        message: "Failed to remove venue manager due to a server error.",
      });
    }
  }

  // Delete venue (soft delete)
  static async delete(req: AuthenticatedRequest, res: Response): Promise<void> {
    const { id } = req.params;
    const userId = req.user?.userId;

    if (!id) {
      res
        .status(400)
        .json({ success: false, message: "Venue ID is required." });
      return;
    }

    if (!userId) {
      res
        .status(401)
        .json({ success: false, message: "Authentication required." });
      return;
    }

    try {
      const deleteResult = await VenueRepository.delete(id);
      if (deleteResult.success) {
        res.status(200).json({
          success: true,
          message: deleteResult.message || "Venue deleted successfully.",
        });
      } else {
        res.status(404).json({
          success: false,
          message: deleteResult.message || "Venue not found.",
        });
      }
    } catch (err) {
      console.error("Error deleting venue:", err);
      res
        .status(500)
        .json({ success: false, message: "Failed to delete venue." });
    }
  }

  // Restore soft-deleted venue
  static async restore(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    const { id } = req.params;
    const userId = req.user?.userId;

    if (!id) {
      res
        .status(400)
        .json({ success: false, message: "Venue ID is required." });
      return;
    }

    if (!userId) {
      res
        .status(401)
        .json({ success: false, message: "Authentication required." });
      return;
    }

    try {
      const restoreResult = await VenueRepository.restore(id);
      if (restoreResult.success && restoreResult.data) {
        res.status(200).json({
          success: true,
          message: "Venue restored successfully.",
          data: restoreResult.data,
        });
      } else {
        res.status(404).json({
          success: false,
          message: restoreResult.message || "Venue not found or not deleted.",
        });
      }
    } catch (err) {
      console.error("Error restoring venue:", err);
      res
        .status(500)
        .json({ success: false, message: "Failed to restore venue." });
    }
  }

  // Get soft-deleted venues
  static async getDeleted(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    const userId = req.user?.userId;

    if (!userId) {
      res
        .status(401)
        .json({ success: false, message: "Authentication required." });
      return;
    }

    try {
      const result = await VenueRepository.getDeleted();
      if (result.success && result.data) {
        res.status(200).json({ success: true, data: result.data });
      } else {
        res.status(200).json({
          success: false,
          message: result.message || "No deleted venues found.",
        });
      }
    } catch (err) {
      console.error("Error getting deleted venues:", err);
      res
        .status(500)
        .json({ success: false, message: "Failed to get deleted venues." });
    }
  }

  // Check venue event conflicts
  static async checkVenueEventConflicts(
    req: Request,
    res: Response
  ): Promise<void> {
    const { venueId, startDate, endDate, startTime, endTime } = req.query;

    if (
      !venueId ||
      !startDate ||
      !endDate ||
      typeof venueId !== "string" ||
      typeof startDate !== "string" ||
      typeof endDate !== "string"
    ) {
      res.status(400).json({
        success: false,
        message: "Venue ID, startDate, and endDate are required.",
      });
      return;
    }

    try {
      const start = new Date(startDate);
      const end = new Date(endDate);
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        res
          .status(400)
          .json({ success: false, message: "Invalid date format." });
        return;
      }

      const venueResult = await VenueRepository.getById(venueId);
      if (!venueResult.success || !venueResult.data) {
        res.status(404).json({ success: false, message: "Venue not found." });
        return;
      }

      // Combine date and time for precise overlap check
      const startDateTime = startTime
        ? new Date(`${startDate}T${startTime}:00Z`)
        : start;
      const endDateTime = endTime ? new Date(`${endDate}T${endTime}:00Z`) : end;

      const eventsResult = await EventRepository.getByVenueId(venueId);
      if (eventsResult.success && eventsResult.data) {
        const conflictingEvents = eventsResult.data.filter((event) => {
          const eventStart = event.startTime
            ? new Date(
                `${event.startDate.toISOString().split("T")[0]}T${
                  event.startTime
                }:00Z`
              )
            : event.startDate;
          const eventEnd = event.endTime
            ? new Date(
                `${event.endDate.toISOString().split("T")[0]}T${
                  event.endTime
                }:00Z`
              )
            : event.endDate;

          return (
            eventStart <= endDateTime &&
            eventEnd >= startDateTime &&
            event.status !== "CANCELLED"
          );
        });

        if (conflictingEvents.length > 0) {
          res.status(200).json({
            success: true,
            available: false,
            message: "Venue is booked for the requested period.",
            conflicts: conflictingEvents.map((e) => ({
              eventId: e.eventId,
              eventTitle: e.eventTitle,
            })),
          });
          return;
        }
      }

      res.status(200).json({
        success: true,
        available: true,
        message: "Venue is available for the requested period.",
      });
    } catch (err) {
      console.error("Error checking venue event conflicts:", err);
      res.status(500).json({
        success: false,
        message: "Failed to check venue event conflicts.",
      });
    }
  }

  // Search venues
  static async searchVenues(req: Request, res: Response): Promise<void> {
    const {
      name,
      location,
      minCapacity,
      maxCapacity,
      isAvailable,
      hasManager,
    } = req.query;

    const criteria: {
      name?: string;
      location?: string;
      minCapacity?: number;
      maxCapacity?: number;
      isAvailable?: boolean;
      hasManager?: boolean;
    } = {};

    if (name && typeof name === "string") criteria.name = name;
    if (location && typeof location === "string") criteria.location = location;
    if (minCapacity && !isNaN(Number(minCapacity)))
      criteria.minCapacity = Number(minCapacity);
    if (maxCapacity && !isNaN(Number(maxCapacity)))
      criteria.maxCapacity = Number(maxCapacity);
    if (
      isAvailable !== undefined &&
      (isAvailable === "true" || isAvailable === "false")
    )
      criteria.isAvailable = isAvailable === "true";
    if (
      hasManager !== undefined &&
      (hasManager === "true" || hasManager === "false")
    )
      criteria.hasManager = hasManager === "true";

    try {
      const result = await VenueRepository.searchVenues(criteria);
      if (result.success && result.data) {
        res.status(200).json({ success: true, data: result.data });
      } else {
        res.status(200).json({
          success: false,
          message: result.message || "No venues found.",
        });
      }
    } catch (err) {
      console.error("Error searching venues:", err);
      res
        .status(500)
        .json({ success: false, message: "Failed to search venues." });
    }
  }

  // Get venue count
  static async getVenueCount(req: Request, res: Response): Promise<void> {
    try {
      const result = await VenueRepository.getVenueCount();
      if (result.success && result.count !== undefined) {
        res.status(200).json({ success: true, count: result.count });
      } else {
        res.status(200).json({
          success: false,
          message: result.message || "Failed to get venue count.",
        });
      }
    } catch (err) {
      console.error("Error getting venue count:", err);
      res
        .status(500)
        .json({ success: false, message: "Failed to get venue count." });
    }
  }

  // Get venues by proximity
  static async getVenuesByProximity(
    req: Request,
    res: Response
  ): Promise<void> {
    const { latitude, longitude, radius } = req.query;

    if (
      !latitude ||
      !longitude ||
      !radius ||
      typeof latitude !== "string" ||
      typeof longitude !== "string" ||
      typeof radius !== "string"
    ) {
      res.status(400).json({
        success: false,
        message: "Latitude, longitude, and radius are required.",
      });
      return;
    }

    try {
      const lat = parseFloat(latitude);
      const lon = parseFloat(longitude);
      const rad = parseFloat(radius);

      if (isNaN(lat) || isNaN(lon) || isNaN(rad)) {
        res.status(400).json({
          success: false,
          message: "Invalid latitude, longitude, or radius format.",
        });
        return;
      }

      const result = await VenueRepository.getVenuesByProximity(lat, lon, rad);
      if (result.success && result.data) {
        res.status(200).json({ success: true, data: result.data });
      } else {
        res.status(200).json({
          success: false,
          message: result.message || "No venues found within radius.",
        });
      }
    } catch (err) {
      console.error("Error getting venues by proximity:", err);
      res.status(500).json({
        success: false,
        message: "Failed to get venues by proximity.",
      });
    }
  }

  // Assign a user as manager to a venue (simple version)
  static async assignManagerToVenue(
    req: Request,
    res: Response
  ): Promise<void> {
    const { venueId, userId } = req.body;

    if (!venueId || !userId) {
      res
        .status(400)
        .json({ success: false, message: "venueId and userId are required." });
      return;
    }

    try {
      // Find the venue
      const venueResult = await VenueRepository.getById(venueId);
      if (!venueResult.success || !venueResult.data) {
        res.status(404).json({ success: false, message: "Venue not found." });
        return;
      }
      // Find the user
      const userRepo = require("../models/User");
      const { AppDataSource } = require("../config/Database");
      const user = await AppDataSource.getRepository(userRepo.User).findOne({
        where: { userId },
      });
      if (!user) {
        res.status(404).json({ success: false, message: "User not found." });
        return;
      }
      // Assign user as manager
      venueResult.data.managerId = userId;
      venueResult.data.manager = user;
      const saveResult = await VenueRepository.save(venueResult.data);
      if (saveResult.success && saveResult.data) {
        res.status(200).json({
          success: true,
          message: "User assigned as venue manager successfully.",
          data: saveResult.data,
        });
      } else {
        res.status(500).json({
          success: false,
          message: saveResult.message || "Failed to assign manager.",
        });
      }
    } catch (err) {
      console.error("Error assigning manager to venue:", err);
      res.status(500).json({
        success: false,
        message: "Failed to assign manager due to a server error.",
      });
    }
  }
}
