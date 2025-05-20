import { EventBooking } from "../models/EventBooking";
import { User } from "../models/User";

export interface UserInterface {
  UserID: string;
  Username: string;
  FirstName: string;
  LastName: string;
  Email: string;
  Password?: string;
  PhoneNumber?: string;
  Role?: RoleInterface; // Many-to-One relationship (a user has one role)
  Organizations?: OrganizationInterface[]; // One-to-Many relationship (a user belongs to many organizations)
}

export interface RoleInterface {
  RoleID: string;
  RoleName: string;
  Permissions: string[];
  Description?: string;
  Users?: UserInterface[]; // One-to-Many relationship (a role can have many users)
}


export interface OrganizationInterface {
  OrganizationID: string;
  OrganizationName: string;
  Description: string;
  ContactEmail: string;
  ContactPhone?: string;
  IsExternal: boolean;
  Address: string;
  OrganizationType: string;
  User?: UserInterface; // Many-to-One relationship (an organization belongs to one user)
}


// Interface for Venues
export interface VenueInterface {
  VenueID: string;
  VenueName: string;
  Capacity: number;
  Location: string;

  ManagerId?: string;
  IsAvailable?: boolean;
  IsBooked?: boolean;



}

// Interface for Events
export interface EventInterface {
  EventID: string;
  EventTitle: string;
  Description: string;
  EventCategory: string;
  EventType: "public" | "private";
  
  OrganizerId?: string,
  VenueId?:string
}

// Interface for EventBooking
export interface EventBookingInterface {
  BookingID: string;
  EventID: string;
  VenueID: string;
  OrganizerID: string;
  OrganizationID: string;
  StartDate: Date;
  EndDate: Date;
  StartTime: string;
  EndTime: string;
  ApprovalStatus: string;
}

// Interface for EventResources
export interface EventResourceInterface {
  EventResourceID: string;
  EventID: string;
  ResourceID: string;
  Quantity: number;
  AmountSpent: number;
}

// Interface for Resources
export interface ResourceInterface {
  ResourceID: string;
  ResourceName: string;
  Description: string;
  CostPerUnit: number;
}

// Interface for Registrations
export interface RegistrationInterface {
  RegistrationID: string;
  EventID: string;
  UserID: string;
  RegistrationDate: Date;
  TicketType: string;
  PaymentStatus: string;
  QRCode: string;
  CheckDate?: Date;
  Attended?: boolean;
}

// Interface for Feedback
export interface FeedbackInterface {
  FeedbackID: string;
  EventID: string;
  UserID: string;
  Rating: number;
  Comments: string;
}

// Interface for Payments
export interface PaymentInterface {
  PaymentID: string;
  EventID: string;
  UserID: string;
  TicketTypeID: string;
  PaymentDate: Date;
  PaidAmount: number;
  RemainingAmount?: number;
  PaymentMethod: string;
  PaymentStatus: string;
  Description?: string;
}

// Interface for TicketTypes
export interface TicketTypeInterface {
  TicketTypeID: string;
  TicketName: string;
  Price: number;
  Description?: string;
}

// Interface for Notifications
export interface NotificationInterface {
  NotificationID: string;
  UserID: string;
  EventID: string;
  Message: string;
  SentAt: Date;
  IsDisabled?: boolean;
  IsRead?: boolean;
}

// Interface for Budgets
export interface BudgetInterface {
  BudgetID: string;
  EventID: string;
  ExpectedAmount: number;
  Income: number;
  Expenditure: number;
  Notes: string;
}


