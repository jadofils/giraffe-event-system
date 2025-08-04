import { AppDataSource } from "../../config/Database";
import { EventTicketType } from "../../models/Event Tables/EventTicketType";
import { Registration } from "../../models/Registration";
import { User } from "../../models/User";
import { Event } from "../../models/Event Tables/Event";
import { QrCodeService } from "../registrations/QrCodeService";
import { EmailService } from "../emails/EmailService";
import { TicketPayment } from "../../models/TicketPayment"; // New import for TicketPayment
import { TicketPaymentRepository } from "../../repositories/TicketPaymentRepository"; // New import for TicketPaymentRepository
import { v4 as uuidv4 } from "uuid";
import {
  PaymentMethod,
  VenueBookingPaymentStatus,
} from "../../models/VenueBookingPayment"; // Reusing PaymentMethod and PaymentStatus
import { TicketCategory } from "../../interfaces/Enums/TicketEnums"; // Import TicketCategory
import { BarcodeService } from "../registrations/BarcodeService";
import { SevenDigitCodeService } from "../registrations/SevenDigitCodeService";
import { TicketPdfService } from "./TicketPdfService"; // NEW IMPORT
import { CloudinaryUploadService } from "../CloudinaryUploadService"; // NEW IMPORT

interface PurchaseTicketResponse {
  success: boolean;
  message: string;
  registrations?: {
    registrationId: string;
    attendeeName?: string;
    ticketTypeId: string;
    ticketTypeName: string;
    eventId: string;
    eventName: string;
    qrCodeUrl: string; // Ensure this is always a string
    barcodeUrl: string; // Ensure this is always a string
    sevenDigitCode: string; // Ensure this is always a string
    attendedDate: string;
    pdfUrl?: string;
  }[];
  qrCodeUrls?: string[];
  barcodeUrls?: string[];
  sevenDigitCodes?: string[];
  pdfUrls?: string[];
  paymentStatus?: string;
}

export class TicketPurchaseService {
  static async purchaseTicket(
    buyerUserId: string,
    recipientEmail: string,
    ticketsToPurchase: Array<{
      ticketTypeId: string;
      attendeeName: string;
      selectedDate: string;
      category?: string;
    }>,
    paymentDetails: {
      amountPaid: number;
      paymentMethod: PaymentMethod;
      paymentReference?: string;
    }
  ): Promise<PurchaseTicketResponse> {
    const queryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const ticketTypeRepo = queryRunner.manager.getRepository(EventTicketType);
      const registrationRepo = queryRunner.manager.getRepository(Registration);
      const userRepo = queryRunner.manager.getRepository(User);
      const eventRepo = queryRunner.manager.getRepository(Event);
      const ticketPaymentRepo =
        queryRunner.manager.getRepository(TicketPayment);

      // Fetch buyer user (the one making the purchase)
      const buyerUser = await userRepo.findOne({
        where: { userId: buyerUserId },
      });
      if (!buyerUser) {
        await queryRunner.rollbackTransaction();
        return { success: false, message: "Buyer user not found." };
      }

      const purchasedRegistrations: Registration[] = [];
      let totalTicketsCost = 0;
      const qrCodeUrls: string[] = [];
      const barcodeUrls: string[] = [];
      const sevenDigitCodes: string[] = [];
      const pdfUrls: string[] = [];

      // Process each ticket individually
      for (const ticketPurchase of ticketsToPurchase) {
        const { ticketTypeId, attendeeName, selectedDate } = ticketPurchase;

        // New: Use provided category for discount, or default to general if not provided
        const purchaseCategory =
          ticketPurchase.category || TicketCategory.GENERAL;

        const ticketType = await ticketTypeRepo.findOne({
          where: { ticketTypeId },
          // No need to load event for validForDate as it's removed from ticketType
        });
        if (!ticketType) {
          await queryRunner.rollbackTransaction();
          return {
            success: false,
            message: `Ticket type with ID ${ticketTypeId} not found.`,
          };
        }

        // Convert ticket price to cents to avoid floating-point issues from the start
        const ticketPriceInCents = Math.round(Number(ticketType.price) * 100);

        // Fetch event and venue relations
        const event = await eventRepo.findOne({
          where: { eventId: ticketType.eventId },
          relations: ["eventVenues", "eventVenues.venue"], // Include venue details for email
        });
        if (!event) {
          await queryRunner.rollbackTransaction();
          return {
            success: false,
            message: `Associated event for ticket type ${ticketTypeId} not found.`,
          };
        }

        // Validate ticket availability for this individual ticket
        if (ticketType.quantityAvailable < 1) {
          await queryRunner.rollbackTransaction();
          return {
            success: false,
            message: `Ticket type '${ticketType.name}' is sold out.`,
          };
        }

        // Validate selectedDate against event bookingDates (selectedDate is now mandatory)
        const eventBookingDateStrings = event.bookingDates.map((bd) => bd.date);
        if (!selectedDate || !eventBookingDateStrings.includes(selectedDate)) {
          await queryRunner.rollbackTransaction();
          return {
            success: false,
            message: `Selected date '${selectedDate}' is not a valid booking date for this event. Available dates: ${eventBookingDateStrings.join(
              ", "
            )}.`,
          };
        }

        // New: Validate selectedDate against ticketType.validForDate if specified
        if (
          ticketType.validForDate &&
          ticketType.validForDate !== selectedDate
        ) {
          await queryRunner.rollbackTransaction();
          return {
            success: false,
            message: `Selected date '${selectedDate}' does not match the required date for this ticket type: ${ticketType.validForDate}.`,
          };
        }

        // Calculate actual price after discount (if any), keeping everything in cents
        let actualPriceInCents = ticketPriceInCents;
        let discountAppliedAmountInCents = 0;
        let appliedDiscountDescription: string | undefined;

        // Check for category-specific discount
        if (
          ticketType.categoryDiscounts &&
          ticketType.categoryDiscounts[purchaseCategory as TicketCategory]
        ) {
          const discount =
            ticketType.categoryDiscounts[purchaseCategory as TicketCategory];
          if (discount?.percent !== undefined && discount.percent > 0) {
            discountAppliedAmountInCents = Math.round(
              (ticketPriceInCents * discount.percent) / 100
            );
            actualPriceInCents =
              ticketPriceInCents - discountAppliedAmountInCents;
            appliedDiscountDescription = discount.description;
          }
        } else if (purchaseCategory !== TicketCategory.GENERAL) {
          console.warn(
            `No specific discount found for category '${purchaseCategory}' on ticket type '${ticketType.name}'. Using base price.`
          );
        }

        console.log(
          `Ticket Type: ${ticketType.name}, Base Price (cents): ${ticketPriceInCents}`
        );
        console.log(`Purchase Category: ${purchaseCategory}`);
        console.log(
          `Discount Applied (cents): ${discountAppliedAmountInCents}, Actual Price (cents): ${actualPriceInCents}`
        );

        // Accumulate total cost (in cents)
        totalTicketsCost += actualPriceInCents;

        // Decrease available quantity for this ticket type
        ticketType.quantitySold += 1;
        ticketType.quantityAvailable -= 1;
        await ticketTypeRepo.save(ticketType);

        // Create individual registration entry
        const registration = registrationRepo.create({
          eventId: event.eventId,
          userId: buyerUser.userId,
          buyerId: buyerUser.userId,
          attendeeName: attendeeName,
          ticketTypeId: ticketType.ticketTypeId,
          venueId: event.eventVenues[0]?.venueId,
          noOfTickets: 1,
          totalCost: actualPriceInCents / 100,
          paymentStatus: "PENDING",
          registrationStatus: "active",
          event,
          user: buyerUser,
          buyer: buyerUser,
          ticketType,
          attendedDate: selectedDate,
          isUsed: false,
        });
        await registrationRepo.save(registration);
        purchasedRegistrations.push(registration);
      }

      // 3. Validate total cost against amount paid (after processing all tickets)
      const amountPaidInCents = Math.round(paymentDetails.amountPaid * 100);
      if (amountPaidInCents < totalTicketsCost) {
        await queryRunner.rollbackTransaction();
        return {
          success: false,
          message: "Amount paid is less than the total cost of all tickets.",
        };
      }

      // Check for overpayment (optional, but good practice)
      if (amountPaidInCents > totalTicketsCost) {
        console.warn(
          `Overpayment detected: Paid ${paymentDetails.amountPaid}, expected ${
            totalTicketsCost / 100
          }. No refund processed.`
        );
      }

      // 4. Process Payment (once for the total amount)
      const firstRegistration = purchasedRegistrations[0];
      const ticketPayment = ticketPaymentRepo.create({
        amountPaid: paymentDetails.amountPaid,
        paymentMethod: paymentDetails.paymentMethod,
        paymentStatus: VenueBookingPaymentStatus.COMPLETED,
        paymentReference: paymentDetails.paymentReference,
        payerId: buyerUser.userId,
        payerType: "USER",
        notes: `Payment for ${ticketsToPurchase.length} tickets for event ${firstRegistration.event.eventName}`,
      });
      await ticketPaymentRepo.save(ticketPayment);

      // Update all purchased registrations with the new paymentId and status
      for (const reg of purchasedRegistrations) {
        reg.paymentId = ticketPayment.paymentId;
        reg.paymentStatus = VenueBookingPaymentStatus.COMPLETED;
        await registrationRepo.save(reg);

        // Generate QR, Barcode, SevenDigitCode, and upload PDF for EACH registration
        const qrCodeUrl = await QrCodeService.generateQrCode(
          reg.registrationId,
          reg.userId,
          reg.eventId
        );
        reg.qrCode = qrCodeUrl;

        const sevenDigitCode =
          await SevenDigitCodeService.generateUniqueSevenDigitCode();
        reg.sevenDigitCode = sevenDigitCode;

        const barcodeUrl = await BarcodeService.generateBarcode(
          reg.sevenDigitCode!,
          reg.registrationId
        );
        reg.barcode = barcodeUrl;

        // The following lines are moved from inside the loop to ensure they are available for PDF generation
        const eventForPdf = reg.event;
        const venueForPdf = eventForPdf?.eventVenues?.[0]?.venue;

        const pdfBuffer = await TicketPdfService.generateTicketPdf({
          registrationId: reg.registrationId,
          attendeeName: reg.attendeeName || "",
          ticketTypeName: reg.ticketType.name,
          eventName: eventForPdf?.eventName || "",
          eventDate: eventForPdf?.bookingDates?.[0]?.date || "",
          venueName: venueForPdf?.venueName || "",
          qrCodeUrl: reg.qrCode || "",
          barcodeUrl: reg.barcode || "",
          sevenDigitCode: reg.sevenDigitCode || "",
          venueGoogleMapsLink: venueForPdf?.googleMapsLink,
        });

        const uploadResult = await CloudinaryUploadService.uploadBuffer(
          pdfBuffer,
          "tickets/pdfs",
          `ticket-${reg.registrationId}.pdf`,
          "raw"
        );
        reg.pdfUrl = uploadResult.url;
        await registrationRepo.save(reg);
        pdfUrls.push(uploadResult.url);
        qrCodeUrls.push(qrCodeUrl);
        barcodeUrls.push(barcodeUrl);
        sevenDigitCodes.push(sevenDigitCode);
      }

      // Send Ticket Email (consolidated)
      try {
        const eventForEmail = purchasedRegistrations[0].event;
        const venueForEmail = eventForEmail?.eventVenues?.[0]?.venue;
        await EmailService.sendTicketsEmail({
          to: recipientEmail,
          subject: `Your Tickets for ${
            eventForEmail?.eventName || "Your Event"
          }`,
          eventName: eventForEmail?.eventName || "Your Event",
          eventDate: eventForEmail?.bookingDates[0]?.date
            ? new Date(eventForEmail.bookingDates[0].date)
            : new Date(),
          venueName: venueForEmail?.venueName || "N/A",
          venueGoogleMapsLink: venueForEmail?.googleMapsLink || undefined,
          tickets: purchasedRegistrations.map((reg) => ({
            qrCodeUrl: reg.qrCode || "",
            barcodeUrl: reg.barcode || "",
            sevenDigitCode: reg.sevenDigitCode || "",
            attendeeName: reg.attendeeName || "",
            ticketName: reg.ticketType.name,
            attendedDate: reg.attendedDate || "",
            pdfUrl: reg.pdfUrl,
          })),
        });
      } catch (emailError) {
        console.error("Failed to send ticket email:", emailError);
      }

      await queryRunner.commitTransaction();

      return {
        success: true,
        message: "Ticket purchased successfully!",
        registrations: purchasedRegistrations.map((reg) => ({
          registrationId: reg.registrationId,
          attendeeName: reg.attendeeName,
          ticketTypeId: reg.ticketTypeId,
          ticketTypeName: reg.ticketType.name,
          eventId: reg.eventId,
          eventName: reg.event.eventName,
          qrCodeUrl: reg.qrCode || "",
          barcodeUrl: reg.barcode || "",
          sevenDigitCode: reg.sevenDigitCode || "",
          attendedDate: reg.attendedDate || "",
          pdfUrl: reg.pdfUrl,
        })),
        qrCodeUrls: qrCodeUrls,
        barcodeUrls: barcodeUrls,
        sevenDigitCodes: sevenDigitCodes,
        pdfUrls: pdfUrls,
        paymentStatus: VenueBookingPaymentStatus.COMPLETED,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      return {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "An unexpected error occurred during ticket purchase.",
      };
    } finally {
      await queryRunner.release();
    }
  }
}
