"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.QrCodeService = void 0;
const uuid_1 = require("uuid");
const qrcode_1 = __importDefault(require("qrcode"));
const CloudinaryUploadService_1 = require("../../services/CloudinaryUploadService");
class QrCodeService {
    static generateQrCode(registrationId, userId, eventId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const qrPayload = {
                    registrationId,
                    userId,
                    eventId,
                    timestamp: new Date().toISOString(),
                    uniqueHash: (0, uuid_1.v4)(),
                };
                const qrDataString = Buffer.from(JSON.stringify(qrPayload)).toString("base64");
                // Generate QR code as a data URL (base64 string)
                const qrCodeDataUrl = yield qrcode_1.default.toDataURL(qrDataString);
                // Upload to Cloudinary
                const uploadResult = yield CloudinaryUploadService_1.CloudinaryUploadService.uploadBuffer(Buffer.from(qrCodeDataUrl.split(",")[1], "base64"), // Extract base64 data and convert to buffer
                "qrcodes", // Folder in Cloudinary
                `qrcode-${registrationId}` // Public ID
                );
                console.log(`[QrCodeService] Successfully uploaded QR code to: ${uploadResult.url}`);
                return uploadResult.url;
            }
            catch (error) {
                console.error(`[QrCodeService] Error generating QR code for ${registrationId}:`, error);
                throw new Error("Failed to generate and save QR code image.");
            }
        });
    }
    static validateQrCode(qrCodeData) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // QR code data is Base64 encoded JSON payload
                const decodedString = Buffer.from(qrCodeData, "base64").toString("utf8");
                const qrPayload = JSON.parse(decodedString);
                // Basic validation of payload structure
                if (!qrPayload.registrationId ||
                    !qrPayload.userId ||
                    !qrPayload.eventId ||
                    !qrPayload.uniqueHash) {
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
            }
            catch (error) {
                console.error("Error validating QR code:", error);
                return {
                    success: false,
                    message: "Failed to parse or validate QR code data.",
                };
            }
        });
    }
}
exports.QrCodeService = QrCodeService;
