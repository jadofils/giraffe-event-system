"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.VenueBookingRepository = void 0;
const Database_1 = require("../config/Database");
const Event_1 = require("../models/Event");
const Organization_1 = require("../models/Organization");
const Venue_1 = require("../models/Venue");
const User_1 = require("../models/User");
const VenueBookingInterface_1 = require("../interfaces/VenueBookingInterface");
const VenueBooking_1 = require("../models/VenueBooking");
const CacheService_1 = require("../services/CacheService");
const Invoice_1 = require("../models/Invoice");
const CheckAbsenceService_1 = require("../services/bookings/CheckAbsenceService");
class VenueBookingRepository {
    // Initialize venue booking repository
    static getVenueBookingRepository() {
        if (!this.venueBookingRepository) {
            if (!Database_1.AppDataSource.isInitialized) {
                throw new Error('Database not initialized.');
            }
            this.venueBookingRepository = Database_1.AppDataSource.getRepository(VenueBooking_1.VenueBooking);
        }
        return this.venueBookingRepository;
    }
    // Initialize event repository
    static getEventRepository() {
        if (!this.eventRepository) {
            this.eventRepository = Database_1.AppDataSource.getRepository(Event_1.Event);
        }
        return this.eventRepository;
    }
    // Initialize organization repository
    static getOrganizationRepository() {
        if (!this.organizationRepository) {
            this.organizationRepository = Database_1.AppDataSource.getRepository(Organization_1.Organization);
        }
        return this.organizationRepository;
    }
    // Initialize user repository
    static getUserRepository() {
        if (!this.userRepository) {
            this.userRepository = Database_1.AppDataSource.getRepository(User_1.User);
        }
        return this.userRepository;
    }
    // Initialize venue repository
    static getVenueRepository() {
        if (!this.venueRepository) {
            this.venueRepository = Database_1.AppDataSource.getRepository(Venue_1.Venue);
        }
        return this.venueRepository;
    }
    // Check for duplicate bookings
    static checkDuplicateBookings(venueId, startDate, endDate, startTime, endTime, excludeBookingId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                if (!venueId || !startDate || !endDate) {
                    return { success: false, message: 'Venue ID, start date, and end date are required.' };
                }
                if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
                    return { success: false, message: 'Invalid date format.' };
                }
                if (startDate > endDate) {
                    return { success: false, message: 'Start date cannot be after end date.' };
                }
                const bookingRepo = this.getVenueBookingRepository();
                const query = bookingRepo
                    .createQueryBuilder('booking')
                    .leftJoinAndSelect('booking.event', 'event')
                    .where('booking.venueId = :venueId', { venueId })
                    .andWhere('booking.approvalStatus = :status', { status: 'approved' })
                    .andWhere('((event.startDate <= :endDate AND event.endDate >= :startDate) AND ' +
                    '((CAST(:startTime AS text) IS NULL AND CAST(:endTime AS text) IS NULL) OR (event.startTime <= CAST(:endTime AS text) AND event.endTime >= CAST(:startTime AS text))))', {
                    startDate,
                    endDate,
                    startTime: typeof startTime === 'string' ? startTime : (startTime ? String(startTime) : null),
                    endTime: typeof endTime === 'string' ? endTime : (endTime ? String(endTime) : null)
                });
                if (excludeBookingId) {
                    query.andWhere('booking.bookingId != :excludeBookingId', { excludeBookingId });
                }
                const conflicts = yield query.getMany();
                if (conflicts.length > 0) {
                    return {
                        success: false,
                        message: 'Conflicting bookings found for the requested period.',
                        conflicts,
                    };
                }
                return { success: true, message: 'No conflicting bookings found.' };
            }
            catch (error) {
                console.error('Error checking duplicate bookings:', error);
                return {
                    success: false,
                    message: `Failed to check duplicate bookings: ${error instanceof Error ? error.message : 'Unknown error'}`,
                };
            }
        });
    }
    static createBooking(bookingData) {
        return __awaiter(this, void 0, void 0, function* () {
            const queryRunner = Database_1.AppDataSource.createQueryRunner();
            yield queryRunner.connect();
            yield queryRunner.startTransaction();
            try {
                // Validate required fields
                if (!bookingData.eventId || !bookingData.venueId || !bookingData.organizerId || !bookingData.userId) {
                    return { success: false, message: 'Missing required booking fields: eventId, venueId, organizerId, userId.' };
                }
                // Initialize repositories
                const eventRepo = queryRunner.manager.getRepository(Event_1.Event);
                const venueRepo = queryRunner.manager.getRepository(Venue_1.Venue);
                const userRepo = queryRunner.manager.getRepository(User_1.User);
                const orgRepo = queryRunner.manager.getRepository(Organization_1.Organization);
                const bookingRepo = queryRunner.manager.getRepository(VenueBooking_1.VenueBooking);
                const invoiceRepo = queryRunner.manager.getRepository(Invoice_1.Invoice);
                // Fetch related entities
                const event = yield eventRepo.findOne({ where: { eventId: bookingData.eventId } });
                if (!event)
                    return { success: false, message: 'Event does not exist.' };
                const venue = yield venueRepo.findOne({ where: { venueId: bookingData.venueId } });
                if (!venue)
                    return { success: false, message: 'Venue does not exist.' };
                if (event.maxAttendees && event.maxAttendees > venue.capacity) {
                    return {
                        success: false,
                        message: `Venue capacity is insufficient for the expected attendance. Venue capacity: ${venue.capacity}, requested: ${event.maxAttendees}`,
                    };
                }
                const user = yield userRepo.findOne({ where: { userId: bookingData.userId } });
                if (!user)
                    return { success: false, message: 'User does not exist.' };
                const organization = bookingData.organizationId
                    ? yield orgRepo.findOne({ where: { organizationId: bookingData.organizationId } })
                    : undefined;
                if (bookingData.organizationId && !organization) {
                    return { success: false, message: 'Organization does not exist.' };
                }
                const invoice = bookingData.venueInvoiceId
                    ? yield invoiceRepo.findOne({ where: { invoiceId: bookingData.venueInvoiceId } })
                    : undefined;
                if (bookingData.venueInvoiceId && !invoice) {
                    return { success: false, message: 'Invoice does not exist.' };
                }
                // Check availability and conflicts
                const req = { user: { userId: bookingData.userId } };
                const validation = yield CheckAbsenceService_1.CheckAbsenceService.validateBooking(req, bookingData);
                if (!validation.success) {
                    return { success: false, message: validation.message };
                }
                // Create booking entity
                const newBooking = bookingRepo.create({
                    eventId: bookingData.eventId,
                    event: event, // already loaded Event entity
                    venueId: bookingData.venueId,
                    venue: venue, // already loaded Venue entity
                    userId: bookingData.organizerId, // foreign key
                    user: user, // <-- set the user relation
                    organizationId: bookingData.organizationId,
                    venueInvoiceId: bookingData.venueInvoiceId,
                    totalAmountDue: venue.amount,
                    approvalStatus: bookingData.approvalStatus || VenueBooking_1.ApprovalStatus.PENDING,
                    notes: bookingData.notes,
                });
                // Save booking
                const savedBooking = yield bookingRepo.save(newBooking);
                // Sync with event_venues table
                yield queryRunner.query('INSERT INTO event_venues ("eventId", "venueId") VALUES ($1, $2) ON CONFLICT DO NOTHING', [bookingData.eventId, bookingData.venueId]);
                // Invalidate caches
                yield CacheService_1.CacheService.invalidateMultiple([
                    `${this.CACHE_PREFIX}all`,
                    `${this.CACHE_PREFIX}${savedBooking.bookingId}`,
                    `${this.CACHE_PREFIX}event:${bookingData.eventId}`,
                    `${this.CACHE_PREFIX}venue:${bookingData.venueId}`,
                    `${this.CACHE_PREFIX}organizer:${bookingData.organizerId}`,
                    `${this.CACHE_PREFIX}organization:${bookingData.organizationId || ''}`,
                    `${this.CACHE_PREFIX}status:*`,
                ]);
                yield queryRunner.commitTransaction();
                return { success: true, data: savedBooking, message: 'Booking created successfully.' };
            }
            catch (error) {
                yield queryRunner.rollbackTransaction();
                console.error('Error creating booking:', error);
                return {
                    success: false,
                    message: `Failed to create booking: ${error instanceof Error ? error.message : 'Unknown error'}`,
                };
            }
            finally {
                yield queryRunner.release();
            }
        });
    }
    // Update a single booking
    static updateBooking(id, bookingData) {
        return __awaiter(this, void 0, void 0, function* () {
            const queryRunner = Database_1.AppDataSource.createQueryRunner();
            yield queryRunner.connect();
            yield queryRunner.startTransaction();
            try {
                if (!id) {
                    return { success: false, message: 'Booking ID is required.' };
                }
                const bookingRepo = queryRunner.manager.getRepository(VenueBooking_1.VenueBooking);
                const existingBooking = yield bookingRepo.findOne({
                    where: { bookingId: id },
                    relations: ['event', 'venue', 'user', 'organization'],
                });
                if (!existingBooking) {
                    return { success: false, message: 'Booking not found.' };
                }
                // Validate input
                const validationErrors = VenueBookingInterface_1.VenueBookingInterface.validate(bookingData);
                if (validationErrors.length > 0) {
                    yield queryRunner.rollbackTransaction();
                    return { success: false, message: `Validation errors: ${validationErrors.join(', ')}` };
                }
                // Store old values for cache invalidation
                const oldEventId = existingBooking.eventId;
                const oldVenueId = existingBooking.venueId;
                const oldUserId = existingBooking.userId;
                const oldOrganizationId = existingBooking.organizationId;
                const oldApprovalStatus = existingBooking.approvalStatus;
                // Validate new entities if provided
                let event = existingBooking.event;
                if (bookingData.eventId && bookingData.eventId !== existingBooking.eventId) {
                    const foundEvent = yield queryRunner.manager.getRepository(Event_1.Event).findOne({ where: { eventId: bookingData.eventId } });
                    if (!foundEvent) {
                        yield queryRunner.rollbackTransaction();
                        return { success: false, message: 'Event does not exist.' };
                    }
                    event = foundEvent;
                    existingBooking.eventId = bookingData.eventId;
                    existingBooking.event = event;
                }
                let venue = existingBooking.venue;
                if (bookingData.venueId && bookingData.venueId !== existingBooking.venueId) {
                    return { success: false, message: "Venue cannot be changed for an existing booking." };
                }
                if (bookingData.organizerId && bookingData.organizerId !== existingBooking.userId) {
                    const user = yield queryRunner.manager.getRepository(User_1.User).findOne({ where: { userId: bookingData.organizerId } });
                    if (!user) {
                        yield queryRunner.rollbackTransaction();
                        return { success: false, message: 'Organizer does not exist.' };
                    }
                    existingBooking.userId = bookingData.organizerId;
                    existingBooking.user = user;
                }
                if (bookingData.organizationId && bookingData.organizationId !== existingBooking.organizationId) {
                    const org = yield queryRunner.manager.getRepository(Organization_1.Organization).findOne({ where: { organizationId: bookingData.organizationId } });
                    if (!org) {
                        yield queryRunner.rollbackTransaction();
                        return { success: false, message: 'Organization does not exist.' };
                    }
                    existingBooking.organizationId = bookingData.organizationId;
                    existingBooking.organization = org;
                }
                // Validate approval status
                if (bookingData.approvalStatus && !Object.values(VenueBooking_1.ApprovalStatus).includes(bookingData.approvalStatus)) {
                    yield queryRunner.rollbackTransaction();
                    return { success: false, message: 'Invalid approval status.' };
                }
                // Check conflicts if eventId or venueId changes
                if (bookingData.eventId || bookingData.venueId) {
                    const checkEvent = bookingData.eventId ? event : existingBooking.event;
                    const checkVenueId = bookingData.venueId || existingBooking.venueId;
                    const conflictCheck = yield this.checkDuplicateBookings(checkVenueId, new Date(checkEvent.startDate), new Date(checkEvent.endDate), checkEvent.startTime, checkEvent.endTime, id);
                    if (!conflictCheck.success) {
                        yield queryRunner.rollbackTransaction();
                        return { success: false, message: conflictCheck.message };
                    }
                }
                // Merge updates
                if (bookingData.approvalStatus) {
                    existingBooking.approvalStatus = bookingData.approvalStatus;
                }
                if (bookingData.notes !== undefined) {
                    existingBooking.notes = bookingData.notes;
                }
                // Save updated booking
                const updatedBooking = yield bookingRepo.save(existingBooking);
                // Sync with event_venues table if eventId or venueId changed
                if (bookingData.eventId || bookingData.venueId) {
                    yield queryRunner.query('INSERT INTO event_venues (event_id, venue_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [updatedBooking.eventId, updatedBooking.venueId]);
                    // Optionally remove old event_venues entry
                    if (bookingData.eventId || bookingData.venueId) {
                        yield queryRunner.query('DELETE FROM event_venues WHERE eventId = $1 AND venueId = $2', [oldEventId, oldVenueId]);
                    }
                }
                // Invalidate caches
                yield CacheService_1.CacheService.invalidateMultiple([
                    `${this.CACHE_PREFIX}all`,
                    `${this.CACHE_PREFIX}${id}`,
                    `${this.CACHE_PREFIX}event:${oldEventId}`,
                    `${this.CACHE_PREFIX}event:${updatedBooking.eventId}`,
                    `${this.CACHE_PREFIX}venue:${oldVenueId}`,
                    `${this.CACHE_PREFIX}venue:${updatedBooking.venueId}`,
                    `${this.CACHE_PREFIX}organizer:${oldUserId}`,
                    `${this.CACHE_PREFIX}organizer:${updatedBooking.userId}`,
                    `${this.CACHE_PREFIX}organization:${oldOrganizationId || ''}`,
                    `${this.CACHE_PREFIX}organization:${updatedBooking.organizationId || ''}`,
                    `${this.CACHE_PREFIX}status:${oldApprovalStatus}`,
                    `${this.CACHE_PREFIX}status:${updatedBooking.approvalStatus}`,
                ]);
                yield queryRunner.commitTransaction();
                return { success: true, data: updatedBooking, message: 'Booking updated successfully.' };
            }
            catch (error) {
                yield queryRunner.rollbackTransaction();
                console.error('Error updating booking:', error);
                return {
                    success: false,
                    message: `Failed to update booking: ${error instanceof Error ? error.message : 'Unknown error'}`,
                };
            }
            finally {
                yield queryRunner.release();
            }
        });
    }
    // Update booking status
    static updateBookingStatus(id, status) {
        return __awaiter(this, void 0, void 0, function* () {
            const queryRunner = Database_1.AppDataSource.createQueryRunner();
            yield queryRunner.connect();
            yield queryRunner.startTransaction();
            try {
                if (!id) {
                    return { success: false, message: 'Booking ID is required.' };
                }
                if (!Object.values(VenueBooking_1.ApprovalStatus).includes(status)) {
                    return { success: false, message: 'Invalid approval status.' };
                }
                const bookingRepo = queryRunner.manager.getRepository(VenueBooking_1.VenueBooking);
                const existingBooking = yield bookingRepo.findOne({
                    where: { bookingId: id },
                    relations: ['event', 'venue', 'user', 'organization'],
                });
                if (!existingBooking) {
                    return { success: false, message: 'Booking not found.' };
                }
                const oldStatus = existingBooking.approvalStatus;
                existingBooking.approvalStatus = status;
                // Check conflicts if status is changing to approved
                if (status === VenueBooking_1.ApprovalStatus.APPROVED) {
                    const conflictCheck = yield this.checkDuplicateBookings(existingBooking.venueId, new Date(existingBooking.event.startDate), new Date(existingBooking.event.endDate), existingBooking.event.startTime, existingBooking.event.endTime, id);
                    if (!conflictCheck.success) {
                        yield queryRunner.rollbackTransaction();
                        return { success: false, message: conflictCheck.message };
                    }
                }
                const updatedBooking = yield bookingRepo.save(existingBooking);
                // Invalidate caches
                yield CacheService_1.CacheService.invalidateMultiple([
                    `${this.CACHE_PREFIX}all`,
                    `${this.CACHE_PREFIX}${id}`,
                    `${this.CACHE_PREFIX}event:${existingBooking.eventId}`,
                    `${this.CACHE_PREFIX}venue:${existingBooking.venueId}`,
                    `${this.CACHE_PREFIX}organizer:${existingBooking.userId}`,
                    `${this.CACHE_PREFIX}organization:${existingBooking.organizationId || ''}`,
                    `${this.CACHE_PREFIX}status:${oldStatus}`,
                    `${this.CACHE_PREFIX}status:${status}`,
                ]);
                yield queryRunner.commitTransaction();
                return { success: true, data: updatedBooking, message: 'Booking status updated successfully.' };
            }
            catch (error) {
                yield queryRunner.rollbackTransaction();
                console.error('Error updating booking status:', error);
                return {
                    success: false,
                    message: `Failed to update booking status: ${error instanceof Error ? error.message : 'Unknown error'}`,
                };
            }
            finally {
                yield queryRunner.release();
            }
        });
    }
    // Delete booking
    static deleteBooking(id) {
        return __awaiter(this, void 0, void 0, function* () {
            const queryRunner = Database_1.AppDataSource.createQueryRunner();
            yield queryRunner.connect();
            yield queryRunner.startTransaction();
            try {
                if (!id) {
                    return { success: false, message: 'Booking ID is required.' };
                }
                const bookingRepo = queryRunner.manager.getRepository(VenueBooking_1.VenueBooking);
                const existingBooking = yield bookingRepo.findOne({
                    where: { bookingId: id },
                    relations: ['event', 'venue', 'user', 'organization'],
                });
                if (!existingBooking) {
                    return { success: false, message: 'Booking not found.' };
                }
                yield bookingRepo.delete(id);
                // Remove from event_venues table
                yield queryRunner.query('DELETE FROM event_venues WHERE eventId = $1 AND venueId = $2', [existingBooking.eventId, existingBooking.venueId]);
                // Invalidate caches
                yield CacheService_1.CacheService.invalidateMultiple([
                    `${this.CACHE_PREFIX}all`,
                    `${this.CACHE_PREFIX}${id}`,
                    `${this.CACHE_PREFIX}event:${existingBooking.eventId}`,
                    `${this.CACHE_PREFIX}venue:${existingBooking.venueId}`,
                    `${this.CACHE_PREFIX}organizer:${existingBooking.userId}`,
                    `${this.CACHE_PREFIX}organization:${existingBooking.organizationId || ''}`,
                    `${this.CACHE_PREFIX}status:${existingBooking.approvalStatus}`,
                ]);
                yield queryRunner.commitTransaction();
                return { success: true, message: 'Booking deleted successfully.' };
            }
            catch (error) {
                yield queryRunner.rollbackTransaction();
                console.error('Error deleting booking:', error);
                return {
                    success: false,
                    message: `Failed to delete booking: ${error instanceof Error ? error.message : 'Unknown error'}`,
                };
            }
            finally {
                yield queryRunner.release();
            }
        });
    }
    // Get total booking amount for an event
    static getTotalBookingAmountForEvent(eventId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const bookingRepo = this.getVenueBookingRepository();
                const result = yield bookingRepo
                    .createQueryBuilder('booking')
                    .where('booking.eventId = :eventId', { eventId })
                    .andWhere('booking.approvalStatus = :status', { status: VenueBooking_1.ApprovalStatus.APPROVED })
                    .select('SUM(booking.totalAmountDue)', 'total')
                    .getRawOne();
                const totalAmount = parseFloat((result === null || result === void 0 ? void 0 : result.total) || '0');
                return {
                    success: true,
                    totalAmount,
                    message: `Total booking amount for event ${eventId}: ${totalAmount}`,
                };
            }
            catch (error) {
                console.error('Error calculating total booking amount:', error);
                return {
                    success: false,
                    message: `Failed to calculate total: ${error instanceof Error ? error.message : 'Unknown error'}`,
                };
            }
        });
    }
    // Create multiple bookings
    static createMultipleBookings(bookingsData) {
        return __awaiter(this, void 0, void 0, function* () {
            const queryRunner = Database_1.AppDataSource.createQueryRunner();
            yield queryRunner.connect();
            yield queryRunner.startTransaction();
            const bookings = [];
            const errors = [];
            try {
                for (const bookingData of bookingsData) {
                    const createResult = yield this.createBooking(bookingData);
                    if (createResult.success && createResult.data) {
                        bookings.push(createResult.data);
                    }
                    else {
                        errors.push({ data: bookingData, message: createResult.message || 'Failed to create booking.' });
                    }
                }
                if (errors.length > 0) {
                    yield queryRunner.rollbackTransaction();
                    return { success: false, bookings, errors };
                }
                yield queryRunner.commitTransaction();
                return { success: true, bookings, errors };
            }
            catch (error) {
                yield queryRunner.rollbackTransaction();
                console.error('Error creating multiple bookings:', error);
                errors.push({
                    data: {},
                    message: `Failed to create bookings: ${error instanceof Error ? error.message : 'Unknown error'}`,
                });
                return { success: false, bookings, errors };
            }
            finally {
                yield queryRunner.release();
            }
        });
    }
    // Get all bookings
    static getAllBookings() {
        return __awaiter(this, void 0, void 0, function* () {
            const cacheKey = `${this.CACHE_PREFIX}all`;
            try {
                const bookings = yield CacheService_1.CacheService.getOrSetMultiple(cacheKey, this.getVenueBookingRepository(), () => __awaiter(this, void 0, void 0, function* () {
                    return yield this.getVenueBookingRepository().find({
                        relations: ['event', 'venue', 'user', 'organization'],
                        order: { createdAt: 'DESC' },
                    });
                }), this.CACHE_TTL);
                return {
                    success: true,
                    data: bookings,
                    message: bookings.length ? undefined : 'No bookings found.',
                };
            }
            catch (error) {
                console.error('Error fetching all bookings:', error);
                return {
                    success: false,
                    message: `Failed to get all bookings: ${error instanceof Error ? error.message : 'Unknown error'}`,
                };
            }
        });
    }
    // Get booking by ID
    static getBookingById(id) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!id) {
                return { success: false, message: 'Booking ID is required.' };
            }
            const cacheKey = `${this.CACHE_PREFIX}${id}`;
            try {
                const booking = yield CacheService_1.CacheService.getOrSetSingle(cacheKey, this.getVenueBookingRepository(), () => __awaiter(this, void 0, void 0, function* () {
                    return yield this.getVenueBookingRepository().findOne({
                        where: { bookingId: id },
                        relations: ['event', 'venue', 'user', 'organization'],
                    });
                }), this.CACHE_TTL);
                if (!booking) {
                    return { success: false, message: 'Booking not found.' };
                }
                return { success: true, data: booking };
            }
            catch (error) {
                console.error('Error fetching booking by ID:', error);
                return {
                    success: false,
                    message: `Failed to get booking by ID: ${error instanceof Error ? error.message : 'Unknown error'}`,
                };
            }
        });
    }
    // Get bookings by event ID
    static getBookingsByEventId(eventId) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!eventId) {
                return { success: false, message: 'Event ID is required.' };
            }
            const cacheKey = `${this.CACHE_PREFIX}event:${eventId}`;
            try {
                const bookings = yield CacheService_1.CacheService.getOrSetMultiple(cacheKey, this.getVenueBookingRepository(), () => __awaiter(this, void 0, void 0, function* () {
                    const event = yield this.getEventRepository().findOne({ where: { eventId } });
                    if (!event) {
                        throw new Error('Event does not exist.');
                    }
                    return yield this.getVenueBookingRepository()
                        .createQueryBuilder('booking')
                        .leftJoinAndSelect('booking.event', 'event')
                        .leftJoinAndSelect('booking.venue', 'venue')
                        .leftJoinAndSelect('booking.user', 'user')
                        .leftJoinAndSelect('booking.organization', 'organization')
                        .where('booking.eventId = :eventId', { eventId })
                        .orderBy('booking.createdAt', 'DESC')
                        .getMany();
                }), this.CACHE_TTL);
                return {
                    success: true,
                    data: bookings,
                    message: bookings.length ? undefined : 'No bookings found for this event.',
                };
            }
            catch (error) {
                console.error('Error fetching bookings by event ID:', error);
                return {
                    success: false,
                    message: `Failed to get bookings by event ID: ${error instanceof Error ? error.message : 'Unknown error'}`,
                };
            }
        });
    }
    // Get bookings by venue ID
    static getBookingsByVenueId(venueId) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!venueId) {
                return { success: false, message: 'Venue ID is required.' };
            }
            const cacheKey = `${this.CACHE_PREFIX}venue:${venueId}`;
            try {
                const bookings = yield CacheService_1.CacheService.getOrSetMultiple(cacheKey, this.getVenueBookingRepository(), () => __awaiter(this, void 0, void 0, function* () {
                    return yield this.getVenueBookingRepository().find({
                        where: { venueId },
                        relations: ['event', 'venue', 'user', 'organization'],
                        order: { createdAt: 'DESC' },
                    });
                }), this.CACHE_TTL);
                return {
                    success: true,
                    data: bookings,
                    message: bookings.length ? undefined : 'No bookings found for this venue.',
                };
            }
            catch (error) {
                console.error('Error fetching bookings by venue ID:', error);
                return {
                    success: false,
                    message: `Failed to get bookings by venue ID: ${error instanceof Error ? error.message : 'Unknown error'}`,
                };
            }
        });
    }
    // Get bookings by organizer ID
    static getBookingsByOrganizerId(organizerId) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!organizerId) {
                return { success: false, message: 'Organizer ID is required.' };
            }
            const cacheKey = `${this.CACHE_PREFIX}organizer:${organizerId}`;
            try {
                const bookings = yield CacheService_1.CacheService.getOrSetMultiple(cacheKey, this.getVenueBookingRepository(), () => __awaiter(this, void 0, void 0, function* () {
                    return yield this.getVenueBookingRepository().find({
                        where: { userId: organizerId },
                        relations: ['event', 'venue', 'user', 'organization'],
                        order: { createdAt: 'DESC' },
                    });
                }), this.CACHE_TTL);
                return {
                    success: true,
                    data: bookings,
                    message: bookings.length ? undefined : 'No bookings found for this organizer.',
                };
            }
            catch (error) {
                console.error('Error fetching bookings by organizer ID:', error);
                return {
                    success: false,
                    message: `Failed to get bookings by organizer ID: ${error instanceof Error ? error.message : 'Unknown error'}`,
                };
            }
        });
    }
    // Get bookings by organization ID
    static getBookingsByOrganizationId(organizationId) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!organizationId) {
                return { success: false, message: 'Organization ID is required.' };
            }
            const cacheKey = `${this.CACHE_PREFIX}organization:${organizationId}`;
            try {
                const bookings = yield CacheService_1.CacheService.getOrSetMultiple(cacheKey, this.getVenueBookingRepository(), () => __awaiter(this, void 0, void 0, function* () {
                    return yield this.getVenueBookingRepository().find({
                        where: { organizationId },
                        relations: ['event', 'venue', 'user', 'organization'],
                        order: { createdAt: 'DESC' },
                    });
                }), this.CACHE_TTL);
                return {
                    success: true,
                    data: bookings,
                    message: bookings.length ? undefined : 'No bookings found for this organization.',
                };
            }
            catch (error) {
                console.error('Error fetching bookings by organization ID:', error);
                return {
                    success: false,
                    message: `Failed to get bookings by organization ID: ${error instanceof Error ? error.message : 'Unknown error'}`,
                };
            }
        });
    }
    // Get bookings by approval status
    static getBookingsByStatus(approvalStatus) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!Object.values(VenueBooking_1.ApprovalStatus).includes(approvalStatus)) {
                return { success: false, message: 'Invalid approval status.' };
            }
            const cacheKey = `${this.CACHE_PREFIX}status:${approvalStatus}`;
            try {
                const bookings = yield CacheService_1.CacheService.getOrSetMultiple(cacheKey, this.getVenueBookingRepository(), () => __awaiter(this, void 0, void 0, function* () {
                    return yield this.getVenueBookingRepository().find({
                        where: { approvalStatus },
                        relations: ['event', 'venue', 'user', 'organization'],
                        order: { createdAt: 'DESC' },
                    });
                }), this.CACHE_TTL);
                return {
                    success: true,
                    data: bookings,
                    message: bookings.length ? undefined : `No bookings found with status: ${approvalStatus}.`,
                };
            }
            catch (error) {
                console.error('Error fetching bookings by status:', error);
                return {
                    success: false,
                    message: `Failed to get bookings by status: ${error instanceof Error ? error.message : 'Unknown error'}`,
                };
            }
        });
    }
    // Get bookings by date range (based on Event dates)
    static getBookingsByDateRange(startDate, endDate, filterOptions) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
                    return { success: false, message: 'Invalid date format.' };
                }
                if (startDate > endDate) {
                    return { success: false, message: 'Start date cannot be after end date.' };
                }
                const cacheKey = `${this.CACHE_PREFIX}date:${startDate.toISOString()}:${endDate.toISOString()}:${filterOptions.join(',')}`;
                const bookingRepo = this.getVenueBookingRepository();
                const bookings = yield CacheService_1.CacheService.getOrSetMultiple(cacheKey, bookingRepo, () => __awaiter(this, void 0, void 0, function* () {
                    let query = bookingRepo
                        .createQueryBuilder('booking')
                        .leftJoinAndSelect('booking.event', 'event')
                        .leftJoinAndSelect('booking.venue', 'venue')
                        .leftJoinAndSelect('booking.user', 'user')
                        .leftJoinAndSelect('booking.organization', 'organization')
                        .where('event.startDate <= :endDate', { endDate })
                        .andWhere('event.endDate >= :startDate', { startDate });
                    if (filterOptions.includes('min') && !filterOptions.includes('all')) {
                        query.andWhere("EXTRACT(MINUTE FROM event.startTime) >= 0");
                    }
                    if (filterOptions.includes('hours') && !filterOptions.includes('all')) {
                        query.andWhere("EXTRACT(HOUR FROM event.startTime) >= 0");
                    }
                    if (filterOptions.includes('days') && !filterOptions.includes('all')) {
                        query.andWhere("EXTRACT(DAY FROM event.startDate) >= 0");
                    }
                    return yield query.orderBy('booking.createdAt', 'DESC').getMany();
                }), this.CACHE_TTL);
                return {
                    success: true,
                    data: bookings,
                    message: bookings.length ? undefined : 'No bookings found in this date range.',
                };
            }
            catch (error) {
                console.error('Error fetching bookings by date range:', error);
                return {
                    success: false,
                    message: `Failed to get bookings by date range: ${error instanceof Error ? error.message : 'Unknown error'}`,
                };
            }
        });
    }
}
exports.VenueBookingRepository = VenueBookingRepository;
VenueBookingRepository.CACHE_PREFIX = 'booking:';
VenueBookingRepository.CACHE_TTL = 3600; // 1 hour, consistent with VenueRepository
