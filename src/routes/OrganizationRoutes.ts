// src/routes/organizationRoutes.ts
import { Router } from "express";
import { OrganizationController } from "../controller/OrganizationController";
import { authenticate } from "../middlewares/AuthMiddleware";
import upload from "../middlewares/upload";

const router = Router();

router.get("/all", authenticate, OrganizationController.getAll);
router.get(
  "/user/:userId",
  authenticate,
  OrganizationController.getOrganizationsByUserId
);
router.get("/:id", authenticate, OrganizationController.getById);
router.post(
  "/",
  authenticate,
  upload.single("supportingDocument"),
  OrganizationController.create
);
router.post("/bulk", authenticate, OrganizationController.bulkCreate);
router.put("/:id", authenticate, OrganizationController.update);
router.delete("/:id", authenticate, OrganizationController.delete);
router.post("/:id/users", authenticate, OrganizationController.assignUsers);
router.delete("/:id/users", authenticate, OrganizationController.removeUsers);
router.get("/:id/users", authenticate, OrganizationController.getUsers);

// Venue management routes
router.post(
  "/:organizationId/venues",
  authenticate,
  OrganizationController.addVenues
);
router.delete(
  "/:organizationId/venues",
  authenticate,
  OrganizationController.removeVenues
);
router.get(
  "/:organizationId/venues",
  authenticate,
  OrganizationController.getOrganizationVenues
);

router.patch("/:id/approve", authenticate, OrganizationController.approve);
router.patch("/:id/reject", authenticate, OrganizationController.reject);
export const organizationRoutes = router;
