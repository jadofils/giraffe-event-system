import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from "typeorm";
import { Event } from "./Event";

@Entity("event_guests")
export class EventGuest {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  eventId!: string;

  @ManyToOne(() => Event, (event) => event.eventGuests, { onDelete: "CASCADE" })
  @JoinColumn({ name: "eventId" })
  event!: Event;

  @Column({ length: 255 })
  guestName!: string;

  @Column({ type: "text", nullable: true })
  guestPhoto?: string;

  @CreateDateColumn({ type: "timestamp" })
  createdAt!: Date;
}
