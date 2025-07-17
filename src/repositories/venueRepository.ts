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
import { Event as AppEvent } from "../models/Event Tables/Event";
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
}
