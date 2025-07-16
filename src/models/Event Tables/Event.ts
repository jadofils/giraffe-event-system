import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  JoinTable,
} from "typeorm";
import {
  IsUUID,
  IsNotEmpty,
  Length,
  IsOptional,
  IsEnum,
  IsInt,
  Min,
  IsBoolean,
  IsString,
} from "class-validator";
import { Venue } from "../Venue Tables/Venue";
import { User } from "../User";
import { Organization } from "../Organization";
import { VenueBooking } from "../VenueBooking";
import { Registration } from "../Registration";
import { Payment } from "../Payment";
import { Invoice } from "../Invoice";
import { EventType } from "../../interfaces/Enums/EventTypeEnum";
import { EventStatus } from "../../interfaces/Enums/EventStatusEnum";
import { TicketType } from "../TicketType";
import { EventVenue } from "./EventVenue";
import { EventGuest } from "./EventGuest";

@Entity("events")
export class Event {
  @PrimaryGeneratedColumn("uuid")
  @IsUUID("4", { message: "eventId must be a valid UUID" })
  eventId!: string;

  @Column({ length: 255 })
  @IsNotEmpty({ message: "Event title is required" })
  @Length(3, 100, {
    message:
      "Event title must be between $constraint1 and $constraint2 characters",
  })
  eventName!: string;

  @Column({ type: "enum", enum: EventType })
  @IsEnum(EventType, { message: "Event type must be one of: public, private" })
  eventType!: EventType;

  @Column({ type: "text", nullable: true })
  @IsOptional()
  @Length(0, 5000, {
    message: "Description must be at most $constraint2 characters long",
  })
  eventOtherType?: string;

  @Column({ type: "text", nullable: true })
  @IsOptional()
  @Length(0, 5000, {
    message: "Description must be at most $constraint2 characters long",
  })
  eventDescription?: string;

  @Column({ type: "text", nullable: true })
  @IsOptional()
  @Length(0, 5000, {
    message: "Description must be at most $constraint2 characters long",
  })
  eventPhoto?: string;

  @Column({ type: "varchar", length: 10, nullable: true })
  @IsNotEmpty({ message: "Start date is required" })
  @Length(10, 10, { message: "Start date must be in YYYY-MM-DD format" })
  startDate!: string;

  @Column({ type: "varchar", length: 10, nullable: true })
  @IsNotEmpty({ message: "End date is required" })
  @Length(10, 10, { message: "End date must be in YYYY-MM-DD format" })
  endDate!: string;

  @Column({ type: "varchar", length: 8, nullable: true })
  @IsNotEmpty({ message: "Start time is required" })
  @IsString({ message: "Start time must be a string" })
  startTime!: string;

  @Column({ type: "varchar", length: 8, nullable: true })
  @IsNotEmpty({ message: "End time is required" })
  @IsString({ message: "End time must be a string" })
  endTime!: string;

  @Column({ type: "int", nullable: true })
  @IsOptional()
  @IsInt({ message: "Max attendees must be an integer" })
  @Min(1, { message: "Max attendees must be at least 1" })
  maxAttendees?: number;

  @Column({ type: "enum", enum: EventStatus, default: EventStatus.REQUESTED })
  @IsEnum(EventStatus, { message: "Invalid event status" })
  eventStatus!: EventStatus;

  @Column({ default: false })
  @IsBoolean({ message: "isFeatured must be a boolean" })
  isFeatured!: boolean;

  @Column({ nullable: true })
  @IsOptional()
  @Length(0, 255, {
    message: "QR Code must be at most $constraint2 characters long",
  })
  qrCode?: string;

  @Column({ nullable: true })
  @IsOptional()
  @Length(0, 255, {
    message: "Image URL must be at most $constraint2 characters long",
  })
  imageURL?: string;

  @Column({ type: "uuid" })
  @IsNotEmpty({ message: "Event organizer ID is required" })
  @IsUUID("4", { message: "Event organizer ID must be a valid UUID" })
  eventOrganizerId!: string;

  @Column({ type: "enum", enum: ["USER", "ORGANIZATION"] })
  @IsEnum(["USER", "ORGANIZATION"], {
    message: "Event organizer type must be USER or ORGANIZATION",
  })
  eventOrganizerType!: "USER" | "ORGANIZATION";

  @Column({ type: "uuid", nullable: true })
  @IsOptional()
  @IsUUID("4", { message: "createdByUserId must be a valid UUID" })
  createdByUserId?: string;

  @Column({ type: "json", nullable: true })
  socialMediaLinks?: { [key: string]: string };

  @Column({ type: "int", nullable: true })
  @IsOptional()
  @IsInt({ message: "Max attendees must be an integer" })
  @Min(1, { message: "Max attendees must be at least 1" })
  expectedGuests?: number;

  @Column({ type: "text", nullable: true })
  @IsOptional()
  @Length(0, 5000, {
    message: "Special notes must be at most $constraint2 characters long",
  })
  specialNotes?: string;

  @Column({ type: "boolean", default: false })
  @IsBoolean({ message: "isEntryPaid must be a boolean" })
  isEntryPaid!: boolean;

  @Column({ type: "boolean", default: false })
  @IsBoolean({ message: "isPublic must be a boolean" })
  isPublic!: boolean;

  @Column({ type: "enum", enum: ["PUBLIC", "PRIVATE"] })
  @IsEnum(["PUBLIC", "PRIVATE"], {
    message: "Visibility scope must be one of: PUBLIC, PRIVATE",
  })
  visibilityScope!: "PUBLIC" | "PRIVATE";

  @Column({ type: "enum", enum: ["DRAFT", "PUBLISHED"], default: "DRAFT" })
  @IsEnum(["DRAFT", "PUBLISHED"], {
    message: "Publish status must be one of: DRAFT, PUBLISHED",
  })
  publishStatus!: "DRAFT" | "PUBLISHED";

  // Relationships
  @ManyToOne(() => User, (user) => user.createdEvents)
  @JoinColumn({ name: "createdByUserId" })
  createdBy?: User;

  @OneToMany(() => Registration, (registration) => registration.event, {
    cascade: false,
  })
  registrations!: Registration[];

  @OneToMany(() => Payment, (payment) => payment.event)
  payments!: Payment[];

  @OneToMany(() => Invoice, (invoice) => invoice.event)
  invoices?: Invoice[];

  @OneToMany(() => TicketType, (ticketType) => ticketType.event)
  ticketTypes!: TicketType[];

  @OneToMany(() => EventVenue, (ev) => ev.event, { cascade: true })
  eventVenues!: EventVenue[];

  @OneToMany(() => EventGuest, (guest) => guest.event, { cascade: true })
  eventGuests!: EventGuest[];

  @CreateDateColumn({ type: "timestamp with time zone" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "timestamp with time zone" })
  updatedAt!: Date;

  @DeleteDateColumn({ type: "timestamp with time zone", nullable: true })
  deletedAt?: Date;
}
