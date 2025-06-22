import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  Index,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  ManyToMany,
} from 'typeorm';
import {
  IsUUID,
  IsNotEmpty,
  Length,
  IsString,
  IsEnum,
  IsNumber,
  Min,
  IsOptional,
} from 'class-validator';
import { Event } from './Event';
import { Venue } from './Venue';
import { Organization } from './Organization';
import { User } from './User';
import { VenueInvoice } from './VenueInvoice';

export enum ApprovalStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

@Entity('venue_bookings')
@Index(['eventId', 'venueId'], { unique: false })
export class VenueBooking {
  @PrimaryGeneratedColumn('uuid')
  @IsUUID('4', { message: 'bookingId must be a valid UUID' })
  bookingId!: string;

  @Column({ type: 'uuid' })
  @IsUUID('4', { message: 'eventId must be a valid UUID' })
  eventId!: string;

  @Column({ type: 'uuid' })
  @IsUUID('4', { message: 'venueId must be a valid UUID' })
  venueId!: string;

  @Column({ type: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID('4', { message: 'organizationId must be a valid UUID' })
  organizationId?: string;

  @Column({ type: 'uuid' })
  @IsUUID('4', { message: 'userId must be a valid UUID' })
  userId!: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0.00 })
  @IsNumber({}, { message: 'totalAmountDue must be a number' })
  @Min(0, { message: 'totalAmountDue cannot be negative' })
  totalAmountDue!: number;

  @Column({ type: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID('4', { message: 'venueInvoiceId must be a valid UUID' })
  venueInvoiceId?: string;

  @Column({ type: 'enum', enum: ApprovalStatus, default: ApprovalStatus.PENDING })
  @IsEnum(ApprovalStatus, { message: 'Invalid approval status' })
  approvalStatus!: ApprovalStatus;

  @Column({ nullable: true })
  notes?: string;
@ManyToOne(() => Event, (event) => event.venueBookings) // This now correctly points to the new property in Event
@JoinColumn({ name: 'eventId' })
event!: Event;
  // Relationships
 @ManyToOne(() => Venue, (venue) => venue.bookings, { nullable: false })
@JoinColumn({ name: 'venueId' })
venue!: Venue;

  @ManyToOne(() => User, (user) => user.bookings, { nullable: false })
  @JoinColumn({ name: 'userId' })
  user!: User;

  @ManyToOne(() => Organization, (organization) => organization.bookings, { nullable: true })
  @JoinColumn({ name: 'organizationId' })
  organization?: Organization;

  @ManyToOne(() => VenueInvoice, (venueInvoice) => venueInvoice.venueBookings)
  @JoinColumn({ name: 'venueInvoiceId' })
  venueInvoice?: VenueInvoice;



  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @DeleteDateColumn()
  deletedAt?: Date;
}