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
Object.defineProperty(exports, "__esModule", { value: true });
exports.VenueRepository = void 0;
const Database_1 = require("../config/Database");
const Venue_1 = require("../models/Venue Tables/Venue");
const BookingCondition_1 = require("../models/Venue Tables/BookingCondition");
const VenueVariable_1 = require("../models/Venue Tables/VenueVariable");
const VenueAmenities_1 = require("../models/Venue Tables/VenueAmenities");
class VenueRepository {
    // Create venue
    static create(data) {
        if (!data.venueName || !data.capacity || !data.venueLocation) {
            return {
                success: false,
                message: "Required fields: venueName, capacity, venueLocation.",
            };
        }
        const venue = new Venue_1.Venue();
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
    static saveFullVenue(data) {
        return __awaiter(this, void 0, void 0, function* () {
            const venueRepo = Database_1.AppDataSource.getRepository(Venue_1.Venue);
            const bcRepo = Database_1.AppDataSource.getRepository(BookingCondition_1.BookingCondition);
            const vvRepo = Database_1.AppDataSource.getRepository(VenueVariable_1.VenueVariable);
            const vaRepo = Database_1.AppDataSource.getRepository(VenueAmenities_1.VenueAmenities);
            const queryRunner = Database_1.AppDataSource.createQueryRunner();
            yield queryRunner.connect();
            yield queryRunner.startTransaction();
            try {
                // Only pass Venue fields to create
                const { bookingConditions, venueVariable, venueAmenities, status, bookingType } = data, venueFields = __rest(data, ["bookingConditions", "venueVariable", "venueAmenities", "status", "bookingType"]);
                const venue = venueRepo.create(Object.assign(Object.assign({}, venueFields), { status: typeof status === "string"
                        ? Venue_1.VenueStatus[status]
                        : status, bookingType: typeof bookingType === "string"
                        ? Venue_1.BookingType[bookingType]
                        : bookingType }));
                yield queryRunner.manager.save(venue);
                // Save Booking Conditions
                if (bookingConditions && bookingConditions.length > 0) {
                    for (const bc of bookingConditions) {
                        const bookingCondition = bcRepo.create(Object.assign(Object.assign({}, bc), { venue }));
                        yield queryRunner.manager.save(bookingCondition);
                    }
                }
                // Save Venue Variable
                if (venueVariable) {
                    const venueVariableEntity = vvRepo.create(Object.assign(Object.assign({}, venueVariable), { venue }));
                    yield queryRunner.manager.save(venueVariableEntity);
                }
                // Save Venue Amenities
                if (venueAmenities && venueAmenities.length > 0) {
                    for (const amenity of venueAmenities) {
                        const venueAmenity = vaRepo.create(Object.assign(Object.assign({}, amenity), { venue }));
                        yield queryRunner.manager.save(venueAmenity);
                    }
                }
                yield queryRunner.commitTransaction();
                return { success: true, data: venue };
            }
            catch (err) {
                yield queryRunner.rollbackTransaction();
                return { success: false, message: "Failed to create venue" };
            }
            finally {
                yield queryRunner.release();
            }
        });
    }
}
exports.VenueRepository = VenueRepository;
VenueRepository.CACHE_PREFIX = "venue:";
VenueRepository.CACHE_TTL = 3600; // 1 hour, as venues update less frequently
VenueRepository.UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
