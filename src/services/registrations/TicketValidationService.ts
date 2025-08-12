import { AppDataSource } from "../../config/Database";
import { Registration } from "../../models/Registration";
import { v4 as uuidv4 } from "uuid";
import { CloudinaryUploadService } from "../CloudinaryUploadService";
import QRCode from "qrcode";

export class TicketValidationService {
  static async validateQrCode(
    qrCodeData: string
  ): Promise<{ success: boolean; message: string; data?: any }> {
    try {
      // Normalize potential whitespace and URL-safe base64 variants
      const sanitized = (qrCodeData || "")
        .toString()
        .trim()
        .replace(/\s+/g, "")
        .replace(/-/g, "+")
        .replace(/_/g, "/");

      // QR code data is Base64 encoded JSON payload
      const decodedString = Buffer.from(sanitized, "base64").toString("utf8");
      const qrPayload = JSON.parse(decodedString);

      // Basic validation of payload structure
      if (
        !qrPayload.registrationId ||
        !qrPayload.userId ||
        !qrPayload.eventId ||
        !qrPayload.uniqueHash
      ) {
        return { success: false, message: "Invalid QR code data structure." };
      }

      return {
        success: true,
        message: "QR Code data is valid.",
        data: qrPayload,
      };
    } catch (error) {
      console.error("Error validating QR code:", error);
      return {
        success: false,
        message: "Failed to parse or validate QR code data.",
      };
    }
  }

  static async validateBarcode(
    barcodeData: string
  ): Promise<{ success: boolean; message: string; data?: any }> {
    // In a real application, you would use a barcode scanning library or service
    // to decode the barcode data. For this example, we'll assume the barcodeData
    // directly contains the registrationId.
    const registrationRepo = AppDataSource.getRepository(Registration);
    const registration = await registrationRepo.findOne({
      where: { barcode: barcodeData },
    });

    if (!registration) {
      return { success: false, message: "Barcode not found or invalid." };
    }

    return {
      success: true,
      message: "Barcode validated successfully.",
      data: { registrationId: registration.registrationId },
    };
  }

  static async validateSevenDigitCode(
    sevenDigitCode: string
  ): Promise<{ success: boolean; message: string; data?: any }> {
    const registrationRepo = AppDataSource.getRepository(Registration);
    const registration = await registrationRepo.findOne({
      where: { sevenDigitCode: sevenDigitCode },
    });

    if (!registration) {
      return {
        success: false,
        message: "Seven-digit code not found or invalid.",
      };
    }

    return {
      success: true,
      message: "Seven-digit code validated successfully.",
      data: { registrationId: registration.registrationId },
    };
  }
}
