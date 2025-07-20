import { OrganizationStatusEnum } from "./Enums/OrganizationStatusEnum";

export interface OrganizationInterface {
  organizationId: string;
  organizationName: string;
  description?: string;
  contactEmail: string;
  contactPhone?: string;
  address?: string;
  organizationType: string;
  logo?: string;
  supportingDocument?: string;
  cancellationReason?: string;
  status: OrganizationStatusEnum;
  isEnabled: boolean;
  city?: string;
  country?: string;
  postalCode?: string;
  stateProvince?: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}
