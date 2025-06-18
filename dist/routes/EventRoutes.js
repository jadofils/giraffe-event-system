"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const AuthMiddleware_1 = require("../middlewares/AuthMiddleware");
const eventController_1 = require("../controller/eventController");
const router = (0, express_1.Router)();
router.post('/', AuthMiddleware_1.authenticate, eventController_1.EventController.create);
router.post('/bulk', AuthMiddleware_1.authenticate, eventController_1.EventController.createMultiple);
router.get('/', eventController_1.EventController.getAll);
router.get('/:id', eventController_1.EventController.getById);
router.get('/organizer', AuthMiddleware_1.authenticate, eventController_1.EventController.getByOrganizerId);
router.get('/', eventController_1.EventController.getByOrganizationId); // Query: ?organizationId=...
router.get('/', eventController_1.EventController.getByVenueId); // Query: ?venueId=...
router.get('/', eventController_1.EventController.getByStatus); // Query: ?status=...
router.get('/', eventController_1.EventController.getByDateRange); // Query: ?startDate=...&endDate=...
router.put('/:id', AuthMiddleware_1.authenticate, eventController_1.EventController.update);
router.delete('/:id', AuthMiddleware_1.authenticate, eventController_1.EventController.delete);
router.post('/:id/venues', AuthMiddleware_1.authenticate, eventController_1.EventController.assignVenues);
router.delete('/:id/venues', AuthMiddleware_1.authenticate, eventController_1.EventController.removeVenues);
exports.default = router;
