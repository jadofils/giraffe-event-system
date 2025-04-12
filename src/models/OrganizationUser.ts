
// src/entity/OrganizationUser.ts
import { Entity, PrimaryColumn } from 'typeorm';
import { IsUUID, IsNotEmpty } from 'class-validator';

@Entity('organization_users')
export class OrganizationUser {
  @PrimaryColumn()
  @IsUUID('4', { message: 'userId must be a valid UUID' })
  @IsNotEmpty({ message: 'userId is required' })
  userId!: string;

  @PrimaryColumn()
  @IsUUID('4', { message: 'organizationId must be a valid UUID' })
  @IsNotEmpty({ message: 'organizationId is required' })
  organizationId!: string;
}
