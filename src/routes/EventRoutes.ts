import { Router } from "express";
import { EventController } from "../controller/eventController";
import { authenticate } from "../middlewares/AuthMiddleware";

const router = Router();


// 📂 Public Event Routes

router.use(authenticate);

router.get("/", EventController.getAllEvents);
router.get("/:id", EventController.getEventById);
router.post("/", EventController.createEvent);
router.patch("/:id/request-publish", EventController.requestPublish);


export default router;
