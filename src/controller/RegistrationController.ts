import { Request, Response } from "express";
import { AppDataSource } from "../config/Database";
import { Registration } from "../models/Registration";
import { EventVenue } from "../models/Event Tables/EventVenue";
import { TicketValidationService } from "../services/registrations/TicketValidationService"; // NEW IMPORT
import { BarcodeService } from "../services/registrations/BarcodeService"; // Import BarcodeService
import { SevenDigitCodeService } from "../services/registrations/SevenDigitCodeService"; // Import SevenDigitCodeService

export class RegistrationController {
  static async validateTicketQrCode(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const { qrCodeData } = req.body; // Expecting the raw Base64 string from the QR code

      if (!qrCodeData) {
        res
          .status(400)
          .json({ success: false, message: "QR code data is required." });
        return;
      }

      // The qrCodeData from the scanned QR code is the Base64 encoded payload
      const validationResult = await TicketValidationService.validateQrCode(
        qrCodeData
      );

      if (!validationResult.success || !validationResult.data) {
        res
          .status(400)
          .json({ success: false, message: validationResult.message });
        return;
      }

      // Fetch more details about the registration for the response
      const registrationRepo = AppDataSource.getRepository(Registration);
      const registration = await registrationRepo.findOne({
        where: { registrationId: validationResult.data.registrationId },
        relations: ["event", "ticketType", "user"], // Load necessary relations
      });

      if (!registration) {
        res.status(404).json({
          success: false,
          message: "Registration not found after QR validation.",
        });
        return;
      }

      // Explicitly fetch EventVenues for the event to ensure venue details are loaded
      const eventVenueRepo = AppDataSource.getRepository(EventVenue);
      const eventVenues = await eventVenueRepo.find({
        where: { eventId: registration.eventId },
        relations: ["venue"], // Load the venue for each EventVenue
      });

      // Check if eventDate is an array and access the first element, or provide a fallback
      const eventDate =
        registration.event.bookingDates &&
        registration.event.bookingDates.length > 0
          ? registration.event.bookingDates[0].date
          : null;

      res.status(200).json({
        success: true,
        message: "QR Code validated successfully!",
        data: {
          qrPayload: validationResult.data, // The decoded QR payload
          registration: {
            registrationId: registration.registrationId,
            attendeeName: registration.attendeeName,
            ticketTypeName: registration.ticketType.name,
            eventName: registration.event.eventName,
            eventDate: registration.attendedDate || null, // Specific date for THIS ticket
            allEventBookingDates: registration.event?.bookingDates || [], // All dates for the event
            venueName: eventVenues[0]?.venue?.venueName || "N/A", // Use explicitly fetched venue name
            paymentStatus: registration.paymentStatus,
            registrationStatus: registration.registrationStatus,
            qrCode: registration.qrCode,
            buyerId: registration.buyerId,
            attendedDate: registration.attendedDate || null, // Include the attended date
            attended: registration.attended, // Include the attended status
          },
        },
      });
    } catch (error) {
      console.error("Error validating QR code:", error);
      res.status(500).json({
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "An unexpected error occurred during QR code validation.",
      });
    }
  }

  static async getTicketsByUserId(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params;

      if (!userId) {
        res
          .status(400)
          .json({ success: false, message: "User ID is required." });
        return;
      }

      const registrationRepo = AppDataSource.getRepository(Registration);
      const tickets = await registrationRepo.find({
        where: { buyerId: userId },
        relations: ["event", "ticketType", "venue", "payment"], // Load all necessary relations
        order: { createdAt: "DESC" },
      });

      if (!tickets || tickets.length === 0) {
        res
          .status(404)
          .json({ success: false, message: "No tickets found for this user." });
        return;
      }

      const formattedTickets = tickets.map((ticket) => ({
        registrationId: ticket.registrationId,
        attendeeName: ticket.attendeeName,
        ticketTypeName: ticket.ticketType?.name || "N/A",
        eventId: ticket.eventId,
        eventName: ticket.event?.eventName || "N/A",
        eventPhoto: ticket.event?.eventPhoto || undefined, // Include event photo
        venueId: ticket.venueId,
        venueName: ticket.venue?.venueName || "N/A",
        venueGoogleMapsLink: ticket.venue?.googleMapsLink || undefined,
        noOfTickets: ticket.noOfTickets,
        totalCost: ticket.totalCost,
        registrationDate: ticket.registrationDate,
        attendedDate: ticket.attendedDate,
        checkDate: ticket.checkDate || "N/A",
        paymentStatus: ticket.paymentStatus,
        qrCode: ticket.qrCode,
        barcode: ticket.barcode, // Include barcode
        sevenDigitCode: ticket.sevenDigitCode, // Include 7-digit code
        buyerId: ticket.buyerId,
        attended: ticket.attended,
        isUsed: ticket.isUsed, // Include isUsed
        ticketTypeDetails: {
          ticketTypeId: ticket.ticketType?.ticketTypeId,
          name: ticket.ticketType?.name,
          price: ticket.ticketType?.price,
          quantityAvailable: ticket.ticketType?.quantityAvailable,
          quantitySold: ticket.ticketType?.quantitySold,
          currency: ticket.ticketType?.currency,
          description: ticket.ticketType?.description,
          saleStartsAt: ticket.ticketType?.saleStartsAt,
          saleEndsAt: ticket.ticketType?.saleEndsAt,
          maxPerPerson: ticket.ticketType?.maxPerPerson,
          isActive: ticket.ticketType?.isActive,
          isRefundable: ticket.ticketType?.isRefundable,
          refundPolicy: ticket.ticketType?.refundPolicy,
          transferable: ticket.ticketType?.transferable,
          ageRestriction: ticket.ticketType?.ageRestriction,
          specialInstructions: ticket.ticketType?.specialInstructions,
          status: ticket.ticketType?.status,
          startTime: ticket.ticketType?.startTime,
          endTime: ticket.ticketType?.endTime,
          customerBenefits: ticket.ticketType?.customerBenefits,
          discount: ticket.ticketType?.discount,
        },
        payment: ticket.payment
          ? {
              paymentId: ticket.payment.paymentId,
              amountPaid: ticket.payment.amountPaid,
              paymentMethod: ticket.payment.paymentMethod,
              paymentStatus: ticket.payment.paymentStatus,
              paymentReference: ticket.payment.paymentReference,
              notes: ticket.payment.notes,
            }
          : null,
      }));

      res.status(200).json({ success: true, data: formattedTickets });
    } catch (error) {
      console.error("Error fetching tickets by user ID:", error);
      res.status(500).json({
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "An unexpected error occurred while fetching tickets.",
      });
    }
  }

  static async markTicketAttended(req: Request, res: Response): Promise<void> {
    try {
      const { registrationId } = req.params;

      if (!registrationId) {
        res
          .status(400)
          .json({ success: false, message: "Registration ID is required." });
        return;
      }

      const registrationRepo = AppDataSource.getRepository(Registration);
      const ticket = await registrationRepo.findOne({
        where: { registrationId },
        relations: ["event", "ticketType", "venue", "payment"], // Load relevant relations
      });

      if (!ticket) {
        res.status(404).json({ success: false, message: "Ticket not found." });
        return;
      }

      if (ticket.attended) {
        res.status(400).json({
          success: false,
          message: "Ticket has already been marked as attended.",
          data: ticket, // Return the already-attended ticket details
        });
        return;
      }

      // You might add additional checks here, e.g., if paymentStatus is not PAID
      // if (ticket.paymentStatus !== "PAID") {
      //   res.status(400).json({ success: false, message: "Cannot mark an unpaid ticket as attended." });
      //   return;
      // }

      // Mark as attended
      ticket.attended = true;
      ticket.checkDate = new Date(); // Record the time of attendance
      await registrationRepo.save(ticket);

      res.status(200).json({
        success: true,
        message: "Ticket marked as attended successfully.",
        data: ticket,
      });
    } catch (error) {
      console.error("Error marking ticket as attended:", error);
      res.status(500).json({
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "An unexpected error occurred while marking ticket attended.",
      });
    }
  }

  static async checkInTicket(req: Request, res: Response): Promise<void> {
    try {
      const { ticketCode, codeType, eventId: requestedEventId } = req.body; // New: ticketCode and codeType

      if (!ticketCode || !codeType) {
        res.status(400).json({
          success: false,
          message:
            "Ticket code and code type (QR_CODE, BARCODE, or SEVEN_DIGIT_CODE) are required.",
        });
        return;
      }

      let registration: Registration | null = null;
      const registrationRepo = AppDataSource.getRepository(Registration);

      switch (codeType) {
        case "QR_CODE":
          const qrValidationResult =
            await TicketValidationService.validateQrCode(ticketCode);
          if (!qrValidationResult.success || !qrValidationResult.data) {
            res.status(400).json({
              success: false,
              message: qrValidationResult.message,
              alertType: "error",
            });
            return;
          }
          registration = await registrationRepo.findOne({
            where: { registrationId: qrValidationResult.data.registrationId },
            relations: ["event", "ticketType", "venue", "payment"],
          });
          break;

        case "BARCODE":
          const barcodeValidationResult =
            await TicketValidationService.validateBarcode(ticketCode);
          if (
            !barcodeValidationResult.success ||
            !barcodeValidationResult.data
          ) {
            res.status(400).json({
              success: false,
              message: barcodeValidationResult.message,
              alertType: "error",
            });
            return;
          }
          registration = await registrationRepo.findOne({
            where: {
              registrationId: barcodeValidationResult.data.registrationId,
            },
            relations: ["event", "ticketType", "venue", "payment"],
          });
          break;

        case "SEVEN_DIGIT_CODE":
          const sevenDigitCodeValidationResult =
            await TicketValidationService.validateSevenDigitCode(ticketCode);
          if (
            !sevenDigitCodeValidationResult.success ||
            !sevenDigitCodeValidationResult.data
          ) {
            res.status(400).json({
              success: false,
              message: sevenDigitCodeValidationResult.message,
              alertType: "error",
            });
            return;
          }
          registration = await registrationRepo.findOne({
            where: {
              registrationId:
                sevenDigitCodeValidationResult.data.registrationId,
            },
            relations: ["event", "ticketType", "venue", "payment"],
          });
          break;

        default:
          res.status(400).json({
            success: false,
            message:
              "Invalid code type provided. Must be QR_CODE, BARCODE, or SEVEN_DIGIT_CODE.",
            alertType: "error",
          });
          return;
      }

      if (!registration) {
        res.status(404).json({
          success: false,
          message: "Ticket not found in system with the provided code.",
          alertType: "error",
        });
        return;
      }

      // Explicitly fetch EventVenues for the event to ensure venue details are loaded
      const eventVenueRepo = AppDataSource.getRepository(EventVenue);
      const eventVenues = await eventVenueRepo.find({
        where: { eventId: registration.eventId },
        relations: ["venue"], // Load the venue for each EventVenue
      });

      // 3. Security & Context Validation
      // Ensure the ticket is for the event being checked in (if eventId is provided by scanner app)
      if (requestedEventId && requestedEventId !== registration.eventId) {
        res.status(400).json({
          success: false,
          message: "Ticket is for a different event.",
          alertType: "error",
          data: { eventName: registration.event?.eventName || "Unknown Event" },
        });
        return;
      }

      // Check payment status
      if (registration.paymentStatus !== "PAID") {
        res.status(400).json({
          success: false,
          message: `Ticket payment status is '${registration.paymentStatus}'. Payment required.`, // Customize message
          alertType: "warning",
          data: { paymentStatus: registration.paymentStatus },
        });
        return;
      }

      // 4. Attendance Status Check (already used?)
      if (registration.isUsed) {
        // Check the new isUsed field
        res.status(400).json({
          success: false,
          message: "Ticket has already been used.",
          alertType: "warning",
          data: { checkDate: registration.checkDate?.toISOString() }, // Show when it was used
        });
        return;
      }

      // 5. Date Validity Check (for day-specific tickets at multi-day events)
      // const today = new Date().toISOString().split("T")[0]; // Current date in YYYY-MM-DD format (UTC)
      // const ticketAttendedDateISO = ticket.attendedDate
      //   ? new Date(ticket.attendedDate).toISOString().split("T")[0]
      //   : null;

      // if (ticketAttendedDateISO && ticketAttendedDateISO !== today) {
      //   res.status(400).json({
      //     success: false,
      //     message: `Ticket is for ${new Date(
      //       ticket.attendedDate!
      //     ).toDateString()}, not for today (${new Date().toDateString()}).`,
      //     alertType: "error",
      //     data: { ticketDate: ticket.attendedDate, todayDate: today },
      //   });
      //   return;
      // }

      // 6. Mark Attended and Used (if all checks pass)
      registration.attended = true;
      registration.isUsed = true; // Mark as used
      registration.checkDate = new Date();
      await registrationRepo.save(registration);

      // 7. Comprehensive Success Response
      res.status(200).json({
        success: true,
        message: "Check-in successful!",
        alertType: "success",
        data: {
          registrationId: registration.registrationId,
          attendeeName: registration.attendeeName,
          ticketTypeName: registration.ticketType?.name || "N/A",
          eventName: registration.event?.eventName || "N/A",
          ticketAttendedDate: registration.attendedDate, // The specific date this ticket is valid for
          allEventBookingDates: registration.event?.bookingDates || [], // All event dates
          venueName: eventVenues[0]?.venue?.venueName || "N/A",
          venueGoogleMapsLink:
            eventVenues[0]?.venue?.googleMapsLink || undefined,
          paymentStatus: registration.paymentStatus,
          currentAttendanceStatus: registration.attended, // Should be true
          checkInTimestamp: registration.checkDate?.toISOString(),
          qrCode: registration.qrCode, // Include QR code in response
          barcode: registration.barcode, // Include barcode in response
          sevenDigitCode: registration.sevenDigitCode, // Include 7-digit code in response
        },
      });
    } catch (error) {
      console.error("Error during ticket check-in:", error);
      res.status(500).json({
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "An unexpected error occurred during check-in.",
        alertType: "error",
      });
    }
  }
}
