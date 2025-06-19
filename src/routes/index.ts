// src/routes/apiRoutes.ts
import express, { Router } from 'express';
import path from 'path';
import { userRoutes } from './UserRoutes';
import roleRoutes from './RoleRoutes';
import {organizationRoutes} from './OrganizationRoutes';
import  tickets  from './TicketTyeRoutes'; // Ensure tickets is exported from TicketType
import resourceRoutes from './ResourceRoutes'; // Ensure resourceRoutes is exported from ResourceRoutes
import { venueRoute } from './Venue';
import RegistrationRoutes from './RegistrationRoutes'; // Ensure RegistrationRoutes is exported from RegistrationRoutes
import VenueBookingRoutes from './VenueBookingRoutes'
import InvoiceRoutes from './InvoiceRoutes';
import PaymentRoutes from './PaymentRoutes';
import InstallmentPlanRoutes from './InstallmentPlanRoutes';
import EventRoute from './EventRoutes';
import { isAdmin } from '../middlewares/IsAdmin';
const router = Router();
  router.use('/static', express.static(path.join(__dirname, '..', '..', 'uploads'))); // Adjust path as needed

// Use versioned routes
router.use('/users', userRoutes);
router.use('/roles',isAdmin, roleRoutes);
router.use('/organizations', organizationRoutes); // This makes `/api/v1/organizations/*` available
router.use("/tickets",tickets); // This makes `/api/v1/tickets-type/*` available
//resources
router.use('/resources',resourceRoutes );
router.use('/venue',venueRoute); // This makes `/api/v1/venue/*` available
router.use('/event',EventRoute);
// Event Booking routes
router.use('/event-bookings', VenueBookingRoutes); // This makes `/api/v1/event-bookings/*` available
//routes for registration
router.use('/registrations', RegistrationRoutes); // This makes `/api/v1/registrations/*` available
router.use('/invoices',InvoiceRoutes)

//endpoints of the payments
router.use('/payments',PaymentRoutes);

//installements planning
router.use('/installments',InstallmentPlanRoutes)
export default router;
