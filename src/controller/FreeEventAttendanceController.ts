import { Request, Response, NextFunction } from "express";
import { AppDataSource } from "../config/Database";
import { FreeEventRegistration } from "../models/FreeEventRegistration";
import { FreeEventRegistrationRepository } from "../repositories/FreeEventRegistrationRepository";
import { QrCodeService } from "../services/registrations/QrCodeService";
import { BarcodeService } from "../services/registrations/BarcodeService";
import { SevenDigitCodeService } from "../services/registrations/SevenDigitCodeService";
import { Event } from "../models/Event Tables/Event";
import { CheckInStaffRepository } from "../repositories/CheckInStaffRepository";

export class FreeEventAttendanceController {
  static async checkInFreeEvent(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { ticketCode, codeType } = req.body;
      const sixDigitCode: string = String(req.body?.sixDigitCode || "").trim();

      if (!ticketCode || !codeType) {
        res.status(400).json({
          success: false,
          message: "Ticket code and code type are required.",
        });
        return;
      }

      if (!sixDigitCode) {
        res
          .status(400)
          .json({ success: false, message: "Six-digit code is required." });
        return;
      }

      let freeRegistration: FreeEventRegistration | null = null;
      const freeRegistrationRepo = AppDataSource.getRepository(
        FreeEventRegistration
      );

      // 1. Validate the code and retrieve registration
      switch (codeType) {
        case "QR_CODE":
          // For QR codes, the payload is Base64(JSON). Support both keys: freeRegistrationId or registrationId
          const sanitizedQr = (ticketCode || "")
            .toString()
            .trim()
            .replace(/\s+/g, "")
            .replace(/-/g, "+")
            .replace(/_/g, "/");
          const qrPayloadString = Buffer.from(sanitizedQr, "base64").toString(
            "utf8"
          );
          const qrPayload = JSON.parse(qrPayloadString);
          const freeRegId =
            qrPayload.freeRegistrationId || qrPayload.registrationId;
          freeRegistration = await freeRegistrationRepo.findOne({
            where: { freeRegistrationId: freeRegId },
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

      // Ensure staff belongs to the same event (lookup by code + event)
      const staff =
        await CheckInStaffRepository.getCheckInStaffBySixDigitCodeAndEventId(
          sixDigitCode,
          String(freeRegistration.eventId).trim()
        );
      if (!staff) {
        res.status(403).json({
          success: false,
          message: "Staff code is not valid for this event.",
        });
        return;
      }

      const event = freeRegistration.event;
      const today = new Date();

      const eventBookingDates = event.bookingDates.map(
        (bd) => bd.date.split("T")[0]
      );

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
          return;
        }

        freeRegistration.attendedTimes =
          (freeRegistration.attendedTimes || 0) + 1;
        freeRegistration.checkInHistory = freeRegistration.checkInHistory || [];
        freeRegistration.checkInHistory.push({
          checkInDate: today,
          checkInTime: today.toTimeString().slice(0, 5),
          method: `Scanned by ${codeType}`,
          checkedInByStaffId: staff.staffId,
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
          return;
        }
        freeRegistration.attended = true;
        freeRegistration.isUsed = true;
        freeRegistration.attendedTimes = 1;
        freeRegistration.checkInHistory = freeRegistration.checkInHistory || [];
        freeRegistration.checkInHistory.push({
          checkInDate: today,
          checkInTime: today.toTimeString().slice(0, 5),
          method: `Scanned by ${codeType}`,
          checkedInByStaffId: staff.staffId,
        });
      }

      // Track last staff who checked in on the registration record
      freeRegistration.checkInStaffId = staff.staffId;

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
          checkedInByStaffId: staff.staffId,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  static async viewFreeEventCheckInDetails(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { ticketCode, codeType } = req.body;
      const sixDigitCode: string = String(req.body?.sixDigitCode || "").trim();

      if (!sixDigitCode) {
        res
          .status(400)
          .json({ success: false, message: "Six-digit code is required." });
        return;
      }
      if (!ticketCode || !codeType) {
        res.status(400).json({
          success: false,
          message: "Ticket code and code type are required.",
        });
        return;
      }

      const freeRegistrationRepo = AppDataSource.getRepository(
        FreeEventRegistration
      );
      let freeRegistration: FreeEventRegistration | null = null;

      switch (codeType) {
        case "QR_CODE": {
          const sanitizedQr = (ticketCode || "")
            .toString()
            .trim()
            .replace(/\s+/g, "")
            .replace(/-/g, "+")
            .replace(/_/g, "/");
          const qrPayloadString = Buffer.from(sanitizedQr, "base64").toString(
            "utf8"
          );
          const qrPayload = JSON.parse(qrPayloadString);
          const freeRegId =
            qrPayload.freeRegistrationId || qrPayload.registrationId;
          freeRegistration = await freeRegistrationRepo.findOne({
            where: { freeRegistrationId: freeRegId },
            relations: [
              "event",
              "event.eventVenues",
              "event.eventVenues.venue",
              "registeredBy",
            ],
          });
          break;
        }
        case "BARCODE": {
          freeRegistration = await freeRegistrationRepo.findOne({
            where: { barcode: ticketCode },
            relations: [
              "event",
              "event.eventVenues",
              "event.eventVenues.venue",
              "registeredBy",
            ],
          });
          break;
        }
        case "SEVEN_DIGIT_CODE": {
          freeRegistration = await freeRegistrationRepo.findOne({
            where: { sevenDigitCode: ticketCode },
            relations: [
              "event",
              "event.eventVenues",
              "event.eventVenues.venue",
              "registeredBy",
            ],
          });
          break;
        }
        case "REGISTRATION_ID": {
          freeRegistration = await freeRegistrationRepo.findOne({
            where: { freeRegistrationId: ticketCode },
            relations: [
              "event",
              "event.eventVenues",
              "event.eventVenues.venue",
              "registeredBy",
            ],
          });
          break;
        }
        default:
          res.status(400).json({
            success: false,
            message:
              "Invalid code type provided. Must be QR_CODE, BARCODE, SEVEN_DIGIT_CODE, or REGISTRATION_ID.",
          });
          return;
      }

      if (!freeRegistration) {
        res
          .status(404)
          .json({ success: false, message: "Free registration not found." });
        return;
      }

      // Ensure staff belongs to the same event (strict)
      const staff =
        await CheckInStaffRepository.getCheckInStaffBySixDigitCodeAndEventId(
          sixDigitCode,
          String(freeRegistration.eventId).trim()
        );
      if (!staff) {
        res.status(403).json({
          success: false,
          message: "Staff code is not valid for this event.",
        });
        return;
      }

      const event = freeRegistration.event;
      const maxPossibleCheckIns =
        Array.isArray(event.bookingDates) && event.bookingDates.length > 0
          ? event.bookingDates.length
          : 1;

      res.status(200).json({
        success: true,
        message: "Check-in details fetched successfully.",
        data: {
          freeRegistrationId: freeRegistration.freeRegistrationId,
          fullName: freeRegistration.fullName,
          email: freeRegistration.email,
          phoneNumber: freeRegistration.phoneNumber,
          nationalId: freeRegistration.nationalId,
          gender: freeRegistration.gender,
          address: freeRegistration.address,
          attended: freeRegistration.attended,
          attendedTimes: freeRegistration.attendedTimes,
          isUsed: freeRegistration.isUsed,
          checkInHistory: freeRegistration.checkInHistory || [],
          attendanceRatio: `${freeRegistration.attendedTimes}/${maxPossibleCheckIns}`,
          event: {
            eventId: event.eventId,
            eventName: event.eventName,
            bookingDates: event.bookingDates,
            startTime: event.startTime,
            endTime: event.endTime,
            venue: event.eventVenues?.[0]?.venue?.venueName,
            venueGoogleMapsLink: event.eventVenues?.[0]?.venue?.googleMapsLink,
          },
          registeredByDetails: freeRegistration.registeredBy
            ? {
                userId: freeRegistration.registeredBy.userId,
                username: freeRegistration.registeredBy.username,
                email: freeRegistration.registeredBy.email,
                firstName: freeRegistration.registeredBy.firstName,
                lastName: freeRegistration.registeredBy.lastName,
                phoneNumber: freeRegistration.registeredBy.phoneNumber,
              }
            : null,
        },
      });
    } catch (error) {
      next(error);
    }
  }
}
