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
const AdminRoleSeeder_1 = require("../seeds/AdminRoleSeeder");
const PermissionSeeder_1 = require("../seeds/PermissionSeeder");
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
    ssl: process.env.NODE_ENV === "production"
        ? { rejectUnauthorized: true }
        : false, // Adjust SSL for development
    schema: "public",
});
// Track if seeding has been completed
let isSeedingCompleted = false;
// Modified initialization function
const initializeDatabase = () => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!exports.AppDataSource.isInitialized) {
            yield exports.AppDataSource.initialize();
            // console.log("Database connection established!");
            // Only run seeding if it hasn't been completed yet
            if (!isSeedingCompleted) {
                //  console.log("\n🌱 Starting database seeding process...");
                // Seed permissions first
                console.log("🔐 Seeding permissions...");
                yield PermissionSeeder_1.PermissionSeeder.seed();
                // Seed admin role (with drop logic)
                yield seedAdminRole();
                yield seedDefaultRoles();
                yield runSeeders();
                // console.log("Seeding admin role with all permissions...");
                yield AdminRoleSeeder_1.AdminRoleSeeder.seed();
                //console.log("Admin role seeding completed!");
                isSeedingCompleted = true;
                // console.log("\n✅ Database seeding completed successfully!");
                // console.log(
                //   "📊 Database is ready for use with all required roles and organizations."
                // );
            }
            else {
                //console.log("\n✅ Database already seeded - skipping seeding process.");
            }
        }
    }
    catch (error) {
        //console.error("Error during database initialization:", error);
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
            // console.log("Database seeding completed!");
        }
        catch (error) {
            // console.error("Error during database seeding:", error);
            throw error; // Re-throw to handle it in the application
        }
    });
}
// Function to seed default roles
function seedDefaultRoles() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const roleRepository = exports.AppDataSource.getRepository("Role");
            // No default roles to seed
        }
        catch (error) {
            //console.error("Error seeding default roles:", error);
            throw error;
        }
    });
}
// Export a function to check if seeding is completed
const isDatabaseSeeded = () => {
    return isSeedingCompleted;
};
exports.isDatabaseSeeded = isDatabaseSeeded;
function seedAdminRole() {
    return __awaiter(this, void 0, void 0, function* () {
        const roleRepository = exports.AppDataSource.getRepository("Role");
        // Check if ADMIN role exists
        const adminExists = yield roleRepository.findOne({
            where: { roleName: "ADMIN" },
        });
        if (adminExists) {
            //  console.log("✅ 'ADMIN' role already exists. No deletion performed.");
            //  console.log(
            //     "ℹ️  If you need to create new roles or assign roles, please do so via the admin panel or appropriate endpoint."
            //   );
            return;
        }
        // Create the ADMIN role
        const adminRole = roleRepository.create({
            roleName: "ADMIN",
            permissions: ["read:all", "write:all", "delete:all"],
            description: "Administrator role",
        });
        yield roleRepository.save(adminRole);
        console.log("🎉 'ADMIN' role created successfully!");
    });
}
