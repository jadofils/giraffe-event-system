import { VenueStatus } from "../models/Venue Tables/Venue";

export interface BookingConditionRequest {
  descriptionCondition?: string;
  notaBene?: string;
  transitionTime?: number;
  depositRequiredPercent?: number;
  paymentComplementTimeBeforeEvent?: number;
}

export interface VenueVariableRequest {
  venueAmount: number;
  venueManagerId: string;
  isFree: boolean;
}

export interface VenueAmenityRequest {
  resourceName: string;
  quantity: number;
  amenitiesDescription?: string;
  costPerUnit?: number;
}

export interface VenueRequest {
  venueName: string;
  description?: string;
  capacity: number;
  venueLocation: string;
  latitude?: number;
  longitude?: number;
  googleMapsLink?: string;
  organizationId: string;
  venueAmenitiesId?: string;
  mainPhotoUrl?: string;
  photoGallery?: string[];
  virtualTourUrl?: string;
  venueDocuments?: any;
  status?: "PENDING" | "APPROVED" | "REJECTED";
  cancellationReason?: string;
  visitPurposeOnly?: boolean;
  bookingType?: "HOURLY" | "DAILY";
  bookingConditions: BookingConditionRequest[];
  venueVariable: VenueVariableRequest;
  venueAmenities?: VenueAmenityRequest[];
}

export class VenueInterface {
  venueId!: string;
  venueName!: string;
  description?: string;
  capacity!: number;
  amount!: number;
  location!: string;
  latitude?: number;
  longitude?: number;
  googleMapsLink?: string;
  managerId?: string;
  organizationId?: string;
  amenities?: string;
  contactPerson?: string;
  contactEmail?: string;
  contactPhone?: string;
  websiteURL?: string;
  status: VenueStatus = VenueStatus.PENDING;
  createdAt!: Date;
  updatedAt!: Date;
  deletedAt?: Date;
  cancellationReason?: string;
  mainPhotoUrl?: string;
  subPhotoUrls?: string[];

  constructor(data: Partial<VenueInterface>) {
    Object.assign(this, {
      venueId: data.venueId || "",
      venueName: data.venueName || "",
      description: data.description,
      organizationId: data.organizationId || "",
      capacity: data.capacity || 0,
      location: data.location || "",
      latitude: data.latitude,
      longitude: data.longitude,
      googleMapsLink: data.googleMapsLink,
      managerId: data.managerId,
      amount: data.amount || 0,
      createdAt: data.createdAt || new Date(),
      updatedAt: data.updatedAt || new Date(),
      deletedAt: data.deletedAt,
      amenities: data.amenities,
      contactPerson: data.contactPerson,
      contactEmail: data.contactEmail,
      contactPhone: data.contactPhone,
      websiteURL: data.websiteURL,
    });
  }

  static validate(data: Partial<VenueInterface>): string[] {
    const errors: string[] = [];
    if (!data.venueName) errors.push("venueName is required");
    if (!data.capacity || data.capacity <= 0)
      errors.push("capacity must be greater than 0");
    if (!data.location) errors.push("location is required");
    return errors;
  }
}
