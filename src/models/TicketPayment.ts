import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany, // Added OneToMany import
} from "typeorm";
import {
  IsUUID,
  IsNumber,
  IsNotEmpty,
  IsEnum,
  IsString,
  IsOptional,
} from "class-validator";
import { Registration } from "./Registration"; // Import the Registration model
import {
  PaymentMethod,
  VenueBookingPaymentStatus,
} from "../models/VenueBookingPayment"; // Reuse enums if applicable
import { User } from "./User"; // Assuming a User model for payer
import { Organization } from "./Organization"; // Assuming an Organization model for payer

@Entity("ticket_payments") // Table name in your database
export class TicketPayment {
  @PrimaryGeneratedColumn("uuid")
  @IsUUID("4")
  paymentId!: string;

  // Link to the Registration (ticket) that this payment is for
  @OneToMany(() => Registration, (registration) => registration.payment) // Changed to OneToMany
  registrations!: Registration[]; // Changed to an array of registrations

  @Column("decimal", { precision: 10, scale: 2 })
  @IsNumber()
  @IsNotEmpty()
  amountPaid!: number;

  @Column({ type: "enum", enum: PaymentMethod, default: PaymentMethod.CARD }) // Reusing PaymentMethod enum
  @IsEnum(PaymentMethod)
  paymentMethod!: PaymentMethod;

  @Column({
    type: "enum",
    enum: VenueBookingPaymentStatus,
    default: VenueBookingPaymentStatus.PENDING,
  }) // Reusing payment status enum
  @IsEnum(VenueBookingPaymentStatus)
  paymentStatus!: VenueBookingPaymentStatus;

  @Column({ type: "varchar", length: 255, nullable: true })
  @IsOptional()
  @IsString()
  paymentReference?: string; // e.g., Stripe charge ID, PayPal transaction ID

  @Column({ type: "uuid", nullable: true }) // ID of the user or organization who made the payment
  @IsOptional()
  @IsUUID("4")
  payerId?: string;

  @Column({ type: "varchar", length: 50, nullable: true }) // Type of payer: 'USER' or 'ORGANIZATION'
  @IsOptional()
  @IsString()
  payerType?: "USER" | "ORGANIZATION";

  @Column({ type: "text", nullable: true })
  @IsOptional()
  @IsString()
  notes?: string; // Any additional notes about the payment

  @CreateDateColumn({ type: "timestamp with time zone" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "timestamp with time zone" })
  updatedAt!: Date;
}
