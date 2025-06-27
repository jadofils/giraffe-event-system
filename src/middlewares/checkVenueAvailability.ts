import { Request, Response, NextFunction } from "express";
import { AppDataSource } from "../config/Database";
import { ApprovalStatus, VenueBooking } from "../models/VenueBooking";

export async function checkVenueAvailability(req: Request, res: Response, next: NextFunction): Promise<void> {
  const venues: string[] = req.body.venues || (req.body.venueId ? [req.body.venueId] : []);
  const { startDate, endDate } = req.body;

  if (!venues.length || !startDate || !endDate) {
    res.status(400).json({
      success: false,
      message: "venues, startDate, and endDate are required"
    });
    return;
  }

  // Query for conflicts using SQL join logic
  const bookingRepo = AppDataSource.getRepository(VenueBooking);

  for (const venueId of venues) {
    const conflicts = await bookingRepo
      .createQueryBuilder("booking")
      .leftJoin("booking.event", "event")
      .where("booking.venueId = :venueId", { venueId })
      .andWhere("booking.approvalStatus = :bookingStatus", { bookingStatus: ApprovalStatus.APPROVED })
      .andWhere("event.status = :eventStatus", { eventStatus: "APPROVED" })
      .andWhere(
        // Overlap logic: (existing.start <= requested.end) AND (existing.end >= requested.start)
        "(event.startDate <= :endDate AND event.endDate >= :startDate)",
        { startDate, endDate }
      )
      .getCount();

    if (conflicts > 0) {
      res.status(409).json({
        success: false,
        message: `Venue ${venueId} is already booked for an approved event on the same date(s).`,
        venueId
      });
      return;
    }
  }

  next();
}