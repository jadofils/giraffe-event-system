import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from 'typeorm';
import { IsUUID, IsNotEmpty, IsOptional, Length, IsEmail, IsPhoneNumber } from 'class-validator';
import { User } from './User';

@Entity('organizations')
export class Organization {
  
  @PrimaryGeneratedColumn('uuid')
  @IsUUID('4')
  organizationId!: string;

  @Column()
  @IsNotEmpty()
  @Length(3, 100)
  organizationName!: string;

  @Column({ nullable: true })
  @IsOptional()
  @Length(0, 500)
  description?: string;

  @Column()
  @IsEmail()
  @IsNotEmpty()
  contactEmail!: string;

  @Column({ nullable: true })
  @IsOptional()
  @IsPhoneNumber()
  contactPhone?: string;

  @Column({ nullable: true })
  @IsOptional()
  @Length(0, 200)
  address?: string;

  @Column({ nullable: true })
  @IsOptional()
  @Length(0, 50)
  organizationType?: string;

  @ManyToOne(() => User, user => user.organizations) // Adjusted to Many-to-One
  user!: User;
}
