import { AppDataSource } from "../../config/Database";
import { Registration } from "../../models/Registration";
import { v4 as uuidv4 } from "uuid";
import { CloudinaryUploadService } from "../CloudinaryUploadService";
import QRCode from "qrcode";

export class QrCodeService {
  static async generateQrCode(
    registrationId: string,
    userId: string,
    eventId: string
  ): Promise<string> {
    try {
      const qrPayload = {
        registrationId,
        userId,
        eventId,
        timestamp: new Date().toISOString(),
        uniqueHash: uuidv4(),
      };

      const qrDataString = Buffer.from(JSON.stringify(qrPayload)).toString(
        "base64"
      );
      // Generate QR code as a data URL (base64 string)
      const qrCodeDataUrl = await QRCode.toDataURL(qrDataString);

      // Upload to Cloudinary
      const uploadResult = await CloudinaryUploadService.uploadBuffer(
        Buffer.from(qrCodeDataUrl.split(",")[1], "base64"), // Extract base64 data and convert to buffer
        "qrcodes", // Folder in Cloudinary
        `qrcode-${registrationId}` // Public ID
      );

      console.log(
        `[QrCodeService] Successfully uploaded QR code to: ${uploadResult.url}`
      );
      return uploadResult.url;
    } catch (error) {
      console.error(
        `[QrCodeService] Error generating QR code for ${registrationId}:`,
        error
      );
      throw new Error("Failed to generate and save QR code image.");
    }
  }
}
