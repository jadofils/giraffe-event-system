import { DataSource } from "typeorm";
import IndependentOrganizationSeeder from "../seeds/IndependentUserOrganizationSeeder";
import { SeederFactoryManager } from "typeorm-extension";

export const AppDataSource = new DataSource({
  type: "postgres",
  url: process.env.DB_URL,
  synchronize: true, 
  logging: false, 
  entities: ["src/models/**/*.ts"],
  migrations: ["src/models/migrations/*.ts"],
  extra: {
    connectionTimeoutMillis: 30000,
  },
  ssl: process.env.NODE_ENV === 'production' 
    ? { rejectUnauthorized: true }
    : false, // Adjust SSL for development
  schema: 'public',
});

// Track if seeding has been completed
let isSeedingCompleted = false;

// Modified initialization function
export const initializeDatabase = async (): Promise<void> => {
  try {
    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
      console.log("Database connection established!");
      
      // Only run seeding if it hasn't been completed yet
      if (!isSeedingCompleted) {
        await seedDefaultRoles();
        await runSeeders();
        isSeedingCompleted = true;
        console.log("Initial database seeding completed!");
      }
    }
  } catch (error) {
    console.error("Error during database initialization:", error);
    throw error; // Re-throw to handle it in the application
  }
};

// Function to run all seeders
async function runSeeders() {
  try {
    const seeder = new IndependentOrganizationSeeder();
    const factoryManager = new SeederFactoryManager();
    
    // Run the independent organization seeder
    await seeder.run(AppDataSource, factoryManager);
    
    console.log("Database seeding completed!");
  } catch (error) {
    console.error("Error during database seeding:", error);
    throw error; // Re-throw to handle it in the application
  }
}

// Function to seed default roles
async function seedDefaultRoles() {
  try {
    const roleRepository = AppDataSource.getRepository('Role');
    
    // Define default roles
    const defaultRoles = [
      {
        roleName: 'GUEST',
        permissions: ['read:public'],
        description: 'Default role for new users'
      },
      {
        roleName: 'USER',
        permissions: ['read:public', 'write:own'],
        description: 'Standard user role'
      },
      {
        roleName: 'ADMIN',
        permissions: ['read:all', 'write:all', 'delete:all'],
        description: 'Administrator role'
      },
      {
        roleName: 'ORGANIZER_MANAGER',
        permissions: ['read:public', 'write:own', 'manage:events', 'manage:venues'],
        description: 'Role for event and venue organizers'
      }
    ];

    // Get all existing roles first
    const existingRoles = await roleRepository.find();
    const existingRoleNames = new Set(existingRoles.map(role => role.roleName));

    // Create only new roles
    for (const roleData of defaultRoles) {
      if (existingRoleNames.has(roleData.roleName)) {
        console.log(`Role '${roleData.roleName}' already exists, skipping...`);
        continue;
      }

      try {
        console.log(`Creating default ${roleData.roleName} role...`);
        const newRole = roleRepository.create(roleData);
        await roleRepository.save(newRole);
        console.log(`Default ${roleData.roleName} role created successfully!`);
      } catch (saveError: any) {
        if (saveError.code === '23505') { // PostgreSQL unique violation error code
          console.log(`Role '${roleData.roleName}' already exists (concurrent creation), skipping...`);
          continue;
        }
        throw saveError; // Re-throw if it's a different error
      }
    }
  } catch (error) {
    console.error("Error seeding default roles:", error);
    throw error;
  }
}

// Export a function to check if seeding is completed
export const isDatabaseSeeded = (): boolean => {
  return isSeedingCompleted;
};

// Function to update all enum columns to uppercase
// async function updateEnumColumnsToUppercase() {
//   const queryRunner = AppDataSource.createQueryRunner();
//   try {
//     await queryRunner.connect();

//     // List of [table, column] pairs that use enums
//     const enumColumns: [string, string][] = [
//       ['ticket_types', 'ticketCategory'],
//       // Add more as needed: ['table_name', 'enum_column_name']
//     ];

//     for (const [table, column] of enumColumns) {
//       await queryRunner.query(
//         `UPDATE "${table}" SET "${column}" = UPPER("${column}") WHERE "${column}" IS NOT NULL;`
//       );
//     }

//     console.log('All enum columns updated to uppercase.');
//   } catch (error) {
//     console.error('Error updating enum columns to uppercase:', error);
//   } finally {
//     await queryRunner.release();
//   }
// }
