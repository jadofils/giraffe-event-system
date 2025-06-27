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
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const QR_CODES_UPLOAD_BASE_DIR = path_1.default.join(__dirname, '..', '..', 'src', 'Uploads', 'qrcodes');
if (!fs_1.default.existsSync(QR_CODES_UPLOAD_BASE_DIR)) {
    try {
        fs_1.default.mkdirSync(QR_CODES_UPLOAD_BASE_DIR, { recursive: true });
        console.log(`[QrCodeService] Successfully created directory: ${QR_CODES_UPLOAD_BASE_DIR}`);
    }
    catch (dirError) {
        console.error(`[QrCodeService] Failed to create directory ${QR_CODES_UPLOAD_BASE_DIR}:`, dirError);
        throw new Error(`Failed to initialize QR code upload directory: ${dirError}`);
    }
}
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
                const qrDataString = Buffer.from(JSON.stringify(qrPayload)).toString('base64');
                const filename = `qrcode-${registrationId}.png`;
                const absoluteFilePath = path_1.default.join(QR_CODES_UPLOAD_BASE_DIR, filename);
                console.log(`[QrCodeService] Generating QR code for registration ${registrationId} at: ${absoluteFilePath}`);
                yield qrcode_1.default.toFile(absoluteFilePath, qrDataString);
                console.log(`[QrCodeService] Successfully saved QR code to: ${absoluteFilePath}`);
                return filename;
            }
            catch (error) {
                console.error(`[QrCodeService] Error generating QR code for ${registrationId}:`, error);
                throw new Error('Failed to generate and save QR code image.');
            }
        });
    }
    static validateQrCode(qrDataString) {
        return __awaiter(this, void 0, void 0, function* () {
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
            }
            catch (error) {
                console.error('Error validating QR code:', error);
                return null;
            }
        });
    }
}
exports.QrCodeService = QrCodeService;
