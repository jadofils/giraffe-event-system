import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
} from "typeorm";
import { Venue } from "./Venue";

@Entity("venue_availability_slots")
export class VenueAvailabilitySlot {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  venueId!: string;

  @Column({ type: "date" })
  startDate!: Date;

  @Column({ type: "date" })
  endDate!: Date;

  @Column({ type: "time" })
  startTime!: Date;

  @Column({ type: "time" })
  endTime!: Date;

  @Column({ type: "varchar", length: 100, default: "UTC" })
  timezone!: string;

  @Column({ type: "boolean", default: true })
  isAvailable!: boolean;

  @Column({ type: "uuid", nullable: true })
  sourceId?: string;

  @CreateDateColumn()
  createdAt!: Date;

  @ManyToOne(() => Venue, (venue) => venue.availabilitySlots)
  venue!: Venue;
}
