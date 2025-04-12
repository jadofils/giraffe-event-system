// src/entity/User.ts
import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    ManyToMany,
  } from 'typeorm';
  import {
    IsUUID,
    IsNotEmpty,
    Length,
    IsEmail,
    IsString,
    MinLength,
    MaxLength,
    IsOptional,
    IsPhoneNumber,
  } from 'class-validator';
import { Role } from './Role';
  
  @Entity('users')
  export class User {
    @PrimaryGeneratedColumn('uuid')
    @IsUUID('4', { message: 'userId must be a valid UUID' })
    userId!: string;
  
    @Column({ unique: true })
    @IsNotEmpty({ message: 'Username is required' })
    @Length(3, 50, {
      message: 'Username must be between $constraint1 and $constraint2 characters',
    })
    username!: string;
  
    @Column()
    @IsNotEmpty({ message: 'First name is required' })
    @Length(1, 50, {
      message: 'First name must be between $constraint1 and $constraint2 characters',
    })
    firstName!: string;
  
    @Column()
    @IsNotEmpty({ message: 'Last name is required' })
    @Length(1, 50, {
      message: 'Last name must be between $constraint1 and $constraint2 characters',
    })
    lastName!: string;
  
    @Column({ unique: true })
    @IsNotEmpty({ message: 'Email is required' })
    @IsEmail({}, { message: 'Email must be a valid email address' })
    email!: string;
  
    @Column()
    @IsNotEmpty({ message: 'Password is required' })
    @IsString({ message: 'Password must be a string' })
    @MinLength(8, {
      message: 'Password must be at least $constraint1 characters long',
    })
    @MaxLength(20, {
      message: 'Password must not exceed $constraint1 characters',
    })
    password!: string;
  
    @Column({ type: 'varchar', nullable: true })
    @IsOptional()
    @IsPhoneNumber(undefined, {
      message: 'Phone number must be a valid phone number',
    })
    phoneNumber: string | null = null;
    
    
  @ManyToMany(() => Role, role => role.users)
  roles!: Role[];
}
  
  