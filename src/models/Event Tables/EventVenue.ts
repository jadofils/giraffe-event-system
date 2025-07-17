import { Entity, PrimaryColumn, ManyToOne, JoinColumn, Column } from "typeorm";
import { Event } from "./Event";
import { Venue } from "../Venue Tables/Venue";

@Entity("event_venues")
export class EventVenue {
  @PrimaryColumn("uuid")
  eventId!: string;

  @PrimaryColumn("uuid")
  venueId!: string;

  @ManyToOne(() => Event, (event) => event.eventVenues, { onDelete: "CASCADE" })
  @JoinColumn({ name: "eventId" })
  event!: Event;

  @ManyToOne(() => Venue, (venue) => venue.eventVenues, { onDelete: "CASCADE" })
  @JoinColumn({ name: "venueId" })
  venue!: Venue;

  @Column({ type: "date" })
  eventStartDate!: string;

  @Column({ type: "date" })
  eventEndDate!: string;

  @Column({ type: "time", nullable: true })
  startTime?: string;

  @Column({ type: "time", nullable: true })
  endTime?: string;

  @Column({ type: "varchar", length: 100, default: "UTC" })
  timezone!: string;
}
