import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { Event } from "./Event";
import { Venue } from "./Venue Tables/Venue";
import { User } from "./User";
import { Organization } from "./Organization";
import { Invoice } from "./Invoice";

export enum ApprovalStatus {
  PENDING = "pending",
  APPROVED = "approved",
  REJECTED = "rejected",
}

@Entity("venue_bookings")
export class VenueBooking {
  @PrimaryGeneratedColumn("uuid")
  bookingId!: string;

  @Column("uuid")
  @JoinColumn({ name: "event_id" })
  eventId!: string;

  @ManyToOne(() => Event, (event) => event.venueBookings, { nullable: false })
  event!: Event;

  @Column("uuid")
  @JoinColumn({ name: "venue_id" })
  venueId!: string;

  @ManyToOne(() => Venue, (venue) => venue.bookings, { nullable: false })
  venue!: Venue;

  @Column("uuid")
  @JoinColumn({ name: "user_id" })
  userId!: string;

  @ManyToOne(() => User, { nullable: false })
  user!: User;

  @Column("uuid", { nullable: true })
  @JoinColumn({ name: "organization_id" })
  organizationId?: string;

  @ManyToOne(() => Organization, { nullable: true })
  organization?: Organization;

  @Column("uuid", { nullable: true })
  @JoinColumn({ name: "venue_invoice_id" })
  venueInvoiceId?: string;

  @ManyToOne(() => Invoice, (invoice) => invoice.venueBookings, {
    nullable: true,
  })
  invoice?: Invoice;

  @Column({ type: "decimal", precision: 10, scale: 2 })
  totalAmountDue!: number;

  @Column({
    type: "enum",
    enum: ApprovalStatus,
    default: ApprovalStatus.PENDING,
  })
  approvalStatus!: ApprovalStatus;

  @Column({ type: "text", nullable: true })
  notes?: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt?: Date;

  @DeleteDateColumn()
  deletedAt?: Date;
}
