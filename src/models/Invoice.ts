// src/models/Invoice.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToOne,
  JoinColumn,
} from "typeorm";
import { Venue } from "./Venue Tables/Venue";
import { User } from "./User";
import { Event } from "./Event Tables/Event";
import { Registration } from "./Registration";

@Entity("invoices")
export class Invoice {
  @PrimaryGeneratedColumn("uuid")
  invoiceId!: string;

  @Column("uuid")
  venueId!: string;

  @ManyToOne(() => Venue)
  @JoinColumn({ name: "venueId" })
  venue!: Venue;

  @Column("uuid")
  userId!: string;

  @ManyToOne(() => User, (user) => user.invoices)
  @JoinColumn({ name: "userId" })
  user!: User;

  @Column("uuid")
  eventId!: string;

  @ManyToOne(() => Event, (event) => event.invoices)
  @JoinColumn({ name: "eventId" })
  event!: Event;

  @Column("uuid", { nullable: true })
  registrationId?: string;

  @OneToOne(() => Registration, (registration) => registration.invoice)
  @JoinColumn({ name: "registrationId" })
  registration?: Registration;

  @Column("uuid")
  payerId!: string;

  @Column()
  payerType!: string;

  @Column({ type: "decimal", precision: 10, scale: 2 })
  totalAmount!: number;

  @Column()
  status!: string;

  @Column({ type: "timestamp" })
  invoiceDate!: Date;

  @Column({ type: "timestamp" })
  dueDate!: Date;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
