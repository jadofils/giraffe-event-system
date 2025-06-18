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
exports.Role = void 0;
// src/models/Role.ts
const typeorm_1 = require("typeorm");
const class_validator_1 = require("class-validator");
const User_1 = require("./User");
let Role = class Role {
};
exports.Role = Role;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    (0, class_validator_1.IsUUID)('4', { message: 'roleId must be a valid UUID' }) // Added validation message
    ,
    __metadata("design:type", String)
], Role.prototype, "roleId", void 0);
__decorate([
    (0, typeorm_1.Column)({ unique: true }),
    (0, class_validator_1.IsNotEmpty)({ message: 'roleName is required' }),
    (0, class_validator_1.Length)(3, 50, { message: 'roleName must be between $constraint1 and $constraint2 characters' }),
    __metadata("design:type", String)
], Role.prototype, "roleName", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-array', { nullable: true }) // Good choice for simple permission arrays
    ,
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)({ message: 'permissions must be an array' }) // Added array validation
    ,
    __metadata("design:type", Array)
], Role.prototype, "permissions", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }) // Explicitly define type 'text'
    ,
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.Length)(0, 500, { message: 'description must be at most $constraint2 characters' }) // Added validation message
    ,
    __metadata("design:type", String)
], Role.prototype, "description", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => User_1.User, user => user.role),
    __metadata("design:type", Array)
], Role.prototype, "users", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ type: 'timestamp with time zone' }) // Explicit type
    ,
    __metadata("design:type", Date)
], Role.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ type: 'timestamp with time zone' }) // Explicit type
    ,
    __metadata("design:type", Date)
], Role.prototype, "updatedAt", void 0);
__decorate([
    (0, typeorm_1.DeleteDateColumn)({ type: 'timestamp with time zone', nullable: true }) // Added for consistency with other models
    ,
    __metadata("design:type", Date)
], Role.prototype, "deletedAt", void 0);
exports.Role = Role = __decorate([
    (0, typeorm_1.Entity)('roles')
], Role);
