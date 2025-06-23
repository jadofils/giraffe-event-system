import { ApprovalStatus } from '../models/VenueBooking';
import { Event } from '../models/Event';
import { IsUUID, IsOptional, IsEnum, IsString, IsNumber, IsDate } from 'class-validator';

export class VenueBookingInterface {
  @IsOptional()
  @IsUUID('4')
  bookingId?: string;

  @IsUUID('4')
  eventId!: string;

  @IsOptional()
  event?: Partial<Event>;

  @IsUUID('4')
  venueId!: string;

  @IsUUID('4')
  organizerId!: string;

  @IsOptional()
  @IsUUID('4')
  userId?: string;

  @IsOptional()
  @IsUUID('4')
  organizationId?: string;

  @IsOptional()
  @IsUUID('4')
  venueInvoiceId?: string;

  @IsOptional()
  @IsNumber()
  totalAmountDue?: number;

  @IsOptional()
  @IsEnum(ApprovalStatus)
  approvalStatus?: ApprovalStatus;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsDate()
  createdAt?: Date;

  @IsOptional()
  @IsDate()
  updatedAt?: Date;

  @IsOptional()
  @IsDate()
  deletedAt?: Date;

  constructor(data: Partial<VenueBookingInterface>) {
    Object.assign(this, {
      bookingId: data.bookingId,
      eventId: data.eventId || '',
      event: data.event,
      venueId: data.venueId || '',
      organizerId: data.organizerId || '',
      userId: data.userId,
      organizationId: data.organizationId,
      venueInvoiceId: data.venueInvoiceId,
      totalAmountDue: data.totalAmountDue,
      approvalStatus: data.approvalStatus || ApprovalStatus.PENDING,
      notes: data.notes,
      createdAt: data.createdAt || new Date(),
      updatedAt: data.updatedAt || new Date(),
      deletedAt: data.deletedAt,
    });
  }

  static validate(data: Partial<VenueBookingInterface>): string[] {
    const errors: string[] = [];
    if (!data.eventId) errors.push('eventId is required');
    if (!data.venueId) errors.push('venueId is required');
    if (!data.organizerId) errors.push('organizerId is required');
    if (data.event) {
      if (!data.event.startDate) errors.push('event.startDate is required when event is provided');
      if (!data.event.endDate) errors.push('event.endDate is required when event is provided');
      if (!data.event.startTime) errors.push('event.startTime is required when event is provided');
      if (!data.event.endTime) errors.push('event.endTime is required when event is provided');
    }
    return errors;
  }
}