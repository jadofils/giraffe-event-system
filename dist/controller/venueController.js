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
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.VenueController = void 0;
const cloudinary_1 = __importDefault(require("../config/cloudinary"));
const Venue_1 = require("../models/Venue Tables/Venue");
const Database_1 = require("../config/Database");
const VenueAmenities_1 = require("../models/Venue Tables/VenueAmenities");
const BookingCondition_1 = require("../models/Venue Tables/BookingCondition");
const VenueVariable_1 = require("../models/Venue Tables/VenueVariable");
const CloudinaryUploadService_1 = require("../services/CloudinaryUploadService");
const typeorm_1 = require("typeorm");
const Organization_1 = require("../models/Organization");
const User_1 = require("../models/User");
class VenueController {
    static create(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            // Only allow ADMIN or VENUE_MANAGER to create a venue
            const authenticatedReq = req;
            const userRoles = ((_a = authenticatedReq.user) === null || _a === void 0 ? void 0 : _a.roles) || [];
            const isAdmin = userRoles.some((r) => (r.roleName || r) === "ADMIN");
            const isVenueManager = userRoles.some((r) => (r.roleName || r) === "VENUE_MANAGER");
            if (!isAdmin && !isVenueManager) {
                res.status(403).json({
                    success: false,
                    message: "Only ADMIN or VENUE_MANAGER can create a venue.",
                });
                return;
            }
            const data = req.body;
            const organizationIdFromUser = (_b = authenticatedReq.user) === null || _b === void 0 ? void 0 : _b.organizationId;
            // Set status based on creator role
            let status;
            if (isAdmin) {
                status = Venue_1.VenueStatus.APPROVED;
            }
            else if (isVenueManager) {
                status = Venue_1.VenueStatus.PENDING;
            }
            else {
                status = Venue_1.VenueStatus.PENDING;
            }
            // Parse JSON fields if sent as strings (multipart/form-data)
            let venueAmenities = data.venueAmenities;
            if (typeof venueAmenities === "string") {
                try {
                    venueAmenities = JSON.parse(venueAmenities);
                }
                catch (e) {
                    res.status(400).json({
                        success: false,
                        message: "venueAmenities must be a valid JSON array.",
                    });
                    return;
                }
            }
            let bookingConditions = data.bookingConditions;
            if (typeof bookingConditions === "string") {
                try {
                    bookingConditions = JSON.parse(bookingConditions);
                }
                catch (e) {
                    res.status(400).json({
                        success: false,
                        message: "bookingConditions must be a valid JSON array.",
                    });
                    return;
                }
            }
            let venueVariable = data.venueVariable;
            if (typeof venueVariable === "string") {
                try {
                    venueVariable = JSON.parse(venueVariable);
                }
                catch (e) {
                    res.status(400).json({
                        success: false,
                        message: "venueVariable must be a valid JSON object.",
                    });
                    return;
                }
            }
            // Validate organizationId
            const organizationId = data.organizationId || organizationIdFromUser;
            if (!organizationId) {
                res
                    .status(400)
                    .json({ success: false, message: "organizationId is required" });
                return;
            }
            // Check if organization is APPROVED and not 'Independent'
            const orgRepo = Database_1.AppDataSource.getRepository(Organization_1.Organization);
            const organization = yield orgRepo.findOne({ where: { organizationId } });
            if (!organization) {
                res
                    .status(404)
                    .json({ success: false, message: "Organization not found." });
                return;
            }
            if (organization.status !== "APPROVED") {
                res.status(403).json({
                    success: false,
                    message: "Only APPROVED organizations can create venues.",
                });
                return;
            }
            if (organization.organizationName === "Independent") {
                res.status(403).json({
                    success: false,
                    message: "The 'Independent' organization cannot create venues.",
                });
                return;
            }
            // Prevent duplication for managers: check for existing venue with same name/location/org
            const venueRepo = Database_1.AppDataSource.getRepository(Venue_1.Venue);
            const existingVenue = yield venueRepo.findOne({
                where: {
                    venueName: data.venueName,
                    venueLocation: data.venueLocation,
                    organizationId: organizationId,
                },
                withDeleted: true,
            });
            if ((isVenueManager || isAdmin) && existingVenue) {
                // If rejected, allow update and set to pending (manager) or approved (admin)
                if (existingVenue.status === Venue_1.VenueStatus.REJECTED) {
                    // Update fields
                    existingVenue.capacity = data.capacity;
                    existingVenue.latitude = data.latitude;
                    existingVenue.longitude = data.longitude;
                    existingVenue.googleMapsLink = data.googleMapsLink;
                    existingVenue.venueTypeId = data.venueTypeId;
                    existingVenue.mainPhotoUrl = data.mainPhotoUrl;
                    existingVenue.photoGallery = data.photoGallery;
                    existingVenue.virtualTourUrl = data.virtualTourUrl;
                    existingVenue.venueDocuments = data.venueDocuments;
                    existingVenue.cancellationReason = undefined;
                    if (isAdmin) {
                        existingVenue.status = Venue_1.VenueStatus.APPROVED;
                    }
                    else {
                        existingVenue.status = Venue_1.VenueStatus.PENDING;
                    }
                    yield venueRepo.save(existingVenue);
                    res.status(200).json({
                        success: true,
                        venueId: existingVenue.venueId,
                        message: `Venue updated and set to ${isAdmin ? "approved" : "pending"} for review.`,
                    });
                    return;
                }
                else {
                    // Prevent duplicate
                    res.status(409).json({
                        success: false,
                        message: "Venue with the same name and location already exists for this organization.",
                    });
                    return;
                }
            }
            // Handle file uploads
            const files = req.files || {};
            try {
                // 1. Main Photo (required)
                let mainPhotoUrl = data.mainPhotoUrl;
                if (files.mainPhoto && files.mainPhoto[0]) {
                    const mainPhoto = files.mainPhoto[0];
                    const result = yield CloudinaryUploadService_1.CloudinaryUploadService.uploadBuffer(mainPhoto.buffer, "venues/main_photos");
                    mainPhotoUrl = result.url;
                }
                else if (!mainPhotoUrl) {
                    res.status(400).json({
                        success: false,
                        message: "Main photo is required (mainPhoto file or mainPhotoUrl).",
                    });
                    return;
                }
                // 2. Photo Gallery (optional, array)
                let photoGallery = Array.isArray(data.photoGallery)
                    ? data.photoGallery
                    : data.photoGallery
                        ? [data.photoGallery]
                        : [];
                if (files.photoGallery && Array.isArray(files.photoGallery)) {
                    for (const file of files.photoGallery) {
                        const result = yield CloudinaryUploadService_1.CloudinaryUploadService.uploadBuffer(file.buffer, "venues/gallery");
                        photoGallery.push(result.url);
                    }
                }
                // 3. Virtual Tour (optional, must be video)
                let virtualTourUrl = data.virtualTourUrl;
                if (files.virtualTour && files.virtualTour[0]) {
                    const virtualTour = files.virtualTour[0];
                    // Only allow video MIME types
                    if (!virtualTour.mimetype.startsWith("video/")) {
                        res.status(400).json({
                            success: false,
                            message: "Virtual tour must be a video file.",
                        });
                        return;
                    }
                    // Cloudinary supports up to 100MB for video by default (unsigned), but check 50MB for safety
                    if (virtualTour.size > 50 * 1024 * 1024) {
                        res.status(400).json({
                            success: false,
                            message: "Virtual tour video must not exceed 50MB.",
                        });
                        return;
                    }
                    const result = yield CloudinaryUploadService_1.CloudinaryUploadService.uploadBuffer(virtualTour.buffer, "venues/virtual_tours");
                    virtualTourUrl = result.url;
                }
                const bcRepo = Database_1.AppDataSource.getRepository(BookingCondition_1.BookingCondition);
                const vvRepo = Database_1.AppDataSource.getRepository(VenueVariable_1.VenueVariable);
                const vaRepo = Database_1.AppDataSource.getRepository(VenueAmenities_1.VenueAmenities);
                const queryRunner = Database_1.AppDataSource.createQueryRunner();
                yield queryRunner.connect();
                yield queryRunner.startTransaction();
                try {
                    const { bookingConditions: _ignoreBC, venueVariable: _ignoreVV, venueAmenities: _ignoreVA, status: _ignoreStatus, // ignore status from request
                    bookingType } = data, venueFields = __rest(data, ["bookingConditions", "venueVariable", "venueAmenities", "status", "bookingType"]);
                    // 1. Save Venue (no venueAmenitiesId)
                    const venue = venueRepo.create(Object.assign(Object.assign({}, venueFields), { organizationId,
                        mainPhotoUrl,
                        photoGallery,
                        virtualTourUrl,
                        status, bookingType: typeof bookingType === "string"
                            ? Venue_1.BookingType[bookingType]
                            : bookingType }));
                    yield queryRunner.manager.save(venue);
                    // 2. Save all VenueAmenities, linking to the created venue
                    if (venueAmenities && venueAmenities.length > 0) {
                        for (const amenity of venueAmenities) {
                            const venueAmenity = vaRepo.create(Object.assign(Object.assign({}, amenity), { venue }));
                            yield queryRunner.manager.save(venueAmenity);
                        }
                    }
                    // 3. Save Booking Conditions
                    if (bookingConditions && bookingConditions.length > 0) {
                        for (const bc of bookingConditions) {
                            const bookingCondition = bcRepo.create(Object.assign(Object.assign({}, bc), { venue }));
                            yield queryRunner.manager.save(bookingCondition);
                        }
                    }
                    // 4. Save Venue Variable
                    if (venueVariable) {
                        // Fetch the manager user entity by ID
                        const userRepo = Database_1.AppDataSource.getRepository("User");
                        const manager = yield userRepo.findOne({
                            where: { userId: venueVariable.venueManagerId },
                        });
                        if (!manager)
                            throw new Error("Manager user not found");
                        const { venueManagerId } = venueVariable, restVenueVariable = __rest(venueVariable, ["venueManagerId"]);
                        const venueVariableEntity = vvRepo.create(Object.assign(Object.assign({}, restVenueVariable), { venue,
                            manager }));
                        yield queryRunner.manager.save(venueVariableEntity);
                    }
                    yield queryRunner.commitTransaction();
                    res.status(201).json({ success: true, venueId: venue.venueId });
                }
                catch (err) {
                    yield queryRunner.rollbackTransaction();
                    res.status(500).json({
                        success: false,
                        message: "Failed to create venue",
                        error: err instanceof Error ? err.message : err,
                    });
                }
                finally {
                    yield queryRunner.release();
                }
            }
            catch (err) {
                res.status(500).json({
                    success: false,
                    message: "File upload failed",
                    error: err instanceof Error ? err.message : err,
                });
            }
        });
    }
    // GET /venues/:id
    static getVenueById(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            const { id } = req.params;
            if (!id) {
                res
                    .status(400)
                    .json({ success: false, message: "Venue ID is required." });
                return;
            }
            try {
                const venueRepo = Database_1.AppDataSource.getRepository(Venue_1.Venue);
                const venue = yield venueRepo.findOne({
                    where: { venueId: id },
                    relations: [
                        "amenities",
                        "availabilitySlots",
                        "bookingConditions",
                        "venueVariables",
                        "venueVariables.manager",
                    ],
                });
                if (!venue) {
                    res.status(404).json({ success: false, message: "Venue not found." });
                    return;
                }
                res.status(200).json({ success: true, data: venue });
            }
            catch (err) {
                res.status(500).json({
                    success: false,
                    message: "Server error",
                    error: err instanceof Error ? err.message : err,
                });
            }
        });
    }
    // GET /organizations/:organizationId/venues
    static getVenuesByOrganization(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            const { organizationId } = req.params;
            if (!organizationId) {
                res
                    .status(400)
                    .json({ success: false, message: "Organization ID is required." });
                return;
            }
            try {
                const venueRepo = Database_1.AppDataSource.getRepository(Venue_1.Venue);
                const venues = yield venueRepo.find({
                    where: { organizationId },
                    relations: [
                        "amenities",
                        "availabilitySlots",
                        "bookingConditions",
                        "venueVariables",
                    ],
                });
                res.status(200).json({ success: true, data: venues });
            }
            catch (err) {
                res.status(500).json({
                    success: false,
                    message: "Server error",
                    error: err instanceof Error ? err.message : err,
                });
            }
        });
    }
    // GET /managers/:managerId/venues
    static getVenuesByManager(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            const { managerId } = req.params;
            if (!managerId) {
                res
                    .status(400)
                    .json({ success: false, message: "Manager ID is required." });
                return;
            }
            try {
                // Find all VenueVariables for this manager, then get their venues
                const vvRepo = Database_1.AppDataSource.getRepository(VenueVariable_1.VenueVariable);
                const venueVariables = yield vvRepo.find({
                    where: { manager: { userId: managerId } },
                    relations: ["venue"],
                });
                const venueIds = venueVariables.map((vv) => vv.venue.venueId);
                if (!venueIds.length) {
                    res.status(200).json({ success: true, data: [] });
                    return;
                }
                const venueRepo = Database_1.AppDataSource.getRepository(Venue_1.Venue);
                const venues = yield venueRepo.find({
                    where: { venueId: (0, typeorm_1.In)(venueIds) },
                    relations: [
                        "amenities",
                        "availabilitySlots",
                        "bookingConditions",
                        "venueVariables",
                    ],
                });
                res.status(200).json({ success: true, data: venues });
            }
            catch (err) {
                res.status(500).json({
                    success: false,
                    message: "Server error",
                    error: err instanceof Error ? err.message : err,
                });
            }
        });
    }
    static approveVenue(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const authenticatedReq = req;
            const userRoles = ((_a = authenticatedReq.user) === null || _a === void 0 ? void 0 : _a.roles) || [];
            const isAdmin = userRoles.some((r) => (r.roleName || r) === "ADMIN");
            if (!isAdmin) {
                res
                    .status(403)
                    .json({ success: false, message: "Only ADMIN can approve venues." });
                return;
            }
            const { id } = req.params;
            if (!id) {
                res
                    .status(400)
                    .json({ success: false, message: "Venue ID is required." });
                return;
            }
            try {
                const venueRepo = Database_1.AppDataSource.getRepository(Venue_1.Venue);
                const venue = yield venueRepo.findOne({ where: { venueId: id } });
                if (!venue) {
                    res.status(404).json({ success: false, message: "Venue not found." });
                    return;
                }
                venue.status = Venue_1.VenueStatus.APPROVED;
                venue.cancellationReason = undefined;
                yield venueRepo.save(venue);
                res.status(200).json({ success: true, data: venue });
            }
            catch (err) {
                res.status(500).json({
                    success: false,
                    message: "Failed to approve venue",
                    error: err instanceof Error ? err.message : err,
                });
            }
        });
    }
    static approveVenuePublic(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            const authenticatedReq = req;
            const user = authenticatedReq.user;
            const userRoles = (user === null || user === void 0 ? void 0 : user.roles) || [];
            const isAdmin = userRoles.some((r) => (r.roleName || r) === "ADMIN");
            const isManager = userRoles.some((r) => (r.roleName || r) === "VENUE_MANAGER");
            const { id } = req.params;
            if (!id) {
                res
                    .status(400)
                    .json({ success: false, message: "Venue ID is required." });
                return;
            }
            try {
                const venueRepo = Database_1.AppDataSource.getRepository(Venue_1.Venue);
                const venue = yield venueRepo.findOne({ where: { venueId: id } });
                if (!venue) {
                    res.status(404).json({ success: false, message: "Venue not found." });
                    return;
                }
                // Only allow if status is APPROVED or APPROVE_PUBLIC
                if (venue.status !== Venue_1.VenueStatus.APPROVED &&
                    venue.status !== Venue_1.VenueStatus.APPROVE_PUBLIC) {
                    res.status(400).json({
                        success: false,
                        message: "Venue must be in APPROVED or APPROVE_PUBLIC status to change public approval.",
                    });
                    return;
                }
                // Only admin or the manager of the venue can do this
                let isVenueManager = false;
                if (isManager) {
                    // Find the VenueVariable for this venue and check manager
                    const vvRepo = Database_1.AppDataSource.getRepository(VenueVariable_1.VenueVariable);
                    const venueVariable = yield vvRepo.findOne({
                        where: { venue: { venueId: id } },
                        relations: ["manager"],
                    });
                    if (venueVariable &&
                        venueVariable.manager &&
                        venueVariable.manager.userId === (user === null || user === void 0 ? void 0 : user.userId)) {
                        isVenueManager = true;
                    }
                }
                if (!isAdmin && !isVenueManager) {
                    res.status(403).json({
                        success: false,
                        message: "Only ADMIN or the venue's manager can approve/unapprove for public.",
                    });
                    return;
                }
                // Toggle status
                if (venue.status === Venue_1.VenueStatus.APPROVED) {
                    venue.status = Venue_1.VenueStatus.APPROVE_PUBLIC;
                }
                else if (venue.status === Venue_1.VenueStatus.APPROVE_PUBLIC) {
                    venue.status = Venue_1.VenueStatus.APPROVED;
                }
                venue.cancellationReason = undefined;
                yield venueRepo.save(venue);
                res.status(200).json({ success: true, data: venue });
            }
            catch (err) {
                res.status(500).json({
                    success: false,
                    message: "Failed to change public approval status for venue",
                    error: err instanceof Error ? err.message : err,
                });
            }
        });
    }
    static rejectVenue(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const authenticatedReq = req;
            const userRoles = ((_a = authenticatedReq.user) === null || _a === void 0 ? void 0 : _a.roles) || [];
            const isAdmin = userRoles.some((r) => (r.roleName || r) === "ADMIN");
            if (!isAdmin) {
                res
                    .status(403)
                    .json({ success: false, message: "Only ADMIN can reject venues." });
                return;
            }
            const { id } = req.params;
            const { cancellationReason } = req.body;
            if (!id) {
                res
                    .status(400)
                    .json({ success: false, message: "Venue ID is required." });
                return;
            }
            if (!cancellationReason) {
                res.status(400).json({
                    success: false,
                    message: "cancellationReason is required to reject a venue.",
                });
                return;
            }
            try {
                const venueRepo = Database_1.AppDataSource.getRepository(Venue_1.Venue);
                const venue = yield venueRepo.findOne({ where: { venueId: id } });
                if (!venue) {
                    res.status(404).json({ success: false, message: "Venue not found." });
                    return;
                }
                venue.status = Venue_1.VenueStatus.REJECTED;
                venue.cancellationReason = cancellationReason;
                yield venueRepo.save(venue);
                res.status(200).json({ success: true, data: venue });
            }
            catch (err) {
                res.status(500).json({
                    success: false,
                    message: "Failed to reject venue",
                    error: err instanceof Error ? err.message : err,
                });
            }
        });
    }
    // --- Modular GET/UPDATE endpoints for venue amenities, booking conditions, variables ---
    static getVenueAmenities(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            const { venueId } = req.params;
            if (!venueId) {
                res.status(400).json({ success: false, message: "venueId is required" });
                return;
            }
            try {
                const venueRepo = Database_1.AppDataSource.getRepository(Venue_1.Venue);
                const venue = yield venueRepo.findOne({
                    where: { venueId },
                    relations: ["amenities"],
                });
                if (!venue) {
                    res.status(404).json({ success: false, message: "Venue not found" });
                    return;
                }
                res.status(200).json({ success: true, data: venue.amenities });
            }
            catch (err) {
                res.status(500).json({
                    success: false,
                    message: "Failed to get amenities",
                    error: err instanceof Error ? err.message : err,
                });
            }
        });
    }
    static getVenueBookingConditions(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            const { venueId } = req.params;
            if (!venueId) {
                res.status(400).json({ success: false, message: "venueId is required" });
                return;
            }
            try {
                const venueRepo = Database_1.AppDataSource.getRepository(Venue_1.Venue);
                const venue = yield venueRepo.findOne({
                    where: { venueId },
                    relations: ["bookingConditions"],
                });
                if (!venue) {
                    res.status(404).json({ success: false, message: "Venue not found" });
                    return;
                }
                res.status(200).json({ success: true, data: venue.bookingConditions });
            }
            catch (err) {
                res.status(500).json({
                    success: false,
                    message: "Failed to get booking conditions",
                    error: err instanceof Error ? err.message : err,
                });
            }
        });
    }
    static getVenueVariables(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            const { venueId } = req.params;
            if (!venueId) {
                res.status(400).json({ success: false, message: "venueId is required" });
                return;
            }
            try {
                const venueRepo = Database_1.AppDataSource.getRepository(Venue_1.Venue);
                const venue = yield venueRepo.findOne({
                    where: { venueId },
                    relations: ["venueVariables", "venueVariables.manager"],
                });
                if (!venue) {
                    res.status(404).json({ success: false, message: "Venue not found" });
                    return;
                }
                res.status(200).json({ success: true, data: venue.venueVariables });
            }
            catch (err) {
                res.status(500).json({
                    success: false,
                    message: "Failed to get venue variables",
                    error: err instanceof Error ? err.message : err,
                });
            }
        });
    }
    static getVenueAmenityById(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            const { venueId, amenityId } = req.params;
            if (!venueId || !amenityId) {
                res.status(400).json({
                    success: false,
                    message: "venueId and amenityId are required",
                });
                return;
            }
            try {
                const vaRepo = Database_1.AppDataSource.getRepository(VenueAmenities_1.VenueAmenities);
                const amenity = yield vaRepo.findOne({
                    where: { id: amenityId },
                    relations: ["venue"],
                });
                if (!amenity || !amenity.venue || amenity.venue.venueId !== venueId) {
                    res.status(404).json({
                        success: false,
                        message: "Amenity not found for this venue",
                    });
                    return;
                }
                res.status(200).json({ success: true, data: amenity });
            }
            catch (err) {
                res.status(500).json({
                    success: false,
                    message: "Failed to get amenity",
                    error: err instanceof Error ? err.message : err,
                });
            }
        });
    }
    static getVenueBookingConditionById(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            const { venueId, conditionId } = req.params;
            if (!venueId || !conditionId) {
                res.status(400).json({
                    success: false,
                    message: "venueId and conditionId are required",
                });
                return;
            }
            try {
                const bcRepo = Database_1.AppDataSource.getRepository(BookingCondition_1.BookingCondition);
                const condition = yield bcRepo.findOne({
                    where: { id: conditionId },
                    relations: ["venue"],
                });
                if (!condition ||
                    !condition.venue ||
                    condition.venue.venueId !== venueId) {
                    res.status(404).json({
                        success: false,
                        message: "Booking condition not found for this venue",
                    });
                    return;
                }
                // Exclude the venue property from the response
                const { venue } = condition, conditionData = __rest(condition, ["venue"]);
                res.status(200).json({ success: true, data: conditionData });
            }
            catch (err) {
                res.status(500).json({
                    success: false,
                    message: "Failed to get booking condition",
                    error: err instanceof Error ? err.message : err,
                });
            }
        });
    }
    static updateVenueBookingConditionById(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            const { venueId, conditionId } = req.params;
            if (!venueId || !conditionId) {
                res.status(400).json({
                    success: false,
                    message: "venueId and conditionId are required",
                });
                return;
            }
            try {
                const bcRepo = Database_1.AppDataSource.getRepository(BookingCondition_1.BookingCondition);
                const condition = yield bcRepo.findOne({
                    where: { id: conditionId },
                    relations: ["venue"],
                });
                if (!condition ||
                    !condition.venue ||
                    condition.venue.venueId !== venueId) {
                    res.status(404).json({
                        success: false,
                        message: "Booking condition not found for this venue",
                    });
                    return;
                }
                // Update fields from req.body
                const { descriptionCondition, notaBene, transitionTime, depositRequiredPercent, depositRequiredTime, paymentComplementTimeBeforeEvent, } = req.body;
                if (descriptionCondition !== undefined)
                    condition.descriptionCondition = descriptionCondition;
                if (notaBene !== undefined)
                    condition.notaBene = notaBene;
                if (transitionTime !== undefined)
                    condition.transitionTime = transitionTime;
                if (depositRequiredPercent !== undefined)
                    condition.depositRequiredPercent = depositRequiredPercent;
                if (depositRequiredTime !== undefined)
                    condition.depositRequiredTime = depositRequiredTime;
                if (paymentComplementTimeBeforeEvent !== undefined)
                    condition.paymentComplementTimeBeforeEvent =
                        paymentComplementTimeBeforeEvent;
                yield bcRepo.save(condition);
                // Exclude the venue property from the response
                const { venue } = condition, conditionData = __rest(condition, ["venue"]);
                res.status(200).json({ success: true, data: conditionData });
            }
            catch (err) {
                res.status(500).json({
                    success: false,
                    message: "Failed to update booking condition",
                    error: err instanceof Error ? err.message : err,
                });
            }
        });
    }
    static getVenueVariableById(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            const { venueId, variableId } = req.params;
            if (!venueId || !variableId) {
                res.status(400).json({
                    success: false,
                    message: "venueId and variableId are required",
                });
                return;
            }
            try {
                const vvRepo = Database_1.AppDataSource.getRepository(VenueVariable_1.VenueVariable);
                const variable = yield vvRepo.findOne({
                    where: { id: variableId },
                    relations: ["venue", "manager"],
                });
                if (!variable || !variable.venue || variable.venue.venueId !== venueId) {
                    res.status(404).json({
                        success: false,
                        message: "Venue variable not found for this venue",
                    });
                    return;
                }
                res.status(200).json({ success: true, data: variable });
            }
            catch (err) {
                res.status(500).json({
                    success: false,
                    message: "Failed to get venue variable",
                    error: err instanceof Error ? err.message : err,
                });
            }
        });
    }
    static updateVenueAmenities(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            res.status(501).json({ success: false, message: "Not implemented" });
        });
    }
    static updateVenueBookingConditions(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            res.status(501).json({ success: false, message: "Not implemented" });
        });
    }
    static updateVenueVariables(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            res.status(501).json({ success: false, message: "Not implemented" });
        });
    }
    static updateVenueAmenityById(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            const { venueId, amenityId } = req.params;
            if (!venueId || !amenityId) {
                res.status(400).json({
                    success: false,
                    message: "venueId and amenityId are required",
                });
                return;
            }
            try {
                const vaRepo = Database_1.AppDataSource.getRepository(VenueAmenities_1.VenueAmenities);
                const amenity = yield vaRepo.findOne({
                    where: { id: amenityId },
                    relations: ["venue"],
                });
                if (!amenity) {
                    res.status(404).json({ success: false, message: "Amenity not found" });
                    return;
                }
                if (!amenity.venue || amenity.venue.venueId !== venueId) {
                    res.status(400).json({
                        success: false,
                        message: "Amenity does not belong to the specified venue",
                    });
                    return;
                }
                // Update fields from req.body
                const { resourceName, quantity, amenitiesDescription, costPerUnit } = req.body;
                if (resourceName !== undefined)
                    amenity.resourceName = resourceName;
                if (quantity !== undefined)
                    amenity.quantity = quantity;
                if (amenitiesDescription !== undefined)
                    amenity.amenitiesDescription = amenitiesDescription;
                if (costPerUnit !== undefined)
                    amenity.costPerUnit = costPerUnit;
                yield vaRepo.save(amenity);
                res.status(200).json({ success: true, data: amenity });
            }
            catch (err) {
                res.status(500).json({
                    success: false,
                    message: "Failed to update amenity",
                    error: err instanceof Error ? err.message : err,
                });
            }
        });
    }
    static updateVenueVariableById(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            const { venueId, variableId } = req.params;
            const { venueAmount, amount, venueManagerId, managerId } = req.body;
            if (!venueId || !variableId) {
                res.status(400).json({
                    success: false,
                    message: "venueId and variableId are required",
                });
                return;
            }
            try {
                const vvRepo = Database_1.AppDataSource.getRepository(VenueVariable_1.VenueVariable);
                const venueVariable = yield vvRepo.findOne({
                    where: { id: variableId, venue: { venueId } },
                    relations: ["venue", "manager"],
                });
                if (!venueVariable) {
                    res
                        .status(404)
                        .json({ success: false, message: "Venue variable not found" });
                    return;
                }
                // Update amount/venueAmount
                if (venueAmount !== undefined)
                    venueVariable.venueAmount = Number(venueAmount);
                if (amount !== undefined)
                    venueVariable.venueAmount = Number(amount);
                // Update manager if provided
                const newManagerId = venueManagerId || managerId;
                if (newManagerId) {
                    const userRepo = Database_1.AppDataSource.getRepository(User_1.User);
                    const manager = yield userRepo.findOne({
                        where: { userId: newManagerId },
                        relations: ["role"],
                    });
                    if (!manager) {
                        res
                            .status(404)
                            .json({ success: false, message: "Manager not found" });
                        return;
                    }
                    // Check if user has VENUE_MANAGER role
                    const hasVenueManagerRole = manager.role &&
                        (manager.role.roleName || manager.role) === "VENUE_MANAGER";
                    if (!hasVenueManagerRole) {
                        res.status(400).json({
                            success: false,
                            message: "User is not a VENUE_MANAGER and cannot be assigned as manager.",
                        });
                        return;
                    }
                    venueVariable.manager = manager;
                }
                yield vvRepo.save(venueVariable);
                res.status(200).json({ success: true, data: venueVariable });
            }
            catch (err) {
                res.status(500).json({
                    success: false,
                    message: "Failed to update venue variable",
                    error: err instanceof Error ? err.message : err,
                });
            }
        });
    }
    static addVenueAmenity(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            const { venueId } = req.params;
            if (!venueId) {
                res.status(400).json({ success: false, message: "venueId is required" });
                return;
            }
            let amenities = req.body;
            // If sent as string (from form-data), parse
            if (typeof amenities === "string") {
                try {
                    amenities = JSON.parse(amenities);
                }
                catch (e) {
                    res.status(400).json({
                        success: false,
                        message: "amenities must be a valid JSON object or array.",
                    });
                    return;
                }
            }
            // If not array, wrap as array
            if (!Array.isArray(amenities)) {
                amenities = [amenities];
            }
            try {
                const venueRepo = Database_1.AppDataSource.getRepository(Venue_1.Venue);
                const vaRepo = Database_1.AppDataSource.getRepository(VenueAmenities_1.VenueAmenities);
                const venue = yield venueRepo.findOne({
                    where: { venueId },
                    relations: ["amenities"],
                });
                if (!venue) {
                    res.status(404).json({ success: false, message: "Venue not found" });
                    return;
                }
                // Prevent duplicate resourceName (case-insensitive, trimmed)
                const existingNames = new Set((venue.amenities || []).map((a) => a.resourceName.trim().toLowerCase()));
                const toAdd = amenities.filter((a) => a &&
                    a.resourceName &&
                    !existingNames.has(a.resourceName.trim().toLowerCase()));
                const skipped = amenities.filter((a) => {
                    var _a;
                    return !a ||
                        !a.resourceName ||
                        existingNames.has((_a = a.resourceName) === null || _a === void 0 ? void 0 : _a.trim().toLowerCase());
                });
                const created = [];
                for (const amenity of toAdd) {
                    const venueAmenity = vaRepo.create(Object.assign(Object.assign({}, amenity), { venue }));
                    created.push(yield vaRepo.save(venueAmenity));
                }
                if (created.length === 1 && skipped.length === 0) {
                    res.status(201).json({ success: true, data: created[0] });
                }
                else {
                    res.status(201).json({ success: true, added: created, skipped });
                }
            }
            catch (err) {
                res.status(500).json({
                    success: false,
                    message: "Failed to add amenity",
                    error: err instanceof Error ? err.message : err,
                });
            }
        });
    }
    static removeVenueAmenity(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            const { venueId, amenityId } = req.params;
            if (!venueId || !amenityId) {
                res.status(400).json({
                    success: false,
                    message: "venueId and amenityId are required",
                });
                return;
            }
            try {
                const vaRepo = Database_1.AppDataSource.getRepository(VenueAmenities_1.VenueAmenities);
                const amenity = yield vaRepo.findOne({
                    where: { id: amenityId },
                    relations: ["venue"],
                });
                if (!amenity) {
                    res.status(404).json({ success: false, message: "Amenity not found" });
                    return;
                }
                if (!amenity.venue || amenity.venue.venueId !== venueId) {
                    res.status(400).json({
                        success: false,
                        message: "Amenity does not belong to the specified venue",
                    });
                    return;
                }
                yield vaRepo.softRemove(amenity);
                res
                    .status(200)
                    .json({ success: true, message: "Amenity removed from venue" });
            }
            catch (err) {
                res.status(500).json({
                    success: false,
                    message: "Failed to remove amenity",
                    error: err instanceof Error ? err.message : err,
                });
            }
        });
    }
    static addVenueResources(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            const { venueId } = req.params;
            const resources = req.body.resources;
            if (!venueId || !Array.isArray(resources) || resources.length === 0) {
                res.status(400).json({
                    success: false,
                    message: "venueId and a non-empty resources array are required",
                });
                return;
            }
            try {
                const venueRepo = Database_1.AppDataSource.getRepository(Venue_1.Venue);
                const resourceRepo = Database_1.AppDataSource.getRepository("Resources");
                const venueResourceRepo = Database_1.AppDataSource.getRepository("VenueResource");
                const venue = yield venueRepo.findOne({ where: { venueId } });
                if (!venue) {
                    res.status(404).json({ success: false, message: "Venue not found" });
                    return;
                }
                // Get existing resources for this venue
                const existingVenueResources = yield venueResourceRepo.find({
                    where: { venue: { venueId } },
                    relations: ["resource"],
                });
                const existingResourceIds = new Set(existingVenueResources.map((vr) => vr.resource.resourceId));
                const toAdd = resources.filter((r) => !existingResourceIds.has(r.resourceId));
                const skipped = resources.filter((r) => existingResourceIds.has(r.resourceId));
                const created = [];
                for (const r of toAdd) {
                    const resource = yield resourceRepo.findOne({
                        where: { resourceId: r.resourceId },
                    });
                    if (!resource)
                        continue;
                    const venueResource = venueResourceRepo.create({
                        venue,
                        resource,
                        quantity: r.quantity,
                    });
                    created.push(yield venueResourceRepo.save(venueResource));
                }
                res.status(201).json({ success: true, added: created, skipped });
            }
            catch (err) {
                res.status(500).json({
                    success: false,
                    message: "Failed to add resources to venue",
                    error: err instanceof Error ? err.message : err,
                });
            }
        });
    }
    static getAllVenuesWithManagers(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const authenticatedReq = req;
            const userRoles = ((_a = authenticatedReq.user) === null || _a === void 0 ? void 0 : _a.roles) || [];
            const isAdmin = userRoles.some((r) => (r.roleName || r) === "ADMIN");
            if (!isAdmin) {
                res
                    .status(403)
                    .json({ success: false, message: "Only ADMIN can list all venues." });
                return;
            }
            try {
                const venueRepo = Database_1.AppDataSource.getRepository(Venue_1.Venue);
                const venues = yield venueRepo.find({
                    relations: [
                        "amenities",
                        "availabilitySlots",
                        "bookingConditions",
                        "venueVariables",
                        "venueVariables.manager",
                    ],
                });
                res.status(200).json({ success: true, data: venues });
            }
            catch (err) {
                res.status(500).json({
                    success: false,
                    message: "Server error",
                    error: err instanceof Error ? err.message : err,
                });
            }
        });
    }
    // Helper to robustly delete a file from Cloudinary by URL
    static deleteFromCloudinary(url_1) {
        return __awaiter(this, arguments, void 0, function* (url, resourceType = "image") {
            if (!url)
                return;
            try {
                // Remove query params/fragments
                const cleanUrl = url.split("?")[0].split("#")[0];
                // Find the part after '/upload/'
                const match = cleanUrl.match(/\/upload\/(?:v\d+\/)?(.+?)(\.[a-zA-Z0-9]+)?$/);
                if (!match || !match[1]) {
                    console.error("Cloudinary delete error: Could not extract public_id from URL", url);
                    return;
                }
                const publicId = match[1];
                yield cloudinary_1.default.uploader.destroy(publicId, {
                    resource_type: resourceType,
                });
            }
            catch (err) {
                console.error("Cloudinary delete error:", err, url);
            }
        });
    }
    // PATCH /venues/:id - update general fields
    static updateGeneralFields(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            const { id } = req.params;
            const allowedFields = [
                "venueName",
                "venueLocation",
                "capacity",
                "description",
                "latitude",
                "longitude",
                "googleMapsLink",
                "venueTypeId",
                "venueDocuments",
            ];
            try {
                const venueRepo = Database_1.AppDataSource.getRepository(Venue_1.Venue);
                const venue = yield venueRepo.findOne({ where: { venueId: id } });
                if (!venue) {
                    res.status(404).json({ success: false, message: "Venue not found" });
                    return;
                }
                for (const field of allowedFields) {
                    if (req.body[field] !== undefined)
                        venue[field] = req.body[field];
                }
                yield venueRepo.save(venue);
                res.status(200).json({ success: true, data: venue });
            }
            catch (err) {
                res.status(500).json({
                    success: false,
                    message: "Failed to update venue",
                    error: err instanceof Error ? err.message : err,
                });
            }
        });
    }
    // PATCH /venues/:id/main-photo - replace main photo
    static updateMainPhoto(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            const { id } = req.params;
            try {
                const venueRepo = Database_1.AppDataSource.getRepository(Venue_1.Venue);
                const venue = yield venueRepo.findOne({ where: { venueId: id } });
                if (!venue) {
                    res.status(404).json({ success: false, message: "Venue not found" });
                    return;
                }
                // Delete old photo from Cloudinary
                if (venue.mainPhotoUrl)
                    yield VenueController.deleteFromCloudinary(venue.mainPhotoUrl, "image");
                // Upload new photo
                const file = req.file;
                if (!file) {
                    res.status(400).json({ success: false, message: "No file uploaded" });
                    return;
                }
                const result = yield CloudinaryUploadService_1.CloudinaryUploadService.uploadBuffer(file.buffer, "venues/main_photos");
                venue.mainPhotoUrl = result.url;
                yield venueRepo.save(venue);
                res.status(200).json({ success: true, data: venue });
            }
            catch (err) {
                res.status(500).json({
                    success: false,
                    message: "Failed to update main photo",
                    error: err instanceof Error ? err.message : err,
                });
            }
        });
    }
    // POST /venues/:id/photo-gallery - add photo to gallery
    static addPhotoToGallery(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            const { id } = req.params;
            try {
                const venueRepo = Database_1.AppDataSource.getRepository(Venue_1.Venue);
                const venue = yield venueRepo.findOne({ where: { venueId: id } });
                if (!venue) {
                    res.status(404).json({ success: false, message: "Venue not found" });
                    return;
                }
                const file = req.file;
                if (!file) {
                    res.status(400).json({ success: false, message: "No file uploaded" });
                    return;
                }
                const result = yield CloudinaryUploadService_1.CloudinaryUploadService.uploadBuffer(file.buffer, "venues/gallery");
                venue.photoGallery = Array.isArray(venue.photoGallery)
                    ? venue.photoGallery
                    : [];
                venue.photoGallery.push(result.url);
                yield venueRepo.save(venue);
                res.status(200).json({ success: true, data: venue });
            }
            catch (err) {
                res.status(500).json({
                    success: false,
                    message: "Failed to add photo to gallery",
                    error: err instanceof Error ? err.message : err,
                });
            }
        });
    }
    // DELETE /venues/:id/photo-gallery - remove photo from gallery
    static removePhotoFromGallery(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            const { id } = req.params;
            const { photoUrl } = req.body;
            try {
                const venueRepo = Database_1.AppDataSource.getRepository(Venue_1.Venue);
                const venue = yield venueRepo.findOne({ where: { venueId: id } });
                if (!venue) {
                    res.status(404).json({ success: false, message: "Venue not found" });
                    return;
                }
                if (!photoUrl) {
                    res
                        .status(400)
                        .json({ success: false, message: "photoUrl is required" });
                    return;
                }
                venue.photoGallery = (venue.photoGallery || []).filter((url) => url !== photoUrl);
                yield VenueController.deleteFromCloudinary(photoUrl, "image");
                yield venueRepo.save(venue);
                res.status(200).json({ success: true, data: venue });
            }
            catch (err) {
                res.status(500).json({
                    success: false,
                    message: "Failed to remove photo from gallery",
                    error: err instanceof Error ? err.message : err,
                });
            }
        });
    }
    // PATCH /venues/:id/virtual-tour - replace virtual tour video
    static updateVirtualTour(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            const { id } = req.params;
            try {
                const venueRepo = Database_1.AppDataSource.getRepository(Venue_1.Venue);
                const venue = yield venueRepo.findOne({ where: { venueId: id } });
                if (!venue) {
                    res.status(404).json({ success: false, message: "Venue not found" });
                    return;
                }
                // Delete old video from Cloudinary
                if (venue.virtualTourUrl)
                    yield VenueController.deleteFromCloudinary(venue.virtualTourUrl, "video");
                // Upload new video
                const file = req.file;
                if (!file) {
                    res.status(400).json({ success: false, message: "No file uploaded" });
                    return;
                }
                const result = yield CloudinaryUploadService_1.CloudinaryUploadService.uploadBuffer(file.buffer, "venues/virtual_tours");
                venue.virtualTourUrl = result.url;
                yield venueRepo.save(venue);
                res.status(200).json({ success: true, data: venue });
            }
            catch (err) {
                res.status(500).json({
                    success: false,
                    message: "Failed to update virtual tour",
                    error: err instanceof Error ? err.message : err,
                });
            }
        });
    }
}
exports.VenueController = VenueController;
// Create a single venue or multiple venues
/**
 * Handles the creation of one or more venues,
 * including associated resources and assignment to an organization.
 *
 * Supports both single venue object and array of venue objects in the request body.
 *
 * @param req The Express request object, expected to be AuthenticatedRequest.
 * @param res The Express response object.
 * @returns A JSON response indicating success or failure of venue creation and assignment.
 */
VenueController.UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
