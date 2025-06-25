import { AppDataSource } from '../config/Database';
import { TicketType } from '../models/TicketType';
import { Event } from '../models/Event';
import { User } from '../models/User';
import { IsNull } from 'typeorm';
import { validate } from 'class-validator';
import { CacheService } from '../services/CacheService'; // Import CacheService
import { EventStatus } from '../interfaces/Enums/EventStatusEnum'; // Ensure correct path

export class TicketTypeRepository {
    private repository = AppDataSource.getRepository(TicketType);
    private eventRepository = AppDataSource.getRepository(Event);
    private userRepository = AppDataSource.getRepository(User);
    private cacheService = new CacheService(); // Initialize CacheService

    /**
     * Creates a new TicketType record in the database.
     * Ensures only authorized users (event creator or organization member) can create tickets for approved events.
     * @param ticketType - The partial TicketType object containing data for creation.
     * @param userId - The ID of the logged-in user creating the ticket.
     * @returns An object indicating success, a message, and the created data if successful.
     */
    async create(ticketType: Partial<TicketType>, userId: string): Promise<{
        success: boolean;
        message: string;
        data?: TicketType;
    }> {
        // --- Basic Validation ---
        if (!ticketType.ticketName) {
            return { success: false, message: 'Ticket name is required.' };
        }
        if (ticketType.price === undefined || typeof ticketType.price !== 'number' || ticketType.price <= 0) {
            return { success: false, message: 'Ticket price must be a positive number.' };
        }
        if (!ticketType.ticketCategory) {
            return { success: false, message: 'Ticket category is required.' };
        }
        if (!ticketType.eventId) {
            return { success: false, message: 'Event ID is required.' };
        }

        try {
            // --- Check if user exists and is logged in ---
            const user = await this.userRepository.findOne({
                where: { userId, deletedAt: IsNull() },
                relations: ['organizations'],
            });
            if (!user) {
                return { success: false, message: 'User not found or not logged in.' };
            }

            // --- Check if event exists, is approved, and user is authorized ---
            const event = await this.eventRepository.findOne({
                where: { eventId: ticketType.eventId, deletedAt: IsNull(), status: EventStatus.APPROVED },
                relations: ['organization'],
            });
            if (!event) {
                return { success: false, message: 'Event not found, not approved, or deleted.' };
            }

            // Check if user is the event creator or part of the event's organization
            const isCreator = event.createdByUserId === userId || event.organizerId === userId;
            const isInOrganization = user.organizations.some(org => org.organizationId === event.organizationId);
            if (!isCreator && !isInOrganization) {
                return { success: false, message: 'Unauthorized: You cannot create tickets for this event.' };
            }

            // --- Check for duplicate ticket name within the event ---
            const existingTicketType = await this.repository.findOne({
                where: {
                    ticketName: ticketType.ticketName,
                    eventId: ticketType.eventId,
                    deletedAt: IsNull(),
                },
            });
            if (existingTicketType) {
                return { success: false, message: `Ticket type with name '${ticketType.ticketName}' already exists for this event.` };
            }

            // --- Validate TicketType entity ---
            const newTicketType = this.repository.create(ticketType);
            const validationErrors = await validate(newTicketType);
            if (validationErrors.length > 0) {
                const errorMessages = validationErrors.map(err => Object.values(err.constraints || {})).flat();
                return { success: false, message: `Validation failed: ${errorMessages.join(', ')}` };
            }

            // --- Save TicketType ---
            const saved = await this.repository.save(newTicketType);

            // --- Cache the ticket type ---
            await CacheService.set(`ticketType:${saved.ticketTypeId}`, saved, 3600); // Cache for 1 hour
            await CacheService.invalidate(`ticketTypes:event:${ticketType.eventId}`); // Invalidate event tickets cache

            return { success: true, message: 'Ticket type created successfully.', data: saved };
        } catch (error) {
            console.error('Error in TicketTypeRepository.create:', error);
            return { success: false, message: 'Failed to create ticket type.' };
        }
    }

    /**
     * Retrieves all active TicketType records for an event from the database, with caching.
     * @param eventId - The UUID of the event to fetch tickets for.
     * @returns An object indicating success, a message, and an array of TicketType data.
     */
    async findAllByEvent(eventId: string): Promise<{ success: boolean; message: string; data: TicketType[] }> {
        try {
            // --- Check cache first ---
            const cacheKey = `ticketTypes:event:${eventId}`;
            const cachedTickets = await CacheService.get<TicketType[]>(cacheKey);
            if (cachedTickets) {
                return { success: true, message: 'Ticket types fetched from cache.', data: cachedTickets };
            }

            // --- Fetch from database ---
            const tickets = await this.repository.find({
                where: {
                    eventId,
                    deletedAt: IsNull(),
                },
                relations: ['registrations', 'event'],
                order: { ticketName: 'ASC' },
            });

            // --- Cache the result ---
            await CacheService.set(cacheKey, tickets, 3600); // Cache for 1 hour

            return { success: true, message: 'Ticket types fetched successfully.', data: tickets };
        } catch (error) {
            console.error('Error in TicketTypeRepository.findAllByEvent:', error);
            return { success: false, message: 'Failed to fetch ticket types.', data: [] };
        }
    }

    /**
     * Finds a single active TicketType record by its ID, with caching.
     * @param ticketTypeId - The UUID of the ticket type to find.
     * @returns An object indicating success, a message, and the TicketType data if found.
     */
    async findById(ticketTypeId: string): Promise<{ success: boolean; message: string; data?: TicketType }> {
        try {
            // --- Check cache first ---
            const cacheKey = `ticketType:${ticketTypeId}`;
            const cachedTicket = await CacheService.get<TicketType>(cacheKey);
            if (cachedTicket) {
                return { success: true, message: 'Ticket type fetched from cache.', data: cachedTicket };
            }

            // --- Fetch from database ---
            const ticket = await this.repository.findOne({
                where: {
                    ticketTypeId,
                    deletedAt: IsNull(),
                },
                relations: ['registrations', 'event'],
            });

            if (!ticket) {
                return { success: false, message: 'Ticket type found or is deleted.' };
            }

            // --- Cache the ticket ---
            await CacheService.set(cacheKey, ticket, 3600); // Cache for 1 hour

            return { success: true, message: 'Ticket type found.', data: ticket };
        } catch (error) {
            console.error('Error in TicketTypeRepository.findById:', error);
            return { success: false, message: 'Failed to find ticket type.' };
        }
    }

    /**
     * Updates an existing TicketType record, invalidating cache.
     * @param ticketTypeId - The ID of the ticket type to update.
     * @param updateData - The partial data to apply.
     * @param userId - The ID of the user performing the update.
     * @returns An object indicating success, a message, and the updated ticket type.
     */
    async update(ticketTypeId: string, updateData: Partial<TicketType>, userId: string): Promise<{ success: boolean; message: string; data?: TicketType }> {
        try {
            // --- Find the ticket type ---
            const { success, data: ticketType } = await this.findById(ticketTypeId);
            if (!success || !ticketType) {
                return { success: false, message: 'Ticket type not found or deleted.' };
            }

            // --- Check user authorization ---
            const event = await this.eventRepository.findOne({
                where: { eventId: ticketType.eventId, deletedAt: IsNull(), status: EventStatus.APPROVED },
                relations: ['organization'],
            });
            if (!event) {
                return { success: false, message: 'Event not found, not approved, or deleted.' };
            }

            const user = await this.userRepository.findOne({
                where: { userId, deletedAt: IsNull() },
                relations: ['organizations'],
            });
            if (!user) {
                return { success: false, message: 'User not found.' };
            }

            const isCreator = event.createdByUserId === userId || event.organizerId === userId;
            const isInOrganization = user.organizations.some(org => org.organizationId === event.organizationId);
            if (!isCreator && !isInOrganization) {
                return { success: false, message: 'Unauthorized: You cannot update tickets for this event.' };
            }

            // --- Validate updates ---
            if (updateData.price !== undefined && (typeof updateData.price !== 'number' || updateData.price <= 0)) {
                return { success: false, message: 'Ticket price must be a positive number if provided.' };
            }

            const updatedTicketType = this.repository.create({ ...ticketType, ...updateData });
            const validationErrors = await validate(updatedTicketType);
            if (validationErrors.length > 0) {
                const errorMessages = validationErrors.map(err => Object.values(err.constraints || {})).flat();
                return { success: false, message: `Validation failed: ${errorMessages.join(', ')}` };
            }

            // --- Save updates ---
            Object.assign(ticketType, updateData);
            const updated = await this.repository.save(ticketType);

            // --- Update cache ---
            await CacheService.set(`ticketType:${ticketTypeId}`, updated, 3600);
            await CacheService.invalidate(`ticketTypes:event:${ticketType.eventId}`); // Invalidate event tickets cache

            return { success: true, message: 'Ticket type updated successfully.', data: updated };
        } catch (error) {
            console.error('Error in TicketTypeRepository.update:', error);
            return { success: false, message: 'Failed to update ticket type.' };
        }
    }

    /**
     * Soft deletes a TicketType record, checking for active registrations and invalidating cache.
     * @param ticketTypeId - The UUID of the ticket type to delete.
     * @param userId - The ID of the user performing the deletion.
     * @returns An object indicating success and a message.
     */
    async delete(ticketTypeId: string, userId: string): Promise<{ success: boolean; message: string }> {
        try {
            // --- Find the ticket type ---
            const { success, data: ticketType } = await this.findById(ticketTypeId);
            if (!success || !ticketType) {
                return { success: false, message: 'Ticket type not found or already deleted.' };
            }

            // --- Check user authorization ---
            const event = await this.eventRepository.findOne({
                where: { eventId: ticketType.eventId, deletedAt: IsNull(), status: EventStatus.APPROVED },
                relations: ['organization'],
            });
            if (!event) {
                return { success: false, message: 'Event not found, not approved, or deleted.' };
            }

            const user = await this.userRepository.findOne({
                where: { userId, deletedAt: IsNull() },
                relations: ['organizations'],
            });
            if (!user) {
                return { success: false, message: 'User not found.' };
            }

            const isCreator = event.createdByUserId === userId || event.organizerId === userId;
            const isInOrganization = user.organizations.some(org => org.organizationId === event.organizationId);
            if (!isCreator && !isInOrganization) {
                return { success: false, message: 'Unauthorized: You cannot delete tickets for this event.' };
            }

            // --- Check for active registrations ---
            const activeRegistrations = ticketType.registrations?.filter(reg => !reg.deletedAt);
            if (activeRegistrations && activeRegistrations.length > 0) {
                return { success: false, message: `Cannot delete ticket type used in ${activeRegistrations.length} active registrations.` };
            }

            // --- Perform soft deletion ---
            ticketType.deletedAt = new Date();
            await this.repository.save(ticketType);

            // --- Invalidate cache ---
            await CacheService.invalidate(`ticketType:${ticketTypeId}`);
            await CacheService.invalidate(`ticketTypes:event:${ticketType.eventId}`);

            return { success: true, message: 'Ticket type soft-deleted successfully.' };
        } catch (error) {
            console.error('Error in TicketTypeRepository.delete:', error);
            return { success: false, message: 'Failed to soft delete ticket type.' };
        }
    }
}