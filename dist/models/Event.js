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
exports.Event = void 0;
const typeorm_1 = require("typeorm");
const class_validator_1 = require("class-validator");
const Venue_1 = require("./Venue");
const User_1 = require("./User");
const Organization_1 = require("./Organization");
const VenueBooking_1 = require("./VenueBooking");
const Registration_1 = require("./Registration");
const Payment_1 = require("./Payment");
const Invoice_1 = require("./Invoice");
const EventTypeEnum_1 = require("../interfaces/Enums/EventTypeEnum");
const EventStatusEnum_1 = require("../interfaces/Enums/EventStatusEnum");
const TicketType_1 = require("./TicketType");
let Event = class Event {
};
exports.Event = Event;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    (0, class_validator_1.IsUUID)('4', { message: 'eventId must be a valid UUID' }),
    __metadata("design:type", String)
], Event.prototype, "eventId", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    (0, class_validator_1.IsNotEmpty)({ message: 'Event title is required' }),
    (0, class_validator_1.Length)(3, 100, { message: 'Event title must be between $constraint1 and $constraint2 characters' }),
    __metadata("design:type", String)
], Event.prototype, "eventTitle", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.Length)(0, 5000, { message: 'Description must be at most $constraint2 characters long' }),
    __metadata("design:type", String)
], Event.prototype, "description", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'enum', enum: EventTypeEnum_1.EventType, default: EventTypeEnum_1.EventType.PUBLIC }),
    (0, class_validator_1.IsEnum)(EventTypeEnum_1.EventType, { message: 'Event type must be one of: public, private' }),
    __metadata("design:type", String)
], Event.prototype, "eventType", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamp with time zone', nullable: true }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)({}, { message: 'Start date must be a valid date' }),
    __metadata("design:type", Date)
], Event.prototype, "startDate", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamp with time zone', nullable: true }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)({}, { message: 'End date must be a valid date' }),
    __metadata("design:type", Date)
], Event.prototype, "endDate", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)({ message: 'Start time must be a string' }),
    __metadata("design:type", String)
], Event.prototype, "startTime", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)({ message: 'End time must be a string' }),
    __metadata("design:type", String)
], Event.prototype, "endTime", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', nullable: true }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)({ message: 'Max attendees must be an integer' }),
    (0, class_validator_1.Min)(1, { message: 'Max attendees must be at least 1' }),
    __metadata("design:type", Number)
], Event.prototype, "maxAttendees", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'enum', enum: EventStatusEnum_1.EventStatus, default: EventStatusEnum_1.EventStatus.PENDING }),
    (0, class_validator_1.IsEnum)(EventStatusEnum_1.EventStatus, { message: 'Invalid event status' }),
    __metadata("design:type", String)
], Event.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: false }),
    (0, class_validator_1.IsBoolean)({ message: 'isFeatured must be a boolean' }),
    __metadata("design:type", Boolean)
], Event.prototype, "isFeatured", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.Length)(0, 255, { message: 'QR Code must be at most $constraint2 characters long' }),
    __metadata("design:type", String)
], Event.prototype, "qrCode", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.Length)(0, 255, { message: 'Image URL must be at most $constraint2 characters long' }),
    __metadata("design:type", String)
], Event.prototype, "imageURL", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'uuid' }),
    (0, class_validator_1.IsNotEmpty)({ message: 'Organization ID is required' }),
    (0, class_validator_1.IsUUID)('4', { message: 'Organization ID must be a valid UUID' }),
    __metadata("design:type", String)
], Event.prototype, "organizationId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'uuid' }),
    (0, class_validator_1.IsNotEmpty)({ message: 'Organizer ID is required' }),
    (0, class_validator_1.IsUUID)('4', { message: 'Organizer ID must be a valid UUID' }),
    __metadata("design:type", String)
], Event.prototype, "organizerId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'uuid', nullable: true }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)('4', { message: 'createdByUserId must be a valid UUID' }),
    __metadata("design:type", String)
], Event.prototype, "createdByUserId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'json', nullable: true }),
    __metadata("design:type", Object)
], Event.prototype, "socialMediaLinks", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => Organization_1.Organization, (organization) => organization.events),
    (0, typeorm_1.JoinColumn)({ name: 'organizationId' }),
    __metadata("design:type", Organization_1.Organization)
], Event.prototype, "organization", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => User_1.User, (user) => user.createdEvents),
    (0, typeorm_1.JoinColumn)({ name: 'organizerId' }),
    __metadata("design:type", User_1.User)
], Event.prototype, "organizer", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => User_1.User, (user) => user.createdEvents),
    (0, typeorm_1.JoinColumn)({ name: 'createdByUserId' }),
    __metadata("design:type", User_1.User)
], Event.prototype, "createdBy", void 0);
__decorate([
    (0, typeorm_1.ManyToMany)(() => Venue_1.Venue, (venue) => venue.events),
    __metadata("design:type", Array)
], Event.prototype, "venues", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 100, nullable: true }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.Length)(0, 100, { message: 'Event category must be at most 100 characters' }),
    __metadata("design:type", String)
], Event.prototype, "eventCategory", void 0);
__decorate([
    (0, typeorm_1.ManyToMany)(() => VenueBooking_1.VenueBooking, (venueBooking) => venueBooking.events),
    (0, typeorm_1.JoinTable)({
        name: 'event_venue_bookings',
        joinColumn: { name: 'eventId', referencedColumnName: 'eventId' },
        inverseJoinColumn: { name: 'bookingId', referencedColumnName: 'bookingId' },
    }),
    __metadata("design:type", Array)
], Event.prototype, "venueBookings", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => Registration_1.Registration, (registration) => registration.event, { cascade: false }),
    __metadata("design:type", Array)
], Event.prototype, "registrations", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => Payment_1.Payment, (payment) => payment.event),
    __metadata("design:type", Array)
], Event.prototype, "payments", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => Invoice_1.Invoice, (invoice) => invoice.event),
    __metadata("design:type", Array)
], Event.prototype, "invoices", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => TicketType_1.TicketType, (ticketType) => ticketType.event),
    __metadata("design:type", Array)
], Event.prototype, "ticketTypes", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ type: 'timestamp with time zone' }),
    __metadata("design:type", Date)
], Event.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ type: 'timestamp with time zone' }),
    __metadata("design:type", Date)
], Event.prototype, "updatedAt", void 0);
__decorate([
    (0, typeorm_1.DeleteDateColumn)({ type: 'timestamp with time zone', nullable: true }),
    __metadata("design:type", Date)
], Event.prototype, "deletedAt", void 0);
exports.Event = Event = __decorate([
    (0, typeorm_1.Entity)('events')
], Event);
