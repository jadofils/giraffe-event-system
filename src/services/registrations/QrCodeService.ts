import { v4 as uuidv4 } from "uuid";
import QRCode from "qrcode";
import { CloudinaryUploadService } from "../../services/CloudinaryUploadService";

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

  static async validateQrCode(
    qrCodeData: string
  ): Promise<{ success: boolean; message: string; data?: any }> {
    try {
      // QR code data is Base64 encoded JSON payload
      const decodedString = Buffer.from(qrCodeData, "base64").toString("utf8");
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

      // You can add more complex validation here:
      // - Check if registrationId exists in your database
      // - Check if the ticket is still valid (not expired, not used)
      // - Check if userId and eventId match the registration record

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
}
