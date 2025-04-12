import { DataSource } from "typeorm";

export const AppDataSource = new DataSource({
  type: "postgres",
  url: process.env.DB_URL,
  synchronize: true, // Keep true until schema is fixed
  logging: false, // Enable logging to see SQL commands
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

// Modified initialization function
export const initializeDatabase = async (): Promise<void> => {
  try {
    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
      console.log("Database connection established!");
      
      // Seed the GUEST role after successful initialization
      await seedDefaultRoles();
    }
  } catch (error) {
    console.error("Error during database initialization:", error);
  }
};

// Function to seed default roles
async function seedDefaultRoles() {
  try {
    const roleRepository = AppDataSource.getRepository('Role');
    
    // Check if GUEST role exists
    const guestRole = await roleRepository.findOne({ where: { roleName: 'GUEST' } });
    
    if (!guestRole) {
      console.log("Creating default GUEST role...");
      const newRole = roleRepository.create({
        roleName: 'GUEST',
        permissions: ['read:public'],
        description: 'Default role for new users'
      });
      await roleRepository.save(newRole);
      console.log("Default GUEST role created successfully!");
    }
  } catch (error) {
    console.error("Error seeding default roles:", error);
  }
}