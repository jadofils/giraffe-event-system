// src/routes/apiRoutes.ts
import express, { Router } from 'express';
import path from 'path';
import { userRoutes } from './UserRoutes';
import roleRoutes from './RoleRoutes';
import organizationRoutes from './OrganizationRoutes';
import  tickets  from './TicketTyeRoutes'; // Ensure tickets is exported from TicketType
import { verifyJWT } from '../middlewares/AuthMiddleware';
import resourceRoutes from './ResourceRoutes'; // Ensure resourceRoutes is exported from ResourceRoutes
import { venueRoute } from './Venue';
import { eventRoute } from './EventRoutes';
import checkAbsenceRoutes from './CheckAbsenceRoutes'; // Ensure checkAbsenceRoutes is exported from CheckAbsenceRoutes
import RegistrationRoutes from './RegistrationRoutes'; // Ensure RegistrationRoutes is exported from RegistrationRoutes
import VenueBookingRoutes from './VenueBookingRoutes'
const router = Router();
  router.use('/static', express.static(path.join(__dirname, '..', '..', 'uploads'))); // Adjust path as needed

// Use versioned routes
router.use('/users', userRoutes);
router.use('/roles', roleRoutes);
router.use('/organizations',verifyJWT, organizationRoutes); // This makes `/api/v1/organizations/*` available
router.use("/tickets",tickets); // This makes `/api/v1/tickets-type/*` available
//resources
router.use('/resources',verifyJWT,resourceRoutes );
router.use('/venue',venueRoute,checkAbsenceRoutes); // This makes `/api/v1/venue/*` available
router.use('/event',verifyJWT,eventRoute);
// Event Booking routes
router.use('/event-bookings',verifyJWT, VenueBookingRoutes); // This makes `/api/v1/event-bookings/*` available
//routes for registration
router.use('/registrations', RegistrationRoutes); // This makes `/api/v1/registrations/*` available

export default router;
