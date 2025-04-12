import { AppDataSource } from '../config/Database';
import { Organization } from '../models/Organization';
import { OrganizationInterface } from '../interfaces/interface';

export class OrganizationRepository {
  // Get all organizations
  static async getAll(): Promise<{ success: boolean; data?: Organization[]; message?: string }> {
    try {
      const organizations = await AppDataSource.getRepository(Organization).find();
      return { success: true, data: organizations };
    } catch (error) {
      return { success: false, message: 'Failed to fetch organizations' };
    }
  }

  // Get an organization by ID
  static async getById(id: string): Promise<{ success: boolean; data?: Organization; message?: string }> {
    if (!id) {
      return { success: false, message: 'Organization ID is required' };
    }

    try {
      const organization = await AppDataSource.getRepository(Organization).findOne({ where: { organizationId: id } });
      if (!organization) {
        return { success: false, message: 'Organization not found' };
      }
      return { success: true, data: organization };
    } catch (error) {
      return { success: false, message: 'Failed to fetch organization' };
    }
  }

  // Create a new organization
  static create(data: Partial<OrganizationInterface>): { success: boolean; data?: Organization; message?: string } {
    if (!data.OrganizationName || !data.ContactEmail || !data.Address || !data.OrganizationType) {
      return { success: false, message: 'Required fields are missing' };
    }

    const organization = new Organization();
    organization.organizationName = data.OrganizationName;
    organization.description = data.Description ?? '';
    organization.contactEmail = data.ContactEmail;
    organization.contactPhone = data.ContactPhone ?? '';
    organization.address = data.Address;
    organization.organizationType = data.OrganizationType;

    return { success: true, data: organization };
  }

  // Save an organization
  static async save(org: Organization): Promise<{ success: boolean; data?: Organization; message?: string }> {
    if (!org.organizationName || !org.contactEmail || !org.address || !org.organizationType) {
      return { success: false, message: 'Required fields are missing' };
    }

    try {
      const savedOrganization = await AppDataSource.getRepository(Organization).save(org);
      return { success: true, data: savedOrganization };
    } catch (error) {
      return { success: false, message: 'Failed to save organization' };
    }
  }

  // Update an organization
  static async update(
    id: string,
    data: Partial<OrganizationInterface>
  ): Promise<{ success: boolean; data?: Organization; message?: string }> {
    if (!id) {
      return { success: false, message: 'Organization ID is required' };
    }

    try {
      const repo = AppDataSource.getRepository(Organization);
      const organization = await repo.findOne({ where: { organizationId: id } });

      if (!organization) {
        return { success: false, message: 'Organization not found' };
      }

      repo.merge(organization, {
        organizationName: data.OrganizationName ?? organization.organizationName,
        description: data.Description ?? organization.description,
        contactEmail: data.ContactEmail ?? organization.contactEmail,
        contactPhone: data.ContactPhone ?? organization.contactPhone,
        address: data.Address ?? organization.address,
        organizationType: data.OrganizationType ?? organization.organizationType,
      });

      const updatedOrganization = await repo.save(organization);
      return { success: true, data: updatedOrganization };
    } catch (error) {
      return { success: false, message: 'Failed to update organization' };
    }
  }

  // Delete an organization
  static async delete(id: string): Promise<{ success: boolean; message: string }> {
    if (!id) {
      return { success: false, message: 'Organization ID is required' };
    }

    try {
      const result = await AppDataSource.getRepository(Organization).delete(id);
      if (result.affected === 0) {
        return { success: false, message: 'Organization not found or already deleted' };
      }
      return { success: true, message: 'Organization deleted successfully' };
    } catch (error) {
      return { success: false, message: 'Failed to delete organization' };
    }
  }
}