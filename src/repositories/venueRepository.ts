import { VenueInterface } from "../interfaces/VenueInterface";
import { Venue } from "../models/Venue"; // Assuming a Venue model (e.g., TypeORM entity or Mongoose schema)
import { AppDataSource } from "../config/Database";
import { VenueBooking } from "../models/VenueBooking";
import { GeoLocation } from "../utils/GeoLocation"; // Utility for proximity calculations
import { IsNull, Not, Like, MoreThanOrEqual, LessThanOrEqual, Between } from "typeorm";

export class VenueRepository {
  private static dbService = AppDataSource.getRepository(Venue);

  // Create a single venue
  static async createVenue(data: Partial<VenueInterface>): Promise<{
    success: boolean;
    data?: VenueInterface[];
    message?: string;
  }> {
    try {
      if (!data.venueName || !data.organizationId || !data.managerId) {
        return {
          success: false,
          message: "Venue name, organization ID, and manager ID are required.",
        };
      }

      const venue: VenueInterface = {
        ...data,
        createdAt: new Date(),
        updatedAt: new Date(),
        isDeleted: false,
      } as VenueInterface;

      return { success: true, data: [venue] };
    } catch (error) {
      console.error("Error in createVenue:", error);
      return { success: false, message: "Failed to create venue." };
    }
  }

  // Save a single venue to the database
  static async saveVenue(venue: VenueInterface): Promise<{
    success: boolean;
    data?: VenueInterface[];
    message?: string;
  }> {
    try {
      const savedVenue = await this.dbService.save(venue);
      return { success: true, data: [savedVenue] };
    } catch (error) {
      console.error("Error in saveVenue:", error);
      return { success: false, message: "Failed to save venue to database." };
    }
  }

  // Create multiple venues
  static async createMultipleVenues(venuesData: Partial<VenueInterface>[]): Promise<{
    success: boolean;
    data?: VenueInterface[];
    venues?: VenueInterface[];
    errors?: { index: number; message: string }[];
    message?: string;
  }> {
    try {
      const createdVenues: VenueInterface[] = [];
      const errors: { index: number; message: string }[] = [];

      venuesData.forEach((data, index) => {
        if (!data.venueName || !data.organizationId || !data.managerId) {
          errors.push({ index, message: "Venue name, organization ID, and manager ID are required." });
        } else {
          const venue: VenueInterface = {
            ...data,
            createdAt: new Date(),
            updatedAt: new Date(),
            isDeleted: false,
          } as VenueInterface;
          createdVenues.push(venue);
        }
      });

      if (errors.length === venuesData.length) {
        return { success: false, errors, message: "No valid venues provided." };
      }

      return {
        success: errors.length === 0,
        data: createdVenues,
        venues: createdVenues,
        errors: errors.length > 0 ? errors : undefined,
      };
    } catch (error) {
      console.error("Error in createMultipleVenues:", error);
      return { success: false, message: "Failed to create multiple venues." };
    }
  }

  // Save multiple venues to the database
  static async saveMultipleVenues(venues: VenueInterface[]): Promise<{
    success: boolean;
    data?: VenueInterface[];
    errors?: { index: number; message: string }[];
    message?: string;
  }> {
    try {
      const savedVenues: VenueInterface[] = [];
      const errors: { index: number; message: string }[] = [];

      for (let i = 0; i < venues.length; i++) {
        try {
          const savedVenue = await this.dbService.save(venues[i]);
          savedVenues.push(savedVenue);
        } catch (err: any) {
          errors.push({ index: i, message: `Failed to save venue: ${err.message}` });
        }
      }

      return {
        success: errors.length === 0,
        data: savedVenues,
        errors: errors.length > 0 ? errors : undefined,
        message: errors.length > 0 ? `Failed to save ${errors.length} venues.` : undefined,
      };
    } catch (error) {
      console.error("Error in saveMultipleVenues:", error);
      return { success: false, message: "Failed to save multiple venues to database." };
    }
  }

  // Get venue by ID
  static async getVenueById(id: string): Promise<{
    success: boolean;
    data?: VenueInterface[];
    message?: string;
  }> {
    try {
      const venue = await this.dbService.findOne({ where: { venueId: id, deletedAt: IsNull() } });
      if (!venue) {
        return { success: false, message: "Venue not found." };
      }
      return { success: true, data: [venue] };
    } catch (error) {
      console.error("Error in getVenueById:", error);
      return { success: false, message: "Failed to retrieve venue." };
    }
  }

  // Get venues by manager ID
  static async getVenuesByManagerId(managerId: string): Promise<{
    success: boolean;
    data?: VenueInterface[];
    message?: string;
  }> {
    try {
      const venues = await this.dbService.find({ where: { managerId, deletedAt: IsNull() } });
      if (!venues.length) {
        return { success: false, message: "No venues found for this manager." };
      }
      return { success: true, data: venues };
    } catch (error) {
      console.error("Error in getVenuesByManagerId:", error);
      return { success: false, message: "Failed to retrieve venues by manager ID." };
    }
  }

  // Get all venues
  static async getAllVenues(): Promise<{
    success: boolean;
    data?: VenueInterface[];
    message?: string;
  }> {
    try {
      const venues = await this.dbService.find({ where: { deletedAt: IsNull() } });
      return { success: true, data: venues };
    } catch (error) {
      console.error("Error in getAllVenues:", error);
      return { success: false, message: "Failed to retrieve all venues." };
    }
  }

  // Update venue
  static async updateVenue(id: string, data: Partial<VenueInterface>): Promise<{
    success: boolean;
    data?: VenueInterface[];
    message?: string;
  }> {
    try {
      const venue = await this.dbService.findOne({ where: { venueId: id, deletedAt: IsNull() } });
      if (!venue) {
        return { success: false, message: "Venue not found." };
      }

      const updatedVenue = { ...venue, ...data, updatedAt: new Date() };
      const savedVenue = await this.dbService.save(updatedVenue);
      return { success: true, data: [savedVenue] };
    } catch (error) {
      console.error("Error in updateVenue:", error);
      return { success: false, message: "Failed to update venue." };
    }
  }

  // Update venue manager
  static async updateVenueManager(venueId: string, managerId: string): Promise<{
    success: boolean;
    data?: VenueInterface[];
    message?: string;
  }> {
    try {
      const venue = await this.dbService.findOne({ where: { venueId, deletedAt: IsNull() } });
      if (!venue) {
        return { success: false, message: "Venue not found." };
      }

      venue.managerId = managerId;
      venue.updatedAt = new Date();
      const savedVenue = await this.dbService.save(venue);
      return { success: true, data: [savedVenue] };
    } catch (error) {
      console.error("Error in updateVenueManager:", error);
      return { success: false, message: "Failed to update venue manager." };
    }
  }

  // Remove venue manager
  static async removeVenueManager(venueId: string): Promise<{
    success: boolean;
    data?: VenueInterface[];
    message?: string;
  }> {
    try {
      const venue = await this.dbService.findOne({ where: { venueId, deletedAt: IsNull() } });
      if (!venue) {
        return { success: false, message: "Venue not found." };
      }

      venue.managerId = undefined;
      venue.updatedAt = new Date();
      const savedVenue = await this.dbService.save(venue);
      return { success: true, data: [savedVenue] };
    } catch (error) {
      console.error("Error in removeVenueManager:", error);
      return { success: false, message: "Failed to remove venue manager." };
    }
  }

  // Delete venue (soft delete)
  static async deleteVenue(id: string): Promise<{
    success: boolean;
    message?: string;
  }> {
    try {
      const venue = await this.dbService.findOne({ where: { venueId: id, deletedAt: IsNull() } });
      if (!venue) {
        return { success: false, message: "Venue not found." };
      }

      venue.deletedAt = new Date();
      venue.updatedAt = new Date();
      await this.dbService.save(venue);
      return { success: true, message: "Venue soft deleted successfully." };
    } catch (error) {
      console.error("Error in deleteVenue:", error);
      return { success: false, message: "Failed to delete venue." };
    }
  }

  // Restore soft-deleted venue
  static async restoreVenue(id: string): Promise<{
    success: boolean;
    data?: VenueInterface[];
    message?: string;
  }> {
    try {
      const venue = await this.dbService.findOne({ where: { venueId: id, deletedAt: Not(IsNull()) } });
      if (!venue) {
        return { success: false, message: "Venue not found or not deleted." };
      }

      venue.deletedAt = undefined;
      venue.updatedAt = new Date();
      const savedVenue = await this.dbService.save(venue);
      return { success: true, data: [savedVenue], message: "Venue restored successfully." };
    } catch (error) {
      console.error("Error in restoreVenue:", error);
      return { success: false, message: "Failed to restore venue." };
    }
  }

  // Get soft-deleted venues
  static async getDeletedVenues(): Promise<{
    success: boolean;
    data?: VenueInterface[];
    message?: string;
  }> {
    try {
      const venues = await this.dbService.find({ where: { deletedAt: Not(IsNull()) } });
      return { success: true, data: venues };
    } catch (error) {
      console.error("Error in getDeletedVenues:", error);
      return { success: false, message: "Failed to retrieve deleted venues." };
    }
  }

  // Search venues by criteria
  static async searchVenues(criteria: {
    name?: string;
    location?: string;
    minCapacity?: number;
    maxCapacity?: number;
    hasManager?: boolean;
  }): Promise<{
    success: boolean;
    data?: VenueInterface[];
    message?: string;
  }> {
    try {
      const query = {
        deletedAt: IsNull(),
        ...(criteria.name && { venueName: Like(`%${criteria.name}%`) }),
        ...(criteria.location && { location: Like(`%${criteria.location}%`) }),
        ...(criteria.minCapacity && { capacity: MoreThanOrEqual(criteria.minCapacity) }),
        ...(criteria.maxCapacity && { capacity: LessThanOrEqual(criteria.maxCapacity) }),
        ...(criteria.hasManager !== undefined && { managerId: criteria.hasManager ? Not(IsNull()) : IsNull() }),
      };

      const venues = await this.dbService.find({ where: query });
      return { success: true, data: venues };
    } catch (error) {
      console.error("Error in searchVenues:", error);
      return { success: false, message: "Failed to search venues." };
    }
  }

  // Get venue count
  static async getVenueCount(): Promise<{
    success: boolean;
    count?: number;
    message?: string;
  }> {
    try {
      const count = await this.dbService.count({ where: { deletedAt: IsNull() } });
      return { success: true, count };
    } catch (error) {
      console.error("Error in getVenueCount:", error);
      return { success: false, message: "Failed to get venue count." };
    }
  }

  // Get venues by proximity
  static async getVenuesByProximity(latitude: number, longitude: number, radius: number): Promise<{
    success: boolean;
    data?: VenueInterface[];
    message?: string;
  }> {
    try {
      const venues = await this.dbService.find({
        where: {
          deletedAt: IsNull(),
          latitude: Between(latitude - radius / 111.12, latitude + radius / 111.12),
          longitude: Between(
            longitude - radius / (111.12 * Math.cos(latitude * Math.PI / 180)),
            longitude + radius / (111.12 * Math.cos(latitude * Math.PI / 180))
          )
        }
      });

      // Filter venues by precise distance
      const filteredVenues = venues.filter((venue) => {
        const distance = GeoLocation.calculateDistance(
          latitude,
          longitude,
          venue.latitude || 0,
          venue.longitude || 0
        );
        return distance <= radius;
      });

      return { success: true, data: filteredVenues };
    } catch (error) {
      console.error("Error in getVenuesByProximity:", error);
      return { success: false, message: "Failed to get venues by proximity." };
    }
  }

  // Get bookings by venue
  static async getBookingsByVenueId(venueId: string): Promise<{
    success: boolean;
    data?: any[];
    message?: string;
  }> {
    try {
      const bookings = await AppDataSource.getRepository(VenueBooking).find({ where: { venueId } });
      return { success: true, data: bookings };
    } catch (error) {
      console.error("Error in getBookingsByVenueId:", error);
      return { success: false, message: "Failed to get venue bookings." };
    }
  }
}
    