// src/entity/Organization.ts
import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';
import {
  IsUUID,
  IsNotEmpty,
  IsOptional,
  Length,
  IsEmail,
  IsPhoneNumber,
  IsBoolean,
} from 'class-validator';

@Entity('organizations')
export class Organization {
  @PrimaryGeneratedColumn('uuid')
  @IsUUID('4', { message: 'organizationId must be a valid UUID' })
  organizationId!: string;

  @Column()
  @IsNotEmpty({ message: 'organizationName is required' })
  @Length(3, 100, {
    message:
      'organizationName must be between $constraint1 and $constraint2 characters',
  })
  organizationName!: string;

  @Column({ nullable: true })
  @IsOptional()
  @Length(0, 500, {
    message: 'description must be at most $constraint2 characters',
  })
  description!: string;

  @Column()
  @IsEmail({}, { message: 'contactEmail must be a valid email address' })
  @IsNotEmpty({ message: 'contactEmail is required' })
  contactEmail!: string;

  @Column({ nullable: true })
  @IsOptional()
  @IsPhoneNumber(undefined, {
    message: 'contactPhone must be a valid phone number',
  })
  contactPhone!: string;
  
  @Column({ nullable: true })
  @IsOptional()
  @Length(0, 200, {
    message: 'address must be at most $constraint2 characters long',
  })
  address!: string;

  @Column({ nullable: true })
  @IsOptional()
  @Length(0, 50, {
    message: 'organizationType must be at most $constraint2 characters long',
  })
  organizationType!: string;
}