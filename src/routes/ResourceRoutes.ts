// @ts-nocheck

import express from "express";
import { ResourceController } from "../controller/ResourceController"; // Adjust the path if needed
import { authenticate } from "../middlewares/AuthMiddleware";

const router = express.Router(authenticate);

// Define the routes for the ResourceController
router.post("/create-resource", ResourceController.createResource); // Create a new resource
router.get("/find-all", ResourceController.getAllResources); // Get all resources
router.get("/find-one/:id", ResourceController.getResourceById); // Get a resource by ID
router.put("/update-resource/:id", ResourceController.updateResource); // Update a resource
router.delete("/delete-resource/:id", ResourceController.deleteResource); // Delete a resource
router.post( "/bulk-assign-to-event",ResourceController.bulkAssignResourcesToEvent); // Bulk assign resources to an event

export default router;
