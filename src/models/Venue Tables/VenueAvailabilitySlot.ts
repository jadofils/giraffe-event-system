import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  JoinColumn,
} from "typeorm";
import { Venue } from "./Venue";

export enum SlotStatus {
  AVAILABLE = "AVAILABLE",
  BOOKED = "BOOKED",
  TRANSITION = "TRANSITION", // For transition time between events
  PARTIALLY_AVAILABLE = "PARTIALLY_AVAILABLE", // When only some hours are available
}

export enum SlotType {
  EVENT = "EVENT",
  TRANSITION = "TRANSITION",
}

@Entity("venue_availability_slots")
export class VenueAvailabilitySlot {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  venueId!: string;

  @Column({ type: "date" })
  Date!: Date;

  @Column({ type: "jsonb", nullable: true })
  bookedHours?: number[]; // Array of hours [9, 10, 11] etc.

  @Column({ type: "enum", enum: SlotStatus, default: SlotStatus.AVAILABLE })
  status!: SlotStatus;

  @Column({ type: "uuid", nullable: true })
  eventId: string | null = null;

  @Column({ type: "enum", enum: SlotType, nullable: true })
  slotType?: SlotType;

  @Column({ type: "text", nullable: true })
  notes?: string;

  @Column({ type: "jsonb", nullable: true })
  metadata?: {
    transitionHours?: number[]; // Hours reserved for transition
    originalEventHours?: number[]; // The actual event hours without transition
    relatedEventId?: string; // ID of the event this transition is for
    transitionDirection?: "before" | "after"; // Whether this is a pre or post event transition
    warningMessages?: string[]; // Any warnings about transition time availability
    availableTransitionSlots?: {
      // Alternative transition slots if preferred ones aren't available
      date: string;
      hours: number[];
    }[];
  };

  @CreateDateColumn()
  createdAt!: Date;

  @ManyToOne(() => Venue, (venue) => venue.availabilitySlots)
  @JoinColumn({ name: "venueId" })
  venue!: Venue;
}
