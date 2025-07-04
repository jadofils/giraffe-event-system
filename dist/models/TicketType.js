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
exports.TicketType = void 0;
const typeorm_1 = require("typeorm");
const class_validator_1 = require("class-validator");
const Registration_1 = require("./Registration");
const TicketCategoryEnum_1 = require("../interfaces/Enums/TicketCategoryEnum");
const Event_1 = require("./Event");
const Organization_1 = require("./Organization");
let TicketType = class TicketType {
};
exports.TicketType = TicketType;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)("uuid"),
    (0, class_validator_1.IsUUID)("4", { message: "ticketTypeId must be a valid UUID" }),
    __metadata("design:type", String)
], TicketType.prototype, "ticketTypeId", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    (0, class_validator_1.IsNotEmpty)({ message: "ticketName is required" }),
    (0, class_validator_1.Length)(3, 50, { message: "ticketName must be between 3 and 50 characters" }),
    __metadata("design:type", String)
], TicketType.prototype, "ticketName", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "numeric", precision: 10, scale: 2, nullable: false }),
    (0, class_validator_1.IsNumber)({}, { message: "Price must be a number" }),
    (0, class_validator_1.IsPositive)({ message: "Price must be a positive number" }),
    __metadata("design:type", Number)
], TicketType.prototype, "price", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true, type: "text" }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.Length)(0, 1000, { message: "description must be at most 1000 characters" }),
    __metadata("design:type", String)
], TicketType.prototype, "description", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: "enum",
        enum: TicketCategoryEnum_1.TicketCategory,
        nullable: false,
        default: TicketCategoryEnum_1.TicketCategory.REGULAR,
    }),
    (0, class_validator_1.IsNotEmpty)({ message: "ticketCategory is required" }),
    __metadata("design:type", String)
], TicketType.prototype, "ticketCategory", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.Length)(0, 100, { message: "promoName must be at most 100 characters" }),
    __metadata("design:type", String)
], TicketType.prototype, "promoName", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true, type: "text" }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.Length)(0, 500, { message: "promoDescription must be at most 500 characters" }),
    __metadata("design:type", String)
], TicketType.prototype, "promoDescription", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "int", nullable: true }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)({}, { message: "Capacity must be a number" }),
    (0, class_validator_1.Min)(0, { message: "Capacity cannot be negative" }),
    __metadata("design:type", Number)
], TicketType.prototype, "capacity", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "timestamp", nullable: true }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)({}, { message: "availableFrom must be a valid date" }),
    __metadata("design:type", Date)
], TicketType.prototype, "availableFrom", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "timestamp", nullable: true }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)({}, { message: "availableUntil must be a valid date" }),
    __metadata("design:type", Date)
], TicketType.prototype, "availableUntil", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "boolean", default: true }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)({ message: "isActive must be a boolean value" }),
    __metadata("design:type", Boolean)
], TicketType.prototype, "isActive", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "int", nullable: true }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)({}, { message: "minQuantity must be a number" }),
    (0, class_validator_1.Min)(1, { message: "minQuantity must be at least 1" }),
    __metadata("design:type", Number)
], TicketType.prototype, "minQuantity", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "int", nullable: true }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)({}, { message: "maxQuantity must be a number" }),
    (0, class_validator_1.Min)(1, { message: "maxQuantity must be at least 1" }),
    __metadata("design:type", Number)
], TicketType.prototype, "maxQuantity", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "boolean", default: false }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)({ message: "requiresVerification must be a boolean value" }),
    __metadata("design:type", Boolean)
], TicketType.prototype, "requiresVerification", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "jsonb", nullable: true }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)({ message: "Perks must be an array" }),
    (0, class_validator_1.Length)(1, 100, { each: true, message: "Each perk must be between 1 and 100 characters" }),
    (0, class_validator_1.ArrayMinSize)(0),
    (0, class_validator_1.ArrayMaxSize)(20, { message: "Cannot have more than 20 perks" }),
    __metadata("design:type", Array)
], TicketType.prototype, "perks", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: "00000000-0000-0000-0000-000000000000" }),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], TicketType.prototype, "createdByUserId", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ type: "timestamp", default: () => "CURRENT_TIMESTAMP" }),
    __metadata("design:type", Date)
], TicketType.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({
        type: "timestamp",
        default: () => "CURRENT_TIMESTAMP",
        onUpdate: "CURRENT_TIMESTAMP",
    }),
    __metadata("design:type", Date)
], TicketType.prototype, "updatedAt", void 0);
__decorate([
    (0, typeorm_1.DeleteDateColumn)({ name: "deletedAt", type: "timestamp", nullable: true }),
    __metadata("design:type", Date)
], TicketType.prototype, "deletedAt", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => Registration_1.Registration, (registration) => registration.ticketType, { cascade: false }),
    __metadata("design:type", Array)
], TicketType.prototype, "registrations", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "uuid", nullable: true }),
    __metadata("design:type", String)
], TicketType.prototype, "eventId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => Event_1.Event, (event) => event.ticketTypes, { onDelete: "CASCADE" }),
    __metadata("design:type", Event_1.Event)
], TicketType.prototype, "event", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "uuid", nullable: true }),
    __metadata("design:type", String)
], TicketType.prototype, "organizationId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => Organization_1.Organization, (organization) => organization.ticketTypes, { nullable: true }),
    (0, typeorm_1.JoinColumn)({ name: "organizationId" }),
    __metadata("design:type", Organization_1.Organization)
], TicketType.prototype, "organization", void 0);
exports.TicketType = TicketType = __decorate([
    (0, typeorm_1.Entity)("ticket_types")
], TicketType);
