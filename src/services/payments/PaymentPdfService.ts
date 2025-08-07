import PDFDocument from "pdfkit";
import { CloudinaryUploadService } from "../CloudinaryUploadService";
import axios from "axios"; // Import axios

interface PaymentReceiptDetails {
  payerName: string;
  paymentDetails: string;
  paidAmount: number;
  totalAmount: number;
  remainingAmount: number;
  transactionId: string;
  paymentDate: Date;
}

export class PaymentPdfService {
  static async generatePaymentReceiptPdf(
    details: PaymentReceiptDetails
  ): Promise<Buffer> {
    return new Promise(async (resolve, reject) => {
      const doc = new PDFDocument({
        size: "A4",
        margin: 50,
      });
      const buffers: Buffer[] = [];

      doc.on("data", buffers.push.bind(buffers));
      doc.on("end", () => {
        resolve(Buffer.concat(buffers));
      });
      doc.on("error", reject);

      // Fetch the image as a buffer
      const imageUrl =
        "https://res.cloudinary.com/di5ntdtyl/image/upload/v1754567261/giraffe-logo_t9pqsp.jpg";
      let imageBuffer: Buffer | undefined;
      try {
        const response = await axios.get(imageUrl, {
          responseType: "arraybuffer",
        });
        imageBuffer = Buffer.from(response.data);
      } catch (error) {
        console.error("Failed to fetch image for PDF:", error);
        // Fallback or reject if image is critical
        // For now, we'll continue without the image if it fails to load
      }

      // Header
      if (imageBuffer) {
        doc.image(imageBuffer, 50, 50, { width: 60 });
      } else {
        // Fallback text if image cannot be loaded
        doc.fontSize(16).fillColor("#4285F4").text("Giraffe Space", 50, 70);
      }
      doc.fontSize(24).fillColor("#4285F4").text("Payment Receipt", 120, 70);
      doc
        .fontSize(12)
        .fillColor("#666666")
        .text(`Transaction ID: ${details.transactionId}`, 120, 95);
      doc.moveDown();

      // Separator Line
      doc
        .strokeColor("#e0e0e0")
        .lineWidth(1)
        .moveTo(50, 120)
        .lineTo(550, 120)
        .stroke();
      doc.moveDown();

      // Payer and Payment Details
      doc.fontSize(14).fillColor("#333333").text("Payer: ", 50, doc.y);
      doc
        .fontSize(16)
        .fillColor("#1a73e8")
        .text(details.payerName, 100, doc.y - 2);
      doc.moveDown(0.5);

      doc.fontSize(14).fillColor("#333333").text("Payment For: ", 50, doc.y);
      doc
        .fontSize(16)
        .fillColor("#1a73e8")
        .text(details.paymentDetails, 150, doc.y - 2);
      doc.moveDown(0.5);

      doc.fontSize(14).fillColor("#333333").text("Payment Date: ", 50, doc.y);
      doc
        .fontSize(16)
        .fillColor("#1a73e8")
        .text(
          details.paymentDate.toLocaleDateString("en-US", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
          }),
          160,
          doc.y - 2
        );
      doc.moveDown(2);

      // Amounts Section
      const yStartAmounts = doc.y;
      doc
        .fontSize(14)
        .fillColor("#555555")
        .text("Total Amount Due:", 50, yStartAmounts);
      doc
        .fontSize(14)
        .fillColor("#555555")
        .text(`$${details.totalAmount.toFixed(2)}`, 450, yStartAmounts, {
          align: "right",
        });
      doc.moveDown(0.5);

      doc.fontSize(14).fillColor("#555555").text("Amount Paid:", 50, doc.y);
      doc
        .fontSize(14)
        .fillColor("#555555")
        .text(`$${details.paidAmount.toFixed(2)}`, 450, doc.y, {
          align: "right",
        });
      doc.moveDown(0.5);

      doc
        .fontSize(14)
        .fillColor("#555555")
        .text("Remaining Amount:", 50, doc.y);
      doc
        .fontSize(14)
        .fillColor("#555555")
        .text(`$${details.remainingAmount.toFixed(2)}`, 450, doc.y, {
          align: "right",
        });
      doc.moveDown(2);

      // Footer
      doc
        .fontSize(10)
        .fillColor("#999999")
        .text("Thank you for your business!", 50, doc.page.height - 50, {
          align: "center",
        });
      doc.end();
    });
  }

  static async uploadPaymentReceiptPdf(
    pdfBuffer: Buffer,
    transactionId: string
  ): Promise<{ url: string; public_id: string }> {
    const folder = "payment_receipts";
    const filename = `receipt-${transactionId}.pdf`;
    return CloudinaryUploadService.uploadBuffer(
      pdfBuffer,
      folder,
      filename,
      "raw"
    );
  }
}
