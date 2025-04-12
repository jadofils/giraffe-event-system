
// src/entity/Budget.ts
import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';
import {
  IsUUID,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  Length,
} from 'class-validator';

@Entity('budgets')
export class Budget {
  @PrimaryGeneratedColumn('uuid')
  @IsUUID('4', { message: 'budgetId must be a valid UUID' })
  budgetId!: string;

  @Column()
  @IsNotEmpty({ message: 'eventId is required' })
  @IsUUID('4', { message: 'eventId must be a valid UUID' })
  eventId!: string;

  @Column({ type: 'float' })
  @IsNotEmpty({ message: 'expectedAmount is required' })
  @IsNumber({}, { message: 'expectedAmount must be a number' })
  expectedAmount!: number;

  @Column({ type: 'float', default: 0 })
  @IsNotEmpty({ message: 'income is required' })
  @IsNumber({}, { message: 'income must be a number' })
  income!: number;

  @Column({ type: 'float', default: 0 })
  @IsNotEmpty({ message: 'expenditure is required' })
  @IsNumber({}, { message: 'expenditure must be a number' })
  expenditure!: number;

  @Column({ nullable: true })
  @IsOptional()
  @Length(0, 1000, {
    message: 'notes must be at most $constraint2 characters long',
  })
  notes!: string;
}
