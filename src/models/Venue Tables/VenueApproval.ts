import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
} from "typeorm";
import { Venue } from "./Venue";
import { User } from "../User";

export enum VenueApprovalStatus {
  PENDING = "PENDING",
  APPROVED = "APPROVED",
  REJECTED = "REJECTED",
}

@Entity("venue_approvals")
export class VenueApproval {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  venueId!: string;

  @Column({ type: "uuid" })
  reviewedBy!: string;

  @Column({
    type: "enum",
    enum: VenueApprovalStatus,
    default: VenueApprovalStatus.PENDING,
  })
  status!: VenueApprovalStatus;

  @CreateDateColumn()
  reviewedAt!: Date;

  @ManyToOne(() => Venue, (venue) => venue.approvals, { onDelete: "CASCADE" })
  venue!: Venue;

  @ManyToOne(() => User, (user) => user.venueApprovals)
  reviewer!: User;
}
