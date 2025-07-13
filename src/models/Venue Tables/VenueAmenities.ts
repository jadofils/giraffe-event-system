import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  JoinColumn,
} from "typeorm";
import { Venue } from "./Venue";

@Entity("venue_amenities")
export class VenueAmenities {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "varchar", length: 100 })
  resourceName!: string;

  @Column({ type: "int" })
  quantity!: number;

  @Column({ type: "text", nullable: true })
  amenitiesDescription?: string;

  @Column({ type: "decimal", precision: 10, scale: 2, default: 0.0 })
  costPerUnit!: number;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @DeleteDateColumn()
  deletedAt?: Date;

  @ManyToOne(() => Venue, { onDelete: "CASCADE" })
  @JoinColumn({ name: "venueId" })
  venue!: Venue;
}
