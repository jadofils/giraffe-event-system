import { AppDataSource } from "../../config/Database";
import { Registration } from "../../models/Registration";

export class SevenDigitCodeService {
  static async generateUniqueSevenDigitCode(): Promise<string> {
    let code: string = ""; // Initialize code to an empty string
    let isUnique = false;
    const registrationRepo = AppDataSource.getRepository(Registration);

    while (!isUnique) {
      // Generate a random 7-digit number
      code = Math.floor(1000000 + Math.random() * 9000000).toString();
      // Check if it exists in the database
      const existingRegistration = await registrationRepo.findOne({
        where: { sevenDigitCode: code },
      });
      if (!existingRegistration) {
        isUnique = true;
      }
    }
    return code;
  }
}
