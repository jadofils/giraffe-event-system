import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";
import { VenueBooking } from "./VenueBooking";

export enum VenueBookingPaymentStatus {
  PENDING = "PENDING",
  PARTIAL = "PARTIAL", // Partial payment (e.g., deposit) made, but not full
  PAID = "PAID",
  FAILED = "FAILED",
  CANCELLED = "CANCELLED",
  REFUNDED = "REFUNDED",
}

export enum PayerType {
  USER = "USER",
  ORGANIZATION = "ORGANIZATION",
}

@Entity("venue_booking_payments")
export class VenueBookingPayment {
  @PrimaryGeneratedColumn("uuid")
  paymentId!: string;

  @Column("uuid")
  bookingId!: string;

  @ManyToOne(() => VenueBooking, { nullable: false })
  @JoinColumn({ name: "bookingId" })
  booking!: VenueBooking;

  @Column("uuid")
  payerId!: string;

  @Column({ type: "enum", enum: PayerType })
  payerType!: PayerType;

  @Column({ type: "float", nullable: false })
  amountPaid!: number;

  @Column({
    type: "enum",
    enum: VenueBookingPaymentStatus,
    default: VenueBookingPaymentStatus.PENDING,
  })
  paymentStatus!: VenueBookingPaymentStatus;

  @Column({ type: "varchar", length: 50, nullable: true })
  paymentMethod?: string; // e.g., card, bank, cash

  @Column({ type: "text", nullable: true })
  paymentReference?: string; // transaction id, etc.

  @CreateDateColumn()
  paymentDate!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
