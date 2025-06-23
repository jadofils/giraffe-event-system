import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from "typeorm";
import { Venue } from "./Venue";
import { Resource } from "./Resources";

@Entity("venue_resources")
export class VenueResource {
  @PrimaryGeneratedColumn("uuid")
  venueResourceId!: string;

  @ManyToOne(() => Venue, (venue) => venue.resources)
  venue!: Venue;

  @ManyToOne(() => Resource, (resource) => resource.resources)
  resource!: Resource;

  @Column({ type: "int", default: 1 })
  quantity!: number;
}
