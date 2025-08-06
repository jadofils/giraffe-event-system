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

export class FreeEventRegistrationController {
  static async registerForFreeEvent(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { eventId } = req.params;
      let registrationsData = req.body; // Expect an array of registration objects

      if (!Array.isArray(registrationsData) || registrationsData.length === 0) {
        res.status(400).json({
          success: false,
          message:
            "Request body must be a non-empty array of registration objects.",
        });
        return;
      }

      // 1. Check if event exists and is a free event (once for all registrations)
      const eventRepo = AppDataSource.getRepository(Event);
      const event = await eventRepo.findOne({
        where: { eventId },
        relations: ["eventVenues", "eventVenues.venue"], // Load venues for email template
      });

      if (!event) {
        res.status(404).json({ success: false, message: "Event not found." });
        return;
      }

      if (event.isEntryPaid) {
        res.status(400).json({
          success: false,
          message:
            "This is a paid event. Please use the ticket purchase route.",
        });
        return;
      }

      if (event.eventStatus !== EventStatus.APPROVED) {
        res.status(400).json({
          success: false,
          message: "Registrations are not open for this event yet.",
        });
        return;
      }

      const results: {
        success: boolean;
        message: string;
        data?: any;
        email?: string;
      }[] = [];

      for (const registrationData of registrationsData) {
        const { fullName, email, phoneNumber, nationalId, gender, address } =
          registrationData;

        if (!fullName || !email) {
          results.push({
            success: false,
            message: "Full name and email are required for each registration.",
            data: registrationData,
          });
          continue; // Skip to next registration
        }

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

          // 4. Save registration to database
          const newFreeRegistration =
            await FreeEventRegistrationRepository.createFreeEventRegistration({
              freeRegistrationId,
              eventId,
              fullName,
              email,
              phoneNumber,
              nationalId,
              gender,
              address,
              qrCode,
              barcode,
              sevenDigitCode,
            });

          // 5. Send invitation email
          const venueName = event.eventVenues[0]?.venue?.venueName || "N/A";
          const venueGoogleMapsLink =
            event.eventVenues[0]?.venue?.googleMapsLink || undefined;
          const eventDate =
            event.bookingDates && event.bookingDates.length > 0
              ? new Date(event.bookingDates[0].date)
              : new Date();

          const emailSent = await EmailService.sendFreeEventInvitationEmail({
            to: email,
            subject: `Your Invitation to ${event.eventName}`,
            eventName: event.eventName,
            eventDate: eventDate,
            venueName: venueName,
            attendeeName: fullName,
            qrCodeUrl: qrCode,
            barcodeUrl: barcode,
            sevenDigitCode: sevenDigitCode,
            venueGoogleMapsLink: venueGoogleMapsLink,
            startTime: event.startTime, // Pass start time
            endTime: event.endTime, // Pass end time
          });

          if (!emailSent) {
            console.warn(
              `Failed to send invitation email to ${email} for event ${event.eventName}.`
            );
          }

          results.push({
            success: true,
            message: `Successfully registered ${fullName}. An invitation email has been sent.`, // Specific message
            data: newFreeRegistration,
          });
        } catch (codeGenError: any) {
          console.error(
            `Error generating codes or saving for ${email}:`,
            codeGenError
          );
          results.push({
            success: false,
            message: `Failed to register ${fullName} due to internal error: ${codeGenError.message}`, // More detailed error
            email: email,
          });
        }
      }

      const allSuccessful = results.every((r) => r.success);
      const finalStatus = allSuccessful ? 201 : 207; // 207 Multi-Status if some failed

      res.status(finalStatus).json({
        success: allSuccessful,
        message: allSuccessful
          ? "All registrations processed successfully."
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

      res.status(200).json({ success: true, data: registrations });
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
        relations: ["freeRegistrations"], // Load free registrations
      });

      if (!event) {
        res.status(404).json({ success: false, message: "Event not found." });
        return;
      }

      const maxPossibleCheckIns =
        event.bookingDates.length > 0 ? event.bookingDates.length : 1; // Default to 1 for single-day events or if no dates are explicitly listed

      const attendees = event.freeRegistrations
        .filter((registration) => registration.attendedTimes >= 1) // Filter for attended users
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
          isFullyAttended: registration.attendedTimes >= maxPossibleCheckIns,
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
}
