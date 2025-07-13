import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  ManyToOne,
  ManyToMany,
  JoinTable,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
} from "typeorm";
import {
  IsNotEmpty,
  IsNumber,
  IsPositive,
  IsUUID,
  Length,
  IsOptional,
  IsUrl,
} from "class-validator";
import { User } from "../User";
import { Organization } from "../Organization";
import { VenueBooking } from "../VenueBooking";
import { Event } from "../Event";
import { Registration } from "../Registration";
import { Feedback } from "../Feedback";
import { Invoice } from "../Invoice";
import { Payment } from "../Payment";
import { Notification } from "../Notification";
import { VenueAmenities } from "./VenueAmenities";
import { BookingCondition } from "./BookingCondition";
import { VenueVariable } from "./VenueVariable";
import { VenueAvailabilitySlot } from "./VenueAvailabilitySlot";
import { VenueReview } from "./VenueReview";
import { VenueApproval } from "./VenueApproval";

export enum VenueStatus {
  PENDING = "PENDING",
  APPROVED = "APPROVED",
  CANCELLED = "CANCELLED",
  REJECTED = "REJECTED",
}

export enum BookingType {
  HOURLY = "HOURLY",
  DAILY = "DAILY",
}

@Entity("venues")
export class Venue {
  @PrimaryGeneratedColumn("uuid")
  @IsUUID("4", { message: "venueId must be a valid UUID" })
  venueId!: string;

  @Column()
  @IsNotEmpty({ message: "venueName is required" })
  @Length(3, 100, {
    message:
      "venueName must be between $constraint1 and $constraint2 characters",
  })
  venueName!: string;

  @Column()
  @IsNumber({}, { message: "capacity must be a number" })
  @IsPositive({ message: "capacity must be a positive number" })
  capacity!: number;

  @Column({ type: "text" })
  @IsNotEmpty({ message: "venueLocation is required" })
  venueLocation!: string;

  @Column({ type: "double precision", nullable: true })
  @IsOptional()
  @IsNumber({}, { message: "latitude must be a number" })
  latitude?: number;

  @Column({ type: "double precision", nullable: true })
  @IsOptional()
  @IsNumber({}, { message: "longitude must be a number" })
  longitude?: number;

  @Column({ type: "text", nullable: true })
  @IsOptional()
  @IsUrl({}, { message: "googleMapsLink must be a valid URL" })
  googleMapsLink?: string;

  @Column({ type: "uuid" })
  organizationId!: string;

  @Column({ type: "varchar", length: 100, nullable: true })
  venueTypeId?: string;

  @Column({ type: "text", nullable: true })
  mainPhotoUrl?: string;

  @Column({ type: "json", nullable: true })
  photoGallery?: string[];

  @Column({ type: "text", nullable: true })
  virtualTourUrl?: string;

  @Column({ type: "json", nullable: true })
  venueDocuments?: any;

  @Column({
    type: "enum",
    enum: VenueStatus,
    default: VenueStatus.PENDING,
  })
  status!: VenueStatus;

  @Column({ type: "varchar", nullable: true })
  cancellationReason?: string;

  @Column({ type: "boolean", default: false })
  visitPurposeOnly!: boolean;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @DeleteDateColumn()
  deletedAt?: Date;

  @Column({ type: "enum", enum: BookingType, default: BookingType.HOURLY })
  bookingType!: BookingType;

  // --- RELATIONSHIPS ---
  @ManyToOne(() => Organization, (organization) => organization.venues)
  @JoinColumn({ name: "organizationId" })
  organization?: Organization;

  @ManyToMany(() => User, (user) => user.venues)
  @JoinTable({
    name: "venue_users",
    joinColumn: { name: "venueId", referencedColumnName: "venueId" },
    inverseJoinColumn: { name: "userId", referencedColumnName: "userId" },
  })
  users!: User[];

  @OneToMany(() => VenueBooking, (venueBooking) => venueBooking.venue)
  bookings!: VenueBooking[];

  @ManyToMany(() => Event, (event) => event.venues)
  @JoinTable({
    name: "event_venues",
    joinColumn: { name: "venueId", referencedColumnName: "venueId" },
    inverseJoinColumn: { name: "eventId", referencedColumnName: "eventId" },
  })
  events!: Event[];

  @OneToMany(() => Registration, (registration) => registration.venue)
  registrations!: Registration[];

  @OneToMany(() => VenueAmenities, (venueAmenities) => venueAmenities.venue)
  amenities!: VenueAmenities[];

  @OneToMany(
    () => BookingCondition,
    (bookingCondition) => bookingCondition.venue
  )
  bookingConditions!: BookingCondition[];

  @OneToMany(() => VenueVariable, (venueVariable) => venueVariable.venue)
  venueVariables!: VenueVariable[];

  @OneToMany(() => VenueAvailabilitySlot, (slot) => slot.venue)
  availabilitySlots!: VenueAvailabilitySlot[];

  @OneToMany(() => VenueReview, (review) => review.venue)
  reviews!: VenueReview[];

  @OneToMany(() => VenueApproval, (approval) => approval.venue)
  approvals!: VenueApproval[];

  @OneToMany(() => Feedback, (feedback) => feedback.venue)
  feedbacks!: Feedback[];

  @OneToMany(() => Notification, (notification) => notification.venue)
  notifications!: Notification[];

  @OneToMany(() => VenueBooking, (venueBooking) => venueBooking.venue)
  eventVenueBookings!: VenueBooking[];

  @OneToMany(() => Payment, (payment) => payment.venue)
  payments!: Payment[];

  @OneToMany(() => Invoice, (invoice) => invoice.venue)
  invoices!: Invoice[];
}
