import { AppDataSource } from "../config/Database";
import { Repository, LessThanOrEqual, MoreThanOrEqual } from "typeorm";
import { Event } from "../models/Event";
import { Organization } from "../models/Organization";
import { Venue } from "../models/Venue";
import { User } from "../models/User";
import { VenueBookingInterface } from "../interfaces/VenueBookingInterface";
import { VenueBooking } from "../models/VenueBooking";
import { CacheService } from "../services/CacheService";

export class VenueBookingRepository {
  private static readonly CACHE_PREFIX = "booking:";
  private static readonly CACHE_TTL = 3600; // 1 hour, consistent with VenueRepository

  private static venueBookingRepository: Repository<VenueBooking>;
  private static eventRepository: Repository<Event>;
  private static organizationRepository: Repository<Organization>;
  private static userRepository: Repository<User>;
  private static venueRepository: Repository<Venue>;

  // Initialize venue booking repository
  static getVenueBookingRepository(): Repository<VenueBooking> {
    if (!this.venueBookingRepository) {
      if (!AppDataSource.isInitialized) {
        throw new Error("Database not initialized.");
      }
      this.venueBookingRepository = AppDataSource.getRepository(VenueBooking);
    }
    return this.venueBookingRepository;
  }

  // Initialize event repository
  static getEventRepository(): Repository<Event> {
    if (!this.eventRepository) {
      this.eventRepository = AppDataSource.getRepository(Event);
    }
    return this.eventRepository;
  }

  // Initialize organization repository
  static getOrganizationRepository(): Repository<Organization> {
    if (!this.organizationRepository) {
      this.organizationRepository = AppDataSource.getRepository(Organization);
    }
    return this.organizationRepository;
  }

  // Initialize user repository
  static getUserRepository(): Repository<User> {
    if (!this.userRepository) {
      this.userRepository = AppDataSource.getRepository(User);
    }
    return this.userRepository;
  }

  // Initialize venue repository
  static getVenueRepository(): Repository<Venue> {
    if (!this.venueRepository) {
      this.venueRepository = AppDataSource.getRepository(Venue);
    }
    return this.venueRepository;
  }

  // Check for duplicate bookings
  static async checkDuplicateBookings(
    venueId: string,
    startDate: Date,
    endDate: Date,
    startTime?: string,
    endTime?: string,
    excludeBookingId?: string
  ): Promise<{ success: boolean; message?: string; conflicts?: VenueBooking[] }> {
    try {
      if (!venueId || !startDate || !endDate) {
        return { success: false, message: "Venue ID, start date, and end date are required." };
      }

      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        return { success: false, message: "Invalid date format." };
      }

      if (startDate > endDate) {
        return { success: false, message: "Start date cannot be after end date." };
      }

      const bookingRepo = this.getVenueBookingRepository();
      const query = bookingRepo.createQueryBuilder("booking")
        .leftJoinAndSelect("booking.event", "event")
        .leftJoinAndSelect("booking.venue", "venue")
        .where("booking.venueId = :venueId", { venueId })
        .andWhere("booking.approvalStatus = :status", { status: "approved" });

      if (excludeBookingId) {
        query.andWhere("booking.bookingId != :excludeBookingId", { excludeBookingId });
      }

      const bookings = await query.getMany();

      const conflicts = bookings.filter(booking => {
        if (!booking.event) return false;
        const event = booking.event;
        const eventStart = event.startTime
          ? new Date(`${event.startDate.toISOString().split("T")[0]}T${event.startTime}:00Z`)
          : event.startDate;
        const eventEnd = event.endTime
          ? new Date(`${event.endDate.toISOString().split("T")[0]}T${event.endTime}:00Z`)
          : event.endDate;
        const proposedStart = startTime
          ? new Date(`${startDate.toISOString().split("T")[0]}T${startTime}:00Z`)
          : startDate;
        const proposedEnd = endTime
          ? new Date(`${endDate.toISOString().split("T")[0]}T${endTime}:00Z`)
          : endDate;
        return eventStart <= proposedEnd && eventEnd >= proposedStart;
      });

      if (conflicts.length > 0) {
        return {
          success: false,
          message: "Conflicting bookings found for the requested period.",
          conflicts,
        };
      }

      return { success: true, message: "No conflicting bookings found." };
    } catch (error) {
      console.error("Error checking duplicate bookings:", error);
      return { success: false, message: `Failed to check duplicate bookings: ${error instanceof Error ? error.message : "Unknown error"}` };
    }
  }

  // Create a single booking
  static async createBooking(
    bookingData: VenueBookingInterface
  ): Promise<{ success: boolean; message?: string; data?: VenueBooking }> {
    try {
      // Validate required fields
      if (
        !bookingData.eventId ||
        !bookingData.venueId ||
        !bookingData.organizerId ||
        !bookingData.organizationId ||
        !bookingData.event?.startDate ||
        !bookingData.event?.endDate ||
        !bookingData.event?.startTime ||
        !bookingData.event?.endTime
      ) {
        return { success: false, message: "Missing required booking fields: eventId, venueId, organizerId, organizationId, startDate, endDate, startTime, endTime." };
      }

      // Parse and validate dates
      const startDate = new Date(bookingData.event.startDate);
      const endDate = new Date(bookingData.event.endDate);
      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime()) || startDate > endDate) {
        return { success: false, message: "Invalid or inconsistent date format." };
      }

      // Initialize repositories
      const eventRepo = this.getEventRepository();
      const venueRepo = this.getVenueRepository();
      const userRepo = this.getUserRepository();
      const orgRepo = this.getOrganizationRepository();
      const bookingRepo = this.getVenueBookingRepository();

      // Fetch related entities
      const event = await eventRepo.findOne({ where: { eventId: bookingData.eventId } });
      if (!event) return { success: false, message: "Event does not exist." };

      const venue = await venueRepo.findOne({ where: { venueId: bookingData.venueId } });
      if (!venue) return { success: false, message: "Venue does not exist." };

      if (event.maxAttendees && event.maxAttendees > venue.capacity) {
        return { success: false, message: "Venue capacity is insufficient for the expected attendance." };
      }

      const user = await userRepo.findOne({ where: { userId: bookingData.organizerId } });
      if (!user) return { success: false, message: "Organizer does not exist." };

      const organization = await orgRepo.findOne({ where: { organizationId: bookingData.organizationId } });
      if (!organization) return { success: false, message: "Organization does not exist." };

      // Check for duplicate bookings
      const conflictCheck = await this.checkDuplicateBookings(
        bookingData.venueId,
        startDate,
        endDate,
        bookingData.event.startTime,
        bookingData.event.endTime
      );
      if (!conflictCheck.success) {
        return { success: false, message: conflictCheck.message, data: conflictCheck.conflicts?.[0] };
      }

      // Set default approval status
      bookingData.approvalStatus = bookingData.approvalStatus || "pending";

      // Create booking entity
      const newBooking = bookingRepo.create({
        event: event,
        venue,
        user,
        organization,
        approvalStatus: bookingData.approvalStatus as any, // Enum compatibility
      });

      // Save booking
      const savedBooking = await bookingRepo.save(newBooking);

      // Invalidate caches
      await CacheService.invalidateMultiple([
        `${this.CACHE_PREFIX}all`,
        `${this.CACHE_PREFIX}${savedBooking.bookingId}`,
        `${this.CACHE_PREFIX}event:${bookingData.eventId}`,
        `${this.CACHE_PREFIX}venue:${bookingData.venueId}`,
        `${this.CACHE_PREFIX}organizer:${bookingData.organizerId}`,
        `${this.CACHE_PREFIX}organization:${bookingData.organizationId}`,
        `${this.CACHE_PREFIX}status:*`,
      ]);

      return { success: true, data: savedBooking, message: "Booking created successfully." };
    } catch (error) {
      console.error("Error creating booking:", error);
      return { success: false, message: `Failed to create booking: ${error instanceof Error ? error.message : "Unknown error"}` };
    }
  }

  // Create multiple bookings
  static async createMultipleBookings(
    bookingsData: VenueBookingInterface[]
  ): Promise<{ success: boolean; bookings: VenueBooking[]; errors: { data: VenueBookingInterface; message: string }[] }> {
    const bookings: VenueBooking[] = [];
    const errors: { data: VenueBookingInterface; message: string }[] = [];

    for (const bookingData of bookingsData) {
      try {
        const createResult = await this.createBooking(bookingData);
        if (createResult.success && createResult.data) {
          bookings.push(createResult.data);
        } else {
          errors.push({ data: bookingData, message: createResult.message || "Failed to create booking." });
        }
      } catch (error) {
        errors.push({
          data: bookingData,
          message: `Failed to create booking: ${error instanceof Error ? error.message : "Unknown error"}`,
        });
      }
    }

    // Invalidate cache for all bookings
    await CacheService.invalidateMultiple([
      `${this.CACHE_PREFIX}all`,
      `${this.CACHE_PREFIX}status:*`,
    ]);

    return { success: errors.length === 0, bookings, errors };
  }

  // Get all bookings
  static async getAllBookings(): Promise<{ success: boolean; message?: string; data?: VenueBooking[] }> {
    const cacheKey = `${this.CACHE_PREFIX}all`;
    try {
      const bookings = await CacheService.getOrSetMultiple(
        cacheKey,
        this.getVenueBookingRepository(),
        async () => {
          return await this.getVenueBookingRepository().find({
            relations: ["event", "venue", "user", "organization"],
            order: { createdAt: "DESC" },
          });
        },
        this.CACHE_TTL
      );

      return {
        success: true,
        data: bookings,
        message: bookings.length ? undefined : "No bookings found.",
      };
    } catch (error) {
      console.error("Error fetching all bookings:", error);
      return { success: false, message: `Failed to get all bookings: ${error instanceof Error ? error.message : "Unknown error"}` };
    }
  }

  // Get booking by ID
  static async getBookingById(id: string): Promise<{ success: boolean; message?: string; data?: VenueBooking }> {
    if (!id) {
      return { success: false, message: "Booking ID is required." };
    }

    const cacheKey = `${this.CACHE_PREFIX}${id}`;
    try {
      const booking = await CacheService.getOrSetSingle(
        cacheKey,
        this.getVenueBookingRepository(),
        async () => {
          return await this.getVenueBookingRepository().findOne({
            where: { bookingId: id },
            relations: ["event", "venue", "user", "organization"],
          });
        },
        this.CACHE_TTL
      );

      if (!booking) {
        return { success: false, message: "Booking not found." };
      }

      return { success: true, data: booking };
    } catch (error) {
      console.error("Error fetching booking by ID:", error);
      return { success: false, message: `Failed to get booking by ID: ${error instanceof Error ? error.message : "Unknown error"}` };
    }
  }

  // Update booking
  static async updateBooking(
    id: string,
    bookingData: Partial<VenueBookingInterface>
  ): Promise<{ success: boolean; message?: string; data?: VenueBooking }> {
    try {
      if (!id) {
        return { success: false, message: "Booking ID is required." };
      }

      const bookingRepo = this.getVenueBookingRepository();
      const existingBooking = await bookingRepo.findOne({
        where: { bookingId: id },
        relations: ["event", "venue", "user", "organization"],
      });

      if (!existingBooking) {
        return { success: false, message: "Booking not found." };
      }

      // Validate new entities if provided
      if (bookingData.eventId && (!existingBooking.event || bookingData.eventId !== existingBooking.event.eventId)) {
        const event = await this.getEventRepository().findOne({ where: { eventId: bookingData.eventId } });
        if (!event) return { success: false, message: "Event does not exist." };
        existingBooking.event = event;
      }

      if (bookingData.venueId && bookingData.venueId !== existingBooking.venue.venueId) {
        const venue = await this.getVenueRepository().findOne({ where: { venueId: bookingData.venueId } });
        if (!venue) return { success: false, message: "Venue does not exist." };
        if (existingBooking.event?.maxAttendees && existingBooking.event.maxAttendees > venue.capacity) {
          return { success: false, message: "Venue capacity is insufficient for the expected attendance." };
        }
        existingBooking.venue = venue;
      }

      if (bookingData.organizerId && bookingData.organizerId !== existingBooking.user.userId) {
        const user = await this.getUserRepository().findOne({ where: { userId: bookingData.organizerId } });
        if (!user) return { success: false, message: "Organizer does not exist." };
        existingBooking.user = user;
      }

      if (bookingData.organizationId && bookingData.organizationId !== existingBooking.organization!.organizationId) {
        const org = await this.getOrganizationRepository().findOne({ where: { organizationId: bookingData.organizationId } });
        if (!org) return { success: false, message: "Organization does not exist." };
        existingBooking.organization = org;
      }

      // Validate approval status
      if (
        bookingData.approvalStatus &&
        !["pending", "approved", "rejected"].includes(bookingData.approvalStatus)
      ) {
        return { success: false, message: "Invalid approval status." };
      }

      // Check conflicts if event dates/times change
      if (bookingData.event?.startDate || bookingData.event?.endDate || bookingData.event?.startTime || bookingData.event?.endTime) {
        const startDate = bookingData.event?.startDate
          ? new Date(bookingData.event.startDate)
          : existingBooking.event?.startDate;
        const endDate = bookingData.event?.endDate
          ? new Date(bookingData.event.endDate)
          : existingBooking.event?.endDate;
        const startTime = bookingData.event?.startTime || existingBooking.event?.startTime;
        const endTime = bookingData.event?.endTime || existingBooking.event?.endTime;
        if (!startDate || !endDate || isNaN(startDate.getTime()) || isNaN(endDate.getTime()) || startDate > endDate) {
          return { success: false, message: "Invalid or inconsistent date format." };
        }
        const conflictCheck = await this.checkDuplicateBookings(
          bookingData.venueId || existingBooking.venue.venueId,
          startDate,
          endDate,
          startTime,
          endTime,
          id
        );
        if (!conflictCheck.success) {
          return { success: false, message: conflictCheck.message };
        }
      }

      // Merge updates
      if (bookingData.approvalStatus) {
        existingBooking.approvalStatus = bookingData.approvalStatus as any;
      }

      const updatedBooking = await bookingRepo.save(existingBooking);

      // Invalidate caches
      await CacheService.invalidateMultiple([
        `${this.CACHE_PREFIX}all`,
        `${this.CACHE_PREFIX}${id}`,
        `${this.CACHE_PREFIX}event:${existingBooking.event?.eventId}`,
        `${this.CACHE_PREFIX}venue:${existingBooking.venue.venueId}`,
        `${this.CACHE_PREFIX}organizer:${existingBooking.user.userId}`,
        `${this.CACHE_PREFIX}organization:${existingBooking.organization!.organizationId}`,
        `${this.CACHE_PREFIX}status:${existingBooking.approvalStatus}`,
        `${this.CACHE_PREFIX}status:${updatedBooking.approvalStatus}`,
      ]);

      return { success: true, data: updatedBooking, message: "Booking updated successfully." };
    } catch (error) {
      console.error("Error updating booking:", error);
      return { success: false, message: `Failed to update booking: ${error instanceof Error ? error.message : "Unknown error"}` };
    }
  }

  // Update booking status
  static async updateBookingStatus(
    id: string,
    status: "pending" | "approved" | "rejected"
  ): Promise<{ success: boolean; message?: string; data?: VenueBooking }> {
    try {
      if (!id) {
        return { success: false, message: "Booking ID is required." };
      }

      if (!["pending", "approved", "rejected"].includes(status)) {
        return { success: false, message: "Invalid approval status." };
      }

      const bookingRepo = this.getVenueBookingRepository();
      const existingBooking = await bookingRepo.findOne({
        where: { bookingId: id },
        relations: ["event", "venue", "user", "organization"],
      });

      if (!existingBooking) {
        return { success: false, message: "Booking not found." };
      }

      const oldStatus = existingBooking.approvalStatus;
      existingBooking.approvalStatus = status as any;
      const updatedBooking = await bookingRepo.save(existingBooking);

      // Invalidate caches
      await CacheService.invalidateMultiple([
        `${this.CACHE_PREFIX}all`,
        `${this.CACHE_PREFIX}${id}`,
        `${this.CACHE_PREFIX}event:${existingBooking.event?.eventId}`,
        `${this.CACHE_PREFIX}venue:${existingBooking.venue.venueId}`,
        `${this.CACHE_PREFIX}organizer:${existingBooking.user.userId}`,
        `${this.CACHE_PREFIX}organization:${existingBooking.organization!.organizationId}`,
        `${this.CACHE_PREFIX}status:${oldStatus}`,
        `${this.CACHE_PREFIX}status:${status}`,
      ]);

      return { success: true, data: updatedBooking, message: "Booking status updated successfully." };
    } catch (error) {
      console.error("Error updating booking status:", error);
      return { success: false, message: `Failed to update booking status: ${error instanceof Error ? error.message : "Unknown error"}` };
    }
  }

  // Delete booking
  static async deleteBooking(id: string): Promise<{ success: boolean; message?: string }> {
    try {
      if (!id) {
        return { success: false, message: "Booking ID is required." };
      }

      const bookingRepo = this.getVenueBookingRepository();
      const existingBooking = await bookingRepo.findOne({
        where: { bookingId: id },
        relations: ["event", "venue", "user", "organization"],
      });

      if (!existingBooking) {
        return { success: false, message: "Booking not found." };
      }

      await bookingRepo.delete(id);

      // Invalidate caches
      await CacheService.invalidateMultiple([
        `${this.CACHE_PREFIX}all`,
        `${this.CACHE_PREFIX}${id}`,
        `${this.CACHE_PREFIX}event:${existingBooking.event?.eventId}`,
        `${this.CACHE_PREFIX}venue:${existingBooking.venue.venueId}`,
        `${this.CACHE_PREFIX}organizer:${existingBooking.user.userId}`,
        `${this.CACHE_PREFIX}organization:${existingBooking.organization!.organizationId}`,
        `${this.CACHE_PREFIX}status:${existingBooking.approvalStatus}`,
      ]);

      return { success: true, message: "Booking deleted successfully." };
    } catch (error) {
      console.error("Error deleting booking:", error);
      return { success: false, message: `Failed to delete booking: ${error instanceof Error ? error.message : "Unknown error"}` };
    }
  }

  // Get bookings by event ID
  static async getBookingsByEventId(eventId: string): Promise<{ success: boolean; message?: string; data?: VenueBooking[] }> {
    if (!eventId) {
      return { success: false, message: "Event ID is required." };
    }

    const cacheKey = `${this.CACHE_PREFIX}event:${eventId}`;
    try {
      const bookings = await CacheService.getOrSetMultiple(
        cacheKey,
        this.getVenueBookingRepository(),
        async () => {
          const event = await this.getEventRepository().findOne({ where: { eventId } });
          if (!event) {
            throw new Error("Event does not exist.");
          }
          const bookings = await this.getVenueBookingRepository()
            .createQueryBuilder("booking")
            .leftJoinAndSelect("booking.event", "event")
            .leftJoinAndSelect("booking.venue", "venue")
            .leftJoinAndSelect("booking.user", "user")
            .leftJoinAndSelect("booking.organization", "organization")
            .where("event.eventId = :eventId", { eventId })
            .orderBy("booking.createdAt", "DESC")
            .getMany();
          return bookings;
        },
        this.CACHE_TTL
      );

      return {
        success: true,
        data: bookings,
        message: bookings.length ? undefined : "No bookings found for this event.",
      };
    } catch (error) {
      console.error("Error fetching bookings by event ID:", error);
      return { success: false, message: `Failed to get bookings by event ID: ${error instanceof Error ? error.message : "Unknown error"}` };
    }
  }

  // Get bookings by venue ID
  static async getBookingsByVenueId(venueId: string): Promise<{ success: boolean; message?: string; data?: VenueBooking[] }> {
    if (!venueId) {
      return { success: false, message: "Venue ID is required." };
    }

    const cacheKey = `${this.CACHE_PREFIX}venue:${venueId}`;
    try {
      const bookings = await CacheService.getOrSetMultiple(
        cacheKey,
        this.getVenueBookingRepository(),
        async () => {
          return await this.getVenueBookingRepository().find({
            where: { venue: { venueId } },
            relations: ["event", "venue", "user", "organization"],
            order: { createdAt: "DESC" },
          });
        },
        this.CACHE_TTL
      );

      return {
        success: true,
        data: bookings,
        message: bookings.length ? undefined : "No bookings found for this venue.",
      };
    } catch (error) {
      console.error("Error fetching bookings by venue ID:", error);
      return { success: false, message: `Failed to get bookings by venue ID: ${error instanceof Error ? error.message : "Unknown error"}` };
    }
  }

  // Get bookings by organizer ID
  static async getBookingsByOrganizerId(organizerId: string): Promise<{ success: boolean; message?: string; data?: VenueBooking[] }> {
    if (!organizerId) {
      return { success: false, message: "Organizer ID is required." };
    }

    const cacheKey = `${this.CACHE_PREFIX}organizer:${organizerId}`;
    try {
      const bookings = await CacheService.getOrSetMultiple(
        cacheKey,
        this.getVenueBookingRepository(),
        async () => {
          return await this.getVenueBookingRepository().find({
            where: { user: { userId: organizerId } },
            relations: ["event", "venue", "user", "organization"],
            order: { createdAt: "DESC" },
          });
        },
        this.CACHE_TTL
      );

      return {
        success: true,
        data: bookings,
        message: bookings.length ? undefined : "No bookings found for this organizer.",
      };
    } catch (error) {
      console.error("Error fetching bookings by organizer ID:", error);
      return { success: false, message: `Failed to get bookings by organizer ID: ${error instanceof Error ? error.message : "Unknown error"}` };
    }
  }

  // Get bookings by organization ID
  static async getBookingsByOrganizationId(organizationId: string): Promise<{ success: boolean; message?: string; data?: VenueBooking[] }> {
    if (!organizationId) {
      return { success: false, message: "Organization ID is required." };
    }

    const cacheKey = `${this.CACHE_PREFIX}organization:${organizationId}`;
    try {
      const bookings = await CacheService.getOrSetMultiple(
        cacheKey,
        this.getVenueBookingRepository(),
        async () => {
          return await this.getVenueBookingRepository().find({
            where: { organization: { organizationId } },
            relations: ["events", "venue", "user", "organization"],
            order: { createdAt: "DESC" },
          });
        },
        this.CACHE_TTL
      );

      return {
        success: true,
        data: bookings,
        message: bookings.length ? undefined : "No bookings found for this organization.",
      };
    } catch (error) {
      console.error("Error fetching bookings by organization ID:", error);
      return { success: false, message: `Failed to get bookings by organization ID: ${error instanceof Error ? error.message : "Unknown error"}` };
    }
  }

  // Get bookings by approval status
  static async getBookingsByStatus(
    approvalStatus: "pending" | "approved" | "rejected"
  ): Promise<{ success: boolean; message?: string; data?: VenueBooking[] }> {
    if (!["pending", "approved", "rejected"].includes(approvalStatus)) {
      return { success: false, message: "Invalid approval status." };
    }

    const cacheKey = `${this.CACHE_PREFIX}status:${approvalStatus}`;
    try {
      const bookings = await CacheService.getOrSetMultiple(
        cacheKey,
        this.getVenueBookingRepository(),
        async () => {
          return await this.getVenueBookingRepository().find({
            where: { approvalStatus: approvalStatus as any },
            relations: ["events", "venue", "user", "organization"],
            order: { createdAt: "DESC" },
          });
        },
        this.CACHE_TTL
      );

      return {
        success: true,
        data: bookings,
        message: bookings.length ? undefined : `No bookings found with status: ${approvalStatus}.`,
      };
    } catch (error) {
      console.error("Error fetching bookings by status:", error);
      return { success: false, message: `Failed to get bookings by status: ${error instanceof Error ? error.message : "Unknown error"}` };
    }
  }

  // Get bookings by date range (based on Event dates)
  static async getBookingsByDateRange(
    startDate: Date,
    endDate: Date,
    filterOptions: ("min" | "hours" | "days" | "all")[]
  ): Promise<{ success: boolean; message?: string; data?: VenueBooking[] }> {
    try {
      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        return { success: false, message: "Invalid date format." };
      }

      if (startDate > endDate) {
        return { success: false, message: "Start date cannot be after end date." };
      }

      const cacheKey = `${this.CACHE_PREFIX}date:${startDate.toISOString()}:${endDate.toISOString()}:${filterOptions.join(",")}`;
      const bookingRepo = this.getVenueBookingRepository();
      const bookings = await CacheService.getOrSetMultiple(
        cacheKey,
        bookingRepo,
        async () => {
          let query = bookingRepo.createQueryBuilder("booking")
            .leftJoinAndSelect("booking.event", "event")
            .leftJoinAndSelect("booking.venue", "venue")
            .leftJoinAndSelect("booking.user", "user")
            .leftJoinAndSelect("booking.organization", "organization")
            .where("event.startDate <= :endDate", { endDate })
            .andWhere("event.endDate >= :startDate", { startDate });

          if (filterOptions.includes("min") && !filterOptions.includes("all")) {
            query.andWhere("EXTRACT(MINUTE FROM event.startTime) >= 0");
          }
          if (filterOptions.includes("hours") && !filterOptions.includes("all")) {
            query.andWhere("EXTRACT(HOUR FROM event.startTime) >= 0");
          }
          if (filterOptions.includes("days") && !filterOptions.includes("all")) {
            query.andWhere("EXTRACT(DAY FROM event.startDate) >= 0");
          }

          return await query.orderBy("booking.createdAt", "DESC").getMany();
        },
        this.CACHE_TTL
      );

      return {
        success: true,
        data: bookings,
        message: bookings.length ? undefined : "No bookings found in this date range.",
      };
    } catch (error) {
      console.error("Error fetching bookings by date range:", error);
      return { success: false, message: `Failed to get bookings by date range: ${error instanceof Error ? error.message : "Unknown error"}` };
    }
  }

  // Helper method to convert time string (HH:MM or HH:MM:SS) to minutes
  private static timeToMinutes(timeStr: string): number {
    const [hours, minutes] = timeStr.split(":").map(Number);
    return hours * 60 + minutes;
  }
}