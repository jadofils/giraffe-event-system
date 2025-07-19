import { VenueStatus, BookingStatus } from "../models/VenueBooking";
import { EventType } from "./Enums/EventTypeEnum";
import { BookingDateDTO } from "./BookingDateInterface";

export class VenueBookingInterface {
  bookingId: string = "";
  venueId: string = "";
  bookingReason?: EventType;
  otherReason?: string;
  eventId?: string;
  createdBy: string = "";
  user?: any; // Replace with actual User interface if available
  bookingDates: BookingDateDTO[] = [];
  venueStatus?: VenueStatus;
  venueDiscountPercent?: number;
  timezone: string = "UTC";
  bookingStatus: BookingStatus = BookingStatus.PENDING;
  amountToBePaid?: number;
  isPaid: boolean = false;
  createdAt?: Date;

  constructor(data: Partial<VenueBookingInterface>) {
    Object.assign(this, {
      bookingId: data.bookingId || "",
      venueId: data.venueId || "",
      bookingReason: data.bookingReason,
      otherReason: data.otherReason,
      eventId: data.eventId,
      createdBy: data.createdBy || "",
      user: data.user,
      bookingDates: data.bookingDates || [],
      venueStatus: data.venueStatus,
      venueDiscountPercent: data.venueDiscountPercent,
      timezone: data.timezone || "UTC",
      bookingStatus: data.bookingStatus || BookingStatus.PENDING,
      amountToBePaid: data.amountToBePaid,
      isPaid: data.isPaid ?? false,
      createdAt: data.createdAt || new Date(),
    });
  }

  static validate(data: Partial<VenueBookingInterface>): string[] {
    const errors: string[] = [];
    if (!data.venueId) errors.push("venueId is required");
    if (!data.createdBy) errors.push("createdBy is required");
    if (!data.bookingDates || data.bookingDates.length === 0) {
      errors.push("At least one booking date is required");
    }
    return errors;
  }
}
