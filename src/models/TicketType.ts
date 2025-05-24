import { Entity, PrimaryGeneratedColumn, Column, OneToMany, DeleteDateColumn } from 'typeorm';
import { IsUUID, IsNotEmpty, Length, IsNumber, IsPositive, IsOptional, Min, IsDecimal } from 'class-validator';
import { Registration } from './Registration';

@Entity('ticket_types')
export class TicketType {
    @PrimaryGeneratedColumn('uuid')
    @IsUUID('4', { message: 'ticketTypeId must be a valid UUID' })
    ticketTypeId!: string;

    @Column({ nullable: true })
    @IsNotEmpty({ message: 'ticketName is required' })
    @Length(3, 50, { message: 'ticketName must be between 3 and 50 characters' })
    ticketName!: string;

    @Column({ type: 'numeric', precision: 10, scale: 2, nullable: false }) // <-- Make it nullable temporarily
    @IsNumber({}, { message: 'Price must be a number' })
    @IsPositive({ message: 'Price must be a positive number' })
    @IsDecimal({}, { message: 'Price must be a valid decimal number' })
    price!: number;

    @Column({ nullable: true, type: 'text' })
    @IsOptional()
    @Length(0, 1000, { message: 'description must be at most 1000 characters' })
    description?: string;

    @DeleteDateColumn({ name: 'deletedAt', type: 'timestamp', nullable: true })
    deletedAt?: Date;

    @OneToMany(() => Registration, (registration: Registration) => registration.ticketType, {
        cascade: false // Prevent cascading deletes to avoid accidental data loss
    })
    registrations!: Registration[];
}