import { Request, Response, NextFunction } from "express";
import { AppDataSource } from "../config/Database";
import { Event } from "../models/Event Tables/Event";
import { FreeEventRegistration } from "../models/FreeEventRegistration";
import { FreeEventRegistrationRepository } from "../repositories/FreeEventRegistrationRepository";
import { EventStatus } from "../interfaces/Enums/EventStatusEnum";
import { QrCodeService } from "../services/registrations/QrCodeService";
import { BarcodeService } from "../services/registrations/BarcodeService";
import { SevenDigitCodeService } from "../services/registrations/SevenDigitCodeService";
import { EmailService } from "../services/emails/EmailService";
import { v4 as uuidv4 } from "uuid";
import { TicketPdfService } from "../services/tickets/TicketPdfService"; // Import TicketPdfService
import { CloudinaryUploadService } from "../services/CloudinaryUploadService"; // Import CloudinaryUploadService
import { CheckInStaffRepository } from "../repositories/CheckInStaffRepository";

export class FreeEventRegistrationController {
  static async registerForFreeEvent(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { eventId } = req.params;
      const authenticatedReq = req as any;
      const registeredByUserId = authenticatedReq.user?.userId; // Capture the logged-in user's ID
      const { registrations, sendAllInvitationsToEmail } = req.body; // Destructure registrations and sendAllInvitationsToEmail

      if (!Array.isArray(registrations) || registrations.length === 0) {
        res.status(400).json({
          success: false,
          message:
            "Request body must contain a non-empty 'registrations' array.", // Updated message
        });
        return;
      }

      // 1. Check if event exists and is a free, approved, and enabled event (once for all registrations)
      const eventRepo = AppDataSource.getRepository(Event);
      const event = await eventRepo.findOne({
        where: { eventId },
        relations: ["eventVenues", "eventVenues.venue"], // Load venues for email template
      });

      if (!event) {
        res.status(404).json({ success: false, message: "Event not found." });
        return;
      }

      // Must be a free event
      if (event.isEntryPaid) {
        res.status(400).json({
          success: false,
          message:
            "This is a paid event. Please use the ticket purchase route.",
        });
        return;
      }

      // Must be approved
      if (event.eventStatus !== EventStatus.APPROVED) {
        res.status(400).json({
          success: false,
          message: "Registrations are not open for this event yet.",
        });
        return;
      }

      // Must be enabled
      if (event.enableStatus !== "ENABLE") {
        res.status(400).json({
          success: false,
          message: "Event is not enabled for registrations.",
        });
        return;
      }

      const results: {
        success: boolean;
        message: string;
        data?: any;
        email?: string;
      }[] = [];

      const invitationDataForConsolidatedEmail: {
        eventName: string;
        eventDate: Date;
        venueName: string;
        attendeeName: string;
        qrCodeUrl: string;
        barcodeUrl: string;
        sevenDigitCode: string;
        venueGoogleMapsLink?: string;
        startTime?: string;
        endTime?: string;
        email: string;
        pdfUrl?: string; // Add pdfUrl to the interface
        to: string; // Add 'to' field
        subject: string; // Add 'subject' field
      }[] = [];

      for (const registrationData of registrations) {
        const { fullName, email, phoneNumber, nationalId, gender, address } =
          registrationData;

        if (!email) {
          // Only email is strictly required for individual registration
          results.push({
            success: false,
            message: "Email is required for each registration.",
            data: registrationData,
          });
          continue; // Skip to next registration
        }

        const attendeeFullName = fullName || "Guest Attendee"; // Default fullName if not provided

        // 2. Check for duplicate registrations (per individual registration)
        const existingRegistrationByEmail =
          await FreeEventRegistrationRepository.getFreeRegistrationsByEmailAndEventId(
            email,
            eventId
          );
        if (existingRegistrationByEmail) {
          results.push({
            success: false,
            message: `Email ${email} has already registered for this event.`, // More specific message
            email: email,
          });
          continue; // Skip to next registration
        }

        if (nationalId) {
          const existingRegistrationByNationalId =
            await FreeEventRegistrationRepository.getFreeRegistrationsByNationalIdAndEventId(
              nationalId,
              eventId
            );
          if (existingRegistrationByNationalId) {
            results.push({
              success: false,
              message: `National ID ${nationalId} has already registered for this event.`, // More specific message
              email: email, // Include email for context
            });
            continue; // Skip to next registration
          }
        }

        // Generate a unique ID for this free registration
        const freeRegistrationId = uuidv4();
        const genericUserIdForFreeEvent = uuidv4(); // Unique for each registration

        // 3. Generate unique codes using the correct service methods
        try {
          const qrCode = await QrCodeService.generateQrCode(
            freeRegistrationId,
            genericUserIdForFreeEvent,
            eventId
          );
          const sevenDigitCode =
            await SevenDigitCodeService.generateUniqueSevenDigitCode();
          const barcode = await BarcodeService.generateBarcode(
            sevenDigitCode,
            freeRegistrationId
          );

          // PDF Generation for each free registration
          const eventForPdf = event; // Use the fetched event object
          const venueForPdf = event.eventVenues[0]?.venue; // Use the first venue for PDF details

          const pdfBuffer = await TicketPdfService.generateTicketPdf({
            registrationId: freeRegistrationId,
            attendeeName: attendeeFullName,
            ticketTypeName: "Free Pass", // Or a dynamic name if applicable
            eventName: eventForPdf?.eventName || "",
            eventDate: eventForPdf?.bookingDates?.[0]?.date || "",
            venueName: venueForPdf?.venueName || "",
            qrCodeUrl: qrCode,
            barcodeUrl: barcode,
            sevenDigitCode: sevenDigitCode,
            venueGoogleMapsLink: venueForPdf?.googleMapsLink,
          });

          const uploadResult = await CloudinaryUploadService.uploadBuffer(
            pdfBuffer,
            "free_tickets/pdfs", // Specific folder for free tickets
            `free-ticket-${freeRegistrationId}.pdf`,
            "raw"
          );
          const pdfUrl = uploadResult.url;

          // 4. Save registration to database
          const newFreeRegistration =
            await FreeEventRegistrationRepository.createFreeEventRegistration({
              freeRegistrationId,
              eventId,
              fullName: attendeeFullName, // Use attendeeFullName here
              email,
              phoneNumber,
              nationalId,
              gender,
              address,
              qrCode,
              barcode,
              sevenDigitCode,
              registeredByUserId, // Add registeredByUserId
              pdfUrl, // Save the PDF URL to the registration
            });

          // 5. Prepare invitation email data
          const venueName = event.eventVenues[0]?.venue?.venueName || "N/A";
          const venueGoogleMapsLink =
            event.eventVenues[0]?.venue?.googleMapsLink || undefined;
          const eventDate =
            event.bookingDates && event.bookingDates.length > 0
              ? new Date(event.bookingDates[0].date)
              : new Date();

          const invitationDetails = {
            to: email, // Added 'to' field
            subject: `Your Invitation to ${event.eventName}`, // Added 'subject' field
            eventName: event.eventName,
            eventDate: eventDate,
            venueName: venueName,
            attendeeName: attendeeFullName,
            qrCodeUrl: qrCode,
            barcodeUrl: barcode,
            sevenDigitCode: sevenDigitCode,
            venueGoogleMapsLink: venueGoogleMapsLink,
            startTime: event.startTime, // Pass start time
            endTime: event.endTime, // Pass end time
            email: email, // Add email to invitation details
            pdfUrl: pdfUrl, // Add PDF URL to invitation details
          };

          if (sendAllInvitationsToEmail) {
            // If consolidating, add to a list and don't send individual email yet
            invitationDataForConsolidatedEmail.push(invitationDetails);
          } else {
            // Send individual email
            const emailSent = await EmailService.sendFreeEventInvitationEmail(
              invitationDetails
            );

            if (!emailSent) {
              console.warn(
                `Failed to send invitation email to ${email} for event ${event.eventName}.`
              );
            }
          }

          results.push({
            success: true,
            message: `Successfully registered ${attendeeFullName}. An invitation email has been sent.`, // Specific message
            data: newFreeRegistration,
          });
        } catch (codeGenError: any) {
          console.error(
            `Error generating codes or saving for ${email}:`,
            codeGenError
          );
          results.push({
            success: false,
            message: `Failed to register ${attendeeFullName} due to internal error: ${codeGenError.message}`,
            email: email,
          });
        }
      }

      // Send consolidated email if requested and there are successful registrations
      if (
        sendAllInvitationsToEmail &&
        invitationDataForConsolidatedEmail.length > 0
      ) {
        const consolidatedEmailSubject = `Your Invitations for ${event.eventName} (${invitationDataForConsolidatedEmail.length} Attendees)`;
        const consolidatedEmailBody =
          EmailService.generateConsolidatedInvitationEmailContent(
            invitationDataForConsolidatedEmail
          ); // Use the new method
        const consolidatedEmailSent = await EmailService.sendEmail({
          to: sendAllInvitationsToEmail,
          subject: consolidatedEmailSubject,
          html: consolidatedEmailBody,
        });

        if (!consolidatedEmailSent) {
          console.error(
            `Failed to send consolidated invitation email to ${sendAllInvitationsToEmail}.`
          );
          // Optionally update results to reflect consolidated email failure
        }
      }

      const allSuccessful = results.every((r) => r.success);
      const finalStatus = allSuccessful ? 201 : 207; // 207 Multi-Status if some failed

      res.status(finalStatus).json({
        success: allSuccessful,
        message: allSuccessful
          ? "All registrations processed successfully." +
            (sendAllInvitationsToEmail
              ? " Consolidated invitation email sent."
              : "")
          : "Some registrations failed or had issues.",
        results: results,
      });
    } catch (error) {
      next(error);
    }
  }

  static async getFreeRegistrationsByEventId(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { eventId } = req.params;

      if (!eventId) {
        res
          .status(400)
          .json({ success: false, message: "Event ID is required." });
        return;
      }

      const registrations =
        await FreeEventRegistrationRepository.getFreeRegistrationsByEventId(
          eventId
        );

      if (!registrations || registrations.length === 0) {
        res.status(404).json({
          success: false,
          message: "No free registrations found for this event.",
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: registrations.map((r) => ({
          freeRegistrationId: r.freeRegistrationId,
          eventId: r.eventId,
          fullName: r.fullName,
          email: r.email,
          phoneNumber: r.phoneNumber,
          nationalId: r.nationalId,
          gender: r.gender,
          address: r.address,
          qrCode: r.qrCode,
          barcode: r.barcode,
          sevenDigitCode: r.sevenDigitCode,
          pdfUrl: r.pdfUrl,
          attended: r.attended,
          attendedTimes: r.attendedTimes,
          checkInHistory: r.checkInHistory,
          isUsed: r.isUsed,
          registrationDate: r.registrationDate,
          registeredByDetails: r.registeredBy
            ? {
                userId: r.registeredBy.userId,
                username: r.registeredBy.username,
                email: r.registeredBy.email,
                firstName: r.registeredBy.firstName,
                lastName: r.registeredBy.lastName,
                phoneNumber: r.registeredBy.phoneNumber,
              }
            : null,
          checkedInByStaff: r.checkedInBy
            ? {
                staffId: r.checkedInBy.staffId,
                fullName: r.checkedInBy.fullName,
                phoneNumber: r.checkedInBy.phoneNumber,
                nationalId: r.checkedInBy.nationalId,
              }
            : null,
        })),
      });
    } catch (error) {
      next(error);
    }
  }

  static async getFreeEventAttendance(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { eventId } = req.params;

      if (!eventId) {
        res
          .status(400)
          .json({ success: false, message: "Event ID is required." });
        return;
      }

      const eventRepo = AppDataSource.getRepository(Event);
      const event = await eventRepo.findOne({
        where: { eventId },
      });

      if (!event) {
        res.status(404).json({ success: false, message: "Event not found." });
        return;
      }

      const maxPossibleCheckIns =
        event.bookingDates.length > 0 ? event.bookingDates.length : 1;

      // Load registrations with relations so registeredBy and checkedInBy are available
      const registrations =
        await FreeEventRegistrationRepository.getFreeRegistrationsByEventId(
          eventId
        );

      const attendees = registrations
        .filter((registration) => (registration.attendedTimes || 0) >= 1)
        .map((registration) => ({
          freeRegistrationId: registration.freeRegistrationId,
          fullName: registration.fullName,
          email: registration.email,
          phoneNumber: registration.phoneNumber,
          nationalId: registration.nationalId,
          gender: registration.gender,
          address: registration.address,
          qrCode: registration.qrCode,
          barcode: registration.barcode,
          sevenDigitCode: registration.sevenDigitCode,
          registrationDate: registration.registrationDate,
          attended: registration.attended,
          attendedTimes: registration.attendedTimes,
          checkInHistory: registration.checkInHistory,
          isUsed: registration.isUsed,
          attendanceRatio: `${registration.attendedTimes}/${maxPossibleCheckIns}`,
          isFullyAttended:
            (registration.attendedTimes || 0) >= maxPossibleCheckIns,
          registeredByDetails: registration.registeredBy
            ? {
                userId: (registration.registeredBy as any).userId,
                username: (registration.registeredBy as any).username,
                email: (registration.registeredBy as any).email,
                firstName: (registration.registeredBy as any).firstName,
                lastName: (registration.registeredBy as any).lastName,
                phoneNumber: (registration.registeredBy as any).phoneNumber,
              }
            : null,
          checkedInByStaff: registration.checkedInBy
            ? {
                staffId: (registration.checkedInBy as any).staffId,
                fullName: (registration.checkedInBy as any).fullName,
                phoneNumber: (registration.checkedInBy as any).phoneNumber,
                nationalId: (registration.checkedInBy as any).nationalId,
              }
            : null,
        }));

      if (attendees.length === 0) {
        res.status(404).json({
          success: false,
          message: "No attendees found for this event.",
        });
        return;
      }

      res.status(200).json({ success: true, data: attendees });
    } catch (error) {
      next(error);
    }
  }

  static async getOneFreeRegistrationById(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { registrationId } = req.params;

      if (!registrationId) {
        res
          .status(400)
          .json({ success: false, message: "Registration ID is required." });
        return;
      }

      const registration =
        await FreeEventRegistrationRepository.getFreeRegistrationById(
          registrationId
        );

      if (!registration) {
        res.status(404).json({
          success: false,
          message: "Free registration not found.",
        });
        return;
      }

      // Calculate attended ratio
      const event = registration.event;
      let maxPossibleCheckIns = 1; // Default to 1 if no booking dates
      if (event && event.bookingDates && event.bookingDates.length > 0) {
        maxPossibleCheckIns = event.bookingDates.length;
      }

      const attendedTimes = registration.attendedTimes || 0;
      const attendanceRatio = `${attendedTimes}/${maxPossibleCheckIns}`;
      const isFullyAttended = attendedTimes >= maxPossibleCheckIns;

      res.status(200).json({
        success: true,
        data: {
          freeRegistrationId: registration.freeRegistrationId,
          eventId: registration.eventId,
          fullName: registration.fullName,
          email: registration.email,
          phoneNumber: registration.phoneNumber,
          nationalId: registration.nationalId,
          gender: registration.gender,
          address: registration.address,
          qrCode: registration.qrCode,
          barcode: registration.barcode,
          sevenDigitCode: registration.sevenDigitCode,
          pdfUrl: registration.pdfUrl,
          attended: registration.attended,
          attendedTimes: registration.attendedTimes,
          checkInHistory: registration.checkInHistory,
          isUsed: registration.isUsed,
          registrationDate: registration.registrationDate,
          attendanceRatio: attendanceRatio,
          isFullyAttended: isFullyAttended,
          registeredByDetails: registration.registeredBy
            ? {
                userId: registration.registeredBy.userId,
                username: registration.registeredBy.username,
                email: registration.registeredBy.email,
                firstName: registration.registeredBy.firstName,
                lastName: registration.registeredBy.lastName,
                phoneNumber: registration.registeredBy.phoneNumber,
              }
            : null,
          checkedInByStaff: registration.checkedInBy
            ? {
                staffId: registration.checkedInBy.staffId,
                fullName: registration.checkedInBy.fullName,
                phoneNumber: registration.checkedInBy.phoneNumber,
                nationalId: registration.checkedInBy.nationalId,
              }
            : null,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  static async updateFreeEventRegistration(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { freeRegistrationId } = req.params as {
        freeRegistrationId: string;
      };
      const { sixDigitCode, ...rawUpdates } = (req.body || {}) as any;

      if (!sixDigitCode) {
        res.status(400).json({
          success: false,
          message: "Six-digit staff code is required.",
        });
        return;
      }

      const staff = await CheckInStaffRepository.getCheckInStaffBySixDigitCode(
        String(sixDigitCode)
      );
      if (!staff) {
        res
          .status(401)
          .json({ success: false, message: "Invalid six-digit staff code." });
        return;
      }

      const existing =
        await FreeEventRegistrationRepository.getFreeRegistrationById(
          freeRegistrationId
        );
      if (!existing) {
        res.status(404).json({
          success: false,
          message: "Free event registration not found.",
        });
        return;
      }

      if (staff.eventId !== existing.eventId) {
        res.status(403).json({
          success: false,
          message: "Staff code is not valid for this event.",
        });
        return;
      }

      const updates = {
        ...(rawUpdates || {}),
      } as Partial<FreeEventRegistration>;

      // Disallow updating system-managed fields
      delete (updates as any).freeRegistrationId;
      delete (updates as any).eventId;
      delete (updates as any).qrCode;
      delete (updates as any).barcode;
      delete (updates as any).sevenDigitCode;
      delete (updates as any).pdfUrl;
      delete (updates as any).attended;
      delete (updates as any).attendedTimes;
      delete (updates as any).checkInHistory;
      delete (updates as any).isUsed;
      delete (updates as any).registeredByUserId;
      delete (updates as any).checkInStaffId;

      // Normalize address if provided (allow object or array[0])
      if ((updates as any) && (updates as any).address) {
        const addr = (updates as any).address;
        if (Array.isArray(addr)) {
          (updates as any).address = addr;
        } else if (typeof addr === "object") {
          (updates as any).address = [addr];
        }
      }

      const updated =
        await FreeEventRegistrationRepository.updateFreeEventRegistration(
          freeRegistrationId,
          updates
        );

      if (!updated) {
        res.status(404).json({
          success: false,
          message: "Free event registration not found.",
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: "Free event registration updated successfully.",
        data: updated,
      });
    } catch (error) {
      next(error);
    }
  }
}
