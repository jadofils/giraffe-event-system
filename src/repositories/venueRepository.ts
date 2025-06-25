import { IsNull, Not } from "typeorm";
import { AppDataSource } from "../config/Database";
import { VenueInterface } from "../interfaces/VenueInterface";
import { User } from "../models/User";
import { Venue, VenueStatus } from "../models/Venue";
import { VenueBooking } from "../models/VenueBooking";
import { Event as AppEvent } from "../models/Event";
import { CacheService } from "../services/CacheService";

export class VenueRepository {
  private static readonly CACHE_PREFIX = "venue:";
  private static readonly CACHE_TTL = 3600; // 1 hour, as venues update less frequently
  private static readonly UUID_REGEX =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

  if (typeof data.capacity !== "number" || data.capacity <= 0) {
    return { success: false, message: "Capacity must be a positive number." };
  }

  if (typeof data.amount !== "number" || data.amount <= 0) {
    return { success: false, message: "Amount must be a positive number." };
  }

  if (data.managerId && !this.UUID_REGEX.test(data.managerId)) {
    return { success: false, message: "Invalid managerId format." };
  }

  if (data.organizationId && !this.UUID_REGEX.test(data.organizationId)) {
    return { success: false, message: "Invalid organizationId format." };
  }

  if (
    data.latitude !== undefined &&
    (typeof data.latitude !== "number" || data.latitude < -90 || data.latitude > 90)
  ) {
    return {
      success: false,
      message: "Invalid latitude. Must be a number between -90 and 90.",
    };
  }

  if (
    data.longitude !== undefined &&
    (typeof data.longitude !== "number" || data.longitude < -180 || data.longitude > 180)
  ) {
    return {
      success: false,
      message: "Invalid longitude. Must be a number between -180 and 180.",
    };
  }

  const venue = new Venue();
  Object.assign(venue, {
    venueName: data.venueName,
    capacity: data.capacity,
    location: data.location,
    amount: data.amount,
    managerId: data.managerId ?? undefined,
    organizationId: data.organizationId ?? undefined,
    latitude: data.latitude ?? undefined,
    longitude: data.longitude ?? undefined,
    googleMapsLink: data.googleMapsLink ?? undefined,
    amenities: data.amenities ?? undefined,
    venueType: data.venueType ?? undefined,
    contactPerson: data.contactPerson ?? undefined,
    contactEmail: data.contactEmail ?? undefined,
    contactPhone: data.contactPhone ?? undefined,
    websiteURL: data.websiteURL ?? undefined,
    status:
      typeof data.status === "string" &&
      data.status.toUpperCase() === VenueStatus.APPROVED
        ? VenueStatus.APPROVED
        : VenueStatus.PENDING,
  });

  return { success: true, data: venue };
}

  // Save venue
static async save(
  venue: Venue
): Promise<{ success: boolean; data?: Venue; message?: string }> {
  if (!venue.venueName || !venue.capacity || !venue.location || !venue.amount) {
    return {
      success: false,
      message: "Required fields: venueName, capacity, location, amount.",
    };
  }

  try {
    const repo = AppDataSource.getRepository(Venue);

    // Find any venue with same name and location, regardless of organization
    const duplicate = await repo.findOne({
      where: {
        venueName: venue.venueName,
        location: venue.location
      }
    });

    if (
      duplicate &&
      duplicate.venueId !== venue.venueId
    ) {
      const sameOrg = duplicate.organizationId === venue.organizationId;
      return {
        success: false,
        message: sameOrg
          ? `Venue "${venue.venueName}" at "${venue.location}" already exists in your organization.`
          : `Venue "${venue.venueName}" at "${venue.location}" is already registered under another organization.`,
        data: duplicate,
      };
    }

    const savedVenue = await repo.save(venue);

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
  } catch (error: any) {
    console.error("Error saving venue:", error);
    return {
      success: false,
      message: "Failed to save venue."
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
            relations: ["manager", "manager.role","resources","organization"],
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
            relations: ["manager", "manager.role"],
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
  static async update(
    id: string,
    data: Partial<VenueInterface>
  ): Promise<{ success: boolean; data?: Venue; message: string }> {
    if (!id) {
      return { success: false, message: "Venue ID is required." };
    }

    // Only validate if updating fields other than status/cancellationReason
    const updatableKeys = Object.keys(data);
    const skipValidation = updatableKeys.every((key) =>
      ["status", "cancellationReason"].includes(key)
    );
    if (!skipValidation) {
      const validationErrors = VenueInterface.validate(data);
      if (validationErrors.length > 0) {
        return {
          success: false,
          message: `Validation errors: ${validationErrors.join(", ")}`,
        };
      }
    }

    const queryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const repo = queryRunner.manager.getRepository(Venue);
      const venue = await repo.findOne({
        where: { venueId: id, deletedAt: IsNull() },
      });

      if (!venue) {
        await queryRunner.rollbackTransaction();
        return { success: false, message: "Venue not found or deleted." };
      }

      // Log input data for debugging
      console.log("Update input data:", data);

      // Check for duplicate name and location
      const nameChanged = data.venueName && data.venueName !== venue.venueName;
      const locationChanged = data.location && data.location !== venue.location;

      if (nameChanged && locationChanged) {
        const existing = await repo.findOne({
          where: {
            venueName: data.venueName,
            location: data.location,
            deletedAt: IsNull(),
          },
        });

        if (existing && existing.venueId !== id) {
          await queryRunner.rollbackTransaction();
          return {
            success: false,
            message:
              "Another venue with the same name and location already exists.",
          };
        }
      }

      // Merge changes
      const mergedVenue = repo.merge(venue, {
        ...data,
        updatedAt: new Date(), // Explicitly set updatedAt
      });

      // Log merged entity for debugging
      console.log("Merged venue:", mergedVenue);

      // Save changes
      const updatedVenue = await repo.save(mergedVenue);

      // Invalidate cache
      await CacheService.invalidateMultiple([
        `${this.CACHE_PREFIX}all`,
        `${this.CACHE_PREFIX}${id}`,
        `${this.CACHE_PREFIX}manager:${updatedVenue.managerId}`,
        `${this.CACHE_PREFIX}search:*`,
      ]);

      await queryRunner.commitTransaction();

      return {
        success: true,
        data: updatedVenue,
        message: "Venue updated successfully.",
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      console.error("Error updating venue:", error);
      return {
        success: false,
        message: `Failed to update venue: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      };
    } finally {
      await queryRunner.release();
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

  static async findAvailableVenues(
    startDate: Date,
    endDate: Date,
    startTime: string,
    endTime: string,
    bufferMinutes: number = 30
  ): Promise<{
    success: boolean;
    data?: {
      availableVenues: Venue[];
      isAvailableInFuture: boolean;
      conflictingVenues: { venue: Venue; conflictingEvents: AppEvent[] }[];
      nextAvailableTime?: string;
    };
    message?: string;
  }> {
    const cacheKey = `${
      this.CACHE_PREFIX
    }available:${startDate.toISOString()}:${endDate.toISOString()}:${startTime}:${endTime}:${bufferMinutes}`;

    try {
      // Combine date and time into full Date objects
      const parseTime = (date: Date, time: string): Date => {
        const [hours, minutes] = time.split(":").map(Number);
        const newDate = new Date(date);
        newDate.setHours(hours, minutes, 0, 0);
        return newDate;
      };

      const eventStart = parseTime(startDate, startTime);
      const eventEnd = parseTime(endDate, endTime);

      // Validate input
      if (eventEnd <= eventStart) {
        return {
          success: false,
          message: "End date/time must be after start date/time.",
        };
      }

      // Use cache if available
      type AvailableVenuesCacheType = {
        availableVenues: Venue[];
        isAvailableInFuture: boolean;
        conflictingVenues: { venue: Venue; conflictingEvents: AppEvent[] }[];
      };
      let cachedResult = await CacheService.get<AvailableVenuesCacheType>(
        cacheKey
      );
      if (!cachedResult) {
        // Get all venues that are not deleted (regardless of status)
        const allVenues = await AppDataSource.getRepository(Venue).find({
          where: { deletedAt: IsNull() },
          relations: ["manager"],
        });

        const availableVenues: Array<
          Venue & {
            previousEvent?: {
              startDate: string;
              startTime: string;
              endDate: string;
              endTime: string;
            };
            nextAvailableTime: string;
          }
        > = [];
        const conflictingVenues: {
          venue: Venue;
          conflictingEvents: AppEvent[];
        }[] = [];

        // Check each venue for availability
        for (const venue of allVenues) {
          // Check for conflicting bookings (approved)
          const conflictingBookings = await AppDataSource.getRepository(
            VenueBooking
          )
            .createQueryBuilder("booking")
            .leftJoinAndSelect("booking.event", "event")
            .where("booking.venueId = :venueId", { venueId: venue.venueId })
            .andWhere("booking.approvalStatus = :status", {
              status: "approved",
            })
            .andWhere(
              "((event.startDate < :eventEnd AND event.endDate > :eventStart) OR " +
                "(event.startDate = :eventStart AND event.startTime <= :endTime AND event.endTime >= :startTime))",
              {
                eventStart,
                eventEnd,
                startTime:
                  typeof startTime === "string" ? startTime : String(startTime),
                endTime:
                  typeof endTime === "string" ? endTime : String(endTime),
              }
            )
            .getMany();

          // Check for conflicting events directly (even if no booking exists)
          const conflictingEvents = await AppDataSource.getRepository(AppEvent)
            .createQueryBuilder("event")
            .leftJoin("event.venues", "venue")
            .where("venue.venueId = :venueId", { venueId: venue.venueId })
            .andWhere("event.status = :status", { status: "APPROVED" })
            .andWhere(
              "((event.startDate < :eventEnd AND event.endDate > :eventStart) OR " +
                "(event.startDate = :eventStart AND event.startTime <= :endTime AND event.endTime >= :startTime))",
              {
                eventStart,
                eventEnd,
                startTime:
                  typeof startTime === "string" ? startTime : String(startTime),
                endTime:
                  typeof endTime === "string" ? endTime : String(endTime),
              }
            )
            .getMany();

          if (
            conflictingBookings.length === 0 &&
            conflictingEvents.length === 0
          ) {
            // Find the latest event that ends before the requested start time
            const previousBooking = await AppDataSource.getRepository(
              VenueBooking
            )
              .createQueryBuilder("booking")
              .leftJoinAndSelect("booking.event", "event")
              .where("booking.venueId = :venueId", { venueId: venue.venueId })
              .andWhere("booking.approvalStatus = :status", {
                status: "approved",
              })
              .andWhere(
                "((event.endDate < :eventStart) OR (event.endDate = :eventStart AND event.endTime < :startTime))",
                {
                  eventStart,
                  startTime:
                    typeof startTime === "string"
                      ? startTime
                      : String(startTime),
                }
              )
              .orderBy("event.endDate", "DESC")
              .addOrderBy("event.endTime", "DESC")
              .getOne();

            let previousEvent = undefined;
            let nextAvailableTime = eventStart.toISOString();
            if (previousBooking && previousBooking.event) {
              previousEvent = {
                startDate:
                  previousBooking.event.startDate?.toISOString?.() || "",
                startTime: previousBooking.event.startTime || "",
                endDate: previousBooking.event.endDate?.toISOString?.() || "",
                endTime: previousBooking.event.endTime || "",
              };
              // Calculate next available time: previous event's end + 15 minutes
              let prevEndDate =
                previousBooking.event.endDate instanceof Date
                  ? new Date(previousBooking.event.endDate)
                  : new Date(previousBooking.event.endDate);
              let [endHour, endMinute] = (
                previousBooking.event.endTime || "00:00"
              )
                .split(":")
                .map(Number);
              prevEndDate.setHours(endHour, endMinute, 0, 0);
              prevEndDate = new Date(prevEndDate.getTime() + 15 * 60 * 1000); // add 15 minutes
              nextAvailableTime = prevEndDate.toISOString();
            }
            availableVenues.push({
              ...venue,
              previousEvent,
              nextAvailableTime,
            });
          } else {
            conflictingVenues.push({
              venue,
              conflictingEvents: [
                ...conflictingBookings.map((booking) => booking.event),
                ...conflictingEvents,
              ],
            });
          }
        }

        // Check future availability (e.g., 30 minutes after event start)
        const futureTime = new Date(
          eventStart.getTime() + bufferMinutes * 60 * 1000
        );
        const futureConflicts = await AppDataSource.getRepository(VenueBooking)
          .createQueryBuilder("booking")
          .leftJoin("booking.event", "event")
          .where("booking.approvalStatus = :status", { status: "approved" })
          .andWhere(
            "((event.startDate < :futureTime AND event.endDate > :futureTime) OR " +
              "(event.startDate = :futureTime AND event.startTime <= :futureTimeStr AND event.endTime >= :futureTimeStr))",
            {
              futureTime,
              futureTimeStr: futureTime.toISOString().substring(11, 16), // "HH:mm"
            }
          )
          .getCount();

        cachedResult = {
          availableVenues,
          isAvailableInFuture: futureConflicts === 0,
          conflictingVenues,
        };
        await CacheService.set(cacheKey, cachedResult, this.CACHE_TTL);
      }

      let nextAvailableTime: string | undefined = undefined;
      if (
        cachedResult.availableVenues.length === 0 &&
        cachedResult.isAvailableInFuture
      ) {
        // Find the soonest time after the requested slot when any venue is free
        // Find the earliest end time among all conflicting events, add 15 minutes
        let minEndDate: Date | null = null;
        let minEndTime: string | null = null;
        for (const conflict of cachedResult.conflictingVenues) {
          for (const event of conflict.conflictingEvents) {
            const endDate =
              event.endDate instanceof Date
                ? event.endDate
                : new Date(event.endDate);
            const endTime = event.endTime || "00:00";
            let eventEnd = new Date(endDate);
            const [h, m] = endTime.split(":").map(Number);
            eventEnd.setHours(h, m, 0, 0);
            if (!minEndDate || eventEnd < minEndDate) {
              minEndDate = eventEnd;
              minEndTime = endTime;
            }
          }
        }
        if (minEndDate) {
          // Add 15 minutes to the earliest end time
          minEndDate = new Date(minEndDate.getTime() + 15 * 60 * 1000);
          nextAvailableTime = minEndDate.toISOString();
        } else {
          // fallback: 15 minutes after requested end
          const fallback = new Date(eventEnd.getTime() + 15 * 60 * 1000);
          nextAvailableTime = fallback.toISOString();
        }
      }
      return {
        success: true,
        data: {
          ...cachedResult,
          nextAvailableTime,
        },
        message: cachedResult.availableVenues.length
          ? `${cachedResult.availableVenues.length} venue(s) available for the requested time slot.`
          : "No venues available for the requested time slot.",
      };
    } catch (error) {
      console.error("Error finding available venues:", error);
      return {
        success: false,
        message: `Failed to find available venues: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      };
    }
  }

  static async findFullyAvailableVenues(
    startDate: Date,
    endDate: Date,
    startTime: string,
    endTime: string,
    bufferMinutes: number = 30
  ): Promise<{ success: boolean; data?: Venue[]; message?: string }> {
    try {
      // Only consider venues with status 'APPROVED'
      const venues = await AppDataSource.getRepository(Venue).find({
        where: { status: VenueStatus.APPROVED, deletedAt: IsNull() },
        relations: ["manager"],
      });

      // Parse requested time range
      const parseTime = (date: Date, time: string): Date => {
        const [hours, minutes] = time.split(":").map(Number);
        const newDate = new Date(date);
        newDate.setHours(hours, minutes, 0, 0);
        return newDate;
      };

      // Helper to iterate days between two dates (inclusive)
      const getDaysInRange = (start: Date, end: Date): Date[] => {
        const days: Date[] = [];
        let current = new Date(start);
        while (current <= end) {
          days.push(new Date(current));
          current.setDate(current.getDate() + 1);
        }
        return days;
      };

      const reqDays = getDaysInRange(
        new Date(
          startDate.getFullYear(),
          startDate.getMonth(),
          startDate.getDate()
        ),
        new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate())
      );

      const availableVenues: Venue[] = [];

      for (const venue of venues) {
        // Get all approved bookings/events for this venue that could possibly overlap
        const bookings = await AppDataSource.getRepository(VenueBooking)
          .createQueryBuilder("booking")
          .leftJoinAndSelect("booking.event", "event")
          .where("booking.venueId = :venueId", { venueId: venue.venueId })
          .andWhere("booking.approvalStatus = :status", { status: "approved" })
          .andWhere("event.status = :eventStatus", { eventStatus: "APPROVED" })
          .andWhere(
            "event.startDate <= :reqEnd AND event.endDate >= :reqStart",
            { reqStart: startDate, reqEnd: endDate }
          )
          .getMany();

        let isAvailableAllDays = true;
        for (const day of reqDays) {
          // Requested slot for this day
          const reqStart = parseTime(day, startTime);
          const reqEnd = parseTime(day, endTime);

          // Check for overlap with any booking on this day
          let hasOverlap = false;
          for (const booking of bookings) {
            if (!booking.event) continue;
            // Check if this event covers this day
            const eventStartDay = new Date(
              booking.event.startDate.getFullYear(),
              booking.event.startDate.getMonth(),
              booking.event.startDate.getDate()
            );
            const eventEndDay = new Date(
              booking.event.endDate.getFullYear(),
              booking.event.endDate.getMonth(),
              booking.event.endDate.getDate()
            );
            if (day < eventStartDay || day > eventEndDay) continue;
            // Event's slot for this day
            const eventStart = parseTime(
              day,
              booking.event.startTime || "00:00"
            );
            const eventEnd = parseTime(day, booking.event.endTime || "23:59");
            // Apply buffer
            const bufferedStart = new Date(
              eventStart.getTime() - bufferMinutes * 60000
            );
            const bufferedEnd = new Date(
              eventEnd.getTime() + bufferMinutes * 60000
            );
            // Check overlap (time-based)
            if (bufferedStart < reqEnd && reqStart < bufferedEnd) {
              hasOverlap = true;
              break;
            }
          }
          if (hasOverlap) {
            isAvailableAllDays = false;
            break;
          }
        }
        if (isAvailableAllDays) {
          availableVenues.push(venue);
        }
      }
      return { success: true, data: availableVenues };
    } catch (error) {
      console.error("Error finding fully available venues:", error);
      return {
        success: false,
        message: "Failed to find fully available venues.",
      };
    }
  }

 /**
     * Retrieves all venues with an 'APPROVED' status, not soft-deleted,
     * including their manager, organization, users, and resources.
     * This method is cached.
     *
     * @returns A result object containing approved venues or an error message.
     */
    static async getApprovedVenues(): Promise<{ success: boolean; data?: Venue[]; message?: string }> {
        const cacheKey = `${this.CACHE_PREFIX}approved`; // Specific cache key for approved venues
        try {
            const cachedVenues = await CacheService.get<Venue[]>(cacheKey);
            if (cachedVenues) {
                return { success: true, data: cachedVenues, message: "Approved venues fetched from cache." };
            }

            const venues = await AppDataSource.getRepository(Venue).find({
                where: {
                    status: VenueStatus.APPROVED,
                    deletedAt: IsNull(), // Ensure only non-soft-deleted venues are returned
                },
                relations: [
                    "manager",
                    "organization", // Corrected: A venue has one organization, not 'organizations' array
                    "users",      // Corrected: 'users' is the relation to the User entity directly
                    "resources"   // Added: To fetch associated resources
                ],
            });

            await CacheService.set(cacheKey, venues); // Cache the result
            return { success: true, data: venues, message: "Approved venues retrieved successfully." };
        } catch (error: any) {
            console.error("Error finding approved venues:", error.message);
            return {
                success: false,
                message: `Failed to find approved venues due to a server error: ${error.message || "Unknown error"}`,
            };
        }
    }
}
