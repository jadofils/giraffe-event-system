import { ApprovalStatus } from "../models/VenueBooking"; // Assuming ApprovalStatus is an enum/type
import { Organization } from "../models/Organization";
import { User } from "../models/User";
import { Venue } from "../models/Venue";
import { Event } from "../models/Event"; // Make sure to import Event

// --- Core Entities Interfaces ---

export interface UserInterface {
  userId: string;
  username: string;
  firstName: string;
  lastName: string;
  email: string;
  password?: string; // Optional for security (e.g., when fetching user data)
  phoneNumber?: string;
  role?: RoleInterface; // Link to Role
  organizations?: OrganizationInterface[]; // Link to Organization (One-to-Many or Many-to-Many depending on your model)
}

export interface RoleInterface {
  roleId: string; // Corrected to camelCase
  roleName: string; // Corrected to camelCase
  permissions: string[];
  description?: string;
  users?: UserInterface[]; // One-to-Many relationship (a role can have many users)
}

export interface OrganizationInterface {
  organizationId: string; // Corrected to camelCase
  organizationName: string; // Corrected to camelCase
  description: string;
  contactEmail: string;
  contactPhone?: string;
  isExternal: boolean;
  address: string;
  organizationType: string;
  user?: UserInterface; // Many-to-One relationship (an organization belongs to one user - manager/creator)
}

export interface VenueInterface {
  venueId: string;
  venueName: string;
  capacity: number;
  location: string;
  managerId?: string; // If manager is a direct ID, otherwise link to UserInterface
  isAvailable?: boolean;
  isBooked?: boolean;
}

export interface EventInterface {
  eventId: string;
  eventTitle: string;
  description: string;
  eventCategory: string;
  eventType: "public" | "private";
  organizerId?: string; // If organizer is a direct ID, otherwise link to UserInterface
  venueId?: string; // If venue is a direct ID, otherwise link to VenueInterface
  // Consider adding actual Event relationships if you have them, e.g.,
  // organizer?: UserInterface;
  // venue?: VenueInterface;
}

// Interface for TicketTypes (now singular to match ManyToOne in Registration)
export interface TicketTypeInterface {
  ticketTypeId: string;
  ticketName: string;
  price: number;
  description?: string; // Made optional
  deletedAt?: Date; // Added soft delete field
}

export interface TicketTypeRequestInterface {
  ticketName: string;
  price: number;
  description?: string;
}
// --- Junction/Booking/Request Interfaces ---

export interface VenueBookingInterface {
  bookingId: string;
  eventId: string; // Foreign key for Event
  venueId: string; // Foreign key for Venue
  organizerId: string; // Foreign key for User (organizer)
  organizationId: string; // Foreign key for Organization
  startDate: Date;
  endDate: Date;
  startTime: string;
  endTime: string;
  approvalStatus: 'pending' | 'approved' | 'rejected'; // Using string literals directly or importing ApprovalStatus
}

// Interface for the actual entity (for type safety, if used for TypeORM entity structure)
export interface VenueBookingEntity {
  bookingId: string;
  event: Event; // Actual Event entity
  venue: Venue; // Actual Venue entity
  user: User; // User who made the booking/organizer
  organization: Organization; // Organization related to the booking
  startDate: Date;
  endDate: Date;
  startTime: string;
  endTime: string;
  approvalStatus: ApprovalStatus; // Using imported ApprovalStatus
}

export interface EventResourceInterface {
  eventResourceId: string; // Corrected to camelCase
  eventId: string; // Foreign key for Event
  resourceId: string; // Foreign key for Resource
  quantity: number;
  amountSpent: number;
}

export interface ResourceInterface {
  resourceId: string; // Corrected to camelCase
  resourceName: string; // Corrected to camelCase
  description: string;
  costPerUnit: number;
}

// Interface for the complete Registration entity (with populated relationships)
export interface RegistrationInterface {
    registrationId: string;
    event: EventInterface;
    user: UserInterface;
    buyer: UserInterface;
    boughtForIds?: string[];
    ticketType: TicketTypeInterface;
    venue: VenueInterface;
    noOfTickets: number;
    registrationDate: string;
    paymentStatus: string;
    qrCode?: string;
    checkDate?: string;
    attended: boolean;
    // --- New Fields ---
    totalCost: number; // Added for the calculated total cost of tickets in this registration
    registrationStatus: string; // Added to track the overall status (e.g., 'active', 'cancelled', 'partially_cancelled')
    // --- Relationships to Payment and Invoice (if eager loaded or directly attached) ---
    payment?: PaymentInterface; // Optional, as it might be null if payment is pending or not yet created
    invoice?: InvoiceInterface; // Optional, as it might be null or not created yet
    // --- Explicit foreign key IDs (if you choose to expose them directly in the interface) ---
    paymentId?: string; // If you expose the FK directly
    invoiceId?: string; // If you expose the FK directly
}

// Interface for Registration creation/update requests (with IDs only)
export interface RegistrationRequestInterface {
    registrationId?: string; // Optional for creation, used for updates
    eventId: string;
    userId: string;
    buyerId: string;
    boughtForIds?: string[];
    ticketTypeId: string;
    venueId: string;
    noOfTickets: number;
    paymentStatus: string;
    registrationDate?: string;
    qrCode?: string;
    checkDate?: string;
    attended?: boolean;
    // --- New Fields for Request (if allowed to be set on creation/update) ---
    totalCost?: number; // Optional on request, often calculated by backend based on ticket price
    registrationStatus?: string; // Optional on request, usually defaults to 'active'
    // --- Foreign Key IDs directly (if you create registrations by IDs) ---
    paymentId?: string; // If you manually link payment/invoice during creation
    invoiceId?: string; // If you manually link payment/invoice during creation
}




// Interface for the complete Invoice entity (with populated relationships)
export interface InvoiceInterface {
    invoiceId: string;
    eventId: string; // Assuming these are just IDs in the Invoice table, not full objects
    userId: string;  // Assuming these are just IDs in the Invoice table, not full objects
    invoiceDate: string;
    dueDate: string;
    totalAmount: number;
    status: string;

    // Relationships
    payments?: PaymentInterface[]; // One-to-Many relationship with Payment
    registration?: RegistrationInterface; // One-to-One relationship with Registration
}


export interface InvoiceRequestInterface {
    invoiceId?: string; // Optional for creation, required for updates
    eventId: string;
    userId: string;
    invoiceDate: string;
    dueDate: string;
    totalAmount: number;
    status: string;
   
    registrationId?: string; // If you link a registration when creating an invoice
}


export interface FeedbackInterface {
  feedbackId: string; // Corrected to camelCase
  eventId: string; // Foreign key for Event
  userId: string; // Foreign key for User
  rating: number;
  comments: string;
}

export interface PaymentInterface {
    paymentId: string;
    invoiceId: string;
    invoice: InvoiceInterface;
    registrationId?: string;
    registration?: RegistrationInterface;
    paymentDate: Date;
    paidAmount: number;
    paymentMethod: string;
    paymentStatus: string;
    description?: string;
}

export interface PaymentRequestInterface {
    paymentId?: string;
    invoiceId: string;
    registrationId?: string;
    paymentDate: string;
    paidAmount: number;
    paymentMethod: string;
    paymentStatus: string;
    description?: string;
}


export interface NotificationInterface {
  notificationId: string; // Corrected to camelCase
  userId: string; // Foreign key for User
  eventId?: string; // Foreign key for Event (optional, notifications might not always be event-specific)
  message: string;
  sentAt: Date;
  isDisabled?: boolean;
  isRead?: boolean;
}

export interface BudgetInterface {
  budgetId: string; // Corrected to camelCase
  eventId: string; // Foreign key for Event
  expectedAmount: number;
  income: number;
  expenditure: number;
  notes: string;
}