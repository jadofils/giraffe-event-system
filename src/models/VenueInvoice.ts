// src/models/VenueInvoice.ts
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
} from 'typeorm';
import {
  IsUUID,
  IsNotEmpty,
  IsNumber,
  Min,
  IsEnum,
  IsDateString,
  IsOptional,
  Length,
} from 'class-validator';

import { VenueBooking } from './VenueBooking'; // To link to specific venue bookings
import { VenuePayment } from './VenuePayment';   // To link to payments for this invoice
import { User } from './User';                 // The user/organization responsible for this invoice
import { Organization } from './Organization'; // If invoices are specifically for an organization

// You can use a common InvoiceStatus enum or create a specific one if needed
// For now, let's assume you'll use the existing one from your Invoice model.
import { InvoiceStatus } from '../interfaces/Enums/InvoiceStatus'; // Adjust path if necessary

@Entity('venue_invoices')
export class VenueInvoice {
  @PrimaryGeneratedColumn('uuid')
  @IsUUID('4', { message: 'venueInvoiceId must be a valid UUID' })
  venueInvoiceId!: string;

  // A unique, human-readable invoice number for venue invoices
  @Column({ unique: true })
  @IsNotEmpty({ message: 'Invoice number is required' })
  @Length(5, 50, { message: 'Invoice number must be between $constraint1 and $constraint2 characters' })
  invoiceNumber!: string;

  @Column({ type: 'uuid' })
  @IsNotEmpty({ message: 'User ID for venue invoice is required' })
  @IsUUID('4', { message: 'userId must be a valid UUID' })
  userId!: string; // The user who is liable for this venue invoice

  @Column({ type: 'uuid', nullable: true }) // Optional, if a venue invoice can be tied to a specific organization directly
  @IsOptional()
  @IsUUID('4', { message: 'organizationId must be a valid UUID' })
  organizationId?: string;

  @Column({ type: 'timestamp with time zone' })
  @IsNotEmpty({ message: 'Issue date is required' })
  @IsDateString({}, { message: 'issueDate must be a valid ISO 8601 timestamp' })
  issueDate!: Date;

  @Column({ type: 'timestamp with time zone' })
  @IsNotEmpty({ message: 'Due date is required' })
  @IsDateString({}, { message: 'dueDate must be a valid ISO 8601 timestamp' })
  dueDate!: Date;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0.00 })
  @IsNumber({}, { message: 'Total amount must be a number' })
  @Min(0, { message: 'Total amount cannot be negative' })
  totalAmount!: number; // Sum of all linked VenueBooking totalAmountDue

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0.00 })
  @IsNumber({}, { message: 'Amount paid must be a number' })
  @Min(0, { message: 'Amount paid cannot be negative' })
  amountPaid!: number;

  @Column({ type: 'enum', enum: InvoiceStatus, default: InvoiceStatus.PENDING })
  @IsEnum(InvoiceStatus, { message: 'Invalid invoice status' })
  status!: InvoiceStatus;

  // Relationships
  @ManyToOne(() => User, user => user.venueInvoices)
  @JoinColumn({ name: 'userId' })
  user!: User;

  @ManyToOne(() => Organization, organization => organization.venueInvoices)
  @JoinColumn({ name: 'organizationId' })
  organization?: Organization; // Optional relationship

  @OneToMany(() => VenueBooking, venueBooking => venueBooking.venueInvoice)
  venueBookings!: VenueBooking[]; // An invoice can cover multiple venue bookings

  @OneToMany(() => VenuePayment, venuePayment => venuePayment.venueInvoice)
  venuePayments!: VenuePayment[]; // An invoice can have multiple payments (for partial payments)

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @DeleteDateColumn()
  deletedAt?: Date;
}