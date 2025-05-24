// src/entity/Event.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import {
  IsUUID,
  IsNotEmpty,
  Length,
  IsOptional,
  IsEnum,
} from "class-validator";

import { Venue } from "./Venue";
import { User } from "./User";
import { EventBooking } from "./VenueBooking";
import { Registration } from "./Registration";

export enum EventType {
  PUBLIC = "public",
  PRIVATE = "private",
}

@Entity("events")
export class Event {
  @PrimaryGeneratedColumn("uuid")
  @IsUUID("4", { message: "eventId must be a valid UUID" })
  eventId!: string;

  @Column()
  @IsNotEmpty({ message: "Event title is required" })
  @Length(3, 100, {
    message:
      "Event title must be between $constraint1 and $constraint2 characters",
  })
  eventTitle!: string;

  @Column({ nullable: true })
  @IsOptional()
  @Length(0, 1000, {
    message: "Description must be at most $constraint2 characters long",
  })
  description!: string;

  @Column({ nullable: true })
  @IsOptional()
  @Length(0, 50, {
    message: "Event category must be at most $constraint2 characters long",
  })
  eventCategory!: string;

  @Column({
    type: "enum",
    enum: EventType,
    default: EventType.PUBLIC,
  })
  @IsEnum(EventType, {
    message: "Event type must be one of: public, private",
  })
  eventType!: EventType;

  @Column()
  @IsNotEmpty({ message: "Organizer ID is required" })
  @IsUUID("4", { message: "Organizer ID must be a valid UUID" })
  organizerId!: string;



  @Column()
  @IsNotEmpty({ message: "Venue ID is required" })
  @IsUUID("4", { message: "Venue ID must be a valid UUID" })
  venueId!: string;
  payments: any;

  @ManyToOne(() => Venue, (venue) => venue.events)
  @JoinColumn({ name: "venueId" }) 
  venue!: Venue;

  @ManyToOne(() => User, (user) => user.eventsOrganizer)
  @JoinColumn({ name: "organizerId" }) 
  organizer!: User;

  @OneToMany(() => EventBooking, (booking) => booking.event)
  bookings!: EventBooking[];
  //to registrations
  @OneToMany(() => Registration, registration => registration.event, { cascade: true })
  registrations!: Registration[];

}
