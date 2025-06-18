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
        "\n✅ Database already seeded with roles:",
        existingRoles.map((role) => role.roleName).join(", ")
      );
      console.log("📋 Skipping seeding process - all roles already exist!");
      await AppDataSource.destroy();
      return;
    }

    console.log("\n🌱 Starting database seeding process...");

    // Run seeders
    await runSeeders(AppDataSource, {
      seeds: [IndependentOrganizationSeeder, EventVenueSeeding],
    });

    // Seed permissions first
    console.log("🔐 Seeding permissions...");
    await PermissionSeeder.seed();
    console.log("✅ Permissions seeded successfully!");

    // Seed default roles
    console.log("👥 Seeding default roles...");
    await seedDefaultRoles();

    // Seed admin role
    console.log("👑 Seeding admin role...");
    await AdminRoleSeeder.seed();
    console.log("✅ Admin role seeded successfully!");

    console.log("\n🎉 Database seeding completed successfully!");
    console.log("📊 Database is ready for use with all required roles, permissions, and organizations.");
    await AppDataSource.destroy();
  } catch (error) {
    console.error("❌ Error during seeding:", error);
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
    const createdRoles = [];
    const skippedRoles = [];

    for (const roleData of defaultRoles) {
      if (existingRoleNames.has(roleData.roleName!)) {
        console.log(`✓ Role '${roleData.roleName}' already exists, skipping...`);
        skippedRoles.push(roleData.roleName);
        continue;
      }

      console.log(`Creating default ${roleData.roleName} role...`);
      const newRole = await RoleRepository.createRole(
        roleData as unknown as Partial<RoleInterface>
      );
      if ("error" in newRole) {
        console.error(
          `❌ Failed to create ${roleData.roleName} role: ${newRole.error}`
        );
        continue;
      }
      const result = await RoleRepository.saveRole(newRole);
      if (result.success) {
        console.log(`✅ Default ${roleData.roleName} role created successfully!`);
        createdRoles.push(roleData.roleName);
      } else {
        console.error(
          `❌ Failed to create ${roleData.roleName} role: ${result.message}`
        );
      }
    }

    // Summary message
    if (createdRoles.length > 0) {
      console.log(`\n🎉 Successfully created ${createdRoles.length} new role(s): ${createdRoles.join(', ')}`);
    }
    if (skippedRoles.length > 0) {
      console.log(`📋 Skipped ${skippedRoles.length} existing role(s): ${skippedRoles.join(', ')}`);
    }
    if (createdRoles.length === 0 && skippedRoles.length > 0) {
      console.log(`\n✅ All default roles already exist in the database!`);
    }
  } catch (error) {
    console.error("❌ Error seeding default roles:", error);
    throw error;
  }
}
