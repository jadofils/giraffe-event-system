import { Router } from 'express';
import { authenticate } from '../middlewares/AuthMiddleware';
import { EventController } from '../controller/eventController';

const router = Router();

router.post('/', authenticate, EventController.create);
router.post('/bulk', authenticate, EventController.createMultiple);
router.get('/', EventController.getAll);
router.get('/:id', EventController.getById);
router.get('/organizer', authenticate, EventController.getByOrganizerId);
router.get('/', EventController.getByOrganizationId); // Query: ?organizationId=...
router.get('/', EventController.getByVenueId); // Query: ?venueId=...
router.get('/', EventController.getByStatus); // Query: ?status=...
router.get('/', EventController.getByDateRange); // Query: ?startDate=...&endDate=...
router.put('/:id', authenticate, EventController.update);
router.delete('/:id', authenticate, EventController.delete);
router.post('/:id/venues', authenticate, EventController.assignVenues);
router.delete('/:id/venues', authenticate, EventController.removeVenues);

export default router;