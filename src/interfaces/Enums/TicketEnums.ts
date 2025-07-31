export enum TicketCategory {
  STUDENT = "STUDENT",
  GROUP = "GROUP",
  CORPORATE = "CORPORATE",
  GENERAL = "GENERAL", // Added a general category as a default/fallback
}

export enum AgeRestriction {
  NO_RESTRICTION = "NO_RESTRICTION",
  EIGHTEEN_PLUS = "18_PLUS",
  TWENTY_ONE_PLUS = "21_PLUS",
  FAMILY_FRIENDLY = "FAMILY_FRIENDLY",
  CHILDREN_ONLY = "CHILDREN_ONLY",
  SENIOR_DISCOUNT = "SENIOR_DISCOUNT",
}

export enum TicketStatus {
  ACTIVE = "ACTIVE",
  INACTIVE = "INACTIVE",
  SOLD_OUT = "SOLD_OUT",
}
