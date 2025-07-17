import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { Venue } from "./Venue Tables/Venue";
import { EventType } from "../interfaces/Enums/EventTypeEnum";
import { User } from "./User";

export enum VenueStatus {
  AVAILABLE = "AVAILABLE",
  BOOKED = "BOOKED",
  MAINTENANCE = "MAINTENANCE",
}

export enum BookingStatus {
  APPROVED_PAID = "APPROVED_PAID",
  APPROVED_NOT_PAID = "APPROVED_NOT_PAID",
  PENDING = "PENDING",
  CANCELLED = "CANCELLED",
}

@Entity("venue_bookings")
export class VenueBooking {
  @PrimaryGeneratedColumn("uuid")
  bookingId!: string;

  @Column("uuid")
  venueId!: string;

  @ManyToOne(() => Venue, (venue) => venue.bookings, { nullable: false })
  @JoinColumn({ name: "venue_id" })
  venue!: Venue;

  @Column({ type: "enum", enum: EventType })
  bookingReason!: EventType;

  @Column({ type: "text", nullable: true })
  otherReason?: string;

  @Column("uuid", { nullable: true })
  eventId?: string;

  @Column("uuid")
  createdBy!: string;

  @ManyToOne(() => User, (user) => user.bookings)
  @JoinColumn({ name: "created_by" })
  user!: User;

  @Column({ type: "date" })
  eventStartDate!: string;

  @Column({ type: "date" })
  eventEndDate!: string;

  @Column({ type: "time", nullable: true })
  startTime?: string;

  @Column({ type: "time", nullable: true })
  endTime?: string;

  @Column({ type: "enum", enum: VenueStatus, nullable: true })
  venueStatus?: VenueStatus;

  @Column({ type: "int", nullable: true })
  venueDiscountPercent?: number;

  @Column({ type: "varchar", length: 100, default: "UTC" })
  timezone!: string;

  @Column({ type: "enum", enum: BookingStatus, default: BookingStatus.PENDING })
  bookingStatus!: BookingStatus;

  @Column({ type: "float", nullable: true })
  amountToBePaid?: number;

  @Column({ type: "boolean", default: false })
  isPaid!: boolean;

  @Column({ type: "text", nullable: true })
  cancellationReason?: string;

  @CreateDateColumn()
  createdAt!: Date;
}
