import { AppDataSource } from "../config/Database";
import { VenueBooking, ApprovalStatus } from "../models/VenueBooking";
import { Event } from "../models/Event";

function parseDateTime(dateStr: string, timeStr: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return null;
  let [hour, minute] = [0, 0];
  let t = timeStr.trim();
  let ampm = null;
  if (/am|pm/i.test(t)) {
    ampm = t.slice(-2).toLowerCase();
    t = t.slice(0, -2).trim();
  }
  const parts = t.split(":");
  if (parts.length !== 2) return null;
  hour = parseInt(parts[0], 10);
  minute = parseInt(parts[1], 10);
  if (isNaN(hour) || isNaN(minute)) return null;
  if (ampm) {
    if (ampm === "pm" && hour !== 12) hour += 12;
    if (ampm === "am" && hour === 12) hour = 0;
  }
  const date = new Date(`${dateStr}T00:00:00Z`);
  if (isNaN(date.getTime())) return null;
  return date.getTime() + hour * 60 * 60 * 1000 + minute * 60 * 1000;
}

export async function rejectConflictingPendingEvents(approvedEvent: Event) {
  const bookingRepo = AppDataSource.getRepository(VenueBooking);
  if (!approvedEvent.venues || !Array.isArray(approvedEvent.venues)) return;

  const approvedStart = parseDateTime(approvedEvent.startDate?.slice(0,10), approvedEvent.startTime);
  const approvedEnd = parseDateTime(approvedEvent.endDate?.slice(0,10), approvedEvent.endTime);
  if (approvedStart === null || approvedEnd === null) return;
  const THIRTY_MIN = 30 * 60 * 1000;

  for (const venue of approvedEvent.venues) {
    // Use QueryBuilder to find all pending bookings for this venue that conflict
    const pendingBookings = await bookingRepo
      .createQueryBuilder("booking")
      .leftJoinAndSelect("booking.event", "event")
      .where("booking.venueId = :venueId", { venueId: venue.venueId })
      .andWhere("booking.approvalStatus = :pending", { pending: ApprovalStatus.PENDING })
      .andWhere(
        // Overlap logic with buffer
        "( ( (event.startDate || ' ' || event.startTime)::timestamp <= to_timestamp(:approvedEnd, 'YYYY-MM-DD HH24:MI') + interval '30 minutes' ) " +
        "AND ( (event.endDate || ' ' || event.endTime)::timestamp >= to_timestamp(:approvedStart, 'YYYY-MM-DD HH24:MI') - interval '30 minutes' ) )",
        {
          approvedStart: `${approvedEvent.startDate} ${approvedEvent.startTime}`,
          approvedEnd: `${approvedEvent.endDate} ${approvedEvent.endTime}`,
        }
      )
      .getMany();

    for (const booking of pendingBookings) {
      booking.approvalStatus = ApprovalStatus.REJECTED;
      await bookingRepo.save(booking);
    }
  }
}