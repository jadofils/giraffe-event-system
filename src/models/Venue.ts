// src/entity/Venue.ts
import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsPositive,
  IsUUID,
  Length,
  Min,
} from 'class-validator';

@Entity('venues')
export class Venue {
  @PrimaryGeneratedColumn('uuid')
  @IsUUID('4', { message: 'venueId must be a valid UUID' })
  venueId!: string;

  @Column()
  @IsNotEmpty({ message: 'Venue name is required' })
  @Length(3, 100, { message: 'Venue name must be between 3 and 100 characters' })
  venueName!: string;

  @Column()
  @IsInt({ message: 'Capacity must be an integer' })
  @IsPositive({ message: 'Capacity must be positive' })
  @Min(1, { message: 'Capacity must be at least 1' })
  capacity!: number;

  @Column({ nullable: true })
  @IsOptional()
  @Length(0, 200, { message: 'Location must be less than 200 characters' })
  location!: string;
}