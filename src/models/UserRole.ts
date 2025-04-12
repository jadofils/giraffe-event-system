// src/entity/UserRole.ts
import { Entity, PrimaryColumn } from 'typeorm';
import { IsNotEmpty, IsUUID } from 'class-validator';

/**
 * UserRole entity represents the many-to-many relationship
 * between users and roles.
 */
@Entity('user_roles')
export class UserRole {
  @PrimaryColumn()
  @IsUUID('4', { message: 'userId must be a valid UUID' })
  @IsNotEmpty({ message: 'userId is required' })
  userId!: string;

  @PrimaryColumn()
  @IsUUID('4', { message: 'roleId must be a valid UUID' })
  @IsNotEmpty({ message: 'roleId is required' })
  roleId!: string;
}