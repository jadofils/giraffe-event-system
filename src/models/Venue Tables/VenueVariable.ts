import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from "typeorm";
import { Venue } from "./Venue";
import { User } from "../User";

@Entity("venue_variable")
export class VenueVariable {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "float" })
  venueAmount!: number;

  @ManyToOne(() => Venue, (venue) => venue.venueVariables, {
    onDelete: "CASCADE",
  })
  venue!: Venue;

  @ManyToOne(() => User, { nullable: false })
  manager!: User;
}
