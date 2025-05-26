import { Entity, PrimaryGeneratedColumn, Column, OneToMany, OneToOne, JoinColumn } from 'typeorm';
import { IsUUID, IsNotEmpty, IsDateString, IsNumber, IsPositive, Length } from 'class-validator';
import { Payment } from './Payment';
import { Registration } from './Registration';

@Entity('invoices')
export class Invoice {
    @PrimaryGeneratedColumn('uuid')
    @IsUUID('4', { message: 'invoiceId must be a valid UUID' })
    invoiceId!: string;

    @Column()
    @IsUUID('4', { message: 'eventId must be a valid UUID' })
    @IsNotEmpty({ message: 'eventId is required' })
    eventId!: string;

    @Column()
    @IsUUID('4', { message: 'userId must be a valid UUID' })
    @IsNotEmpty({ message: 'userId is required' })
    userId!: string;

    @Column({ type: 'date' })
    @IsDateString({}, { message: 'invoiceDate must be a valid ISO date string' })
    @IsNotEmpty({ message: 'invoiceDate is required' })
    invoiceDate!: string;

    @Column({ type: 'date' })
    @IsDateString({}, { message: 'dueDate must be a valid ISO date string' })
    @IsNotEmpty({ message: 'dueDate is required' })
    dueDate!: string;

    @Column({ type: 'float' })
    @IsNumber({}, { message: 'totalAmount must be a number' })
    @IsPositive({ message: 'totalAmount must be a positive number' })
    totalAmount!: number;

    @Column()
    @IsNotEmpty({ message: 'status is required' })
    @Length(3, 20, { message: 'status must be between $constraint1 and $constraint2 characters' })
    status!: string;

    @OneToMany(() => Payment, payment => payment.invoice)
    payments!: Payment[];

    // Relationship to Registration (One-to-One)
    @OneToOne(() => Registration, registration => registration.invoice)
    registration?: Registration;
  createdAt: any;
  updatedAt: any;
  deletedAt: any;
}