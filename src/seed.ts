import { RoleRepository } from "./repositories/RoleRepository";
import { RoleInterface } from "./interfaces/RoleInterface";

// Function to seed default roles
export async function seedDefaultRoles() {
  try {
    const defaultRoles: (Omit<Partial<RoleInterface>, "permissions"> & {
      permissions: string[];
    })[] = [
      {
        roleName: "GUEST",
        permissions: ["venue:view", "event:view"],
        description: "Default role for new users",
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
        console.log(
          `✓ Role '${roleData.roleName}' already exists, skipping...`
        );
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
        console.log(
          `✅ Default ${roleData.roleName} role created successfully!`
        );
        createdRoles.push(roleData.roleName);
      } else {
        console.error(
          `❌ Failed to create ${roleData.roleName} role: ${result.message}`
        );
      }
    }

    // Summary message
    if (createdRoles.length > 0) {
      console.log(
        `\n🎉 Successfully created ${
          createdRoles.length
        } new role(s): ${createdRoles.join(", ")}`
      );
    }
    if (skippedRoles.length > 0) {
      console.log(
        `📋 Skipped ${
          skippedRoles.length
        } existing role(s): ${skippedRoles.join(", ")}`
      );
    }
    if (createdRoles.length === 0 && skippedRoles.length > 0) {
      console.log(`\n✅ All default roles already exist in the database!`);
    }
  } catch (error) {
    console.error("❌ Error seeding default roles:", error);
    throw error;
  }
}
