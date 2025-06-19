import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from "typeorm";
import { Venue } from "./Venue";
import { Resource } from "./Resources";

@Entity("venue_resources")
export class VenueResource {
  @PrimaryGeneratedColumn("uuid")
  venueResourceId!: string;

  @ManyToOne(() => Venue, (venue) => venue.venueResources)
  venue!: Venue;

  @ManyToOne(() => Resource, (resource) => resource.venueResources)
  resource!: Resource;

  @Column({ type: "int", default: 1 })
  quantity!: number;
}
