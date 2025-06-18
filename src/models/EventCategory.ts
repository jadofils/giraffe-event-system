// src/models/EventCategory.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
} from 'typeorm';
import {
  IsUUID,
  IsNotEmpty,
  Length,
  IsOptional,
} from 'class-validator';

import { Event } from './Event'; // Import the Event model to define the relationship

@Entity('event_categories') // Renamed table to plural and snake_case for consistency
export class EventCategory {
  @PrimaryGeneratedColumn('uuid')
  @IsUUID('4', { message: 'eventCategoryId must be a valid UUID' })
  eventCategoryId!: string;

  @Column({ unique: true }) // Ensure category names are unique
  @IsNotEmpty({ message: 'Category name is required' })
  @Length(3, 100, { message: 'Category name must be between $constraint1 and $constraint2 characters' })
  name!: string;

  @Column({ type: 'text', nullable: true })
  @IsOptional()
  @Length(0, 500, { message: 'Description must be at most $constraint2 characters long' })
  description?: string;

  // Relationship to Event
  @OneToMany(() => Event, event => event.eventCategoryRef)
  events!: Event[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @DeleteDateColumn()
  deletedAt?: Date; // Optional because it's null until soft-deleted
}