// @ts-nocheck

import { Repository } from "typeorm";
import { AppDataSource } from "../config/Database";
import { Resource } from "../models/Resources";

export class ResourceRepository {
  private static resourceRepository: Repository<Resource> =
    AppDataSource.getRepository(Resource);

  // Static function to create a new resource
  static async createResource(
    resourceData: Partial<Resource>
  ): Promise<Resource> {
    const resource = this.resourceRepository.create(resourceData);
    return await this.resourceRepository.save(resource);
  }

  // Static function to retrieve all resources
  static async findAllResources(): Promise<Resource[]> {
    return await this.resourceRepository.find({
      relations: ["eventResources"],
    });
  }

  //Static function to retrieve a resource by ID
  static findResourceById = async (
    resourceId: string
  ): Promise<Resource | undefined> => {
    return await this.resourceRepository.findOne({
      where: { resourceId },
      relations: ["eventResources"],
    });
  };

  // Static function to update a resource
  static async updateResource(
    resourceId: string,
    updateData: Partial<Resource>
  ): Promise<Resource | null> {
    const resource = await this.resourceRepository.findOneBy({ resourceId });
    if (!resource) return null;
    Object.assign(resource, updateData);
    return await this.resourceRepository.save(resource);
  }

  // Static function to delete a resource
  static async deleteResource(resourceId: string): Promise<boolean> {
    const result = await this.resourceRepository.delete(resourceId);
    return result.affected === 1;
  }

  // Bulk assign resources to an event
  static async bulkAssignResourcesToEvent(
    eventId: string,
    resources: Array<{
      resourceId: string;
      quantity: number;
      amountSpent?: number;
    }>
  ): Promise<any[]> {
    if (!eventId || !Array.isArray(resources) || resources.length === 0) {
      throw new Error("eventId and a non-empty resources array are required");
    }
    const eventResourceRepo = AppDataSource.getRepository("EventResource");
    const created: any[] = [];
    for (const r of resources) {
      const eventResource = eventResourceRepo.create({
        eventId,
        resourceId: r.resourceId,
        quantity: r.quantity,
        amountSpent: r.amountSpent ?? null,
      });
      created.push(await eventResourceRepo.save(eventResource));
    }
    return created;
  }
}
