// src/models/VenuePayment.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
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
  IsString,
} from 'class-validator';

import { User } from './User'; // To link to the user who made the payment
import { VenueInvoice } from './VenueInvoice'; // To link to the invoice being paid

// You might have a global PaymentStatus enum, or define one here if specific to venue payments
// For now, let's assume you'll use the existing PaymentStatusEnum if available, or create a simple one.
// If you have PaymentStatusEnum in src/interfaces/Enums/PaymentStatusEnum.ts, import it.
// Example: import { PaymentStatusEnum } from '../interfaces/Enums/PaymentStatusEnum';

// For simplicity, let's define a basic enum if you don't have a shared one covering these statuses
export enum VenuePaymentStatus {
  SUCCESS = 'SUCCESS',
  PENDING = 'PENDING',
  FAILED = 'FAILED',
  REFUNDED = 'REFUNDED',
}

@Entity('venue_payments')
export class VenuePayment {
  @PrimaryGeneratedColumn('uuid')
  @IsUUID('4', { message: 'venuePaymentId must be a valid UUID' })
  venuePaymentId!: string;

  // Foreign key to the VenueInvoice this payment is for
  @Column({ type: 'uuid' })
  @IsNotEmpty({ message: 'venueInvoiceId is required' })
  @IsUUID('4', { message: 'venueInvoiceId must be a valid UUID' })
  venueInvoiceId!: string;

  // Foreign key to the user who made the payment
  @Column({ type: 'uuid' })
  @IsNotEmpty({ message: 'userId is required' })
  @IsUUID('4', { message: 'userId must be a valid UUID' })
  userId!: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  @IsNotEmpty({ message: 'Amount is required' })
  @IsNumber({}, { message: 'Amount must be a number' })
  @Min(0.01, { message: 'Amount must be positive' }) // Payment must be at least a cent
  amount!: number;

  @Column({ nullable: true })
  @IsOptional()
  @IsString({ message: 'Payment method must be a string' })
  @Length(3, 50, { message: 'Payment method must be between $constraint1 and $constraint2 characters' })
  paymentMethod?: string; // e.g., 'Credit Card', 'Mobile Money', 'Bank Transfer'

  @Column({ unique: true, nullable: true })
  @IsOptional()
  @IsString({ message: 'Transaction ID must be a string' })
  @Length(5, 255, { message: 'Transaction ID must be between $constraint1 and $constraint2 characters' })
  transactionId?: string; // Unique ID from a payment gateway

  @Column({ type: 'enum', enum: VenuePaymentStatus, default: VenuePaymentStatus.PENDING })
  @IsEnum(VenuePaymentStatus, { message: 'Invalid payment status' })
  status!: VenuePaymentStatus;

  @Column({ type: 'text', nullable: true })
  @IsOptional()
  notes?: string; // Any additional notes about the payment

  // Relationships
  @ManyToOne(() => VenueInvoice, venueInvoice => venueInvoice.venuePayments)
  @JoinColumn({ name: 'venueInvoiceId' })
  venueInvoice!: VenueInvoice;

  @ManyToOne(() => User, user => user.venuePayments)
  @JoinColumn({ name: 'userId' })
  user!: User;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @DeleteDateColumn()
  deletedAt?: Date;
}