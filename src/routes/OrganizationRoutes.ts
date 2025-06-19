// src/routes/organizationRoutes.ts
import { Router } from "express";
import { authenticate } from "../middlewares/AuthMiddleware";
import { OrganizationController } from "../controller/OrganizationController";

const router = Router();

router.get("/", authenticate, OrganizationController.getAll);
router.get("/:id", authenticate, OrganizationController.getById);
router.post("/bulk", authenticate, OrganizationController.bulkCreate);
router.put("/:id", authenticate, OrganizationController.update);
router.delete("/:id", authenticate, OrganizationController.delete);
router.post("/:id/users", authenticate, OrganizationController.assignUsers);
router.delete("/:id/users", authenticate, OrganizationController.removeUsers);
router.get("/:id/users", authenticate, OrganizationController.getUsers);

export const organizationRoutes = router;