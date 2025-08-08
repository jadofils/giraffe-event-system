import { AppDataSource } from "../config/Database";
import { CheckInStaff } from "../models/CheckInStaff";
import { Repository, DeleteResult, UpdateResult } from "typeorm";

export class CheckInStaffRepository {
  private static repository: Repository<CheckInStaff> =
    AppDataSource.getRepository(CheckInStaff);

  static async createCheckInStaff(
    staffData: Partial<CheckInStaff>
  ): Promise<CheckInStaff> {
    const newStaff = this.repository.create(staffData);
    return await this.repository.save(newStaff);
  }

  static async getCheckInStaffById(
    staffId: string
  ): Promise<CheckInStaff | null> {
    return await this.repository.findOne({ where: { staffId } });
  }

  static async getCheckInStaffBySixDigitCode(
    sixDigitCode: string
  ): Promise<CheckInStaff | null> {
    return await this.repository.findOne({ where: { sixDigitCode } });
  }

  static async getCheckInStaffByEventId(
    eventId: string
  ): Promise<CheckInStaff[]> {
    return await this.repository.find({ where: { eventId } });
  }

  static async updateCheckInStaff(
    staffId: string,
    updateData: Partial<CheckInStaff>
  ): Promise<CheckInStaff | null> {
    const result: UpdateResult = await this.repository.update(
      staffId,
      updateData
    );
    if (!result.affected) return null;
    return await this.getCheckInStaffById(staffId);
  }

  static async deleteCheckInStaff(staffId: string): Promise<DeleteResult> {
    return await this.repository.delete(staffId);
  }
}
