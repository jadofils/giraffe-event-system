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
  Date!: Date;
  
  @Column({ type: "time" })
  startTime!: Date;

  @Column({ type: "time" })
  endTime!: Date;

  @Column({ type: "boolean", default: true })
  isAvailable!: boolean;

  @CreateDateColumn()
  createdAt!: Date;

  @ManyToOne(() => Venue, (venue) => venue.availabilitySlots)
  venue!: Venue;
}
