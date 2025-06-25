import { Request, Response } from "express";
import cloudinary from "../config/cloudinary";
import streamifier from "streamifier";

import { VenueInterface } from "../interfaces/VenueInterface";
import { EventRepository } from "../repositories/eventRepository";
import { VenueRepository } from "../repositories/venueRepository";
import { VenueResourceRepository } from "../repositories/VenueResourceRepository";
import { Venue, VenueStatus } from "../models/Venue";
import { AuthenticatedRequest } from "../middlewares/AuthMiddleware";
import { AppDataSource } from "../config/Database";
import { Resource } from "../models/Resources";
import { VenueResource } from "../models/VenueResource";
import { OrganizationRepository } from "../repositories/OrganizationRepository";
import { EventType } from "../interfaces/Enums/EventTypeEnum";

export class VenueController {
  // Create a single venue or multiple venues
  /**
   * Handles the creation of one or more venues,
   * including associated resources and assignment to an organization.
   *
   * Supports both single venue object and array of venue objects in the request body.
   *
   * @param req The Express request object, expected to be AuthenticatedRequest.
   * @param res The Express response object.
   * @returns A JSON response indicating success or failure of venue creation and assignment.
   */
  public static readonly UUID_REGEX =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  static async create(req: Request, res: Response): Promise<void> {
    const authenticatedReq = req as AuthenticatedRequest;
    const userId = authenticatedReq.user?.userId;
    const organizationIdFromUser = authenticatedReq.user?.organizationId; // Organization ID from authenticated user token

    // Determine user's role for status assignment (admin = APPROVED, others = PENDING)
    let userRole: string | undefined = undefined;
    if (
      authenticatedReq.user?.role &&
      typeof authenticatedReq.user.role === "object" &&
      authenticatedReq.user.role.roleName
    ) {
      userRole = String(authenticatedReq.user.role.roleName).toLowerCase();
    } else if (typeof authenticatedReq.user?.role === "string") {
      userRole = (authenticatedReq.user.role as string).toLowerCase();
    }

    const body = authenticatedReq.body;
    const files = (req as any).files || {};

    // Handle image uploads (mainPhoto and subPhotos)
    let mainPhotoUrl: string | undefined = undefined;
    let subPhotoUrls: string[] = [];

    // Helper to upload a buffer to Cloudinary
    const uploadToCloudinary = (file: Express.Multer.File): Promise<string> => {
      return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          { folder: "venues" },
          (error, result) => {
            if (error) return reject(error);
            if (!result) return reject(new Error("No result from Cloudinary"));
            resolve(result.secure_url);
          }
        );
        streamifier.createReadStream(file.buffer).pipe(uploadStream);
      });
    };

    if (files.mainPhoto && files.mainPhoto[0]) {
      try {
        mainPhotoUrl = await uploadToCloudinary(files.mainPhoto[0]);
      } catch (err) {
        res.status(500).json({
          success: false,
          message: "Failed to upload main photo",
          error: err,
        });
        return;
      }
    }
    if (files.subPhotos && Array.isArray(files.subPhotos)) {
      for (const file of files.subPhotos) {
        try {
          const url = await uploadToCloudinary(file);
          subPhotoUrls.push(url);
        } catch (err) {
          res.status(500).json({
            success: false,
            message: "Failed to upload sub photo",
            error: err,
          });
          return;
        }
      }
    }

    // Check for authenticated user ID
    if (!userId) {
      res
        .status(401)
        .json({ success: false, message: "Authentication required." });
      return;
    }

    // Get TypeORM repositories for interacting with the database
    const resourceRepository = AppDataSource.getRepository(Resource);
    const venueResourceRepository = AppDataSource.getRepository(VenueResource);
    const venueRepository = AppDataSource.getRepository(Venue); // Direct access to Venue entity repository

    /**
     * Helper function to process and associate resources with a newly created venue.
     * It handles both existing resources (by ID) and new resources (by full details).
     * @param venue The Venue entity to associate resources with.
     * @param resourcesData An array of resource objects from the request body.
     */
    const processAndAssociateResources = async (
      venue: Venue,
      resourcesData: any[] | undefined
    ) => {
      if (resourcesData && resourcesData.length > 0) {
        for (const resData of resourcesData) {
          let resource: Resource | null = null;
          // Check if resourceId is provided in the request data (meaning it's an existing resource)
          if (resData.resourceId) {
            if (!OrganizationRepository.UUID_REGEX.test(resData.resourceId)) {
              console.warn(
                `Invalid resourceId format for existing resource: ${resData.resourceId}. Skipping association.`
              );
              continue;
            }
            resource = await resourceRepository.findOne({
              where: { resourceId: resData.resourceId },
            });
            if (!resource) {
              console.warn(
                `Resource with ID ${resData.resourceId} not found for venue ${venue.venueId}. Skipping association.`
              );
              continue; // Skip this resource if it doesn't exist
            }
          } else if (
            resData.resourceName &&
            resData.description &&
            typeof resData.costPerUnit === "number" &&
            resData.costPerUnit > 0
          ) {
            // If resourceId is not provided, attempt to create a new resource
            const newResource = new Resource();
            newResource.resourceName = resData.resourceName;
            newResource.description = resData.description;
            newResource.costPerUnit = resData.costPerUnit;
            try {
              resource = await resourceRepository.save(newResource); // Save the new resource to get its ID
              console.log(`Created new resource: ${newResource.resourceName}`);
            } catch (error: any) {
              console.error(
                `Failed to create new resource '${resData.resourceName}' for venue ${venue.venueId}:`,
                error.message
              );
              continue; // Skip association if new resource creation fails
            }
          } else {
            console.warn(
              "Invalid resource data provided. Requires 'resourceId' OR 'resourceName', 'description', 'costPerUnit' (positive number). Skipping.",
              resData
            );
            continue; // Skip if resource data is malformed
          }

          // If a valid resource (existing or newly created) is found, proceed to associate it with the venue
          if (
            resource &&
            typeof resData.quantity === "number" &&
            resData.quantity > 0
          ) {
            const venueResource = new VenueResource();
            venueResource.venue = venue; // Link to the venue
            venueResource.resource = resource; // Link to the resource
            venueResource.quantity = resData.quantity; // Set the quantity of this resource for the venue
            try {
              await venueResourceRepository.save(venueResource); // Save the VenueResource association
              console.log(
                `Associated ${resData.quantity} units of resource '${resource.resourceName}' with venue '${venue.venueName}'.`
              );
            } catch (error: any) {
              console.error(
                `Failed to associate resource '${resource.resourceName}' with venue '${venue.venueName}':`,
                error.message
              );
            }
          } else if (resource) {
            console.warn(
              `Invalid quantity for resource '${resource.resourceName}': ${resData.quantity}. Quantity must be a positive number. Skipping association.`
            );
          }
        }
      }
    };

    // --- Handle Single Venue Creation (if request body is an object) ---
    const {
      venueName,
      capacity,
      location,
      amount,
      latitude,
      longitude,
      googleMapsLink,
      organizationId, // Extract organizationId directly from the body
      resources, // Extract resources array directly from the body
      amenities,
      venueType,
      contactPerson,
      contactEmail,
      contactPhone,
      websiteURL,
    }: Partial<VenueInterface> & { resources?: any[] } = body; // Augment type to acknowledge 'resources' property

    // Determine and validate target organization ID
    let targetOrganizationId: string | undefined = undefined;
    if (organizationId) {
      // Validate organizationId if provided in the request body
      if (!OrganizationRepository.UUID_REGEX.test(organizationId)) {
        res.status(400).json({
          success: false,
          message: "Invalid organization ID (UUID) provided.",
        });
        return;
      }
      targetOrganizationId = organizationId;
    } else if (organizationIdFromUser) {
      // Fallback to organizationId from the authenticated user's token
      targetOrganizationId = organizationIdFromUser;
    } else {
      // If no organizationId is provided in body or from user, return an error
      res.status(400).json({
        success: false,
        message:
          "Organization ID is required for venue creation and assignment.",
      });
      return;
    }

    // Basic validation for essential venue fields (delegated to VenueRepository.create)
    // This initial check here is redundant if VenueRepository.create handles it, but good for early exit.
    if (!venueName || !capacity || !location || !amount) {
      res.status(400).json({
        success: false,
        message: "Required fields: venueName, capacity, location, amount.",
      });
      return;
    }

    try {
      // Prepare data for the new venue
      const newVenueData: Partial<VenueInterface> = {
        venueName,
        capacity,
        location,
        amount,
        managerId: userId,
        latitude,
        longitude,
        googleMapsLink,
        organizationId: targetOrganizationId, // Use the validated/determined organizationId
        status:
          userRole === "admin" ? VenueStatus.APPROVED : VenueStatus.PENDING,
        amenities,
        venueType,
        contactPerson,
        contactEmail,
        contactPhone,
        websiteURL,
        mainPhotoUrl,
        subPhotoUrls,
      };

      // Use the static VenueRepository.create method to create a Venue object instance
      const createResult = VenueRepository.create(newVenueData);
      if (!createResult.success || !createResult.data) {
        res.status(400).json({ success: false, message: createResult.message });
        return;
      }

      // Save the Venue entity to the database to get its primary key (venueId)
      const savedVenueResult = await VenueRepository.save(createResult.data);
      if (!savedVenueResult.success || !savedVenueResult.data) {
        res.status(400).json({
          success: false,
          message:
            savedVenueResult.message || "Failed to save venue to database.",
        });
        return;
      }
      const savedVenue = savedVenueResult.data;
      console.log(
        `Successfully created venue: ${savedVenue.venueName} (ID: ${savedVenue.venueId})`
      );

      // Process and associate resources for the newly created venue
      await processAndAssociateResources(savedVenue, resources);

      let assignmentMessage: string = "Venue created successfully.";
      let assignmentSuccess: boolean = true;

      // Assign the newly created venue to the organization using the repository method
      if (targetOrganizationId && savedVenue.venueId) {
        const assignResult =
          await OrganizationRepository.addVenuesToOrganization(
            targetOrganizationId,
            [savedVenue.venueId]
          );
        if (!assignResult.success) {
          console.error(
            `Failed to assign venue '${savedVenue.venueName}' (ID: ${savedVenue.venueId}) to organization '${targetOrganizationId}': ${assignResult.message}`
          );
          assignmentMessage = `Venue created, but failed to assign to organization: ${assignResult.message}`;
          assignmentSuccess = false;
        } else {
          console.log(
            `Successfully assigned venue '${savedVenue.venueName}' to organization '${targetOrganizationId}'.`
          );
        }
      } else {
        assignmentMessage =
          "Venue created, but assignment to organization skipped due to missing organization ID or venue ID.";
        assignmentSuccess = false;
      }

      // Fetch the complete venue object with all its relations (manager, organization, and newly added resources)
      const venueWithRelations = await venueRepository.findOne({
        where: { venueId: savedVenue.venueId },
        relations: ["manager", "organization", "resources"], // Eager load all related entities
      });

      res.status(201).json({
        success: assignmentSuccess, // Reflect overall success, or partial success with warning
        message: assignmentMessage,
        data: venueWithRelations,
      });
    } catch (err: any) {
      console.error("Error creating venue:", err.message);
      res.status(500).json({
        success: false,
        message: "Failed to create venue due to a server error.",
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }

  // Get venue by ID
  static async getById(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    if (!id) {
      res
        .status(400)
        .json({ success: false, message: "Venue ID is required." });
      return;
    }

    try {
      const result = await VenueRepository.getById(id);
      if (result.success && result.data) {
        res.status(200).json({ success: true, data: result.data });
      } else {
        res.status(404).json({
          success: false,
          message: result.message || "Venue not found.",
        });
      }
    } catch (err) {
      console.error("Error getting venue by ID:", err);
      res
        .status(500)
        .json({ success: false, message: "Failed to get venue by ID." });
    }
  }

  // Get venues by manager ID
  static async getByManagerId(req: Request, res: Response): Promise<void> {
    const userId = req.user?.userId;
    if (!userId) {
      res
        .status(401)
        .json({ success: false, message: "Authentication required." });
      return;
    }

    try {
      const result = await VenueRepository.getByManagerId(userId);
      if (result.success && result.data) {
        res.status(200).json({ success: true, data: result.data });
      } else {
        res.status(404).json({
          success: false,
          message: result.message || "No venues found for this manager.",
        });
      }
    } catch (err) {
      console.error("Error getting venues by manager ID:", err);
      res.status(500).json({
        success: false,
        message: "Failed to get venues by manager ID.",
      });
    }
  }

  // Get all venues
  static async getAll(req: Request, res: Response): Promise<void> {
    try {
      const result = await VenueRepository.getAll();
      if (result.success && result.data) {
        res.status(200).json({ success: true, data: result.data });
      } else {
        res.status(200).json({
          success: false,
          message: result.message || "No venues found.",
        });
      }
    } catch (err) {
      console.error("Error getting all venues:", err);
      res
        .status(500)
        .json({ success: false, message: "Failed to get all venues." });
    }
  }

  static async update(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const userId = req.user?.userId;
    const {
      venueName,
      capacity,
      location,
      amount,
      managerId,
      latitude,
      longitude,
      googleMapsLink,
      amenities,
      venueType,
      contactPerson,
      contactEmail,
      contactPhone,
      websiteURL,
      status,
    }: Partial<VenueInterface> = req.body;

    if (!id) {
      res
        .status(400)
        .json({ success: false, message: "Venue ID is required." });
      return;
    }

    if (!userId) {
      res
        .status(401)
        .json({ success: false, message: "Authentication required." });
      return;
    }

    // Log request body for debugging
    console.log("Update request body:", req.body);

    // Construct update data, omitting undefined fields
    const updateData: Partial<VenueInterface> = {};
    if (venueName !== undefined) updateData.venueName = venueName;
    if (capacity !== undefined) updateData.capacity = capacity;
    if (location !== undefined) updateData.location = location;
    if (amount !== undefined) updateData.amount = amount;
    if (managerId !== undefined) updateData.managerId = managerId;
    if (latitude !== undefined) updateData.latitude = latitude;
    if (longitude !== undefined) updateData.longitude = longitude;
    if (googleMapsLink !== undefined)
      updateData.googleMapsLink = googleMapsLink;
    if (amenities !== undefined) updateData.amenities = amenities;
    if (venueType !== undefined) updateData.venueType = venueType;
    if (contactPerson !== undefined) updateData.contactPerson = contactPerson;
    if (contactEmail !== undefined) updateData.contactEmail = contactEmail;
    if (contactPhone !== undefined) updateData.contactPhone = contactPhone;
    if (websiteURL !== undefined) updateData.websiteURL = websiteURL;
    if (status !== undefined) updateData.status = status;

    // Validate update data
    const validationErrors = VenueInterface.validate(updateData);
    if (validationErrors.length > 0) {
      res.status(400).json({
        success: false,
        message: `Validation errors: ${validationErrors.join(", ")}`,
      });
      return;
    }

    try {
      const updateResult = await VenueRepository.update(id, updateData);
      if (updateResult.success && updateResult.data) {
        res.status(200).json({
          success: true,
          message: "Venue updated successfully.",
          data: updateResult.data,
        });
      } else {
        res.status(404).json({
          success: false,
          message: updateResult.message || "Venue not found.",
        });
      }
    } catch (err) {
      console.error("Error updating venue:", err);
      res.status(500).json({
        success: false,
        message: "Failed to update venue due to a server error.",
      });
    }
  }
  // Update venue manager
  static async updateVenueManager(req: Request, res: Response): Promise<void> {
    const userId = req.user?.userId;
    const { venueId, managerId } = req.body;

    if (!userId) {
      res
        .status(401)
        .json({ success: false, message: "Authentication required." });
      return;
    }

    if (!venueId || !managerId) {
      res.status(400).json({
        success: false,
        message: "Venue ID and manager ID are required.",
      });
      return;
    }

    try {
      const result = await VenueRepository.updateVenueManager(
        venueId,
        managerId
      );
      if (result.success && result.data) {
        res.status(200).json({
          success: true,
          message: "Venue manager updated successfully.",
          data: result.data,
        });
      } else {
        res.status(400).json({
          success: false,
          message: result.message || "Failed to update venue manager.",
        });
      }
    } catch (err) {
      console.error("Error updating venue manager:", err);
      res.status(500).json({
        success: false,
        message: "Failed to update venue manager due to a server error.",
      });
    }
  }

  // Remove venue manager
  static async removeVenueManager(req: Request, res: Response): Promise<void> {
    const userId = req.user?.userId;
    const { venueId } = req.params;

    if (!userId) {
      res
        .status(401)
        .json({ success: false, message: "Authentication required." });
      return;
    }

    if (!venueId) {
      res
        .status(400)
        .json({ success: false, message: "Venue ID is required." });
      return;
    }

    try {
      const result = await VenueRepository.removeVenueManager(venueId);
      if (result.success && result.data) {
        res.status(200).json({
          success: true,
          message: "Venue manager removed successfully.",
          data: result.data,
        });
      } else {
        res.status(400).json({
          success: false,
          message: result.message || "Failed to remove venue manager.",
        });
      }
    } catch (err) {
      console.error("Error removing venue manager:", err);
      res.status(500).json({
        success: false,
        message: "Failed to remove venue manager due to a server error.",
      });
    }
  }

  // Delete venue (soft delete)
  static async delete(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const userId = req.user?.userId;

    if (!id) {
      res
        .status(400)
        .json({ success: false, message: "Venue ID is required." });
      return;
    }

    if (!userId) {
      res
        .status(401)
        .json({ success: false, message: "Authentication required." });
      return;
    }

    try {
      const deleteResult = await VenueRepository.delete(id);
      if (deleteResult.success) {
        res.status(200).json({
          success: true,
          message: deleteResult.message || "Venue deleted successfully.",
        });
      } else {
        res.status(404).json({
          success: false,
          message: deleteResult.message || "Venue not found.",
        });
      }
    } catch (err) {
      console.error("Error deleting venue:", err);
      res
        .status(500)
        .json({ success: false, message: "Failed to delete venue." });
    }
  }

  // Restore soft-deleted venue
  static async restore(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const userId = req.user?.userId;

    if (!id) {
      res
        .status(400)
        .json({ success: false, message: "Venue ID is required." });
      return;
    }

    if (!userId) {
      res
        .status(401)
        .json({ success: false, message: "Authentication required." });
      return;
    }

    try {
      const restoreResult = await VenueRepository.restore(id);
      if (restoreResult.success && restoreResult.data) {
        res.status(200).json({
          success: true,
          message: "Venue restored successfully.",
          data: restoreResult.data,
        });
      } else {
        res.status(404).json({
          success: false,
          message: restoreResult.message || "Venue not found or not deleted.",
        });
      }
    } catch (err) {
      console.error("Error restoring venue:", err);
      res
        .status(500)
        .json({ success: false, message: "Failed to restore venue." });
    }
  }

  // Get soft-deleted venues
  static async getDeleted(req: Request, res: Response): Promise<void> {
    const userId = req.user?.userId;

    if (!userId) {
      res
        .status(401)
        .json({ success: false, message: "Authentication required." });
      return;
    }

    try {
      const result = await VenueRepository.getDeleted();
      if (result.success && result.data) {
        res.status(200).json({ success: true, data: result.data });
      } else {
        res.status(200).json({
          success: false,
          message: result.message || "No deleted venues found.",
        });
      }
    } catch (err) {
      console.error("Error getting deleted venues:", err);
      res
        .status(500)
        .json({ success: false, message: "Failed to get deleted venues." });
    }
  }

  // Check venue event conflicts
  static async checkVenueEventConflicts(
    req: Request,
    res: Response
  ): Promise<void> {
    const { venueId, startDate, endDate, startTime, endTime } = req.query;

    if (
      !venueId ||
      !startDate ||
      !endDate ||
      typeof venueId !== "string" ||
      typeof startDate !== "string" ||
      typeof endDate !== "string"
    ) {
      res.status(400).json({
        success: false,
        message: "Venue ID, startDate, and endDate are required.",
      });
      return;
    }

    try {
      const start = new Date(startDate);
      const end = new Date(endDate);
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        res
          .status(400)
          .json({ success: false, message: "Invalid date format." });
        return;
      }

      const venueResult = await VenueRepository.getById(venueId);
      if (!venueResult.success || !venueResult.data) {
        res.status(404).json({ success: false, message: "Venue not found." });
        return;
      }

      // Combine date and time for precise overlap check
      const startDateTime = startTime
        ? new Date(`${startDate}T${startTime}:00Z`)
        : start;
      const endDateTime = endTime ? new Date(`${endDate}T${endTime}:00Z`) : end;

      const eventsResult = await EventRepository.getByVenueId(venueId);
      if (eventsResult.success && eventsResult.data) {
        const conflictingEvents = eventsResult.data.filter((event) => {
          const eventStart = event.startTime
            ? new Date(
                `${event.startDate.toISOString().split("T")[0]}T${
                  event.startTime
                }:00Z`
              )
            : event.startDate;
          const eventEnd = event.endTime
            ? new Date(
                `${event.endDate.toISOString().split("T")[0]}T${
                  event.endTime
                }:00Z`
              )
            : event.endDate;

          return (
            eventStart <= endDateTime &&
            eventEnd >= startDateTime &&
            event.status !== "CANCELLED"
          );
        });

        if (conflictingEvents.length > 0) {
          res.status(200).json({
            success: true,
            available: false,
            message: "Venue is booked for the requested period.",
            conflicts: conflictingEvents.map((e) => ({
              eventId: e.eventId,
              eventTitle: e.eventTitle,
            })),
          });
          return;
        }
      }

      res.status(200).json({
        success: true,
        available: true,
        message: "Venue is available for the requested period.",
      });
    } catch (err) {
      console.error("Error checking venue event conflicts:", err);
      res.status(500).json({
        success: false,
        message: "Failed to check venue event conflicts.",
      });
    }
  }

  // Search venues
  static async searchVenues(req: Request, res: Response): Promise<void> {
    const {
      name,
      location,
      minCapacity,
      maxCapacity,
      isAvailable,
      hasManager,
    } = req.query;

    const criteria: {
      name?: string;
      location?: string;
      minCapacity?: number;
      maxCapacity?: number;
      isAvailable?: boolean;
      hasManager?: boolean;
    } = {};

    if (name && typeof name === "string") criteria.name = name;
    if (location && typeof location === "string") criteria.location = location;
    if (minCapacity && !isNaN(Number(minCapacity)))
      criteria.minCapacity = Number(minCapacity);
    if (maxCapacity && !isNaN(Number(maxCapacity)))
      criteria.maxCapacity = Number(maxCapacity);
    if (
      isAvailable !== undefined &&
      (isAvailable === "true" || isAvailable === "false")
    )
      criteria.isAvailable = isAvailable === "true";
    if (
      hasManager !== undefined &&
      (hasManager === "true" || hasManager === "false")
    )
      criteria.hasManager = hasManager === "true";

    try {
      const result = await VenueRepository.searchVenues(criteria);
      if (result.success && result.data) {
        res.status(200).json({ success: true, data: result.data });
      } else {
        res.status(200).json({
          success: false,
          message: result.message || "No venues found.",
        });
      }
    } catch (err) {
      console.error("Error searching venues:", err);
      res
        .status(500)
        .json({ success: false, message: "Failed to search venues." });
    }
  }

  // Get venue count
  static async getVenueCount(req: Request, res: Response): Promise<void> {
    try {
      const result = await VenueRepository.getVenueCount();
      if (result.success && result.count !== undefined) {
        res.status(200).json({ success: true, count: result.count });
      } else {
        res.status(200).json({
          success: false,
          message: result.message || "Failed to get venue count.",
        });
      }
    } catch (err) {
      console.error("Error getting venue count:", err);
      res
        .status(500)
        .json({ success: false, message: "Failed to get venue count." });
    }
  }

  // Get venues by proximity
  static async getVenuesByProximity(
    req: Request,
    res: Response
  ): Promise<void> {
    const { latitude, longitude, radius } = req.query;

    if (
      !latitude ||
      !longitude ||
      !radius ||
      typeof latitude !== "string" ||
      typeof longitude !== "string" ||
      typeof radius !== "string"
    ) {
      res.status(400).json({
        success: false,
        message: "Latitude, longitude, and radius are required.",
      });
      return;
    }

    try {
      const lat = parseFloat(latitude);
      const lon = parseFloat(longitude);
      const rad = parseFloat(radius);

      if (isNaN(lat) || isNaN(lon) || isNaN(rad)) {
        res.status(400).json({
          success: false,
          message: "Invalid latitude, longitude, or radius format.",
        });
        return;
      }

      const result = await VenueRepository.getVenuesByProximity(lat, lon, rad);
      if (result.success && result.data) {
        res.status(200).json({ success: true, data: result.data });
      } else {
        res.status(200).json({
          success: false,
          message: result.message || "No venues found within radius.",
        });
      }
    } catch (err) {
      console.error("Error getting venues by proximity:", err);
      res.status(500).json({
        success: false,
        message: "Failed to get venues by proximity.",
      });
    }
  }

  // Assign a user as manager to a venue (simple version)
  static async assignManagerToVenue(
    req: Request,
    res: Response
  ): Promise<void> {
    const { venueId, userId } = req.body;

    if (!venueId || !userId) {
      res
        .status(400)
        .json({ success: false, message: "venueId and userId are required." });
      return;
    }

    try {
      // Find the venue
      const venueResult = await VenueRepository.getById(venueId);
      if (!venueResult.success || !venueResult.data) {
        res.status(404).json({ success: false, message: "Venue not found." });
        return;
      }
      // Find the user
      const userRepo = require("../models/User");
      const { AppDataSource } = require("../config/Database");
      const user = await AppDataSource.getRepository(userRepo.User).findOne({
        where: { userId },
      });
      if (!user) {
        res.status(404).json({ success: false, message: "User not found." });
        return;
      }
      // Assign user as manager
      venueResult.data.managerId = userId;
      venueResult.data.manager = user;
      const saveResult = await VenueRepository.save(venueResult.data);
      if (saveResult.success && saveResult.data) {
        res.status(200).json({
          success: true,
          message: "User assigned as venue manager successfully.",
          data: saveResult.data,
        });
      } else {
        res.status(500).json({
          success: false,
          message: saveResult.message || "Failed to assign manager.",
        });
      }
    } catch (err) {
      console.error("Error assigning manager to venue:", err);
      res.status(500).json({
        success: false,
        message: "Failed to assign manager due to a server error.",
      });
    }
  }

  // Get resources for a venue by ID
  static async getResourcesByVenueId(
    req: Request,
    res: Response
  ): Promise<void> {
    const { id } = req.params;
    if (!id) {
      res
        .status(400)
        .json({ success: false, message: "Venue ID is required." });
      return;
    }
    try {
      const result = await VenueRepository.getResourcesByVenueId(id);
      if (result.success) {
        res.status(200).json({ success: true, data: result.data });
      } else {
        res.status(404).json({
          success: false,
          message: result.message || "No resources found for this venue.",
        });
      }
    } catch (err) {
      console.error("Error getting resources for venue:", err);
      res.status(500).json({
        success: false,
        message: "Failed to get resources for venue.",
      });
    }
  }

  // Add resources to a venue (bulk)
  static async addResourcesToVenue(req: Request, res: Response): Promise<void> {
    const { resources } = req.body;
    const { venueId } = req.params;
    if (!venueId || !Array.isArray(resources) || resources.length === 0) {
      res.status(400).json({
        success: false,
        message: "venueId and a non-empty resources array are required",
      });
      return;
    }
    try {
      const created = await VenueResourceRepository.addResourcesToVenue(
        venueId,
        resources
      );
      res.status(201).json({ success: true, data: created });
    } catch (error) {
      res
        .status(500)
        .json({ success: false, message: "Failed to add resources to venue" });
    }
  }

  // Remove a resource from a venue
  static async removeResourceFromVenue(
    req: Request,
    res: Response
  ): Promise<void> {
    const { venueId, resourceId } = req.params;
    if (!venueId || !resourceId) {
      res.status(400).json({
        success: false,
        message: "venueId and resourceId are required",
      });
      return;
    }
    try {
      const removed = await VenueResourceRepository.removeResourceFromVenue(
        venueId,
        resourceId
      );
      if (removed) {
        res
          .status(200)
          .json({ success: true, message: "Resource removed from venue" });
      } else {
        res.status(404).json({
          success: false,
          message: "Resource not found for this venue",
        });
      }
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Failed to remove resource from venue",
      });
    }
  }

  // Get all resources assigned to a venue
  static async getVenueResources(req: Request, res: Response): Promise<void> {
    const { venueId } = req.params;
    if (!venueId) {
      res.status(400).json({ success: false, message: "venueId is required" });
      return;
    }
    try {
      const resources = await VenueResourceRepository.getResourcesByVenueId(
        venueId
      );
      res.status(200).json({ success: true, data: resources });
    } catch (error) {
      res
        .status(500)
        .json({ success: false, message: "Failed to get resources for venue" });
    }
  }

  /**
 * GET /api/v1/venues/check-availability
 * Query params:
 *   - startDate
 *   - endDate
 *   - startTime
 *   - endTime
 *   - bufferMinutes (optional, default = 30)
 */
static async checkAvailability(req: Request, res: Response): Promise<void> {
  try {
    const {
      startDate,
      endDate,
      startTime,
      endTime,
      bufferMinutes = "30"
    } = req.query;

    // Validate required parameters
    if (!startDate || !endDate || !startTime || !endTime) {
      res.status(400).json({
        success: false,
        message:
          "Missing required query parameters: startDate, endDate, startTime, or endTime"
      });
      return;
    }

    const result = await VenueRepository.findFullyAvailableVenues(
      new Date(startDate as string),
      new Date(endDate as string),
      startTime as string,
      endTime as string,
      parseInt(bufferMinutes as string, 10)
    );

    if (result.success) {
      res.status(200).json({
        success: true,
        data: result.data,
        message: `${
          result.data?.length || 0
        } venue(s) fully available for the requested time range.`
      });
    } else {
      res.status(400).json({
        success: false,
        message:
          result.message ||
          "No venues available for the requested time range."
      });
    }
  } catch (error) {
    console.error("Controller error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while checking venue availability.",
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

 
 
  static async approveVenue(req: Request, res: Response): Promise<void> {
    const user = (req as any).user;
    if (
      !user ||
      !user.role ||
      String(user.role.roleName || user.role).toLowerCase() !== "admin"
    ) {
      res
        .status(403)
        .json({ success: false, message: "Only admin can approve venues." });
      return;
    }
    const { id } = req.params;
    const result = await VenueRepository.update(id, {
      status: VenueStatus.APPROVED,
    });
    if (result.success && result.data) {
      res.json({
        success: true,
        message: "Venue approved.",
        data: result.data,
      });
    } else {
      res.status(400).json({ success: false, message: result.message });
    }
  }

  /**
   * Retrieves all approved venues.
   * @param req The Express request object.
   * @param res The Express response object.
   */
  static async listApprovedVenues(req: Request, res: Response): Promise<void> {
    try {
      const result = await VenueRepository.getApprovedVenues();

      if (result.success) {
        res.status(200).json(result);
      } else {
        res.status(500).json({
          success: false,
          message: result.message || "Failed to retrieve approved venues",
        });
      }
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message:
          "An unexpected error occurred while retrieving approved venues.",
        error: error?.message || error,
      });
    }
  }

  static async cancelVenue(req: Request, res: Response): Promise<void> {
    const user = (req as any).user;
    if (
      !user ||
      !user.role ||
      String(user.role.roleName || user.role).toLowerCase() !== "admin"
    ) {
      res
        .status(403)
        .json({ success: false, message: "Only admin can cancel venues." });
      return;
    }
    const { id } = req.params;
    const { feedback } = req.body;
    if (!feedback) {
      res.status(400).json({
        success: false,
        message: "Feedback is required for cancellation.",
      });
      return;
    }
    const result = await VenueRepository.update(id, {
      status: VenueStatus.CANCELLED,
      cancellationReason: feedback,
    });
    if (result.success && result.data) {
      res.json({
        success: true,
        message: "Venue cancelled.",
        data: result.data,
      });
    } else {
      res.status(400).json({ success: false, message: result.message });
    }
  }

  static async getEventsByVenue(req: Request, res: Response): Promise<void> {
    const { venueId } = req.params;
    if (!venueId) {
      res.status(400).json({ success: false, message: "venueId is required" });
      return;
    }
    try {
      const result = await EventRepository.getByVenueId(venueId);
      if (result.success && result.data) {
        res.status(200).json({ success: true, data: result.data });
      } else {
        res.status(404).json({
          success: false,
          message: result.message || "No events found for this venue.",
        });
      }
    } catch (error) {
      res
        .status(500)
        .json({ success: false, message: "Failed to get events for venue." });
    }
  }

  static async listPublicApprovedEvents(
    req: Request,
    res: Response
  ): Promise<void> {
    const result = await EventRepository.getPublicApprovedEvents();
    if (result.success && result.data) {
      res.status(200).json({ success: true, data: result.data });
    } else {
      res.status(500).json({ success: false, message: result.message });
    }
  }

  static async listEventTypes(req: Request, res: Response): Promise<void> {
    res.status(200).json({
      success: true,
      data: Object.values(EventType),
    });
  }
}
