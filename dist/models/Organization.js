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
exports.Organization = void 0;
const typeorm_1 = require("typeorm");
const class_validator_1 = require("class-validator");
const Event_1 = require("./Event");
const User_1 = require("./User");
const VenueBooking_1 = require("./VenueBooking");
const Venue_1 = require("./Venue");
const VenueInvoice_1 = require("./VenueInvoice");
const TicketType_1 = require("./TicketType");
let Organization = class Organization {
};
exports.Organization = Organization;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    (0, class_validator_1.IsUUID)('4', { message: 'organizationId must be a valid UUID' }),
    __metadata("design:type", String)
], Organization.prototype, "organizationId", void 0);
__decorate([
    (0, typeorm_1.Column)({ unique: true }),
    (0, class_validator_1.IsNotEmpty)({ message: 'organizationName is required' }),
    (0, class_validator_1.Length)(3, 100, { message: 'organizationName must be between $constraint1 and $constraint2 characters' }),
    __metadata("design:type", String)
], Organization.prototype, "organizationName", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.Length)(0, 500, { message: 'description must be at most $constraint2 characters' }),
    __metadata("design:type", String)
], Organization.prototype, "description", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    (0, class_validator_1.IsEmail)({}, { message: 'contactEmail must be a valid email address' }),
    (0, class_validator_1.IsNotEmpty)({ message: 'contactEmail is required' }),
    __metadata("design:type", String)
], Organization.prototype, "contactEmail", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsPhoneNumber)(undefined, { message: 'contactPhone must be a valid phone number' }),
    __metadata("design:type", String)
], Organization.prototype, "contactPhone", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.Length)(0, 200, { message: 'address must be at most $constraint2 characters' }),
    __metadata("design:type", String)
], Organization.prototype, "address", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.Length)(0, 50, { message: 'organizationType must be at most $constraint2 characters' }),
    __metadata("design:type", String)
], Organization.prototype, "organizationType", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 50, nullable: true }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)({ message: 'city must be a string' }),
    (0, class_validator_1.Length)(0, 50, { message: 'city must be at most $constraint2 characters' }),
    __metadata("design:type", String)
], Organization.prototype, "city", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 50, nullable: true }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)({ message: 'country must be a string' }),
    (0, class_validator_1.Length)(0, 50, { message: 'country must be at most $constraint2 characters' }),
    __metadata("design:type", String)
], Organization.prototype, "country", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 20, nullable: true }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)({ message: 'postalCode must be a string' }),
    (0, class_validator_1.Length)(0, 20, { message: 'postalCode must be at most $constraint2 characters' }),
    __metadata("design:type", String)
], Organization.prototype, "postalCode", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 50, nullable: true }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)({ message: 'stateProvince must be a string' }),
    (0, class_validator_1.Length)(0, 50, { message: 'stateProvince must be at most $constraint2 characters' }),
    __metadata("design:type", String)
], Organization.prototype, "stateProvince", void 0);
__decorate([
    (0, typeorm_1.ManyToMany)(() => User_1.User, (user) => user.organizations),
    __metadata("design:type", Array)
], Organization.prototype, "users", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => Event_1.Event, (event) => event.organization),
    __metadata("design:type", Array)
], Organization.prototype, "events", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => Venue_1.Venue, (venue) => venue.organization),
    __metadata("design:type", Array)
], Organization.prototype, "venues", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => VenueBooking_1.VenueBooking, (booking) => booking.organization),
    __metadata("design:type", Array)
], Organization.prototype, "bookings", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => VenueInvoice_1.VenueInvoice, (venueInvoice) => venueInvoice.organization),
    __metadata("design:type", Array)
], Organization.prototype, "venueInvoices", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => TicketType_1.TicketType, (ticketType) => ticketType.organization),
    __metadata("design:type", Array)
], Organization.prototype, "ticketTypes", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ type: 'timestamp with time zone' }),
    __metadata("design:type", Date)
], Organization.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ type: 'timestamp with time zone' }),
    __metadata("design:type", Date)
], Organization.prototype, "updatedAt", void 0);
__decorate([
    (0, typeorm_1.DeleteDateColumn)({ type: 'timestamp with time zone', nullable: true }),
    __metadata("design:type", Date)
], Organization.prototype, "deletedAt", void 0);
exports.Organization = Organization = __decorate([
    (0, typeorm_1.Entity)('organizations')
], Organization);
