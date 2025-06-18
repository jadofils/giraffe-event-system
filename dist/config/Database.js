"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.isDatabaseSeeded = exports.initializeDatabase = exports.AppDataSource = void 0;
const typeorm_1 = require("typeorm");
const IndependentUserOrganizationSeeder_1 = __importDefault(require("../seeds/IndependentUserOrganizationSeeder"));
const typeorm_extension_1 = require("typeorm-extension");
exports.AppDataSource = new typeorm_1.DataSource({
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
const initializeDatabase = () => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!exports.AppDataSource.isInitialized) {
            yield exports.AppDataSource.initialize();
            console.log("Database connection established!");
            // Only run seeding if it hasn't been completed yet
            if (!isSeedingCompleted) {
                yield seedDefaultRoles();
                yield runSeeders();
                isSeedingCompleted = true;
                console.log("Initial database seeding completed!");
            }
        }
    }
    catch (error) {
        console.error("Error during database initialization:", error);
        throw error; // Re-throw to handle it in the application
    }
});
exports.initializeDatabase = initializeDatabase;
// Function to run all seeders
function runSeeders() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const seeder = new IndependentUserOrganizationSeeder_1.default();
            const factoryManager = new typeorm_extension_1.SeederFactoryManager();
            // Run the independent organization seeder
            yield seeder.run(exports.AppDataSource, factoryManager);
            console.log("Database seeding completed!");
        }
        catch (error) {
            console.error("Error during database seeding:", error);
            throw error; // Re-throw to handle it in the application
        }
    });
}
// Function to seed default roles
function seedDefaultRoles() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const roleRepository = exports.AppDataSource.getRepository('Role');
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
            const existingRoles = yield roleRepository.find();
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
                    yield roleRepository.save(newRole);
                    console.log(`Default ${roleData.roleName} role created successfully!`);
                }
                catch (saveError) {
                    if (saveError.code === '23505') { // PostgreSQL unique violation error code
                        console.log(`Role '${roleData.roleName}' already exists (concurrent creation), skipping...`);
                        continue;
                    }
                    throw saveError; // Re-throw if it's a different error
                }
            }
        }
        catch (error) {
            console.error("Error seeding default roles:", error);
            throw error;
        }
    });
}
// Export a function to check if seeding is completed
const isDatabaseSeeded = () => {
    return isSeedingCompleted;
};
exports.isDatabaseSeeded = isDatabaseSeeded;
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
