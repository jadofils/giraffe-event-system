// src/entity/EventBooking.ts
import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';
import {
  IsUUID,
  IsNotEmpty,
  IsDateString,
  Length,
  IsString,
} from 'class-validator';

@Entity('event_bookings')
export class EventBooking {
  @PrimaryGeneratedColumn('uuid')
  @IsUUID('4', { message: 'bookingId must be a valid UUID' })
  bookingId!: string;

  @Column()
  @IsNotEmpty({ message: 'eventId is required' })
  @IsUUID('4', { message: 'eventId must be a valid UUID' })
  eventId!: string;

  @Column()
  @IsNotEmpty({ message: 'venueId is required' })
  @IsUUID('4', { message: 'venueId must be a valid UUID' })
  venueId!: string;

  @Column()
  @IsNotEmpty({ message: 'organizerId is required' })
  @IsUUID('4', { message: 'organizerId must be a valid UUID' })
  organizerId!: string;

  @Column()
  @IsNotEmpty({ message: 'organizationId is required' })
  @IsUUID('4', { message: 'organizationId must be a valid UUID' })
  organizationId!: string;

  @Column({ type: 'date' })
  @IsNotEmpty({ message: 'startDate is required' })
  @IsDateString({}, { message: 'startDate must be a valid ISO 8601 date string' })
  startDate!: string;

  @Column({ type: 'date' })
  @IsNotEmpty({ message: 'endDate is required' })
  @IsDateString({}, { message: 'endDate must be a valid ISO 8601 date string' })
  endDate!: string;

  @Column({ type: 'time' })
  @IsNotEmpty({ message: 'startTime is required' })
  @Length(5, 8, {
    message:
      'startTime must be between $constraint1 and $constraint2 characters long (e.g., "HH:MM" or "HH:MM:SS")',
  })
  startTime!: string;

  @Column({ type: 'time' })
  @IsNotEmpty({ message: 'endTime is required' })
  @Length(5, 8, {
    message:
      'endTime must be between $constraint1 and $constraint2 characters long (e.g., "HH:MM" or "HH:MM:SS")',
  })
  endTime!: string;

  @Column({ default: 'pending' })
  @IsNotEmpty({ message: 'approvalStatus is required' })
  @IsString({ message: 'approvalStatus must be a string' })
  @Length(3, 20, {
    message: 'approvalStatus must be between $constraint1 and $constraint2 characters long',
  })
  approvalStatus!: string;
}