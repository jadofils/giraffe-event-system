import { CloudinaryUploadService } from "../CloudinaryUploadService";
import JsBarcode from "jsbarcode";
import { JSDOM } from "jsdom";
import sharp from "sharp"; // Import sharp

export class BarcodeService {
  static async generateBarcode(
    sevenDigitCode: string,
    registrationId: string
  ): Promise<string> {
    try {
      const barcodePayload = sevenDigitCode;

      // Create a dummy DOM to render the SVG barcode
      const { window } = new JSDOM(
        '<!DOCTYPE html><html><body><svg id="barcode"></svg></body></html>'
      );
      const document = window.document;
      const svgElement = document.getElementById("barcode");

      if (!svgElement) {
        throw new Error("Could not create SVG element in JSDOM.");
      }

      // Temporarily mock the global document object for jsbarcode
      const originalDocument = global.document;
      global.document = document;

      try {
        JsBarcode(svgElement, barcodePayload, {
          format: "CODE128",
          displayValue: false,
          width: 2,
          height: 100,
        });
      } finally {
        global.document = originalDocument;
      }

      const svgString = svgElement.outerHTML;

      // Convert SVG string to PNG buffer using sharp
      const pngBuffer = await sharp(Buffer.from(svgString)).png().toBuffer();

      // Upload the PNG buffer to Cloudinary
      const uploadResult = await CloudinaryUploadService.uploadBuffer(
        pngBuffer, // Upload PNG buffer instead of SVG buffer
        "barcodes",
        `barcode-${registrationId}`,
        "image" // Ensure resource_type is image
      );

      console.log(
        `[BarcodeService] Successfully uploaded barcode to: ${uploadResult.url}`
      );
      return uploadResult.url;
    } catch (error) {
      console.error(
        `[BarcodeService] Error generating barcode for ${registrationId}:`,
        error
      );
      throw new Error("Failed to generate and save barcode image.");
    }
  }
}
