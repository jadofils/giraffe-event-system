import { AppDataSource } from "../config/Database";
import { Event } from "../models/Event";
import { Venue } from "../models/Venue";
import { VenueBooking } from "../models/VenueBooking";
import { CacheService } from "../services/CacheService";
import { EventInterface } from "../interfaces/EventInterface";
import { VenueInterface } from "../interfaces/VenueInterface";
import { VenueBookingInterface } from "../interfaces/VenueBookingInterface";
import { EventStatus, EventType } from "../interfaces/Index";
import { In, Between } from "typeorm";
import { ApprovalStatus } from "../models/VenueBooking";
import { User } from "../models/User";
import { Organization } from "../models/Organization";
import { UUID_REGEX } from "../utils/constants";

export class EventRepository {
  private static readonly CACHE_PREFIX = 'event:';
  private static readonly CACHE_TTL = 1800; // 30 minutes in seconds

static async create(
  data: Partial<EventInterface>,
  organizationId: string
): Promise<{ success: boolean; data?: { event: Event; venues: Venue[] }; message?: string }> {
  const eventOrgId = data.organizationId || organizationId;
  if (!UUID_REGEX.test(eventOrgId)) {
    return { success: false, message: "Invalid organization ID format." };
  }

  const queryRunner = AppDataSource.createQueryRunner();
  await queryRunner.connect();
  await queryRunner.startTransaction();

  try {
    // Validate required event fields
    if (!data.eventTitle || !data.eventType || !data.organizerId || !data.startDate || !data.endDate) {
      return { success: false, message: "Missing required fields: eventTitle, eventType, organizerId, startDate, endDate" };
    }

    // Validate UUID for organizerId
    if (!UUID_REGEX.test(data.organizerId)) {
      return { success: false, message: "Invalid organizer ID format." };
    }

    // Validate event type
    const eventTypeMap: Record<string, EventType> = {
      public: EventType.PUBLIC,
      private: EventType.PRIVATE,
    };
    const mappedEventType = eventTypeMap[data.eventType.toLowerCase()];
    if (!mappedEventType) {
      return { success: false, message: "Invalid event type" };
    }

    // Validate event status
    const eventStatusMap: Record<string, EventStatus> = {
      pending: EventStatus.PENDING,
      approved: EventStatus.APPROVED,
      cancelled: EventStatus.CANCELLED,
      completed: EventStatus.COMPLETED,
    };
    const mappedStatus = data.status ? eventStatusMap[data.status.toLowerCase()] : EventStatus.PENDING;
    if (data.status && !mappedStatus) {
      return { success: false, message: "Invalid event status" };
    }

    // Validate organization and organizer
    const orgRepo = queryRunner.manager.getRepository(Organization);
    const userRepo = queryRunner.manager.getRepository(User);
    const organization = await orgRepo.findOne({ where: { organizationId: eventOrgId } });
    if (!organization) {
      return { success: false, message: "Organization not found" };
    }
    const organizer = await userRepo.findOne({ where: { userId: data.organizerId } });
    if (!organizer) {
      return { success: false, message: "Organizer not found" };
    }

    // Validate organizer belongs to organization
    const userInOrg = await userRepo
      .createQueryBuilder("user")
      .innerJoin("user.organizations", "org")
      .where("user.userId = :userId AND org.organizationId = :organizationId", {
        userId: data.organizerId,
        organizationId: eventOrgId,
      })
      .getOne();
    if (!userInOrg) {
      return { success: false, message: "Organizer is not part of the specified organization" };
    }

    // Create event
    const event = new Event();
    event.eventTitle = data.eventTitle;
    event.eventType = mappedEventType;
    event.organizerId = data.organizerId;
    event.organizationId = eventOrgId;
    event.startDate = new Date(data.startDate);
    event.endDate = new Date(data.endDate);
    event.startTime = data.startTime || '';
    event.endTime = data.endTime || '';
    event.description = data.description;
    event.maxAttendees = data.maxAttendees;
    event.status = mappedStatus;
    event.isFeatured = data.isFeatured || false;
    event.qrCode = data.qrCode;
    event.imageURL = data.imageURL;
    event.organization = organization;
    event.organizer = organizer;

    const savedEvent = await queryRunner.manager.save(Event, event);

    // Validate and fetch venues if provided
    const venues: Venue[] = [];
    let venueIds: string[] = [];
    if (data.venues && Array.isArray(data.venues) && data.venues.length > 0) {
      console.log("Received venues:", data.venues, typeof data.venues);
      if (!data.venues.every(v => typeof v === 'string')) {
        await queryRunner.rollbackTransaction();
        return { success: false, message: "Venues must be an array of UUID strings" };
      }

      // Require venueOrganizationId
      const venueOrganizationId = data.venueOrganizationId;
      if (!venueOrganizationId) {
        await queryRunner.rollbackTransaction();
        return { success: false, message: "venueOrganizationId is required when assigning venues." };
      }

      venueIds = data.venues.map((v: string) => v).filter(Boolean);
      if (venueIds.length === 0 || !venueIds.every(id => UUID_REGEX.test(id))) {
        await queryRunner.rollbackTransaction();
        return { success: false, message: "Invalid or empty venue IDs provided" };
      }

      // Check for duplicate venue IDs
      const duplicateVenueIds = venueIds.filter((id, idx) => venueIds.indexOf(id) !== idx);
      if (duplicateVenueIds.length > 0) {
        await queryRunner.rollbackTransaction();
        return {
          success: false,
          message: `Duplicate venue IDs detected: ${[...new Set(duplicateVenueIds)].join(', ')}`
        };
      }

      // Fetch venues that belong to the specified organization
      const venueRepo = queryRunner.manager.getRepository(Venue);
      const foundVenues = await venueRepo.find({
        where: {
          venueId: In(venueIds),
          organization: {
            organizationId: venueOrganizationId
          }
        }
      });

      // If not all venues are found, some do not belong to the organization
      if (foundVenues.length !== venueIds.length) {
        await queryRunner.rollbackTransaction();
        return {
          success: false,
          message: "All selected venues must belong to the specified organization."
        };
      }

      // Validate venue capacity against event maxAttendees
      if (data.maxAttendees) {
        for (const venue of foundVenues) {
          if (venue.capacity < data.maxAttendees) {
            await queryRunner.rollbackTransaction();
            return { success: false, message: `Venue ${venue.venueName} capacity (${venue.capacity}) is insufficient for the expected attendance (${data.maxAttendees})` };
          }
        }
      }

      // Assign venues to event
      event.venues = foundVenues;
      venues.push(...foundVenues);

      // Update venues to include the event in their events array
      for (const venue of foundVenues) {
        if (!venue.events) {
          venue.events = [];
        }
        if (!venue.events.some(e => e.eventId === savedEvent.eventId)) {
          venue.events.push(savedEvent);
          await venueRepo.save(venue);
        }
      }
    }

    // Check for conflicting events if venues are provided
    if (venueIds.length > 0) {
      const conflictingEvents = await queryRunner.manager
        .getRepository(Event)
        .createQueryBuilder("event")
        .leftJoinAndSelect("event.venues", "venue")
        .where("LOWER(event.eventTitle) = LOWER(:title)", { title: data.eventTitle })
        .andWhere("event.organizationId = :organizationId", { organizationId: eventOrgId })
        .andWhere("event.startDate = :startDate", { startDate: new Date(data.startDate) })
        .andWhere("event.startTime = :startTime", { startTime: data.startTime || '' })
        .andWhere("venue.venueId IN (:venueIds)", { venueIds })
        .orderBy("event.createdAt", "DESC")
        .getMany();

      if (conflictingEvents.length > 0) {
        const recentConflict = conflictingEvents.find(conflict => {
          const createdAt = new Date(conflict.createdAt).getTime();
          return Date.now() - createdAt < 15 * 60 * 1000;
        });

        if (recentConflict) {
          await queryRunner.rollbackTransaction();
          return {
            success: false,
            message: `Event "${recentConflict.eventTitle}" already exists at this venue on the same date and time. Please wait at least 15 minutes before trying again.`
          };
        }
      }
    }

    // Save event with venues
    await queryRunner.manager.save(Event, event);

    // Commit transaction
    await queryRunner.commitTransaction();

    // Invalidate caches
    await CacheService.invalidateMultiple([
      `${this.CACHE_PREFIX}all`,
      `${this.CACHE_PREFIX}${savedEvent.eventId}`,
      `${this.CACHE_PREFIX}organization:${eventOrgId}`,
      `${this.CACHE_PREFIX}organizer:${data.organizerId}`,
      ...venues.map(venue => `${this.CACHE_PREFIX}venue:${venue.venueId}`),
    ]);

    return { success: true, data: { event: savedEvent, venues } };
  } catch (error) {
    await queryRunner.rollbackTransaction();
    console.error("Error creating event and associating venues:", error);
    return { success: false, message: `Failed to create event and associate venues: ${error instanceof Error ? error.message : "Unknown error"}` };
  } finally {
    await queryRunner.release();
  }
}



  static async save(event: Event): Promise<{ success: boolean; data?: Event; message?: string }> {
    try {
      const savedEvent = await AppDataSource.getRepository(Event).save(event);
      await CacheService.invalidateMultiple([
        `${this.CACHE_PREFIX}all`,
        `${this.CACHE_PREFIX}${savedEvent.eventId}`,
        `${this.CACHE_PREFIX}org:${savedEvent.organizationId}`,
        `${this.CACHE_PREFIX}organizer:${savedEvent.organizerId}`,
        `${this.CACHE_PREFIX}${savedEvent.eventId}:venues`,
        `${this.CACHE_PREFIX}${savedEvent.eventId}:bookings`,
      ]);
      return { success: true, data: savedEvent, message: "Event saved successfully" };
    } catch (error) {
      console.error("Error saving event:", error);
      return { success: false, message: "Failed to save event" };
    }
  }

  static async getById(id: string): Promise<{ success: boolean; data?: Event; message?: string }> {
    if (!id || !UUID_REGEX.test(id)) {
      return { success: false, message: "Valid event ID is required" };
    }

    const cacheKey = `${this.CACHE_PREFIX}${id}`;
    try {
      const event = await CacheService.getOrSetSingle(
        cacheKey,
        AppDataSource.getRepository(Event),
        async () => await AppDataSource.getRepository(Event).findOne({
          where: { eventId: id },
          relations: ["organizer", "organizer.role", "venues", "venueBookings", "organization"],
        }),
        this.CACHE_TTL
      );

      if (!event) {
        return { success: false, message: "Event not found" };
      }
      return { success: true, data: event };
    } catch (error) {
      console.error("Error fetching event by ID:", error);
      return { success: false, message: "Failed to fetch event" };
    }
  }

  static async getAll(): Promise<{ success: boolean; data?: Event[]; message?: string }> {
    const cacheKey = `${this.CACHE_PREFIX}all`;
    try {
      const events = await CacheService.getOrSetMultiple(
        cacheKey,
        AppDataSource.getRepository(Event),
        async () => await AppDataSource.getRepository(Event).find({
          relations: ["organizer", "organizer.role", "venues", "venueBookings", "organization"],
          order: { startDate: "ASC" },
        }),
        this.CACHE_TTL
      );
      return { success: true, data: events };
    } catch (error) {
      console.error("Error fetching all events:", error);
      return { success: false, message: "Failed to fetch events" };
    }
  }

  static async getByOrganizerId(organizerId: string): Promise<{ success: boolean; data?: Event[]; message?: string }> {
    if (!organizerId || !UUID_REGEX.test(organizerId)) {
      return { success: false, message: "Valid organizer ID is required" };
    }

    const cacheKey = `${this.CACHE_PREFIX}organizer:${organizerId}`;
    try {
      const events = await CacheService.getOrSetMultiple(
        cacheKey,
        AppDataSource.getRepository(Event),
        async () => await AppDataSource.getRepository(Event).find({
          where: { organizerId },
          relations: ["organizer", "organizer.role", "venues", "venueBookings", "organization"],
          order: { startDate: "ASC" },
        }),
        this.CACHE_TTL
      );
      if (events.length === 0) {
        return { success: false, message: "No events found for this organizer" };
      }
      return { success: true, data: events };
    } catch (error) {
      console.error("Error fetching events by organizer:", error);
      return { success: false, message: "Failed to fetch events" };
    }
  }

  static async getByOrganizationId(organizationId: string): Promise<{ success: boolean; data?: Event[]; message?: string }> {
    if (!organizationId || !UUID_REGEX.test(organizationId)) {
      return { success: false, message: "Valid organization ID is required" };
    }

    const cacheKey = `${this.CACHE_PREFIX}org:${organizationId}`;
    try {
      const events = await CacheService.getOrSetMultiple(
        cacheKey,
        AppDataSource.getRepository(Event),
        async () => await AppDataSource.getRepository(Event).find({
          where: { organizationId },
          relations: ["organizer", "organizer.role", "venues", "venueBookings", "organization"],
          order: { startDate: "ASC" },
        }),
        this.CACHE_TTL
      );
      if (events.length === 0) {
        return { success: false, message: "No events found for this organization" };
      }
      return { success: true, data: events };
    } catch (error) {
      console.error("Error fetching events by organization:", error);
      return { success: false, message: "Failed to fetch events" };
    }
  }

  static async getByVenueId(venueId: string): Promise<{ success: boolean; data?: Event[]; message?: string }> {
    if (!venueId || !UUID_REGEX.test(venueId)) {
      return { success: false, message: "Valid venue ID is required" };
    }

    const cacheKey = `${this.CACHE_PREFIX}venue:${venueId}`;
    try {
      const events = await CacheService.getOrSetMultiple(
        cacheKey,
        AppDataSource.getRepository(Event),
        async () => await AppDataSource.getRepository(Event).createQueryBuilder("event")
          .leftJoinAndSelect("event.venues", "venue")
          .leftJoinAndSelect("event.organizer", "organizer")
          .leftJoinAndSelect("organizer.role", "role")
          .leftJoinAndSelect("event.organization", "organization")
          .leftJoinAndSelect("event.venueBookings", "venueBookings")
          .where("venue.venueId = :venueId", { venueId })
          .orderBy("event.startDate", "ASC")
          .getMany(),
        this.CACHE_TTL
      );
      if (events.length === 0) {
        return { success: false, message: "No events found for this venue" };
      }
      return { success: true, data: events };
    } catch (error) {
      console.error("Error fetching events by venue:", error);
      return { success: false, message: "Failed to fetch events" };
    }
  }

  static async getByStatus(status: EventStatus): Promise<{ success: boolean; data?: Event[]; message?: string }> {
    if (!status) {
      return { success: false, message: "Event status is required" };
    }

    const cacheKey = `${this.CACHE_PREFIX}status:${status}`;
    try {
      const events = await CacheService.getOrSetMultiple(
        cacheKey,
        AppDataSource.getRepository(Event),
        async () => await AppDataSource.getRepository(Event).find({
          where: { status },
          relations: ["organizer", "organizer.role", "venues", "venueBookings", "organization"],
          order: { startDate: "ASC" },
        }),
        this.CACHE_TTL
      );
      if (events.length === 0) {
        return { success: false, message: `No events found with status ${status}` };
      }
      return { success: true, data: events };
    } catch (error) {
      console.error("Error fetching events by status:", error);
      return { success: false, message: "Failed to fetch events" };
    }
  }

  static async getByDateRange(startDate: Date, endDate: Date): Promise<{ success: boolean; data?: Event[]; message?: string }> {
    if (!startDate || !endDate) {
      return { success: false, message: "Start and end dates are required" };
    }

    const cacheKey = `${this.CACHE_PREFIX}date:${startDate.toISOString()}:${endDate.toISOString()}`;
    try {
      const events = await CacheService.getOrSetMultiple(
        cacheKey,
        AppDataSource.getRepository(Event),
        async () => await AppDataSource.getRepository(Event).find({
          where: { startDate: Between(startDate, endDate) },
          relations: ["organizer", "organizer.role", "venues", "venueBookings", "organization"],
          order: { startDate: "ASC" },
        }),
        this.CACHE_TTL
      );
      if (events.length === 0) {
        return { success: false, message: "No events found in date range" };
      }
      return { success: true, data: events };
    } catch (error) {
      console.error("Error fetching events by date range:", error);
      return { success: false, message: "Failed to fetch events" };
    }
  }

  static async update(id: string, data: Partial<EventInterface>): Promise<{ success: boolean; data?: Event; message?: string }> {
    if (!id || !UUID_REGEX.test(id)) {
      return { success: false, message: "Valid event ID is required" };
    }

    if (data.organizationId && !UUID_REGEX.test(data.organizationId)) {
      return { success: false, message: "Invalid organization ID format." };
    }

    if (data.organizerId && !UUID_REGEX.test(data.organizerId)) {
      return { success: false, message: "Invalid organizer ID format." };
    }

    try {
      const repo = AppDataSource.getRepository(Event);
      const event = await repo.findOne({ where: { eventId: id }, relations: ["venues", "venueBookings"] });
      if (!event) {
        return { success: false, message: "Event not found" };
      }

      let updatedEventType = event.eventType;
      if (data.eventType) {
        const eventTypeMap: Record<string, EventType> = {
          public: EventType.PUBLIC,
          private: EventType.PRIVATE,
        };
        updatedEventType = eventTypeMap[data.eventType.toLowerCase()];
        if (!updatedEventType) {
          return { success: false, message: "Invalid event type" };
        }
      }

      let updatedStatus = event.status;
      if (data.status) {
        const eventStatusMap: Record<string, EventStatus> = {
          pending: EventStatus.PENDING,
          approved: EventStatus.APPROVED,
          cancelled: EventStatus.CANCELLED,
          completed: EventStatus.COMPLETED,
        };
        updatedStatus = eventStatusMap[data.status.toLowerCase()];
        if (!updatedStatus) {
          return { success: false, message: "Invalid event status" };
        }
      }

      repo.merge(event, {
        eventTitle: data.eventTitle ?? event.eventTitle,
        eventType: updatedEventType,
        organizerId: data.organizerId ?? event.organizerId,
        organizationId: data.organizationId ?? event.organizationId,
        startDate: data.startDate ? new Date(data.startDate) : event.startDate,
        endDate: data.endDate ? new Date(data.endDate) : event.endDate,
        startTime: data.startTime ?? event.startTime,
        endTime: data.endTime ?? event.endTime,
        description: data.description ?? event.description,
        maxAttendees: data.maxAttendees ?? event.maxAttendees,
        status: updatedStatus,
        isFeatured: data.isFeatured ?? event.isFeatured,
        qrCode: data.qrCode ?? event.qrCode,
        imageURL: data.imageURL ?? event.imageURL,
      });

      if (data.venues && Array.isArray(data.venues)) {
        const venueIds = data.venues.map((v: VenueInterface) => v.venueId).filter(Boolean);
        for (const venueId of venueIds) {
          if (!UUID_REGEX.test(venueId)) {
            return { success: false, message: `Invalid venue ID format: ${venueId}` };
          }
        }
        const venues = venueIds.length > 0
          ? await AppDataSource.getRepository(Venue).find({ where: { venueId: In(venueIds), organization: { organizationId: data.organizationId ?? event.organizationId } } })
          : [];
        if (venueIds.length > 0 && venues.length !== venueIds.length) {
          return { success: false, message: "One or more venues not found or not part of the organization" };
        }
        event.venues = venues;
      }

      if (data.venueBookings && Array.isArray(data.venueBookings)) {
        const bookingIds = data.venueBookings.map((b: VenueBookingInterface) => b.bookingId).filter(Boolean);
        for (const bookingId of bookingIds) {
          if (!bookingId || !UUID_REGEX.test(bookingId)) {
            return { success: false, message: `Invalid booking ID format: ${bookingId}` };
          }
        }
        const bookings = bookingIds.length > 0
          ? await AppDataSource.getRepository(VenueBooking).find({ where: { bookingId: In(bookingIds) } })
          : [];
        if (bookingIds.length > 0 && bookings.length !== bookingIds.length) {
          return { success: false, message: "One or more venue bookings not found" };
        }
        event.venueBookings = bookings;
      }

      const updatedEvent = await repo.save(event);
      await CacheService.invalidateMultiple([
        `${this.CACHE_PREFIX}all`,
        `${this.CACHE_PREFIX}${id}`,
        `${this.CACHE_PREFIX}org:${updatedEvent.organizationId}`,
        `${this.CACHE_PREFIX}organizer:${updatedEvent.organizerId}`,
        `${this.CACHE_PREFIX}${id}:venues`,
        `${this.CACHE_PREFIX}${id}:bookings`,
      ]);
      return { success: true, data: updatedEvent, message: "Event updated successfully" };
    } catch (error) {
      console.error("Error updating event:", error);
      return { success: false, message: "Failed to update event" };
    }
  }

  static async delete(id: string): Promise<{ success: boolean; message?: string }> {
    if (!id || !UUID_REGEX.test(id)) {
      return { success: false, message: "Valid event ID is required" };
    }

    try {
      const repo = AppDataSource.getRepository(Event);
      const event = await repo.findOne({ where: { eventId: id } });
      if (!event) {
        return { success: false, message: "Event not found" };
      }

      await repo.softRemove(event);
      await CacheService.invalidateMultiple([
        `${this.CACHE_PREFIX}all`,
        `${this.CACHE_PREFIX}${id}`,
        `${this.CACHE_PREFIX}org:${event.organizationId}`,
        `${this.CACHE_PREFIX}organizer:${event.organizerId}`,
        `${this.CACHE_PREFIX}${id}:venues`,
        `${this.CACHE_PREFIX}${id}:bookings`,
      ]);
      return { success: true, message: "Event deleted successfully" };
    } catch (error) {
      console.error("Error deleting event:", error);
      return { success: false, message: "Failed to delete event" };
    }
  }

  static async assignVenues(eventId: string, venueIds: string[]): Promise<{ success: boolean; message?: string }> {
    if (!eventId || !UUID_REGEX.test(eventId) || !venueIds || !Array.isArray(venueIds) || venueIds.length === 0) {
      return { success: false, message: "Valid event ID and venue IDs are required" };
    }

    for (const venueId of venueIds) {
      if (!UUID_REGEX.test(venueId)) {
        return { success: false, message: `Invalid venue ID format: ${venueId}` };
      }
    }

    try {
      const repo = AppDataSource.getRepository(Event);
      const event = await repo.findOne({ where: { eventId }, relations: ["venues"] });
      if (!event) {
        return { success: false, message: "Event not found" };
      }

      const venues = await AppDataSource.getRepository(Venue).find({ where: { venueId: In(venueIds), organization: { organizationId: event.organizationId } } });
      if (venues.length !== venueIds.length) {
        return { success: false, message: "One or more venues not found or not part of the organization" };
      }

      event.venues = venues;
      await repo.save(event);
      await CacheService.invalidateMultiple([
        `${this.CACHE_PREFIX}${eventId}`,
        `${this.CACHE_PREFIX}${eventId}:venues`,
        `${this.CACHE_PREFIX}all`,
        `${this.CACHE_PREFIX}org:${event.organizationId}`,
        `${this.CACHE_PREFIX}organizer:${event.organizerId}`,
        ...venueIds.map(id => `${this.CACHE_PREFIX}venue:${id}`),
      ]);
      return { success: true, message: "Venues assigned successfully" };
    } catch (error) {
      console.error("Error assigning venues:", error);
      return { success: false, message: "Failed to assign venues" };
    }
  }

  static async removeVenues(eventId: string, venueIds: string[]): Promise<{ success: boolean; message?: string }> {
    if (!eventId || !UUID_REGEX.test(eventId) || !venueIds || !Array.isArray(venueIds) || venueIds.length === 0) {
      return { success: false, message: "Valid event ID and venue IDs are required" };
    }

    for (const venueId of venueIds) {
      if (!UUID_REGEX.test(venueId)) {
        return { success: false, message: `Invalid venue ID format: ${venueId}` };
      }
    }

    try {
      const repo = AppDataSource.getRepository(Event);
      const event = await repo.findOne({ where: { eventId }, relations: ["venues"] });
      if (!event) {
        return { success: false, message: "Event not found" };
      }

      event.venues = event.venues.filter(venue => !venueIds.includes(venue.venueId));
      await repo.save(event);
      await CacheService.invalidateMultiple([
        `${this.CACHE_PREFIX}${eventId}`,
        `${this.CACHE_PREFIX}${eventId}:venues`,
        `${this.CACHE_PREFIX}all`,
        `${this.CACHE_PREFIX}org:${event.organizationId}`,
        `${this.CACHE_PREFIX}organizer:${event.organizerId}`,
        ...venueIds.map(id => `${this.CACHE_PREFIX}venue:${id}`),
      ]);
      return { success: true, message: "Venues removed successfully" };
    } catch (error) {
      console.error("Error removing venues:", error);
      return { success: false, message: "Failed to remove venues" };
    }
  }

  static async assignVenueBookings(eventId: string, bookingIds: string[]): Promise<{ success: boolean; message?: string }> {
    if (!eventId || !UUID_REGEX.test(eventId) || !bookingIds || !Array.isArray(bookingIds) || bookingIds.length === 0) {
      return { success: false, message: "Valid event ID and booking IDs are required" };
    }

    for (const bookingId of bookingIds) {
      if (!bookingId || !UUID_REGEX.test(bookingId)) {
        return { success: false, message: `Invalid booking ID format: ${bookingId}` };
      }
    }

    try {
      const repo = AppDataSource.getRepository(Event);
      const event = await repo.findOne({ where: { eventId }, relations: ["venueBookings"] });
      if (!event) {
        return { success: false, message: "Event not found" };
      }

      const bookings = await AppDataSource.getRepository(VenueBooking).find({ where: { bookingId: In(bookingIds), organizationId: event.organizationId } });
      if (bookings.length !== bookingIds.length) {
        return { success: false, message: "One or more venue bookings not found or not part of the organization" };
      }

      event.venueBookings = bookings;
      await repo.save(event);
      await CacheService.invalidateMultiple([
        `${this.CACHE_PREFIX}${eventId}`,
        `${this.CACHE_PREFIX}${eventId}:bookings`,
        `${this.CACHE_PREFIX}all`,
        `${this.CACHE_PREFIX}org:${event.organizationId}`,
        `${this.CACHE_PREFIX}organizer:${event.organizerId}`,
        ...bookingIds.map(id => `${this.CACHE_PREFIX}booking:${id}`),
      ]);
      return { success: true, message: "Venue bookings assigned successfully" };
    } catch (error) {
      console.error("Error assigning venue bookings:", error);
      return { success: false, message: "Failed to assign venue bookings" };
    }
  }

  static async removeVenueBookings(eventId: string, bookingIds: string[]): Promise<{ success: boolean; message?: string }> {
    if (!eventId || !UUID_REGEX.test(eventId) || !bookingIds || !Array.isArray(bookingIds) || bookingIds.length === 0) {
      return { success: false, message: "Valid event ID and booking IDs are required" };
    }

    for (const bookingId of bookingIds) {
      if (!bookingId || !UUID_REGEX.test(bookingId)) {
        return { success: false, message: `Invalid booking ID format: ${bookingId}` };
      }
    }

    try {
      const repo = AppDataSource.getRepository(Event);
      const event = await repo.findOne({ where: { eventId }, relations: ["venueBookings"] });
      if (!event) {
        return { success: false, message: "Event not found" };
      }

      event.venueBookings = event.venueBookings.filter(booking => !bookingIds.includes(booking.bookingId));
      await repo.save(event);
      await CacheService.invalidateMultiple([
        `${this.CACHE_PREFIX}${eventId}`,
        `${this.CACHE_PREFIX}${eventId}:bookings`,
        `${this.CACHE_PREFIX}all`,
        `${this.CACHE_PREFIX}org:${event.organizationId}`,
        `${this.CACHE_PREFIX}organizer:${event.organizerId}`,
        ...bookingIds.map(id => `${this.CACHE_PREFIX}booking:${id}`),
      ]);
      return { success: true, message: "Venue bookings removed successfully" };
    } catch (error) {
      console.error("Error removing venue bookings:", error);
      return { success: false, message: "Failed to remove venue bookings" };
    }
  }

  static async bulkCreateVenueBookings(
    bookings: Partial<VenueBookingInterface>[],
    userId: string,
    eventId: string,
    organizationId: string
  ): Promise<{ success: boolean; data?: VenueBooking[]; message?: string }> {
    if (!UUID_REGEX.test(userId) || !UUID_REGEX.test(eventId) || !UUID_REGEX.test(organizationId)) {
      return { success: false, message: "Valid user ID, event ID, and organization ID are required" };
    }

    try {
      const bookingRepo = AppDataSource.getRepository(VenueBooking);
      const venueRepo = AppDataSource.getRepository(Venue);
      const eventRepo = AppDataSource.getRepository(Event);
      const userRepo = AppDataSource.getRepository(User);

      // Check user membership in organization
      const user = await userRepo.findOne({
        where: { userId },
        relations: ["organizations"],
      });
      if (!user) {
        return { success: false, message: `User ${userId} not found` };
      }
      const userOrgIds = user.organizations.map(org => org.organizationId);
      if (!userOrgIds.includes(organizationId)) {
        return { success: false, message: "You are not a member of this organization" };
      }

      // Fetch the event to get its time window
      const event = await eventRepo.findOne({ where: { eventId, organizationId } });
      if (!event) {
        return { success: false, message: `Event ${eventId} not found or not part of the organization` };
      }
      const eventStart = new Date(event.startDate).getTime();
      const eventEnd = new Date(event.endDate).getTime();

      // Fetch all venues for the organization
      const orgVenues = await venueRepo.find({
        where: { organization: { organizationId } },
        relations: ["bookings", "bookings.event"],
      });
      const orgVenueIds = orgVenues.map(v => v.venueId);

      // Filter requested venueIds to only those in the organization
      const requestedVenueIds = bookings.map(b => b.venueId!).filter(id => id && UUID_REGEX.test(id));
      const validVenueIds = requestedVenueIds.filter(id => orgVenueIds.includes(id));
      if (validVenueIds.length === 0) {
        return { success: false, message: "No valid venues found in the selected organization" };
      }

      // Check for conflicts for each venue using event's time window
      const conflictingVenues: string[] = [];
      for (const venue of orgVenues) {
        if (!validVenueIds.includes(venue.venueId)) continue;

        for (const booking of venue.bookings || []) {
          const eventObj = booking.event;
          if (eventObj && eventObj.startDate && eventObj.endDate) {
            // Only consider events with APPROVED or COMPLETED status
            if (["APPROVED", "COMPLETED"].includes(eventObj.status)) {
              const existingStart = new Date(eventObj.startDate).getTime();
              const existingEnd = new Date(eventObj.endDate).getTime();

              // Check time conflict
              if (existingStart < eventEnd && eventStart < existingEnd) {
                conflictingVenues.push(venue.venueId);
                break;
              }
            }
          }
          if (conflictingVenues.includes(venue.venueId)) break; // Exit early if conflict found
        }
      }

      if (conflictingVenues.length > 0) {
        return { success: false, message: `Venues with IDs [${conflictingVenues.join(", ")}] are already booked for the requested time.` };
      }

      // Create bookings for valid venues, all with status PENDING
      const validBookings: VenueBooking[] = [];
      for (const data of bookings) {
        if (!validVenueIds.includes(data.venueId!)) continue;
        if (!UUID_REGEX.test(data.venueId!)) {
          return { success: false, message: `Invalid venue ID format: ${data.venueId}` };
        }
        const venue = orgVenues.find(v => v.venueId === data.venueId);
        if (!venue) continue;
        const booking = new VenueBooking();
        booking.venueId = data.venueId!;
        booking.userId = userId;
        booking.organizationId = organizationId;
        booking.eventId = eventId;
        booking.totalAmountDue = (data as any).totalAmountDue ?? venue.amount ?? 0;
        booking.venueInvoiceId = data.venueInvoiceId;
        booking.approvalStatus = ApprovalStatus.PENDING;
        booking.venue = venue;
        validBookings.push(booking);
      }

      const saved = await bookingRepo.save(validBookings);
      await CacheService.invalidateMultiple([
        `${this.CACHE_PREFIX}${eventId}`,
        `${this.CACHE_PREFIX}${eventId}:bookings`,
        `${this.CACHE_PREFIX}all`,
        `${this.CACHE_PREFIX}org:${organizationId}`,
        `${this.CACHE_PREFIX}organizer:${userId}`,
        ...validBookings.map(booking => `${this.CACHE_PREFIX}booking:${booking.bookingId}`),
      ]);
      return { success: true, data: saved };
    } catch (error) {
      console.error("Bulk booking failed:", error);
      return { success: false, message: `Failed to save bookings: ${error instanceof Error ? error.message : "Unknown error"}` };
    }
  }

  static async getVenueBookingById(bookingId: string): Promise<{ success: boolean; data?: VenueBooking; message?: string }> {
    if (!bookingId || !UUID_REGEX.test(bookingId)) {
      return { success: false, message: "Valid booking ID is required" };
    }

    const cacheKey = `${this.CACHE_PREFIX}booking:${bookingId}`;
    try {
      const booking = await CacheService.getOrSetSingle(
        cacheKey,
        AppDataSource.getRepository(VenueBooking),
        async () => await AppDataSource.getRepository(VenueBooking).findOne({
          where: { bookingId },
          relations: ["venue", "user", "organization", "venueInvoice", "events"],
        }),
        this.CACHE_TTL
      );

      if (!booking) {
        return { success: false, message: "Venue booking not found" };
      }
      return { success: true, data: booking };
    } catch (error) {
      console.error("Error fetching venue booking:", error);
      return { success: false, message: "Failed to fetch venue booking" };
    }
  }

  static async updateVenueBooking(bookingId: string, data: Partial<VenueBookingInterface>): Promise<{ success: boolean; data?: VenueBooking; message?: string }> {
    if (!bookingId || !UUID_REGEX.test(bookingId)) {
      return { success: false, message: "Valid booking ID is required" };
    }

    if (data.venueId && !UUID_REGEX.test(data.venueId)) {
      return { success: false, message: "Invalid venue ID format" };
    }

    if (data.organizerId && !UUID_REGEX.test(data.organizerId)) {
      return { success: false, message: "Invalid user ID format" };
    }

    if (data.organizationId && !UUID_REGEX.test(data.organizationId)) {
      return { success: false, message: "Invalid organization ID format" };
    }

    try {
      const repo = AppDataSource.getRepository(VenueBooking);
      const booking = await repo.findOne({ where: { bookingId }, relations: ["events"] });
      if (!booking) {
        return { success: false, message: "Venue booking not found" };
      }

      repo.merge(booking, {
        venueId: data.venueId ?? booking.venueId,
        userId: data.organizerId ?? booking.userId,
        organizationId: data.organizationId ?? booking.organizationId,
        totalAmountDue: (data as any).totalAmountDue ?? booking.totalAmountDue,
        venueInvoiceId: data.venueInvoiceId ?? booking.venueInvoiceId,
        approvalStatus: data.approvalStatus ?? ApprovalStatus.PENDING,
      });

      const updatedBooking = await repo.save(booking);
      await CacheService.invalidateMultiple([
        `${this.CACHE_PREFIX}booking:${bookingId}`,
        ...(booking.event ? [`${this.CACHE_PREFIX}${booking.event.eventId}:bookings`] : []),
      ]);
      return { success: true, data: updatedBooking, message: "Venue booking updated successfully" };
    } catch (error) {
      console.error("Error updating venue booking:", error);
      return { success: false, message: "Failed to update venue booking" };
    }
  }

  static async deleteVenueBooking(bookingId: string): Promise<{ success: boolean; message?: string }> {
    if (!bookingId || !UUID_REGEX.test(bookingId)) {
      return { success: false, message: "Valid booking ID is required" };
    }

    try {
      const repo = AppDataSource.getRepository(VenueBooking);
      const booking = await repo.findOne({ where: { bookingId }, relations: ["events"] });
      if (!booking) {
        return { success: false, message: "Venue booking not found" };
      }

      await repo.softRemove(booking);
      await CacheService.invalidateMultiple([
        `${this.CACHE_PREFIX}booking:${bookingId}`,
        ...(booking.event ? [`${this.CACHE_PREFIX}${booking.event.eventId}:bookings`] : []),
      ]);
      return { success: true, message: "Venue booking deleted successfully" };
    } catch (error) {
      console.error("Error deleting venue booking:", error);
      return { success: false, message: "Failed to delete venue booking" };
    }
  }
}

function sanitizeEvent(event: any) {
  if (!event) return event;
  // Remove circular references for venues
  const sanitizedVenues = event.venues?.map((venue: any) => {
    const { events, ...venueWithoutEvents } = venue;
    return venueWithoutEvents;
  });

  // Remove circular references for venueBookings if needed
  const sanitizedVenueBookings = event.venueBookings?.map((booking: any) => {
    const { events, ...bookingWithoutEvents } = booking;
    return bookingWithoutEvents;
  });

  return {
    ...event,
    venues: sanitizedVenues,
    venueBookings: sanitizedVenueBookings,
  };
}