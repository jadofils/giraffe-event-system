import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  JoinColumn,
  ManyToOne,
  OneToOne,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
} from "typeorm";
import {
  IsUUID,
  IsNotEmpty,
  IsDateString,
  IsNumber,
  IsPositive,
  Length,
  IsBoolean,
  IsOptional,
  ArrayMinSize,
  IsArray,
  ValidateIf,
} from "class-validator";
import { EventTicketType } from "./Event Tables/EventTicketType";
import { Event } from "./Event Tables/Event";
import { User } from "./User";
import { Venue } from "./Venue Tables/Venue";
import { Payment } from "./Payment"; // Keep this import for now if it's used elsewhere, but we'll remove the OneToOne to it
import { Invoice } from "./Invoice";
import { TicketPayment } from "./TicketPayment"; // NEW IMPORT

@Entity("registrations")
export class Registration {
  @PrimaryGeneratedColumn("uuid")
  @IsUUID("4", { message: "registrationId must be a valid UUID" })
  registrationId!: string;

  @ManyToOne(() => Event, (event) => event.registrations, {
    nullable: true,
    onDelete: "SET NULL",
  })
  @JoinColumn({ name: "eventId" })
  event!: Event;

  // Direct foreign key column for eventId
  @Column({ type: "uuid", nullable: true })
  @IsUUID("4")
  eventId!: string;

  @ManyToOne(() => User, (user) => user.registrationsAsAttendee, {
    nullable: true,
    onDelete: "SET NULL",
  })
  @JoinColumn({ name: "userId" })
  user!: User;

  // Direct foreign key column for userId
  @Column({ type: "uuid", nullable: true })
  @IsUUID("4")
  userId!: string;

  @Column({ type: "varchar", length: 255, nullable: true })
  attendeeName?: string; // Name of the person attending this specific ticket

  // --- CRUCIAL CHANGE HERE ---
  // Define the column to use PostgreSQL's native UUID array type
  @Column({ type: "json", nullable: true })
  @IsOptional()
  @IsArray()
  @IsUUID("4", { each: true, message: "Each ID must be a valid UUID" })
  boughtForIds?: string[]; // IDs of users this ticket was bought for

  @ManyToOne(() => User, (user) => user.registrationsAsBuyer, {
    nullable: true,
    onDelete: "SET NULL",
  })
  @JoinColumn({ name: "buyerId" })
  buyer?: User; // The user who made the purchase

  // Direct foreign key column for buyerId
  @Column({ type: "uuid", nullable: true })
  @IsUUID("4")
  buyerId?: string;

  @ManyToOne(
    () => EventTicketType,
    (eventTicketType) => eventTicketType.registrations,
    {
      nullable: true,
      onDelete: "SET NULL",
    }
  )
  @JoinColumn({ name: "ticketTypeId" })
  ticketType!: EventTicketType;

  // Direct foreign key column for ticketTypeId
  @Column({ type: "uuid", nullable: true })
  @IsUUID("4")
  ticketTypeId!: string;

  // @ManyToOne(() => Venue, (venue) => venue.registrations, {
  //   nullable: false,
  //   eager: true,
  // })
  @ManyToOne(() => Venue, (venue) => venue.registrations, {
    nullable: true,
    onDelete: "SET NULL",
  })
  @JoinColumn({ name: "venueId" })
  venue?: Venue;

  // Direct foreign key column for venueId
  @Column({ type: "uuid", nullable: true })
  @IsUUID("4")
  venueId?: string;

  @Column({ type: "int" })
  @IsNumber({}, { message: "noOfTickets must be a number" })
  @IsPositive({ message: "noOfTickets must be a positive number" })
  @IsNotEmpty({ message: "noOfTickets is required" })
  noOfTickets!: number;

  @Column({ type: "decimal", precision: 10, scale: 2, default: 0.0 })
  totalCost!: number;

  @Column({ type: "timestamptz", default: () => "CURRENT_TIMESTAMP" })
  @IsDateString(
    {},
    { message: "registrationDate must be a valid ISO date string" }
  )
  registrationDate!: Date; // Change to Date type to match TypeORM's handling of timestamptz

  @Column({ type: "date", nullable: true })
  @IsOptional()
  @IsDateString()
  attendedDate?: string; // The specific date this ticket is for (if event is multi-day)

  @Column({ default: "pending" })
  @IsNotEmpty({ message: "paymentStatus is required" })
  @Length(3, 50, {
    message: "paymentStatus must be between 3 and 50 characters",
  })
  paymentStatus!: string;

  @Column("varchar", { length: 255, nullable: true })
  qrCode?: string;

  @Column("varchar", { length: 255, nullable: true })
  barcode?: string;

  @Column({ type: "varchar", length: 7, nullable: true, unique: true })
  @IsOptional()
  @Length(7, 7, { message: "sevenDigitCode must be exactly 7 characters" })
  sevenDigitCode?: string;

  @Column({ type: "timestamptz", nullable: true })
  @IsOptional()
  @IsDateString(
    {},
    { message: "checkDate must be a valid ISO date string if provided" }
  )
  checkDate?: Date; // Change to Date type

  @Column({ type: "boolean", default: false })
  @IsBoolean({ message: "attended must be a boolean value" })
  attended!: boolean;

  @Column({ type: "boolean", default: false })
  @IsBoolean({ message: "isUsed must be a boolean value" })
  isUsed!: boolean;

  @Column({ type: "varchar", length: 50, default: "active" })
  registrationStatus!: string;

  @ManyToOne(
    () => TicketPayment,
    (ticketPayment) => ticketPayment.registrations,
    {
      cascade: true,
      onDelete: "SET NULL", // Keep SET NULL or change to CASCADE based on your desired behavior
      nullable: true,
    }
  )
  @JoinColumn({ name: "paymentId" }) // This column will store the ID of the TicketPayment
  payment?: TicketPayment;

  @Column({ type: "uuid", nullable: true })
  paymentId?: string;

  @Column("varchar", { length: 255, nullable: true })
  pdfUrl?: string; // New field for PDF ticket URL

  @OneToOne(() => Invoice, (invoice) => invoice.registration, {
    cascade: true,
    onDelete: "SET NULL",
    nullable: true,
  })
  @JoinColumn({ name: "invoiceId" })
  invoice?: Invoice;

  @Column({ type: "uuid", nullable: true }) // Explicit foreign key column
  invoiceId?: string; // Correctly place invoiceId here

  @CreateDateColumn({ type: "timestamptz", default: () => "CURRENT_TIMESTAMP" })
  createdAt!: Date;

  @UpdateDateColumn({
    type: "timestamptz",
    default: () => "CURRENT_TIMESTAMP",
    onUpdate: "CURRENT_TIMESTAMP",
  })
  updatedAt!: Date;

  @DeleteDateColumn({ type: "timestamptz", nullable: true })
  deletedAt?: Date; // Make sure this property matches the decorator
}
