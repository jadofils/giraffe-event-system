import PDFDocument from "pdfkit";
import { CloudinaryUploadService } from "../CloudinaryUploadService";
import { pipeline } from "stream/promises";
import { Readable } from "stream";
import axios from "axios"; // For downloading images if needed

interface TicketPdfDetails {
  registrationId: string;
  attendeeName: string;
  ticketTypeName: string;
  eventName: string;
  eventDate: string; // YYYY-MM-DD
  venueName: string;
  qrCodeUrl: string;
  barcodeUrl: string;
  sevenDigitCode: string;
  venueGoogleMapsLink?: string;
}

export class TicketPdfService {
  static async generateTicketPdf(details: TicketPdfDetails): Promise<Buffer> {
    return new Promise(async (resolve, reject) => {
      const doc = new PDFDocument({
        size: "A4",
        margins: { top: 50, bottom: 50, left: 50, right: 50 },
      });

      const buffers: Buffer[] = [];
      doc.on("data", buffers.push.bind(buffers));
      doc.on("end", () => {
        resolve(Buffer.concat(buffers));
      });
      doc.on("error", reject);

      // Basic layout for the ticket
      doc
        .font("Helvetica-Bold")
        .fontSize(24)
        .fillColor("#1a73e8")
        .text(details.eventName, { align: "center" });
      doc
        .fontSize(16)
        .fillColor("#333")
        .text(details.ticketTypeName, { align: "center" });
      doc.moveDown();

      doc.fontSize(14).fillColor("#555");
      doc.text(`Attendee: ${details.attendeeName}`);
      doc.text(
        `Valid Date: ${new Date(details.eventDate).toLocaleDateString("en-US", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        })}`
      );
      doc.text(`Venue: ${details.venueName}`);
      if (details.venueGoogleMapsLink) {
        doc
          .text(`Location: `)
          .fillColor("blue")
          .text(details.venueGoogleMapsLink, {
            link: details.venueGoogleMapsLink,
            underline: true,
          });
        doc.fillColor("#555"); // Reset color
      }
      doc.moveDown(2);

      // QR Code
      try {
        // Fetch QR code image data
        const qrCodeResponse = await axios.get(details.qrCodeUrl, {
          responseType: "arraybuffer",
        });
        const qrCodeBuffer = Buffer.from(qrCodeResponse.data);
        doc.image(qrCodeBuffer, { fit: [150, 150], align: "center" });
      } catch (e) {
        console.error("Error loading QR code for PDF:", e);
        doc.text("QR Code N/A", { align: "center" });
      }
      doc.text("SCAN AT ENTRANCE", { align: "center" });
      doc.moveDown();

      // Barcode
      try {
        // Fetch Barcode image data
        const barcodeResponse = await axios.get(details.barcodeUrl, {
          responseType: "arraybuffer",
        });
        const barcodeBuffer = Buffer.from(barcodeResponse.data);
        doc.image(barcodeBuffer, { fit: [200, 80], align: "center" });
      } catch (e) {
        console.error("Error loading barcode for PDF:", e);
        doc.text("Barcode N/A", { align: "center" });
      }
      doc.text("OR SCAN BARCODE", { align: "center" });
      doc.moveDown();

      // 7-Digit Code
      doc
        .font("Helvetica-Bold")
        .fontSize(18)
        .fillColor("#4285F4")
        .text(`OR ENTER CODE: ${details.sevenDigitCode}`, { align: "center" });
      doc.moveDown(2);

      doc
        .fontSize(10)
        .fillColor("#888")
        .text(
          "Please keep this ticket secure. It is valid for one entry on the specified date.",
          { align: "center" }
        );
      doc.end();
    });
  }
}
