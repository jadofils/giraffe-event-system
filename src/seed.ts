import { runSeeders } from "typeorm-extension";
import { AppDataSource } from "./config/Database";
import EventVenueSeeding from "./seeds/EventVenueSeeding";
import IndependentOrganizationSeeder from "./seeds/IndependentUserOrganizationSeeder";
import { PermissionSeeder } from "./seeds/PermissionSeeder";
import { AdminRoleSeeder } from "./seeds/AdminRoleSeeder";
import { RoleRepository } from "./repositories/RoleRepository";
import { RoleInterface } from "./interfaces/RoleInterface";

(async () => {
  try {
    await AppDataSource.initialize();
    console.log("Database connection established!");

    // Check if seeding has already been done
    const existingRoles = await RoleRepository.getAllRoles();
    if (existingRoles.length > 0) {
      console.log(
        "Database already seeded with roles:",
        existingRoles.map((role) => role.roleName).join(", ")
      );
      console.log("Skipping seeding process...");
      await AppDataSource.destroy();
      return;
    }

    // Run seeders
    await runSeeders(AppDataSource, {
      seeds: [IndependentOrganizationSeeder, EventVenueSeeding],
    });

    // Seed permissions first
    await PermissionSeeder.seed();

    // Seed default roles
    await seedDefaultRoles();

    // Seed admin role
    await AdminRoleSeeder.seed();

    console.log("Seeding completed successfully!");
    await AppDataSource.destroy();
  } catch (error) {
    console.error("Error during seeding:", error);
    await AppDataSource.destroy();
    process.exit(1);
  }
})();

// Function to seed default roles
async function seedDefaultRoles() {
  try {
    const defaultRoles: (Omit<Partial<RoleInterface>, "permissions"> & {
      permissions: string[];
    })[] = [
      {
        roleName: "GUEST",
        permissions: ["venue:view"],
        description: "Default role for new users",
      },
      {
        roleName: "USER",
        permissions: ["venue:view", "venue:create"],
        description: "Standard user role",
      },
      {
        roleName: "ORGANIZER_MANAGER",
        permissions: [
          "venue:view",
          "venue:create",
          "event:manage",
          "venue:manage",
        ],
        description: "Role for event and venue organizers",
      },
    ];

    const existingRoles = await RoleRepository.getAllRoles();
    const existingRoleNames = new Set(
      existingRoles.map((role) => role.roleName)
    );

    for (const roleData of defaultRoles) {
      if (existingRoleNames.has(roleData.roleName!)) {
        console.log(`Role '${roleData.roleName}' already exists, skipping...`);
        continue;
      }

      console.log(`Creating default ${roleData.roleName} role...`);
      const newRole = await RoleRepository.createRole(
        roleData as unknown as Partial<RoleInterface>
      );
      if ("error" in newRole) {
        console.error(
          `Failed to create ${roleData.roleName} role: ${newRole.error}`
        );
        continue;
      }
      const result = await RoleRepository.saveRole(newRole);
      if (result.success) {
        console.log(`Default ${roleData.roleName} role created successfully!`);
      } else {
        console.error(
          `Failed to create ${roleData.roleName} role: ${result.message}`
        );
      }
    }
  } catch (error) {
    console.error("Error seeding default roles:", error);
    throw error;
  }
}
