import { DataSource } from "typeorm";
import { Role } from "../models/Role";
import { User } from "../models/User";
import { Venue } from "../models/Venue";
import { TicketType } from "../models/TicketType";
import { Event } from "../models/Event";
import { Resource } from "../models/Resources";
import { VenueResource } from "../models/VenueResource";
import { EventResource } from "../models/EventResource";
import { Feedback } from "../models/Feedback";
import { Permission } from "../models/Permission";
import { VenuePayment } from "../models/VenuePayment";
import { Notification } from "../models/Notification";
import { Organization } from "../models/Organization";
import { Registration } from "../models/Registration";
import { Payment } from "../models/Payment";
import { Invoice } from "../models/Invoice";
import { InstallmentPlan } from "../models/InstallmentPlan";
import { Budget } from "../models/Budget";
import { VenueBooking } from "../models/VenueBooking";
import { VenueInvoice } from "../models/VenueInvoice";

// Determine if we are in production
const isProduction = process.env.NODE_ENV === "production";

export const AppDataSource = new DataSource({
  type: "postgres",
  url: process.env.DB_URL,
  synchronize: true,
  logging: false,
  entities: [
    User,
    Venue,
    TicketType,
    Event,
    Resource,
    VenueResource,
    EventResource,
    Feedback,
    Role,
    Permission,
    VenuePayment,
    Notification,
    Organization,
    Registration,
    Payment,
    Invoice,
    InstallmentPlan,
    Budget,
    VenueBooking,
    VenueInvoice,
  ],
  migrations: [
    isProduction ? "dist/models/migrations/.js" : "src/models/migrations/.ts",
  ],
  extra: {
    connectionTimeoutMillis: 30000,
  },
  ssl: isProduction ? { rejectUnauthorized: false } : false,
  schema: "public",
});

// Track if seeding has been completed
// let isSeedingCompleted = false;

// Modified initialization function
export const initializeDatabase = async (): Promise<void> => {
  try {
    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
    }
  } catch (error) {
    //console.error("Error during database initialization:", error);
    throw error; // Re-throw to handle it in the application
  }
};
