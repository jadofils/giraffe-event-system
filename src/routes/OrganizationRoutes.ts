import { Router } from 'express';
import { OrganizationController } from '../controller/OrganizationController';

const router = Router();

// Get all organizations
router.get('/all', OrganizationController.getAll);

// Get an organization by ID
router.get('/:id', OrganizationController.getById);

// Create a new organization
router.post('/add', OrganizationController.create);

// Update an existing organization
router.put('/:id', OrganizationController.update);

// Delete an organization
router.delete('/:id', OrganizationController.delete);

export default router;
