// src/entity/Event.ts
import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    OneToMany, // <--- Make sure OneToMany is imported
    ManyToOne,
    JoinColumn,
    CreateDateColumn,
    UpdateDateColumn,
    DeleteDateColumn,
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
} from "class-validator";

import { Venue } from "./Venue";
import { User } from "./User";
import { VenueBooking } from "./VenueBooking";
import { Registration } from "./Registration";
import { Payment } from "./Payment";
import { Invoice } from "./Invoice"; // <--- Import the Invoice entity

// --- Enums for Event ---
export enum EventType {
    PUBLIC = "public",
    PRIVATE = "private",
}

export enum EventStatus {
    DRAFT = "draft",
    PUBLISHED = "published",
    CANCELLED = "cancelled",
    COMPLETED = "completed",
    ARCHIVED = "archived",
}

// --- Event Entity Definition ---
@Entity("events")
export class Event {
    @PrimaryGeneratedColumn("uuid")
    @IsUUID("4", { message: "eventId must be a valid UUID" })
    eventId!: string;

    @Column()
    @IsNotEmpty({ message: "Event title is required" })
    @Length(3, 100, {
        message: "Event title must be between $constraint1 and $constraint2 characters",
    })
    eventTitle!: string;

    @Column({ type: "text", nullable: true })
    @IsOptional()
    @Length(0, 5000, {
        message: "Description must be at most $constraint2 characters long",
    })
    description?: string;

    @Column({ nullable: true })
    @IsOptional()
    @Length(0, 50, {
        message: "Event category must be at most $constraint2 characters long",
    })
    eventCategory?: string;

    @Column({
        type: "enum",
        enum: EventType,
        default: EventType.PUBLIC,
    })
    @IsEnum(EventType, {
        message: "Event type must be one of: public, private",
    })
    eventType!: EventType;

    @Column({ type: "int", nullable: true })
    @IsOptional()
    @IsInt({ message: "Max attendees must be an integer" })
    @Min(1, { message: "Max attendees must be at least 1" })
    maxAttendees?: number;

    @Column({ type: "enum", enum: EventStatus, default: EventStatus.DRAFT })
    @IsEnum(EventStatus, { message: "Invalid event status" })
    status!: EventStatus;

    @Column({ default: false })
    @IsBoolean({ message: "isFeatured must be a boolean" })
    isFeatured!: boolean;

    @Column({ nullable: true })
    @IsOptional()
    @Length(0, 255, { message: "QR Code must be at most $constraint2 characters long" })
    qrCode?: string;

    @Column({ nullable: true })
    @IsOptional()
    @Length(0, 255, { message: "Image URL must be at most $constraint2 characters long" })
    imageURL?: string;

    // --- Foreign Key Columns (Directly Stored) ---
    @Column({ type: "uuid" })
    @IsNotEmpty({ message: "Organizer ID is required" })
    @IsUUID("4", { message: "Organizer ID must be a valid UUID" })
    organizerId!: string;

    @Column({ type: "uuid" })
    @IsNotEmpty({ message: "Venue ID is required" })
    @IsUUID("4", { message: "Venue ID must be a valid UUID" })
    venueId!: string;

    // --- Relationships ---
    @ManyToOne(() => Venue, (venue) => venue.events)
    @JoinColumn({ name: "venueId" })
    venue!: Venue;

    @ManyToOne(() => User, (user) => user.eventsOrganizer, { eager: true })
    @JoinColumn({ name: "organizerId" })
    organizer!: User;

    @OneToMany(() => VenueBooking, (booking) => booking.event)
    bookings!: VenueBooking[];

    @OneToMany(() => Registration, registration => registration.event, { cascade: true })
    registrations!: Registration[];

    @OneToMany(() => Payment, payment => payment.event)
    payments!: Payment[];

    // --- NEW: Link to Invoice ---
    @OneToMany(() => Invoice, invoice => invoice.event) // An event can have many invoices
    invoices?: Invoice[]; // Use '?' as it might be an empty array if no invoices yet

    // --- Timestamps (Managed by TypeORM) ---
    @CreateDateColumn({ type: "timestamp with time zone" })
    createdAt!: Date;

    @UpdateDateColumn({ type: "timestamp with time zone" })
    updatedAt!: Date;

    @DeleteDateColumn({ type: "timestamp with time zone", nullable: true })
    deletedAt?: Date;
}