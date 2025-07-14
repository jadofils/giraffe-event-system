import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  ManyToMany,
  JoinTable,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
} from "typeorm";
import {
  IsUUID,
  IsNotEmpty,
  Length,
  IsEmail,
  IsString,
  IsOptional,
  IsPhoneNumber,
  IsBoolean,
  IsDateString,
  IsObject,
  IsUrl,
} from "class-validator";
import { Role } from "./Role";
import { Organization } from "./Organization";
import { Registration } from "./Registration";
import { VenueBooking } from "./VenueBooking";
import { VenueInvoice } from "./VenueInvoice";
import { VenuePayment } from "./VenuePayment";
import { Event } from "./Event";
import { Venue } from "./Venue Tables/Venue";
import { Invoice } from "./Invoice";
import { VenueReview } from "./Venue Tables/VenueReview";

@Entity("users")
export class User {
  @PrimaryGeneratedColumn("uuid")
  @IsUUID("4", { message: "userId must be a valid UUID" })
  userId!: string;

  @Column({ unique: true })
  @IsNotEmpty({ message: "username is required" })
  @Length(3, 50, {
    message:
      "username must be between $constraint1 and $constraint2 characters",
  })
  username!: string;

  @Column()
  @IsNotEmpty({ message: "firstName is required" })
  @Length(1, 50, {
    message:
      "firstName must be between $constraint1 and $constraint2 characters",
  })
  firstName!: string;

  @Column()
  @IsNotEmpty({ message: "lastName is required" })
  @Length(1, 50, {
    message:
      "lastName must be between $constraint1 and $constraint2 characters",
  })
  lastName!: string;

  @Column({ unique: true })
  @IsNotEmpty({ message: "email is required" })
  @IsEmail({}, { message: "email must be a valid email address" })
  email!: string;

  @Column({ nullable: true })
  @IsOptional()
  @IsString({ message: "password must be a string" })
  password?: string;

  @Column({ nullable: true })
  @IsOptional()
  @IsPhoneNumber(undefined, {
    message: "phoneNumber must be a valid phone number",
  })
  phoneNumber?: string;

  // --- Foreign Key for Role ---
  @Column({ type: "uuid" })
  @IsNotEmpty({ message: "roleId is required" })
  @IsUUID("4", { message: "roleId must be a valid UUID" })
  roleId!: string;

  // --- Relationships ---
  // Many-to-Many with Organization
  @ManyToMany(() => Organization, (organization) => organization.users)
  @JoinTable({
    name: "user_organizations",
    joinColumn: { name: "userId", referencedColumnName: "userId" },
    inverseJoinColumn: {
      name: "organizationId",
      referencedColumnName: "organizationId",
    },
  })
  organizations!: Organization[];

  // A User has one Role
  @ManyToOne(() => Role, (role) => role.users)
  @JoinColumn({ name: "roleId" })
  role!: Role;

  @OneToMany(() => VenueBooking, (booking) => booking.user)
  bookings!: VenueBooking[];

  @OneToMany(() => Registration, (registration) => registration.user)
  registrationsAsAttendee!: Registration[];

  @OneToMany(() => Registration, (registration) => registration.buyer)
  registrationsAsBuyer!: Registration[];

  @OneToMany(() => VenueInvoice, (venueInvoice) => venueInvoice.user)
  venueInvoices!: VenueInvoice[];

  @OneToMany(() => VenuePayment, (venuePayment) => venuePayment.user)
  venuePayments!: VenuePayment[];

  @OneToMany(() => Invoice, (invoice) => invoice.user)
  invoices!: Invoice[];

  @OneToMany(() => Registration, (registration) => registration.user)
  registrations!: Registration[];

  @OneToMany(() => Event, (event) => event.createdBy)
  createdEvents!: Event[];

  @ManyToMany(() => Venue, (venue) => venue.users)
  venues!: Venue[];

  @OneToMany(() => VenueReview, (review) => review.user)
  venueReviews!: VenueReview[];

  // --- NEW OPTIONAL USER PROFILE FIELDS ---
  @Column({ type: "varchar", length: 1000, nullable: true })
  @IsOptional()
  @IsString({ message: "bio must be a string" })
  @Length(0, 1000, { message: "bio must be at most $constraint2 characters" })
  bio?: string;

  @Column({ type: "varchar", length: 255, nullable: true })
  @IsOptional()
  @IsUrl({}, { message: "profilePictureURL must be a valid URL" })
  profilePictureURL?: string;

  @Column({ type: "varchar", length: 50, nullable: true })
  @IsOptional()
  @IsString({ message: "preferredLanguage must be a string" })
  @Length(0, 50, {
    message: "preferredLanguage must be at most $constraint2 characters",
  })
  preferredLanguage?: string;

  @Column({ type: "varchar", length: 50, nullable: true })
  @IsOptional()
  @IsString({ message: "timezone must be a string" })
  @Length(0, 50, {
    message: "timezone must be at most $constraint2 characters",
  })
  timezone?: string;

  @Column({ type: "boolean", default: true, nullable: true })
  @IsOptional()
  @IsBoolean({ message: "emailNotificationsEnabled must be a boolean" })
  emailNotificationsEnabled?: boolean;

  @Column({ type: "boolean", default: true, nullable: true })
  @IsOptional()
  @IsBoolean({ message: "smsNotificationsEnabled must be a boolean" })
  smsNotificationsEnabled?: boolean;

  @Column({ type: "jsonb", nullable: true })
  @IsOptional()
  @IsObject({ message: "socialMediaLinks must be an object" })
  socialMediaLinks?: object;

  @Column({ type: "date", nullable: true })
  @IsOptional()
  @IsDateString({}, { message: "dateOfBirth must be a valid date string" })
  dateOfBirth?: Date;

  @Column({ type: "varchar", length: 20, nullable: true })
  @IsOptional()
  @IsString({ message: "gender must be a string" })
  @Length(0, 20, { message: "gender must be at most $constraint2 characters" })
  gender?: string;

  @Column({ type: "varchar", length: 100, nullable: true })
  @IsOptional()
  @IsString({ message: "addressLine1 must be a string" })
  @Length(0, 100, {
    message: "addressLine1 must be at most $constraint2 characters",
  })
  addressLine1?: string;

  @Column({ type: "varchar", length: 100, nullable: true })
  @IsOptional()
  @IsString({ message: "addressLine2 must be a string" })
  @Length(0, 100, {
    message: "addressLine2 must be at most $constraint2 characters",
  })
  addressLine2?: string;

  @Column({ type: "varchar", length: 50, nullable: true })
  @IsOptional()
  @IsString({ message: "city must be a string" })
  @Length(0, 50, { message: "city must be at most $constraint2 characters" })
  city?: string;

  @Column({ type: "varchar", length: 50, nullable: true })
  @IsOptional()
  @IsString({ message: "stateProvince must be a string" })
  @Length(0, 50, {
    message: "stateProvince must be at most $constraint2 characters",
  })
  stateProvince?: string;

  @Column({ type: "varchar", length: 20, nullable: true })
  @IsOptional()
  @IsString({ message: "postalCode must be a string" })
  @Length(0, 20, {
    message: "postalCode must be at most $constraint2 characters",
  })
  postalCode?: string;

  @Column({ type: "varchar", length: 50, nullable: true })
  @IsOptional()
  @IsString({ message: "country must be a string" })
  @Length(0, 50, { message: "country must be at most $constraint2 characters" })
  country?: string;

  // Timestamp Columns
  @CreateDateColumn({ type: "timestamp with time zone" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "timestamp with time zone" })
  updatedAt!: Date;

  @DeleteDateColumn({ type: "timestamp with time zone", nullable: true })
  deletedAt?: Date;
}
