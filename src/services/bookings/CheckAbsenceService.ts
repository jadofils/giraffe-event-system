import { AppDataSource } from "../../config/Database";
import {
  VenueAvailabilitySlot,
  SlotStatus,
} from "../../models/Venue Tables/VenueAvailabilitySlot";
import { Not, Raw } from "typeorm";

export class CheckAbsenceService {
  static async checkDateAvailability(
    venueId: string,
    date: Date
  ): Promise<boolean> {
    const slotRepo = AppDataSource.getRepository(VenueAvailabilitySlot);
    const existingSlot = await slotRepo.findOne({
      where: {
        venueId,
        Date: date,
        status: Not(SlotStatus.AVAILABLE),
      },
    });
    return !existingSlot; // If no slot exists or slot is AVAILABLE, the date is available
  }

  static async checkHourAvailability(
    venueId: string,
    date: Date,
    hour: number
  ): Promise<boolean> {
    const slotRepo = AppDataSource.getRepository(VenueAvailabilitySlot);
    const existingSlot = await slotRepo.findOne({
      where: {
        venueId,
        Date: date,
        status: Not(SlotStatus.AVAILABLE),
        bookedHours: Raw((alias) => `:hour = ANY(${alias})`, { hour }),
      },
    });
    return !existingSlot; // If no slot exists or slot is AVAILABLE, the hour is available
  }
}
