import { Router } from "express";
import { VenueController } from "../controller/venueController";
import { isAdmin } from "../middlewares/IsAdmin";

const router = Router();

router.get("/all",VenueController.getAll);
router.get("/get/:id",VenueController.getById);
router.get("/get",VenueController.getByManagerId);
router.post("/add",VenueController.create);
router.put("/update/:id",VenueController.update);
router.put("/updateVenueManager/:id",isAdmin,VenueController.updateVenueManager);
router.delete("/remove/:id",VenueController.delete);

export const venueRoute = router;
