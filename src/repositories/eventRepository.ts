import { AppDataSource } from "../config/Database";
import { EventInterface } from "../interfaces/EventInterface";
import { EventStatus, EventType } from "../interfaces/Index";
import { Event } from "../models/Event";
import { Venue } from "../models/Venue";
import { CacheService } from "../services/CacheService";
import { In, Between } from "typeorm";
import { VenueInterface } from "../interfaces/VenueInterface";


export class EventRepository {
  private static readonly CACHE_PREFIX = 'event:';
  private static readonly CACHE_TTL = 1800; // 30 minutes, due to frequent updates

    /**
     * Creates a new Event instance from provided data.
     * @param data Partial<EventInterface> - The data for creating the event.
     * @returns {success: boolean; data?: Event; message?: string} - Result object with success status, Event entity, or error message.
     */
  static async create(data: Partial<EventInterface>): Promise<{ success: boolean; data?: Event; message?: string }> {
    if (!data.eventTitle || !data.eventType || !data.organizerId || !data.organizationId || !data.startDate || !data.endDate) {
      return { success: false, message: "Missing required event fields: eventTitle, eventType, organizerId, organizationId, startDate, endDate" };
    }

        const eventTypeMap: Record<string, EventType> = {
            public: EventType.PUBLIC,
            private: EventType.PRIVATE,
        };

    const mappedEventType = eventTypeMap[data.eventType.toLowerCase()];
        if (!mappedEventType) {
            return { success: false, message: "Invalid event type provided." };
        }

        const eventStatusMap: Record<string, EventStatus> = {
            draft: EventStatus.DRAFT,
            published: EventStatus.PUBLISHED,
            cancelled: EventStatus.CANCELLED,
            completed: EventStatus.COMPLETED,
            archived: EventStatus.ARCHIVED,
        };

    const mappedStatus = data.status ? eventStatusMap[data.status.toLowerCase()] : EventStatus.DRAFT;
        if (data.status && !mappedStatus) {
            return { success: false, message: "Invalid event status provided." };
        }

        const event = new Event();
        event.eventTitle = data.eventTitle;
        event.eventType = mappedEventType;
    event.organizerId = data.organizerId;
    event.organizationId = data.organizationId;
    event.startDate = new Date(data.startDate);
    event.endDate = new Date(data.endDate);
    event.startTime = data.startTime ? String(data.startTime) : '';
    event.endTime = data.endTime ? String(data.endTime) : '';
    event.description = data.description ?? undefined;
        event.eventCategoryId = data.eventCategory ?? undefined;
        event.maxAttendees = data.maxAttendees ?? undefined;
        event.status = mappedStatus;
    event.isFeatured = data.isFeatured ?? false;
        event.qrCode = data.qrCode ?? undefined;
        event.imageURL = data.imageURL ?? undefined;

    // Handle venues array if provided
    if (data.venues && Array.isArray(data.venues)) {
      const venueRepository = AppDataSource.getRepository(Venue);
      const venueIds = data.venues.map((v: VenueInterface) => v.venueId).filter(Boolean);
      if (venueIds.length > 0) {
        const venues = await venueRepository.find({ where: { venueId: In(venueIds) } });
        if (venues.length !== venueIds.length) {
          return { success: false, message: "One or more venues not found." };
        }
        event.venues = venues;
      }
    }

        return { success: true, data: event };
    }

    /**
     * Saves an Event entity to the database.
     * @param event Event - The Event entity to be saved.
     * @returns {Promise<{success: boolean; data?: Event; message?: string}>} - Result object with success status, saved Event entity, or error message.
     */
    static async save(event: Event): Promise<{ success: boolean; data?: Event; message?: string }> {
        try {
            const savedEvent = await AppDataSource.getRepository(Event).save(event);

      // Invalidate caches
      await CacheService.invalidateMultiple([
        `${this.CACHE_PREFIX}all`,
        `${this.CACHE_PREFIX}${savedEvent.eventId}`,
        `${this.CACHE_PREFIX}org:${savedEvent.organizationId}`,
        `${this.CACHE_PREFIX}organizer:${savedEvent.organizerId}`,
        `${this.CACHE_PREFIX}${savedEvent.eventId}:venues`,
      ]);

            return { success: true, data: savedEvent, message: "Event saved successfully" };
        } catch (error) {
            console.error("Error saving event:", error);
            return { success: false, message: "Failed to save this event." };
        }
    }

    /**
     * Retrieves an event by its ID.
     * @param id string - The ID of the event to retrieve.
     * @returns {Promise<{success: boolean; data?: Event; message?: string}>} - Result object with success status, Event entity, or error message.
     */
    static async getById(id: string): Promise<{ success: boolean; data?: Event; message?: string }> {
        if (!id) {
            return { success: false, message: "Event ID is required." };
        }

    const cacheKey = `${this.CACHE_PREFIX}${id}`;
    try {
      const event = await CacheService.getOrSetSingle(
        cacheKey,
        AppDataSource.getRepository(Event),
        async () => {
          return await AppDataSource.getRepository(Event).findOne({
                where: { eventId: id },
            relations: ["organizer", "organizer.role", "venues", "organization"],
            });
        },
        this.CACHE_TTL
      );

            if (!event) {
                return { success: false, message: "Event not found." };
            }
            return { success: true, data: event };
        } catch (error) {
            console.error("Error fetching event by ID:", error);
            return { success: false, message: "Failed to retrieve event by ID." };
        }
    }

    /**
     * Retrieves events by organizer ID.
     * @param organizerId string - The ID of the organizer.
     * @returns {Promise<{success: boolean; data?: Event[]; message?: string}>} - Result object with success status, array of Event entities, or error message.
     */
    static async getByOrganizerId(organizerId: string): Promise<{ success: boolean; data?: Event[]; message?: string }> {
        if (!organizerId) {
            return { success: false, message: "Organizer ID is required." };
        }

    const cacheKey = `${this.CACHE_PREFIX}organizer:${organizerId}`;
    try {
      const events = await CacheService.getOrSetMultiple(
        cacheKey,
        AppDataSource.getRepository(Event),
        async () => {
          return await AppDataSource.getRepository(Event).find({
            where: { organizerId },
            relations: ["organizer", "organizer.role", "venues", "organization"],
            order: { startDate: "ASC" },
          });
        },
        this.CACHE_TTL
      );

            if (events.length === 0) {
                return { success: false, message: "No events found for this organizer." };
            }
            return { success: true, data: events };
        } catch (error) {
            console.error("Error fetching events by organizer ID:", error);
            return { success: false, message: "Failed to fetch events by organizer ID." };
        }
    }

  /**
   * Retrieves events by organization ID.
   * @param organizationId string - The ID of the organization.
   * @returns {Promise<{success: boolean; data?: Event[]; message?: string}>} - Result object with success status, array of Event entities, or error message.
   */
  static async getByOrganizationId(organizationId: string): Promise<{ success: boolean; data?: Event[]; message?: string }> {
    if (!organizationId) {
      return { success: false, message: "Organization ID is required." };
    }

    const cacheKey = `${this.CACHE_PREFIX}org:${organizationId}`;
    try {
      const events = await CacheService.getOrSetMultiple(
        cacheKey,
        AppDataSource.getRepository(Event),
        async () => {
          return await AppDataSource.getRepository(Event).find({
            where: { organizationId },
            relations: ["organizer", "organizer.role", "venues", "organization"],
            order: { startDate: "ASC" },
          });
        },
        this.CACHE_TTL
      );

      if (events.length === 0) {
        return { success: false, message: "No events found for this organization." };
      }
      return { success: true, data: events };
    } catch (error) {
      console.error("Error fetching events by organization ID:", error);
      return { success: false, message: "Failed to fetch events by organization ID." };
    }
  }

    /**
     * Retrieves all events.
     * @returns {Promise<{success: boolean; data?: Event[]; message?: string}>} - Result object with success status, array of Event entities, or error message.
     */
    static async getAll(): Promise<{ success: boolean; data?: Event[]; message?: string }> {
    const cacheKey = `${this.CACHE_PREFIX}all`;
    try {
      const events = await CacheService.getOrSetMultiple(
        cacheKey,
        AppDataSource.getRepository(Event),
        async () => {
          return await AppDataSource.getRepository(Event).find({
            relations: ["organizer", "organizer.role", "venues", "organization"],
            order: { startDate: "ASC" },
          });
        },
        this.CACHE_TTL
      );

            return { success: true, data: events };
        } catch (error) {
            console.error("Error fetching all events:", error);
            return { success: false, message: "Failed to retrieve all events." };
        }
    }

    /**
     * Updates an existing event.
     * @param id string - The ID of the event to update.
     * @param data Partial<EventInterface> - The partial data to update the event with.
     * @returns {Promise<{success: boolean; data?: Event; message?: string}>} - Result object with success status, updated Event entity, or error message.
     */
    static async update(id: string, data: Partial<EventInterface>): Promise<{ success: boolean; data?: Event; message?: string }> {
        if (!id) {
            return { success: false, message: "Event ID is required for update." };
        }

        try {
            const repo = AppDataSource.getRepository(Event);
      const event = await repo.findOne({ where: { eventId: id }, relations: ["venues"] });

            if (!event) {
                return { success: false, message: "Event not found." };
            }

            let updatedEventType = event.eventType;
            if (data.eventType) {
                const eventTypeMap: Record<string, EventType> = {
                    public: EventType.PUBLIC,
                    private: EventType.PRIVATE,
                };
        const mappedType = eventTypeMap[data.eventType.toLowerCase()];
                if (mappedType) {
                    updatedEventType = mappedType;
                } else {
                    return { success: false, message: "Invalid event type for update." };
                }
            }

            let updatedStatus = event.status;
            if (data.status) {
                const eventStatusMap: Record<string, EventStatus> = {
                    draft: EventStatus.DRAFT,
                    published: EventStatus.PUBLISHED,
                    cancelled: EventStatus.CANCELLED,
                    completed: EventStatus.COMPLETED,
                    archived: EventStatus.ARCHIVED,
                };
        const mappedStatus = eventStatusMap[data.status.toLowerCase()];
                if (mappedStatus) {
                    updatedStatus = mappedStatus;
                } else {
                    return { success: false, message: "Invalid event status for update." };
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
        eventCategoryId: data.eventCategory ?? event.eventCategoryId,
                maxAttendees: data.maxAttendees ?? event.maxAttendees,
                status: updatedStatus,
                isFeatured: data.isFeatured ?? event.isFeatured,
                qrCode: data.qrCode ?? event.qrCode,
                imageURL: data.imageURL ?? event.imageURL,
            });

      if (data.venues && Array.isArray(data.venues)) {
        const venueRepository = AppDataSource.getRepository(Venue);
        const venueIds = data.venues.map((v: VenueInterface) => v.venueId).filter(Boolean);
        if (venueIds.length > 0) {
          const venues = await venueRepository.find({ where: { venueId: In(venueIds) } });
          if (venues.length !== venueIds.length) {
            return { success: false, message: "One or more venues not found." };
          }
          event.venues = venues;
        } else {
          event.venues = [];
        }
      }

            const updatedEvent = await repo.save(event);

      // Invalidate caches
      await CacheService.invalidateMultiple([
        `${this.CACHE_PREFIX}all`,
        `${this.CACHE_PREFIX}${id}`,
        `${this.CACHE_PREFIX}org:${updatedEvent.organizationId}`,
        `${this.CACHE_PREFIX}organizer:${updatedEvent.organizerId}`,
        `${this.CACHE_PREFIX}${id}:venues`,
      ]);

            return { success: true, data: updatedEvent, message: "Event updated successfully." };
        } catch (error) {
            console.error("Error updating event:", error);
            return { success: false, message: "Failed to update event." };
        }
    }

    /**
   * Deletes an event by its ID (soft delete if DeleteDateColumn exists).
     * @param id string - The ID of the event to delete.
   * @returns {Promise<{success: boolean; message?: string}>} - Result object with success status or error message.
     */
  static async delete(id: string): Promise<{ success: boolean; message?: string }> {
        if (!id) {
      return { success: false, message: "Event ID is required." };
    }

    try {
      const repo = AppDataSource.getRepository(Event);
      const event = await repo.findOne({ where: { eventId: id } });
      if (!event) {
        return { success: false, message: "Event not found." };
      }

      await repo.softRemove(event); // Soft delete if DeleteDateColumn exists

      // Invalidate caches
      await CacheService.invalidateMultiple([
        `${this.CACHE_PREFIX}all`,
        `${this.CACHE_PREFIX}${id}`,
        `${this.CACHE_PREFIX}org:${event.organizationId}`,
        `${this.CACHE_PREFIX}organizer:${event.organizerId}`,
        `${this.CACHE_PREFIX}${id}:venues`,
      ]);

      return { success: true, message: "Event deleted successfully." };
        } catch (error) {
            console.error("Error deleting event:", error);
      return { success: false, message: "Failed to delete event." };
    }
  }

  /**
   * Retrieves events by venue ID.
   * @param venueId string - The ID of the venue.
   * @returns {Promise<{success: boolean; data?: Event[]; message?: string}>} - Result object with success status, array of Event entities, or error message.
   */
  static async getByVenueId(venueId: string): Promise<{ success: boolean; data?: Event[]; message?: string }> {
    if (!venueId) {
      return { success: false, message: "Venue ID is required." };
    }

    const cacheKey = `${this.CACHE_PREFIX}venue:${venueId}`;
    try {
      const events = await CacheService.getOrSetMultiple(
        cacheKey,
        AppDataSource.getRepository(Event),
        async () => {
          return await AppDataSource.getRepository(Event).createQueryBuilder("event")
            .leftJoinAndSelect("event.venues", "venue")
            .leftJoinAndSelect("event.organizer", "organizer")
            .leftJoinAndSelect("organizer.role", "role")
            .leftJoinAndSelect("event.organization", "organization")
            .where("venue.venueId = :venueId", { venueId })
            .orderBy("event.startDate", "ASC")
            .getMany();
        },
        this.CACHE_TTL
      );

      if (events.length === 0) {
        return { success: false, message: "No events found for this venue." };
      }
      return { success: true, data: events };
    } catch (error) {
      console.error("Error fetching events by venue ID:", error);
      return { success: false, message: "Failed to fetch events by venue ID." };
    }
  }

  /**
   * Retrieves events by status.
   * @param status EventStatus - The status of the events to retrieve.
   * @returns {Promise<{success: boolean; data?: Event[]; message?: string}>} - Result object with success status, array of Event entities, or error message.
   */
  static async getByStatus(status: EventStatus): Promise<{ success: boolean; data?: Event[]; message?: string }> {
    if (!status) {
      return { success: false, message: "Event status is required." };
    }

    const cacheKey = `${this.CACHE_PREFIX}status:${status}`;
    try {
      const events = await CacheService.getOrSetMultiple(
        cacheKey,
        AppDataSource.getRepository(Event),
        async () => {
          return await AppDataSource.getRepository(Event).find({
            where: { status },
            relations: ["organizer", "organizer.role", "venues", "organization"],
            order: { startDate: "ASC" },
          });
        },
        this.CACHE_TTL
      );

      if (events.length === 0) {
        return { success: false, message: `No events found with status ${status}.` };
      }
      return { success: true, data: events };
    } catch (error) {
      console.error("Error fetching events by status:", error);
      return { success: false, message: "Failed to fetch events by status." };
    }
  }

  /**
   * Retrieves events within a date range.
   * @param startDate Date - The start of the date range.
   * @param endDate Date - The end of the date range.
   * @returns {Promise<{success: boolean; data?: Event[]; message?: string}>} - Result object with success status, array of Event entities, or error message.
   */
  static async getByDateRange(startDate: Date, endDate: Date): Promise<{ success: boolean; data?: Event[]; message?: string }> {
    if (!startDate || !endDate) {
      return { success: false, message: "Start and end dates are required." };
    }

    const cacheKey = `${this.CACHE_PREFIX}date:${startDate.toISOString()}:${endDate.toISOString()}`;
    try {
      const events = await CacheService.getOrSetMultiple(
        cacheKey,
        AppDataSource.getRepository(Event),
        async () => {
          return await AppDataSource.getRepository(Event).find({
            where: { startDate: Between(startDate, endDate) },
            relations: ["organizer", "organizer.role", "venues", "organization"],
            order: { startDate: "ASC" },
          });
        },
        this.CACHE_TTL
      );

      if (events.length === 0) {
        return { success: false, message: "No events found in the specified date range." };
      }
      return { success: true, data: events };
    } catch (error) {
      console.error("Error fetching events by date range:", error);
      return { success: false, message: "Failed to fetch events by date range." };
    }
  }

  /**
   * Assigns venues to an event.
   * @param eventId string - The ID of the event.
   * @param venueIds string[] - Array of venue IDs to assign.
   * @returns {Promise<{success: boolean; message?: string}>} - Result object with success status or error message.
   */
  static async assignVenues(eventId: string, venueIds: string[]): Promise<{ success: boolean; message?: string }> {
    if (!eventId || !venueIds || !Array.isArray(venueIds) || venueIds.length === 0) {
      return { success: false, message: "Event ID and valid venue IDs are required." };
    }

    try {
      const repo = AppDataSource.getRepository(Event);
      const event = await repo.findOne({ where: { eventId }, relations: ["venues"] });
      if (!event) {
        return { success: false, message: "Event not found." };
      }

      const venueRepository = AppDataSource.getRepository(Venue);
      const venues = await venueRepository.find({ where: { venueId: In(venueIds) } });
      if (venues.length !== venueIds.length) {
        return { success: false, message: "One or more venues not found." };
      }

      event.venues = venues;
      await repo.save(event);

      // Invalidate caches
      await CacheService.invalidateMultiple([
        `${this.CACHE_PREFIX}${eventId}`,
        `${this.CACHE_PREFIX}${eventId}:venues`,
        `${this.CACHE_PREFIX}all`,
        `${this.CACHE_PREFIX}org:${event.organizationId}`,
        `${this.CACHE_PREFIX}organizer:${event.organizerId}`,
        ...venueIds.map(venueId => `${this.CACHE_PREFIX}venue:${venueId}`),
      ]);

      return { success: true, message: "Venues assigned successfully." };
    } catch (error) {
      console.error("Error assigning venues:", error);
      return { success: false, message: "Failed to assign venues." };
    }
  }

  /**
   * Removes venues from an event.
   * @param eventId string - The ID of the event.
   * @param venueIds string[] - Array of venue IDs to remove.
   * @returns {Promise<{success: boolean; message?: string}>} - Result object with success status or error message.
   */
  static async removeVenues(eventId: string, venueIds: string[]): Promise<{ success: boolean; message?: string }> {
    if (!eventId || !venueIds || !Array.isArray(venueIds) || venueIds.length === 0) {
      return { success: false, message: "Event ID and valid venue IDs are required." };
    }

    try {
      const repo = AppDataSource.getRepository(Event);
      const event = await repo.findOne({ where: { eventId }, relations: ["venues"] });
      if (!event) {
        return { success: false, message: "Event not found." };
      }

      event.venues = event.venues.filter(venue => !venueIds.includes(venue.venueId));
      await repo.save(event);

      // Invalidate caches
      await CacheService.invalidateMultiple([
        `${this.CACHE_PREFIX}${eventId}`,
        `${this.CACHE_PREFIX}${eventId}:venues`,
        `${this.CACHE_PREFIX}all`,
        `${this.CACHE_PREFIX}org:${event.organizationId}`,
        `${this.CACHE_PREFIX}organizer:${event.organizerId}`,
        ...venueIds.map(venueId => `${this.CACHE_PREFIX}venue:${venueId}`),
      ]);

      return { success: true, message: "Venues removed successfully." };
    } catch (error) {
      console.error("Error removing venues:", error);
      return { success: false, message: "Failed to remove venues." };
    }
  }

  /**
   * Creates multiple events from an array of event data.
   * @param eventsData Partial<EventInterface>[] - Array of event data.
   * @returns {Promise<{success: boolean; events: Event[]; errors: any[]}>} - Result object with success status, created events, and errors.
   */
  static async createMultiple(eventsData: Partial<EventInterface>[]): Promise<{ success: boolean; events: Event[]; errors: any[] }> {
    const events: Event[] = [];
    const errors: any[] = [];

    for (const data of eventsData) {
      try {
        const createResult = await this.create(data);
        if (!createResult.success || !createResult.data) {
          errors.push({ data, message: createResult.message });
          continue;
        }

        const saveResult = await this.save(createResult.data);
        if (saveResult.success && saveResult.data) {
          events.push(saveResult.data);
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

    // Invalidate cache for all events
    await CacheService.invalidate(`${this.CACHE_PREFIX}all`);

    return {
      success: errors.length === 0,
      events,
      errors,
    };
    }
}