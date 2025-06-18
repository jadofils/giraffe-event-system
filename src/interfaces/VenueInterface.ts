export class VenueInterface {
  venueId!: string;
  venueName!: string;
  capacity!: number;
  amount!: number;
  location!: string;
  latitude?: number;
  longitude?: number;
  googleMapsLink?: string;
  managerId?: string;
  organizationId?: string;
  amenities?: string;
  venueType?: string;
  contactPerson?: string;
  contactEmail?: string;
  contactPhone?: string;
  websiteURL?: string;
  createdAt!: Date;
  updatedAt!: Date;
  deletedAt?: Date;

  constructor(data: Partial<VenueInterface>) {
    Object.assign(this, {
      venueId: data.venueId || '',
      venueName: data.venueName || '',
      organizationId: data.organizationId || '',
      capacity: data.capacity || 0,
      location: data.location || '',
      latitude: data.latitude,
      longitude: data.longitude,
      googleMapsLink: data.googleMapsLink,
      managerId: data.managerId,
      amount: data.amount || 0,
      createdAt: data.createdAt || new Date(),
      updatedAt: data.updatedAt || new Date(),
      deletedAt: data.deletedAt,
      amenities: data.amenities,
      venueType: data.venueType,
      contactPerson: data.contactPerson,
      contactEmail: data.contactEmail,
      contactPhone: data.contactPhone,
      websiteURL: data.websiteURL,
    });
  }

  static validate(data: Partial<VenueInterface>): string[] {
    const errors: string[] = [];
    if (!data.venueName) errors.push('venueName is required');
    if (!data.capacity || data.capacity <= 0) errors.push('capacity must be greater than 0');
    if (!data.location) errors.push('location is required');
    return errors;
  }
}