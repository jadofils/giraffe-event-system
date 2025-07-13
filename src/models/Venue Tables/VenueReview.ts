import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
} from "typeorm";
import { Venue } from "./Venue";
import { User } from "../User";

@Entity("venue_reviews")
export class VenueReview {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  userId!: string;

  @Column({ type: "uuid" })
  venueId!: string;

  @Column({ type: "int", nullable: true })
  rating?: number;

  @Column({ type: "text", nullable: true })
  comment?: string;

  @CreateDateColumn()
  createdAt!: Date;

  @ManyToOne(() => Venue, (venue) => venue.reviews)
  venue!: Venue;

  @ManyToOne(() => User, (user) => user.venueReviews)
  user!: User;
}
