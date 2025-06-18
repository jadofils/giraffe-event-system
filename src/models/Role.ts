// src/models/Role.ts
import {
  Entity, PrimaryGeneratedColumn, Column, OneToMany,
  CreateDateColumn, UpdateDateColumn, DeleteDateColumn // Added DeleteDateColumn for consistency
} from 'typeorm';
import { IsUUID, IsNotEmpty, IsOptional, Length, IsArray } from 'class-validator';
import { User } from './User';

@Entity('roles')
export class Role {
  @PrimaryGeneratedColumn('uuid')
  @IsUUID('4', { message: 'roleId must be a valid UUID' }) // Added validation message
  roleId!: string;

  @Column({ unique: true })
  @IsNotEmpty({ message: 'roleName is required' })
  @Length(3, 50, { message: 'roleName must be between $constraint1 and $constraint2 characters' })
  roleName!: string;

  @Column('simple-array', { nullable: true }) // Good choice for simple permission arrays
  @IsOptional()
  @IsArray({ message: 'permissions must be an array' }) // Added array validation
  permissions?: string[];

  @Column({ type: 'text', nullable: true }) // Explicitly define type 'text'
  @IsOptional()
  @Length(0, 500, { message: 'description must be at most $constraint2 characters' }) // Added validation message
  description?: string;

  // --- Relationship to User (One Role to Many Users) ---
  // This is correct and perfectly matches the ManyToOne in User.ts
  @OneToMany(() => User, user => user.role)
  users!: User[];

  // --- Timestamp Columns ---
  @CreateDateColumn({ type: 'timestamp with time zone' }) // Explicit type
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' }) // Explicit type
  updatedAt!: Date;

  @DeleteDateColumn({ type: 'timestamp with time zone', nullable: true }) // Added for consistency with other models
  deletedAt?: Date;
}