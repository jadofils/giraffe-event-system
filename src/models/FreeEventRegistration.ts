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

  @Column()
  @IsNotEmpty()
  fullName!: string;

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

  @Column({ default: false })
  attended!: boolean;

  @Column("int", { default: 0 })
  attendedTimes!: number;

  @Column({ type: "jsonb", nullable: true, default: [] })
  checkInHistory?: { checkInDate: Date; checkInTime: string; method: string }[];

  @Column({ default: false })
  isUsed!: boolean;

  @CreateDateColumn({ type: "timestamp with time zone" })
  registrationDate!: Date;
}
