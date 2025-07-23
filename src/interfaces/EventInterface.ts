import { EventStatus } from "./Enums/EventStatusEnum";
import { EventType } from "./Enums/EventTypeEnum";
import { UserInterface } from "./UserInterface";
import { OrganizationInterface } from "./OrganizationInterface";
import { VenueInterface } from "./VenueInterface";
import { VenueBookingInterface } from "./VenueBookingInterface";
import { RegistrationInterface } from "./RegistrationInterface";
// import { PaymentInterface } from "./PaymentInterface";
import { InvoiceInterface } from "./InvoiceInterface";
import { BookingDateDTO } from "./BookingDateInterface";

export class EventInterface {
  eventId!: string;
  eventName!: string;
  description?: string | undefined;
  eventCategory?: string | undefined;
  eventType!: EventType;
  bookingDates!: BookingDateDTO[];
  maxAttendees?: number | undefined;
  status!: EventStatus;
  qrCode?: string;
  imageURL?: string;
  eventOrganizer!: UserInterface | OrganizationInterface;
  venueId!: string;
  organizer?: UserInterface;
  venue?: VenueInterface;
  venues?: VenueInterface[];
  venueBookings?: VenueBookingInterface[];
  registrations?: RegistrationInterface[];
  // payments?: PaymentInterface[];
  invoices?: InvoiceInterface[];
  createdAt!: string;
  updatedAt!: string;
  deletedAt?: string;

  constructor(data: Partial<EventInterface>) {
    Object.assign(this, {
      eventId: data.eventId || "",
      eventName: data.eventName || "",
      description: data.description ?? undefined,
      eventCategory: data.eventCategory,
      eventType: data.eventType || EventType.MEETING,
      bookingDates: data.bookingDates || [],
      maxAttendees: data.maxAttendees,
      status: data.status || EventStatus.REQUESTED,
      qrCode: data.qrCode,
      imageURL: data.imageURL,
      eventOrganizer: data.eventOrganizer,
      venueId: data.venueId || "",
      organizer: data.organizer,
      venue: data.venue,
      venues: data.venues || [],
      venueBookings: data.venueBookings || [],
      registrations: data.registrations || [],
      // payments: data.payments || [],
      invoices: data.invoices || [],
      createdAt: data.createdAt || "",
      updatedAt: data.updatedAt || "",
      deletedAt: data.deletedAt,
    });
  }

  static validate(data: Partial<EventInterface>): string[] {
    const errors: string[] = [];
    if (!data.eventName) errors.push("Event title is required");
    if (
      data.eventName &&
      (data.eventName.length < 3 || data.eventName.length > 100)
    ) {
      errors.push("Event title must be between 3 and 100 characters");
    }
    if (data.description && data.description.length > 5000) {
      errors.push("Description must be at most 5000 characters long");
    }
    if (data.eventCategory && data.eventCategory.length > 50) {
      errors.push("Event category must be at most 50 characters long");
    }
    if (!Object.values(EventType).includes(data.eventType!)) {
      errors.push(
        `Event type must be one of: ${Object.values(EventType).join(", ")}`
      );
    }
    if (!data.bookingDates || data.bookingDates.length === 0) {
      errors.push("At least one booking date is required");
    }
    if (
      data.maxAttendees &&
      (typeof data.maxAttendees !== "number" || data.maxAttendees < 1)
    ) {
      errors.push("Max attendees must be an integer and at least 1");
    }
    if (!Object.values(EventStatus).includes(data.status!)) {
      errors.push(
        `Invalid event status: must be one of ${Object.values(EventStatus).join(
          ", "
        )}`
      );
    }
    if (data.qrCode && data.qrCode.length > 255) {
      errors.push("QR Code must be at most 255 characters long");
    }
    if (data.imageURL && data.imageURL.length > 255) {
      errors.push("Image URL must be at most 255 characters long");
    }
    if (!data.eventOrganizer) errors.push("Event organizer is required");
    if (!data.venueId) errors.push("Venue ID is required");
    return errors;
  }

  static toRequest(data: EventInterface): EventRequestInterface {
    return new EventRequestInterface({
      eventId: data.eventId,
      eventName: data.eventName,
      description: data.description,
      eventCategory: data.eventCategory,
      eventType: data.eventType,
      bookingDates: data.bookingDates,
      maxAttendees: data.maxAttendees,
      status: data.status,
      qrCode: data.qrCode,
      imageURL: data.imageURL,
      eventOrganizer: data.eventOrganizer,
      venueId: data.venueId,
    });
  }

  static toResponse(data: EventInterface): EventResponseInterface {
    return new EventResponseInterface({
      eventId: data.eventId,
      eventName: data.eventName,
      description: data.description,
      eventCategory: data.eventCategory,
      eventType: data.eventType,
      bookingDates: data.bookingDates,
      maxAttendees: data.maxAttendees,
      status: data.status,
      qrCode: data.qrCode,
      imageURL: data.imageURL,
      eventOrganizer: data.eventOrganizer,
      venue: data.venue,
      venueBookings: data.venueBookings,
      registrations: data.registrations,
      // payments: data.payments,
      invoices: data.invoices,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
      deletedAt: data.deletedAt,
    });
  }
}

export class EventRequestInterface {
  eventId?: string;
  eventName!: string;
  description?: string;
  eventCategory?: string;
  eventType!: EventType;
  bookingDates!: BookingDateDTO[];
  maxAttendees?: number;
  status!: EventStatus;
  qrCode?: string;
  imageURL?: string;
  eventOrganizer!: UserInterface | OrganizationInterface;
  venueId!: string;

  constructor(data: Partial<EventRequestInterface>) {
    Object.assign(this, {
      eventId: data.eventId,
      eventName: data.eventName || "",
      description: data.description,
      eventCategory: data.eventCategory,
      eventType: data.eventType || EventType.MEETING,
      bookingDates: data.bookingDates || [],
      maxAttendees: data.maxAttendees,
      status: data.status || EventStatus.REQUESTED,
      qrCode: data.qrCode,
      imageURL: data.imageURL,
      eventOrganizer: data.eventOrganizer,
      venueId: data.venueId || "",
    });
  }
  static toEntity(data: EventRequestInterface): EventInterface {
    return new EventInterface({
      eventId: data.eventId,
      eventName: data.eventName,
      description: data.description,
      eventCategory: data.eventCategory,
      eventType: data.eventType,
      bookingDates: data.bookingDates,
      maxAttendees: data.maxAttendees,
      status: data.status,
      qrCode: data.qrCode,
      imageURL: data.imageURL,
      eventOrganizer: data.eventOrganizer,
      venueId: data.venueId,
    });
  }
}

export class EventResponseInterface {
  eventId!: string;
  eventName!: string;
  description?: string;
  eventCategory?: string;
  eventType!: EventType;
  bookingDates!: BookingDateDTO[];
  maxAttendees?: number;
  status!: EventStatus;
  qrCode?: string;
  imageURL?: string;
  eventOrganizer!: UserInterface | OrganizationInterface;
  venue?: VenueInterface;
  venueBookings?: VenueBookingInterface[];
  registrations?: RegistrationInterface[];
  // payments?: PaymentInterface[];
  invoices?: InvoiceInterface[];
  createdAt!: string;
  updatedAt!: string;
  deletedAt?: string;

  constructor(data: Partial<EventResponseInterface>) {
    Object.assign(this, {
      eventId: data.eventId || "",
      eventName: data.eventName || "",
      description: data.description,
      eventCategory: data.eventCategory,
      eventType: data.eventType || EventType.MEETING,
      bookingDates: data.bookingDates || [],
      maxAttendees: data.maxAttendees,
      status: data.status || EventStatus.REQUESTED,
      qrCode: data.qrCode,
      imageURL: data.imageURL,
      eventOrganizer: data.eventOrganizer,
      venue: data.venue,
      venueBookings: data.venueBookings,
      registrations: data.registrations,
      // payments: data.payments,
      invoices: data.invoices,
      createdAt: data.createdAt || "",
      updatedAt: data.updatedAt || "",
      deletedAt: data.deletedAt,
    });
  }
  static fromEntity(data: EventInterface): EventResponseInterface {
    return new EventResponseInterface({
      eventId: data.eventId,
      eventName: data.eventName,
      description: data.description,
      eventCategory: data.eventCategory,
      eventType: data.eventType,
      bookingDates: data.bookingDates,
      maxAttendees: data.maxAttendees,
      status: data.status,
      qrCode: data.qrCode,
      imageURL: data.imageURL,
      eventOrganizer: data.eventOrganizer,
      venue: data.venue,
      venueBookings: data.venueBookings,
      registrations: data.registrations,
      // payments: data.payments,
      invoices: data.invoices,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
      deletedAt: data.deletedAt,
    });
  }
}
