import { FreeEventRegistration } from "./FreeEventRegistration";
import { Event } from "./Event Tables/Event";
import { User } from "./User"; // This import might not be needed in CheckInStaff.ts, will remove if unused
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";
import { IsUUID, IsNotEmpty, IsPhoneNumber, IsEmail } from "class-validator";
import { Registration } from "./Registration";

@Entity("check_in_staff")
export class CheckInStaff {
  @PrimaryGeneratedColumn("uuid")
  staffId!: string;

  @Column()
  @IsUUID("4")
  eventId!: string;

  @ManyToOne(() => Event, (event: Event) => event.checkInStaff)
  @JoinColumn({ name: "eventId" })
  event!: Event;

  @OneToMany(
    () => FreeEventRegistration,
    (freeRegistration: FreeEventRegistration) => freeRegistration.checkedInBy
  )
  freeRegistrations!: FreeEventRegistration[];

  @OneToMany(
    () => Registration,
    (registration: Registration) => registration.checkedInByStaff
  )
  paidRegistrations!: Registration[];

  @Column()
  @IsNotEmpty()
  fullName!: string;

  @Column({ nullable: true })
  @IsEmail()
  email!: string;

  @Column({ nullable: true })
  @IsPhoneNumber()
  phoneNumber?: string;

  @Column({ nullable: true, unique: true })
  nationalId?: string;

  @Column({ type: "jsonb", nullable: true })
  address?: {
    province?: string;
    district?: string;
    sector?: string;
    country?: string;
  };

  @Column({ unique: true })
  sixDigitCode!: string;

  @CreateDateColumn({ type: "timestamp with time zone" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "timestamp with time zone" })
  updatedAt!: Date;
}
