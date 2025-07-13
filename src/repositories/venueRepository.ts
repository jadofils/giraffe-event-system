import { IsNull, Not } from "typeorm";
import { AppDataSource } from "../config/Database";
import {
  VenueInterface,
  BookingConditionRequest,
  VenueVariableRequest,
  VenueAmenityRequest,
  VenueRequest,
} from "../interfaces/VenueInterface";
import { User } from "../models/User";
import { Venue, VenueStatus, BookingType } from "../models/Venue Tables/Venue";
import { VenueBooking } from "../models/VenueBooking";
import { Event as AppEvent } from "../models/Event";
import { CacheService } from "../services/CacheService";
import { BookingCondition } from "../models/Venue Tables/BookingCondition";
import { VenueVariable } from "../models/Venue Tables/VenueVariable";
import { VenueAmenities } from "../models/Venue Tables/VenueAmenities";

export class VenueRepository {
  private static readonly CACHE_PREFIX = "venue:";
  private static readonly CACHE_TTL = 3600; // 1 hour, as venues update less frequently
  private static readonly UUID_REGEX =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  // Create venue
  static create(data: VenueRequest): {
    success: boolean;
    data?: Venue;
    message?: string;
  } {
    if (!data.venueName || !data.capacity || !data.venueLocation) {
      return {
        success: false,
        message: "Required fields: venueName, capacity, venueLocation.",
      };
    }
    const venue = new Venue();
    Object.assign(venue, {
      venueName: data.venueName,
      capacity: data.capacity,
      venueLocation: data.venueLocation,
      latitude: data.latitude,
      longitude: data.longitude,
      googleMapsLink: data.googleMapsLink,
      organizationId: data.organizationId,
      venueTypeId: data.venueTypeId,
      mainPhotoUrl: data.mainPhotoUrl,
      photoGallery: data.photoGallery,
      virtualTourUrl: data.virtualTourUrl,
      venueDocuments: data.venueDocuments,
      status: data.status,
      cancellationReason: data.cancellationReason,
      visitPurposeOnly: data.visitPurposeOnly,
      bookingType: data.bookingType,
    });
    return { success: true, data: venue };
  }

  static async saveFullVenue(
    data: VenueRequest
  ): Promise<{ success: boolean; data?: Venue; message?: string }> {
    const venueRepo = AppDataSource.getRepository(Venue);
    const bcRepo = AppDataSource.getRepository(BookingCondition);
    const vvRepo = AppDataSource.getRepository(VenueVariable);
    const vaRepo = AppDataSource.getRepository(VenueAmenities);
    const queryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      // Only pass Venue fields to create
      const {
        bookingConditions,
        venueVariable,
        venueAmenities,
        status,
        bookingType,
        ...venueFields
      } = data;
      const venue = venueRepo.create({
        ...venueFields,
        status:
          typeof status === "string"
            ? VenueStatus[status as keyof typeof VenueStatus]
            : status,
        bookingType:
          typeof bookingType === "string"
            ? BookingType[bookingType as keyof typeof BookingType]
            : bookingType,
      });
      await queryRunner.manager.save(venue);

      // Save Booking Conditions
      if (bookingConditions && bookingConditions.length > 0) {
        for (const bc of bookingConditions) {
          const bookingCondition = bcRepo.create({ ...bc, venue });
          await queryRunner.manager.save(bookingCondition);
        }
      }

      // Save Venue Variable
      if (venueVariable) {
        const venueVariableEntity = vvRepo.create({ ...venueVariable, venue });
        await queryRunner.manager.save(venueVariableEntity);
      }

      // Save Venue Amenities
      if (venueAmenities && venueAmenities.length > 0) {
        for (const amenity of venueAmenities) {
          const venueAmenity = vaRepo.create({ ...amenity, venue });
          await queryRunner.manager.save(venueAmenity);
        }
      }

      await queryRunner.commitTransaction();
      return { success: true, data: venue };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      return { success: false, message: "Failed to create venue" };
    } finally {
      await queryRunner.release();
    }
  }

  // // Get venue by ID
  // static async getById(
  //   id: string
  // ): Promise<{ success: boolean; data?: Venue; message?: string }> {
  //   if (!id) {
  //     return { success: false, message: "Venue ID is required." };
  //   }

  //   const cacheKey = `${this.CACHE_PREFIX}${id}`;
  //   try {
  //     const venue = await CacheService.getOrSetSingle(
  //       cacheKey,
  //       AppDataSource.getRepository(Venue),
  //       async () => {
  //         return await AppDataSource.getRepository(Venue).findOne({
  //           where: { venueId: id, deletedAt: IsNull() },
  //           relations: ["organization"],
  //         });
  //       },
  //       this.CACHE_TTL
  //     );

  //     if (!venue) {
  //       return { success: false, message: "Venue not found or deleted." };
  //     }
  //     return { success: true, data: venue };
  //   } catch (error) {
  //     console.error("Error fetching venue by ID:", error);
  //     return {
  //       success: false,
  //       message: `Failed to fetch venue by ID: ${
  //         error instanceof Error ? error.message : "Unknown error"
  //       }`,
  //     };
  //   }
  // }

  // // Alias for getById to match EventController expectations
  // static async findById(id: string): Promise<Venue | null> {
  //   const result = await this.getById(id);
  //   return result.success && result.data ? result.data : null;
  // }

  // // Get all venues
  // static async getAll(): Promise<{
  //   success: boolean;
  //   data?: Venue[];
  //   message?: string;
  // }> {
  //   const cacheKey = `${this.CACHE_PREFIX}all`;
  //   try {
  //     const venues = await CacheService.getOrSetMultiple(
  //       cacheKey,
  //       AppDataSource.getRepository(Venue),
  //       async () => {
  //         return await AppDataSource.getRepository(Venue).find({
  //           where: { deletedAt: IsNull() },
  //           relations: ["organization"],
  //           order: { venueName: "ASC" },
  //         });
  //       },
  //       this.CACHE_TTL
  //     );

  //     return { success: true, data: venues };
  //   } catch (error) {
  //     console.error("Error fetching all venues:", error);
  //     return {
  //       success: false,
  //       message: `Failed to fetch all venues: ${
  //         error instanceof Error ? error.message : "Unknown error"
  //       }`,
  //     };
  //   }
  // }

  // // Get venues by manager ID
  // static async getByManagerId(
  //   managerId: string
  // ): Promise<{ success: boolean; data?: Venue[]; message?: string }> {
  //   if (!managerId) {
  //     return { success: false, message: "Manager ID is required." };
  //   }

  //   const cacheKey = `${this.CACHE_PREFIX}manager:${managerId}`;
  //   try {
  //     const venues = await CacheService.getOrSetMultiple(
  //       cacheKey,
  //       AppDataSource.getRepository(Venue),
  //       async () => {
  //         return await AppDataSource.getRepository(Venue).find({
  //           where: { organizationId: managerId, deletedAt: IsNull() },
  //           relations: ["organization"],
  //           order: { venueName: "ASC" },
  //         });
  //       },
  //       this.CACHE_TTL
  //     );

  //     if (venues.length === 0) {
  //       return { success: false, message: "No venues found for this manager." };
  //     }
  //     return { success: true, data: venues };
  //   } catch (error) {
  //     console.error("Error fetching venues by manager ID:", error);
  //     return {
  //       success: false,
  //       message: `Failed to fetch venues by manager ID: ${
  //         error instanceof Error ? error.message : "Unknown error"
  //       }`,
  //     };
  //   }
  // }
  // // static async update(
  // //   id: string,
  // //   data: Partial<VenueInterface>
  // // ): Promise<{ success: boolean; data?: Venue; message: string }> {
  // //   if (!id) {
  // //     return { success: false, message: "Venue ID is required." };
  // //   }

  // //   // Only validate if updating fields other than status/cancellationReason
  // //   const updatableKeys = Object.keys(data);
  // //   const skipValidation = updatableKeys.every((key) =>
  // //     ["status", "cancellationReason"].includes(key)
  // //   );
  // //   if (!skipValidation) {
  // //     const validationErrors = VenueInterface.validate(data);
  // //     if (validationErrors.length > 0) {
  // //       return {
  // //         success: false,
  // //         message: `Validation errors: ${validationErrors.join(", ")}`,
  // //       };
  // //     }
  // //   }

  // //   const queryRunner = AppDataSource.createQueryRunner();
  // //   await queryRunner.connect();
  // //   await queryRunner.startTransaction();

  // //   try {
  // //     const repo = queryRunner.manager.getRepository(Venue);
  // //     const venue = await repo.findOne({
  // //       where: { venueId: id, deletedAt: IsNull() },
  // //     });

  // //     if (!venue) {
  // //       await queryRunner.rollbackTransaction();
  // //       return { success: false, message: "Venue not found or deleted." };
  // //     }

  // //     // Log input data for debugging
  // //     console.log("Update input data:", data);

  // //     // Check for duplicate name and location
  // //     const nameChanged = data.venueName && data.venueName !== venue.venueName;
  // //     const locationChanged =
  // //       data.venueLocation && data.venueLocation !== venue.venueLocation;

  // //     if (nameChanged && locationChanged) {
  // //       const existing = await repo.findOne({
  // //         where: {
  // //           venueName: data.venueName,
  // //           venueLocation: data.venueLocation,
  // //           deletedAt: IsNull(),
  // //         },
  // //       });

  // //       if (existing && existing.venueId !== id) {
  // //         await queryRunner.rollbackTransaction();
  // //         return {
  // //           success: false,
  // //           message:
  // //             "Another venue with the same name and location already exists.",
  // //         };
  // //       }
  // //     }

  // //     // Merge changes
  // //     // const mergedVenue = repo.merge(venue, {
  // //     //   ...data,
  // //     //   updatedAt: new Date(), // Explicitly set updatedAt
  // //     // });

  // //     // Log merged entity for debugging
  // //     console.log("Merged venue:", mergedVenue);

  // //     // Save changes
  // //     const updatedVenue = await repo.save(mergedVenue);

  // //     // Invalidate cache
  // //     await CacheService.invalidateMultiple([
  // //       `${this.CACHE_PREFIX}all`,
  // //       `${this.CACHE_PREFIX}${id}`,
  // //       `${this.CACHE_PREFIX}manager:${updatedVenue.organizationId}`,
  // //       `${this.CACHE_PREFIX}search:*`,
  // //     ]);

  // //     await queryRunner.commitTransaction();

  // //     return {
  // //       success: true,
  // //       data: updatedVenue,
  // //       message: "Venue updated successfully.",
  // //     };
  // //   } catch (error) {
  // //     await queryRunner.rollbackTransaction();
  // //     console.error("Error updating venue:", error);
  // //     return {
  // //       success: false,
  // //       message: `Failed to update venue: ${
  // //         error instanceof Error ? error.message : "Unknown error"
  // //       }`,
  // //     };
  // //   } finally {
  // //     await queryRunner.release();
  // //   }
  // // }

  // // Update venue manager
  // static async updateVenueManager(
  //   venueId: string,
  //   managerId: string
  // ): Promise<{ success: boolean; data?: Venue; message?: string }> {
  //   if (!venueId || !managerId) {
  //     return {
  //       success: false,
  //       message: "Both venueId and managerId are required.",
  //     };
  //   }

  //   try {
  //     const venueRepo = AppDataSource.getRepository(Venue);
  //     const userRepo = AppDataSource.getRepository(User);

  //     const venue = await venueRepo.findOne({
  //       where: { venueId, deletedAt: IsNull() },
  //       relations: ["organization"],
  //     });
  //     if (!venue) {
  //       return { success: false, message: "Venue not found or deleted." };
  //     }

  //     const manager = await userRepo.findOne({
  //       where: { userId: managerId },
  //       relations: ["role"],
  //     });
  //     if (!manager) {
  //       return { success: false, message: "Manager user not found." };
  //     }

  //     if (manager.role?.roleName?.toLowerCase() !== "venue_manager") {
  //       return { success: false, message: "User is not a venue manager." };
  //     }

  //     venue.organizationId = manager.userId;

  //     const updatedVenue = await venueRepo.save(venue);

  //     // Invalidate caches
  //     await CacheService.invalidateMultiple([
  //       `${this.CACHE_PREFIX}all`,
  //       `${this.CACHE_PREFIX}${venueId}`,
  //       `${this.CACHE_PREFIX}manager:${venue.organizationId}`,
  //       `${this.CACHE_PREFIX}manager:${managerId}`,
  //       `${this.CACHE_PREFIX}search:*`,
  //     ]);

  //     return {
  //       success: true,
  //       data: updatedVenue,
  //       message: "Venue manager updated successfully",
  //     };
  //   } catch (error) {
  //     console.error("Error updating venue manager:", error);
  //     return {
  //       success: false,
  //       message: `Failed to update venue manager: ${
  //         error instanceof Error ? error.message : "Unknown error"
  //       }`,
  //     };
  //   }
  // }

  // // Delete venue (soft delete)
  // static async delete(
  //   id: string
  // ): Promise<{ success: boolean; message?: string }> {
  //   if (!id) {
  //     return { success: false, message: "Venue ID is required." };
  //   }

  //   try {
  //     const repo = AppDataSource.getRepository(Venue);
  //     const venue = await repo.findOne({
  //       where: { venueId: id, deletedAt: IsNull() },
  //     });
  //     if (!venue) {
  //       return {
  //         success: false,
  //         message: "Venue not found or already deleted.",
  //       };
  //     }

  //     await repo.softRemove(venue);

  //     // Invalidate caches
  //     await CacheService.invalidateMultiple([
  //       `${this.CACHE_PREFIX}all`,
  //       `${this.CACHE_PREFIX}${id}`,
  //       `${this.CACHE_PREFIX}manager:${venue.organizationId}`,
  //       `${this.CACHE_PREFIX}search:*`,
  //     ]);

  //     return { success: true, message: "Venue soft-deleted successfully" };
  //   } catch (error) {
  //     console.error("Error soft-deleting venue:", error);
  //     return {
  //       success: false,
  //       message: `Failed to soft-delete venue: ${
  //         error instanceof Error ? error.message : "Unknown error"
  //       }`,
  //     };
  //   }
  // }

  // // Restore soft-deleted venue
  // static async restore(
  //   id: string
  // ): Promise<{ success: boolean; data?: Venue; message?: string }> {
  //   if (!id) {
  //     return { success: false, message: "Venue ID is required." };
  //   }

  //   try {
  //     const repo = AppDataSource.getRepository(Venue);
  //     const venue = await repo.findOne({
  //       where: { venueId: id },
  //       withDeleted: true,
  //     });
  //     if (!venue || !venue.deletedAt) {
  //       return { success: false, message: "Venue not found or not deleted." };
  //     }

  //     venue.deletedAt = undefined;
  //     const restoredVenue = await repo.save(venue);

  //     // Invalidate caches
  //     await CacheService.invalidateMultiple([
  //       `${this.CACHE_PREFIX}all`,
  //       `${this.CACHE_PREFIX}${id}`,
  //       `${this.CACHE_PREFIX}manager:${venue.organizationId}`,
  //       `${this.CACHE_PREFIX}search:*`,
  //     ]);

  //     return {
  //       success: true,
  //       data: restoredVenue,
  //       message: "Venue restored successfully",
  //     };
  //   } catch (error) {
  //     console.error("Error restoring venue:", error);
  //     return {
  //       success: false,
  //       message: `Failed to restore venue: ${
  //         error instanceof Error ? error.message : "Unknown error"
  //       }`,
  //     };
  //   }
  // }

  // // Get soft-deleted venues
  // static async getDeleted(): Promise<{
  //   success: boolean;
  //   data?: Venue[];
  //   message?: string;
  // }> {
  //   const cacheKey = `${this.CACHE_PREFIX}deleted`;
  //   try {
  //     const venues = await CacheService.getOrSetMultiple(
  //       cacheKey,
  //       AppDataSource.getRepository(Venue),
  //       async () => {
  //         return await AppDataSource.getRepository(Venue).find({
  //           where: { deletedAt: Not(IsNull()) },
  //           relations: ["organization"],
  //           withDeleted: true,
  //         });
  //       },
  //       this.CACHE_TTL
  //     );

  //     return { success: true, data: venues };
  //   } catch (error) {
  //     console.error("Error fetching deleted venues:", error);
  //     return {
  //       success: false,
  //       message: `Failed to fetch deleted venues: ${
  //         error instanceof Error ? error.message : "Unknown error"
  //       }`,
  //     };
  //   }
  // }

  // // Search venues
  // static async searchVenues(criteria: {
  //   name?: string;
  //   location?: string;
  //   minCapacity?: number;
  //   maxCapacity?: number;
  //   hasManager?: boolean;
  // }): Promise<{ success: boolean; data?: Venue[]; message?: string }> {
  //   const cacheKey = `${this.CACHE_PREFIX}search:${JSON.stringify(criteria)}`;
  //   try {
  //     const venues = await CacheService.getOrSetMultiple(
  //       cacheKey,
  //       AppDataSource.getRepository(Venue),
  //       async () => {
  //         const queryBuilder = AppDataSource.getRepository(Venue)
  //           .createQueryBuilder("venue")
  //           .leftJoinAndSelect("venue.organization", "organization")
  //           .where("venue.deletedAt IS NULL");

  //         if (criteria.name) {
  //           queryBuilder.andWhere("LOWER(venue.venueName) LIKE LOWER(:name)", {
  //             name: `%${criteria.name}%`,
  //           });
  //         }
  //         if (criteria.location) {
  //           queryBuilder.andWhere(
  //             "LOWER(venue.venueLocation) LIKE LOWER(:location)",
  //             { location: `%${criteria.location}%` }
  //           );
  //         }
  //         if (criteria.minCapacity) {
  //           queryBuilder.andWhere("venue.capacity >= :minCapacity", {
  //             minCapacity: criteria.minCapacity,
  //           });
  //         }
  //         if (criteria.maxCapacity) {
  //           queryBuilder.andWhere("venue.capacity <= :maxCapacity", {
  //             maxCapacity: criteria.maxCapacity,
  //           });
  //         }
  //         if (typeof criteria.hasManager === "boolean") {
  //           queryBuilder.andWhere(
  //             `venue.organizationId ${
  //               criteria.hasManager ? "IS NOT NULL" : "IS NULL"
  //             }`
  //           );
  //         }

  //         return await queryBuilder.orderBy("venue.venueName", "ASC").getMany();
  //       },
  //       this.CACHE_TTL
  //     );

  //     return { success: true, data: venues };
  //   } catch (error) {
  //     console.error("Error searching venues:", error);
  //     return {
  //       success: false,
  //       message: `Failed to search venues: ${
  //         error instanceof Error ? error.message : "Unknown error"
  //       }`,
  //     };
  //   }
  // }

  // // Get venue count
  // static async getVenueCount(): Promise<{
  //   success: boolean;
  //   count?: number;
  //   message?: string;
  // }> {
  //   try {
  //     const count = await AppDataSource.getRepository(Venue).count({
  //       where: { deletedAt: IsNull() },
  //     });
  //     return { success: true, count };
  //   } catch (error) {
  //     console.error("Error getting venue count:", error);
  //     return {
  //       success: false,
  //       message: `Failed to get venue count: ${
  //         error instanceof Error ? error.message : "Unknown error"
  //       }`,
  //     };
  //   }
  // }

  // // Remove venue manager
  // // static async removeVenueManager(
  // //   venueId: string
  // // ): Promise<{ success: boolean; data?: Venue; message?: string }> {
  // //   if (!venueId) {
  // //     return { success: false, message: "Venue ID is required." };
  // //   }

  // //   try {
  // //     const repo = AppDataSource.getRepository(Venue);
  // //     const venue = await repo.findOne({
  // //       where: { venueId, deletedAt: IsNull() },
  // //     });
  // //     if (!venue) {
  // //       return { success: false, message: "Venue not found or deleted." };
  // //     }

  // //     const oldManagerId = venue.organizationId;
  // //     venue.organizationId = undefined;

  // //     const updatedVenue = await repo.save(venue);

  // //     // Invalidate caches
  // //     await CacheService.invalidateMultiple([
  // //       `${this.CACHE_PREFIX}all`,
  // //       `${this.CACHE_PREFIX}${venueId}`,
  // //       `${this.CACHE_PREFIX}manager:${oldManagerId}`,
  // //       `${this.CACHE_PREFIX}search:*`,
  // //     ]);

  // //     return {
  // //       success: true,
  // //       data: updatedVenue,
  // //       message: "Venue manager removed successfully.",
  // //     };
  // //   } catch (error) {
  // //     console.error("Error removing venue manager:", error);
  // //     return {
  // //       success: false,
  // //       message: `Failed to remove venue manager: ${
  // //         error instanceof Error ? error.message : "Unknown error"
  // //       }`,
  // //     };
  // //   }
  // // }

  // // // Get bookings by venue
  // // static async getBookingsByVenue(
  // //   venueId: string
  // // ): Promise<{ success: boolean; data?: VenueBooking[]; message?: string }> {
  // //   if (!venueId) {
  // //     return { success: false, message: "Venue ID is required." };
  // //   }

  // //   const cacheKey = `${this.CACHE_PREFIX}${venueId}:bookings`;
  // //   try {
  // //     const bookings = await CacheService.getOrSetMultiple(
  // //       cacheKey,
  // //       AppDataSource.getRepository(VenueBooking),
  // //       async () => {
  // //         return await AppDataSource.getRepository(VenueBooking).find({
  // //           where: { venueId },
  // //           relations: ["event"],
  // //           order: { createdAt: "ASC" },
  // //         });
  // //       },
  // //       this.CACHE_TTL
  // //     );

  // //     return { success: true, data: bookings };
  // //   } catch (error) {
  // //     console.error("Error fetching bookings by venue:", error);
  // //     return {
  // //       success: false,
  // //       message: `Failed to fetch bookings: ${
  // //         error instanceof Error ? error.message : "Unknown error"
  // //       }`,
  // //     };
  // //   }
  // // }

  // // Get venues by proximity
  // static async getVenuesByProximity(
  //   latitude: number,
  //   longitude: number,
  //   radiusKm: number
  // ): Promise<{ success: boolean; data?: Venue[]; message?: string }> {
  //   if (!latitude || !longitude || !radiusKm) {
  //     return {
  //       success: false,
  //       message: "Latitude, longitude, and radius are required.",
  //     };
  //   }

  //   const cacheKey = `${this.CACHE_PREFIX}proximity:${latitude}:${longitude}:${radiusKm}`;
  //   try {
  //     const venues = await CacheService.getOrSetMultiple(
  //       cacheKey,
  //       AppDataSource.getRepository(Venue),
  //       async () => {
  //         // Use PostGIS or simple Haversine formula for distance calculation
  //         const earthRadiusKm = 6371;
  //         const queryBuilder = AppDataSource.getRepository(Venue)
  //           .createQueryBuilder("venue")
  //           .leftJoinAndSelect("venue.organization", "organization")
  //           .where("venue.deletedAt IS NULL")
  //           .andWhere("venue.latitude IS NOT NULL")
  //           .andWhere("venue.longitude IS NOT NULL");

  //         // Haversine formula
  //         queryBuilder.select([
  //           "venue.*",
  //           `(${earthRadiusKm} * 2 * ASIN(SQRT(
  //             POW(SIN((RADIANS(:latitude - venue.latitude)) / 2), 2) +
  //             COS(RADIANS(venue.latitude)) * COS(RADIANS(:latitude)) *
  //             POW(SIN((RADIANS(:longitude - venue.longitude)) / 2), 2)
  //           ))) AS distance`,
  //         ]);

  //         queryBuilder.setParameters({ latitude, longitude });
  //         queryBuilder.having("distance <= :radiusKm", { radiusKm });
  //         queryBuilder.orderBy("distance", "ASC");

  //         return await queryBuilder.getRawMany();
  //       },
  //       this.CACHE_TTL
  //     );

  //     return { success: true, data: venues };
  //   } catch (error) {
  //     console.error("Error fetching venues by proximity:", error);
  //     return {
  //       success: false,
  //       message: `Failed to fetch venues by proximity: ${
  //         error instanceof Error ? error.message : "Unknown error"
  //       }`,
  //     };
  //   }
  // }

  // // // Create multiple venues
  // // static async createMultiple(
  // //   venuesData: VenueRequest[]
  // // ): Promise<{ success: boolean; venues: Venue[]; errors: any[] }> {
  // //   const venues: Venue[] = [];
  // //   const errors: any[] = [];

  // //   for (const data of venuesData) {
  // //     try {
  // //       const createResult = this.create(data);
  // //       if (!createResult.success || !createResult.data) {
  // //         errors.push({ data, message: createResult.message });
  // //         continue;
  // //       }

  // //       const saveResult = await this.saveFullVenue(createResult.data);
  // //       if (saveResult.success && saveResult.data) {
  // //         venues.push(saveResult.data);
  // //       } else {
  // //         errors.push({ data, message: saveResult.message });
  // //       }
  // //     } catch (error) {
  // //       errors.push({
  // //         data,
  // //         message: error instanceof Error ? error.message : "Unknown error",
  // //       });
  // //     }
  // //   }

  // //   // Invalidate cache for all venues
  // //   await CacheService.invalidate(`${this.CACHE_PREFIX}all`);

  // //   return { success: errors.length === 0, venues, errors };
  // // }

  // // // Get resources by venue ID
  // // static async getResourcesByVenueId(
  // //   venueId: string
  // // ): Promise<{ success: boolean; data?: any[]; message?: string }> {
  // //   if (!venueId) {
  // //     return { success: false, message: "Venue ID is required." };
  // //   }
  // //   try {
  // //     // Find all events at this venue
  // //     const eventRepo = AppDataSource.getRepository("Event");
  // //     const eventResourceRepo = AppDataSource.getRepository("EventResource");
  // //     const resourceRepo = AppDataSource.getRepository("Resource");

  // //     // Get all eventIds for this venue
  // //     const events = await eventRepo
  // //       .createQueryBuilder("event")
  // //       .leftJoin("event.venues", "venue")
  // //       .where("venue.venueId = :venueId", { venueId })
  // //       .getMany();
  // //     const eventIds = events.map((e) => e.eventId);
  // //     if (eventIds.length === 0) {
  // //       return {
  // //         success: true,
  // //         data: [],
  // //         message: "No events for this venue.",
  // //       };
  // //     }
  // //     // Get all resources for these events
  // //     const eventResources = await eventResourceRepo
  // //       .createQueryBuilder("eventResource")
  // //       .leftJoinAndSelect("eventResource.resource", "resource")
  // //       .where("eventResource.eventId IN (:...eventIds)", { eventIds })
  // //       .getMany();
  // //     // Map to unique resources
  // //     const resourcesMap = new Map();
  // //     for (const er of eventResources) {
  // //       if (er.resource) resourcesMap.set(er.resource.resourceId, er.resource);
  // //     }
  // //     return { success: true, data: Array.from(resourcesMap.values()) };
  // //   } catch (error) {
  // //     console.error("Error fetching resources by venue ID:", error);
  // //     return {
  // //       success: false,
  // //       message: `Failed to fetch resources: ${
  // //         error instanceof Error ? error.message : "Unknown error"
  // //       }`,
  // //     };
  // //   }
  // // }

  // static async findAvailableVenues(
  //   startDate: Date,
  //   endDate: Date,
  //   startTime: string,
  //   endTime: string,
  //   bufferMinutes: number = 30
  // ): Promise<{
  //   success: boolean;
  //   data?: {
  //     availableVenues: Venue[];
  //     isAvailableInFuture: boolean;
  //     conflictingVenues: { venue: Venue; conflictingEvents: AppEvent[] }[];
  //     nextAvailableTime?: string;
  //   };
  //   message?: string;
  // }> {
  //   const cacheKey = `${
  //     this.CACHE_PREFIX
  //   }available:${startDate.toISOString()}:${endDate.toISOString()}:${startTime}:${endTime}:${bufferMinutes}`;

  //   try {
  //     // Combine date and time into full Date objects
  //     const parseTime = (date: Date, time: string): Date => {
  //       const [hours, minutes] = time.split(":").map(Number);
  //       const newDate = new Date(date);
  //       newDate.setHours(hours, minutes, 0, 0);
  //       return newDate;
  //     };

  //     const eventStart = parseTime(startDate, startTime);
  //     const eventEnd = parseTime(endDate, endTime);

  //     // Validate input: start must be in the future
  //     if (eventStart <= new Date()) {
  //       return {
  //         success: false,
  //         message: "Start date/time must be in the future.",
  //       };
  //     }
  //     // Validate input: end must be after start
  //     if (eventEnd <= eventStart) {
  //       return {
  //         success: false,
  //         message: "End date/time must be after start date/time.",
  //       };
  //     }

  //     // Use cache if available
  //     type AvailableVenuesCacheType = {
  //       availableVenues: Venue[];
  //       isAvailableInFuture: boolean;
  //       conflictingVenues: { venue: Venue; conflictingEvents: AppEvent[] }[];
  //     };
  //     let cachedResult = await CacheService.get<AvailableVenuesCacheType>(
  //       cacheKey
  //     );
  //     if (!cachedResult) {
  //       // Get all venues that are not deleted (regardless of status)
  //       const allVenues = await AppDataSource.getRepository(Venue).find({
  //         where: { deletedAt: IsNull() },
  //         relations: ["organization"],
  //       });

  //       const availableVenues: Array<
  //         Venue & {
  //           previousEvent?: {
  //             startDate: string;
  //             startTime: string;
  //             endDate: string;
  //             endTime: string;
  //           };
  //           nextAvailableTime: string;
  //         }
  //       > = [];
  //       const conflictingVenues: {
  //         venue: Venue;
  //         conflictingEvents: AppEvent[];
  //       }[] = [];

  //       // Check each venue for availability
  //       for (const venue of allVenues) {
  //         // Check for conflicting bookings (approved)
  //         const conflictingBookings = await AppDataSource.getRepository(
  //           VenueBooking
  //         )
  //           .createQueryBuilder("booking")
  //           .leftJoinAndSelect("booking.event", "event")
  //           .where("booking.venueId = :venueId", { venueId: venue.venueId })
  //           .andWhere("booking.approvalStatus = :status", {
  //             status: "approved",
  //           })
  //           .andWhere(
  //             "((event.startDate < :eventEnd AND event.endDate > :eventStart) OR " +
  //               "(event.startDate = :eventStart AND event.startTime <= :endTime AND event.endTime >= :startTime))",
  //             {
  //               eventStart,
  //               eventEnd,
  //               startTime:
  //                 typeof startTime === "string" ? startTime : String(startTime),
  //               endTime:
  //                 typeof endTime === "string" ? endTime : String(endTime),
  //             }
  //           )
  //           .getMany();

  //         // Check for conflicting events directly (even if no booking exists)
  //         const conflictingEvents = await AppDataSource.getRepository(AppEvent)
  //           .createQueryBuilder("event")
  //           .leftJoin("event.venues", "venue")
  //           .where("venue.venueId = :venueId", { venueId: venue.venueId })
  //           .andWhere("event.status = :status", { status: "APPROVED" })
  //           .andWhere(
  //             "((event.startDate < :eventEnd AND event.endDate > :eventStart) OR " +
  //               "(event.startDate = :eventStart AND event.startTime <= :endTime AND event.endTime >= :startTime))",
  //             {
  //               eventStart,
  //               eventEnd,
  //               startTime:
  //                 typeof startTime === "string" ? startTime : String(startTime),
  //               endTime:
  //                 typeof endTime === "string" ? endTime : String(endTime),
  //             }
  //           )
  //           .getMany();

  //         if (
  //           conflictingBookings.length === 0 &&
  //           conflictingEvents.length === 0
  //         ) {
  //           // Find the latest event that ends before the requested start time
  //           const previousBooking = await AppDataSource.getRepository(
  //             VenueBooking
  //           )
  //             .createQueryBuilder("booking")
  //             .leftJoinAndSelect("booking.event", "event")
  //             .where("booking.venueId = :venueId", { venueId: venue.venueId })
  //             .andWhere("booking.approvalStatus = :status", {
  //               status: "approved",
  //             })
  //             .andWhere(
  //               "((event.endDate < :eventStart) OR (event.endDate = :eventStart AND event.endTime < :startTime))",
  //               {
  //                 eventStart,
  //                 startTime:
  //                   typeof startTime === "string"
  //                     ? startTime
  //                     : String(startTime),
  //               }
  //             )
  //             .orderBy("event.endDate", "DESC")
  //             .addOrderBy("event.endTime", "DESC")
  //             .getOne();

  //           let previousEvent = undefined;
  //           let nextAvailableTime = undefined;
  //           if (previousBooking && previousBooking.event) {
  //             previousEvent = {
  //               startDate: previousBooking.event.startDate || "",
  //               startTime: previousBooking.event.startTime || "",
  //               endDate: previousBooking.event.endDate || "",
  //               endTime: previousBooking.event.endTime || "",
  //             };
  //             // Calculate next available time: previous event's end + 15 minutes
  //             function parseDateTime(
  //               dateStr: string,
  //               timeStr: string
  //             ): number | null {
  //               if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return null;
  //               let [hour, minute] = [0, 0];
  //               let t = timeStr.trim();
  //               let ampm = null;
  //               if (/am|pm/i.test(t)) {
  //                 ampm = t.slice(-2).toLowerCase();
  //                 t = t.slice(0, -2).trim();
  //               }
  //               const parts = t.split(":");
  //               if (parts.length !== 2) return null;
  //               hour = parseInt(parts[0], 10);
  //               minute = parseInt(parts[1], 10);
  //               if (isNaN(hour) || isNaN(minute)) return null;
  //               if (ampm) {
  //                 if (ampm === "pm" && hour !== 12) hour += 12;
  //                 if (ampm === "am" && hour === 12) hour = 0;
  //               }
  //               const date = new Date(`${dateStr}T00:00:00Z`);
  //               if (isNaN(date.getTime())) return null;
  //               return (
  //                 date.getTime() + hour * 60 * 60 * 1000 + minute * 60 * 1000
  //               );
  //             }
  //             const prevEndMillis = parseDateTime(
  //               previousBooking.event.endDate,
  //               previousBooking.event.endTime || "00:00"
  //             );
  //             if (prevEndMillis !== null) {
  //               const nextMillis = prevEndMillis + 15 * 60 * 1000;
  //               nextAvailableTime = new Date(nextMillis).toISOString();
  //             }
  //           }
  //           availableVenues.push({
  //             ...venue,
  //             previousEvent,
  //             nextAvailableTime: nextAvailableTime || "",
  //           });
  //         } else {
  //           conflictingVenues.push({
  //             venue,
  //             conflictingEvents: [
  //               ...conflictingBookings.map((booking) => booking.event),
  //               ...conflictingEvents,
  //             ],
  //           });
  //         }
  //       }

  //       // Check future availability (e.g., 30 minutes after event start)
  //       const futureTime = new Date(
  //         eventStart.getTime() + bufferMinutes * 60 * 1000
  //       );
  //       const futureConflicts = await AppDataSource.getRepository(VenueBooking)
  //         .createQueryBuilder("booking")
  //         .leftJoin("booking.event", "event")
  //         .where("booking.approvalStatus = :status", { status: "approved" })
  //         .andWhere(
  //           "((event.startDate < :futureTime AND event.endDate > :futureTime) OR " +
  //             "(event.startDate = :futureTime AND event.startTime <= :futureTimeStr AND event.endTime >= :futureTimeStr))",
  //           {
  //             futureTime,
  //             futureTimeStr: futureTime.toISOString().substring(11, 16), // "HH:mm"
  //           }
  //         )
  //         .getCount();

  //       cachedResult = {
  //         availableVenues,
  //         isAvailableInFuture: futureConflicts === 0,
  //         conflictingVenues,
  //       };
  //       await CacheService.set(cacheKey, cachedResult, this.CACHE_TTL);
  //     }

  //     let nextAvailableTime: string | undefined = undefined;
  //     if (
  //       cachedResult.availableVenues.length === 0 &&
  //       cachedResult.isAvailableInFuture
  //     ) {
  //       // Find the soonest time after the requested slot when any venue is free
  //       // Find the earliest end time among all conflicting events, add 15 minutes
  //       let minEndDate: Date | null = null;
  //       let minEndTime: string | null = null;
  //       for (const conflict of cachedResult.conflictingVenues) {
  //         for (const event of conflict.conflictingEvents) {
  //           // event.endDate is always a string now; no instanceof Date check needed
  //           const endDate =
  //             typeof event.endDate === "string"
  //               ? event.endDate
  //               : new Date(event.endDate).toISOString(); // fallback if needed

  //           const endTime = event.endTime || "00:00";
  //           let eventEnd = new Date(endDate);
  //           const [h, m] = endTime.split(":").map(Number);
  //           eventEnd.setHours(h, m, 0, 0);
  //           if (!minEndDate || eventEnd < minEndDate) {
  //             minEndDate = eventEnd;
  //             minEndTime = endTime;
  //           }
  //         }
  //       }
  //       if (minEndDate) {
  //         // Add 15 minutes to the earliest end time
  //         minEndDate = new Date(minEndDate.getTime() + 15 * 60 * 1000);
  //         nextAvailableTime = minEndDate.toISOString();
  //       } else {
  //         // fallback: 15 minutes after requested end
  //         const fallback = new Date(eventEnd.getTime() + 15 * 60 * 1000);
  //         nextAvailableTime = fallback.toISOString();
  //       }
  //     }
  //     return {
  //       success: true,
  //       data: {
  //         ...cachedResult,
  //         nextAvailableTime,
  //       },
  //       message: cachedResult.availableVenues.length
  //         ? `${cachedResult.availableVenues.length} venue(s) available for the requested time slot.`
  //         : "No venues available for the requested time slot.",
  //     };
  //   } catch (error) {
  //     console.error("Error finding available venues:", error);
  //     return {
  //       success: false,
  //       message: `Failed to find available venues: ${
  //         error instanceof Error ? error.message : "Unknown error"
  //       }`,
  //     };
  //   }
  // }

  // static async findFullyAvailableVenues(
  //   startDate: string,
  //   endDate: string,
  //   startTime: string,
  //   endTime: string,
  //   bufferMinutes: number = 30
  // ): Promise<{
  //   success: boolean;
  //   data?: Venue[];
  //   message?: string;
  //   error?: any;
  // }> {
  //   // Helper to parse date and time (YYYY-MM-DD, HH:mm or HH:mm AM/PM) to minutes since epoch
  //   function parseDateTime(dateStr: string, timeStr: string): number | null {
  //     if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return null;
  //     let [hour, minute] = [0, 0];
  //     let t = timeStr.trim();
  //     let ampm = null;
  //     if (/am|pm/i.test(t)) {
  //       ampm = t.slice(-2).toLowerCase();
  //       t = t.slice(0, -2).trim();
  //     }
  //     const parts = t.split(":");
  //     if (parts.length !== 2) return null;
  //     hour = parseInt(parts[0], 10);
  //     minute = parseInt(parts[1], 10);
  //     if (isNaN(hour) || isNaN(minute)) return null;
  //     if (ampm) {
  //       if (ampm === "pm" && hour !== 12) hour += 12;
  //       if (ampm === "am" && hour === 12) hour = 0;
  //     }
  //     const date = new Date(`${dateStr}T00:00:00Z`);
  //     if (isNaN(date.getTime())) return null;
  //     return date.getTime() + hour * 60 * 60 * 1000 + minute * 60 * 1000;
  //   }
  //   try {
  //     const venues = await AppDataSource.getRepository(Venue).find({
  //       where: { status: VenueStatus.APPROVED, deletedAt: IsNull() },
  //       relations: ["organization"],
  //     });

  //     if (!venues || venues.length === 0) {
  //       return {
  //         success: false,
  //         message: "No approved venues found in the system.",
  //         error: {
  //           code: "NO_VENUES",
  //           details: "VenueRepository returned 0 records.",
  //         },
  //       };
  //     }

  //     const reqStart = parseDateTime(startDate, startTime);
  //     const reqEnd = parseDateTime(endDate, endTime);
  //     if (reqStart === null || reqEnd === null) {
  //       return {
  //         success: false,
  //         message: "Invalid date or time format.",
  //       };
  //     }
  //     // Validate input: start must be in the future
  //     if (reqStart <= Date.now()) {
  //       return {
  //         success: false,
  //         message: "Start date/time must be in the future.",
  //       };
  //     }
  //     // Validate input: end must be after start
  //     if (reqEnd <= reqStart) {
  //       return {
  //         success: false,
  //         message: "End date/time must be after start date/time.",
  //       };
  //     }

  //     const availableVenues: Venue[] = [];

  //     for (const venue of venues) {
  //       const bookings = await AppDataSource.getRepository(VenueBooking)
  //         .createQueryBuilder("booking")
  //         .leftJoinAndSelect("booking.event", "event")
  //         .where("booking.venueId = :venueId", { venueId: venue.venueId })
  //         .andWhere("booking.approvalStatus = :status", { status: "approved" })
  //         .andWhere("event.status = :eventStatus", { eventStatus: "APPROVED" })
  //         .getMany();

  //       let isAvailableAllDays = true;

  //       for (const booking of bookings) {
  //         if (!booking.event) continue;
  //         const eventStart = parseDateTime(
  //           booking.event.startDate,
  //           booking.event.startTime || "00:00"
  //         );
  //         const eventEnd = parseDateTime(
  //           booking.event.endDate,
  //           booking.event.endTime || "23:59"
  //         );
  //         if (eventStart === null || eventEnd === null) continue;
  //         // Check for overlap with buffer
  //         if (
  //           eventStart - bufferMinutes * 60000 < reqEnd &&
  //           reqStart < eventEnd + bufferMinutes * 60000
  //         ) {
  //           isAvailableAllDays = false;
  //           break;
  //         }
  //       }

  //       if (isAvailableAllDays) {
  //         availableVenues.push(venue);
  //       }
  //     }

  //     return {
  //       success: true,
  //       data: availableVenues,
  //       message: `${availableVenues.length} venue(s) available for requested time range.`,
  //     };
  //   } catch (error: any) {
  //     console.error("Repository error: findFullyAvailableVenues ->", error);
  //     return {
  //       success: false,
  //       message: "Error occurred while checking venue availability.",
  //       error: {
  //         message: error?.message || "Unknown error",
  //         stack: error?.stack || null,
  //       },
  //     };
  //   }
  // }

  // /**
  //  * Retrieves all venues with an 'APPROVED' status, not soft-deleted,
  //  * including their manager, organization, users, and resources.
  //  * This method is cached.
  //  *
  //  * @returns A result object containing approved venues or an error message.
  //  */
  // static async getApprovedVenues(): Promise<{
  //   success: boolean;
  //   data?: Venue[];
  //   message?: string;
  // }> {
  //   const cacheKey = `${this.CACHE_PREFIX}approved`; // Specific cache key for approved venues
  //   try {
  //     const cachedVenues = await CacheService.get<Venue[]>(cacheKey);
  //     if (cachedVenues) {
  //       return {
  //         success: true,
  //         data: cachedVenues,
  //         message: "Approved venues fetched from cache.",
  //       };
  //     }

  //     const venues = await AppDataSource.getRepository(Venue).find({
  //       where: {
  //         status: VenueStatus.APPROVED,
  //         deletedAt: IsNull(), // Ensure only non-soft-deleted venues are returned
  //       },
  //       relations: [
  //         "organization", // Corrected: A venue has one organization, not 'organizations' array
  //         "users", // Corrected: 'users' is the relation to the User entity directly
  //         "resources", // Added: To fetch associated resources
  //       ],
  //     });

  //     await CacheService.set(cacheKey, venues); // Cache the result
  //     return {
  //       success: true,
  //       data: venues,
  //       message: "Approved venues retrieved successfully.",
  //     };
  //   } catch (error: any) {
  //     console.error("Error finding approved venues:", error.message);
  //     return {
  //       success: false,
  //       message: `Failed to find approved venues due to a server error: ${
  //         error.message || "Unknown error"
  //       }`,
  //     };
  //   }
  // }

  // static async getVenuesWithApprovedEvents(): Promise<{
  //   success: boolean;
  //   data?: any[];
  //   message?: string;
  // }> {
  //   try {
  //     const venues = await AppDataSource.getRepository(Venue)
  //       .createQueryBuilder("venue")
  //       .leftJoinAndSelect("venue.events", "event")
  //       .where("venue.deletedAt IS NULL")
  //       .andWhere("event.status = :status", { status: "APPROVED" })
  //       .getMany();
  //     return { success: true, data: venues };
  //   } catch (error) {
  //     console.error("Error fetching venues with approved events:", error);
  //     return {
  //       success: false,
  //       message: "Failed to fetch venues with approved events.",
  //     };
  //   }
  // }

  // static async getVenuesWithApprovedEventsViaBookings(): Promise<{
  //   success: boolean;
  //   data?: any[];
  //   message?: string;
  // }> {
  //   try {
  //     const venues = await AppDataSource.getRepository(Venue)
  //       .createQueryBuilder("venue")
  //       .leftJoinAndSelect("venue.bookings", "booking")
  //       .leftJoinAndSelect("booking.event", "event")
  //       .where("event.status = :status", { status: "APPROVED" })
  //       .andWhere("venue.deletedAt IS NULL")
  //       .getMany();

  //     // Filter out venues with no approved events
  //     const venuesWithApprovedEvents = venues.filter(
  //       (v) =>
  //         v.bookings &&
  //         v.bookings.some((b) => b.event && b.event.status === "APPROVED")
  //     );

  //     return { success: true, data: venuesWithApprovedEvents };
  //   } catch (error) {
  //     console.error(
  //       "Error fetching venues with approved events via bookings:",
  //       error
  //     );
  //     return {
  //       success: false,
  //       message: "Failed to fetch venues with approved events via bookings.",
  //     };
  //   }
  // }
}
