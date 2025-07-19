import { UserInterface } from './UserInterface';
import { OrganizationStatusEnum } from './Enums/OrganizationStatusEnum';

export class OrganizationInterface {
  organizationId!: string;
  organizationName!: string;
  contactEmail!: string;
  contactPhone?: string;
  address!: string;
  user?: UserInterface;

 // Initialize optional fields
  city?: string;
  country?: string;
  postalCode?: string;
  stateProvince?: string;
  organizationType?: string;
  organizationProfile?: string;
  description?: string;
  supportingDocument?: string;
  logo?: string;
  status!: OrganizationStatusEnum;
      


  createdAt!: Date;
  updatedAt!: Date;
  deletedAt?: Date;

  constructor(data: Partial<OrganizationInterface>) {
    Object.assign(this, {
      organizationId: data.organizationId || '',
      organizationName: data.organizationName || '',
      description: data.description || '',
      contactEmail: data.contactEmail || '',
      contactPhone: data.contactPhone,
      address: data.address || '',
      organizationType: data.organizationType || '',
      user: data.user,
      city: data.city,
      country: data.country,
      postalCode: data.postalCode,
      stateProvince: data.stateProvince,
      supportingDocument: data.supportingDocument,
      status: data.status || OrganizationStatusEnum.PENDING,
      createdAt: data.createdAt || new Date(),
      updatedAt: data.updatedAt || new Date(),
      deletedAt: data.deletedAt,
    });
  }

  static validate(data: Partial<OrganizationInterface>): string[] {
    const errors: string[] = [];
    if (!data.organizationName) errors.push('organizationName is required');
    if (!data.contactEmail) errors.push('contactEmail is required');
    if (!data.address) errors.push('address is required');
    if (!data.status) errors.push('status is required');
    return errors;
  }
}