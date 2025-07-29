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
exports.EventController = void 0;
const EventStatusEnum_1 = require("../interfaces/Enums/EventStatusEnum");
const eventRepository_1 = require("../repositories/eventRepository");
const Database_1 = require("../config/Database");
const Venue_1 = require("../models/Venue Tables/Venue");
const EventGuest_1 = require("../models/Event Tables/EventGuest");
const User_1 = require("../models/User");
const Organization_1 = require("../models/Organization");
const VenueVariable_1 = require("../models/Venue Tables/VenueVariable");
const CacheService_1 = require("../services/CacheService");
const BookingValidationService_1 = require("../services/bookings/BookingValidationService");
const typeorm_1 = require("typeorm");
const VenueBooking_1 = require("../models/VenueBooking");
const Event_1 = require("../models/Event Tables/Event");
const CloudinaryUploadService_1 = require("../services/CloudinaryUploadService");
class EventController {
    static createEvent(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const uploadedCloudinaryUrls = [];
            try {
                if (!req.body) {
                    res.status(400).json({ success: false, message: "No body provided" });
                    return;
                }
                // Defensive destructuring
                const { eventTitle, eventType, dates, description, guests, venues, venueId, // Support both venues and venueId
                visibilityScope, eventOrganizerId, 
                // Public event fields
                maxAttendees, socialMediaLinks, isEntryPaid, expectedGuests, specialNotes, eventPhoto, ignoreTransitionWarnings = false, // New parameter to allow proceeding despite warnings
                 } = req.body;
                // Parse guests and dates if sent as JSON strings (from form-data)
                let parsedGuests = guests;
                if (typeof guests === "string") {
                    try {
                        parsedGuests = JSON.parse(guests);
                    }
                    catch (e) {
                        parsedGuests = [];
                    }
                }
                let parsedDates = dates;
                if (typeof dates === "string") {
                    try {
                        parsedDates = JSON.parse(dates);
                    }
                    catch (e) {
                        parsedDates = [];
                    }
                }
                // Handle Cloudinary upload for public event photo
                let finalEventPhoto = eventPhoto;
                if (visibilityScope === "PUBLIC") {
                    const file = req.file ||
                        (req.files && req.files.eventPhoto);
                    if (file && file.buffer) {
                        const uploadResult = yield CloudinaryUploadService_1.CloudinaryUploadService.uploadBuffer(file.buffer, "events/photos");
                        finalEventPhoto = uploadResult.url;
                        uploadedCloudinaryUrls.push(finalEventPhoto);
                    }
                    else if (Array.isArray(file) && file[0] && file[0].buffer) {
                        const uploadResult = yield CloudinaryUploadService_1.CloudinaryUploadService.uploadBuffer(file[0].buffer, "events/photos");
                        finalEventPhoto = uploadResult.url;
                        uploadedCloudinaryUrls.push(finalEventPhoto);
                    }
                }
                // Handle Cloudinary upload for guest photos (public events only)
                let finalGuests = parsedGuests;
                if (visibilityScope === "PUBLIC" && Array.isArray(parsedGuests)) {
                    finalGuests = yield Promise.all(parsedGuests.map((guest, idx) => __awaiter(this, void 0, void 0, function* () {
                        let guestPhoto = guest.guestPhoto;
                        const guestFiles = req.files && req.files.guestPhotos;
                        if (guestFiles &&
                            Array.isArray(guestFiles) &&
                            guestFiles[idx] &&
                            guestFiles[idx].buffer) {
                            const uploadResult = yield CloudinaryUploadService_1.CloudinaryUploadService.uploadBuffer(guestFiles[idx].buffer, "events/guests");
                            guestPhoto = uploadResult.url;
                            uploadedCloudinaryUrls.push(guestPhoto);
                        }
                        else if (guestPhoto && guestPhoto.buffer) {
                            const uploadResult = yield CloudinaryUploadService_1.CloudinaryUploadService.uploadBuffer(guestPhoto.buffer, "events/guests");
                            guestPhoto = uploadResult.url;
                            uploadedCloudinaryUrls.push(guestPhoto);
                        }
                        return Object.assign(Object.assign({}, guest), { guestPhoto });
                    })));
                }
                // Robustly parse venueId to support both single and multiple venues
                let venueIds = venues || venueId;
                if (typeof venueIds === "string") {
                    try {
                        const parsed = JSON.parse(venueIds);
                        if (Array.isArray(parsed)) {
                            venueIds = parsed;
                        }
                    }
                    catch (_b) {
                        // Not a JSON array, leave as is
                    }
                }
                const venueIdsArray = Array.isArray(venueIds) ? venueIds : [venueIds];
                // Basic validation for required fields
                if (!eventTitle ||
                    !eventType ||
                    !venueIdsArray ||
                    venueIdsArray.length === 0 ||
                    !eventOrganizerId ||
                    !parsedDates ||
                    !description) {
                    res.status(400).json({
                        success: false,
                        message: "Missing required fields: eventTitle, eventType, venues/venueId (array or single), eventOrganizerId, dates, description",
                    });
                    return;
                }
                // Fetch all venues WITH venueVariables and bookingConditions
                const venueRepo = Database_1.AppDataSource.getRepository(Venue_1.Venue);
                const selectedVenues = yield venueRepo.find({
                    where: { venueId: (0, typeorm_1.In)(venueIdsArray) },
                    relations: ["venueVariables", "bookingConditions"],
                });
                if (selectedVenues.length !== venueIdsArray.length) {
                    res
                        .status(404)
                        .json({ success: false, message: "One or more venues not found." });
                    return;
                }
                // Check if all venues belong to the same organization
                const organizationId = selectedVenues[0].organizationId;
                const allSameOrg = selectedVenues.every((venue) => venue.organizationId === organizationId);
                if (!allSameOrg) {
                    res.status(400).json({
                        success: false,
                        message: "All venues must belong to the same organization",
                    });
                    return;
                }
                // Convert dates to BookingDateDTO format based on venue booking types
                let bookingDates;
                const hasHourlyVenue = selectedVenues.some((v) => v.bookingType === "HOURLY");
                if (hasHourlyVenue) {
                    // If any venue is hourly, require hours for all dates
                    if (!Array.isArray(parsedDates) ||
                        !parsedDates.every((d) => d.date && Array.isArray(d.hours))) {
                        res.status(400).json({
                            success: false,
                            message: "When booking hourly venues, each date must include hours array",
                        });
                        return;
                    }
                    bookingDates = parsedDates;
                }
                else {
                    // For daily bookings, accept simple date strings
                    if (!Array.isArray(parsedDates) ||
                        !parsedDates.every((d) => typeof d === "string" || typeof d.date === "string")) {
                        res.status(400).json({
                            success: false,
                            message: "For daily bookings, dates should be an array of date strings",
                        });
                        return;
                    }
                    bookingDates = parsedDates.map((d) => ({
                        date: typeof d === "string" ? d : d.date,
                    }));
                }
                // Track transition time warnings
                const transitionWarnings = [];
                // Validate dates for each venue
                for (const venue of selectedVenues) {
                    try {
                        const validation = yield BookingValidationService_1.BookingValidationService.validateBookingDates(venue, bookingDates);
                        if (!validation.isAvailable) {
                            // If there are only transition warnings and user wants to proceed, continue
                            const hasOnlyTransitionWarnings = validation.unavailableDates.every((d) => d.warningType === "WARNING");
                            if (hasOnlyTransitionWarnings && ignoreTransitionWarnings) {
                                // Collect warnings for response
                                transitionWarnings.push({
                                    venueId: venue.venueId,
                                    venueName: venue.venueName,
                                    warnings: validation.unavailableDates.map((d) => ({
                                        date: d.date,
                                        message: d.reason,
                                    })),
                                });
                            }
                            else {
                                // If there are error-level unavailabilities or user hasn't acknowledged warnings
                                res.status(400).json({
                                    success: false,
                                    message: `Venue ${venue.venueName} has unavailable dates`,
                                    unavailableDates: validation.unavailableDates,
                                    venueId: venue.venueId,
                                    hasTransitionWarnings: validation.hasTransitionTimeWarnings,
                                    transitionWarnings: validation.unavailableDates
                                        .filter((d) => d.warningType === "WARNING")
                                        .map((d) => ({
                                        date: d.date,
                                        message: d.reason,
                                    })),
                                });
                                return;
                            }
                        }
                    }
                    catch (error) {
                        res.status(400).json({
                            success: false,
                            message: error instanceof Error ? error.message : "Validation failed",
                            venueId: venue.venueId,
                        });
                        return;
                    }
                }
                // Determine eventOrganizerType
                let eventOrganizerType = "USER";
                const userRepo = Database_1.AppDataSource.getRepository(User_1.User);
                const orgRepo = Database_1.AppDataSource.getRepository(Organization_1.Organization);
                const user = yield userRepo.findOne({
                    where: { userId: eventOrganizerId },
                });
                if (!user) {
                    const org = yield orgRepo.findOne({
                        where: { organizationId: eventOrganizerId },
                    });
                    if (org) {
                        eventOrganizerType = "ORGANIZATION";
                    }
                    else {
                        res.status(400).json({
                            success: false,
                            message: "Invalid eventOrganizerId: not found as user or organization.",
                        });
                        return;
                    }
                }
                // Set event statuses and fields
                const eventData = {
                    eventName: eventTitle,
                    eventType,
                    eventDescription: description,
                    visibilityScope,
                    eventStatus: EventStatusEnum_1.EventStatus.DRAFTED,
                    publishStatus: "DRAFT",
                    eventOrganizerId,
                    eventOrganizerType,
                };
                // Add fields based on visibility scope
                if (visibilityScope === "PUBLIC") {
                    Object.assign(eventData, {
                        maxAttendees,
                        socialMediaLinks,
                        isEntryPaid,
                        expectedGuests,
                        specialNotes,
                        eventPhoto: finalEventPhoto,
                    });
                }
                // Create events with booking dates for each venue
                const result = yield eventRepository_1.EventRepository.createEventWithRelations(eventData, selectedVenues, visibilityScope === "PUBLIC" && Array.isArray(finalGuests)
                    ? finalGuests
                    : [], bookingDates);
                if (!result.success) {
                    res.status(400).json({ success: false, message: result.message });
                    return;
                }
                // Invalidate cache for all managers of these venues
                const venueVariableRepo = Database_1.AppDataSource.getRepository(VenueVariable_1.VenueVariable);
                const venueVariables = yield venueVariableRepo.find({
                    where: { venue: { venueId: (0, typeorm_1.In)(venueIdsArray) } },
                    relations: ["manager"],
                });
                for (const vv of venueVariables) {
                    if (vv.manager && vv.manager.userId) {
                        yield CacheService_1.CacheService.invalidate(`venue-bookings:manager:${vv.manager.userId}`);
                    }
                }
                res.status(201).json({
                    success: true,
                    data: result.data,
                    message: `Successfully created ${((_a = result.data) === null || _a === void 0 ? void 0 : _a.length) || 0} event(s)`,
                    transitionWarnings: transitionWarnings.length > 0 ? transitionWarnings : undefined,
                });
                return;
            }
            catch (error) {
                // Cleanup uploaded images if event creation fails
                for (const url of uploadedCloudinaryUrls) {
                    try {
                        yield CloudinaryUploadService_1.CloudinaryUploadService.deleteFromCloudinary(url, "image");
                    }
                    catch (e) {
                        // Log and continue
                        console.error("Failed to delete Cloudinary image:", url, e);
                    }
                }
                next(error);
            }
        });
    }
    static getAllEvents(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const result = yield eventRepository_1.EventRepository.getAllEventsWithRelations();
                if (!result.success) {
                    res.status(500).json({ success: false, message: result.message });
                    return;
                }
                // Filter out events with eventStatus 'DRAFTED'
                const filteredEvents = (result.data || []).filter((event) => event.eventStatus !== "DRAFTED");
                res.status(200).json({ success: true, data: filteredEvents });
                return;
            }
            catch (error) {
                next(error);
            }
        });
    }
    static getAllApprovedEvents(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const eventRepo = Database_1.AppDataSource.getRepository(Event_1.Event);
                const userRepo = Database_1.AppDataSource.getRepository(User_1.User);
                const orgRepo = Database_1.AppDataSource.getRepository(Organization_1.Organization);
                const events = yield eventRepo.find({
                    where: { eventStatus: EventStatusEnum_1.EventStatus.APPROVED },
                    relations: ["eventVenues", "eventVenues.venue", "eventGuests"],
                    order: { createdAt: "DESC" },
                });
                const eventsWithOrganizer = yield Promise.all(events.map((event) => __awaiter(this, void 0, void 0, function* () {
                    let organizer = null;
                    if (event.eventOrganizerType === "USER") {
                        organizer = yield userRepo.findOne({
                            where: { userId: event.eventOrganizerId },
                        });
                    }
                    else if (event.eventOrganizerType === "ORGANIZATION") {
                        organizer = yield orgRepo.findOne({
                            where: { organizationId: event.eventOrganizerId },
                        });
                    }
                    return Object.assign(Object.assign({}, event), { organizer });
                })));
                res.status(200).json({ success: true, data: eventsWithOrganizer });
                return;
            }
            catch (error) {
                next(error);
            }
        });
    }
    static getEventById(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const eventRepo = Database_1.AppDataSource.getRepository(Event_1.Event);
                const userRepo = Database_1.AppDataSource.getRepository(User_1.User);
                const orgRepo = Database_1.AppDataSource.getRepository(Organization_1.Organization);
                const event = yield eventRepo.findOne({
                    where: { eventId: req.params.id },
                    relations: ["eventVenues", "eventVenues.venue", "eventGuests"],
                });
                if (!event) {
                    res.status(404).json({ success: false, message: "Event not found" });
                    return;
                }
                let organizer = null;
                if (event.eventOrganizerType === "USER") {
                    organizer = yield userRepo.findOne({
                        where: { userId: event.eventOrganizerId },
                    });
                }
                else if (event.eventOrganizerType === "ORGANIZATION") {
                    organizer = yield orgRepo.findOne({
                        where: { organizationId: event.eventOrganizerId },
                    });
                }
                res.status(200).json({ success: true, data: Object.assign(Object.assign({}, event), { organizer }) });
                return;
            }
            catch (error) {
                next(error);
            }
        });
    }
    static requestPublish(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            const { id } = req.params;
            const eventRepo = Database_1.AppDataSource.getRepository(Event_1.Event);
            const event = yield eventRepo.findOne({
                where: { eventId: id },
                relations: ["venueBookings"],
            });
            if (!event) {
                res.status(404).json({ success: false, message: "Event not found" });
                return;
            }
            if (event.eventStatus === EventStatusEnum_1.EventStatus.REJECTED) {
                res.status(400).json({
                    success: false,
                    message: "Event has been rejected and cannot be requested again.",
                });
                return;
            }
            // Check all venue bookings
            const allApproved = event.venueBookings.every((b) => b.bookingStatus === "APPROVED_NOT_PAID" ||
                b.bookingStatus === "APPROVED_PAID");
            if (!allApproved) {
                res.status(400).json({
                    success: false,
                    message: "All venue bookings must be approved to request publish.",
                });
                return;
            }
            event.eventStatus = EventStatusEnum_1.EventStatus.REQUESTED;
            event.visibilityScope = "PUBLIC";
            event.cancellationReason = undefined;
            yield eventRepo.save(event);
            res.status(200).json({
                success: true,
                data: event,
                message: "Event submitted for publishing/approval.",
            });
            return;
        });
    }
    static queryEvent(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            const { id } = req.params;
            const { cancellationReason } = req.body;
            const eventRepo = Database_1.AppDataSource.getRepository(Event_1.Event);
            const event = yield eventRepo.findOne({ where: { eventId: id } });
            if (!event) {
                res.status(404).json({ success: false, message: "Event not found" });
                return;
            }
            event.eventStatus = EventStatusEnum_1.EventStatus.QUERIED;
            event.cancellationReason = cancellationReason || "No reason provided";
            yield eventRepo.save(event);
            res.status(200).json({
                success: true,
                data: event,
                message: "Event queried for more information.",
            });
            return;
        });
    }
    static rejectEvent(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            const { id } = req.params;
            const { cancellationReason } = req.body;
            const eventRepo = Database_1.AppDataSource.getRepository(Event_1.Event);
            const event = yield eventRepo.findOne({ where: { eventId: id } });
            if (!event) {
                res.status(404).json({ success: false, message: "Event not found" });
                return;
            }
            event.eventStatus = EventStatusEnum_1.EventStatus.REJECTED;
            event.cancellationReason = cancellationReason || "No reason provided";
            yield eventRepo.save(event);
            res.status(200).json({
                success: true,
                data: event,
                message: "Event has been rejected.",
            });
            return;
        });
    }
    static approveEvent(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            const { id } = req.params;
            const eventRepo = Database_1.AppDataSource.getRepository(Event_1.Event);
            const event = yield eventRepo.findOne({ where: { eventId: id } });
            if (!event) {
                res.status(404).json({ success: false, message: "Event not found" });
                return;
            }
            if (event.eventStatus !== EventStatusEnum_1.EventStatus.REQUESTED &&
                event.eventStatus !== EventStatusEnum_1.EventStatus.QUERIED) {
                res.status(400).json({
                    success: false,
                    message: "Only events in REQUESTED or QUERIED status can be approved.",
                });
                return;
            }
            event.eventStatus = EventStatusEnum_1.EventStatus.APPROVED;
            event.cancellationReason = undefined;
            yield eventRepo.save(event);
            res.status(200).json({
                success: true,
                data: event,
                message: "Event has been approved.",
            });
            return;
        });
    }
    //   static async approveEvent(
    //     req: Request,
    //     res: Response,
    //     next: NextFunction
    //   ): Promise<void> {
    //     try {
    //       const { id } = req.params;
    //       // Fetch event with all relations needed
    //       const eventResult = await EventRepository.getById(id);
    //       if (!eventResult.success || !eventResult.data) {
    //         res.status(404).json({ message: eventResult.message });
    //         return;
    //       }
    //       // Approve the event
    //       const updateResult = await EventRepository.update(id, {
    //         status: EventStatus.APPROVED,
    //       });
    //       if (!updateResult.success || !updateResult.data) {
    //         res.status(500).json({ message: updateResult.message });
    //         return;
    //       }
    //       // Refetch event with all relations (including venueBookings, venues, organizer, organization)
    //       const event = (await EventRepository.getById(id)).data!;
    //       // === REJECT/CANCEL CONFLICTING PENDING EVENTS ===
    //       const { rejectConflictingPendingEvents } = await import(
    //         "../middlewares/rejectConflictingPendingEvents"
    //       );
    //       await rejectConflictingPendingEvents(event);
    //       // Eager-load venueBookings with venue, user, organization, and venue.organization
    //       const bookings = await AppDataSource.getRepository(VenueBooking).find({
    //         where: { eventId: id },
    //         relations: ["venue", "venue.organization", "user", "organization"],
    //       });
    //       // Approve all venue bookings for this event
    //       for (const booking of bookings) {
    //         if (booking.approvalStatus !== ApprovalStatus.APPROVED) {
    //           booking.approvalStatus = ApprovalStatus.APPROVED;
    //           await AppDataSource.getRepository(VenueBooking).save(booking);
    //         }
    //       }
    //       // Approve all venues for this event
    //       if (event.venues && event.venues.length > 0) {
    //         const venueRepo = AppDataSource.getRepository("Venue");
    //         for (const venue of event.venues) {
    //           const dbVenue = await venueRepo.findOne({
    //             where: { venueId: venue.venueId },
    //           });
    //           if (dbVenue && dbVenue.status !== VenueStatus.APPROVED) {
    //             dbVenue.status = VenueStatus.APPROVED;
    //             await venueRepo.save(dbVenue);
    //           }
    //         }
    //       }
    //       // Create invoices for each booking (if not already invoiced)
    //       const invoices = [];
    //       for (const booking of bookings) {
    //         // Only create invoice if not already linked
    //         if (!booking.invoice) {
    //           const invoice = await InvoiceService.createInvoice({
    //             userId: booking.userId,
    //             eventId: booking.eventId,
    //             venueId: booking.venueId,
    //             totalAmount: booking.totalAmountDue,
    //             invoiceDate: new Date(),
    //             dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    //             status: InvoiceStatus.PENDING,
    //           });
    //           // Optionally, update booking to reference the invoice
    //           booking.venueInvoiceId = invoice.invoiceId;
    //           await AppDataSource.getRepository(VenueBooking).save(booking);
    //           // Attach details for response
    //           invoices.push({
    //             ...invoice,
    //             venue: {
    //               venueId: booking.venue.venueId,
    //               venueName: booking.venue.venueName,
    //               amount: booking.venue.venueVariables,
    //               location: booking.venue.venueLocation,
    //               organization: booking.venue.organization
    //                 ? {
    //                     organizationId: booking.venue.organization.organizationId,
    //                     organizationName:
    //                       booking.venue.organization.organizationName,
    //                     contactEmail: booking.venue.organization.contactEmail,
    //                     contactPhone: booking.venue.organization.contactPhone,
    //                   }
    //                 : null,
    //             },
    //             requester: booking.user
    //               ? {
    //                   userId: booking.user.userId,
    //                   username: booking.user.username,
    //                   firstName: booking.user.firstName,
    //                   lastName: booking.user.lastName,
    //                   email: booking.user.email,
    //                   phoneNumber: booking.user.phoneNumber,
    //                 }
    //               : null,
    //             bookingOrganization: booking.organization
    //               ? {
    //                   organizationId: booking.organization.organizationId,
    //                   organizationName: booking.organization.organizationName,
    //                   contactEmail: booking.organization.contactEmail,
    //                   contactPhone: booking.organization.contactPhone,
    //                 }
    //               : null,
    //           });
    //         }
    //       }
    //       res.status(200).json({
    //         success: true,
    //         message: "Event approved and invoices generated.",
    //         data: {
    //           event: {
    //             eventId: event.eventId,
    //             eventTitle: event.eventTitle,
    //             startDate: event.startDate,
    //             endDate: event.endDate,
    //             organizer: event.organizer,
    //             organization: event.organization,
    //           },
    //           invoices,
    //         },
    //       });
    //     } catch (error) {
    //       next(error);
    //     }
    //   }
    //   static async getEventById(
    //     req: Request,
    //     res: Response,
    //     next: NextFunction
    //   ): Promise<void> {
    //     try {
    //       const { id } = req.params;
    //       const result = await EventRepository.getById(id);
    //       if (!result.success || !result.data) {
    //         res.status(404).json({ message: result.message });
    //         return;
    //       }
    //       res.json(result.data);
    //     } catch (error) {
    //       next(error);
    //     }
    //   }
    //   static async getAllEvents(
    //     req: Request,
    //     res: Response,
    //     next: NextFunction
    //   ): Promise<void> {
    //     try {
    //       const result = await EventRepository.getAll();
    //       if (!result.success || !result.data) {
    //         res.status(500).json({ message: result.message });
    //         return;
    //       }
    //       res.json(result.data);
    //     } catch (error) {
    //       next(error);
    //     }
    //   }
    //   static async updateEvent(
    //     req: Request,
    //     res: Response,
    //     next: NextFunction
    //   ): Promise<void> {
    //     try {
    //       const { id } = req.params;
    //       const eventData: Partial<EventInterface> = {
    //         ...req.body,
    //         status: EventStatus.PENDING,
    //       };
    //       const updateResult = await EventRepository.update(id, eventData);
    //       if (!updateResult.success || !updateResult.data) {
    //         res.status(500).json({ message: updateResult.message });
    //         return;
    //       }
    //       res.json(updateResult.data);
    //     } catch (error) {
    //       next(error);
    //     }
    //   }
    //   static async deleteEvent(
    //     req: Request,
    //     res: Response,
    //     next: NextFunction
    //   ): Promise<void> {
    //     try {
    //       const { id } = req.params;
    //       const result = await EventRepository.delete(id);
    //       if (!result.success) {
    //         res.status(500).json({ message: result.message });
    //         return;
    //       }
    //       res.json({ message: "Event deleted" });
    //     } catch (error) {
    //       next(error);
    //     }
    //   }
    //   static async bulkCreateVenueBookings(
    //     req: Request,
    //     res: Response,
    //     next: NextFunction
    //   ): Promise<void> {
    //     try {
    //       const { organizationId, bookings } = req.body;
    //       const userId = req.user?.userId; // From AuthMiddleware
    //       const eventId = req.params.eventId;
    //       if (!userId) {
    //         res.status(401).json({
    //           success: false,
    //           message: "Unauthorized: User ID not found in token",
    //         });
    //         return;
    //       }
    //       if (!organizationId) {
    //         res
    //           .status(400)
    //           .json({ success: false, message: "organizationId is required" });
    //         return;
    //       }
    //       if (!Array.isArray(bookings) || bookings.length === 0) {
    //         res
    //           .status(400)
    //           .json({ success: false, message: "Booking array is required" });
    //         return;
    //       }
    //       // Validate venues exist
    //       const venueRepo = AppDataSource.getRepository(Venue);
    //       const venueIds = bookings.map((b) => b.venueId);
    //       const venues = await venueRepo.find({
    //         where: { venueId: In(venueIds) },
    //         relations: ["organization"],
    //       });
    //       if (venues.length !== bookings.length) {
    //         res
    //           .status(404)
    //           .json({ success: false, message: "One or more venues not found" });
    //         return;
    //       }
    //       const result = await EventRepository.bulkCreateVenueBookings(
    //         bookings.map((b) => ({
    //           ...b,
    //           organizationId,
    //           approvalStatus: ApprovalStatus.PENDING,
    //         })),
    //         userId,
    //         eventId,
    //         organizationId
    //       );
    //       if (!result.success) {
    //         res.status(400).json({ success: false, message: result.message });
    //         return;
    //       }
    //       // Format response with full venue data
    //       const formattedBookings = result.data?.map((booking) => ({
    //         bookingId: booking.bookingId,
    //         venue: {
    //           venueId: booking.venue.venueId,
    //           venueName: booking.venue.venueName,
    //           location: booking.venue.venueLocation,
    //           capacity: booking.venue.capacity,
    //           amount: booking.venue.venueVariables,
    //           latitude: booking.venue.latitude,
    //           longitude: booking.venue.longitude,
    //           googleMapsLink: booking.venue.googleMapsLink,
    //           managerId: booking.venue.venueVariables,
    //           organizationId: booking.venue.organizationId,
    //           amenities: booking.venue.amenities,
    //           venueType: booking.venue.venueTypeId,
    //           createdAt: booking.venue.createdAt,
    //           updatedAt: booking.venue.updatedAt,
    //           deletedAt: booking.venue.deletedAt,
    //         },
    //         eventId: booking.eventId,
    //         userId: booking.userId,
    //         organizationId: booking.organizationId,
    //         totalAmountDue: booking.totalAmountDue,
    //         venueInvoiceId: booking.venueInvoiceId,
    //         approvalStatus: booking.approvalStatus,
    //         notes: booking.notes,
    //         createdAt: booking.createdAt,
    //         updatedAt: booking.updatedAt,
    //         deletedAt: booking.deletedAt,
    //       }));
    //       res.status(201).json({
    //         success: true,
    //         message: "Bookings created",
    //         data: formattedBookings,
    //       });
    //     } catch (error) {
    //       console.error("Error in bulkCreateVenueBookings:", error);
    //       next(error);
    //     }
    //   }
    //   static async approveVenueBooking(
    //     req: Request,
    //     res: Response,
    //     next: NextFunction
    //   ): Promise<void> {
    //     try {
    //       const { bookingId } = req.params;
    //       const updateResult = await EventRepository.updateVenueBooking(bookingId, {
    //         approvalStatus: ApprovalStatus.APPROVED,
    //       });
    //       if (!updateResult.success || !updateResult.data) {
    //         res.status(500).json({ message: updateResult.message });
    //         return;
    //       }
    //       res.json(updateResult.data);
    //     } catch (error) {
    //       next(error);
    //     }
    //   }
    //   static async getVenueBookings(
    //     req: Request,
    //     res: Response,
    //     next: NextFunction
    //   ): Promise<void> {
    //     try {
    //       const { eventId } = req.params;
    //       const eventResult = await EventRepository.getById(eventId);
    //       if (!eventResult.success || !eventResult.data) {
    //         res.status(404).json({ message: eventResult.message });
    //         return;
    //       }
    //       res.json(eventResult.data.venueBookings || []);
    //     } catch (error) {
    //       next(error);
    //     }
    //   }
    //   static async updateVenueBooking(
    //     req: Request,
    //     res: Response,
    //     next: NextFunction
    //   ): Promise<void> {
    //     try {
    //       const { bookingId } = req.params;
    //       const bookingData: Partial<VenueBookingInterface> = {
    //         ...req.body,
    //         approvalStatus: ApprovalStatus.PENDING,
    //       };
    //       const updateResult = await EventRepository.updateVenueBooking(
    //         bookingId,
    //         bookingData
    //       );
    //       if (!updateResult.success || !updateResult.data) {
    //         res.status(500).json({ message: updateResult.message });
    //         return;
    //       }
    //       res.json(updateResult.data);
    //     } catch (error) {
    //       next(error);
    //     }
    //   }
    //   static async deleteVenueBooking(
    //     req: Request,
    //     res: Response,
    //     next: NextFunction
    //   ): Promise<void> {
    //     try {
    //       const { eventId, bookingId } = req.params;
    //       const removeResult = await EventRepository.removeVenueBookings(eventId, [
    //         bookingId,
    //       ]);
    //       if (!removeResult.success) {
    //         res.status(500).json({ message: removeResult.message });
    //         return;
    //       }
    //       const deleteResult = await EventRepository.deleteVenueBooking(bookingId);
    //       if (!deleteResult.success) {
    //         res.status(500).json({ message: deleteResult.message });
    //         return;
    //       }
    //       res.json({ message: "Venue booking deleted" });
    //     } catch (error) {
    //       next(error);
    //     }
    //   }
    //   static validate(data: Partial<VenueBookingInterface>): string[] {
    //     const errors: string[] = [];
    //     if (!data.eventId) errors.push("eventId is required");
    //     if (!data.venueId) errors.push("venueId is required");
    //     // organizerId is set from the token, not required in request body
    //     if (!data.organizationId) errors.push("organizationId is required");
    //     return errors;
    //   }
    // }
    // function sanitizeVenue(venue: any) {
    //   if (!venue) return venue;
    //   const { events, ...venueWithoutEvents } = venue;
    //   return venueWithoutEvents;
    // }
    // function sanitizeEvent(event: any) {
    //   if (!event) return event;
    //   // Remove circular references for venues
    //   const sanitizedVenues = event.venues?.map(sanitizeVenue);
    //   return {
    //     ...event,
    //     venues: sanitizedVenues,
    //   };
    // }
    static getGroupPaymentDetails(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                const { groupId } = req.params;
                // Get all events in the group
                const eventRepo = Database_1.AppDataSource.getRepository(Event_1.Event);
                const events = yield eventRepo.find({
                    where: { groupId },
                    relations: [
                        "venueBookings",
                        "venueBookings.venue",
                        "venueBookings.venue.bookingConditions",
                        "venueBookings.venue.venueVariables",
                    ],
                });
                if (!events || events.length === 0) {
                    res.status(404).json({
                        success: false,
                        message: "No events found for this group",
                    });
                    return;
                }
                // Get payer details from the first event (all events in group share same payer)
                let payerDetails = null;
                if (events[0].eventOrganizerType === "USER") {
                    const userRepo = Database_1.AppDataSource.getRepository(User_1.User);
                    const user = yield userRepo.findOne({
                        where: { userId: events[0].eventOrganizerId },
                    });
                    if (user) {
                        payerDetails = {
                            payerId: user.userId,
                            payerType: "USER",
                            firstName: user.firstName,
                            lastName: user.lastName,
                            email: user.email,
                            phoneNumber: user.phoneNumber,
                        };
                    }
                }
                else if (events[0].eventOrganizerType === "ORGANIZATION") {
                    const orgRepo = Database_1.AppDataSource.getRepository(Organization_1.Organization);
                    const organization = yield orgRepo.findOne({
                        where: { organizationId: events[0].eventOrganizerId },
                    });
                    if (organization) {
                        payerDetails = {
                            payerId: organization.organizationId,
                            payerType: "ORGANIZATION",
                            organizationName: organization.organizationName,
                            contactEmail: organization.contactEmail,
                            contactPhone: organization.contactPhone,
                            address: organization.address,
                        };
                    }
                }
                // Calculate totals and prepare booking details
                let totalAmount = 0;
                let totalDepositRequired = 0;
                const bookingDetails = [];
                for (const event of events) {
                    for (const booking of event.venueBookings) {
                        const venue = booking.venue;
                        const bookingCondition = venue.bookingConditions[0];
                        const baseVenueAmount = ((_a = venue.venueVariables[0]) === null || _a === void 0 ? void 0 : _a.venueAmount) || 0;
                        // Calculate total hours across all booking dates
                        const totalHours = booking.bookingDates.reduce((sum, date) => {
                            var _a;
                            return sum + (((_a = date.hours) === null || _a === void 0 ? void 0 : _a.length) || 1); // If no hours specified, count as 1 day
                        }, 0);
                        // Calculate amounts based on venue booking type
                        const venueAmount = venue.bookingType === "HOURLY"
                            ? baseVenueAmount * totalHours
                            : baseVenueAmount;
                        const depositAmount = (bookingCondition === null || bookingCondition === void 0 ? void 0 : bookingCondition.depositRequiredPercent)
                            ? (venueAmount * bookingCondition.depositRequiredPercent) / 100
                            : venueAmount;
                        totalAmount += venueAmount;
                        totalDepositRequired += depositAmount;
                        // Get earliest booking date for this booking
                        const earliestDate = new Date(Math.min(...booking.bookingDates.map((d) => new Date(d.date).getTime())));
                        const paymentDeadline = (bookingCondition === null || bookingCondition === void 0 ? void 0 : bookingCondition.paymentComplementTimeBeforeEvent)
                            ? new Date(earliestDate.getTime() -
                                bookingCondition.paymentComplementTimeBeforeEvent *
                                    24 *
                                    60 *
                                    60 *
                                    1000)
                            : earliestDate;
                        bookingDetails.push({
                            bookingId: booking.bookingId,
                            eventId: event.eventId,
                            eventName: event.eventName,
                            venue: {
                                venueId: venue.venueId,
                                venueName: venue.venueName,
                                bookingType: venue.bookingType,
                                baseAmount: baseVenueAmount,
                                totalHours: totalHours,
                                totalAmount: venueAmount,
                                depositRequired: {
                                    percentage: (bookingCondition === null || bookingCondition === void 0 ? void 0 : bookingCondition.depositRequiredPercent) || 100,
                                    amount: depositAmount,
                                    description: venue.bookingType === "HOURLY"
                                        ? `Initial deposit required to secure the booking (${bookingCondition === null || bookingCondition === void 0 ? void 0 : bookingCondition.depositRequiredPercent}% of total amount for ${totalHours} hours)`
                                        : "Initial deposit required to secure the booking",
                                },
                                paymentCompletionRequired: {
                                    daysBeforeEvent: (bookingCondition === null || bookingCondition === void 0 ? void 0 : bookingCondition.paymentComplementTimeBeforeEvent) || 0,
                                    amount: venueAmount - depositAmount,
                                    deadline: paymentDeadline,
                                    description: `Remaining payment must be completed ${(bookingCondition === null || bookingCondition === void 0 ? void 0 : bookingCondition.paymentComplementTimeBeforeEvent) || 0} days before the event`,
                                },
                                bookingDates: booking.bookingDates,
                                bookingConditions: {
                                    depositRequiredPercent: (bookingCondition === null || bookingCondition === void 0 ? void 0 : bookingCondition.depositRequiredPercent) || 100,
                                    paymentComplementTimeBeforeEvent: (bookingCondition === null || bookingCondition === void 0 ? void 0 : bookingCondition.paymentComplementTimeBeforeEvent) || 0,
                                    description: bookingCondition === null || bookingCondition === void 0 ? void 0 : bookingCondition.descriptionCondition,
                                    notaBene: bookingCondition === null || bookingCondition === void 0 ? void 0 : bookingCondition.notaBene,
                                    transitionTime: bookingCondition === null || bookingCondition === void 0 ? void 0 : bookingCondition.transitionTime,
                                },
                            },
                            paymentSummary: {
                                totalAmount: venueAmount,
                                depositAmount: depositAmount,
                                remainingAmount: venueAmount - depositAmount,
                                bookingStatus: booking.bookingStatus,
                                isPaid: booking.isPaid,
                                pricePerHour: venue.bookingType === "HOURLY" ? baseVenueAmount : null,
                                totalHours: venue.bookingType === "HOURLY" ? totalHours : null,
                            },
                        });
                    }
                }
                res.status(200).json({
                    success: true,
                    data: {
                        groupId,
                        payer: payerDetails,
                        bookings: bookingDetails,
                        groupTotals: {
                            totalAmount,
                            totalDepositRequired,
                            totalRemainingAmount: totalAmount - totalDepositRequired,
                        },
                    },
                });
            }
            catch (error) {
                next(error);
            }
        });
    }
    static getBookingPaymentDetails(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            try {
                const { bookingId } = req.params;
                // Get booking with all necessary relations
                const bookingRepo = Database_1.AppDataSource.getRepository(VenueBooking_1.VenueBooking);
                const booking = yield bookingRepo.findOne({
                    where: { bookingId },
                    relations: [
                        "venue",
                        "venue.bookingConditions",
                        "venue.venueVariables",
                        "event",
                    ],
                });
                if (!booking) {
                    res.status(404).json({
                        success: false,
                        message: "Booking not found",
                    });
                    return;
                }
                // If booking is part of a group, redirect to group payment details
                if ((_a = booking === null || booking === void 0 ? void 0 : booking.event) === null || _a === void 0 ? void 0 : _a.groupId) {
                    res.redirect(`/api/v1/event/group/${booking.event.groupId}/payment-details`);
                    return;
                }
                // Fetch event to determine payer type
                const eventRepo = Database_1.AppDataSource.getRepository(Event_1.Event);
                const eventData = yield eventRepo.findOne({
                    where: { eventId: booking.eventId },
                });
                // Get payer details based on event organizer type
                let payerDetails = null;
                if (eventData) {
                    if (eventData.eventOrganizerType === "USER") {
                        const userRepo = Database_1.AppDataSource.getRepository(User_1.User);
                        const user = yield userRepo.findOne({
                            where: { userId: eventData.eventOrganizerId },
                        });
                        if (user) {
                            payerDetails = {
                                payerId: user.userId,
                                payerType: "USER",
                                firstName: user.firstName,
                                lastName: user.lastName,
                                email: user.email,
                                phoneNumber: user.phoneNumber,
                            };
                        }
                    }
                    else if (eventData.eventOrganizerType === "ORGANIZATION") {
                        const orgRepo = Database_1.AppDataSource.getRepository(Organization_1.Organization);
                        const organization = yield orgRepo.findOne({
                            where: { organizationId: eventData.eventOrganizerId },
                        });
                        if (organization) {
                            payerDetails = {
                                payerId: organization.organizationId,
                                payerType: "ORGANIZATION",
                                organizationName: organization.organizationName,
                                contactEmail: organization.contactEmail,
                                contactPhone: organization.contactPhone,
                                address: organization.address,
                            };
                        }
                    }
                }
                const venue = booking.venue;
                const bookingCondition = venue.bookingConditions[0];
                const baseVenueAmount = ((_b = venue.venueVariables[0]) === null || _b === void 0 ? void 0 : _b.venueAmount) || 0;
                // Calculate total hours across all booking dates
                const totalHours = booking.bookingDates.reduce((sum, date) => {
                    var _a;
                    return sum + (((_a = date.hours) === null || _a === void 0 ? void 0 : _a.length) || 1); // If no hours specified, count as 1 day
                }, 0);
                // Calculate amounts based on venue booking type
                const venueAmount = venue.bookingType === "HOURLY"
                    ? baseVenueAmount * totalHours
                    : baseVenueAmount;
                // Calculate required deposit
                const depositAmount = (bookingCondition === null || bookingCondition === void 0 ? void 0 : bookingCondition.depositRequiredPercent)
                    ? (venueAmount * bookingCondition.depositRequiredPercent) / 100
                    : venueAmount;
                // Get earliest booking date to calculate payment deadline
                const earliestDate = new Date(Math.min(...booking.bookingDates.map((d) => new Date(d.date).getTime())));
                const paymentDeadline = (bookingCondition === null || bookingCondition === void 0 ? void 0 : bookingCondition.paymentComplementTimeBeforeEvent)
                    ? new Date(earliestDate.getTime() -
                        bookingCondition.paymentComplementTimeBeforeEvent *
                            24 *
                            60 *
                            60 *
                            1000)
                    : earliestDate;
                res.status(200).json({
                    success: true,
                    data: {
                        bookingId: booking.bookingId,
                        eventId: eventData === null || eventData === void 0 ? void 0 : eventData.eventId,
                        eventName: eventData === null || eventData === void 0 ? void 0 : eventData.eventName,
                        eventType: eventData === null || eventData === void 0 ? void 0 : eventData.eventType,
                        eventStatus: eventData === null || eventData === void 0 ? void 0 : eventData.eventStatus,
                        payer: payerDetails,
                        venue: {
                            venueId: venue.venueId,
                            venueName: venue.venueName,
                            bookingType: venue.bookingType,
                            baseAmount: baseVenueAmount,
                            totalHours: totalHours,
                            totalAmount: venueAmount,
                            depositRequired: {
                                percentage: (bookingCondition === null || bookingCondition === void 0 ? void 0 : bookingCondition.depositRequiredPercent) || 100,
                                amount: depositAmount,
                                description: venue.bookingType === "HOURLY"
                                    ? `Initial deposit required to secure the booking (${bookingCondition === null || bookingCondition === void 0 ? void 0 : bookingCondition.depositRequiredPercent}% of total amount for ${totalHours} hours)`
                                    : "Initial deposit required to secure the booking",
                            },
                            paymentCompletionRequired: {
                                daysBeforeEvent: (bookingCondition === null || bookingCondition === void 0 ? void 0 : bookingCondition.paymentComplementTimeBeforeEvent) || 0,
                                amount: venueAmount - depositAmount,
                                deadline: paymentDeadline,
                                description: `Remaining payment must be completed ${(bookingCondition === null || bookingCondition === void 0 ? void 0 : bookingCondition.paymentComplementTimeBeforeEvent) || 0} days before the event`,
                            },
                            bookingDates: booking.bookingDates,
                            bookingConditions: {
                                depositRequiredPercent: (bookingCondition === null || bookingCondition === void 0 ? void 0 : bookingCondition.depositRequiredPercent) || 100,
                                paymentComplementTimeBeforeEvent: (bookingCondition === null || bookingCondition === void 0 ? void 0 : bookingCondition.paymentComplementTimeBeforeEvent) || 0,
                                description: bookingCondition === null || bookingCondition === void 0 ? void 0 : bookingCondition.descriptionCondition,
                                notaBene: bookingCondition === null || bookingCondition === void 0 ? void 0 : bookingCondition.notaBene,
                                transitionTime: bookingCondition === null || bookingCondition === void 0 ? void 0 : bookingCondition.transitionTime,
                            },
                        },
                        paymentSummary: {
                            totalAmount: venueAmount,
                            depositAmount: depositAmount,
                            remainingAmount: venueAmount - depositAmount,
                            bookingStatus: booking.bookingStatus,
                            isPaid: booking.isPaid,
                            pricePerHour: venue.bookingType === "HOURLY" ? baseVenueAmount : null,
                            totalHours: venue.bookingType === "HOURLY" ? totalHours : null,
                            paymentHistory: [], // You can add payment history here if needed
                        },
                    },
                });
            }
            catch (error) {
                next(error);
            }
        });
    }
    static getPaymentDetailsForSelectedBookings(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c;
            try {
                const { bookingIds } = req.body;
                if (!Array.isArray(bookingIds) || bookingIds.length === 0) {
                    res.status(400).json({
                        success: false,
                        message: "Please provide an array of booking IDs",
                    });
                    return;
                }
                // Get all bookings with their relations
                const bookingRepo = Database_1.AppDataSource.getRepository(VenueBooking_1.VenueBooking);
                const bookings = yield bookingRepo.find({
                    where: { bookingId: (0, typeorm_1.In)(bookingIds) },
                    relations: [
                        "venue",
                        "venue.bookingConditions",
                        "venue.venueVariables",
                        "event",
                    ],
                });
                if (bookings.length !== bookingIds.length) {
                    res.status(400).json({
                        success: false,
                        message: "One or more booking IDs are invalid",
                    });
                    return;
                }
                // Get payer details from the first booking's event
                const event = bookings[0].event;
                let payerDetails = null;
                if (event) {
                    if (event.eventOrganizerType === "USER") {
                        const userRepo = Database_1.AppDataSource.getRepository(User_1.User);
                        const user = yield userRepo.findOne({
                            where: { userId: event.eventOrganizerId },
                        });
                        if (user) {
                            payerDetails = {
                                payerId: user.userId,
                                payerType: "USER",
                                firstName: user.firstName,
                                lastName: user.lastName,
                                email: user.email,
                                phoneNumber: user.phoneNumber,
                            };
                        }
                    }
                    else if (event.eventOrganizerType === "ORGANIZATION") {
                        const orgRepo = Database_1.AppDataSource.getRepository(Organization_1.Organization);
                        const organization = yield orgRepo.findOne({
                            where: { organizationId: event.eventOrganizerId },
                        });
                        if (organization) {
                            payerDetails = {
                                payerId: organization.organizationId,
                                payerType: "ORGANIZATION",
                                organizationName: organization.organizationName,
                                contactEmail: organization.contactEmail,
                                contactPhone: organization.contactPhone,
                                address: organization.address,
                            };
                        }
                    }
                }
                // Calculate totals and prepare booking details
                let totalAmount = 0;
                let totalDepositRequired = 0;
                const bookingDetails = [];
                for (const booking of bookings) {
                    const venue = booking.venue;
                    const bookingCondition = venue.bookingConditions[0];
                    const baseVenueAmount = ((_a = venue.venueVariables[0]) === null || _a === void 0 ? void 0 : _a.venueAmount) || 0;
                    // Calculate total hours across all booking dates
                    const totalHours = booking.bookingDates.reduce((sum, date) => {
                        var _a;
                        return sum + (((_a = date.hours) === null || _a === void 0 ? void 0 : _a.length) || 1); // If no hours specified, count as 1 day
                    }, 0);
                    // Calculate amounts based on venue booking type
                    const venueAmount = venue.bookingType === "HOURLY"
                        ? baseVenueAmount * totalHours
                        : baseVenueAmount;
                    const depositAmount = (bookingCondition === null || bookingCondition === void 0 ? void 0 : bookingCondition.depositRequiredPercent)
                        ? (venueAmount * bookingCondition.depositRequiredPercent) / 100
                        : venueAmount;
                    totalAmount += venueAmount;
                    totalDepositRequired += depositAmount;
                    // Get earliest booking date for this booking
                    const earliestDate = new Date(Math.min(...booking.bookingDates.map((d) => new Date(d.date).getTime())));
                    const paymentDeadline = (bookingCondition === null || bookingCondition === void 0 ? void 0 : bookingCondition.paymentComplementTimeBeforeEvent)
                        ? new Date(earliestDate.getTime() -
                            bookingCondition.paymentComplementTimeBeforeEvent *
                                24 *
                                60 *
                                60 *
                                1000)
                        : earliestDate;
                    bookingDetails.push({
                        bookingId: booking.bookingId,
                        eventId: (_b = booking.event) === null || _b === void 0 ? void 0 : _b.eventId,
                        eventName: (_c = booking.event) === null || _c === void 0 ? void 0 : _c.eventName,
                        venue: {
                            venueId: venue.venueId,
                            venueName: venue.venueName,
                            bookingType: venue.bookingType,
                            baseAmount: baseVenueAmount,
                            totalHours: totalHours,
                            totalAmount: venueAmount,
                            depositRequired: {
                                percentage: (bookingCondition === null || bookingCondition === void 0 ? void 0 : bookingCondition.depositRequiredPercent) || 100,
                                amount: depositAmount,
                                description: venue.bookingType === "HOURLY"
                                    ? `Initial deposit required to secure the booking (${bookingCondition === null || bookingCondition === void 0 ? void 0 : bookingCondition.depositRequiredPercent}% of total amount for ${totalHours} hours)`
                                    : "Initial deposit required to secure the booking",
                            },
                            paymentCompletionRequired: {
                                daysBeforeEvent: (bookingCondition === null || bookingCondition === void 0 ? void 0 : bookingCondition.paymentComplementTimeBeforeEvent) || 0,
                                amount: venueAmount - depositAmount,
                                deadline: paymentDeadline,
                                description: `Remaining payment must be completed ${(bookingCondition === null || bookingCondition === void 0 ? void 0 : bookingCondition.paymentComplementTimeBeforeEvent) || 0} days before the event`,
                            },
                            bookingDates: booking.bookingDates,
                            bookingConditions: {
                                depositRequiredPercent: (bookingCondition === null || bookingCondition === void 0 ? void 0 : bookingCondition.depositRequiredPercent) || 100,
                                paymentComplementTimeBeforeEvent: (bookingCondition === null || bookingCondition === void 0 ? void 0 : bookingCondition.paymentComplementTimeBeforeEvent) || 0,
                                description: bookingCondition === null || bookingCondition === void 0 ? void 0 : bookingCondition.descriptionCondition,
                                notaBene: bookingCondition === null || bookingCondition === void 0 ? void 0 : bookingCondition.notaBene,
                                transitionTime: bookingCondition === null || bookingCondition === void 0 ? void 0 : bookingCondition.transitionTime,
                            },
                        },
                        paymentSummary: {
                            totalAmount: venueAmount,
                            depositAmount: depositAmount,
                            remainingAmount: venueAmount - depositAmount,
                            bookingStatus: booking.bookingStatus,
                            isPaid: booking.isPaid,
                            pricePerHour: venue.bookingType === "HOURLY" ? baseVenueAmount : null,
                            totalHours: venue.bookingType === "HOURLY" ? totalHours : null,
                        },
                    });
                }
                res.status(200).json({
                    success: true,
                    data: {
                        payer: payerDetails,
                        bookings: bookingDetails,
                        totals: {
                            totalAmount,
                            totalDepositRequired,
                            totalRemainingAmount: totalAmount - totalDepositRequired,
                        },
                        paymentInstructions: {
                            description: "Please make payment to secure your bookings",
                            depositDeadline: new Date(Math.min(...bookings.map((b) => new Date(Math.min(...b.bookingDates.map((d) => new Date(d.date).getTime()))).getTime()))),
                            paymentMethods: ["CARD", "BANK_TRANSFER", "MOBILE_MONEY"],
                        },
                    },
                });
            }
            catch (error) {
                next(error);
            }
        });
    }
    static updateEventTextFields(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            const { id } = req.params;
            const updateFields = req.body;
            try {
                const eventRepo = Database_1.AppDataSource.getRepository(Event_1.Event);
                const event = yield eventRepo.findOne({ where: { eventId: id } });
                if (!event) {
                    res.status(404).json({ success: false, message: "Event not found" });
                    return;
                }
                // Only update allowed text fields (not guests, eventPhoto, guestPhotos, dates)
                const forbiddenFields = [
                    "guests",
                    "eventPhoto",
                    "guestPhotos",
                    "dates",
                    "bookingDates",
                ];
                for (const key of Object.keys(updateFields)) {
                    if (!forbiddenFields.includes(key)) {
                        event[key] = updateFields[key];
                    }
                }
                yield eventRepo.save(event);
                res.status(200).json({ success: true, data: event });
            }
            catch (error) {
                res.status(500).json({
                    success: false,
                    message: error instanceof Error ? error.message : "Failed to update event.",
                });
            }
        });
    }
    static updateEventDates(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const { id } = req.params;
            let { dates } = req.body;
            if (typeof dates === "string") {
                try {
                    dates = JSON.parse(dates);
                }
                catch (_b) {
                    dates = [];
                }
            }
            if (!Array.isArray(dates) || dates.length === 0) {
                res.status(400).json({ success: false, message: "No dates provided" });
                return;
            }
            // Find event and booking
            const eventRepo = Database_1.AppDataSource.getRepository(Event_1.Event);
            const event = yield eventRepo.findOne({
                where: { eventId: id },
                relations: ["venueBookings", "eventVenues"],
            });
            if (!event) {
                res.status(404).json({ success: false, message: "Event not found" });
                return;
            }
            // Assume one booking per event for simplicity
            const booking = (_a = event.venueBookings) === null || _a === void 0 ? void 0 : _a[0];
            if (!booking) {
                res.status(404).json({ success: false, message: "Booking not found" });
                return;
            }
            if (booking.bookingStatus !== "PENDING") {
                res.status(400).json({
                    success: false,
                    message: "Booking must be in PENDING status to update dates",
                });
                return;
            }
            // Validate new dates for the venue
            const venueId = booking.venueId;
            const venueRepo = Database_1.AppDataSource.getRepository(Venue_1.Venue);
            const venue = yield venueRepo.findOne({ where: { venueId } });
            if (!venue) {
                res.status(404).json({ success: false, message: "Venue not found" });
                return;
            }
            // Use BookingValidationService to check date availability
            const validation = yield BookingValidationService_1.BookingValidationService.validateBookingDates(venue, dates);
            if (!validation.isAvailable) {
                res.status(400).json({
                    success: false,
                    message: "Selected dates are not available for this venue",
                    unavailableDates: validation.unavailableDates,
                });
                return;
            }
            // Update event and booking dates
            event.bookingDates = dates;
            booking.bookingDates = dates;
            yield eventRepo.save(event);
            yield Database_1.AppDataSource.getRepository(VenueBooking_1.VenueBooking).save(booking);
            res.status(200).json({ success: true, data: { event, booking } });
            return;
        });
    }
    static addEventGuest(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const { eventId } = req.params;
            const { guestName } = req.body;
            try {
                const eventRepo = Database_1.AppDataSource.getRepository(Event_1.Event);
                const event = yield eventRepo.findOne({
                    where: { eventId },
                    relations: ["eventGuests"],
                });
                if (!event) {
                    res.status(404).json({ success: false, message: "Event not found" });
                    return;
                }
                if ((((_a = event.eventGuests) === null || _a === void 0 ? void 0 : _a.length) || 0) >= 5) {
                    res.status(400).json({
                        success: false,
                        message: "Maximum of 5 guests allowed per event.",
                    });
                    return;
                }
                let guestPhotoUrl = undefined;
                const file = req.file;
                if (file && file.buffer) {
                    const uploadResult = yield CloudinaryUploadService_1.CloudinaryUploadService.uploadBuffer(file.buffer, "events/guests");
                    guestPhotoUrl = uploadResult.url;
                }
                const guestRepo = Database_1.AppDataSource.getRepository(EventGuest_1.EventGuest);
                const newGuest = guestRepo.create({
                    eventId,
                    guestName,
                    guestPhoto: guestPhotoUrl,
                });
                yield guestRepo.save(newGuest);
                res.status(201).json({ success: true, data: newGuest });
            }
            catch (error) {
                res.status(500).json({
                    success: false,
                    message: error instanceof Error ? error.message : "Failed to add guest.",
                });
            }
        });
    }
    static updateEventGuestName(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            const { eventId, guestId } = req.params;
            const { guestName } = req.body;
            try {
                const guestRepo = Database_1.AppDataSource.getRepository(EventGuest_1.EventGuest);
                const guest = yield guestRepo.findOne({
                    where: { id: guestId, eventId },
                });
                if (!guest) {
                    res.status(404).json({ success: false, message: "Guest not found" });
                    return;
                }
                guest.guestName = guestName;
                yield guestRepo.save(guest);
                res.status(200).json({ success: true, data: guest });
            }
            catch (error) {
                res.status(500).json({
                    success: false,
                    message: error instanceof Error
                        ? error.message
                        : "Failed to update guest name.",
                });
            }
        });
    }
    static deleteEventGuest(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            const { eventId, guestId } = req.params;
            try {
                const guestRepo = Database_1.AppDataSource.getRepository(EventGuest_1.EventGuest);
                const guest = yield guestRepo.findOne({
                    where: { id: guestId, eventId },
                });
                if (!guest) {
                    res.status(404).json({ success: false, message: "Guest not found" });
                    return;
                }
                // Delete guest photo from Cloudinary if exists
                if (guest.guestPhoto) {
                    try {
                        yield CloudinaryUploadService_1.CloudinaryUploadService.deleteFromCloudinary(guest.guestPhoto, "image");
                    }
                    catch (e) {
                        // Log and continue
                        console.error("Failed to delete guest photo from Cloudinary:", guest.guestPhoto, e);
                    }
                }
                yield guestRepo.remove(guest);
                res.status(200).json({ success: true, message: "Guest deleted." });
            }
            catch (error) {
                res.status(500).json({
                    success: false,
                    message: error instanceof Error ? error.message : "Failed to delete guest.",
                });
            }
        });
    }
    static updateEventGuestPhoto(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            const { eventId, guestId } = req.params;
            try {
                const guestRepo = Database_1.AppDataSource.getRepository(EventGuest_1.EventGuest);
                const guest = yield guestRepo.findOne({
                    where: { id: guestId, eventId },
                });
                if (!guest) {
                    res.status(404).json({ success: false, message: "Guest not found" });
                    return;
                }
                // Delete old photo from Cloudinary if exists
                if (guest.guestPhoto) {
                    try {
                        yield CloudinaryUploadService_1.CloudinaryUploadService.deleteFromCloudinary(guest.guestPhoto, "image");
                    }
                    catch (e) {
                        console.error("Failed to delete old guest photo from Cloudinary:", guest.guestPhoto, e);
                    }
                }
                // Upload new photo
                const file = req.file;
                if (file && file.buffer) {
                    const uploadResult = yield CloudinaryUploadService_1.CloudinaryUploadService.uploadBuffer(file.buffer, "events/guests");
                    guest.guestPhoto = uploadResult.url;
                }
                yield guestRepo.save(guest);
                res.status(200).json({ success: true, data: guest });
            }
            catch (error) {
                res.status(500).json({
                    success: false,
                    message: error instanceof Error
                        ? error.message
                        : "Failed to update guest photo.",
                });
            }
        });
    }
    static getEventsByUserId(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            const { userId } = req.params;
            try {
                const eventRepo = Database_1.AppDataSource.getRepository(Event_1.Event);
                const events = yield eventRepo.find({
                    where: { eventOrganizerId: userId },
                    relations: ["venueBookings", "venueBookings.venue"],
                    order: { createdAt: "DESC" },
                });
                res.status(200).json({ success: true, data: events });
            }
            catch (error) {
                res.status(500).json({
                    success: false,
                    message: error instanceof Error
                        ? error.message
                        : "Failed to fetch events by user.",
                });
            }
        });
    }
    static createEventForExternalUser(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            try {
                // Parse new structure: { client: {...}, event: {...} }
                const { client, event } = req.body;
                if (!client || !event) {
                    res.status(400).json({
                        success: false,
                        message: "Missing 'client' or 'event' object in request body.",
                    });
                    return;
                }
                const { firstName, lastName, email, phoneNumber } = client;
                if (!firstName || !lastName || !email || !phoneNumber) {
                    res.status(400).json({
                        success: false,
                        message: "Missing user info: firstName, lastName, email, phoneNumber are required.",
                    });
                    return;
                }
                // Fetch the GUEST role for new users
                const userRepo = Database_1.AppDataSource.getRepository(User_1.User);
                const roleRepository = Database_1.AppDataSource.getRepository(require("../models/Role").Role);
                const guestRole = yield roleRepository.findOne({
                    where: { roleName: "GUEST" },
                });
                if (!guestRole) {
                    res.status(500).json({
                        success: false,
                        message: "Default GUEST role not found. Please initialize roles.",
                    });
                    return;
                }
                let user = yield userRepo.findOne({
                    where: [{ email }, { phoneNumber }],
                });
                if (!user) {
                    const randomPassword = Math.random().toString(36).slice(-8);
                    // Generate a username from email or name
                    let username = email
                        ? email.split("@")[0]
                        : `${firstName}.${lastName}`.toLowerCase().replace(/\s+/g, "");
                    // Ensure username is unique
                    let usernameCandidate = username;
                    let counter = 1;
                    while (yield userRepo.findOne({ where: { username: usernameCandidate } })) {
                        usernameCandidate = `${username}${Math.floor(Math.random() * 10000)}`;
                        counter++;
                        if (counter > 5)
                            break; // avoid infinite loop
                    }
                    username = usernameCandidate;
                    user = userRepo.create({
                        username,
                        firstName,
                        lastName,
                        email,
                        phoneNumber,
                        password: randomPassword, // You may want to hash this in a real system
                        roleId: guestRole.roleId,
                    });
                    yield userRepo.save(user);
                }
                // Only use allowed event fields for PRIVATE event
                const { eventTitle, eventType, description, venueId, dates } = event;
                if (!eventTitle || !eventType || !venueId || !dates || !description) {
                    res.status(400).json({
                        success: false,
                        message: "Missing required event fields: eventTitle, eventType, venueId, dates, description",
                    });
                    return;
                }
                // Prepare venueIds array
                let venueIdsArray = Array.isArray(venueId) ? venueId : [venueId];
                // Fetch venues
                const venueRepo = Database_1.AppDataSource.getRepository(Venue_1.Venue);
                const selectedVenues = yield venueRepo.find({
                    where: { venueId: (0, typeorm_1.In)(venueIdsArray) },
                    relations: ["venueVariables", "bookingConditions"],
                });
                if (selectedVenues.length !== venueIdsArray.length) {
                    res
                        .status(404)
                        .json({ success: false, message: "One or more venues not found." });
                    return;
                }
                // Check all venues belong to same org
                const organizationId = selectedVenues[0].organizationId;
                const allSameOrg = selectedVenues.every((venue) => venue.organizationId === organizationId);
                if (!allSameOrg) {
                    res.status(400).json({
                        success: false,
                        message: "All venues must belong to the same organization",
                    });
                    return;
                }
                // Dates validation (reuse logic)
                let bookingDates;
                const hasHourlyVenue = selectedVenues.some((v) => v.bookingType === "HOURLY");
                if (hasHourlyVenue) {
                    if (!Array.isArray(dates) ||
                        !dates.every((d) => d.date && Array.isArray(d.hours))) {
                        res.status(400).json({
                            success: false,
                            message: "When booking hourly venues, each date must include hours array",
                        });
                        return;
                    }
                    bookingDates = dates;
                }
                else {
                    if (!Array.isArray(dates) ||
                        !dates.every((d) => typeof d === "string" || typeof d.date === "string")) {
                        res.status(400).json({
                            success: false,
                            message: "For daily bookings, dates should be an array of date strings",
                        });
                        return;
                    }
                    bookingDates = dates.map((d) => ({
                        date: typeof d === "string" ? d : d.date,
                    }));
                }
                // Validate dates for each venue
                for (const venue of selectedVenues) {
                    const validation = yield BookingValidationService_1.BookingValidationService.validateBookingDates(venue, bookingDates);
                    if (!validation.isAvailable) {
                        res.status(400).json({
                            success: false,
                            message: `Venue ${venue.venueName} has unavailable dates`,
                            unavailableDates: validation.unavailableDates,
                            venueId: venue.venueId,
                        });
                        return;
                    }
                }
                // Build event data
                const eventData = {
                    eventName: eventTitle,
                    eventType,
                    eventDescription: description,
                    visibilityScope: "PRIVATE",
                    eventStatus: EventStatusEnum_1.EventStatus.DRAFTED,
                    publishStatus: "DRAFT",
                    eventOrganizerId: user.userId,
                    eventOrganizerType: "USER",
                };
                // Create event(s)
                const result = yield eventRepository_1.EventRepository.createEventWithRelations(eventData, selectedVenues, [], // No guests for private event
                bookingDates);
                if (!result.success) {
                    res.status(400).json({ success: false, message: result.message });
                    return;
                }
                // Approve all created bookings
                const VenueBookingRepository = require("../repositories/VenueBookingRepository").VenueBookingRepository;
                const approvalResults = [];
                for (const created of (_a = result.data) !== null && _a !== void 0 ? _a : []) {
                    const bookingId = created.venueBooking.bookingId;
                    const approval = yield VenueBookingRepository.approveBookingWithTransition(bookingId);
                    approvalResults.push(Object.assign({ bookingId }, approval));
                    if (!approval.success) {
                        res
                            .status(500)
                            .json({
                            success: false,
                            message: `Failed to approve booking ${bookingId}: ${approval.message}`,
                        });
                        return;
                    }
                }
                res.status(201).json({
                    success: true,
                    user: {
                        userId: user.userId,
                        firstName: user.firstName,
                        lastName: user.lastName,
                        email: user.email,
                        phoneNumber: user.phoneNumber,
                    },
                    event: (_b = result.data) !== null && _b !== void 0 ? _b : [],
                    bookingApprovals: approvalResults,
                    message: `Successfully created PRIVATE event(s) for user and approved booking(s)`,
                });
            }
            catch (error) {
                next(error);
            }
        });
    }
}
exports.EventController = EventController;
EventController.eventRepository = new eventRepository_1.EventRepository();
