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
exports.Invoice = void 0;
// src/models/Invoice.ts
const typeorm_1 = require("typeorm");
const class_validator_1 = require("class-validator");
// --- Enums for better type safety ---
const InvoiceStatus_1 = require("../interfaces/Enums/InvoiceStatus");
// Assuming these exist and are properly defined
const User_1 = require("./User");
const Event_1 = require("./Event");
const Payment_1 = require("./Payment");
const Registration_1 = require("./Registration");
const InstallmentPlan_1 = require("./InstallmentPlan");
const Venue_1 = require("./Venue Tables/Venue");
const VenueBooking_1 = require("./VenueBooking");
let Invoice = class Invoice {
};
exports.Invoice = Invoice;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)("uuid") // <--- CHANGE THIS LINE
    ,
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], Invoice.prototype, "invoiceId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "uuid" }),
    (0, class_validator_1.IsUUID)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], Invoice.prototype, "eventId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "uuid" }),
    (0, class_validator_1.IsUUID)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], Invoice.prototype, "userId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "timestamp" }),
    (0, class_validator_1.IsDateString)() // Validates if it's a valid date string (e.g., ISO 8601)
    ,
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", Date)
], Invoice.prototype, "invoiceDate", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "timestamp" }),
    (0, class_validator_1.IsDateString)() // Validates if it's a valid date string (e.g., ISO 8601)
    ,
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", Date)
], Invoice.prototype, "dueDate", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "decimal", precision: 10, scale: 2 }),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", Number)
], Invoice.prototype, "totalAmount", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "enum", enum: InvoiceStatus_1.InvoiceStatus, default: InvoiceStatus_1.InvoiceStatus.PENDING }),
    (0, class_validator_1.IsEnum)(InvoiceStatus_1.InvoiceStatus),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], Invoice.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "uuid", nullable: true }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], Invoice.prototype, "registrationId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => Event_1.Event, (event) => event.invoices) // Assuming 'invoices' property exists on Event entity
    ,
    (0, typeorm_1.JoinColumn)({ name: "eventId" }),
    __metadata("design:type", Event_1.Event)
], Invoice.prototype, "event", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => User_1.User, (user) => user.invoices) // Assuming 'invoices' property exists on User entity
    ,
    (0, typeorm_1.JoinColumn)({ name: "userId" }),
    __metadata("design:type", User_1.User)
], Invoice.prototype, "user", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "uuid", nullable: true }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", Object)
], Invoice.prototype, "venueId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => Venue_1.Venue, (venue) => venue.invoices, { nullable: true }),
    (0, typeorm_1.JoinColumn)({ name: "venueId" }),
    __metadata("design:type", Venue_1.Venue)
], Invoice.prototype, "venue", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => Payment_1.Payment, (payment) => payment.invoice),
    __metadata("design:type", Array)
], Invoice.prototype, "payments", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => VenueBooking_1.VenueBooking, (venueBooking) => venueBooking.invoice),
    __metadata("design:type", Array)
], Invoice.prototype, "venueBookings", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => InstallmentPlan_1.InstallmentPlan, (plan) => plan.invoice),
    __metadata("design:type", Array)
], Invoice.prototype, "installmentPlans", void 0);
__decorate([
    (0, typeorm_1.OneToOne)(() => Registration_1.Registration, (registration) => registration.invoice, {
        nullable: true,
    }),
    (0, typeorm_1.JoinColumn)({ name: "registrationId" }),
    __metadata("design:type", Registration_1.Registration)
], Invoice.prototype, "registration", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "timestamp", default: () => "CURRENT_TIMESTAMP" }),
    __metadata("design:type", Date)
], Invoice.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: "timestamp",
        default: () => "CURRENT_TIMESTAMP",
        onUpdate: "CURRENT_TIMESTAMP",
    }),
    __metadata("design:type", Date)
], Invoice.prototype, "updatedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "timestamp", nullable: true }),
    __metadata("design:type", Date)
], Invoice.prototype, "deletedAt", void 0);
exports.Invoice = Invoice = __decorate([
    (0, typeorm_1.Entity)("invoices")
], Invoice);
