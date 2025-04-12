// src/entity/Payment.ts
import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';
import {
  IsUUID,
  IsNotEmpty,
  IsDateString,
  IsNumber,
  IsPositive,
  IsOptional,
  Length,
} from 'class-validator';

@Entity('payments')
export class Payment {
  @PrimaryGeneratedColumn('uuid')
  @IsUUID('4', { message: 'paymentId must be a valid UUID' })
  paymentId!: string;

  @Column()
  @IsUUID('4', { message: 'eventId must be a valid UUID' })
  @IsNotEmpty({ message: 'eventId is required' })
  eventId!: string;

  @Column()
  @IsUUID('4', { message: 'userId must be a valid UUID' })
  @IsNotEmpty({ message: 'userId is required' })
  userId!: string;

  @Column()
  @IsUUID('4', { message: 'ticketTypeId must be a valid UUID' })
  @IsNotEmpty({ message: 'ticketTypeId is required' })
  ticketTypeId!: string;

  @Column({ type: 'date' })
  @IsDateString({}, { message: 'paymentDate must be a valid ISO date string' })
  @IsNotEmpty({ message: 'paymentDate is required' })
  paymentDate!: string;

  @Column({ type: 'float' })
  @IsNumber({}, { message: 'paidAmount must be a number' })
  @IsPositive({ message: 'paidAmount must be a positive number' })
  paidAmount!: number;

  @Column({ type: 'float', default: 0 })
  @IsNumber({}, { message: 'remainingAmount must be a number' })
  remainingAmount!: number;

  @Column()
  @IsNotEmpty({ message: 'paymentMethod is required' })
  @Length(3, 50, {
    message:
      'paymentMethod must be between $constraint1 and $constraint2 characters',
  })
  paymentMethod!: string;

  @Column({ default: 'pending' })
  @IsNotEmpty({ message: 'paymentStatus is required' })
  @Length(3, 20, {
    message:
      'paymentStatus must be between $constraint1 and $constraint2 characters',
  })
  paymentStatus!: string;

  @Column({ nullable: true })
  @IsOptional()
  @Length(0, 500, {
    message: 'description must be at most $constraint2 characters',
  })
  description!: string;
}