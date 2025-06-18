// src/models/VenueBooking.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  Index,
  JoinColumn,
  OneToOne, // Import OneToOne for the relationship with Event
  CreateDateColumn, // For createdAt
  UpdateDateColumn, // For updatedAt
  DeleteDateColumn, // For deletedAt
} from 'typeorm';
import {
  IsUUID,
  IsNotEmpty,
  Length,
  IsString,
  IsEnum,
  IsNumber,
  Min,
  IsOptional, // For nullable columns
} from 'class-validator';

import { Event } from './Event';
import { Venue } from './Venue';
import { Organization } from './Organization';
import { User } from './User';
import { VenueInvoice } from './VenueInvoice'; // Import the new VenueInvoice model

export enum ApprovalStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

@Entity('venue_bookings')
@Index(['eventId', 'venueId'], { unique: false }) // Added an index for common queries
export class VenueBooking {
  @PrimaryGeneratedColumn('uuid')
  @IsUUID('4', { message: 'bookingId must be a valid UUID' })
  bookingId!: string;

  // --- Foreign Key to Event (Replaces date/time duplication) ---
  @Column({ type: 'uuid', unique: true }) // One VenueBooking per Event (OneToOne on the Event side)
  @IsUUID('4', { message: 'eventId must be a valid UUID' })
  eventId!: string;

  // --- Foreign Key to Venue ---
  @Column({ type: 'uuid' }) // Explicitly define as UUID
  @IsUUID('4', { message: 'venueId must be a valid UUID' })
  venueId!: string;

  // --- Foreign Key to Organization (assuming the booking is tied to an org) ---
  @Column({ type: 'uuid', nullable: true }) // Made nullable as an event might not always have an organization booking the venue directly
  @IsOptional()
  @IsUUID('4', { message: 'organizationId must be a valid UUID' })
  organizationId?: string; // Changed to optional as column is nullable

  // --- Foreign Key to User (the user who made the booking request) ---
  @Column({ type: 'uuid' }) // Assuming a user always initiates a booking
  @IsUUID('4', { message: 'userId must be a valid UUID' })
  userId!: string;

  // --- NEW FIELD: totalAmountDue for this specific booking ---
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0.00 })
  @IsNumber({}, { message: 'totalAmountDue must be a number' })
  @Min(0, { message: 'totalAmountDue cannot be negative' })
  totalAmountDue!: number;

  // --- NEW FIELD: Foreign Key to VenueInvoice ---
  // A VenueBooking might be part of an invoice. Nullable if an invoice isn't immediately created.
  @Column({ type: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID('4', { message: 'venueInvoiceId must be a valid UUID' })
  venueInvoiceId?: string;


  @Column({ type: 'enum', enum: ApprovalStatus, default: ApprovalStatus.PENDING })
  @IsEnum(ApprovalStatus, { message: 'Invalid approval status' })
  approvalStatus!: ApprovalStatus;

  // Relationships

  // --- One-to-One with Event (inverse side of Event's OneToOne) ---
  // The event owns the FK, so this side is mappedBy.
  @OneToOne(() => Event, (event) => event.venueBooking)
  @JoinColumn({ name: 'eventId' }) // Specifies that eventId is the FK in THIS table for the OneToOne
  event!: Event;

  @ManyToOne(() => Venue, (venue) => venue.bookings, { nullable: false })
  @JoinColumn({ name: "venueId" }) // Corrected to 'venueId' based on the column above
  venue!: Venue;

  @ManyToOne(() => User, (user) => user.bookings, { nullable: false })
  @JoinColumn({ name: "userId" }) // Add JoinColumn for userId
  user!: User;

  @ManyToOne(() => Organization, (organization) => organization.bookings, { nullable: true })
  @JoinColumn({ name: "organizationId" }) // Add JoinColumn for organizationId
  organization?: Organization;

  // --- NEW RELATIONSHIP: Many-to-One with VenueInvoice ---
  @ManyToOne(() => VenueInvoice, (venueInvoice) => venueInvoice.venueBookings)
  @JoinColumn({ name: 'venueInvoiceId' })
  venueInvoice?: VenueInvoice; // Optional as it's nullable in the column

  // Timestamp Columns
  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @DeleteDateColumn()
  deletedAt?: Date; // Optional for soft-delete
}