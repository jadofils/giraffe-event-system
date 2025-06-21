import { DataSource } from "typeorm";
import IndependentOrganizationSeeder from "../seeds/IndependentUserOrganizationSeeder";
import { SeederFactoryManager } from "typeorm-extension";
import { AdminRoleSeeder } from "../seeds/AdminRoleSeeder";
import { PermissionSeeder } from "../seeds/PermissionSeeder";

const isProduction = process.env.NODE_ENV === "production";

export const AppDataSource = new DataSource({
  type: "postgres",
  url: process.env.DB_URL,
  synchronize: true,
  logging: false,

  // ✅ Use compiled .js files in production (Docker), .ts in dev
  entities: [
    isProduction ? __dirname + "/../models/**/*.js" : "src/models/**/*.ts",
  ],
  migrations: [
    isProduction
      ? __dirname + "/../models/migrations/*.js"
      : "src/models/migrations/*.ts",
  ],

  extra: {
    connectionTimeoutMillis: 30000,
  },
  ssl: isProduction ? { rejectUnauthorized: false } : false,
  schema: "public",
});

// Track if seeding has been completed
let isSeedingCompleted = false;

export const initializeDatabase = async (): Promise<void> => {
  try {
    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
      console.log("✅ Database connection established!");

      if (!isSeedingCompleted) {
        console.log("🔐 Seeding permissions...");
        await PermissionSeeder.seed();
        await seedAdminRole();
        await seedDefaultRoles();
        await runSeeders();
        await AdminRoleSeeder.seed();
        isSeedingCompleted = true;
        console.log("🌱 Database seeding completed successfully.");
      } else {
        console.log("✅ Database already seeded - skipping.");
      }
    }
  } catch (error) {
    console.error("❌ Error during DB initialization:", error);
    throw error;
  }
};

async function runSeeders() {
  try {
    const seeder = new IndependentOrganizationSeeder();
    const factoryManager = new SeederFactoryManager();
    await seeder.run(AppDataSource, factoryManager);
  } catch (error) {
    throw error;
  }
}

async function seedDefaultRoles() {
  try {
    const roleRepository = AppDataSource.getRepository("Role");
    // Add default roles if needed
  } catch (error) {
    throw error;
  }
}

export const isDatabaseSeeded = (): boolean => {
  return isSeedingCompleted;
};

async function seedAdminRole() {
  const roleRepository = AppDataSource.getRepository("Role");
  const adminExists = await roleRepository.findOne({
    where: { roleName: "ADMIN" },
  });

  if (adminExists) return;

  const adminRole = roleRepository.create({
    roleName: "ADMIN",
    permissions: ["read:all", "write:all", "delete:all"],
    description: "Administrator role",
  });
  await roleRepository.save(adminRole);
  console.log("🎉 'ADMIN' role created successfully!");
}
