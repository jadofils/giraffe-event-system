import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  DeleteDateColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import {
  IsUUID,
  IsNotEmpty,
  Length,
  IsNumber,
  IsPositive,
  IsOptional,
  Min,
  Max,
  IsBoolean,
  IsArray,
  ArrayMinSize,
  ArrayMaxSize,
  IsDateString,
} from "class-validator";
import { Registration } from "./Registration";
import { TicketCategory } from "../interfaces/Enums/TicketCategoryEnum";
import { Event } from "./Event Tables/Event";
import { Organization } from "./Organization";

@Entity("ticket_types")
export class TicketType {
  @PrimaryGeneratedColumn("uuid")
  @IsUUID("4", { message: "ticketTypeId must be a valid UUID" })
  ticketTypeId!: string;

  @Column()
  @IsNotEmpty({ message: "ticketName is required" })
  @Length(3, 50, { message: "ticketName must be between 3 and 50 characters" })
  ticketName!: string;

  @Column({ type: "numeric", precision: 10, scale: 2, nullable: false })
  @IsNumber({}, { message: "Price must be a number" })
  @IsPositive({ message: "Price must be a positive number" })
  price!: number;

  @Column({ nullable: true, type: "text" })
  @IsOptional()
  @Length(0, 1000, { message: "description must be at most 1000 characters" })
  description?: string;

  @Column({
    type: "enum",
    enum: TicketCategory,
    nullable: false,
    default: TicketCategory.REGULAR,
  })
  @IsNotEmpty({ message: "ticketCategory is required" })
  ticketCategory!: TicketCategory;

  @Column({ nullable: true })
  @IsOptional()
  @Length(0, 100, { message: "promoName must be at most 100 characters" })
  promoName?: string;

  @Column({ nullable: true, type: "text" })
  @IsOptional()
  @Length(0, 500, {
    message: "promoDescription must be at most 500 characters",
  })
  promoDescription?: string;

  @Column({ type: "int", nullable: true })
  @IsOptional()
  @IsNumber({}, { message: "Capacity must be a number" })
  @Min(0, { message: "Capacity cannot be negative" })
  capacity?: number;

  @Column({ type: "timestamp", nullable: true })
  @IsOptional()
  @IsDateString({}, { message: "availableFrom must be a valid date" })
  availableFrom?: Date;

  @Column({ type: "timestamp", nullable: true })
  @IsOptional()
  @IsDateString({}, { message: "availableUntil must be a valid date" })
  availableUntil?: Date;

  @Column({ type: "boolean", default: true })
  @IsOptional()
  @IsBoolean({ message: "isActive must be a boolean value" })
  isActive!: boolean;

  @Column({ type: "int", nullable: true })
  @IsOptional()
  @IsNumber({}, { message: "minQuantity must be a number" })
  @Min(1, { message: "minQuantity must be at least 1" })
  minQuantity?: number;

  @Column({ type: "int", nullable: true })
  @IsOptional()
  @IsNumber({}, { message: "maxQuantity must be a number" })
  @Min(1, { message: "maxQuantity must be at least 1" })
  maxQuantity?: number;

  @Column({ type: "boolean", default: false })
  @IsOptional()
  @IsBoolean({ message: "requiresVerification must be a boolean value" })
  requiresVerification!: boolean;

  @Column({ type: "jsonb", nullable: true })
  @IsOptional()
  @IsArray({ message: "Perks must be an array" })
  @Length(1, 100, {
    each: true,
    message: "Each perk must be between 1 and 100 characters",
  })
  @ArrayMinSize(0)
  @ArrayMaxSize(20, { message: "Cannot have more than 20 perks" })
  perks?: string[];

  @Column({ default: "00000000-0000-0000-0000-000000000000" })
  @IsUUID()
  createdByUserId!: string;

  @CreateDateColumn({ type: "timestamp", default: () => "CURRENT_TIMESTAMP" })
  createdAt!: Date;

  @UpdateDateColumn({
    type: "timestamp",
    default: () => "CURRENT_TIMESTAMP",
    onUpdate: "CURRENT_TIMESTAMP",
  })
  updatedAt!: Date;

  @DeleteDateColumn({ name: "deletedAt", type: "timestamp", nullable: true })
  deletedAt?: Date;

  @OneToMany(
    () => Registration,
    (registration: Registration) => registration.ticketType,
    { cascade: false }
  )
  registrations!: Registration[];

  @Column({ type: "uuid", nullable: true })
  eventId!: string;

  @ManyToOne(() => Event, (event) => event.ticketTypes, { onDelete: "CASCADE" })
  event!: Event;

  @Column({ type: "uuid", nullable: true })
  organizationId?: string;

  @ManyToOne(() => Organization, (organization) => organization.ticketTypes, {
    nullable: true,
  })
  @JoinColumn({ name: "organizationId" })
  organization?: Organization;
}
