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
const typeorm_1 = require("typeorm");
const Event_1 = require("./Event");
const Venue_1 = require("./Venue");
const User_1 = require("./User");
const Organization_1 = require("./Organization");
const Invoice_1 = require("./Invoice");
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
    __metadata("design:type", String)
], VenueBooking.prototype, "bookingId", void 0);
__decorate([
    (0, typeorm_1.Column)('uuid'),
    (0, typeorm_1.JoinColumn)({ name: 'event_id' }),
    __metadata("design:type", String)
], VenueBooking.prototype, "eventId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => Event_1.Event, (event) => event.venueBookings, { nullable: false }),
    __metadata("design:type", Event_1.Event)
], VenueBooking.prototype, "event", void 0);
__decorate([
    (0, typeorm_1.Column)('uuid'),
    (0, typeorm_1.JoinColumn)({ name: 'venue_id' }),
    __metadata("design:type", String)
], VenueBooking.prototype, "venueId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => Venue_1.Venue, (venue) => venue.bookings, { nullable: false }),
    __metadata("design:type", Venue_1.Venue)
], VenueBooking.prototype, "venue", void 0);
__decorate([
    (0, typeorm_1.Column)('uuid'),
    (0, typeorm_1.JoinColumn)({ name: 'user_id' }),
    __metadata("design:type", String)
], VenueBooking.prototype, "userId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => User_1.User, { nullable: false }),
    __metadata("design:type", User_1.User)
], VenueBooking.prototype, "user", void 0);
__decorate([
    (0, typeorm_1.Column)('uuid', { nullable: true }),
    (0, typeorm_1.JoinColumn)({ name: 'organization_id' }),
    __metadata("design:type", String)
], VenueBooking.prototype, "organizationId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => Organization_1.Organization, { nullable: true }),
    __metadata("design:type", Organization_1.Organization)
], VenueBooking.prototype, "organization", void 0);
__decorate([
    (0, typeorm_1.Column)('uuid', { nullable: true }),
    (0, typeorm_1.JoinColumn)({ name: 'venue_invoice_id' }),
    __metadata("design:type", String)
], VenueBooking.prototype, "venueInvoiceId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => Invoice_1.Invoice, (invoice) => invoice.venueBookings, { nullable: true }),
    __metadata("design:type", Invoice_1.Invoice)
], VenueBooking.prototype, "invoice", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'decimal', precision: 10, scale: 2 }),
    __metadata("design:type", Number)
], VenueBooking.prototype, "totalAmountDue", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'enum', enum: ApprovalStatus, default: ApprovalStatus.PENDING }),
    __metadata("design:type", String)
], VenueBooking.prototype, "approvalStatus", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", String)
], VenueBooking.prototype, "notes", void 0);
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
    (0, typeorm_1.Entity)('venue_bookings')
], VenueBooking);
