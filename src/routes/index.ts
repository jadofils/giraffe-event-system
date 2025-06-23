// src/routes/apiRoutes.ts
import express, { Router } from "express";
import path from "path";
// Swagger UI setup
import swaggerUi from "swagger-ui-express";
import YAML from "yamljs";
import { userRoutes } from "./UserRoutes";
import roleRoutes from "./RoleRoutes";
import { organizationRoutes } from "./OrganizationRoutes";
import tickets from "./TicketTyeRoutes"; // Ensure tickets is exported from TicketType
import resourceRoutes from "./ResourceRoutes"; // Ensure resourceRoutes is exported from ResourceRoutes
// import RegistrationRoutes from "./RegistrationRoutes"; // Ensure RegistrationRoutes is exported from RegistrationRoutes
import VenueBookingRoutes from "./VenueBookingRoutes";
import InvoiceRoutes from "./InvoiceRoutes";
import PaymentRoutes from "./PaymentRoutes";
import InstallmentPlanRoutes from "./InstallmentPlanRoutes";
import EventRoute from "./EventRoutes";
import PermissionRoutes from "./PermissionRoutes";
import { venueRoute } from "./Venue";
const router = Router();
router.use(
  "/static",
  express.static(path.join(__dirname, "..", "..", "uploads"))
); // Adjust path as needed

// Use versioned routes
router.use("/users", userRoutes);
router.use("/roles", roleRoutes);
router.use("/organizations", organizationRoutes); // This makes `/api/v1/organizations/*` available
router.use("/tickets", tickets); // This makes `/api/v1/tickets-type/*` available
//resources
router.use("/resources", resourceRoutes);
router.use("/venue", venueRoute); // This makes `/api/v1/venue/*` available
router.use("/event", EventRoute);
// Event Booking routes
router.use("/event-bookings", VenueBookingRoutes); // This makes `/api/v1/event-bookings/*` available
//routes for registration
// router.use("/registrations", RegistrationRoutes); // This makes `/api/v1/registrations/*` available
router.use("/invoices", InvoiceRoutes);

//endpoints of the payments
router.use("/payments", PaymentRoutes);

//installements planning
router.use("/installments", InstallmentPlanRoutes);

// Add PermissionRoutes
router.use("/permissions", PermissionRoutes);


const swaggerDocument = YAML.load(path.join(__dirname, "../config/Swagger.yaml"));
router.use("/giraffe-space/swagger-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));

export default router;
