import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";
import { Event } from "./Event";
import { Venue } from "../Venue Tables/Venue";

@Entity("event_venues")
export class EventVenue {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column("uuid")
  eventId!: string;

  @Column("uuid")
  venueId!: string;

  @Column("json")
  bookingDates!: {
    date: string;
    hours?: number[];
  }[];

  @Column({ type: "varchar", length: 100, default: "UTC" })
  timezone!: string;

  @ManyToOne(() => Event, (event) => event.eventVenues)
  @JoinColumn({ name: "eventId" })
  event!: Event;

  @ManyToOne(() => Venue, (venue) => venue.eventVenues)
  @JoinColumn({ name: "venueId" })
  venue!: Venue;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
