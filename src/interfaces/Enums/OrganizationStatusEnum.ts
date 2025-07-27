export enum OrganizationStatusEnum {
  APPROVED = "APPROVED",
  REJECTED = "REJECTED",
  QUERY = "QUERY", // Admin queries organization
  PENDING_QUERY = "PENDING_QUERY", // User has resubmitted after query
  PENDING = "PENDING",
  DISABLED = "DISABLED",
}
