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

export class EventRepository {
  private static readonly CACHE_PREFIX = 'event:';
  private static readonly CACHE_TTL = 1800; // 30 minutes in seconds

  static async create(data: Partial<EventInterface>): Promise<{ success: boolean; data?: Event; message?: string }> {
    try {
      if (!data.eventTitle || !data.eventType || !data.organizerId || !data.organizationId || !data.startDate || !data.endDate) {
        return { success: false, message: "Missing required fields: eventTitle, eventType, organizerId, organizationId, startDate, endDate" };
      }

      const eventTypeMap: Record<string, EventType> = {
        public: EventType.PUBLIC,
        private: EventType.PRIVATE,
      };
      const mappedEventType = eventTypeMap[data.eventType.toLowerCase()];
      if (!mappedEventType) {
        return { success: false, message: "Invalid event type" };
      }

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

      const event = new Event();
      event.eventTitle = data.eventTitle;
      event.eventType = mappedEventType;
      event.organizerId = data.organizerId;
      event.organizationId = data.organizationId;
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

      if (data.venues && Array.isArray(data.venues)) {
        const venueIds = data.venues.map((v: VenueInterface) => v.venueId).filter(Boolean);
        if (venueIds.length > 0) {
          const venues = await AppDataSource.getRepository(Venue).find({ where: { venueId: In(venueIds) } });
          if (venues.length !== venueIds.length) {
            return { success: false, message: "One or more venues not found" };
          }
          event.venues = venues;
        }
      }

      if (data.venueBookings && Array.isArray(data.venueBookings)) {
        const bookingIds = data.venueBookings.map((b: VenueBookingInterface) => b.bookingId).filter(Boolean);
        if (bookingIds.length > 0) {
          const bookings = await AppDataSource.getRepository(VenueBooking).find({ where: { bookingId: In(bookingIds) } });
          if (bookings.length !== bookingIds.length) {
            return { success: false, message: "One or more venue bookings not found" };
          }
          event.venueBookings = bookings;
        }
      }

      return { success: true, data: event };
    } catch (error) {
      console.error("Error creating event:", error);
      return { success: false, message: "Failed to create event" };
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
    if (!id) {
      return { success: false, message: "Event ID is required" };
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
    if (!organizerId) {
      return { success: false, message: "Organizer ID is required" };
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
    if (!organizationId) {
      return { success: false, message: "Organization ID is required" };
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
    if (!venueId) {
      return { success: false, message: "Venue ID is required" };
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
    if (!id) {
      return { success: false, message: "Event ID is required" };
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
        const venues = venueIds.length > 0
          ? await AppDataSource.getRepository(Venue).find({ where: { venueId: In(venueIds) } })
          : [];
        if (venueIds.length > 0 && venues.length !== venueIds.length) {
          return { success: false, message: "One or more venues not found" };
        }
        event.venues = venues;
      }

      if (data.venueBookings && Array.isArray(data.venueBookings)) {
        const bookingIds = data.venueBookings.map((b: VenueBookingInterface) => b.bookingId).filter(Boolean);
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
    if (!id) {
      return { success: false, message: "Event ID is required" };
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
    if (!eventId || !venueIds || !Array.isArray(venueIds) || venueIds.length === 0) {
      return { success: false, message: "Event ID and valid venue IDs are required" };
    }

    try {
      const repo = AppDataSource.getRepository(Event);
      const event = await repo.findOne({ where: { eventId }, relations: ["venues"] });
      if (!event) {
        return { success: false, message: "Event not found" };
      }

      const venues = await AppDataSource.getRepository(Venue).find({ where: { venueId: In(venueIds) } });
      if (venues.length !== venueIds.length) {
        return { success: false, message: "One or more venues not found" };
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
    if (!eventId || !venueIds || !Array.isArray(venueIds) || venueIds.length === 0) {
      return { success: false, message: "Event ID and valid venue IDs are required" };
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
    if (!eventId || !bookingIds || !Array.isArray(bookingIds) || bookingIds.length === 0) {
      return { success: false, message: "Event ID and valid booking IDs are required" };
    }

    try {
      const repo = AppDataSource.getRepository(Event);
      const event = await repo.findOne({ where: { eventId }, relations: ["venueBookings"] });
      if (!event) {
        return { success: false, message: "Event not found" };
      }

      const bookings = await AppDataSource.getRepository(VenueBooking).find({ where: { bookingId: In(bookingIds) } });
      if (bookings.length !== bookingIds.length) {
        return { success: false, message: "One or more venue bookings not found" };
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
    if (!eventId || !bookingIds || !Array.isArray(bookingIds) || bookingIds.length === 0) {
      return { success: false, message: "Event ID and valid booking IDs are required" };
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
  try {
    const bookingRepo = AppDataSource.getRepository(VenueBooking);
    const venueRepo = AppDataSource.getRepository(Venue);
    const eventRepo = AppDataSource.getRepository(Event);
    const userRepo = AppDataSource.getRepository(User);

    if (!organizationId) {
      return { success: false, message: "Organization ID is required" };
    }

    // Check user membership in organization
    const user = await userRepo.findOne({
      where: { userId },
      relations: ["organizations"]
    });
    if (!user) {
      return { success: false, message: `User ${userId} not found` };
    }
    const userOrgIds = user.organizations.map(org => org.organizationId);
    if (!userOrgIds.includes(organizationId)) {
      return { success: false, message: "You are not a member of this organization" };
    }

    // Fetch the event to get its time window
    const event = await eventRepo.findOne({ where: { eventId } });
    if (!event) {
      return { success: false, message: `Event ${eventId} not found` };
    }
    const eventStart = new Date(event.startDate).getTime();
    const eventEnd = new Date(event.endDate).getTime();

    // Fetch all venues for the organization
    const orgVenues = await venueRepo.find({
      where: { organization: { organizationId } },
      relations: ["bookings", "bookings.event"]
    });
    const orgVenueIds = orgVenues.map(v => v.venueId);

    // Filter requested venueIds to only those in the organization
    const requestedVenueIds = bookings.map(b => b.venueId!);
    const validVenueIds = requestedVenueIds.filter(id => orgVenueIds.includes(id));
    if (validVenueIds.length === 0) {
      return { success: false, message: "No valid venues found in the selected organization" };
    }

    // Check for conflicts for each venue using event's time window
   const conflictingVenues: string[] = [];

for (const venue of orgVenues) {
  if (!validVenueIds.includes(venue.venueId)) continue;

  for (const booking of venue.bookings || []) {
    for (const event of booking.events || []) {
      if (!event.startDate || !event.endDate) continue;

      // Only consider events with APPROVED or COMPLETED status
      if (["APPROVED", "COMPLETED"].includes(event.status)) {
        const existingStart = new Date(event.startDate).getTime();
        const existingEnd = new Date(event.endDate).getTime();

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
      const venue = orgVenues.find(v => v.venueId === data.venueId);
      if (!venue) continue;
      const booking = new VenueBooking();
      booking.venueId = data.venueId!;
      booking.userId = userId;
      booking.organizationId = organizationId;
      booking.eventId = eventId;
      booking.totalAmountDue = data.totalAmountDue ?? venue.amount ?? 0;
      booking.venueInvoiceId = data.venueInvoiceId;
      booking.approvalStatus = ApprovalStatus.PENDING;
      booking.venue = venue;
      validBookings.push(booking);
    }

    const saved = await bookingRepo.save(validBookings);
    return { success: true, data: saved };
  } catch (error) {
    console.error("Bulk booking failed:", error);
    return { success: false, message: `Failed to save bookings: ${error instanceof Error ? error.message : "Unknown error"}` };
  }
}

  static async getVenueBookingById(bookingId: string): Promise<{ success: boolean; data?: VenueBooking; message?: string }> {
    if (!bookingId) {
      return { success: false, message: "Booking ID is required" };
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
    if (!bookingId) {
      return { success: false, message: "Booking ID is required" };
    }

    try {
      const repo = AppDataSource.getRepository(VenueBooking);
      const booking = await repo.findOne({ where: { bookingId }, relations: ["events"] });
      if (!booking) {
        return { success: false, message: "Venue booking not found" };
      }

      repo.merge(booking, {
        venueId: data.venueId ?? booking.venueId,
        userId: data.userId ?? booking.userId,
        organizationId: data.organizationId ?? booking.organizationId,
        totalAmountDue: data.totalAmountDue ?? booking.totalAmountDue,
        venueInvoiceId: data.venueInvoiceId ?? booking.venueInvoiceId,
        approvalStatus: data.approvalStatus ?? ApprovalStatus.PENDING,
      });

      const updatedBooking = await repo.save(booking);
      await CacheService.invalidateMultiple([
        `${this.CACHE_PREFIX}booking:${bookingId}`,
        ...booking.events.map(event => `${this.CACHE_PREFIX}${event.eventId}:bookings`),
      ]);
      return { success: true, data: updatedBooking, message: "Venue booking updated successfully" };
    } catch (error) {
      console.error("Error updating venue booking:", error);
      return { success: false, message: "Failed to update venue booking" };
    }
  }

  static async deleteVenueBooking(bookingId: string): Promise<{ success: boolean; message?: string }> {
    if (!bookingId) {
      return { success: false, message: "Booking ID is required" };
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
        ...booking.events.map(event => `${this.CACHE_PREFIX}${event.eventId}:bookings`),
      ]);
      return { success: true, message: "Venue booking deleted successfully" };
    } catch (error) {
      console.error("Error deleting venue booking:", error);
      return { success: false, message: "Failed to delete venue booking" };
    }
  }
}