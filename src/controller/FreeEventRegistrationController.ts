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
      const { fullName, email, phoneNumber, nationalId, gender, address } =
        req.body;

      if (!fullName || !email || !eventId) {
        res.status(400).json({
          success: false,
          message: "Full name, email, and event ID are required.",
        });
        return;
      }

      // 1. Check if event exists and is a free event
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

      // 2. Check for duplicate registrations
      const existingRegistrationByEmail =
        await FreeEventRegistrationRepository.getFreeRegistrationsByEmailAndEventId(
          email,
          eventId
        );
      if (existingRegistrationByEmail) {
        res.status(409).json({
          success: false,
          message:
            "You have already registered for this event with this email.",
        });
        return;
      }

      if (nationalId) {
        const existingRegistrationByNationalId =
          await FreeEventRegistrationRepository.getFreeRegistrationsByNationalIdAndEventId(
            nationalId,
            eventId
          );
        if (existingRegistrationByNationalId) {
          res.status(409).json({
            success: false,
            message:
              "You have already registered for this event with this National ID.",
          });
          return;
        }
      }

      // Generate a unique ID for this free registration
      const freeRegistrationId = uuidv4();
      // For free events, we don't have a specific user ID tied to the registration in the same way as paid tickets.
      // We can use the eventId as a placeholder or generate a new UUID if strictly needed by the service,
      // but for now, let's use a generic UUID or eventId to fulfill the parameter requirement.
      const genericUserIdForFreeEvent = uuidv4();

      // 3. Generate unique codes using the correct service methods
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
        // Optionally, you might want to return a 200 OK anyway, as the registration itself was successful
        // or retry sending the email.
      }

      res.status(201).json({
        success: true,
        message:
          "Successfully registered for the free event. An invitation email has been sent.",
        data: newFreeRegistration,
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
}
