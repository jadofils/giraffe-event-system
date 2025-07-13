import { AppDataSource } from "../config/Database";
import { VenueAmenities } from "../models/Venue Tables/VenueAmenities";
import { Venue } from "../models/Venue Tables/Venue";
import { Resources } from "../models/Resources";

export class VenueResourceRepository {
  // static async addResourcesToVenue(
  //   venueId: string,
  //   resources: Array<{ resourceId: string; quantity: number }>
  // ) {
  //   if (!venueId || !Array.isArray(resources) || resources.length === 0) {
  //     throw new Error("venueId and a non-empty resources array are required");
  //   }
  //   const repo = AppDataSource.getRepository(VenueResource);
  //   const venueRepo = AppDataSource.getRepository(Venue);
  //   const resourceRepo = AppDataSource.getRepository(Resources);
  //   const venue = await venueRepo.findOneBy({ venueId });
  //   if (!venue) throw new Error("Venue not found");
  //   const created: VenueResource[] = [];
  //   for (const r of resources) {
  //     const resource = await resourceRepo.findOneBy({
  //       resourceId: r.resourceId,
  //     });
  //     if (!resource) continue;
  //     const venueResource = repo.create({
  //       venue,
  //       resource,
  //       quantity: r.quantity,
  //     });
  //     created.push(await repo.save(venueResource));
  //   }
  //   return created;
  // }

  // static async removeResourceFromVenue(venueId: string, resourceId: string) {
  //   const repo = AppDataSource.getRepository(VenueResource);
  //   const result = await repo.delete({
  //     venue: { venueId },
  //     resource: { resourceId },
  //   });
  //   return result.affected === 1;
  // }

  // static async getResourcesByVenueId(venueId: string) {
  //   const repo = AppDataSource.getRepository(VenueResource);
  //   return await repo.find({
  //     where: { venue: { venueId } },
  //     relations: ["resource"],
  //   });
  // }
}
