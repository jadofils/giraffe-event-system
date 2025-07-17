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
Object.defineProperty(exports, "__esModule", { value: true });
exports.initializeDatabase = exports.AppDataSource = void 0;
const typeorm_1 = require("typeorm");
const Role_1 = require("../models/Role");
const User_1 = require("../models/User");
const Venue_1 = require("../models/Venue Tables/Venue");
const TicketType_1 = require("../models/TicketType");
const Event_1 = require("../models/Event Tables/Event");
const VenueAmenities_1 = require("../models/Venue Tables/VenueAmenities");
const Feedback_1 = require("../models/Feedback");
const Permission_1 = require("../models/Permission");
const VenuePayment_1 = require("../models/VenuePayment");
const Notification_1 = require("../models/Notification");
const Organization_1 = require("../models/Organization");
const Registration_1 = require("../models/Registration");
const Payment_1 = require("../models/Payment");
const Invoice_1 = require("../models/Invoice");
const InstallmentPlan_1 = require("../models/InstallmentPlan");
const Budget_1 = require("../models/Budget");
const VenueBooking_1 = require("../models/VenueBooking");
const VenueInvoice_1 = require("../models/VenueInvoice");
const BookingCondition_1 = require("../models/Venue Tables/BookingCondition");
const VenueVariable_1 = require("../models/Venue Tables/VenueVariable");
const VenueAvailabilitySlot_1 = require("../models/Venue Tables/VenueAvailabilitySlot");
const VenueReview_1 = require("../models/Venue Tables/VenueReview");
const Resources_1 = require("../models/Resources");
// Determine if we are in production
const isProduction = process.env.NODE_ENV === "production";
exports.AppDataSource = new typeorm_1.DataSource({
    type: "postgres",
    url: process.env.DB_URL,
    synchronize: true,
    logging: false,
    entities: [
        User_1.User,
        Venue_1.Venue,
        TicketType_1.TicketType,
        Event_1.Event,
        VenueAmenities_1.VenueAmenities,
        Feedback_1.Feedback,
        Role_1.Role,
        Permission_1.Permission,
        VenuePayment_1.VenuePayment,
        Notification_1.Notification,
        Organization_1.Organization,
        Registration_1.Registration,
        Payment_1.Payment,
        Invoice_1.Invoice,
        InstallmentPlan_1.InstallmentPlan,
        Budget_1.Budget,
        VenueBooking_1.VenueBooking,
        VenueInvoice_1.VenueInvoice,
        BookingCondition_1.BookingCondition,
        VenueVariable_1.VenueVariable,
        VenueAvailabilitySlot_1.VenueAvailabilitySlot,
        VenueReview_1.VenueReview,
        Resources_1.Resources,
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
const initializeDatabase = () => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!exports.AppDataSource.isInitialized) {
            yield exports.AppDataSource.initialize();
        }
    }
    catch (error) {
        //console.error("Error during database initialization:", error);
        throw error; // Re-throw to handle it in the application
    }
});
exports.initializeDatabase = initializeDatabase;
