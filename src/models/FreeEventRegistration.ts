import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from "typeorm";
import { IsEmail, IsNotEmpty, IsPhoneNumber, IsUUID } from "class-validator";
import { Event } from "./Event Tables/Event";
import { User } from "./User"; // Import User entity
import { CheckInStaff } from "./CheckInStaff"; // Import CheckInStaff entity

@Entity("free_event_registrations")
export class FreeEventRegistration {
  @PrimaryGeneratedColumn("uuid")
  freeRegistrationId!: string;

  @Column()
  @IsUUID("4")
  eventId!: string;

  @ManyToOne(() => Event, (event) => event.freeRegistrations)
  @JoinColumn({ name: "eventId" })
  event!: Event;

  @Column({ nullable: true }) // Make fullName nullable
  fullName?: string; // Remove @IsNotEmpty()

  @Column()
  @IsEmail()
  email!: string;

  @Column({ nullable: true })
  phoneNumber?: string;

  @Column({ nullable: true })
  nationalId?: string;

  @Column({ nullable: true })
  gender?: string;

  @Column({ type: "jsonb", nullable: true })
  address?: {
    province?: string;
    district?: string;
    sector?: string;
    country?: string;
  }[];

  @Column({ unique: true })
  qrCode!: string;

  @Column({ unique: true })
  barcode!: string;

  @Column({ unique: true })
  sevenDigitCode!: string;

  @Column({ nullable: true }) // New field for PDF ticket URL
  pdfUrl?: string;

  @Column({ default: false })
  attended!: boolean;

  @Column("int", { default: 0 })
  attendedTimes!: number;

  @Column({ type: "jsonb", nullable: true, default: [] })
  checkInHistory?: {
    checkInDate: Date;
    checkInTime: string;
    method: string;
    checkedInByStaffId?: string;
  }[]; // Add checkedInByStaffId

  @Column({ default: false })
  isUsed!: boolean;

  @Column({ type: "uuid", nullable: true }) // New field for user who registered this
  @IsUUID("4", { message: "registeredByUserId must be a valid UUID" })
  registeredByUserId?: string;

  @ManyToOne(() => User, (user) => user.freeRegistrationsCreated) // Relationship to User
  @JoinColumn({ name: "registeredByUserId" })
  registeredBy?: User;

  @Column({ type: "uuid", nullable: true }) // New field for check-in staff
  @IsUUID("4", { message: "checkInStaffId must be a valid UUID" })
  checkInStaffId?: string;

  @ManyToOne(() => CheckInStaff, (staff) => staff.freeRegistrations)
  @JoinColumn({ name: "checkInStaffId" })
  checkedInBy?: CheckInStaff;

  @CreateDateColumn({ type: "timestamp with time zone" })
  registrationDate!: Date;
}
