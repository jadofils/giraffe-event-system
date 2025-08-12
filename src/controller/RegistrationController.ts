import { Request, Response } from "express";
import { AppDataSource } from "../config/Database";
import { Registration } from "../models/Registration";
import { EventVenue } from "../models/Event Tables/EventVenue";
import { TicketValidationService } from "../services/registrations/TicketValidationService"; // NEW IMPORT
import { BarcodeService } from "../services/registrations/BarcodeService"; // Import BarcodeService
import { SevenDigitCodeService } from "../services/registrations/SevenDigitCodeService"; // Import SevenDigitCodeService
import { CheckInStaffRepository } from "../repositories/CheckInStaffRepository"; // Import CheckInStaffRepository

export class RegistrationController {


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
      const {
        ticketCode,
        codeType,
        eventId: requestedEventId,
        sixDigitCode,
      } = req.body; // Add sixDigitCode

      if (!sixDigitCode) {
        res.status(400).json({
          success: false,
          message: "Six-digit staff code is required.",
        });
        return;
      }

      // staff will be revalidated against the ticket's event later to avoid cross-event collisions
      const staffByCode =
        await CheckInStaffRepository.getCheckInStaffBySixDigitCode(
          String(sixDigitCode)
        );
      if (!staffByCode) {
        res
          .status(401)
          .json({ success: false, message: "Invalid six-digit staff code." });
        return;
      }

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
            relations: [
              "event",
              "ticketType",
              "venue",
              "payment",
              "buyer",
              "user",
            ],
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
            relations: [
              "event",
              "ticketType",
              "venue",
              "payment",
              "buyer",
              "user",
            ],
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
            relations: [
              "event",
              "ticketType",
              "venue",
              "payment",
              "buyer",
              "user",
            ],
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

      // Ensure staff belongs to the same event as the ticket using a strict lookup by code+event
      const staff =
        await CheckInStaffRepository.getCheckInStaffBySixDigitCodeAndEventId(
          String(sixDigitCode),
          String(registration.eventId)
        );
      if (!staff) {
        res.status(403).json({
          success: false,
          message: "Staff code is not valid for this event's tickets.",
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
      if (
        registration.paymentStatus === "PENDING" ||
        registration.paymentStatus === "FAILED"
      ) {
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
      registration.checkedInByStaffId = staff.staffId; // Set the staff ID
      await registrationRepo.save(registration);

      // 7. Comprehensive Success Response
      res.status(200).json({
        success: true,
        message: "Check-in successful!",
        alertType: "success",
        data: {
          registrationId: registration.registrationId,
          ticketTypeName: registration.ticketType?.name || "N/A",
          eventName: registration.event?.eventName || "N/A",
          eventPhoto: registration.event?.eventPhoto || undefined,
          eventDate: registration.attendedDate, // The specific date this ticket is valid for
          allEventBookingDates: registration.event?.bookingDates || [], // All event dates
          venueName: eventVenues[0]?.venue?.venueName || "N/A",
          venueGoogleMapsLink:
            eventVenues[0]?.venue?.googleMapsLink || undefined,
          qrCode: registration.qrCode,
          barcode: registration.barcode,
          sevenDigitCode: registration.sevenDigitCode,
          pdfUrl: registration.pdfUrl,
          paymentStatus: registration.paymentStatus,
          attended: registration.attended,
          isUsed: registration.isUsed,
          checkInTimestamp: registration.checkDate?.toISOString(),
          // Attendee Details (from Registration model directly or associated User if applicable)
          attendeeDetails: {
            attendeeName: registration.attendeeName,
            nationalId: registration.nationalId,
            phoneNumber: registration.phoneNumber,
            gender: registration.gender,
            address: registration.address,
            email: registration.user?.email || null, // If attendee is a registered user
          },
          // Buyer Details
          buyerDetails: registration.buyer
            ? {
                buyerId: registration.buyer.userId,
                username: registration.buyer.username,
                email: registration.buyer.email,
                firstName: registration.buyer.firstName,
                lastName: registration.buyer.lastName,
                phoneNumber: registration.buyer.phoneNumber,
              }
            : null,
          checkedInByStaffId: staff.staffId, // Include the staff ID who checked in
          ticketTypeDetails: {
            ticketTypeId: registration.ticketType?.ticketTypeId,
            name: registration.ticketType?.name,
            price: registration.ticketType?.price,
            quantityAvailable: registration.ticketType?.quantityAvailable,
            quantitySold: registration.ticketType?.quantitySold,
            currency: registration.ticketType?.currency,
            description: registration.ticketType?.description,
            saleStartsAt: registration.ticketType?.saleStartsAt,
            saleEndsAt: registration.ticketType?.saleEndsAt,
            maxPerPerson: registration.ticketType?.maxPerPerson,
            isActive: registration.ticketType?.isActive,
            isRefundable: registration.ticketType?.isRefundable,
            refundPolicy: registration.ticketType?.refundPolicy,
            transferable: registration.ticketType?.transferable,
            ageRestriction: registration.ticketType?.ageRestriction,
            specialInstructions: registration.ticketType?.specialInstructions,
            status: registration.ticketType?.status,
            startTime: registration.ticketType?.startTime,
            endTime: registration.ticketType?.endTime,
            customerBenefits: registration.ticketType?.customerBenefits,
            discount: registration.ticketType?.discount,
          },
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

  static async viewTicketDetails(req: Request, res: Response): Promise<void> {
    try {
      const { ticketCode, codeType, sixDigitCode } = req.body;

      if (!sixDigitCode) {
        res.status(400).json({
          success: false,
          message: "Six-digit staff code is required.",
          alertType: "error",
        });
        return;
      }

      // Validate staff code first
      const staffByCode =
        await CheckInStaffRepository.getCheckInStaffBySixDigitCode(
          String(sixDigitCode)
        );
      if (!staffByCode) {
        res.status(401).json({
          success: false,
          message: "Invalid six-digit staff code.",
          alertType: "error",
        });
        return;
      }

      if (!ticketCode || !codeType) {
        res.status(400).json({
          success: false,
          message:
            "Ticket code and code type (QR_CODE, BARCODE, or SEVEN_DIGIT_CODE) are required.",
          alertType: "error",
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
            relations: ["event", "ticketType", "venue", "buyer", "user"], // Load buyer and user (attendee)
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
            relations: ["event", "ticketType", "venue", "buyer", "user"], // Load buyer and user (attendee)
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
            relations: ["event", "ticketType", "venue", "buyer", "user"], // Load buyer and user (attendee)
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

      // Ensure staff belongs to the same event as the ticket
      const staff =
        await CheckInStaffRepository.getCheckInStaffBySixDigitCodeAndEventId(
          String(sixDigitCode),
          String(registration.eventId)
        );
      if (!staff) {
        res.status(403).json({
          success: false,
          message: "Staff code is not valid for this event's tickets.",
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

      res.status(200).json({
        success: true,
        message: "Ticket details fetched successfully!",
        data: {
          registrationId: registration.registrationId,
          ticketTypeName: registration.ticketType?.name || "N/A",
          eventName: registration.event?.eventName || "N/A",
          eventPhoto: registration.event?.eventPhoto || undefined,
          eventDate: registration.attendedDate, // The specific date this ticket is valid for
          allEventBookingDates: registration.event?.bookingDates || [], // All event dates
          venueName: eventVenues[0]?.venue?.venueName || "N/A",
          venueGoogleMapsLink:
            eventVenues[0]?.venue?.googleMapsLink || undefined,
          qrCode: registration.qrCode,
          barcode: registration.barcode,
          sevenDigitCode: registration.sevenDigitCode,
          pdfUrl: registration.pdfUrl,
          paymentStatus: registration.paymentStatus,
          attended: registration.attended,
          isUsed: registration.isUsed,
          checkInTimestamp: registration.checkDate?.toISOString(),
          // Attendee Details (from Registration model directly or associated User if applicable)
          attendeeDetails: {
            attendeeName: registration.attendeeName,
            nationalId: registration.nationalId,
            phoneNumber: registration.phoneNumber,
            gender: registration.gender,
            address: registration.address,
            email: registration.user?.email || null, // If attendee is a registered user
          },
          // Buyer Details
          buyerDetails: registration.buyer
            ? {
                buyerId: registration.buyer.userId,
                username: registration.buyer.username,
                email: registration.buyer.email,
                firstName: registration.buyer.firstName,
                lastName: registration.buyer.lastName,
                phoneNumber: registration.buyer.phoneNumber,
              }
            : null,
          checkedInByStaffId: staff.staffId, // Include the staff ID who is viewing details
          ticketTypeDetails: {
            ticketTypeId: registration.ticketType?.ticketTypeId,
            name: registration.ticketType?.name,
            price: registration.ticketType?.price,
            quantityAvailable: registration.ticketType?.quantityAvailable,
            quantitySold: registration.ticketType?.quantitySold,
            currency: registration.ticketType?.currency,
            description: registration.ticketType?.description,
            saleStartsAt: registration.ticketType?.saleStartsAt,
            saleEndsAt: registration.ticketType?.saleEndsAt,
            maxPerPerson: registration.ticketType?.maxPerPerson,
            isActive: registration.ticketType?.isActive,
            isRefundable: registration.ticketType?.isRefundable,
            refundPolicy: registration.ticketType?.refundPolicy,
            transferable: registration.ticketType?.transferable,
            ageRestriction: registration.ticketType?.ageRestriction,
            specialInstructions: registration.ticketType?.specialInstructions,
            status: registration.ticketType?.status,
            startTime: registration.ticketType?.startTime,
            endTime: registration.ticketType?.endTime,
            customerBenefits: registration.ticketType?.customerBenefits,
            discount: registration.ticketType?.discount,
          },
        },
      });
    } catch (error) {
      console.error("Error viewing ticket details:", error);
      res.status(500).json({
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "An unexpected error occurred while fetching ticket details.",
        alertType: "error",
      });
    }
  }

  static async getRegistrationById(req: Request, res: Response): Promise<void> {
    try {
      const { registrationId } = req.params;

      if (!registrationId) {
        res.status(400).json({
          success: false,
          message: "Registration ID is required.",
          alertType: "error",
        });
        return;
      }

      const registrationRepo = AppDataSource.getRepository(Registration);
      const registration = await registrationRepo.findOne({
        where: { registrationId },
        relations: [
          "event",
          "user", // Attendee details (if registered user)
          "buyer", // Buyer details (if different from attendee)
          "ticketType",
          "venue",
          "checkedInByStaff",
        ],
      });

      if (!registration) {
        res.status(404).json({
          success: false,
          message: "Registration not found.",
          alertType: "error",
        });
        return;
      }

      // Map the registration to the desired comprehensive response format
      const mappedRegistration = {
        registrationId: registration.registrationId,
        eventId: registration.eventId,
        userId: registration.userId,
        buyerId: registration.buyerId,
        attendeeName: registration.attendeeName,
        nationalId: registration.nationalId,
        phoneNumber: registration.phoneNumber,
        gender: registration.gender,
        address: registration.address,
        ticketTypeId: registration.ticketTypeId,
        ticketTypeName: registration.ticketType?.name || "N/A",
        venueId: registration.venueId,
        venueName: registration.venue?.venueName || "N/A",
        noOfTickets: registration.noOfTickets,
        totalCost: registration.totalCost,
        registrationDate: registration.registrationDate,
        attendedDate: registration.attendedDate,
        paymentStatus: registration.paymentStatus,
        qrCode: registration.qrCode,
        barcode: registration.barcode,
        sevenDigitCode: registration.sevenDigitCode,
        attended: registration.attended,
        isUsed: registration.isUsed,
        pdfUrl: registration.pdfUrl,
        checkDate: registration.checkDate || "N/A",
        // Buyer Details
        buyerDetails: registration.buyer
          ? {
              buyerId: registration.buyer.userId,
              username: registration.buyer.username,
              email: registration.buyer.email,
              firstName: registration.buyer.firstName,
              lastName: registration.buyer.lastName,
              phoneNumber: registration.buyer.phoneNumber,
            }
          : null,
        // Checked-in By Staff Details
        checkedInByStaff: registration.checkedInByStaff
          ? {
              staffId: registration.checkedInByStaff.staffId,
              fullName: registration.checkedInByStaff.fullName,
              email: registration.checkedInByStaff.email,
              phoneNumber: registration.checkedInByStaff.phoneNumber,
              nationalId: registration.checkedInByStaff.nationalId,
            }
          : null,
        // Ticket Type Details
        ticketTypeDetails: {
          ticketTypeId: registration.ticketType?.ticketTypeId,
          name: registration.ticketType?.name,
          price: registration.ticketType?.price,
          quantityAvailable: registration.ticketType?.quantityAvailable,
          quantitySold: registration.ticketType?.quantitySold,
          currency: registration.ticketType?.currency,
          description: registration.ticketType?.description,
          saleStartsAt: registration.ticketType?.saleStartsAt,
          saleEndsAt: registration.ticketType?.saleEndsAt,
          maxPerPerson: registration.ticketType?.maxPerPerson,
          isActive: registration.ticketType?.isActive,
          isRefundable: registration.ticketType?.isRefundable,
          refundPolicy: registration.ticketType?.refundPolicy,
          transferable: registration.ticketType?.transferable,
          ageRestriction: registration.ticketType?.ageRestriction,
          specialInstructions: registration.ticketType?.specialInstructions,
          status: registration.ticketType?.status,
          startTime: registration.ticketType?.startTime,
          endTime: registration.ticketType?.endTime,
          customerBenefits: registration.ticketType?.customerBenefits,
          discount: registration.ticketType?.discount,
        },
        // Event Details (from event relation)
        eventDetails: {
          eventId: registration.event?.eventId,
          eventName: registration.event?.eventName,
          eventPhoto: registration.event?.eventPhoto,
          bookingDates: registration.event?.bookingDates,
          isEntryPaid: registration.event?.isEntryPaid,
          // Add other event details as needed
        },
      };

      res.status(200).json({
        success: true,
        message: "Registration details fetched successfully!",
        data: mappedRegistration,
      });
    } catch (error) {
      console.error("Error fetching registration by ID:", error);
      res.status(500).json({
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "An unexpected error occurred while fetching registration details.",
        alertType: "error",
      });
    }
  }
}
