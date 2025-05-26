import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, OneToOne } from 'typeorm';
import { IsUUID, IsNotEmpty, IsDateString, IsNumber, IsPositive, Length, IsOptional } from 'class-validator';
import { Invoice } from './Invoice';
import { Registration } from './Registration'; // Import Registration
import { Event } from './Event';

@Entity('payments')
export class Payment {
    @PrimaryGeneratedColumn('uuid')
    @IsUUID('4', { message: 'paymentId must be a valid UUID' })
    paymentId!: string;

    @Column()
    @IsUUID('4', { message: 'invoiceId must be a valid UUID' })
    @IsNotEmpty({ message: 'invoiceId is required' })
    invoiceId!: string;

    @Column({ type: 'date' })
    @IsDateString({}, { message: 'paymentDate must be a valid ISO date string' })
    @IsNotEmpty({ message: 'paymentDate is required' })
    paymentDate!: string;

    @Column({ type: 'float' })
    @IsNumber({}, { message: 'paidAmount must be a number' })
    @IsPositive({ message: 'paidAmount must be a positive number' })
    paidAmount!: number;

    @Column()
    @IsNotEmpty({ message: 'paymentMethod is required' })
    @Length(3, 50, { message: 'paymentMethod must be between $constraint1 and $constraint2 characters' })
    paymentMethod!: string;

    @Column({ default: 'pending' })
    @IsNotEmpty({ message: 'paymentStatus is required' })
    @Length(3, 20, { message: 'paymentStatus must be between $constraint1 and $constraint2 characters' })
    paymentStatus!: string;

    @Column({ nullable: true })
    @IsOptional()
    @Length(0, 500, { message: 'description must be at most $constraint2 characters' })
    description!: string;

    // Relationships
    @ManyToOne(() => Invoice, invoice => invoice.payments)
    @JoinColumn({ name: 'invoiceId' })
    invoice!: Invoice;
    @ManyToOne(() => Event, event => event.payments)
    @JoinColumn({ name: "eventId" })
    event!: Event;

    // Relationship to Registration (One-to-One)
    @OneToOne(() => Registration, registration => registration.payment)
    @JoinColumn({ name: 'registrationId' })
    registration?: Registration;

    @Column({ type: 'uuid', nullable: true, unique: true }) // Add this for the foreign key
    registrationId?: string;
  createdAt: any;
  updatedAt: any;
  deletedAt: any;
}