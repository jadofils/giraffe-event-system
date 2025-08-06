import { Request, Response, NextFunction } from "express";
import { AppDataSource } from "../config/Database";
import { FreeEventRegistration } from "../models/FreeEventRegistration";
import { FreeEventRegistrationRepository } from "../repositories/FreeEventRegistrationRepository";
import { QrCodeService } from "../services/registrations/QrCodeService";
import { BarcodeService } from "../services/registrations/BarcodeService";
import { SevenDigitCodeService } from "../services/registrations/SevenDigitCodeService";
import { Event } from "../models/Event Tables/Event";

export class FreeEventAttendanceController {
  static async checkInFreeEvent(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { ticketCode, codeType } = req.body;

      if (!ticketCode || !codeType) {
        res.status(400).json({
          success: false,
          message: "Ticket code and code type are required.",
        });
        return;
      }

      let freeRegistration: FreeEventRegistration | null = null;
      const freeRegistrationRepo = AppDataSource.getRepository(
        FreeEventRegistration
      );

      // 1. Validate the code and retrieve registration
      switch (codeType) {
        case "QR_CODE":
          // For QR codes, the payload contains freeRegistrationId, genericUserIdForFreeEvent, eventId
          const qrPayloadString = Buffer.from(ticketCode, "base64").toString(
            "utf8"
          );
          const qrPayload = JSON.parse(qrPayloadString);
          freeRegistration = await freeRegistrationRepo.findOne({
            where: { freeRegistrationId: qrPayload.freeRegistrationId },
            relations: [
              "event",
              "event.eventVenues",
              "event.eventVenues.venue",
            ], // Eager load event and venue
          });
          break;

        case "BARCODE":
          // For barcodes, the payload is the sevenDigitCode, so we search by that
          freeRegistration = await freeRegistrationRepo.findOne({
            where: { barcode: ticketCode }, // Assuming ticketCode IS the barcode data
            relations: [
              "event",
              "event.eventVenues",
              "event.eventVenues.venue",
            ], // Eager load event and venue
          });
          break;

        case "SEVEN_DIGIT_CODE":
          freeRegistration = await freeRegistrationRepo.findOne({
            where: { sevenDigitCode: ticketCode },
            relations: [
              "event",
              "event.eventVenues",
              "event.eventVenues.venue",
            ], // Eager load event and venue
          });
          break;

        default:
          res.status(400).json({
            success: false,
            message:
              "Invalid code type provided. Must be QR_CODE, BARCODE, or SEVEN_DIGIT_CODE.",
          });
          return;
      }

      if (!freeRegistration) {
        res
          .status(404)
          .json({ success: false, message: "Free registration not found." });
        return;
      }

      // Ensure the event is loaded
      if (!freeRegistration.event) {
        res.status(500).json({
          success: false,
          message: "Associated event not found for this registration.",
        });
        return;
      }

      const event = freeRegistration.event;
      const today = new Date();
      // const todayDateString = today.toISOString().split("T")[0]; // YYYY-MM-DD

      const eventBookingDates = event.bookingDates.map(
        (bd) => bd.date.split("T")[0]
      );
      // const isMultiDayEvent = eventBookingDates.length > 1;

      // Check if today is a valid event date
      // if (!eventBookingDates.includes(todayDateString)) {
      //   res.status(400).json({
      //     success: false,
      //     message: `Check-in is only allowed on event dates. Today is ${todayDateString}, but the event is on ${eventBookingDates.join(", ")}.`,
      //   });
      //   return;
      // }

      // Determine if it's a multi-day event
      const isMultiDayEvent = event.bookingDates.length > 1;

      if (isMultiDayEvent) {
        // Multi-day event: track attendance times and history
        const alreadyCheckedInToday =
          freeRegistration.checkInHistory &&
          freeRegistration.checkInHistory.some(
            (entry) =>
              new Date(entry.checkInDate).toISOString().slice(0, 10) ===
              today.toISOString().slice(0, 10)
          );

        if (alreadyCheckedInToday) {
          res.status(400).json({
            success: false,
            message: "This code has already been used for check-in today.",
          });
        }

        freeRegistration.attendedTimes =
          (freeRegistration.attendedTimes || 0) + 1;
        freeRegistration.checkInHistory = freeRegistration.checkInHistory || [];
        freeRegistration.checkInHistory.push({
          checkInDate: today,
          checkInTime: today.toTimeString().slice(0, 5),
          method: `Scanned by ${codeType}`,
        });

        // If all days are attended, mark as fully used
        if (freeRegistration.attendedTimes >= event.bookingDates.length) {
          freeRegistration.isUsed = true;
        }
      } else {
        // Single-day event: check if already attended
        if (freeRegistration.attended) {
          res.status(400).json({
            success: false,
            message: "This code has already been used for this event.",
          });
        }
        freeRegistration.attended = true;
        freeRegistration.isUsed = true;
        freeRegistration.attendedTimes = 1;
        freeRegistration.checkInHistory = freeRegistration.checkInHistory || [];
        freeRegistration.checkInHistory.push({
          checkInDate: today,
          checkInTime: today.toTimeString().slice(0, 5),
          method: `Scanned by ${codeType}`,
        });
      }

      await freeRegistrationRepo.save(freeRegistration);

      res.status(200).json({
        success: true,
        message: "Free event check-in successful!",
        data: {
          fullName: freeRegistration.fullName,
          eventId: freeRegistration.eventId,
          event: event.eventName,
          checkInTime: today.toTimeString().slice(0, 5),
          checkInDate: today.toISOString().slice(0, 10),
          attendedTimes: freeRegistration.attendedTimes,
          isUsed: freeRegistration.isUsed,
          eventDates: event.bookingDates.map((d) => d.date),
          lastCheckIn: freeRegistration.checkInHistory
            ? freeRegistration.checkInHistory[
                freeRegistration.checkInHistory.length - 1
              ]
            : null,
          totalCheckIns: freeRegistration.checkInHistory
            ? freeRegistration.checkInHistory.length
            : 0,
        },
      });
    } catch (error) {
      next(error);
    }
  }
}
