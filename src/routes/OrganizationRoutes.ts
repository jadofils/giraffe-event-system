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
// Update the POST / route to accept both 'supportingDocument' and 'logo' files
router.post(
  "/",
  authenticate,
  upload.fields([
    { name: "supportingDocument", maxCount: 1 },
    { name: "logo", maxCount: 1 },
  ]),
  OrganizationController.create
);
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
// Add PATCH /organizations/:id/logo for updating only the logo
router.patch(
  "/:id/logo",
  authenticate,
  upload.single("logo"),
  OrganizationController.updateLogo
);
// Add PATCH /organizations/:id/supporting-document for updating only the supporting document
router.patch(
  "/:id/supporting-document",
  authenticate,
  upload.single("supportingDocument"),
  OrganizationController.updateSupportingDocument
);

router.patch(
  "/:id/enable-status",
  authenticate,
  OrganizationController.enableStatus
);
router.patch(
  "/:id/disable-status",
  authenticate,
  OrganizationController.disableStatus
);
export const organizationRoutes = router;
