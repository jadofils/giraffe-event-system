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
import { User } from "./User";
import { Organization } from "./Organization";
import { VenueBooking } from "./VenueBooking";
import { Event } from "./Event";
import { Registration } from "./Registration";
import { VenueResource } from "./VenueResource";
import { Feedback } from "./Feedback";
import { Invoice } from "./Invoice";
import { Payment } from "./Payment";
import { Notification } from "./Notification";

export enum VenueStatus {
  PENDING = "PENDING",
  APPROVED = "APPROVED",
  CANCELLED = "CANCELLED",
  REJECTED = "REJECTED",
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

  @Column({ type: "decimal", precision: 10, scale: 2 })
  @IsNumber({}, { message: "amount must be a number" })
  @IsPositive({ message: "amount must be a positive number" })
  amount!: number;

  @Column()
  @IsNotEmpty({ message: "location is required" })
  @Length(3, 200, {
    message:
      "location must be between $constraint1 and $constraint2 characters",
  })
  location!: string;

  @Column({ type: "uuid", nullable: true })
  @IsOptional()
  @IsUUID("4", { message: "managerId must be a valid UUID", always: true })
  managerId?: string;

  @Column({ type: "double precision", nullable: true })
  @IsOptional()
  @IsNumber({}, { message: "latitude must be a number" })
  latitude?: number;

  @Column({ type: "double precision", nullable: true })
  @IsOptional()
  @IsNumber({}, { message: "longitude must be a number" })
  longitude?: number;

  @Column({ nullable: true })
  @IsOptional()
  @IsUrl({}, { message: "googleMapsLink must be a valid URL" })
  googleMapsLink?: string;

  @Column({ type: "uuid", nullable: true })
  @IsOptional()
  @IsUUID("4", { message: "organizationId must be a valid UUID" })
  organizationId?: string;

  // Relationships
  @ManyToOne(() => User, (user) => user.managedVenues)
  @JoinColumn({ name: "managerId" })
  manager?: User;

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

  @Column({ type: "varchar", length: 255, nullable: true })
  @IsOptional()
  amenities?: string;

  @Column({ type: "varchar", length: 100, nullable: true })
  @IsOptional()
  venueType?: string;

  @Column({ type: "varchar", length: 100, nullable: true })
  @IsOptional()
  contactPerson?: string;

  @Column({ type: "varchar", length: 100, nullable: true })
  @IsOptional()
  contactEmail?: string;

  @Column({ type: "varchar", length: 20, nullable: true })
  @IsOptional()
  contactPhone?: string;

  @Column({ type: "varchar", length: 255, nullable: true })
  @IsOptional()
  @IsUrl({}, { message: "websiteURL must be a valid URL" })
  websiteURL?: string;

  @OneToMany(() => VenueResource, (venueResource) => venueResource.venue)
  resources!: VenueResource[];

  // Feedbacks (ensure Feedback entity exists and is related to Venue)
  @OneToMany(() => Feedback, (feedback) => feedback.venue)
  feedbacks!: Feedback[];

  // Notifications (ensure Notification entity exists and is related to Venue)
  @OneToMany(() => Notification, (notification) => notification.venue)
  notifications!: Notification[];

  // EventVenueBookings (ensure VenueBooking entity supports this if different from bookings)
  @OneToMany(() => VenueBooking, (venueBooking) => venueBooking.venue)
  eventVenueBookings!: VenueBooking[];

  // Payments (ensure Payment entity exists and is related to Venue)
  @OneToMany(() => Payment, (payment) => payment.venue)
  payments!: Payment[];

  // Invoices (ensure Invoice entity exists and is related to Venue)
  @OneToMany(() => Invoice, (invoice) => invoice.venue)
  invoices!: Invoice[];

  @Column({
    type: "enum",
    enum: VenueStatus,
    default: VenueStatus.PENDING,
  })
  status!: VenueStatus;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @DeleteDateColumn()
  deletedAt?: Date;

  @Column({ type: "varchar", nullable: true })
  @IsOptional()
  @Length(3, 200, {
    message: "cancellationReason must be between 3 and 200 characters",
  })
  cancellationReason?: string;

  @Column({ nullable: true })
  @IsOptional()
  mainPhotoUrl?: string;

  @Column({ type: "simple-array", nullable: true })
  @IsOptional()
  subPhotoUrls?: string[];
}
