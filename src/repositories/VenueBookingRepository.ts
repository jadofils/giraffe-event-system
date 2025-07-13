// import { AppDataSource } from "../config/Database";
// import { Repository } from "typeorm";
// import { Event } from "../models/Event";
// import { Organization } from "../models/Organization";
// import { Venue } from "../models/Venue Tables/Venue";
// import { User } from "../models/User";
// import { VenueBookingInterface } from "../interfaces/VenueBookingInterface";
// import { ApprovalStatus, VenueBooking } from "../models/VenueBooking";
// import { CacheService } from "../services/CacheService";
// import { Invoice } from "../models/Invoice";
// import { CheckAbsenceService } from "../services/bookings/CheckAbsenceService";

// export class VenueBookingRepository {
//   private static readonly CACHE_PREFIX = "booking:";
//   private static readonly CACHE_TTL = 3600; // 1 hour, consistent with VenueRepository

//   private static venueBookingRepository: Repository<VenueBooking>;
//   private static eventRepository: Repository<Event>;
//   private static organizationRepository: Repository<Organization>;
//   private static userRepository: Repository<User>;
//   private static venueRepository: Repository<Venue>;

//   // Initialize venue booking repository
//   static getVenueBookingRepository(): Repository<VenueBooking> {
//     if (!this.venueBookingRepository) {
//       if (!AppDataSource.isInitialized) {
//         throw new Error("Database not initialized.");
//       }
//       this.venueBookingRepository = AppDataSource.getRepository(VenueBooking);
//     }
//     return this.venueBookingRepository;
//   }

//   // Initialize event repository
//   static getEventRepository(): Repository<Event> {
//     if (!this.eventRepository) {
//       this.eventRepository = AppDataSource.getRepository(Event);
//     }
//     return this.eventRepository;
//   }

//   // Initialize organization repository
//   static getOrganizationRepository(): Repository<Organization> {
//     if (!this.organizationRepository) {
//       this.organizationRepository = AppDataSource.getRepository(Organization);
//     }
//     return this.organizationRepository;
//   }

//   // Initialize user repository
//   static getUserRepository(): Repository<User> {
//     if (!this.userRepository) {
//       this.userRepository = AppDataSource.getRepository(User);
//     }
//     return this.userRepository;
//   }

//   // Initialize venue repository
//   static getVenueRepository(): Repository<Venue> {
//     if (!this.venueRepository) {
//       this.venueRepository = AppDataSource.getRepository(Venue);
//     }
//     return this.venueRepository;
//   }

//   // Check for duplicate bookings
//   static async checkDuplicateBookings(
//     venueId: string,
//     startDate: Date,
//     endDate: Date,
//     startTime: string | undefined,
//     endTime: string | undefined,
//     excludeBookingId?: string
//   ): Promise<{
//     success: boolean;
//     message?: string;
//     conflicts?: VenueBooking[];
//   }> {
//     try {
//       if (!venueId || !startDate || !endDate) {
//         return {
//           success: false,
//           message: "Venue ID, start date, and end date are required.",
//         };
//       }

//       if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
//         return { success: false, message: "Invalid date format." };
//       }

//       if (startDate > endDate) {
//         return {
//           success: false,
//           message: "Start date cannot be after end date.",
//         };
//       }

//       const bookingRepo = this.getVenueBookingRepository();
//       const query = bookingRepo
//         .createQueryBuilder("booking")
//         .leftJoinAndSelect("booking.event", "event")
//         .where("booking.venueId = :venueId", { venueId })
//         .andWhere("booking.approvalStatus = :status", { status: "approved" })
//         .andWhere(
//           "((event.startDate <= :endDate AND event.endDate >= :startDate) AND " +
//             "((CAST(:startTime AS text) IS NULL AND CAST(:endTime AS text) IS NULL) OR (event.startTime <= CAST(:endTime AS text) AND event.endTime >= CAST(:startTime AS text))))",
//           {
//             startDate,
//             endDate,
//             startTime:
//               typeof startTime === "string"
//                 ? startTime
//                 : startTime
//                 ? String(startTime)
//                 : null,
//             endTime:
//               typeof endTime === "string"
//                 ? endTime
//                 : endTime
//                 ? String(endTime)
//                 : null,
//           }
//         );

//       if (excludeBookingId) {
//         query.andWhere("booking.bookingId != :excludeBookingId", {
//           excludeBookingId,
//         });
//       }

//       const conflicts = await query.getMany();

//       if (conflicts.length > 0) {
//         return {
//           success: false,
//           message: "Conflicting bookings found for the requested period.",
//           conflicts,
//         };
//       }

//       return { success: true, message: "No conflicting bookings found." };
//     } catch (error) {
//       console.error("Error checking duplicate bookings:", error);
//       return {
//         success: false,
//         message: `Failed to check duplicate bookings: ${
//           error instanceof Error ? error.message : "Unknown error"
//         }`,
//       };
//     }
//   }

//   static async createBooking(
//     bookingData: VenueBookingInterface
//   ): Promise<{ success: boolean; message?: string; data?: VenueBooking }> {
//     const queryRunner = AppDataSource.createQueryRunner();
//     await queryRunner.connect();
//     await queryRunner.startTransaction();

//     try {
//       // Validate required fields
//       if (
//         !bookingData.eventId ||
//         !bookingData.venueId ||
//         !bookingData.organizerId ||
//         !bookingData.userId
//       ) {
//         return {
//           success: false,
//           message:
//             "Missing required booking fields: eventId, venueId, organizerId, userId.",
//         };
//       }

//       // Initialize repositories
//       const eventRepo = queryRunner.manager.getRepository(Event);
//       const venueRepo = queryRunner.manager.getRepository(Venue);
//       const userRepo = queryRunner.manager.getRepository(User);
//       const orgRepo = queryRunner.manager.getRepository(Organization);
//       const bookingRepo = queryRunner.manager.getRepository(VenueBooking);
//       const invoiceRepo = queryRunner.manager.getRepository(Invoice);

//       // Fetch related entities
//       const event = await eventRepo.findOne({
//         where: { eventId: bookingData.eventId },
//       });
//       if (!event) return { success: false, message: "Event does not exist." };

//       const venue = await venueRepo.findOne({
//         where: { venueId: bookingData.venueId },
//       });
//       if (!venue) return { success: false, message: "Venue does not exist." };

//       if (event.maxAttendees && event.maxAttendees > venue.capacity) {
//         return {
//           success: false,
//           message: `Venue capacity is insufficient for the expected attendance. Venue capacity: ${venue.capacity}, requested: ${event.maxAttendees}`,
//         };
//       }

//       const user = await userRepo.findOne({
//         where: { userId: bookingData.userId },
//       });
//       if (!user) return { success: false, message: "User does not exist." };

//       const organization = bookingData.organizationId
//         ? await orgRepo.findOne({
//             where: { organizationId: bookingData.organizationId },
//           })
//         : undefined;
//       if (bookingData.organizationId && !organization) {
//         return { success: false, message: "Organization does not exist." };
//       }

//       const invoice = bookingData.venueInvoiceId
//         ? await invoiceRepo.findOne({
//             where: { invoiceId: bookingData.venueInvoiceId },
//           })
//         : undefined;
//       if (bookingData.venueInvoiceId && !invoice) {
//         return { success: false, message: "Invoice does not exist." };
//       }

//       // Check availability and conflicts
//       const req = { user: { userId: bookingData.userId } } as any;
//       const validation = await CheckAbsenceService.validateBooking(
//         req,
//         bookingData
//       );
//       if (!validation.success) {
//         return { success: false, message: validation.message };
//       }

//       // Create booking entity
//       const newBooking = bookingRepo.create({
//         eventId: bookingData.eventId,
//         event: event, // already loaded Event entity
//         venueId: bookingData.venueId,
//         venue: venue, // already loaded Venue entity
//         userId: bookingData.organizerId, // foreign key
//         user: user, // <-- set the user relation
//         organizationId: bookingData.organizationId,
//         venueInvoiceId: bookingData.venueInvoiceId,
//         totalAmountDue: venue.venueVariables,
//         approvalStatus: bookingData.approvalStatus || ApprovalStatus.PENDING,
//         notes: bookingData.notes,
//       });

//       // Save booking
//       const savedBooking = await bookingRepo.save(newBooking);

//       // Sync with event_venues table
//       await queryRunner.query(
//         'INSERT INTO event_venues ("eventId", "venueId") VALUES ($1, $2) ON CONFLICT DO NOTHING',
//         [bookingData.eventId, bookingData.venueId]
//       );

//       // Invalidate caches
//       await CacheService.invalidateMultiple([
//         `${this.CACHE_PREFIX}all`,
//         `${this.CACHE_PREFIX}${savedBooking.bookingId}`,
//         `${this.CACHE_PREFIX}event:${bookingData.eventId}`,
//         `${this.CACHE_PREFIX}venue:${bookingData.venueId}`,
//         `${this.CACHE_PREFIX}organizer:${bookingData.organizerId}`,
//         `${this.CACHE_PREFIX}organization:${bookingData.organizationId || ""}`,
//         `${this.CACHE_PREFIX}status:*`,
//       ]);

//       await queryRunner.commitTransaction();

//       return {
//         success: true,
//         data: savedBooking,
//         message: "Booking created successfully.",
//       };
//     } catch (error) {
//       await queryRunner.rollbackTransaction();
//       console.error("Error creating booking:", error);
//       return {
//         success: false,
//         message: `Failed to create booking: ${
//           error instanceof Error ? error.message : "Unknown error"
//         }`,
//       };
//     } finally {
//       await queryRunner.release();
//     }
//   }
//   // Update a single booking
//   static async updateBooking(
//     id: string,
//     bookingData: Partial<VenueBookingInterface>
//   ): Promise<{ success: boolean; message?: string; data?: VenueBooking }> {
//     const queryRunner = AppDataSource.createQueryRunner();
//     await queryRunner.connect();
//     await queryRunner.startTransaction();

//     try {
//       if (!id) {
//         return { success: false, message: "Booking ID is required." };
//       }

//       const bookingRepo = queryRunner.manager.getRepository(VenueBooking);
//       const existingBooking = await bookingRepo.findOne({
//         where: { bookingId: id },
//         relations: ["event", "venue", "user", "organization"],
//       });

//       if (!existingBooking) {
//         return { success: false, message: "Booking not found." };
//       }

//       // Validate input
//       const validationErrors = VenueBookingInterface.validate(bookingData);
//       if (validationErrors.length > 0) {
//         await queryRunner.rollbackTransaction();
//         return {
//           success: false,
//           message: `Validation errors: ${validationErrors.join(", ")}`,
//         };
//       }

//       // Store old values for cache invalidation
//       const oldEventId = existingBooking.eventId;
//       const oldVenueId = existingBooking.venueId;
//       const oldUserId = existingBooking.userId;
//       const oldOrganizationId = existingBooking.organizationId;
//       const oldApprovalStatus = existingBooking.approvalStatus;

//       // Validate new entities if provided
//       let event = existingBooking.event;
//       if (
//         bookingData.eventId &&
//         bookingData.eventId !== existingBooking.eventId
//       ) {
//         const foundEvent = await queryRunner.manager
//           .getRepository(Event)
//           .findOne({ where: { eventId: bookingData.eventId } });
//         if (!foundEvent) {
//           await queryRunner.rollbackTransaction();
//           return { success: false, message: "Event does not exist." };
//         }
//         event = foundEvent;
//         existingBooking.eventId = bookingData.eventId;
//         existingBooking.event = event;
//       }

//       let venue = existingBooking.venue;
//       if (
//         bookingData.venueId &&
//         bookingData.venueId !== existingBooking.venueId
//       ) {
//         return {
//           success: false,
//           message: "Venue cannot be changed for an existing booking.",
//         };
//       }

//       if (
//         bookingData.organizerId &&
//         bookingData.organizerId !== existingBooking.userId
//       ) {
//         const user = await queryRunner.manager
//           .getRepository(User)
//           .findOne({ where: { userId: bookingData.organizerId } });
//         if (!user) {
//           await queryRunner.rollbackTransaction();
//           return { success: false, message: "Organizer does not exist." };
//         }
//         existingBooking.userId = bookingData.organizerId;
//         existingBooking.user = user;
//       }

//       if (
//         bookingData.organizationId &&
//         bookingData.organizationId !== existingBooking.organizationId
//       ) {
//         const org = await queryRunner.manager
//           .getRepository(Organization)
//           .findOne({ where: { organizationId: bookingData.organizationId } });
//         if (!org) {
//           await queryRunner.rollbackTransaction();
//           return { success: false, message: "Organization does not exist." };
//         }
//         existingBooking.organizationId = bookingData.organizationId;
//         existingBooking.organization = org;
//       }

//       // Validate approval status
//       if (
//         bookingData.approvalStatus &&
//         !Object.values(ApprovalStatus).includes(bookingData.approvalStatus)
//       ) {
//         await queryRunner.rollbackTransaction();
//         return { success: false, message: "Invalid approval status." };
//       }

//       // Check conflicts if eventId or venueId changes
//       if (bookingData.eventId || bookingData.venueId) {
//         const checkEvent = bookingData.eventId ? event : existingBooking.event;
//         const checkVenueId = bookingData.venueId || existingBooking.venueId;
//         const conflictCheck = await this.checkDuplicateBookings(
//           checkVenueId,
//           new Date(checkEvent.startDate),
//           new Date(checkEvent.endDate),
//           checkEvent.startTime,
//           checkEvent.endTime,
//           id
//         );
//         if (!conflictCheck.success) {
//           await queryRunner.rollbackTransaction();
//           return { success: false, message: conflictCheck.message };
//         }
//       }

//       // Merge updates
//       if (bookingData.approvalStatus) {
//         existingBooking.approvalStatus = bookingData.approvalStatus;
//       }
//       if (bookingData.notes !== undefined) {
//         existingBooking.notes = bookingData.notes;
//       }

//       // Save updated booking
//       const updatedBooking = await bookingRepo.save(existingBooking);

//       // Sync with event_venues table if eventId or venueId changed
//       if (bookingData.eventId || bookingData.venueId) {
//         await queryRunner.query(
//           "INSERT INTO event_venues (event_id, venue_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
//           [updatedBooking.eventId, updatedBooking.venueId]
//         );
//         // Optionally remove old event_venues entry
//         if (bookingData.eventId || bookingData.venueId) {
//           await queryRunner.query(
//             "DELETE FROM event_venues WHERE eventId = $1 AND venueId = $2",
//             [oldEventId, oldVenueId]
//           );
//         }
//       }

//       // Invalidate caches
//       await CacheService.invalidateMultiple([
//         `${this.CACHE_PREFIX}all`,
//         `${this.CACHE_PREFIX}${id}`,
//         `${this.CACHE_PREFIX}event:${oldEventId}`,
//         `${this.CACHE_PREFIX}event:${updatedBooking.eventId}`,
//         `${this.CACHE_PREFIX}venue:${oldVenueId}`,
//         `${this.CACHE_PREFIX}venue:${updatedBooking.venueId}`,
//         `${this.CACHE_PREFIX}organizer:${oldUserId}`,
//         `${this.CACHE_PREFIX}organizer:${updatedBooking.userId}`,
//         `${this.CACHE_PREFIX}organization:${oldOrganizationId || ""}`,
//         `${this.CACHE_PREFIX}organization:${
//           updatedBooking.organizationId || ""
//         }`,
//         `${this.CACHE_PREFIX}status:${oldApprovalStatus}`,
//         `${this.CACHE_PREFIX}status:${updatedBooking.approvalStatus}`,
//       ]);

//       await queryRunner.commitTransaction();

//       return {
//         success: true,
//         data: updatedBooking,
//         message: "Booking updated successfully.",
//       };
//     } catch (error) {
//       await queryRunner.rollbackTransaction();
//       console.error("Error updating booking:", error);
//       return {
//         success: false,
//         message: `Failed to update booking: ${
//           error instanceof Error ? error.message : "Unknown error"
//         }`,
//       };
//     } finally {
//       await queryRunner.release();
//     }
//   }
//   // Update booking status
//   static async updateBookingStatus(
//     id: string,
//     status: ApprovalStatus
//   ): Promise<{ success: boolean; message?: string; data?: VenueBooking }> {
//     const queryRunner = AppDataSource.createQueryRunner();
//     await queryRunner.connect();
//     await queryRunner.startTransaction();

//     try {
//       if (!id) {
//         return { success: false, message: "Booking ID is required." };
//       }

//       if (!Object.values(ApprovalStatus).includes(status)) {
//         return { success: false, message: "Invalid approval status." };
//       }

//       const bookingRepo = queryRunner.manager.getRepository(VenueBooking);
//       const existingBooking = await bookingRepo.findOne({
//         where: { bookingId: id },
//         relations: ["event", "venue", "user", "organization"],
//       });

//       if (!existingBooking) {
//         return { success: false, message: "Booking not found." };
//       }

//       const oldStatus = existingBooking.approvalStatus;
//       existingBooking.approvalStatus = status;

//       // Check conflicts if status is changing to approved
//       if (status === ApprovalStatus.APPROVED) {
//         const conflictCheck = await this.checkDuplicateBookings(
//           existingBooking.venueId,
//           new Date(existingBooking.event.startDate),
//           new Date(existingBooking.event.endDate),
//           existingBooking.event.startTime,
//           existingBooking.event.endTime,
//           id
//         );
//         if (!conflictCheck.success) {
//           await queryRunner.rollbackTransaction();
//           return { success: false, message: conflictCheck.message };
//         }
//       }

//       const updatedBooking = await bookingRepo.save(existingBooking);

//       // Invalidate caches
//       await CacheService.invalidateMultiple([
//         `${this.CACHE_PREFIX}all`,
//         `${this.CACHE_PREFIX}${id}`,
//         `${this.CACHE_PREFIX}event:${existingBooking.eventId}`,
//         `${this.CACHE_PREFIX}venue:${existingBooking.venueId}`,
//         `${this.CACHE_PREFIX}organizer:${existingBooking.userId}`,
//         `${this.CACHE_PREFIX}organization:${
//           existingBooking.organizationId || ""
//         }`,
//         `${this.CACHE_PREFIX}status:${oldStatus}`,
//         `${this.CACHE_PREFIX}status:${status}`,
//       ]);

//       await queryRunner.commitTransaction();

//       return {
//         success: true,
//         data: updatedBooking,
//         message: "Booking status updated successfully.",
//       };
//     } catch (error) {
//       await queryRunner.rollbackTransaction();
//       console.error("Error updating booking status:", error);
//       return {
//         success: false,
//         message: `Failed to update booking status: ${
//           error instanceof Error ? error.message : "Unknown error"
//         }`,
//       };
//     } finally {
//       await queryRunner.release();
//     }
//   }

//   // Delete booking
//   static async deleteBooking(
//     id: string
//   ): Promise<{ success: boolean; message?: string }> {
//     const queryRunner = AppDataSource.createQueryRunner();
//     await queryRunner.connect();
//     await queryRunner.startTransaction();

//     try {
//       if (!id) {
//         return { success: false, message: "Booking ID is required." };
//       }

//       const bookingRepo = queryRunner.manager.getRepository(VenueBooking);
//       const existingBooking = await bookingRepo.findOne({
//         where: { bookingId: id },
//         relations: ["event", "venue", "user", "organization"],
//       });

//       if (!existingBooking) {
//         return { success: false, message: "Booking not found." };
//       }

//       await bookingRepo.delete(id);

//       // Remove from event_venues table
//       await queryRunner.query(
//         "DELETE FROM event_venues WHERE eventId = $1 AND venueId = $2",
//         [existingBooking.eventId, existingBooking.venueId]
//       );

//       // Invalidate caches
//       await CacheService.invalidateMultiple([
//         `${this.CACHE_PREFIX}all`,
//         `${this.CACHE_PREFIX}${id}`,
//         `${this.CACHE_PREFIX}event:${existingBooking.eventId}`,
//         `${this.CACHE_PREFIX}venue:${existingBooking.venueId}`,
//         `${this.CACHE_PREFIX}organizer:${existingBooking.userId}`,
//         `${this.CACHE_PREFIX}organization:${
//           existingBooking.organizationId || ""
//         }`,
//         `${this.CACHE_PREFIX}status:${existingBooking.approvalStatus}`,
//       ]);

//       await queryRunner.commitTransaction();

//       return { success: true, message: "Booking deleted successfully." };
//     } catch (error) {
//       await queryRunner.rollbackTransaction();
//       console.error("Error deleting booking:", error);
//       return {
//         success: false,
//         message: `Failed to delete booking: ${
//           error instanceof Error ? error.message : "Unknown error"
//         }`,
//       };
//     } finally {
//       await queryRunner.release();
//     }
//   }

//   // Get total booking amount for an event
//   static async getTotalBookingAmountForEvent(
//     eventId: string
//   ): Promise<{ success: boolean; message?: string; totalAmount?: number }> {
//     try {
//       const bookingRepo = this.getVenueBookingRepository();
//       const result = await bookingRepo
//         .createQueryBuilder("booking")
//         .where("booking.eventId = :eventId", { eventId })
//         .andWhere("booking.approvalStatus = :status", {
//           status: ApprovalStatus.APPROVED,
//         })
//         .select("SUM(booking.totalAmountDue)", "total")
//         .getRawOne();

//       const totalAmount = parseFloat(result?.total || "0");
//       return {
//         success: true,
//         totalAmount,
//         message: `Total booking amount for event ${eventId}: ${totalAmount}`,
//       };
//     } catch (error) {
//       console.error("Error calculating total booking amount:", error);
//       return {
//         success: false,
//         message: `Failed to calculate total: ${
//           error instanceof Error ? error.message : "Unknown error"
//         }`,
//       };
//     }
//   }

//   // Create multiple bookings
//   static async createMultipleBookings(
//     bookingsData: VenueBookingInterface[]
//   ): Promise<{
//     success: boolean;
//     bookings: VenueBooking[];
//     errors: { data: VenueBookingInterface; message: string }[];
//   }> {
//     const queryRunner = AppDataSource.createQueryRunner();
//     await queryRunner.connect();
//     await queryRunner.startTransaction();

//     const bookings: VenueBooking[] = [];
//     const errors: { data: VenueBookingInterface; message: string }[] = [];

//     try {
//       for (const bookingData of bookingsData) {
//         const createResult = await this.createBooking(bookingData);
//         if (createResult.success && createResult.data) {
//           bookings.push(createResult.data);
//         } else {
//           errors.push({
//             data: bookingData,
//             message: createResult.message || "Failed to create booking.",
//           });
//         }
//       }

//       if (errors.length > 0) {
//         await queryRunner.rollbackTransaction();
//         return { success: false, bookings, errors };
//       }

//       await queryRunner.commitTransaction();
//       return { success: true, bookings, errors };
//     } catch (error) {
//       await queryRunner.rollbackTransaction();
//       console.error("Error creating multiple bookings:", error);
//       errors.push({
//         data: {} as VenueBookingInterface,
//         message: `Failed to create bookings: ${
//           error instanceof Error ? error.message : "Unknown error"
//         }`,
//       });
//       return { success: false, bookings, errors };
//     } finally {
//       await queryRunner.release();
//     }
//   }

//   // Get all bookings
//   static async getAllBookings(): Promise<{
//     success: boolean;
//     message?: string;
//     data?: VenueBooking[];
//   }> {
//     const cacheKey = `${this.CACHE_PREFIX}all`;
//     try {
//       const bookings = await CacheService.getOrSetMultiple(
//         cacheKey,
//         this.getVenueBookingRepository(),
//         async () => {
//           return await this.getVenueBookingRepository().find({
//             relations: ["event", "venue", "user", "organization"],
//             order: { createdAt: "DESC" },
//           });
//         },
//         this.CACHE_TTL
//       );

//       return {
//         success: true,
//         data: bookings,
//         message: bookings.length ? undefined : "No bookings found.",
//       };
//     } catch (error) {
//       console.error("Error fetching all bookings:", error);
//       return {
//         success: false,
//         message: `Failed to get all bookings: ${
//           error instanceof Error ? error.message : "Unknown error"
//         }`,
//       };
//     }
//   }

//   // Get booking by ID
//   static async getBookingById(
//     id: string
//   ): Promise<{ success: boolean; message?: string; data?: VenueBooking }> {
//     if (!id) {
//       return { success: false, message: "Booking ID is required." };
//     }

//     const cacheKey = `${this.CACHE_PREFIX}${id}`;
//     try {
//       const booking = await CacheService.getOrSetSingle(
//         cacheKey,
//         this.getVenueBookingRepository(),
//         async () => {
//           return await this.getVenueBookingRepository().findOne({
//             where: { bookingId: id },
//             relations: ["event", "venue", "user", "organization"],
//           });
//         },
//         this.CACHE_TTL
//       );

//       if (!booking) {
//         return { success: false, message: "Booking not found." };
//       }

//       return { success: true, data: booking };
//     } catch (error) {
//       console.error("Error fetching booking by ID:", error);
//       return {
//         success: false,
//         message: `Failed to get booking by ID: ${
//           error instanceof Error ? error.message : "Unknown error"
//         }`,
//       };
//     }
//   }

//   // Get bookings by event ID
//   static async getBookingsByEventId(
//     eventId: string
//   ): Promise<{ success: boolean; message?: string; data?: VenueBooking[] }> {
//     if (!eventId) {
//       return { success: false, message: "Event ID is required." };
//     }

//     const cacheKey = `${this.CACHE_PREFIX}event:${eventId}`;
//     try {
//       const bookings = await CacheService.getOrSetMultiple(
//         cacheKey,
//         this.getVenueBookingRepository(),
//         async () => {
//           const event = await this.getEventRepository().findOne({
//             where: { eventId },
//           });
//           if (!event) {
//             throw new Error("Event does not exist.");
//           }
//           return await this.getVenueBookingRepository()
//             .createQueryBuilder("booking")
//             .leftJoinAndSelect("booking.event", "event")
//             .leftJoinAndSelect("booking.venue", "venue")
//             .leftJoinAndSelect("booking.user", "user")
//             .leftJoinAndSelect("booking.organization", "organization")
//             .where("booking.eventId = :eventId", { eventId })
//             .orderBy("booking.createdAt", "DESC")
//             .getMany();
//         },
//         this.CACHE_TTL
//       );

//       return {
//         success: true,
//         data: bookings,
//         message: bookings.length
//           ? undefined
//           : "No bookings found for this event.",
//       };
//     } catch (error) {
//       console.error("Error fetching bookings by event ID:", error);
//       return {
//         success: false,
//         message: `Failed to get bookings by event ID: ${
//           error instanceof Error ? error.message : "Unknown error"
//         }`,
//       };
//     }
//   }

//   // Get bookings by venue ID
//   static async getBookingsByVenueId(
//     venueId: string
//   ): Promise<{ success: boolean; message?: string; data?: VenueBooking[] }> {
//     if (!venueId) {
//       return { success: false, message: "Venue ID is required." };
//     }

//     const cacheKey = `${this.CACHE_PREFIX}venue:${venueId}`;
//     try {
//       const bookings = await CacheService.getOrSetMultiple(
//         cacheKey,
//         this.getVenueBookingRepository(),
//         async () => {
//           return await this.getVenueBookingRepository().find({
//             where: { venueId },
//             relations: ["event", "venue", "user", "organization"],
//             order: { createdAt: "DESC" },
//           });
//         },
//         this.CACHE_TTL
//       );

//       return {
//         success: true,
//         data: bookings,
//         message: bookings.length
//           ? undefined
//           : "No bookings found for this venue.",
//       };
//     } catch (error) {
//       console.error("Error fetching bookings by venue ID:", error);
//       return {
//         success: false,
//         message: `Failed to get bookings by venue ID: ${
//           error instanceof Error ? error.message : "Unknown error"
//         }`,
//       };
//     }
//   }

//   // Get bookings by organizer ID
//   static async getBookingsByOrganizerId(
//     organizerId: string
//   ): Promise<{ success: boolean; message?: string; data?: VenueBooking[] }> {
//     if (!organizerId) {
//       return { success: false, message: "Organizer ID is required." };
//     }

//     const cacheKey = `${this.CACHE_PREFIX}organizer:${organizerId}`;
//     try {
//       const bookings = await CacheService.getOrSetMultiple(
//         cacheKey,
//         this.getVenueBookingRepository(),
//         async () => {
//           return await this.getVenueBookingRepository().find({
//             where: { userId: organizerId },
//             relations: ["event", "venue", "user", "organization"],
//             order: { createdAt: "DESC" },
//           });
//         },
//         this.CACHE_TTL
//       );

//       return {
//         success: true,
//         data: bookings,
//         message: bookings.length
//           ? undefined
//           : "No bookings found for this organizer.",
//       };
//     } catch (error) {
//       console.error("Error fetching bookings by organizer ID:", error);
//       return {
//         success: false,
//         message: `Failed to get bookings by organizer ID: ${
//           error instanceof Error ? error.message : "Unknown error"
//         }`,
//       };
//     }
//   }

//   // Get bookings by organization ID
//   static async getBookingsByOrganizationId(
//     organizationId: string
//   ): Promise<{ success: boolean; message?: string; data?: VenueBooking[] }> {
//     if (!organizationId) {
//       return { success: false, message: "Organization ID is required." };
//     }

//     const cacheKey = `${this.CACHE_PREFIX}organization:${organizationId}`;
//     try {
//       const bookings = await CacheService.getOrSetMultiple(
//         cacheKey,
//         this.getVenueBookingRepository(),
//         async () => {
//           return await this.getVenueBookingRepository().find({
//             where: { organizationId },
//             relations: ["event", "venue", "user", "organization"],
//             order: { createdAt: "DESC" },
//           });
//         },
//         this.CACHE_TTL
//       );

//       return {
//         success: true,
//         data: bookings,
//         message: bookings.length
//           ? undefined
//           : "No bookings found for this organization.",
//       };
//     } catch (error) {
//       console.error("Error fetching bookings by organization ID:", error);
//       return {
//         success: false,
//         message: `Failed to get bookings by organization ID: ${
//           error instanceof Error ? error.message : "Unknown error"
//         }`,
//       };
//     }
//   }

//   // Get bookings by approval status
//   static async getBookingsByStatus(
//     approvalStatus: ApprovalStatus
//   ): Promise<{ success: boolean; message?: string; data?: VenueBooking[] }> {
//     if (!Object.values(ApprovalStatus).includes(approvalStatus)) {
//       return { success: false, message: "Invalid approval status." };
//     }

//     const cacheKey = `${this.CACHE_PREFIX}status:${approvalStatus}`;
//     try {
//       const bookings = await CacheService.getOrSetMultiple(
//         cacheKey,
//         this.getVenueBookingRepository(),
//         async () => {
//           return await this.getVenueBookingRepository().find({
//             where: { approvalStatus },
//             relations: ["event", "venue", "user", "organization"],
//             order: { createdAt: "DESC" },
//           });
//         },
//         this.CACHE_TTL
//       );

//       return {
//         success: true,
//         data: bookings,
//         message: bookings.length
//           ? undefined
//           : `No bookings found with status: ${approvalStatus}.`,
//       };
//     } catch (error) {
//       console.error("Error fetching bookings by status:", error);
//       return {
//         success: false,
//         message: `Failed to get bookings by status: ${
//           error instanceof Error ? error.message : "Unknown error"
//         }`,
//       };
//     }
//   }

//   // Get bookings by date range (based on Event dates)
//   static async getBookingsByDateRange(
//     startDate: Date,
//     endDate: Date,
//     filterOptions: ("min" | "hours" | "days" | "all")[]
//   ): Promise<{ success: boolean; message?: string; data?: VenueBooking[] }> {
//     try {
//       if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
//         return { success: false, message: "Invalid date format." };
//       }

//       if (startDate > endDate) {
//         return {
//           success: false,
//           message: "Start date cannot be after end date.",
//         };
//       }

//       const cacheKey = `${
//         this.CACHE_PREFIX
//       }date:${startDate.toISOString()}:${endDate.toISOString()}:${filterOptions.join(
//         ","
//       )}`;
//       const bookingRepo = this.getVenueBookingRepository();
//       const bookings = await CacheService.getOrSetMultiple(
//         cacheKey,
//         bookingRepo,
//         async () => {
//           let query = bookingRepo
//             .createQueryBuilder("booking")
//             .leftJoinAndSelect("booking.event", "event")
//             .leftJoinAndSelect("booking.venue", "venue")
//             .leftJoinAndSelect("booking.user", "user")
//             .leftJoinAndSelect("booking.organization", "organization")
//             .where("event.startDate <= :endDate", { endDate })
//             .andWhere("event.endDate >= :startDate", { startDate });

//           if (filterOptions.includes("min") && !filterOptions.includes("all")) {
//             query.andWhere("EXTRACT(MINUTE FROM event.startTime) >= 0");
//           }
//           if (
//             filterOptions.includes("hours") &&
//             !filterOptions.includes("all")
//           ) {
//             query.andWhere("EXTRACT(HOUR FROM event.startTime) >= 0");
//           }
//           if (
//             filterOptions.includes("days") &&
//             !filterOptions.includes("all")
//           ) {
//             query.andWhere("EXTRACT(DAY FROM event.startDate) >= 0");
//           }

//           return await query.orderBy("booking.createdAt", "DESC").getMany();
//         },
//         this.CACHE_TTL
//       );

//       return {
//         success: true,
//         data: bookings,
//         message: bookings.length
//           ? undefined
//           : "No bookings found in this date range.",
//       };
//     } catch (error) {
//       console.error("Error fetching bookings by date range:", error);
//       return {
//         success: false,
//         message: `Failed to get bookings by date range: ${
//           error instanceof Error ? error.message : "Unknown error"
//         }`,
//       };
//     }
//   }
// }
