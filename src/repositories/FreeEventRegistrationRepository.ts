import { AppDataSource } from "../config/Database";
import { FreeEventRegistration } from "../models/FreeEventRegistration";
import { Repository } from "typeorm";

export class FreeEventRegistrationRepository {
  private static repository: Repository<FreeEventRegistration> =
    AppDataSource.getRepository(FreeEventRegistration);

  static async createFreeEventRegistration(
    registrationData: Partial<FreeEventRegistration>
  ): Promise<FreeEventRegistration> {
    const newRegistration = this.repository.create(registrationData);
    return await this.repository.save(newRegistration);
  }

  static async getFreeRegistrationById(
    freeRegistrationId: string
  ): Promise<FreeEventRegistration | null> {
    return await this.repository.findOne({
      where: { freeRegistrationId },
      relations: ["event", "event.eventVenues", "event.eventVenues.venue"], // Load event and venue details
    });
  }

  static async getFreeRegistrationsByEventId(
    eventId: string
  ): Promise<FreeEventRegistration[]> {
    return await this.repository.find({ where: { eventId } });
  }

  static async getFreeRegistrationsByEmailAndEventId(
    email: string,
    eventId: string
  ): Promise<FreeEventRegistration | null> {
    return await this.repository.findOne({ where: { email, eventId } });
  }

  static async getFreeRegistrationsByNationalIdAndEventId(
    nationalId: string,
    eventId: string
  ): Promise<FreeEventRegistration | null> {
    return await this.repository.findOne({ where: { nationalId, eventId } });
  }
}
