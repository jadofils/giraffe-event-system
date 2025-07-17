import { Request, Response } from "express";
import { VenueBookingRepository } from "../repositories/VenueBookingRepository";

export class VenueBookingController {
  static async getAllBookings(req: Request, res: Response): Promise<void> {
    try {
      const result = await VenueBookingRepository.getAllBookings();
      res.status(200).json({
        success: result.success,
        message: result.message,
        data: result.data,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: `Failed to fetch bookings: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      });
    }
  }

  static async getBookingsByManagerId(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const { managerId } = req.params;
      const result = await VenueBookingRepository.getBookingsByManagerId(
        managerId
      );
      res.status(200).json(result);
    } catch (error) {
      res.status(500).json({ success: false, message: "Server error." });
    }
  }
}
