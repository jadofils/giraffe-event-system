import { AppDataSource } from "../config/Database";
import { VenueType } from "../models/Venue Tables/VenueType";

export class VenueTypeRepository {
  static getRepo() {
    return AppDataSource.getRepository(VenueType);
  }

  static async create(data: Partial<VenueType>): Promise<VenueType> {
    const repo = this.getRepo();
    const venueType = repo.create(data);
    return await repo.save(venueType);
  }

  static async findAll(): Promise<VenueType[]> {
    return await this.getRepo().find();
  }

  static async findById(id: string): Promise<VenueType | null> {
    return await this.getRepo().findOne({ where: { id } });
  }

  static async update(id: string, data: Partial<VenueType>): Promise<VenueType | null> {
    const repo = this.getRepo();
    const venueType = await repo.findOne({ where: { id } });
    if (!venueType) return null;
    Object.assign(venueType, data);
    return await repo.save(venueType);
  }

  static async delete(id: string): Promise<boolean> {
    const repo = this.getRepo();
    const venueType = await repo.findOne({ where: { id } });
    if (!venueType) return false;
    venueType.isActive = false;
    await repo.save(venueType);
    return true;
  }
} 