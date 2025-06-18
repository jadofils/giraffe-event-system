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
exports.Venue = void 0;
const typeorm_1 = require("typeorm");
const class_validator_1 = require("class-validator");
const User_1 = require("./User");
const Organization_1 = require("./Organization");
const VenueBooking_1 = require("./VenueBooking");
const Event_1 = require("./Event");
const Registration_1 = require("./Registration");
let Venue = class Venue {
};
exports.Venue = Venue;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    (0, class_validator_1.IsUUID)('4', { message: 'venueId must be a valid UUID' }),
    __metadata("design:type", String)
], Venue.prototype, "venueId", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    (0, class_validator_1.IsNotEmpty)({ message: 'venueName is required' }),
    (0, class_validator_1.Length)(3, 100, {
        message: 'venueName must be between $constraint1 and $constraint2 characters',
    }),
    __metadata("design:type", String)
], Venue.prototype, "venueName", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    (0, class_validator_1.IsNumber)({}, { message: 'capacity must be a number' }),
    (0, class_validator_1.IsPositive)({ message: 'capacity must be a positive number' }),
    __metadata("design:type", Number)
], Venue.prototype, "capacity", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'decimal', precision: 10, scale: 2 }),
    (0, class_validator_1.IsNumber)({}, { message: 'amount must be a number' }),
    (0, class_validator_1.IsPositive)({ message: 'amount must be a positive number' }),
    __metadata("design:type", Number)
], Venue.prototype, "amount", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    (0, class_validator_1.IsNotEmpty)({ message: 'location is required' }),
    (0, class_validator_1.Length)(3, 200, {
        message: 'location must be between $constraint1 and $constraint2 characters',
    }),
    __metadata("design:type", String)
], Venue.prototype, "location", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'uuid', nullable: true }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)('4', { message: 'managerId must be a valid UUID', always: true }),
    __metadata("design:type", String)
], Venue.prototype, "managerId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'double precision', nullable: true }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)({}, { message: 'latitude must be a number' }),
    __metadata("design:type", Number)
], Venue.prototype, "latitude", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'double precision', nullable: true }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)({}, { message: 'longitude must be a number' }),
    __metadata("design:type", Number)
], Venue.prototype, "longitude", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUrl)({}, { message: 'googleMapsLink must be a valid URL' }),
    __metadata("design:type", String)
], Venue.prototype, "googleMapsLink", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'uuid', nullable: true }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)('4', { message: 'organizationId must be a valid UUID' }),
    __metadata("design:type", String)
], Venue.prototype, "organizationId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => User_1.User, (user) => user.managedVenues),
    (0, typeorm_1.JoinColumn)({ name: 'managerId' }),
    __metadata("design:type", User_1.User)
], Venue.prototype, "manager", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => Organization_1.Organization, (organization) => organization.venues),
    (0, typeorm_1.JoinColumn)({ name: 'organizationId' }),
    __metadata("design:type", Organization_1.Organization)
], Venue.prototype, "organization", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => VenueBooking_1.VenueBooking, (venueBooking) => venueBooking.venue),
    __metadata("design:type", Array)
], Venue.prototype, "bookings", void 0);
__decorate([
    (0, typeorm_1.ManyToMany)(() => Event_1.Event, (event) => event.venues),
    (0, typeorm_1.JoinTable)({
        name: 'event_venues',
        joinColumn: { name: 'venueId', referencedColumnName: 'venueId' },
        inverseJoinColumn: { name: 'eventId', referencedColumnName: 'eventId' },
    }),
    __metadata("design:type", Array)
], Venue.prototype, "events", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => Registration_1.Registration, (registration) => registration.venue),
    __metadata("design:type", Array)
], Venue.prototype, "registrations", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 255, nullable: true }),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], Venue.prototype, "amenities", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 100, nullable: true }),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], Venue.prototype, "venueType", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 100, nullable: true }),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], Venue.prototype, "contactPerson", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 100, nullable: true }),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], Venue.prototype, "contactEmail", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 20, nullable: true }),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], Venue.prototype, "contactPhone", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 255, nullable: true }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUrl)({}, { message: 'websiteURL must be a valid URL' }),
    __metadata("design:type", String)
], Venue.prototype, "websiteURL", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], Venue.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", Date)
], Venue.prototype, "updatedAt", void 0);
__decorate([
    (0, typeorm_1.DeleteDateColumn)(),
    __metadata("design:type", Date)
], Venue.prototype, "deletedAt", void 0);
exports.Venue = Venue = __decorate([
    (0, typeorm_1.Entity)('venues')
], Venue);
