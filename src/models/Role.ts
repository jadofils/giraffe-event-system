// src/entity/Role.ts
import { Entity, PrimaryGeneratedColumn, Column, ManyToMany } from 'typeorm';
import {
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsUUID,
  Length,
} from 'class-validator';
import { User } from './User';

@Entity('roles')
export class Role {
  @PrimaryGeneratedColumn('uuid')
  @IsUUID('4', { message: 'roleId must be a valid UUID' })
  roleId!: string;

  @Column({ unique: true })
  @IsNotEmpty({ message: 'roleName is required' })
  @Length(3, 50, {
    message: 'roleName must be between $constraint1 and $constraint2 characters',
  })
  roleName!: string;

  @Column('simple-array')
  @IsArray({ message: 'permissions must be an array of strings' })
  @IsOptional()
  permissions!: string[];

  @Column({ nullable: true })
  @IsOptional()
  @Length(0, 500, {
    message: 'description must be at most $constraint2 characters',
  })
  description!: string;

  @ManyToMany(() => User, user => user.roles)
  users!: User[];
}