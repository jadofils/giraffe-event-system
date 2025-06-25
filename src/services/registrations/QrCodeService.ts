import { v4 as uuidv4 } from 'uuid';
import QRCode from 'qrcode';
import fs from 'fs';
import path from 'path';

const QR_CODES_UPLOAD_BASE_DIR = path.join(__dirname, '..', '..', 'src', 'Uploads', 'qrcodes');

if (!fs.existsSync(QR_CODES_UPLOAD_BASE_DIR)) {
  try {
    fs.mkdirSync(QR_CODES_UPLOAD_BASE_DIR, { recursive: true });
    console.log(`[QrCodeService] Successfully created directory: ${QR_CODES_UPLOAD_BASE_DIR}`);
  } catch (dirError) {
    console.error(`[QrCodeService] Failed to create directory ${QR_CODES_UPLOAD_BASE_DIR}:`, dirError);
    throw new Error(`Failed to initialize QR code upload directory: ${dirError}`);
  }
}

export class QrCodeService {
  static async generateQrCode(registrationId: string, userId: string, eventId: string): Promise<string> {
    try {
      const qrPayload = {
        registrationId,
        userId,
        eventId,
        timestamp: new Date().toISOString(),
        uniqueHash: uuidv4(),
      };

      const qrDataString = Buffer.from(JSON.stringify(qrPayload)).toString('base64');
      const filename = `qrcode-${registrationId}.png`;
      const absoluteFilePath = path.join(QR_CODES_UPLOAD_BASE_DIR, filename);

      console.log(`[QrCodeService] Generating QR code for registration ${registrationId} at: ${absoluteFilePath}`);
      await QRCode.toFile(absoluteFilePath, qrDataString);
      console.log(`[QrCodeService] Successfully saved QR code to: ${absoluteFilePath}`);

      return filename;
    } catch (error) {
      console.error(`[QrCodeService] Error generating QR code for ${registrationId}:`, error);
      throw new Error('Failed to generate and save QR code image.');
    }
  }

  static async validateQrCode(qrDataString: string): Promise<{ registrationId: string; userId: string; eventId: string } | null> {
    try {
      const decodedString = Buffer.from(qrDataString, 'base64').toString('utf8');
      const qrPayload = JSON.parse(decodedString);

      if (qrPayload && qrPayload.registrationId && qrPayload.userId && qrPayload.eventId) {
        return {
          registrationId: qrPayload.registrationId,
          userId: qrPayload.userId,
          eventId: qrPayload.eventId,
        };
      }
      return null;
    } catch (error) {
      console.error('Error validating QR code:', error);
      return null;
    }
  }
}