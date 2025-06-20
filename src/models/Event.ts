import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  ManyToOne,
  ManyToMany,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  JoinTable,
} from 'typeorm';
import {
  IsUUID,
  IsNotEmpty,
  Length,
  IsOptional,
  IsEnum,
  IsInt,
  Min,
  IsBoolean,
  IsDateString,
  IsString,
} from 'class-validator';
import { Venue } from './Venue';
import { User } from './User';
import { Organization } from './Organization';
import { VenueBooking } from './VenueBooking';
import { Registration } from './Registration';
import { Payment } from './Payment';
import { Invoice } from './Invoice';
import { EventType } from '../interfaces/Enums/EventTypeEnum';
import { EventStatus } from '../interfaces/Enums/EventStatusEnum';
import { TicketType } from './TicketType';

@Entity('events')
export class Event {
  @PrimaryGeneratedColumn('uuid')
  @IsUUID('4', { message: 'eventId must be a valid UUID' })
  eventId!: string;

  @Column()
  @IsNotEmpty({ message: 'Event title is required' })
  @Length(3, 100, { message: 'Event title must be between $constraint1 and $constraint2 characters' })
  eventTitle!: string;

  @Column({ type: 'text', nullable: true })
  @IsOptional()
  @Length(0, 5000, { message: 'Description must be at most $constraint2 characters long' })
  description?: string;

  @Column({ type: 'enum', enum: EventType, default: EventType.PUBLIC })
  @IsEnum(EventType, { message: 'Event type must be one of: public, private' })
  eventType!: EventType;

  @Column({ type: 'timestamp with time zone', nullable: true })
  @IsOptional()
  @IsDateString({}, { message: 'Start date must be a valid date' })
  startDate!: Date;

  @Column({ type: 'timestamp with time zone', nullable: true })
  @IsOptional()
  @IsDateString({}, { message: 'End date must be a valid date' })
  endDate!: Date;

  @Column({ nullable: true })
  @IsOptional()
  @IsString({ message: 'Start time must be a string' })
  startTime!: string;

  @Column({ nullable: true })
  @IsOptional()
  @IsString({ message: 'End time must be a string' })
  endTime!: string;

  @Column({ type: 'int', nullable: true })
  @IsOptional()
  @IsInt({ message: 'Max attendees must be an integer' })
  @Min(1, { message: 'Max attendees must be at least 1' })
  maxAttendees?: number;

  @Column({ type: 'enum', enum: EventStatus, default: EventStatus.PENDING })
  @IsEnum(EventStatus, { message: 'Invalid event status' })
  status!: EventStatus;

  @Column({ default: false })
  @IsBoolean({ message: 'isFeatured must be a boolean' })
  isFeatured!: boolean;

  @Column({ nullable: true })
  @IsOptional()
  @Length(0, 255, { message: 'QR Code must be at most $constraint2 characters long' })
  qrCode?: string;

  @Column({ nullable: true })
  @IsOptional()
  @Length(0, 255, { message: 'Image URL must be at most $constraint2 characters long' })
  imageURL?: string;

  @Column({ type: 'uuid' })
  @IsNotEmpty({ message: 'Organization ID is required' })
  @IsUUID('4', { message: 'Organization ID must be a valid UUID' })
  organizationId!: string;

  @Column({ type: 'uuid' })
  @IsNotEmpty({ message: 'Organizer ID is required' })
  @IsUUID('4', { message: 'Organizer ID must be a valid UUID' })
  organizerId!: string;

  @Column({ type: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID('4', { message: 'createdByUserId must be a valid UUID' })
  createdByUserId?: string;

  @Column({ type: 'json', nullable: true })
  socialMediaLinks?: { [key: string]: string };

  // Relationships
  @ManyToOne(() => Organization, (organization) => organization.events)
  @JoinColumn({ name: 'organizationId' })
  organization!: Organization;

  @ManyToOne(() => User, (user) => user.createdEvents)
  @JoinColumn({ name: 'organizerId' })
  organizer!: User;

  @ManyToOne(() => User, (user) => user.createdEvents)
  @JoinColumn({ name: 'createdByUserId' })
  createdBy?: User;

  @ManyToMany(() => Venue, (venue) => venue.events)
  venues!: Venue[];

  @Column({ type: 'varchar', length: 100, nullable: true })
  @IsOptional()
  @Length(0, 100, { message: 'Event category must be at most 100 characters' })
  eventCategory?: string;

  @ManyToMany(() => VenueBooking, (venueBooking) => venueBooking.events)
  @JoinTable({
    name: 'event_venue_bookings',
    joinColumn: { name: 'eventId', referencedColumnName: 'eventId' },
    inverseJoinColumn: { name: 'bookingId', referencedColumnName: 'bookingId' },
  })
  venueBookings!: VenueBooking[];

  @OneToMany(() => Registration, (registration) => registration.event, { cascade: false })
  registrations!: Registration[];

  @OneToMany(() => Payment, (payment) => payment.event)
  payments!: Payment[];

  @OneToMany(() => Invoice, (invoice) => invoice.event)
  invoices?: Invoice[];

  @OneToMany(() => TicketType, (ticketType) => ticketType.event)
  ticketTypes!: TicketType[];

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updatedAt!: Date;

  @DeleteDateColumn({ type: 'timestamp with time zone', nullable: true })
  deletedAt?: Date;
}