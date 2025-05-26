// src/entity/Event.ts
import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    OneToMany,
    ManyToOne,
    JoinColumn,
    CreateDateColumn, // For timestamps
    UpdateDateColumn, // For timestamps
    DeleteDateColumn, // For soft deletes
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
    // IsDate and related date validators/decorators are removed
} from "class-validator";
// The custom IsAfter validator is no longer needed since startDate/endDate are removed
// import { registerDecorator, ValidationOptions, ValidationArguments } from 'class-validator';

import { Venue } from "./Venue";
import { User } from "./User";
import { VenueBooking } from "./VenueBooking"; // Corrected import name if the class is VenueBooking
import { Registration } from "./Registration";
import { Payment } from "./Payment"; // Assuming you have a Payment entity

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

    @Column({ type: "text", nullable: true }) // Use text for potentially longer descriptions
    @IsOptional()
    @Length(0, 5000, { // Increased length for description
        message: "Description must be at most $constraint2 characters long",
    })
    description?: string; // Made optional with '?'

    @Column({ nullable: true })
    @IsOptional()
    @Length(0, 50, {
        message: "Event category must be at most $constraint2 characters long",
    })
    eventCategory?: string; // Made optional with '?'

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
    maxAttendees?: number; // Made optional with '?'

    @Column({ type: "enum", enum: EventStatus, default: EventStatus.DRAFT })
    @IsEnum(EventStatus, { message: "Invalid event status" })
    status!: EventStatus;

    @Column({ default: false })
    @IsBoolean({ message: "isFeatured must be a boolean" })
    isFeatured!: boolean;

    @Column({ nullable: true })
    @IsOptional()
    @Length(0, 255, { message: "QR Code must be at most $constraint2 characters long" })
    qrCode?: string; // Storing the QR code string or a URL to it

    @Column({ nullable: true })
    @IsOptional()
    @Length(0, 255, { message: "Image URL must be at most $constraint2 characters long" })
    imageURL?: string; // Optional: URL to an event image

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
    @JoinColumn({ name: "venueId" }) // Maps to the venueId column
    venue!: Venue; // This relationship is required as per your design

    @ManyToOne(() => User, (user) => user.eventsOrganizer, { eager: true }) // eager load if you always need organizer info
    @JoinColumn({ name: "organizerId" }) // Maps to the organizerId column
    organizer!: User; // This relationship is required

    @OneToMany(() => VenueBooking, (booking) => booking.event)
    bookings!: VenueBooking[]; // Corrected to VenueBooking if that's the class name

    @OneToMany(() => Registration, registration => registration.event, { cascade: true })
    registrations!: Registration[];

    @OneToMany(() => Payment, payment => payment.event)
    payments!: Payment[]; // Assuming Payment entity has a ManyToOne to Event

    // --- Timestamps (Managed by TypeORM) ---
    @CreateDateColumn({ type: "timestamp with time zone" })
    createdAt!: Date;

    @UpdateDateColumn({ type: "timestamp with time zone" })
    updatedAt!: Date;

    @DeleteDateColumn({ type: "timestamp with time zone", nullable: true })
    deletedAt?: Date; // For soft deletes
}