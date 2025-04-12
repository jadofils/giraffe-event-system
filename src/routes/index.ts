import { Router } from 'express';
import { userRoutes } from './UserRoutes';
import roleRoutes from "./RoleRoutes"
import organizationRoutes from './OrganizationRoutes';

const router = Router();

// API Routes for each path
router.use('/users', userRoutes);
router.use('/roles', roleRoutes);
//routes fro organizations
router.use('/organizations', organizationRoutes);

export default router;
