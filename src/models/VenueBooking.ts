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
import { IsArray, IsEnum, IsOptional, IsUUID } from "class-validator";
import { Event } from "./Event Tables/Event";

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
  @IsUUID("4")
  bookingId!: string;

  @Column("uuid")
  @IsUUID("4")
  venueId!: string;

  @ManyToOne(() => Venue, (venue) => venue.bookings, { nullable: false })
  @JoinColumn({ name: "venue_id" })
  venue!: Venue;

  @Column({ type: "enum", enum: EventType })
  @IsEnum(EventType)
  bookingReason!: EventType;

  @Column({ type: "text", nullable: true })
  otherReason?: string;

  @Column("uuid", { nullable: true })
  @IsOptional()
  @IsUUID("4")
  eventId?: string;

  @ManyToOne("Event", "venueBookings")
  @JoinColumn({ name: "eventId" })
  event?: Event;

  @Column("uuid")
  @IsUUID("4")
  createdBy!: string;

  @ManyToOne(() => User, (user) => user.bookings)
  @JoinColumn({ name: "created_by" })
  user!: User;

  @Column("json")
  @IsArray()
  bookingDates!: {
    date: string;
    hours?: number[];
  }[];

  @Column({ type: "enum", enum: VenueStatus, nullable: true })
  @IsEnum(VenueStatus)
  venueStatus?: VenueStatus;

  @Column({ type: "int", nullable: true })
  venueDiscountPercent?: number;

  @Column({ type: "varchar", length: 100, default: "UTC" })
  timezone!: string;

  @Column({ type: "enum", enum: BookingStatus, default: BookingStatus.PENDING })
  @IsEnum(BookingStatus)
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
