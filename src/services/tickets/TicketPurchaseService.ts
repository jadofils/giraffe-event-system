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
    qrCodeUrl?: string;
    attendedDate?: string; // New field for the date the ticket is valid for
  }[];
  qrCodeUrls?: string[];
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
      category?: string; // Add optional category for discount application
    }>, // selectedDate is now mandatory
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
        queryRunner.manager.getRepository(TicketPayment); // Get new TicketPayment repository

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

      // Process each ticket individually
      for (const ticketPurchase of ticketsToPurchase) {
        const { ticketTypeId, attendeeName, selectedDate } = ticketPurchase;

        // New: Use provided category for discount, or default to general if not provided
        const purchaseCategory =
          ticketPurchase.category || TicketCategory.GENERAL; // Default to GENERAL enum value

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
        let actualPriceInCents = ticketPriceInCents; // Start with base price in cents
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
            // Calculate discount amount in cents
            discountAppliedAmountInCents = Math.round(
              (ticketPriceInCents * discount.percent) / 100
            );
            actualPriceInCents =
              ticketPriceInCents - discountAppliedAmountInCents;
            appliedDiscountDescription = discount.description;
          }
        } else if (purchaseCategory !== TicketCategory.GENERAL) {
          // Use enum value for comparison
          // If a specific category was requested but no discount found for it, log or handle as needed
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
        totalTicketsCost += actualPriceInCents; // Accumulate in cents

        // Decrease available quantity for this ticket type
        ticketType.quantitySold += 1;
        ticketType.quantityAvailable -= 1;
        await ticketTypeRepo.save(ticketType);

        // Create individual registration entry
        const registration = registrationRepo.create({
          eventId: event.eventId,
          userId: buyerUser.userId, // Buyer is the user who initiated the purchase
          buyerId: buyerUser.userId,
          attendeeName: attendeeName, // The specific attendee's name for this ticket
          ticketTypeId: ticketType.ticketTypeId,
          venueId: event.eventVenues[0]?.venueId, // Get venueId from the first associated venue
          noOfTickets: 1, // Always 1 for individual ticket registration
          totalCost: actualPriceInCents / 100, // Convert to dollars for storage in DB
          paymentStatus: "PENDING", // Set to PENDING initially for each registration
          registrationStatus: "active",
          event,
          user: buyerUser,
          buyer: buyerUser,
          ticketType,
          attendedDate: selectedDate, // Set the specific date for this ticket from mandatory selectedDate
        });
        await registrationRepo.save(registration);
        purchasedRegistrations.push(registration);
      }

      // 3. Validate total cost against amount paid (after processing all tickets)
      // Perform comparison using rounded cents to avoid floating-point issues
      const amountPaidInCents = Math.round(paymentDetails.amountPaid * 100);
      // totalTicketsCost is already in cents, so no rounding needed here.
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
        // You might want to handle refunds or store overpayment details here
      }

      // 4. Process Payment (once for the total amount)
      // Create a single TicketPayment record for the entire purchase
      // For simplicity, we'll associate it with the first registration.
      // In a more complex scenario, you might have a separate Purchase or Order model.
      const firstRegistration = purchasedRegistrations[0];
      const ticketPayment = ticketPaymentRepo.create({
        amountPaid: paymentDetails.amountPaid,
        paymentMethod: paymentDetails.paymentMethod,
        paymentStatus: VenueBookingPaymentStatus.PAID, // Assume completed if amount is sufficient
        paymentReference: paymentDetails.paymentReference,
        payerId: buyerUser.userId,
        payerType: "USER",
        notes: `Payment for ${ticketsToPurchase.length} tickets for event ${firstRegistration.event.eventName}`,
      });
      await ticketPaymentRepo.save(ticketPayment);

      // Update all purchased registrations with the new paymentId and status
      for (const reg of purchasedRegistrations) {
        reg.paymentId = ticketPayment.paymentId;
        reg.paymentStatus = VenueBookingPaymentStatus.PAID; // Mark as PAID
        await registrationRepo.save(reg);
      }

      // 5. Generate QR codes for all purchased tickets and send consolidated email
      const emailTicketDetails: Array<{
        qrCodeUrl: string;
        attendeeName: string;
        ticketName: string;
        attendedDate: string; // Include attended date in email details
      }> = [];
      for (const registration of purchasedRegistrations) {
        // Re-fetch event with venue details if not already loaded consistently
        const eventForEmail = await eventRepo.findOne({
          where: { eventId: registration.eventId },
          relations: ["eventVenues", "eventVenues.venue"],
        });
        if (!eventForEmail) continue; // Should not happen

        const qrCodeUrl = await QrCodeService.generateQrCode(
          registration.registrationId,
          registration.userId,
          registration.eventId
        );
        registration.qrCode = qrCodeUrl;
        await registrationRepo.save(registration);
        qrCodeUrls.push(qrCodeUrl);

        emailTicketDetails.push({
          qrCodeUrl,
          attendeeName: registration.attendeeName || "",
          ticketName: registration.ticketType.name,
          attendedDate: registration.attendedDate || "", // Pass the attended date
        });
      }

      // Send Ticket Email (consolidated)
      try {
        const eventForEmail = purchasedRegistrations[0].event; // Assuming all tickets are for the same event
        const venueForEmail = eventForEmail?.eventVenues?.[0]?.venue; // Safely get venue details
        await EmailService.sendTicketsEmail({
          to: recipientEmail,
          subject: `Your Tickets for ${
            eventForEmail?.eventName || "Your Event"
          }`,
          eventName: eventForEmail?.eventName || "Your Event",
          eventDate: eventForEmail?.bookingDates[0]?.date
            ? new Date(eventForEmail.bookingDates[0].date)
            : new Date(), // Using first overall event date for email header
          venueName: venueForEmail?.venueName || "N/A",
          venueGoogleMapsLink: venueForEmail?.googleMapsLink || undefined, // Pass the Google Maps link
          tickets: emailTicketDetails,
        });
      } catch (emailError) {
        console.error("Failed to send ticket email:", emailError);
        // Do not roll back transaction for email failure, but log it
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
          qrCodeUrl: reg.qrCode,
          attendedDate: reg.attendedDate, // Include attendedDate in the response
        })),
        qrCodeUrls: qrCodeUrls,
        paymentStatus: VenueBookingPaymentStatus.PAID,
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
