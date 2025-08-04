// src/index.ts
import app from "./app";
import { AppConfig } from "./config/AppConfig";
import { initializeDatabase, AppDataSource } from "./config/Database";
import { initializeRedis } from "./config/redis"; // <-- Import the Redis initialization function
import { seedDefaultRoles } from "./seed";
import { AdminRoleSeeder } from "./seeds/AdminRoleSeeder"; // <-- Import the AdminRoleSeeder
import { PermissionSeeder } from "./seeds/PermissionSeeder";
import { BookingSchedulerService } from "./services/BookingSchedulerService";

// Bootstrap function to start the application
async function bootstrap() {
  try {
    // Initialize database connection
    await initializeDatabase();
    console.log("Database initialized successfully."); // Add a success log

    // Seed admin role
    try {
      //await AdminRoleSeeder.seed();
      //console.log("Admin role seeded successfully.");
    } catch (seedError) {
      console.error("Failed to seed admin role:", seedError);
    }

    // Seed guest role
    try {
      //await seedDefaultRoles();
      // console.log("Guest role seeded successfully.");
    } catch (seedError) {
      console.error("Failed to seed guest role:", seedError);
    }

    // Initialize Redis connection
    await initializeRedis(); // <-- Await Redis connection
    console.log("Redis initialized successfully."); // Add a success log

    // Start booking scheduler
    BookingSchedulerService.startScheduling();

    // Start the server
    app.listen(AppConfig.PORT, () => {
      console.log(`Server running on port ${AppConfig.PORT}`);
      console.log(
        `API available at http://localhost:${AppConfig.PORT}${AppConfig.API_PREFIX}`
      );
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1); // Exit if critical services fail to initialize
  }
}

// Start the application
bootstrap();
