// src/entity/Notification.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { Venue } from "./Venue Tables/Venue";
import {
  IsUUID,
  IsNotEmpty,
  IsOptional,
  Length,
  IsBoolean,
} from "class-validator";

@Entity("notifications")
export class Notification {
  @PrimaryGeneratedColumn("uuid")
  @IsUUID("4", { message: "notificationId must be a valid UUID" })
  notificationId!: string;

  @Column()
  @IsNotEmpty({ message: "userId is required" })
  @IsUUID("4", { message: "userId must be a valid UUID" })
  userId!: string;

  @Column({ type: "uuid", nullable: true })
  @IsOptional()
  @IsUUID("4", { message: "eventId must be a valid UUID" })
  eventId!: string | null;
  // Venue relationship
  @Column({ type: "uuid", nullable: true })
  @IsOptional()
  @IsUUID("4", { message: "venueId must be a valid UUID" })
  venueId?: string | null;

  @ManyToOne(() => Venue, (venue) => venue.notifications, { nullable: true })
  @JoinColumn({ name: "venueId" })
  venue?: Venue;
  @Column()
  @IsNotEmpty({ message: "message is required" })
  @Length(1, 1000, {
    message: "message must be between $constraint1 and $constraint2 characters",
  })
  message!: string;

  @Column({ type: "timestamp", default: () => "CURRENT_TIMESTAMP" })
  sentAt!: Date;

  @Column({ default: false })
  @IsBoolean({ message: "isDesabled must be a boolean value" })
  isDesabled!: boolean;

  @Column({ default: false })
  @IsBoolean({ message: "isRead must be a boolean value" })
  isRead!: boolean;
}
