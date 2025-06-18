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
exports.VenueBooking = exports.ApprovalStatus = void 0;
// src/models/VenueBooking.ts
const typeorm_1 = require("typeorm");
const class_validator_1 = require("class-validator");
const Event_1 = require("./Event");
const Venue_1 = require("./Venue");
const Organization_1 = require("./Organization");
const User_1 = require("./User");
const VenueInvoice_1 = require("./VenueInvoice"); // Import the new VenueInvoice model
var ApprovalStatus;
(function (ApprovalStatus) {
    ApprovalStatus["PENDING"] = "pending";
    ApprovalStatus["APPROVED"] = "approved";
    ApprovalStatus["REJECTED"] = "rejected";
})(ApprovalStatus || (exports.ApprovalStatus = ApprovalStatus = {}));
let VenueBooking = class VenueBooking {
};
exports.VenueBooking = VenueBooking;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    (0, class_validator_1.IsUUID)('4', { message: 'bookingId must be a valid UUID' }),
    __metadata("design:type", String)
], VenueBooking.prototype, "bookingId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'uuid', unique: true }) // One VenueBooking per Event (OneToOne on the Event side)
    ,
    (0, class_validator_1.IsUUID)('4', { message: 'eventId must be a valid UUID' }),
    __metadata("design:type", String)
], VenueBooking.prototype, "eventId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'uuid' }) // Explicitly define as UUID
    ,
    (0, class_validator_1.IsUUID)('4', { message: 'venueId must be a valid UUID' }),
    __metadata("design:type", String)
], VenueBooking.prototype, "venueId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'uuid', nullable: true }) // Made nullable as an event might not always have an organization booking the venue directly
    ,
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)('4', { message: 'organizationId must be a valid UUID' }),
    __metadata("design:type", String)
], VenueBooking.prototype, "organizationId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'uuid' }) // Assuming a user always initiates a booking
    ,
    (0, class_validator_1.IsUUID)('4', { message: 'userId must be a valid UUID' }),
    __metadata("design:type", String)
], VenueBooking.prototype, "userId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'decimal', precision: 10, scale: 2, default: 0.00 }),
    (0, class_validator_1.IsNumber)({}, { message: 'totalAmountDue must be a number' }),
    (0, class_validator_1.Min)(0, { message: 'totalAmountDue cannot be negative' }),
    __metadata("design:type", Number)
], VenueBooking.prototype, "totalAmountDue", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'uuid', nullable: true }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)('4', { message: 'venueInvoiceId must be a valid UUID' }),
    __metadata("design:type", String)
], VenueBooking.prototype, "venueInvoiceId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'enum', enum: ApprovalStatus, default: ApprovalStatus.PENDING }),
    (0, class_validator_1.IsEnum)(ApprovalStatus, { message: 'Invalid approval status' }),
    __metadata("design:type", String)
], VenueBooking.prototype, "approvalStatus", void 0);
__decorate([
    (0, typeorm_1.OneToOne)(() => Event_1.Event, (event) => event.venueBooking),
    (0, typeorm_1.JoinColumn)({ name: 'eventId' }) // Specifies that eventId is the FK in THIS table for the OneToOne
    ,
    __metadata("design:type", Event_1.Event)
], VenueBooking.prototype, "event", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => Venue_1.Venue, (venue) => venue.bookings, { nullable: false }),
    (0, typeorm_1.JoinColumn)({ name: "venueId" }) // Corrected to 'venueId' based on the column above
    ,
    __metadata("design:type", Venue_1.Venue)
], VenueBooking.prototype, "venue", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => User_1.User, (user) => user.bookings, { nullable: false }),
    (0, typeorm_1.JoinColumn)({ name: "userId" }) // Add JoinColumn for userId
    ,
    __metadata("design:type", User_1.User)
], VenueBooking.prototype, "user", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => Organization_1.Organization, (organization) => organization.bookings, { nullable: true }),
    (0, typeorm_1.JoinColumn)({ name: "organizationId" }) // Add JoinColumn for organizationId
    ,
    __metadata("design:type", Organization_1.Organization)
], VenueBooking.prototype, "organization", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => VenueInvoice_1.VenueInvoice, (venueInvoice) => venueInvoice.venueBookings),
    (0, typeorm_1.JoinColumn)({ name: 'venueInvoiceId' }),
    __metadata("design:type", VenueInvoice_1.VenueInvoice)
], VenueBooking.prototype, "venueInvoice", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], VenueBooking.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", Date)
], VenueBooking.prototype, "updatedAt", void 0);
__decorate([
    (0, typeorm_1.DeleteDateColumn)(),
    __metadata("design:type", Date)
], VenueBooking.prototype, "deletedAt", void 0);
exports.VenueBooking = VenueBooking = __decorate([
    (0, typeorm_1.Entity)('venue_bookings'),
    (0, typeorm_1.Index)(['eventId', 'venueId'], { unique: false }) // Added an index for common queries
], VenueBooking);
