import { IsNull, Not } from "typeorm";
import { AppDataSource } from "../config/Database";
import { VenueInterface } from "../interfaces/VenueInterface";
import { User } from "../models/User";
import { Venue } from "../models/Venue";
import { VenueBooking } from "../models/VenueBooking";
import { CacheService } from "../services/CacheService";
import { Request, Response } from "express";

export class VenueRepository {
  private static readonly CACHE_PREFIX = "venue:";
  private static readonly CACHE_TTL = 3600; // 1 hour, as venues update less frequently

  // Create venue
  static create(data: Partial<VenueInterface>): {
    success: boolean;
    data?: Venue;
    message?: string;
  } {
    if (!data.venueName || !data.capacity || !data.location || !data.amount) {
      return {
        success: false,
        message: "Required fields: venueName, capacity, location, amount.",
      };
    }

    const venue = new Venue();
    venue.venueName = data.venueName;
    venue.capacity = data.capacity;
    venue.location = data.location;
    venue.amount = data.amount;
    venue.managerId = data.managerId ?? undefined;
    venue.latitude = data.latitude ?? undefined;
    venue.longitude = data.longitude ?? undefined;
    venue.googleMapsLink = data.googleMapsLink ?? undefined;

    return { success: true, data: venue };
  }

  // Save venue
  static async save(
    venue: Venue
  ): Promise<{ success: boolean; data?: Venue; message?: string }> {
    if (
      !venue.venueName ||
      !venue.capacity ||
      !venue.location ||
      !venue.amount
    ) {
      return {
        success: false,
        message: "Required fields: venueName, capacity, location, amount.",
      };
    }

    try {
      const repo = AppDataSource.getRepository(Venue);
      const existingVenue = await repo.findOne({
        where: { venueName: venue.venueName, location: venue.location },
      });

      if (existingVenue && existingVenue.venueId !== venue.venueId) {
        return {
          success: false,
          message: "A venue with this name and location already exists.",
          data: existingVenue,
        };
      }

      const savedVenue = await repo.save(venue);

      // Invalidate caches
      await CacheService.invalidateMultiple([
        `${this.CACHE_PREFIX}all`,
        `${this.CACHE_PREFIX}${savedVenue.venueId}`,
        `${this.CACHE_PREFIX}manager:${savedVenue.managerId}`,
        `${this.CACHE_PREFIX}search:*`,
      ]);

      return {
        success: true,
        data: savedVenue,
        message: "Venue saved successfully",
      };
    } catch (error) {
      console.error("Error saving venue:", error);
      return {
        success: false,
        message: `Failed to save venue: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      };
    }
  }

  // Get venue by ID
  static async getById(
    id: string
  ): Promise<{ success: boolean; data?: Venue; message?: string }> {
    if (!id) {
      return { success: false, message: "Venue ID is required." };
    }

    const cacheKey = `${this.CACHE_PREFIX}${id}`;
    try {
      const venue = await CacheService.getOrSetSingle(
        cacheKey,
        AppDataSource.getRepository(Venue),
        async () => {
          return await AppDataSource.getRepository(Venue).findOne({
            where: { venueId: id, deletedAt: IsNull() },
            relations: ["manager", "manager.role"],
          });
        },
        this.CACHE_TTL
      );

      if (!venue) {
        return { success: false, message: "Venue not found or deleted." };
      }
      return { success: true, data: venue };
    } catch (error) {
      console.error("Error fetching venue by ID:", error);
      return {
        success: false,
        message: `Failed to fetch venue by ID: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      };
    }
  }

  // Alias for getById to match EventController expectations
  static async findById(id: string): Promise<Venue | null> {
    const result = await this.getById(id);
    if (!result.success) {
      console.error("Error finding venue by ID:", result.message);
      return null;
    }
    //eager load the data if it exists to the reource
    if (result.data) {
      const venueResourceRepo = AppDataSource.getRepository("VenueResource");
      const resources = await venueResourceRepo.find({
        where: { venue: { venueId: result.data.venueId } },
        relations: ["resource"]
      });
      result.data.resources = resources.map((vr) => vr.resource);
    }
    return result.success && result.data ? result.data : null;
  }

  // Get all venues
  static async getAll(): Promise<{
    success: boolean;
    data?: Venue[];
    message?: string;
  }> {
    const cacheKey = `${this.CACHE_PREFIX}all`;
    try {
      const venues = await CacheService.getOrSetMultiple(
        cacheKey,
        AppDataSource.getRepository(Venue),
        async () => {
          return await AppDataSource.getRepository(Venue).find({
            where: { deletedAt: IsNull() },
            relations: ["manager", "manager.role"],
            order: { venueName: "ASC" },
          });
        },
        this.CACHE_TTL
      );

      return { success: true, data: venues };
    } catch (error) {
      console.error("Error fetching all venues:", error);
      return {
        success: false,
        message: `Failed to fetch all venues: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      };
    }
  }

  // Get venues by manager ID
  static async getByManagerId(
    managerId: string
  ): Promise<{ success: boolean; data?: Venue[]; message?: string }> {
    if (!managerId) {
      return { success: false, message: "Manager ID is required." };
    }

    const cacheKey = `${this.CACHE_PREFIX}manager:${managerId}`;
    try {
      const venues = await CacheService.getOrSetMultiple(
        cacheKey,
        AppDataSource.getRepository(Venue),
        async () => {
          return await AppDataSource.getRepository(Venue).find({
            where: { managerId: managerId, deletedAt: IsNull() },
            relations: ["manager", "manager.role","resources"],
            order: { venueName: "ASC" },
          });
        },
        this.CACHE_TTL
      );

      if (venues.length === 0) {
        return { success: false, message: "No venues found for this manager." };
      }
      return { success: true, data: venues };
    } catch (error) {
      console.error("Error fetching venues by manager ID:", error);
      return {
        success: false,
        message: `Failed to fetch venues by manager ID: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      };
    }
  }

  // Update venue
  static async update(
    id: string,
    data: Partial<VenueInterface>
  ): Promise<{ success: boolean; data?: Venue; message?: string }> {
    if (!id) {
      return { success: false, message: "Venue ID is required." };
    }

    try {
      const repo = AppDataSource.getRepository(Venue);
      const venue = await repo.findOne({
        where: { venueId: id, deletedAt: IsNull() },
      });

      if (!venue) {
        return { success: false, message: "Venue not found or deleted." };
      }

      if (
        (data.venueName && data.venueName !== venue.venueName) ||
        (data.location && data.location !== venue.location)
      ) {
        const existingVenue = await repo.findOne({
          where: {
            venueName: data.venueName ?? venue.venueName,
            location: data.location ?? venue.location,
          },
        });
        if (existingVenue && existingVenue.venueId !== id) {
          return {
            success: false,
            message:
              "Another venue with the same name and location already exists.",
          };
        }
      }

      repo.merge(venue, {
        venueName: data.venueName ?? venue.venueName,
        capacity: data.capacity ?? venue.capacity,
        location: data.location ?? venue.location,
        amount: data.amount ?? venue.amount,
        managerId: data.managerId ?? venue.managerId,
        latitude: data.latitude ?? venue.latitude,
        longitude: data.longitude ?? venue.longitude,
        googleMapsLink: data.googleMapsLink ?? venue.googleMapsLink,
      });

      const updatedVenue = await repo.save(venue);

      // Invalidate caches
      await CacheService.invalidateMultiple([
        `${this.CACHE_PREFIX}all`,
        `${this.CACHE_PREFIX}${id}`,
        `${this.CACHE_PREFIX}manager:${venue.managerId}`,
        `${this.CACHE_PREFIX}manager:${updatedVenue.managerId}`,
        `${this.CACHE_PREFIX}search:*`,
      ]);

      return {
        success: true,
        data: updatedVenue,
        message: "Venue updated successfully",
      };
    } catch (error) {
      console.error("Error updating venue:", error);
      return {
        success: false,
        message: `Failed to update venue: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      };
    }
  }

  // Update venue manager
  static async updateVenueManager(
    venueId: string,
    managerId: string
  ): Promise<{ success: boolean; data?: Venue; message?: string }> {
    if (!venueId || !managerId) {
      return {
        success: false,
        message: "Both venueId and managerId are required.",
      };
    }

    try {
      const venueRepo = AppDataSource.getRepository(Venue);
      const userRepo = AppDataSource.getRepository(User);

      const venue = await venueRepo.findOne({
        where: { venueId, deletedAt: IsNull() },
        relations: ["manager"],
      });
      if (!venue) {
        return { success: false, message: "Venue not found or deleted." };
      }

      const manager = await userRepo.findOne({
        where: { userId: managerId },
        relations: ["role"],
      });
      if (!manager) {
        return { success: false, message: "Manager user not found." };
      }

      if (manager.role?.roleName?.toLowerCase() !== "venue_manager") {
        return { success: false, message: "User is not a venue manager." };
      }

      venue.manager = manager;
      venue.managerId = manager.userId;

      const updatedVenue = await venueRepo.save(venue);

      // Invalidate caches
      await CacheService.invalidateMultiple([
        `${this.CACHE_PREFIX}all`,
        `${this.CACHE_PREFIX}${venueId}`,
        `${this.CACHE_PREFIX}manager:${venue.managerId}`,
        `${this.CACHE_PREFIX}manager:${managerId}`,
        `${this.CACHE_PREFIX}search:*`,
      ]);

      return {
        success: true,
        data: updatedVenue,
        message: "Venue manager updated successfully",
      };
    } catch (error) {
      console.error("Error updating venue manager:", error);
      return {
        success: false,
        message: `Failed to update venue manager: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      };
    }
  }

  // Delete venue (soft delete)
  static async delete(
    id: string
  ): Promise<{ success: boolean; message?: string }> {
    if (!id) {
      return { success: false, message: "Venue ID is required." };
    }

    try {
      const repo = AppDataSource.getRepository(Venue);
      const venue = await repo.findOne({
        where: { venueId: id, deletedAt: IsNull() },
      });
      if (!venue) {
        return {
          success: false,
          message: "Venue not found or already deleted.",
        };
      }

      await repo.softRemove(venue);

      // Invalidate caches
      await CacheService.invalidateMultiple([
        `${this.CACHE_PREFIX}all`,
        `${this.CACHE_PREFIX}${id}`,
        `${this.CACHE_PREFIX}manager:${venue.managerId}`,
        `${this.CACHE_PREFIX}search:*`,
      ]);

      return { success: true, message: "Venue soft-deleted successfully" };
    } catch (error) {
      console.error("Error soft-deleting venue:", error);
      return {
        success: false,
        message: `Failed to soft-delete venue: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      };
    }
  }

  // Restore soft-deleted venue
  static async restore(
    id: string
  ): Promise<{ success: boolean; data?: Venue; message?: string }> {
    if (!id) {
      return { success: false, message: "Venue ID is required." };
    }

    try {
      const repo = AppDataSource.getRepository(Venue);
      const venue = await repo.findOne({
        where: { venueId: id },
        withDeleted: true,
      });
      if (!venue || !venue.deletedAt) {
        return { success: false, message: "Venue not found or not deleted." };
      }

      venue.deletedAt = undefined;
      const restoredVenue = await repo.save(venue);

      // Invalidate caches
      await CacheService.invalidateMultiple([
        `${this.CACHE_PREFIX}all`,
        `${this.CACHE_PREFIX}${id}`,
        `${this.CACHE_PREFIX}manager:${venue.managerId}`,
        `${this.CACHE_PREFIX}search:*`,
      ]);

      return {
        success: true,
        data: restoredVenue,
        message: "Venue restored successfully",
      };
    } catch (error) {
      console.error("Error restoring venue:", error);
      return {
        success: false,
        message: `Failed to restore venue: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      };
    }
  }

  // Get soft-deleted venues
  static async getDeleted(): Promise<{
    success: boolean;
    data?: Venue[];
    message?: string;
  }> {
    const cacheKey = `${this.CACHE_PREFIX}deleted`;
    try {
      const venues = await CacheService.getOrSetMultiple(
        cacheKey,
        AppDataSource.getRepository(Venue),
        async () => {
          return await AppDataSource.getRepository(Venue).find({
            where: { deletedAt: Not(IsNull()) },
            relations: ["manager", "manager.role"],
            withDeleted: true,
          });
        },
        this.CACHE_TTL
      );

      return { success: true, data: venues };
    } catch (error) {
      console.error("Error fetching deleted venues:", error);
      return {
        success: false,
        message: `Failed to fetch deleted venues: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      };
    }
  }

  // Search venues
  static async searchVenues(criteria: {
    name?: string;
    location?: string;
    minCapacity?: number;
    maxCapacity?: number;
    hasManager?: boolean;
  }): Promise<{ success: boolean; data?: Venue[]; message?: string }> {
    const cacheKey = `${this.CACHE_PREFIX}search:${JSON.stringify(criteria)}`;
    try {
      const venues = await CacheService.getOrSetMultiple(
        cacheKey,
        AppDataSource.getRepository(Venue),
        async () => {
          const queryBuilder = AppDataSource.getRepository(Venue)
            .createQueryBuilder("venue")
            .leftJoinAndSelect("venue.manager", "manager")
            .leftJoinAndSelect("manager.role", "role")
            .where("venue.deletedAt IS NULL");

          if (criteria.name) {
            queryBuilder.andWhere("LOWER(venue.venueName) LIKE LOWER(:name)", {
              name: `%${criteria.name}%`,
            });
          }
          if (criteria.location) {
            queryBuilder.andWhere(
              "LOWER(venue.location) LIKE LOWER(:location)",
              { location: `%${criteria.location}%` }
            );
          }
          if (criteria.minCapacity) {
            queryBuilder.andWhere("venue.capacity >= :minCapacity", {
              minCapacity: criteria.minCapacity,
            });
          }
          if (criteria.maxCapacity) {
            queryBuilder.andWhere("venue.capacity <= :maxCapacity", {
              maxCapacity: criteria.maxCapacity,
            });
          }
          if (typeof criteria.hasManager === "boolean") {
            queryBuilder.andWhere(
              `venue.managerId ${
                criteria.hasManager ? "IS NOT NULL" : "IS NULL"
              }`
            );
          }

          return await queryBuilder.orderBy("venue.venueName", "ASC").getMany();
        },
        this.CACHE_TTL
      );

      return { success: true, data: venues };
    } catch (error) {
      console.error("Error searching venues:", error);
      return {
        success: false,
        message: `Failed to search venues: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      };
    }
  }

  // Get venue count
  static async getVenueCount(): Promise<{
    success: boolean;
    count?: number;
    message?: string;
  }> {
    try {
      const count = await AppDataSource.getRepository(Venue).count({
        where: { deletedAt: IsNull() },
      });
      return { success: true, count };
    } catch (error) {
      console.error("Error getting venue count:", error);
      return {
        success: false,
        message: `Failed to get venue count: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      };
    }
  }

  // Remove venue manager
  static async removeVenueManager(
    venueId: string
  ): Promise<{ success: boolean; data?: Venue; message?: string }> {
    if (!venueId) {
      return { success: false, message: "Venue ID is required." };
    }

    try {
      const repo = AppDataSource.getRepository(Venue);
      const venue = await repo.findOne({
        where: { venueId, deletedAt: IsNull() },
      });
      if (!venue) {
        return { success: false, message: "Venue not found or deleted." };
      }

      const oldManagerId = venue.managerId;
      venue.manager = undefined;
      venue.managerId = undefined;

      const updatedVenue = await repo.save(venue);

      // Invalidate caches
      await CacheService.invalidateMultiple([
        `${this.CACHE_PREFIX}all`,
        `${this.CACHE_PREFIX}${venueId}`,
        `${this.CACHE_PREFIX}manager:${oldManagerId}`,
        `${this.CACHE_PREFIX}search:*`,
      ]);

      return {
        success: true,
        data: updatedVenue,
        message: "Venue manager removed successfully.",
      };
    } catch (error) {
      console.error("Error removing venue manager:", error);
      return {
        success: false,
        message: `Failed to remove venue manager: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      };
    }
  }

  // Get bookings by venue
  static async getBookingsByVenue(
    venueId: string
  ): Promise<{ success: boolean; data?: VenueBooking[]; message?: string }> {
    if (!venueId) {
      return { success: false, message: "Venue ID is required." };
    }

    const cacheKey = `${this.CACHE_PREFIX}${venueId}:bookings`;
    try {
      const bookings = await CacheService.getOrSetMultiple(
        cacheKey,
        AppDataSource.getRepository(VenueBooking),
        async () => {
          return await AppDataSource.getRepository(VenueBooking).find({
            where: { venueId },
            relations: ["venue", "event"],
            order: { createdAt: "ASC" },
          });
        },
        this.CACHE_TTL
      );

      return { success: true, data: bookings };
    } catch (error) {
      console.error("Error fetching bookings by venue:", error);
      return {
        success: false,
        message: `Failed to fetch bookings: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      };
    }
  }

  // Get venues by proximity
  static async getVenuesByProximity(
    latitude: number,
    longitude: number,
    radiusKm: number
  ): Promise<{ success: boolean; data?: Venue[]; message?: string }> {
    if (!latitude || !longitude || !radiusKm) {
      return {
        success: false,
        message: "Latitude, longitude, and radius are required.",
      };
    }

    const cacheKey = `${this.CACHE_PREFIX}proximity:${latitude}:${longitude}:${radiusKm}`;
    try {
      const venues = await CacheService.getOrSetMultiple(
        cacheKey,
        AppDataSource.getRepository(Venue),
        async () => {
          // Use PostGIS or simple Haversine formula for distance calculation
          const earthRadiusKm = 6371;
          const queryBuilder = AppDataSource.getRepository(Venue)
            .createQueryBuilder("venue")
            .leftJoinAndSelect("venue.manager", "manager")
            .leftJoinAndSelect("manager.role", "role")
            .where("venue.deletedAt IS NULL")
            .andWhere("venue.latitude IS NOT NULL")
            .andWhere("venue.longitude IS NOT NULL");

          // Haversine formula
          queryBuilder.select([
            "venue.*",
            `(${earthRadiusKm} * 2 * ASIN(SQRT(
              POW(SIN((RADIANS(:latitude - venue.latitude)) / 2), 2) +
              COS(RADIANS(venue.latitude)) * COS(RADIANS(:latitude)) *
              POW(SIN((RADIANS(:longitude - venue.longitude)) / 2), 2)
            ))) AS distance`,
          ]);

          queryBuilder.setParameters({ latitude, longitude });
          queryBuilder.having("distance <= :radiusKm", { radiusKm });
          queryBuilder.orderBy("distance", "ASC");

          return await queryBuilder.getRawMany();
        },
        this.CACHE_TTL
      );

      return { success: true, data: venues };
    } catch (error) {
      console.error("Error fetching venues by proximity:", error);
      return {
        success: false,
        message: `Failed to fetch venues by proximity: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      };
    }
  }

  // Create multiple venues
  static async createMultiple(
    venuesData: Partial<VenueInterface>[]
  ): Promise<{ success: boolean; venues: Venue[]; errors: any[] }> {
    const venues: Venue[] = [];
    const errors: any[] = [];

    for (const data of venuesData) {
      try {
        const createResult = this.create(data);
        if (!createResult.success || !createResult.data) {
          errors.push({ data, message: createResult.message });
          continue;
        }

        const saveResult = await this.save(createResult.data);
        if (saveResult.success && saveResult.data) {
          venues.push(saveResult.data);
        } else {
          errors.push({ data, message: saveResult.message });
        }
      } catch (error) {
        errors.push({
          data,
          message: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    // Invalidate cache for all venues
    await CacheService.invalidate(`${this.CACHE_PREFIX}all`);

    return { success: errors.length === 0, venues, errors };
  }

  // Get resources by venue ID
  static async getResourcesByVenueId(
    venueId: string
  ): Promise<{ success: boolean; data?: any[]; message?: string }> {
    if (!venueId) {
      return { success: false, message: "Venue ID is required." };
    }
    try {
      // Find all events at this venue
      const eventRepo = AppDataSource.getRepository("Event");
      const eventResourceRepo = AppDataSource.getRepository("EventResource");
      const resourceRepo = AppDataSource.getRepository("Resource");

      // Get all eventIds for this venue
      const events = await eventRepo
        .createQueryBuilder("event")
        .leftJoin("event.venues", "venue")
        .where("venue.venueId = :venueId", { venueId })
        .getMany();
      const eventIds = events.map((e) => e.eventId);
      if (eventIds.length === 0) {
        return {
          success: true,
          data: [],
          message: "No events for this venue.",
        };
      }
      // Get all resources for these events
      const eventResources = await eventResourceRepo
        .createQueryBuilder("eventResource")
        .leftJoinAndSelect("eventResource.resource", "resource")
        .where("eventResource.eventId IN (:...eventIds)", { eventIds })
        .getMany();
      // Map to unique resources
      const resourcesMap = new Map();
      for (const er of eventResources) {
        if (er.resource) resourcesMap.set(er.resource.resourceId, er.resource);
      }
      return { success: true, data: Array.from(resourcesMap.values()) };
    } catch (error) {
      console.error("Error fetching resources by venue ID:", error);
      return {
        success: false,
        message: `Failed to fetch resources: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      };
    }
  }

}

