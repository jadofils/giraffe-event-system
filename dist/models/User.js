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
exports.User = void 0;
const typeorm_1 = require("typeorm");
const class_validator_1 = require("class-validator");
const Role_1 = require("./Role");
const Organization_1 = require("./Organization");
const Registration_1 = require("./Registration");
const VenueBooking_1 = require("./VenueBooking");
const VenueInvoice_1 = require("./VenueInvoice");
const VenuePayment_1 = require("./VenuePayment");
const Event_1 = require("./Event");
const Venue_1 = require("./Venue");
const Invoice_1 = require("./Invoice");
let User = class User {
};
exports.User = User;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    (0, class_validator_1.IsUUID)('4', { message: 'userId must be a valid UUID' }),
    __metadata("design:type", String)
], User.prototype, "userId", void 0);
__decorate([
    (0, typeorm_1.Column)({ unique: true }),
    (0, class_validator_1.IsNotEmpty)({ message: 'username is required' }),
    (0, class_validator_1.Length)(3, 50, { message: 'username must be between $constraint1 and $constraint2 characters' }),
    __metadata("design:type", String)
], User.prototype, "username", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    (0, class_validator_1.IsNotEmpty)({ message: 'firstName is required' }),
    (0, class_validator_1.Length)(1, 50, { message: 'firstName must be between $constraint1 and $constraint2 characters' }),
    __metadata("design:type", String)
], User.prototype, "firstName", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    (0, class_validator_1.IsNotEmpty)({ message: 'lastName is required' }),
    (0, class_validator_1.Length)(1, 50, { message: 'lastName must be between $constraint1 and $constraint2 characters' }),
    __metadata("design:type", String)
], User.prototype, "lastName", void 0);
__decorate([
    (0, typeorm_1.Column)({ unique: true }),
    (0, class_validator_1.IsNotEmpty)({ message: 'email is required' }),
    (0, class_validator_1.IsEmail)({}, { message: 'email must be a valid email address' }),
    __metadata("design:type", String)
], User.prototype, "email", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)({ message: 'password must be a string' }),
    __metadata("design:type", String)
], User.prototype, "password", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsPhoneNumber)(undefined, { message: 'phoneNumber must be a valid phone number' }),
    __metadata("design:type", String)
], User.prototype, "phoneNumber", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'uuid' }),
    (0, class_validator_1.IsNotEmpty)({ message: 'roleId is required' }),
    (0, class_validator_1.IsUUID)('4', { message: 'roleId must be a valid UUID' }),
    __metadata("design:type", String)
], User.prototype, "roleId", void 0);
__decorate([
    (0, typeorm_1.ManyToMany)(() => Organization_1.Organization, (organization) => organization.users),
    (0, typeorm_1.JoinTable)({
        name: 'user_organizations',
        joinColumn: { name: 'userId', referencedColumnName: 'userId' },
        inverseJoinColumn: { name: 'organizationId', referencedColumnName: 'organizationId' },
    }),
    __metadata("design:type", Array)
], User.prototype, "organizations", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => Role_1.Role, (role) => role.users),
    (0, typeorm_1.JoinColumn)({ name: 'roleId' }),
    __metadata("design:type", Role_1.Role)
], User.prototype, "role", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => VenueBooking_1.VenueBooking, (booking) => booking.user),
    __metadata("design:type", Array)
], User.prototype, "bookings", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => Registration_1.Registration, (registration) => registration.user),
    __metadata("design:type", Array)
], User.prototype, "registrationsAsAttendee", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => Registration_1.Registration, (registration) => registration.buyer),
    __metadata("design:type", Array)
], User.prototype, "registrationsAsBuyer", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => Venue_1.Venue, (venue) => venue.manager),
    __metadata("design:type", Array)
], User.prototype, "managedVenues", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => VenueInvoice_1.VenueInvoice, (venueInvoice) => venueInvoice.user),
    __metadata("design:type", Array)
], User.prototype, "venueInvoices", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => VenuePayment_1.VenuePayment, (venuePayment) => venuePayment.user),
    __metadata("design:type", Array)
], User.prototype, "venuePayments", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => Invoice_1.Invoice, (invoice) => invoice.user),
    __metadata("design:type", Array)
], User.prototype, "invoices", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => Registration_1.Registration, (registration) => registration.user),
    __metadata("design:type", Array)
], User.prototype, "registrations", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => Event_1.Event, (event) => event.createdBy),
    __metadata("design:type", Array)
], User.prototype, "createdEvents", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 1000, nullable: true }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)({ message: 'bio must be a string' }),
    (0, class_validator_1.Length)(0, 1000, { message: 'bio must be at most $constraint2 characters' }),
    __metadata("design:type", String)
], User.prototype, "bio", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 255, nullable: true }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUrl)({}, { message: 'profilePictureURL must be a valid URL' }),
    __metadata("design:type", String)
], User.prototype, "profilePictureURL", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 50, nullable: true }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)({ message: 'preferredLanguage must be a string' }),
    (0, class_validator_1.Length)(0, 50, { message: 'preferredLanguage must be at most $constraint2 characters' }),
    __metadata("design:type", String)
], User.prototype, "preferredLanguage", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 50, nullable: true }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)({ message: 'timezone must be a string' }),
    (0, class_validator_1.Length)(0, 50, { message: 'timezone must be at most $constraint2 characters' }),
    __metadata("design:type", String)
], User.prototype, "timezone", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'boolean', default: true, nullable: true }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)({ message: 'emailNotificationsEnabled must be a boolean' }),
    __metadata("design:type", Boolean)
], User.prototype, "emailNotificationsEnabled", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'boolean', default: true, nullable: true }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)({ message: 'smsNotificationsEnabled must be a boolean' }),
    __metadata("design:type", Boolean)
], User.prototype, "smsNotificationsEnabled", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb', nullable: true }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsObject)({ message: 'socialMediaLinks must be an object' }),
    __metadata("design:type", Object)
], User.prototype, "socialMediaLinks", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'date', nullable: true }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)({}, { message: 'dateOfBirth must be a valid date string' }),
    __metadata("design:type", Date)
], User.prototype, "dateOfBirth", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 20, nullable: true }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)({ message: 'gender must be a string' }),
    (0, class_validator_1.Length)(0, 20, { message: 'gender must be at most $constraint2 characters' }),
    __metadata("design:type", String)
], User.prototype, "gender", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 100, nullable: true }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)({ message: 'addressLine1 must be a string' }),
    (0, class_validator_1.Length)(0, 100, { message: 'addressLine1 must be at most $constraint2 characters' }),
    __metadata("design:type", String)
], User.prototype, "addressLine1", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 100, nullable: true }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)({ message: 'addressLine2 must be a string' }),
    (0, class_validator_1.Length)(0, 100, { message: 'addressLine2 must be at most $constraint2 characters' }),
    __metadata("design:type", String)
], User.prototype, "addressLine2", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 50, nullable: true }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)({ message: 'city must be a string' }),
    (0, class_validator_1.Length)(0, 50, { message: 'city must be at most $constraint2 characters' }),
    __metadata("design:type", String)
], User.prototype, "city", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 50, nullable: true }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)({ message: 'stateProvince must be a string' }),
    (0, class_validator_1.Length)(0, 50, { message: 'stateProvince must be at most $constraint2 characters' }),
    __metadata("design:type", String)
], User.prototype, "stateProvince", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 20, nullable: true }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)({ message: 'postalCode must be a string' }),
    (0, class_validator_1.Length)(0, 20, { message: 'postalCode must be at most $constraint2 characters' }),
    __metadata("design:type", String)
], User.prototype, "postalCode", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 50, nullable: true }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)({ message: 'country must be a string' }),
    (0, class_validator_1.Length)(0, 50, { message: 'country must be at most $constraint2 characters' }),
    __metadata("design:type", String)
], User.prototype, "country", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ type: 'timestamp with time zone' }),
    __metadata("design:type", Date)
], User.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ type: 'timestamp with time zone' }),
    __metadata("design:type", Date)
], User.prototype, "updatedAt", void 0);
__decorate([
    (0, typeorm_1.DeleteDateColumn)({ type: 'timestamp with time zone', nullable: true }),
    __metadata("design:type", Date)
], User.prototype, "deletedAt", void 0);
exports.User = User = __decorate([
    (0, typeorm_1.Entity)('users')
], User);
