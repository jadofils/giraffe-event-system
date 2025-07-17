import { VenueBooking } from "../models/VenueBooking";
import { AppDataSource } from "../config/Database";
import { In } from "typeorm";
import { VenueVariable } from "../models/Venue Tables/VenueVariable";
import { CacheService } from "../services/CacheService";

export class VenueBookingRepository {
  static async getAllBookings() {
    try {
      const repo = AppDataSource.getRepository(VenueBooking);
      const bookings = await repo.find();
      return {
        success: true,
        message: "All bookings fetched successfully.",
        data: bookings,
      };
    } catch (error) {
      return { success: false, message: "Failed to fetch bookings.", data: [] };
    }
  }

  static async getBookingsByManagerId(managerId: string) {
    const cacheKey = `venue-bookings:manager:${managerId}`;
    return await CacheService.getOrSetMultiple(
      cacheKey,
      AppDataSource.getRepository(VenueBooking),
      async () => {
        // Find all venues managed by this manager
        const venueVariables = await AppDataSource.getRepository(
          VenueVariable
        ).find({
          where: { manager: { userId: managerId } },
          relations: ["venue"],
        });
        const venueIds = venueVariables.map((vv) => vv.venue.venueId);
        if (venueIds.length === 0) {
          return [];
        }
        // Find all bookings for these venues
        return await AppDataSource.getRepository(VenueBooking).find({
          where: { venueId: In(venueIds) },
        });
      }
    );
  }
}
