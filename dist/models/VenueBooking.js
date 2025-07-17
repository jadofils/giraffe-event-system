"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.VenueBooking = exports.BookingStatus = exports.VenueStatus = void 0;
const typeorm_1 = require("typeorm");
const Venue_1 = require("./Venue Tables/Venue");
const EventTypeEnum_1 = require("../interfaces/Enums/EventTypeEnum");
const User_1 = require("./User");
var VenueStatus;
(function (VenueStatus) {
    VenueStatus["AVAILABLE"] = "AVAILABLE";
    VenueStatus["BOOKED"] = "BOOKED";
    VenueStatus["MAINTENANCE"] = "MAINTENANCE";
})(VenueStatus || (exports.VenueStatus = VenueStatus = {}));
var BookingStatus;
(function (BookingStatus) {
    BookingStatus["APPROVED_PAID"] = "APPROVED_PAID";
    BookingStatus["APPROVED_NOT_PAID"] = "APPROVED_NOT_PAID";
    BookingStatus["PENDING"] = "PENDING";
})(BookingStatus || (exports.BookingStatus = BookingStatus = {}));
let VenueBooking = class VenueBooking {
};
exports.VenueBooking = VenueBooking;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)("uuid"),
    __metadata("design:type", String)
], VenueBooking.prototype, "bookingId", void 0);
__decorate([
    (0, typeorm_1.Column)("uuid"),
    __metadata("design:type", String)
], VenueBooking.prototype, "venueId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => Venue_1.Venue, (venue) => venue.bookings, { nullable: false }),
    (0, typeorm_1.JoinColumn)({ name: "venue_id" }),
    __metadata("design:type", Venue_1.Venue)
], VenueBooking.prototype, "venue", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "enum", enum: EventTypeEnum_1.EventType }),
    __metadata("design:type", String)
], VenueBooking.prototype, "bookingReason", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "text", nullable: true }),
    __metadata("design:type", String)
], VenueBooking.prototype, "otherReason", void 0);
__decorate([
    (0, typeorm_1.Column)("uuid", { nullable: true }),
    __metadata("design:type", String)
], VenueBooking.prototype, "eventId", void 0);
__decorate([
    (0, typeorm_1.Column)("uuid"),
    __metadata("design:type", String)
], VenueBooking.prototype, "createdBy", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => User_1.User, (user) => user.bookings),
    (0, typeorm_1.JoinColumn)({ name: "created_by" }),
    __metadata("design:type", User_1.User)
], VenueBooking.prototype, "user", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "date" }),
    __metadata("design:type", String)
], VenueBooking.prototype, "eventStartDate", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "date" }),
    __metadata("design:type", String)
], VenueBooking.prototype, "eventEndDate", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "time", nullable: true }),
    __metadata("design:type", String)
], VenueBooking.prototype, "startTime", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "time", nullable: true }),
    __metadata("design:type", String)
], VenueBooking.prototype, "endTime", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "enum", enum: VenueStatus, nullable: true }),
    __metadata("design:type", String)
], VenueBooking.prototype, "venueStatus", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "int", nullable: true }),
    __metadata("design:type", Number)
], VenueBooking.prototype, "venueDiscountPercent", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", length: 100, default: "UTC" }),
    __metadata("design:type", String)
], VenueBooking.prototype, "timezone", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "enum", enum: BookingStatus, default: BookingStatus.PENDING }),
    __metadata("design:type", String)
], VenueBooking.prototype, "bookingStatus", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "float", nullable: true }),
    __metadata("design:type", Number)
], VenueBooking.prototype, "amountToBePaid", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "boolean", default: false }),
    __metadata("design:type", Boolean)
], VenueBooking.prototype, "isPaid", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], VenueBooking.prototype, "createdAt", void 0);
exports.VenueBooking = VenueBooking = __decorate([
    (0, typeorm_1.Entity)("venue_bookings")
], VenueBooking);
