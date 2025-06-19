import { AppDataSource } from "../config/Database";
import { Permission } from "../models/Permission";

export class PermissionSeeder {
  static async seed() {
    const permissionRepository = AppDataSource.getRepository(Permission);
    const permissions = [
      // Venue permissions
      { name: "venue:view", description: "View venues" },
      { name: "venue:create", description: "Create a venue" },
      { name: "venue:update", description: "Update a venue" },
      { name: "venue:delete", description: "Delete a venue" },
      { name: "venue:search", description: "Search venues" },
      { name: "venue:count", description: "Count venues" },
      { name: "venue:update_manager", description: "Update venue manager" },
      { name: "venue:remove_manager", description: "Remove venue manager" },
      // VenueBooking permissions
      { name: "venueBooking:create", description: "Create a venue booking" },
      {
        name: "venueBooking:create_bulk",
        description: "Create multiple venue bookings",
      },
      { name: "venueBooking:view", description: "View venue bookings" },
      { name: "venueBooking:update", description: "Update a venue booking" },
      {
        name: "venueBooking:update_status",
        description: "Update venue booking status",
      },
      { name: "venueBooking:delete", description: "Delete a venue booking" },
      { name: "venueBooking:by_event", description: "Get bookings by event" },
      { name: "venueBooking:by_venue", description: "Get bookings by venue" },
      {
        name: "venueBooking:by_organizer",
        description: "Get bookings by organizer",
      },
      {
        name: "venueBooking:by_organization",
        description: "Get bookings by organization",
      },
      { name: "venueBooking:by_status", description: "Get bookings by status" },
      {
        name: "venueBooking:by_date_range",
        description: "Get bookings by date range",
      },
      {
        name: "venueBooking:check_duplicates",
        description: "Check duplicate bookings",
      },
      // User permissions
      { name: "user:register", description: "Register a user" },
      { name: "user:login", description: "Login as user" },
      { name: "user:reset_password", description: "Reset user password" },
      { name: "user:view_profile", description: "View user profile" },
      { name: "user:update_profile", description: "Update user profile" },
      { name: "user:view", description: "View users" },
      { name: "user:update", description: "Update user" },
      { name: "user:delete", description: "Delete user" },
      { name: "user:assign_role", description: "Assign role to user" },
      // Role permissions
      { name: "role:create", description: "Create a role" },
      { name: "role:view", description: "View roles" },
      { name: "role:update", description: "Update a role" },
      { name: "role:delete", description: "Delete a role" },
      { name: "role:search", description: "Search roles by name" },
      // TicketType permissions
      { name: "ticketType:create", description: "Create ticket type" },
      { name: "ticketType:view", description: "View ticket types" },
      { name: "ticketType:update", description: "Update ticket type" },
      { name: "ticketType:delete", description: "Delete ticket type" },
      // Resource permissions
      { name: "resource:create", description: "Create resource" },
      { name: "resource:view", description: "View resources" },
      { name: "resource:update", description: "Update resource" },
      { name: "resource:delete", description: "Delete resource" },
      // Registration permissions
      { name: "registration:create", description: "Create registration" },
      { name: "registration:view", description: "View registrations" },
      { name: "registration:update", description: "Update registration" },
      { name: "registration:delete", description: "Delete registration" },
      // Payment permissions
      { name: "payment:create", description: "Create payment" },
      { name: "payment:view", description: "View payments" },
      { name: "payment:update", description: "Update payment" },
      { name: "payment:delete", description: "Delete payment" },
      // Organization permissions
      { name: "organization:create", description: "Create organization" },
      { name: "organization:view", description: "View organizations" },
      { name: "organization:update", description: "Update organization" },
      { name: "organization:delete", description: "Delete organization" },
      // Invoice permissions
      { name: "invoice:create", description: "Create invoice" },
      { name: "invoice:view", description: "View invoices" },
      { name: "invoice:update", description: "Update invoice" },
      { name: "invoice:delete", description: "Delete invoice" },
      // InstallmentPlan permissions
      {
        name: "installmentPlan:create",
        description: "Create installment plan",
      },
      { name: "installmentPlan:view", description: "View installment plans" },
      {
        name: "installmentPlan:update",
        description: "Update installment plan",
      },
      {
        name: "installmentPlan:delete",
        description: "Delete installment plan",
      },
      // Event permissions
      { name: "event:create", description: "Create event" },
      { name: "event:view", description: "View events" },
      { name: "event:update", description: "Update event" },
      { name: "event:delete", description: "Delete event" },
    ];

    const createdPermissions = [];
    const skippedPermissions = [];

    for (const perm of permissions) {
      try {
        const exists = await permissionRepository.findOne({
          where: { name: perm.name },
        });
        
        if (!exists) {
          const permission = permissionRepository.create(perm);
          const savedPermission = await permissionRepository.save(permission);
          console.log(`✅ Created permission: ${perm.name}`);
          createdPermissions.push(perm.name);
        } else {
          console.log(`✓ Permission '${perm.name}' already exists, skipping...`);
          skippedPermissions.push(perm.name);
        }
      } catch (error) {
        console.error(`❌ Error creating permission '${perm.name}':`, error);
      }
    }

    // Summary message
    if (createdPermissions.length > 0) {
      console.log(`\n🎉 Successfully created ${createdPermissions.length} new permission(s): ${createdPermissions.join(', ')}`);
    }
    if (skippedPermissions.length > 0) {
      console.log(`📋 Skipped ${skippedPermissions.length} existing permission(s): ${skippedPermissions.join(', ')}`);
    }
    if (createdPermissions.length === 0 && skippedPermissions.length > 0) {
      console.log(`\n✅ All permissions already exist in the database!`);
    }
    
    console.log(`\n📊 Total permissions in database: ${createdPermissions.length + skippedPermissions.length}`);
  }
}
