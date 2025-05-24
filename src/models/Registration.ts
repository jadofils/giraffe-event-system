import { Entity, PrimaryGeneratedColumn, Column, JoinColumn, ManyToOne, OneToOne } from 'typeorm';
import { IsUUID, IsNotEmpty, IsDateString, IsNumber, IsPositive, Length, IsBoolean, IsOptional, ArrayMinSize, IsArray, ValidateIf } from 'class-validator';
import { TicketType } from './TicketType';
import { Event } from './Event';
import { User } from './User';
import { Venue } from './Venue';
import { Payment } from './Payment'; // Import Payment
import { Invoice } from './Invoice'; // Import Invoice

@Entity('registrations')
export class Registration {
    @PrimaryGeneratedColumn('uuid')
    @IsUUID('4', { message: 'registrationId must be a valid UUID' })
    registrationId!: string;

    @ManyToOne(() => Event, event => event.registrations, { nullable: false, eager: true })
    @JoinColumn({ name: 'eventId' })
    event!: Event;

    @ManyToOne(() => User, user => user.registrationsAsAttendee, { nullable: false, eager: true })
    @JoinColumn({ name: 'userId' })
    user!: User;

    @ManyToOne(() => User, user => user.registrationsAsBuyer, { nullable: false, eager: true })
    @JoinColumn({ name: 'buyerId' })
    buyer!: User;

    @Column('simple-array', { nullable: true, default: () => 'ARRAY[]::text[]' })
    @IsOptional()
    @IsArray({ message: 'boughtForIds must be an array' })
    @ValidateIf(o => o.boughtForIds && o.boughtForIds.length > 0)
    @IsUUID('4', { each: true, message: 'Each boughtForId must be a valid UUID' })
    boughtForIds?: string[];

    @ManyToOne(() => TicketType, ticketType => ticketType.registrations, { nullable: false, eager: true })
    @JoinColumn({ name: 'ticketTypeId' })
    @IsNotEmpty({ message: 'A ticket type is required' })
    ticketType!: TicketType;

    @ManyToOne(() => Venue, venue => venue.registrations, { nullable: false, eager: true })
    @JoinColumn({ name: 'venueId' })
    venue!: Venue;

    @Column({ type: 'int' })
    @IsNumber({}, { message: 'noOfTickets must be a number' })
    @IsPositive({ message: 'noOfTickets must be a positive number' })
    @IsNotEmpty({ message: 'noOfTickets is required' })
    noOfTickets!: number;

    @Column({ type: 'decimal', precision: 10, scale: 2, default: 0.00 }) // Recommended: Track total cost here
    totalCost!: number;


    @Column({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
    @IsDateString({}, { message: 'registrationDate must be a valid ISO date string' })
    registrationDate!: string;

    @Column({ default: 'pending' }) // Default paymentStatus
    @IsNotEmpty({ message: 'paymentStatus is required' })
    @Length(3, 50, { message: 'paymentStatus must be between 3 and 50 characters' })
    paymentStatus!: string;

    @Column('varchar', { length: 255, nullable: true })
    qrCode?: string;

    @Column({ type: 'timestamptz', nullable: true })
    @IsOptional()
    @IsDateString({}, { message: 'checkDate must be a valid ISO date string if provided' })
    checkDate?: string;

    @Column({ type: 'boolean', default: false })
    @IsBoolean({ message: 'attended must be a boolean value' })
    attended!: boolean;

    // Optional: A general status for the registration (e.g., 'active', 'cancelled', 'partially_cancelled')
    @Column({ type: 'varchar', length: 50, default: 'active' })
    registrationStatus!: string;

    // Relationship to Payment
    @OneToOne(() => Payment, payment => payment.registration, { cascade: true, onDelete: 'SET NULL' }) // cascade: true means if Registration is deleted, Payment is too.  Adjust as needed.
    @JoinColumn({ name: 'paymentId' })
    payment?: Payment;

    // Relationship to Invoice (One-to-One)
    @OneToOne(() => Invoice, invoice => invoice.registration, { cascade: true, onDelete: 'SET NULL' })
    @JoinColumn({ name: 'invoiceId' })
    invoice?: Invoice;

    @Column({ type: 'uuid', nullable: true }) // Explicit foreign key column
    invoiceId?: string;

    @Column({ type: 'uuid', nullable: true }) // Explicit foreign key column
    paymentId?: string;
    ticketTypes: any;

}