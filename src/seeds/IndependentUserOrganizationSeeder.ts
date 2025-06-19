import { Seeder, SeederFactoryManager } from "typeorm-extension";
import { DataSource } from "typeorm";
import { User } from "../models/User";
import { Organization } from "../models/Organization";
import { Role } from "../models/Role";

export default class IndependentOrganizationSeeder implements Seeder {
  public async run(
    dataSource: DataSource,
    factoryManager: SeederFactoryManager
  ): Promise<void> {
    const userRepository = dataSource.getRepository(User);
    const organizationRepository = dataSource.getRepository(Organization);
    const roleRepository = dataSource.getRepository(Role);

    // Find or create a default role (assuming a 'user' role exists)
    let role = await roleRepository.findOneBy({ roleName: "user" });
    if (!role) {
      // Fetch 'read' and 'write' permissions from the Permission table
      const permissionRepository = dataSource.getRepository("Permission");
      const permissions = await permissionRepository.find({
        where: [{ name: "read" }, { name: "write" }],
      });
      role = roleRepository.create({
        roleName: "user",
        description: "Default user role",
        permissions,
      });
      await roleRepository.save(role);
    }

    // Create the "Independent" organization
    let independentOrg = await organizationRepository.findOneBy({
      organizationName: "Independent",
    });
    if (!independentOrg) {
      independentOrg = organizationRepository.create({
        organizationName: "Independent",
        contactEmail: "independent@org.com",
        description: "Default organization for independent users",
      });
      await organizationRepository.save(independentOrg);
    }

    // Check if test user already exists
    let testUser = await userRepository.findOneBy({ username: "testuser" });
    if (!testUser) {
      try {
        testUser = userRepository.create({
          username: "testuser",
          firstName: "Test",
          lastName: "User",
          email: "testuser@example.com",
          password: "hashedPassword", // In a real app, hash the password
          roleId: role.roleId,
        });
        await userRepository.save(testUser);
        console.log("Test user created successfully");
      } catch (error: any) {
        if (error.code === "23505") {
          // PostgreSQL unique violation
          console.log("Test user already exists, skipping creation");
          testUser = await userRepository.findOneBy({ username: "testuser" });
        } else {
          throw error;
        }
      }
    } else {
      console.log("Test user already exists, skipping creation");
    }

    if (testUser) {
      // Check if user is already linked to the organization
      const existingLink = await dataSource
        .createQueryBuilder()
        .select()
        .from("user_organizations", "uo")
        .where("uo.userId = :userId AND uo.organizationId = :orgId", {
          userId: testUser.userId,
          orgId: independentOrg.organizationId,
        })
        .getCount();

      if (!existingLink) {
        // Link the test user to the "Independent" organization
        await dataSource
          .createQueryBuilder()
          .insert()
          .into("user_organizations")
          .values({
            userId: testUser.userId,
            organizationId: independentOrg.organizationId,
          })
          .orIgnore()
          .execute();
        console.log("Test user linked to Independent organization");
      } else {
        console.log("Test user already linked to Independent organization");
      }
    }

    // Optionally, assign "Independent" to all existing users
    const allUsers = await userRepository.find();
    for (const user of allUsers) {
      const hasOrganization = await dataSource
        .createQueryBuilder()
        .select()
        .from("user_organizations", "uo")
        .where("uo.userId = :userId AND uo.organizationId = :orgId", {
          userId: user.userId,
          orgId: independentOrg.organizationId,
        })
        .getCount();

      if (!hasOrganization) {
        await dataSource
          .createQueryBuilder()
          .insert()
          .into("user_organizations")
          .values({
            userId: user.userId,
            organizationId: independentOrg.organizationId,
          })
          .orIgnore()
          .execute();
      }
    }
  }
}
