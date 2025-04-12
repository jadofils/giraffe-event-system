// src/entity/TicketType.ts
import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';
import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsUUID,
  Length,
} from 'class-validator';

@Entity('ticket_types')
export class TicketType {
  @PrimaryGeneratedColumn('uuid')
  @IsUUID('4', { message: 'ticketTypeId must be a valid UUID' })
  ticketTypeId!: string;

  @Column()
  @IsNotEmpty({ message: 'ticketName is required' })
  @Length(3, 50, {
    message: 'ticketName must be between $constraint1 and $constraint2 characters',
  })
  ticketName!: string;

  @Column({ type: 'float' })
  @IsNumber({}, { message: 'price must be a valid number' })
  @IsPositive({ message: 'price must be a positive number' })
  price!: number;

  @Column({ nullable: true })
  @IsOptional()
  @Length(0, 500, {
    message: 'description must be at most $constraint2 characters',
  })
  description!: string;
}