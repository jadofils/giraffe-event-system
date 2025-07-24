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
import {
  IsUUID,
  IsNumber,
  Min,
  IsEnum,
  IsOptional,
  IsString,
} from "class-validator";

export enum VenueBookingPaymentStatus {
  PENDING = "PENDING",
  PARTIAL = "PARTIAL", // Partial payment (e.g., deposit) made, but not full
  PAID = "PAID",
  FAILED = "FAILED",
  CANCELLED = "CANCELLED",
  REFUNDED = "REFUNDED",
  REFUND_IN_PROGRESS = "REFUND_IN_PROGRESS",

}

export enum PayerType {
  USER = "USER",
  ORGANIZATION = "ORGANIZATION",
}

export enum PaymentMethod {
  CARD = "CARD",
  BANK_TRANSFER = "BANK_TRANSFER",
  MOBILE_MONEY = "MOBILE_MONEY",
  CASH = "CASH",
}

@Entity("venue_booking_payments")
export class VenueBookingPayment {
  @PrimaryGeneratedColumn("uuid")
  @IsUUID("4")
  paymentId!: string;

  @Column("uuid")
  @IsUUID("4")
  bookingId!: string;

  @ManyToOne(() => VenueBooking, { nullable: false })
  @JoinColumn({ name: "bookingId" })
  booking!: VenueBooking;

  @Column("uuid")
  @IsUUID("4")
  payerId!: string;

  @Column({ type: "enum", enum: PayerType })
  @IsEnum(PayerType)
  payerType!: PayerType;

  @Column({ type: "decimal", precision: 10, scale: 2 })
  @IsNumber()
  @Min(0)
  amountPaid!: number;

  @Column({
    type: "enum",
    enum: VenueBookingPaymentStatus,
    default: VenueBookingPaymentStatus.PENDING,
  })
  @IsEnum(VenueBookingPaymentStatus)
  paymentStatus!: VenueBookingPaymentStatus;

  @Column({ type: "enum", enum: PaymentMethod })
  @IsEnum(PaymentMethod)
  paymentMethod!: PaymentMethod;

  @Column({ type: "text", nullable: true })
  @IsOptional()
  @IsString()
  paymentReference?: string; // transaction id, etc.

  @Column({ type: "decimal", precision: 10, scale: 2, nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(0)
  remainingAmount?: number;

  @Column({ type: "boolean", default: false })
  isFullPayment!: boolean;

  @Column({ type: "text", nullable: true })
  @IsOptional()
  @IsString()
  notes?: string;

  @CreateDateColumn()
  paymentDate!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
