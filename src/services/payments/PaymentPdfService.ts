import PDFDocument from "pdfkit";
import { CloudinaryUploadService } from "../CloudinaryUploadService";
import axios from "axios";

interface PaymentReceiptDetails {
  payerName: string;
  payerEmail?: string;
  paymentDetails: string;
  paidAmount: number;
  totalAmount: number;
  remainingAmount: number;
  transactionId: string;
  paymentDate: Date;
  receiptNumber: string;
  venueName: string;
  dateBookedFor: string;
  organizationName: string;
  organizationAddress: string;
  organizationEmail: string;
  organizationPhone: string;
  organizationLogoUrl?: string;
  paymentMethod: string;
}

export class PaymentPdfService {
  static async generatePaymentReceiptPdf(
    details: PaymentReceiptDetails
  ): Promise<Buffer> {
    return new Promise(async (resolve, reject) => {
      const doc = new PDFDocument({
        size: "A4",
        margin: 50,
        info: {
          Title: `Payment Receipt - ${details.payerName}`,
          Author: details.organizationName,
          Subject: "Payment Receipt",
        },
      });

      const buffers: Buffer[] = [];
      doc.on("data", buffers.push.bind(buffers));
      doc.on("end", () => resolve(Buffer.concat(buffers)));
      doc.on("error", reject);

      let orgLogoBuffer: Buffer | undefined;
      if (details.organizationLogoUrl) {
        try {
          const response = await axios.get(details.organizationLogoUrl, {
            responseType: "arraybuffer",
          });
          orgLogoBuffer = Buffer.from(response.data);
        } catch (error) {
          console.error("Failed to fetch organization logo:", error);
        }
      }

      const startY = 50;

      // Header & Title
      if (orgLogoBuffer) {
        doc.image(orgLogoBuffer, 50, startY, { width: 60 });
      }

      doc
        .fontSize(15)
        .fillColor("#1a73e8")
        .font("Helvetica-Bold")
        .text("Payment Receipt", 300, startY, { align: "right" });

      doc
        .fontSize(11)
        .fillColor("#333")
        .font("Helvetica-Bold")
        .text(details.organizationName, 50, orgLogoBuffer ? 120 : 80);

      doc
        .fontSize(9)
        .fillColor("#555")
        .font("Helvetica-Bold")
        .text(`Address: `, 50, doc.y, { continued: true })
        .font("Helvetica")
        .text(details.organizationAddress);

      doc
        .font("Helvetica-Bold")
        .text(`Email: `, 50, doc.y, { continued: true })
        .font("Helvetica")
        .text(details.organizationEmail);

      doc
        .font("Helvetica-Bold")
        .text(`Phone: `, 50, doc.y, { continued: true })
        .font("Helvetica")
        .text(details.organizationPhone);

      doc
        .moveDown(0.5)
        .strokeColor("#ccc")
        .lineWidth(1)
        .moveTo(50, doc.y)
        .lineTo(550, doc.y)
        .stroke();

      doc.moveDown(0.5);

      // Receipt Number
      doc
        .font("Helvetica-Bold")
        .fontSize(10)
        .fillColor("#333")
        .text(`Receipt No: `, { continued: true });
      doc.font("Helvetica").text(details.receiptNumber);

      // Payer Information
      doc.moveDown(0.5);
      doc.font("Helvetica-Bold").text("Payer Information");
      doc.moveDown(0.3);
      doc
        .font("Helvetica-Bold")
        .fontSize(10)
        .text("Full Name: ", { continued: true });
      doc.font("Helvetica").text(details.payerName);
      if (details.payerEmail) {
        doc.font("Helvetica-Bold").text("Email: ", { continued: true });
        doc.font("Helvetica").text(details.payerEmail);
      }

      // Paid To
      doc.moveDown(0.5);
      doc.font("Helvetica-Bold").fontSize(10).text("Paid To:");
      doc.font("Helvetica").text(details.organizationName);

      // Booking Details
      doc.moveDown(0.5);
      doc.font("Helvetica-Bold").fontSize(10).text("Booking Information");
      doc.moveDown(0.3);
      doc.font("Helvetica-Bold").text("Venue Name: ", { continued: true });
      doc.font("Helvetica").text(details.venueName);
      doc.font("Helvetica-Bold").text("Date Booked For: ", { continued: true });
      doc.font("Helvetica").text(details.dateBookedFor);

      // Payment Summary
      doc.moveDown(0.5);
      doc.font("Helvetica-Bold").fontSize(10).text("Payment Summary");
      doc.moveDown(0.3);

      doc.font("Helvetica-Bold").text("Payment For: ", { continued: true });
      doc.font("Helvetica").text(details.paymentDetails);

      doc.font("Helvetica-Bold").text("Payment Date: ", { continued: true });
      doc.font("Helvetica").text(
        details.paymentDate.toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
        })
      );

      doc.font("Helvetica-Bold").text("Payment Method: ", { continued: true });
      doc.font("Helvetica").text(details.paymentMethod);

      doc.moveDown(0.3);
      doc
        .font("Helvetica-Bold")
        .fillColor("#000")
        .text("Total Amount: ", { continued: true });
      doc.font("Helvetica").text(
        `RWF ${details.totalAmount.toLocaleString("en-US", {
          minimumFractionDigits: 2,
        })}`
      );

      doc.font("Helvetica-Bold").text("Amount Paid: ", { continued: true });
      doc.font("Helvetica").text(
        `RWF ${details.paidAmount.toLocaleString("en-US", {
          minimumFractionDigits: 2,
        })}`
      );

      doc
        .font("Helvetica-Bold")
        .text("Remaining Balance: ", { continued: true });
      doc.font("Helvetica").text(
        `RWF ${details.remainingAmount.toLocaleString("en-US", {
          minimumFractionDigits: 2,
        })}`
      );

      // Footer
      doc.moveDown(1);
      doc
        .fontSize(9)
        .fillColor("#777")
        .text(
          `Thank you for choosing ${details.organizationName} Venue. We look forward to hosting your event!`,
          50,
          doc.y,
          { align: "center" }
        );

      doc
        .text(`Address: ${details.organizationAddress}`, { align: "center" })
        .text(`Email: ${details.organizationEmail}`, { align: "center" })
        .text(`Phone: ${details.organizationPhone}`, { align: "center" });

      doc.moveDown(0.5);
      // Optional Signature Line
      // doc.text("_________________________", { align: "center" });
      // doc.text("Digital / Handwritten Signature", { align: "center" });

      doc.end();
    });
  }

  static async uploadPaymentReceiptPdf(
    pdfBuffer: Buffer,
    payerName: string,
    transactionId: string
  ): Promise<{ url: string; public_id: string }> {
    const folder = "payment_receipts";
    const filename = `Payment_Receipt_${payerName.replace(/ /g, "_")}.pdf`;
    return CloudinaryUploadService.uploadBuffer(
      pdfBuffer,
      folder,
      filename,
      "raw"
    );
  }
}
