// src/routes/apiRoutes.ts
import { Router } from 'express';
import { userRoutes } from './UserRoutes';
import roleRoutes from './RoleRoutes';
import organizationRoutes from './OrganizationRoutes';
import  tickets  from './TicketTyeRoutes'; // Ensure tickets is exported from TicketType
import { verifyJWT } from '../middlewares/AuthMiddleware';
import resourceRoutes from './ResourceRoutes'; // Ensure resourceRoutes is exported from ResourceRoutes
import { venueRoute } from './Venue';
import { eventRoute } from './EventRoutes';
import eventBookingRoutes from './EventBookingRoutes';
import checkAbsenceRoutes from './CheckAbsenceRoutes'; // Ensure checkAbsenceRoutes is exported from CheckAbsenceRoutes
const router = Router();

// Use versioned routes
router.use('/users', userRoutes);
router.use('/roles', roleRoutes);
router.use('/organizations',verifyJWT, organizationRoutes); // This makes `/api/v1/organizations/*` available
router.use("/tickets",tickets); // This makes `/api/v1/tickets-type/*` available
//resources
router.use('/resources',verifyJWT,resourceRoutes );
router.use('/venue',verifyJWT,venueRoute,checkAbsenceRoutes); // This makes `/api/v1/venue/*` available
router.use('/event',verifyJWT,eventRoute);
// Event Booking routes
router.use('/event-bookings',verifyJWT, eventBookingRoutes); // This makes `/api/v1/event-bookings/*` available
//absence bookings in venue

export default router;
