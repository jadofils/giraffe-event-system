// src/entity/Registration.ts
import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';
import {
  IsUUID,
  IsNotEmpty,
  IsDateString,
  IsOptional,
  Length,
  IsBoolean,
} from 'class-validator';

@Entity('registrations')
export class Registration {
  @PrimaryGeneratedColumn('uuid')
  @IsUUID('4', { message: 'registrationId must be a valid UUID' })
  registrationId!: string;

  @Column()
  @IsUUID('4', { message: 'eventId must be a valid UUID' })
  @IsNotEmpty({ message: 'eventId is required' })
  eventId!: string;

  @Column()
  @IsUUID('4', { message: 'userId must be a valid UUID' })
  @IsNotEmpty({ message: 'userId is required' })
  userId!: string;

  @Column({ type: 'date' })
  @IsDateString({}, { message: 'registrationDate must be a valid date string' })
  @IsNotEmpty({ message: 'registrationDate is required' })
  registrationDate!: string;

  @Column({ nullable: true })
  @IsOptional()
  @Length(0, 50, {
    message: 'ticketType must be at most $constraint2 characters',
  })
  ticketType!: string;

  @Column({ default: 'pending' })
  @IsNotEmpty({ message: 'paymentStatus is required' })
  @Length(3, 20, {
    message: 'paymentStatus must be between $constraint1 and $constraint2 characters',
  })
  paymentStatus!: string;

  @Column({ nullable: true })
  @IsOptional()
  qrCode!: string;

  @Column({ type: 'date', nullable: true })
  @IsDateString({}, { message: 'checkDate must be a valid date string' })
  @IsOptional()
  checkDate!: string;

  @Column({ default: false })
  @IsBoolean({ message: 'attended must be a boolean value' })
  attended!: boolean;
}