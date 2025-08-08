import { FreeEventRegistrationRepository } from "../../repositories/FreeEventRegistrationRepository";
import { CheckInStaffRepository } from "../../repositories/CheckInStaffRepository"; // Import CheckInStaffRepository

export class SixDigitCodeService {
  private static async isCodeUnique(code: string): Promise<boolean> {
    // Check against CheckInStaffRepository for uniqueness
    const existingStaff =
      await CheckInStaffRepository.getCheckInStaffBySixDigitCode(code);
    return !existingStaff; // If no existing staff with this code, it's unique
  }

  public static async generateUniqueSixDigitCode(): Promise<string> {
    let code: string;
    let isUnique: boolean;
    do {
      code = Math.floor(100000 + Math.random() * 900000).toString(); // Generate 6-digit number
      isUnique = await SixDigitCodeService.isCodeUnique(code);
    } while (!isUnique);
    return code;
  }
}
