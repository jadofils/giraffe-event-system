import {
  Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany
} from 'typeorm';
import { IsUUID, IsNotEmpty, Length, IsEmail, IsString, IsOptional, IsPhoneNumber } from 'class-validator';
import { Role } from './Role';
import { Organization } from './Organization';
import { Payment } from './Payment';
import { EventBooking } from './VenueBooking';
import { Registration } from './Registration';

@Entity('users')
export class User {
  [x: string]: any;
  @PrimaryGeneratedColumn('uuid')
  @IsUUID('4')
  userId!: string;

  @Column({ unique: true })
  @IsNotEmpty()
  @Length(3, 50)
  username!: string;

  @Column()
  @IsNotEmpty()
  @Length(1, 50)
  firstName!: string;

  @Column()
  @IsNotEmpty()
  @Length(1, 50)
  lastName!: string;

  @Column({ unique: true })
  @IsNotEmpty()
  @IsEmail()
  email!: string;

  @Column({ nullable: true })
  @IsOptional()
  @IsString()
  password?: string;

  @Column({ nullable: true })
  @IsOptional()
  @IsPhoneNumber()
  phoneNumber?: string;

  @ManyToOne(() => Role, role => role.users) // Adjusted to Many-to-One
  role!: Role;

  @OneToMany(() => Organization, organization => organization.user)
  organizations!: Organization[]; // One user can belong to many organizations
  
 @OneToMany(() => EventBooking, (booking) => booking.user)
  bookings!: EventBooking[];
  //to registrations
   @OneToMany(() => Registration, (registration) => registration.user)
  registrations!: Registration[];



}
