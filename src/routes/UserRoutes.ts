import { Router } from 'express';
import { UserController } from '../controller/UserController'; // Corrected import path
// import { authMiddleware } from '../middlewares/auth.middleware'; // Assuming auth middleware is correctly implemented

const router = Router();

// Public routes
router.post('/register', UserController.register); // Directly using static methods from UserController
router.post('/login', UserController.login);
router.post('/forgot-password', UserController.forgotPassword);
router.post('/reset-password', UserController.resetPassword);

// Protected routes
// router.use(authMiddleware);
router.get('/profile', UserController.getProfile);
router.put('/profile', UserController.updateProfile);
router.get('/', UserController.getAllUsers);
router.get('/:id', UserController.getUserById);
router.put('/:id', UserController.updateUser);
router.delete('/:id', UserController.deleteUser);

export const userRoutes = router;
