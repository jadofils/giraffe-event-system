// src/entity/Feedback.ts
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
  IsInt,
  Min,
  Max,
  IsOptional,
  Length,
} from "class-validator";

@Entity("feedback")
export class Feedback {
  @PrimaryGeneratedColumn("uuid")
  @IsUUID("4", { message: "feedbackId must be a valid UUID" })
  feedbackId!: string;

  @Column()
  @IsNotEmpty({ message: "eventId is required" })
  @IsUUID("4", { message: "eventId must be a valid UUID" })
  eventId!: string;

  @Column()
  @IsNotEmpty({ message: "userId is required" })
  @IsUUID("4", { message: "userId must be a valid UUID" })
  userId!: string;

  @Column()
  @IsNotEmpty({ message: "rating is required" })
  @IsInt({ message: "rating must be an integer" })
  @Min(1, { message: "rating must be at least $constraint1" })
  @Max(5, { message: "rating must be at most $constraint1" })
  rating!: number;

  @Column({ type: "uuid", nullable: true })
  @IsOptional()
  @IsUUID("4", { message: "venueId must be a valid UUID" })
  venueId?: string;

  @ManyToOne(() => Venue, (venue) => venue.feedbacks, { nullable: true })
  @JoinColumn({ name: "venueId" })
  venue?: Venue;

  @Column({ nullable: true })
  @IsOptional()
  @Length(0, 1000, {
    message: "comments must be at most $constraint2 characters long",
  })
  comments!: string;
}
