import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";
import { Venue } from "./Venue";

@Entity("booking_condition")
export class BookingCondition {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "text", nullable: true })
  descriptionCondition?: string;

  @Column({ type: "text", nullable: true })
  notaBene?: string;

  @Column({ type: "int", nullable: true })
  transitionTime?: number;

  @Column({ type: "int", nullable: true })
  depositRequiredPercent?: number;

  @Column({ type: "int", nullable: true })
  depositRequiredTime?: number;

  @Column({ type: "int", nullable: true })
  paymentComplementTimeBeforeEvent?: number;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @ManyToOne(() => Venue, (venue) => venue.bookingConditions, {
    onDelete: "CASCADE",
  })
  venue!: Venue;
}
