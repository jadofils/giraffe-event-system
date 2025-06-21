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
exports.Registration = void 0;
const typeorm_1 = require("typeorm");
const class_validator_1 = require("class-validator");
const TicketType_1 = require("./TicketType");
const Event_1 = require("./Event");
const User_1 = require("./User");
const Venue_1 = require("./Venue");
const Payment_1 = require("./Payment"); // Import Payment
const Invoice_1 = require("./Invoice"); // Import Invoice
let Registration = class Registration {
};
exports.Registration = Registration;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    (0, class_validator_1.IsUUID)('4', { message: 'registrationId must be a valid UUID' }),
    __metadata("design:type", String)
], Registration.prototype, "registrationId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => Event_1.Event, event => event.registrations, { nullable: false, eager: true }),
    (0, typeorm_1.JoinColumn)({ name: 'eventId' }) // Use JoinColumn with name for explicit foreign key column
    ,
    __metadata("design:type", Event_1.Event)
], Registration.prototype, "event", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'uuid' }),
    __metadata("design:type", String)
], Registration.prototype, "eventId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => User_1.User, user => user.registrationsAsAttendee, { nullable: false, eager: true }),
    (0, typeorm_1.JoinColumn)({ name: 'userId' }),
    __metadata("design:type", User_1.User)
], Registration.prototype, "user", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'uuid' }),
    __metadata("design:type", String)
], Registration.prototype, "userId", void 0);
__decorate([
    (0, typeorm_1.Column)('uuid', { array: true, nullable: true, default: () => "'{}'" }) // 'uuid' for element type, array: true for array
    ,
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)({ message: 'boughtForIds must be an array' }),
    (0, class_validator_1.IsUUID)('4', { each: true, message: 'Each boughtForId must be a valid UUID' }),
    (0, class_validator_1.ValidateIf)(o => o.boughtForIds !== undefined && o.boughtForIds !== null && o.boughtForIds.length > 0) // Better validation condition
    ,
    __metadata("design:type", Array)
], Registration.prototype, "boughtForIds", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => User_1.User, user => user.registrationsAsBuyer, { nullable: false, eager: true }),
    (0, typeorm_1.JoinColumn)({ name: 'buyerId' }),
    __metadata("design:type", User_1.User)
], Registration.prototype, "buyer", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'uuid' }),
    __metadata("design:type", String)
], Registration.prototype, "buyerId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => TicketType_1.TicketType, ticketType => ticketType.registrations, { nullable: false, eager: true }),
    (0, typeorm_1.JoinColumn)({ name: 'ticketTypeId' }),
    (0, class_validator_1.IsNotEmpty)({ message: 'A ticket type is required' }),
    __metadata("design:type", TicketType_1.TicketType)
], Registration.prototype, "ticketType", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'uuid' }),
    __metadata("design:type", String)
], Registration.prototype, "ticketTypeId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => Venue_1.Venue, venue => venue.registrations, { nullable: false, eager: true }),
    (0, typeorm_1.JoinColumn)({ name: 'venueId' }),
    __metadata("design:type", Venue_1.Venue)
], Registration.prototype, "venue", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'uuid' }),
    __metadata("design:type", String)
], Registration.prototype, "venueId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int' }),
    (0, class_validator_1.IsNumber)({}, { message: 'noOfTickets must be a number' }),
    (0, class_validator_1.IsPositive)({ message: 'noOfTickets must be a positive number' }),
    (0, class_validator_1.IsNotEmpty)({ message: 'noOfTickets is required' }),
    __metadata("design:type", Number)
], Registration.prototype, "noOfTickets", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'decimal', precision: 10, scale: 2, default: 0.00 }),
    __metadata("design:type", Number)
], Registration.prototype, "totalCost", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' }),
    (0, class_validator_1.IsDateString)({}, { message: 'registrationDate must be a valid ISO date string' }),
    __metadata("design:type", Date)
], Registration.prototype, "registrationDate", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: 'pending' }),
    (0, class_validator_1.IsNotEmpty)({ message: 'paymentStatus is required' }),
    (0, class_validator_1.Length)(3, 50, { message: 'paymentStatus must be between 3 and 50 characters' }),
    __metadata("design:type", String)
], Registration.prototype, "paymentStatus", void 0);
__decorate([
    (0, typeorm_1.Column)('varchar', { length: 255, nullable: true }),
    __metadata("design:type", String)
], Registration.prototype, "qrCode", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamptz', nullable: true }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)({}, { message: 'checkDate must be a valid ISO date string if provided' }),
    __metadata("design:type", Date)
], Registration.prototype, "checkDate", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'boolean', default: false }),
    (0, class_validator_1.IsBoolean)({ message: 'attended must be a boolean value' }),
    __metadata("design:type", Boolean)
], Registration.prototype, "attended", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 50, default: 'active' }),
    __metadata("design:type", String)
], Registration.prototype, "registrationStatus", void 0);
__decorate([
    (0, typeorm_1.OneToOne)(() => Payment_1.Payment, payment => payment.registration, { cascade: true, onDelete: 'SET NULL', nullable: true }),
    (0, typeorm_1.JoinColumn)({ name: 'paymentId' }),
    __metadata("design:type", Payment_1.Payment)
], Registration.prototype, "payment", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'uuid', nullable: true }) // Explicit foreign key column
    ,
    __metadata("design:type", String)
], Registration.prototype, "paymentId", void 0);
__decorate([
    (0, typeorm_1.OneToOne)(() => Invoice_1.Invoice, invoice => invoice.registration, { cascade: true, onDelete: 'SET NULL', nullable: true }),
    (0, typeorm_1.JoinColumn)({ name: 'invoiceId' }),
    __metadata("design:type", Invoice_1.Invoice)
], Registration.prototype, "invoice", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'uuid', nullable: true }) // Explicit foreign key column
    ,
    __metadata("design:type", String)
], Registration.prototype, "invoiceId", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' }),
    __metadata("design:type", Date)
], Registration.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' }),
    __metadata("design:type", Date)
], Registration.prototype, "updatedAt", void 0);
__decorate([
    (0, typeorm_1.DeleteDateColumn)({ type: 'timestamptz', nullable: true }),
    __metadata("design:type", Date)
], Registration.prototype, "deletedAt", void 0);
exports.Registration = Registration = __decorate([
    (0, typeorm_1.Entity)('registrations')
], Registration);
