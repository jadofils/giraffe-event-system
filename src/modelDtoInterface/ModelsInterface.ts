// Interface for Users
export class UserInterface {
    static UserID: string;
    static Username: string;
    static FirstName: string;
    static LastName: string;
    static Email: string;
    static PhoneNumber?: string;
  }
  
  // Interface for Roles
  export class RoleInterface {
    static RoleID: string;
    static RoleName: string;
    static Permissions: string[];
    static Description?: string;
  }
  
  // Interface for Organizations
  export class OrganizationInterface {
    static OrganizationID: string;
    static OrganizationName: string;
    static Description: string;
    static ContactEmail: string;
    static ContactPhone?: string;
    static IsExternal: boolean;
    static Address: string;
    static OrganizationType: string;
  }
  
  // Interface for Venues
  export class VenueInterface {
    static VenueID: string;
    static VenueName: string;
    static Capacity: number;
    static Location: string;
  }
  
  // Interface for Events
  export class EventInterface {
    static EventID: string;
    static EventTitle: string;
    static Description: string;
    static EventCategory: string;
    static EventType: "public" | "private";
  }
  
  // Interface for EventBooking
  export class EventBookingInterface {
    static BookingID: string;
    static EventID: string;
    static VenueID: string;
    static OrganizerID: string;
    static OrganizationID: string;
    static StartDate: Date;
    static EndDate: Date;
    static StartTime: string;
    static EndTime: string;
    static ApprovalStatus: string;
  }
  
  // Interface for EventResources
  export class EventResourceInterface {
    static EventResourceID: string;
    static EventID: string;
    static ResourceID: string;
    static Quantity: number;
    static AmountSpent: number;
  }
  
  // Interface for Resources
  export class ResourceInterface {
    static ResourceID: string;
    static ResourceName: string;
    static Description: string;
    static CostPerUnit: number;
  }
  
  // Interface for Registrations
  export class RegistrationInterface {
    static RegistrationID: string;
    static EventID: string;
    static UserID: string;
    static RegistrationDate: Date;
    static TicketType: string;
    static PaymentStatus: string;
    static QRCode: string;
    static CheckDate?: Date;
    static Attended?: boolean;
  }
  
  // Interface for Feedback
  export class FeedbackInterface {
    static FeedbackID: string;
    static EventID: string;
    static UserID: string;
    static Rating: number;
    static Comments: string;
  }
  
  // Interface for Payments
  export class PaymentInterface {
    static PaymentID: string;
    static EventID: string;
    static UserID: string;
    static TicketTypeID: string;
    static PaymentDate: Date;
    static PaidAmount: number;
    static RemainingAmount?: number;
    static PaymentMethod: string;
    static PaymentStatus: string;
    static Description?: string;
  }
  
  // Interface for TicketTypes
  export class TicketTypeInterface {
    static TicketTypeID: string;
    static TicketName: string;
    static Price: number;
    static Description?: string;
  }
  
  // Interface for Notifications
  export class NotificationInterface {
    static NotificationID: string;
    static UserID: string;
    static EventID: string;
    static Message: string;
    static SentAt: Date;
    static IsDisabled?: boolean;
    static IsRead?: boolean;
  }
  
  // Interface for Budgets
  export class BudgetInterface {
    static BudgetID: string;
    static EventID: string;
    static ExpectedAmount: number;
    static Income: number;
    static Expenditure: number;
    static Notes: string;
  }
  
  // Interface for UserRoles (Many-to-Many)
  export class UserRoleInterface {
    static UserID: string;
    static RoleID: string;
  }
  
  // Interface for OrganizationUsers (Many-to-Many)
  export class OrganizationUserInterface {
    static UserID: string;
    static OrganizationID: string;
  }
  