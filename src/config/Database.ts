import { DataSource } from "typeorm";
import dotenv from "dotenv";

dotenv.config();

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
  ssl: {
    rejectUnauthorized: true,
  },
  schema: 'public',
});

// Function to initialize the database
export const initializeDatabase = async (): Promise<void> => {
  try {
    await AppDataSource.initialize();
    console.log("Database connection established successfully!");
  } catch (error) {
    console.error("Error during database initialization:", error);
  }
};
