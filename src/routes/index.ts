import { Router } from 'express';
import { userRoutes } from './UserRoutes';

const router = Router();

// API Routes for each path
router.use('/users', userRoutes);


export default router;
