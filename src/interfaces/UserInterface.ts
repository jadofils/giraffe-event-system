import { RoleInterface } from './RoleInterface';
import { OrganizationInterface } from './OrganizationInterface'; // Ensure this is correctly imported if used for the organization object

export class UserInterface {
  userId!: string;
  username!: string;
  firstName!: string;
  lastName!: string;
  email!: string;
  password?: string;
  phoneNumber?: string;

  // --- NEW OPTIONAL USER PROFILE FIELDS ---
  bio?: string;
  profilePictureURL?: string;
  preferredLanguage?: string;
  timezone?: string;
  emailNotificationsEnabled?: boolean;
  smsNotificationsEnabled?: boolean;
  socialMediaLinks?: { [key: string]: string }; // More specific type for JSON object
  dateOfBirth?: Date;
  gender?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  stateProvince?: string;
  postalCode?: string;
  country?: string;
  // --- END NEW OPTIONAL USER PROFILE FIELDS ---

  // Relationships (as per your User.ts entity's final state)
  roleId?: string; // Added roleId to match User entity's foreign key
  role?: RoleInterface;

  organizationId?: string; // Added organizationId to match User entity's foreign key
  organization?: OrganizationInterface; // Changed to single OrganizationInterface, not an array

  // Removed organizations?: OrganizationInterface[]; // Inconsistent with User entity's ManyToOne relationship

  createdAt!: Date;
  updatedAt!: Date;
  deletedAt?: Date;

  constructor(data: Partial<UserInterface>) {
    Object.assign(this, {
      userId: data.userId || '',
      username: data.username || '',
      firstName: data.firstName || '',
      lastName: data.lastName || '',
      email: data.email || '',
      password: data.password,
      phoneNumber: data.phoneNumber,

      // Initialize new optional fields
      bio: data.bio,
      profilePictureURL: data.profilePictureURL,
      preferredLanguage: data.preferredLanguage,
      timezone: data.timezone,
      emailNotificationsEnabled: data.emailNotificationsEnabled,
      smsNotificationsEnabled: data.smsNotificationsEnabled,
      socialMediaLinks: data.socialMediaLinks,
      dateOfBirth: data.dateOfBirth,
      gender: data.gender,
      addressLine1: data.addressLine1,
      addressLine2: data.addressLine2,
      city: data.city,
      stateProvince: data.stateProvince,
      postalCode: data.postalCode,
      country: data.country,

      // Initialize relationship IDs and objects
      roleId: data.roleId,
      role: data.role,
      organizationId: data.organizationId,
      organization: data.organization,

      createdAt: data.createdAt || new Date(),
      updatedAt: data.updatedAt || new Date(),
      deletedAt: data.deletedAt,
    });
  }

  static validate(data: Partial<UserInterface>): string[] {
    const errors: string[] = [];
    if (!data.email) errors.push('email is required');
    if (!data.username) errors.push('username is required');
    // You might want to add more validation rules here for the new fields as needed
    return errors;
  }
}