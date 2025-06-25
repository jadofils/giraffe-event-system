import { TicketCategory } from './Enums/TicketCategoryEnum';

export interface RegistrationRef {
  registrationId: string;
}

export class TicketTypeInterface {
  ticketTypeId!: string;
  ticketName!: string;
  price!: number;
  ticketCategory!: TicketCategory;
  description?: string;
  promoName?: string;
  promoDescription?: string;
  capacity?: number;
  availableFrom?: Date;
  availableUntil?: Date;
  isActive!: boolean;
  minQuantity?: number;
  maxQuantity?: number;
  requiresVerification!: boolean;
  perks?: string[];
  createdByUserId!: string;
  createdAt!: Date;
  updatedAt!: Date;
  deletedAt?: Date;
  registrations?: RegistrationRef[];
  eventId!: string;
  organizationId?: string; // <-- Add this line

  constructor(data: Partial<TicketTypeInterface>) {
    Object.assign(this, {
      ticketTypeId: data.ticketTypeId || '',
      ticketName: data.ticketName || '',
      price: data.price ?? 0,
      ticketCategory: data.ticketCategory ?? TicketCategory.REGULAR,
      description: data.description,
      promoName: data.promoName,
      promoDescription: data.promoDescription,
      capacity: data.capacity,
      availableFrom: data.availableFrom,
      availableUntil: data.availableUntil,
      isActive: data.isActive ?? true,
      minQuantity: data.minQuantity,
      maxQuantity: data.maxQuantity,
      requiresVerification: data.requiresVerification ?? false,
      perks: data.perks,
      createdByUserId: data.createdByUserId || '',
      createdAt: data.createdAt ?? new Date(),
      updatedAt: data.updatedAt ?? new Date(),
      deletedAt: data.deletedAt,
      registrations: data.registrations ?? [],
      eventId: data.eventId || '',
      organizationId: data.organizationId, // <-- Add this line
    });
  }

  static validate(data: Partial<TicketTypeInterface>): string[] {
    const errors: string[] = [];
    if (!data.ticketName) errors.push('ticketName is required');
    if (data.price === undefined || data.price < 0) errors.push('price must be non-negative');
    if (!data.ticketCategory || !Object.values(TicketCategory).includes(data.ticketCategory)) {
      errors.push(`ticketCategory must be one of ${Object.values(TicketCategory).join(', ')}`);
    }
    if (!data.eventId) errors.push('eventId is required');
    if (!data.createdByUserId) errors.push('createdByUserId is required');
    if (data.capacity !== undefined && data.capacity < 0) errors.push('capacity must be non-negative');
    if (data.minQuantity !== undefined && data.minQuantity < 1) errors.push('minQuantity must be at least 1');
    if (data.maxQuantity !== undefined && data.maxQuantity < 1) errors.push('maxQuantity must be at least 1');
    if (data.perks !== undefined && !Array.isArray(data.perks)) errors.push('perks must be an array of strings');
    // Optionally validate organizationId here if required
    return errors;
  }

  static toRequest(data: TicketTypeInterface): TicketTypeRequestInterface {
    return new TicketTypeRequestInterface({
      ticketTypeId: data.ticketTypeId,
      ticketName: data.ticketName,
      price: data.price,
      ticketCategory: data.ticketCategory,
      description: data.description,
      promoName: data.promoName,
      promoDescription: data.promoDescription,
      capacity: data.capacity,
      availableFrom: data.availableFrom,
      availableUntil: data.availableUntil,
      isActive: data.isActive,
      minQuantity: data.minQuantity,
      maxQuantity: data.maxQuantity,
      requiresVerification: data.requiresVerification,
      perks: data.perks,
      createdByUserId: data.createdByUserId,
      eventId: data.eventId,
      organizationId: data.organizationId, // <-- Add this line
    });
  }

  static toResponse(data: TicketTypeInterface): TicketTypeResponseInterface {
    return new TicketTypeResponseInterface({
      ticketTypeId: data.ticketTypeId,
      ticketName: data.ticketName,
      price: data.price,
      ticketCategory: data.ticketCategory,
      description: data.description,
      promoName: data.promoName,
      promoDescription: data.promoDescription,
      capacity: data.capacity,
      availableFrom: data.availableFrom?.toISOString(),
      availableUntil: data.availableUntil?.toISOString(),
      isActive: data.isActive,
      minQuantity: data.minQuantity,
      maxQuantity: data.maxQuantity,
      requiresVerification: data.requiresVerification,
      perks: data.perks,
      createdByUserId: data.createdByUserId,
      createdAt: data.createdAt.toISOString(),
      updatedAt: data.updatedAt.toISOString(),
      deletedAt: data.deletedAt?.toISOString(),
      registrations: data.registrations?.map(r => r.registrationId),
      eventId: data.eventId,
      organizationId: data.organizationId, // <-- Add this line
    });
  }
}

export class TicketTypeRequestInterface {
  ticketTypeId?: string;
  ticketName!: string;
  price!: number;
  ticketCategory!: TicketCategory;
  description?: string;
  promoName?: string;
  promoDescription?: string;
  capacity?: number;
  availableFrom?: Date;
  availableUntil?: Date;
  isActive?: boolean;
  minQuantity?: number;
  maxQuantity?: number;
  requiresVerification?: boolean;
  perks?: string[];
  createdByUserId?: string;
  eventId!: string;
  organizationId?: string; // <-- Add this line

  constructor(data: Partial<TicketTypeRequestInterface>) {
    Object.assign(this, {
      ticketTypeId: data.ticketTypeId,
      ticketName: data.ticketName || '',
      price: data.price ?? 0,
      ticketCategory: data.ticketCategory ?? TicketCategory.REGULAR,
      description: data.description,
      promoName: data.promoName,
      promoDescription: data.promoDescription,
      capacity: data.capacity,
      availableFrom: data.availableFrom,
      availableUntil: data.availableUntil,
      isActive: data.isActive ?? true,
      minQuantity: data.minQuantity,
      maxQuantity: data.maxQuantity,
      requiresVerification: data.requiresVerification ?? false,
      perks: data.perks,
      createdByUserId: data.createdByUserId,
      eventId: data.eventId || '',
      organizationId: data.organizationId, // <-- Add this line
    });
  }

  static toEntity(data: TicketTypeRequestInterface): TicketTypeInterface {
    return new TicketTypeInterface({
      ticketTypeId: data.ticketTypeId,
      ticketName: data.ticketName,
      price: data.price,
      ticketCategory: data.ticketCategory,
      description: data.description,
      promoName: data.promoName,
      promoDescription: data.promoDescription,
      capacity: data.capacity,
      availableFrom: data.availableFrom,
      availableUntil: data.availableUntil,
      isActive: data.isActive ?? true,
      minQuantity: data.minQuantity,
      maxQuantity: data.maxQuantity,
      requiresVerification: data.requiresVerification ?? false,
      perks: data.perks,
      createdByUserId: data.createdByUserId || '',
      eventId: data.eventId,
      registrations: [],
      organizationId: data.organizationId, // <-- Add this line
    });
  }
}

export class TicketTypeResponseInterface {
  ticketTypeId!: string;
  ticketName!: string;
  price!: number;
  ticketCategory!: TicketCategory;
  description?: string;
  promoName?: string;
  promoDescription?: string;
  capacity?: number;
  availableFrom?: string;
  availableUntil?: string;
  isActive!: boolean;
  minQuantity?: number;
  maxQuantity?: number;
  requiresVerification!: boolean;
  perks?: string[];
  createdByUserId!: string;
  createdAt!: string;
  updatedAt!: string;
  deletedAt?: string;
  registrations?: string[];
  eventId!: string;
  organizationId?: string; // <-- Add this line

  constructor(data: Partial<TicketTypeResponseInterface>) {
    Object.assign(this, {
      ticketTypeId: data.ticketTypeId || '',
      ticketName: data.ticketName || '',
      price: data.price ?? 0,
      ticketCategory: data.ticketCategory ?? TicketCategory.REGULAR,
      description: data.description,
      promoName: data.promoName,
      promoDescription: data.promoDescription,
      capacity: data.capacity,
      availableFrom: data.availableFrom,
      availableUntil: data.availableUntil,
      isActive: data.isActive ?? true,
      minQuantity: data.minQuantity,
      maxQuantity: data.maxQuantity,
      requiresVerification: data.requiresVerification ?? false,
      perks: data.perks,
      createdByUserId: data.createdByUserId || '',
      createdAt: data.createdAt ?? new Date().toISOString(),
      updatedAt: data.updatedAt ?? new Date().toISOString(),
      deletedAt: data.deletedAt,
      registrations: data.registrations ?? [],
      eventId: data.eventId || '',
      organizationId: data.organizationId, // <-- Add this line
    });
  }

  static fromEntity(data: TicketTypeInterface): TicketTypeResponseInterface {
    return new TicketTypeResponseInterface({
      ticketTypeId: data.ticketTypeId,
      ticketName: data.ticketName,
      price: data.price,
      ticketCategory: data.ticketCategory,
      description: data.description,
      promoName: data.promoName,
      promoDescription: data.promoDescription,
      capacity: data.capacity,
      availableFrom: data.availableFrom instanceof Date
        ? data.availableFrom.toISOString()
        : data.availableFrom || undefined,
      availableUntil: data.availableUntil instanceof Date
        ? data.availableUntil.toISOString()
        : data.availableUntil || undefined,
      isActive: data.isActive,
      minQuantity: data.minQuantity,
      maxQuantity: data.maxQuantity,
      requiresVerification: data.requiresVerification,
      perks: data.perks,
      createdByUserId: data.createdByUserId,
      createdAt: data.createdAt.toISOString(),
      updatedAt: data.updatedAt.toISOString(),
      deletedAt: data.deletedAt?.toISOString(),
      registrations: data.registrations?.map(r => r.registrationId),
      eventId: data.eventId,
      organizationId: data.organizationId, // <-- Add this line
    });
  }
}