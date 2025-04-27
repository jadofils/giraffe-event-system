// src/entity/Venue.ts
import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';
import {
  IsNotEmpty,
  IsNumber,
  IsPositive,
  IsUUID,
  Length,
} from 'class-validator';

// src/entity/Venue.ts
import {  OneToMany, ManyToOne, JoinColumn } from 'typeorm';
import { 
  
  IsBoolean 
} from 'class-validator';
import { User } from './User';
import { EventBooking } from './EventBooking';
import { Event } from './Event';

@Entity('venues')
export class Venue {
  @PrimaryGeneratedColumn('uuid')
  @IsUUID('4', { message: 'venueId must be a valid UUID' })
  venueId!: string;

  @Column()
  @IsNotEmpty({ message: 'venueName is required' })
  @Length(3, 100, {
    message: 'venueName must be between $constraint1 and $constraint2 characters',
  })
  venueName!: string;

  @Column()
  @IsNumber({}, { message: 'capacity must be a number' })
  @IsPositive({ message: 'capacity must be a positive number' })
  capacity!: number;

  @Column()
  @IsNotEmpty({ message: 'location is required' })
  @Length(3, 200, {
    message: 'location must be between $constraint1 and $constraint2 characters',
  })
  location!: string;
  
  // New fields
  @Column({ nullable: true })
  @IsUUID('4', { message: 'managerId must be a valid UUID' })
  managerId!: string;
  
  @Column({ default: true })
  @IsBoolean({ message: 'isAvailable must be a boolean' })
  isAvailable!: boolean;
  
  @Column({ default: false })
  @IsBoolean({ message: 'isBooked must be a boolean' })
  isBooked!: boolean;
  
  // Relationships
  @ManyToOne(() => User, user => user.managedVenues)
  @JoinColumn({ name: 'managerId' })
  manager!: User;
  
  @OneToMany(() => EventBooking, eventBooking => eventBooking.venueId)
  bookings!: EventBooking[];

  @OneToMany(() => Event, event => event.venueId)
  events!: Event[];
}