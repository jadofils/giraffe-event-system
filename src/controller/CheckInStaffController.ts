import { Request, Response, NextFunction } from "express";
import { AppDataSource } from "../config/Database";
import { Event } from "../models/Event Tables/Event";
import { CheckInStaff } from "../models/CheckInStaff";
import { CheckInStaffRepository } from "../repositories/CheckInStaffRepository";
import { SixDigitCodeService } from "../services/registrations/SixDigitCodeService";
import { EmailService } from "../services/emails/EmailService";

export class CheckInStaffController {
  static async createCheckInStaff(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { eventId } = req.params;
      const body = req.body;

      // Normalize input to an array of staff entries
      const staffList: Array<{
        fullName: string;
        email: string;
        phoneNumber?: string;
        nationalId?: string;
        address?: any;
      }> = Array.isArray(body)
        ? body
        : Array.isArray(body?.staff)
        ? body.staff
        : [body];

      if (!staffList || staffList.length === 0) {
        res.status(400).json({
          success: false,
          message:
            "Request body must be a non-empty array of staff or an object containing a 'staff' array.",
        });
        return;
      }

      const eventRepo = AppDataSource.getRepository(Event);
      const event = await eventRepo.findOne({ where: { eventId } });

      if (!event) {
        res.status(404).json({ success: false, message: "Event not found." });
        return;
      }

      const results: Array<{
        success: boolean;
        message: string;
        data?: any;
        input?: any;
      }> = [];

      for (const entry of staffList) {
        const { fullName, email, phoneNumber, nationalId, address } =
          entry || {};
        if (!fullName || !email) {
          results.push({
            success: false,
            message: "Full name and email are required for each staff member.",
            input: entry,
          });
          continue;
        }

        try {
          const sixDigitCode =
            await SixDigitCodeService.generateUniqueSixDigitCode();

          const newStaff = await CheckInStaffRepository.createCheckInStaff({
            eventId,
            fullName,
            email,
            phoneNumber,
            nationalId,
            address,
            sixDigitCode,
          });

          await EmailService.sendCheckInStaffInvitationEmail({
            to: email,
            fullName,
            sixDigitCode,
          });

          results.push({
            success: true,
            message: `Staff '${fullName}' created and code emailed successfully.`,
            data: newStaff,
          });
        } catch (err: any) {
          results.push({
            success: false,
            message: err?.message || "Failed to create staff.",
            input: entry,
          });
        }
      }

      const allSuccessful = results.every((r) => r.success);
      const statusCode = allSuccessful ? 201 : 207; // 207 Multi-Status when partial failures

      res.status(statusCode).json({
        success: allSuccessful,
        message: allSuccessful
          ? "All staff created successfully and codes emailed."
          : "Some staff could not be created. See details.",
        details: results,
      });
    } catch (error) {
      next(error);
    }
  }

  static async validateSixDigitCode(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { sixDigitCode } = req.body;

      if (!sixDigitCode) {
        res
          .status(400)
          .json({ success: false, message: "Six-digit code is required." });
        return;
      }

      const checkInStaff =
        await CheckInStaffRepository.getCheckInStaffBySixDigitCode(
          sixDigitCode
        );

      if (!checkInStaff) {
        res
          .status(401)
          .json({ success: false, message: "Invalid six-digit code." });
        return;
      }

      res.status(200).json({
        success: true,
        message: "Six-digit code validated successfully.",
        data: {
          staffId: checkInStaff.staffId,
          fullName: checkInStaff.fullName,
          eventId: checkInStaff.eventId,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  static async listCheckInStaffByEvent(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { eventId } = req.params;
      const staff = await CheckInStaffRepository.getCheckInStaffByEventId(
        eventId
      );
      res.status(200).json({ success: true, data: staff });
    } catch (error) {
      next(error);
    }
  }

  static async updateCheckInStaff(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { staffId } = req.params;
      const updates = req.body;

      // Prevent updating protected fields
      delete updates.sixDigitCode;
      delete updates.staffId;
      delete updates.eventId;

      const updated = await CheckInStaffRepository.updateCheckInStaff(
        staffId,
        updates
      );
      if (!updated) {
        res
          .status(404)
          .json({ success: false, message: "Check-in staff not found." });
        return;
      }
      res.status(200).json({
        success: true,
        message: "Staff updated successfully.",
        data: updated,
      });
    } catch (error) {
      next(error);
    }
  }

  static async deleteCheckInStaff(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { staffId } = req.params;
      const result = await CheckInStaffRepository.deleteCheckInStaff(staffId);
      if (!result.affected) {
        res
          .status(404)
          .json({ success: false, message: "Check-in staff not found." });
        return;
      }
      res
        .status(200)
        .json({ success: true, message: "Staff deleted successfully." });
    } catch (error) {
      next(error);
    }
  }
}
