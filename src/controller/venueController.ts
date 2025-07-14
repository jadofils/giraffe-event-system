import { Request, Response } from "express";
import cloudinary from "../config/cloudinary";
import streamifier from "streamifier";

import { VenueInterface } from "../interfaces/VenueInterface";
import { EventRepository } from "../repositories/eventRepository";
import { VenueRepository } from "../repositories/venueRepository";
import { VenueResourceRepository } from "../repositories/VenueResourceRepository";
import { Venue, VenueStatus, BookingType } from "../models/Venue Tables/Venue";
import { AuthenticatedRequest } from "../middlewares/AuthMiddleware";
import { AppDataSource } from "../config/Database";
import { VenueAmenities } from "../models/Venue Tables/VenueAmenities";
import { OrganizationRepository } from "../repositories/OrganizationRepository";
import { EventType } from "../interfaces/Enums/EventTypeEnum";
import { Resources } from "../models/Resources";
import { BookingCondition } from "../models/Venue Tables/BookingCondition";
import { VenueVariable } from "../models/Venue Tables/VenueVariable";
import { VenueRequest } from "../interfaces/VenueInterface";
import { CloudinaryUploadService } from "../services/CloudinaryUploadService";
import { In } from "typeorm";

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
    // Only allow ADMIN or VENUE_MANAGER to create a venue
    const authenticatedReq = req as AuthenticatedRequest;
    const userRoles = authenticatedReq.user?.roles || [];
    const isAdmin = userRoles.some((r: any) => (r.roleName || r) === "ADMIN");
    const isVenueManager = userRoles.some(
      (r: any) => (r.roleName || r) === "VENUE_MANAGER"
    );
    if (!isAdmin && !isVenueManager) {
      res.status(403).json({
        success: false,
        message: "Only ADMIN or VENUE_MANAGER can create a venue.",
      });
      return;
    }
    const data: VenueRequest = req.body;
    const organizationIdFromUser = authenticatedReq.user?.organizationId;

    // Set status based on creator role
    let status: VenueStatus;
    if (isAdmin) {
      status = VenueStatus.APPROVED;
    } else if (isVenueManager) {
      status = VenueStatus.PENDING;
    } else {
      status = VenueStatus.PENDING;
    }

    // Parse JSON fields if sent as strings (multipart/form-data)
    let venueAmenities = data.venueAmenities;
    if (typeof venueAmenities === "string") {
      try {
        venueAmenities = JSON.parse(venueAmenities);
      } catch (e) {
        res.status(400).json({
          success: false,
          message: "venueAmenities must be a valid JSON array.",
        });
        return;
      }
    }
    let bookingConditions = data.bookingConditions;
    if (typeof bookingConditions === "string") {
      try {
        bookingConditions = JSON.parse(bookingConditions);
      } catch (e) {
        res.status(400).json({
          success: false,
          message: "bookingConditions must be a valid JSON array.",
        });
        return;
      }
    }
    let venueVariable = data.venueVariable;
    if (typeof venueVariable === "string") {
      try {
        venueVariable = JSON.parse(venueVariable);
      } catch (e) {
        res.status(400).json({
          success: false,
          message: "venueVariable must be a valid JSON object.",
        });
        return;
      }
    }

    // Validate organizationId
    const organizationId = data.organizationId || organizationIdFromUser;
    if (!organizationId) {
      res
        .status(400)
        .json({ success: false, message: "organizationId is required" });
      return;
    }

    // Prevent duplication for managers: check for existing venue with same name/location/org
    const venueRepo = AppDataSource.getRepository(Venue);
    const existingVenue = await venueRepo.findOne({
      where: {
        venueName: data.venueName,
        venueLocation: data.venueLocation,
        organizationId: organizationId,
      },
      withDeleted: true,
    });
    if (isVenueManager && existingVenue) {
      // If rejected, allow update and set to pending
      if (existingVenue.status === VenueStatus.REJECTED) {
        // Update fields and set to pending
        existingVenue.capacity = data.capacity;
        existingVenue.latitude = data.latitude;
        existingVenue.longitude = data.longitude;
        existingVenue.googleMapsLink = data.googleMapsLink;
        existingVenue.venueTypeId = data.venueTypeId;
        existingVenue.mainPhotoUrl = data.mainPhotoUrl;
        existingVenue.photoGallery = data.photoGallery;
        existingVenue.virtualTourUrl = data.virtualTourUrl;
        existingVenue.venueDocuments = data.venueDocuments;
        existingVenue.status = VenueStatus.PENDING;
        existingVenue.cancellationReason = undefined;
        await venueRepo.save(existingVenue);
        res.status(200).json({ success: true, venueId: existingVenue.venueId, message: "Venue updated and set to pending for review." });
        return;
      } else {
        // Prevent duplicate
        res.status(409).json({ success: false, message: "Venue with the same name and location already exists for this organization." });
        return;
      }
    }

    // Handle file uploads
    const files = (req as any).files || {};
    try {
      // 1. Main Photo (required)
      let mainPhotoUrl = data.mainPhotoUrl;
      if (files.mainPhoto && files.mainPhoto[0]) {
        const mainPhoto = files.mainPhoto[0];
        const result = await CloudinaryUploadService.uploadBuffer(
          mainPhoto.buffer,
          "venues/main_photos"
        );
        mainPhotoUrl = result.url;
      } else if (!mainPhotoUrl) {
        res.status(400).json({
          success: false,
          message: "Main photo is required (mainPhoto file or mainPhotoUrl).",
        });
        return;
      }

      // 2. Photo Gallery (optional, array)
      let photoGallery: string[] = Array.isArray(data.photoGallery)
        ? data.photoGallery
        : data.photoGallery
        ? [data.photoGallery]
        : [];
      if (files.photoGallery && Array.isArray(files.photoGallery)) {
        for (const file of files.photoGallery) {
          const result = await CloudinaryUploadService.uploadBuffer(
            file.buffer,
            "venues/gallery"
          );
          photoGallery.push(result.url);
        }
      }

      // 3. Virtual Tour (optional, must be video)
      let virtualTourUrl = data.virtualTourUrl;
      if (files.virtualTour && files.virtualTour[0]) {
        const virtualTour = files.virtualTour[0];
        // Only allow video MIME types
        if (!virtualTour.mimetype.startsWith("video/")) {
          res.status(400).json({
            success: false,
            message: "Virtual tour must be a video file.",
          });
          return;
        }
        // Cloudinary supports up to 100MB for video by default (unsigned), but check 50MB for safety
        if (virtualTour.size > 50 * 1024 * 1024) {
          res.status(400).json({
            success: false,
            message: "Virtual tour video must not exceed 50MB.",
          });
          return;
        }
        const result = await CloudinaryUploadService.uploadBuffer(
          virtualTour.buffer,
          "venues/virtual_tours"
        );
        virtualTourUrl = result.url;
      }

      const bcRepo = AppDataSource.getRepository(BookingCondition);
      const vvRepo = AppDataSource.getRepository(VenueVariable);
      const vaRepo = AppDataSource.getRepository(VenueAmenities);
      const queryRunner = AppDataSource.createQueryRunner();
      await queryRunner.connect();
      await queryRunner.startTransaction();
      try {
        const {
          bookingConditions: _ignoreBC,
          venueVariable: _ignoreVV,
          venueAmenities: _ignoreVA,
          status: _ignoreStatus, // ignore status from request
          bookingType,
          ...venueFields
        } = data;

        // 1. Save Venue (no venueAmenitiesId)
        const venue = venueRepo.create({
          ...venueFields,
          organizationId,
          mainPhotoUrl,
          photoGallery,
          virtualTourUrl,
          status, // use status determined by role
          bookingType:
            typeof bookingType === "string"
              ? BookingType[bookingType as keyof typeof BookingType]
              : bookingType,
        });
        await queryRunner.manager.save(venue);

        // 2. Save all VenueAmenities, linking to the created venue
        if (venueAmenities && venueAmenities.length > 0) {
          for (const amenity of venueAmenities) {
            const venueAmenity = vaRepo.create({ ...amenity, venue });
            await queryRunner.manager.save(venueAmenity);
          }
        }

        // 3. Save Booking Conditions
        if (bookingConditions && bookingConditions.length > 0) {
          for (const bc of bookingConditions) {
            const bookingCondition = bcRepo.create({ ...bc, venue });
            await queryRunner.manager.save(bookingCondition);
          }
        }

        // 4. Save Venue Variable
        if (venueVariable) {
          // Fetch the manager user entity by ID
          const userRepo = AppDataSource.getRepository("User");
          const manager = await userRepo.findOne({
            where: { userId: venueVariable.venueManagerId },
          });
          if (!manager) throw new Error("Manager user not found");
          const { venueManagerId, ...restVenueVariable } = venueVariable;
          const venueVariableEntity = vvRepo.create({
            ...restVenueVariable,
            venue,
            manager,
          });
          await queryRunner.manager.save(venueVariableEntity);
        }

        await queryRunner.commitTransaction();
        res.status(201).json({ success: true, venueId: venue.venueId });
      } catch (err) {
        await queryRunner.rollbackTransaction();
        res.status(500).json({
          success: false,
          message: "Failed to create venue",
          error: err instanceof Error ? err.message : err,
        });
      } finally {
        await queryRunner.release();
      }
    } catch (err) {
      res.status(500).json({
        success: false,
        message: "File upload failed",
        error: err instanceof Error ? err.message : err,
      });
    }
  }

  // GET /venues/:id
  static async getVenueById(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    if (!id) {
      res
        .status(400)
        .json({ success: false, message: "Venue ID is required." });
      return;
    }
    try {
      const venueRepo = AppDataSource.getRepository(Venue);
      const venue = await venueRepo.findOne({
        where: { venueId: id },
        relations: [
          "amenities",
          "availabilitySlots",
          "bookingConditions",
          "venueVariables",
          "venueVariables.manager",
        ],
      });
      if (!venue) {
        res.status(404).json({ success: false, message: "Venue not found." });
        return;
      }
      res.status(200).json({ success: true, data: venue });
    } catch (err) {
      res.status(500).json({
        success: false,
        message: "Server error",
        error: err instanceof Error ? err.message : err,
      });
    }
  }

  // GET /organizations/:organizationId/venues
  static async getVenuesByOrganization(
    req: Request,
    res: Response
  ): Promise<void> {
    const { organizationId } = req.params;
    if (!organizationId) {
      res
        .status(400)
        .json({ success: false, message: "Organization ID is required." });
      return;
    }
    try {
      const venueRepo = AppDataSource.getRepository(Venue);
      const venues = await venueRepo.find({
        where: { organizationId },
        relations: [
          "amenities",
          "availabilitySlots",
          "bookingConditions",
          "venueVariables",
        ],
      });
      res.status(200).json({ success: true, data: venues });
    } catch (err) {
      res.status(500).json({
        success: false,
        message: "Server error",
        error: err instanceof Error ? err.message : err,
      });
    }
  }

  // GET /managers/:managerId/venues
  static async getVenuesByManager(req: Request, res: Response): Promise<void> {
    const { managerId } = req.params;
    if (!managerId) {
      res
        .status(400)
        .json({ success: false, message: "Manager ID is required." });
      return;
    }
    try {
      // Find all VenueVariables for this manager, then get their venues
      const vvRepo = AppDataSource.getRepository(VenueVariable);
      const venueVariables = await vvRepo.find({
        where: { manager: { userId: managerId } },
        relations: ["venue"],
      });
      const venueIds = venueVariables.map((vv) => vv.venue.venueId);
      if (!venueIds.length) {
        res.status(200).json({ success: true, data: [] });
        return;
      }
      const venueRepo = AppDataSource.getRepository(Venue);
      const venues = await venueRepo.find({
        where: { venueId: In(venueIds) },
        relations: [
          "amenities",
          "availabilitySlots",
          "bookingConditions",
          "venueVariables",
        ],
      });
      res.status(200).json({ success: true, data: venues });
    } catch (err) {
      res.status(500).json({
        success: false,
        message: "Server error",
        error: err instanceof Error ? err.message : err,
      });
    }
  }

  // // Get venue by ID
  // static async getById(req: Request, res: Response): Promise<void> {
  //   const { id } = req.params;
  //   if (!id) {
  //     res
  //       .status(400)
  //       .json({ success: false, message: "Venue ID is required." });
  //     return;
  //   }

  //   try {
  //     const result = await VenueRepository.getById(id);
  //     if (result.success && result.data) {
  //       res.status(200).json({ success: true, data: result.data });
  //     } else {
  //       res.status(404).json({
  //         success: false,
  //         message: result.message || "Venue not found.",
  //       });
  //     }
  //   } catch (err) {
  //     console.error("Error getting venue by ID:", err);
  //     res
  //       .status(500)
  //       .json({ success: false, message: "Failed to get venue by ID." });
  //   }
  // }

  // // Get venues by manager ID
  // static async getByManagerId(req: Request, res: Response): Promise<void> {
  //   const userId = req.user?.userId;
  //   if (!userId) {
  //     res
  //       .status(401)
  //       .json({ success: false, message: "Authentication required." });
  //     return;
  //   }

  //   try {
  //     const result = await VenueRepository.getByManagerId(userId);
  //     if (result.success && result.data) {
  //       res.status(200).json({ success: true, data: result.data });
  //     } else {
  //       res.status(404).json({
  //         success: false,
  //         message: result.message || "No venues found for this manager.",
  //       });
  //     }
  //   } catch (err) {
  //     console.error("Error getting venues by manager ID:", err);
  //     res.status(500).json({
  //       success: false,
  //       message: "Failed to get venues by manager ID.",
  //     });
  //   }
  // }

  // // Get all venues
  // static async getAll(req: Request, res: Response): Promise<void> {
  //   try {
  //     const result = await VenueRepository.getAll();
  //     if (result.success && result.data) {
  //       res.status(200).json({ success: true, data: result.data });
  //     } else {
  //       res.status(200).json({
  //         success: false,
  //         message: result.message || "No venues found.",
  //       });
  //     }
  //   } catch (err) {
  //     console.error("Error getting all venues:", err);
  //     res
  //       .status(500)
  //       .json({ success: false, message: "Failed to get all venues." });
  //   }
  // }

  // static async update(req: Request, res: Response): Promise<void> {
  //   const { id } = req.params;
  //   const userId = req.user?.userId;
  //   const {
  //     venueName,
  //     capacity,
  //     location,
  //     amount,
  //     managerId,
  //     latitude,
  //     longitude,
  //     googleMapsLink,
  //     amenities,
  //     venueType,
  //     contactPerson,
  //     contactEmail,
  //     contactPhone,
  //     websiteURL,
  //     status,
  //   }: Partial<VenueInterface> = req.body;

  //   if (!id) {
  //     res
  //       .status(400)
  //       .json({ success: false, message: "Venue ID is required." });
  //     return;
  //   }

  //   if (!userId) {
  //     res
  //       .status(401)
  //       .json({ success: false, message: "Authentication required." });
  //     return;
  //   }

  //   // Log request body for debugging
  //   console.log("Update request body:", req.body);

  //   // Construct update data, omitting undefined fields
  //   const updateData: Partial<VenueInterface> = {};
  //   if (venueName !== undefined) updateData.venueName = venueName;
  //   if (capacity !== undefined) updateData.capacity = capacity;
  //   if (location !== undefined) updateData.location = location;
  //   if (amount !== undefined) updateData.amount = amount;
  //   if (managerId !== undefined) updateData.managerId = managerId;
  //   if (latitude !== undefined) updateData.latitude = latitude;
  //   if (longitude !== undefined) updateData.longitude = longitude;
  //   if (googleMapsLink !== undefined)
  //     updateData.googleMapsLink = googleMapsLink;
  //   if (amenities !== undefined) updateData.amenities = amenities;
  //   if (venueType !== undefined) updateData.venueType = venueType;
  //   if (contactPerson !== undefined) updateData.contactPerson = contactPerson;
  //   if (contactEmail !== undefined) updateData.contactEmail = contactEmail;
  //   if (contactPhone !== undefined) updateData.contactPhone = contactPhone;
  //   if (websiteURL !== undefined) updateData.websiteURL = websiteURL;
  //   if (status !== undefined) updateData.status = status;

  //   // Validate update data
  //   const validationErrors = VenueInterface.validate(updateData);
  //   if (validationErrors.length > 0) {
  //     res.status(400).json({
  //       success: false,
  //       message: `Validation errors: ${validationErrors.join(", ")}`,
  //     });
  //     return;
  //   }

  //   try {
  //     const updateResult = await VenueRepository.update(id, updateData);
  //     if (updateResult.success && updateResult.data) {
  //       res.status(200).json({
  //         success: true,
  //         message: "Venue updated successfully.",
  //         data: updateResult.data,
  //       });
  //     } else {
  //       res.status(404).json({
  //         success: false,
  //         message: updateResult.message || "Venue not found.",
  //       });
  //     }
  //   } catch (err) {
  //     console.error("Error updating venue:", err);
  //     res.status(500).json({
  //       success: false,
  //       message: "Failed to update venue due to a server error.",
  //     });
  //   }
  // }
  // // Update venue manager
  // static async updateVenueManager(req: Request, res: Response): Promise<void> {
  //   const userId = req.user?.userId;
  //   const { venueId, managerId } = req.body;

  //   if (!userId) {
  //     res
  //       .status(401)
  //       .json({ success: false, message: "Authentication required." });
  //     return;
  //   }

  //   if (!venueId || !managerId) {
  //     res.status(400).json({
  //       success: false,
  //       message: "Venue ID and manager ID are required.",
  //     });
  //     return;
  //   }

  //   try {
  //     const result = await VenueRepository.updateVenueManager(
  //       venueId,
  //       managerId
  //     );
  //     if (result.success && result.data) {
  //       res.status(200).json({
  //         success: true,
  //         message: "Venue manager updated successfully.",
  //         data: result.data,
  //       });
  //     } else {
  //       res.status(400).json({
  //         success: false,
  //         message: result.message || "Failed to update venue manager.",
  //       });
  //     }
  //   } catch (err) {
  //     console.error("Error updating venue manager:", err);
  //     res.status(500).json({
  //       success: false,
  //       message: "Failed to update venue manager due to a server error.",
  //     });
  //   }
  // }

  // // Remove venue manager
  // static async removeVenueManager(req: Request, res: Response): Promise<void> {
  //   const userId = req.user?.userId;
  //   const { venueId } = req.params;

  //   if (!userId) {
  //     res
  //       .status(401)
  //       .json({ success: false, message: "Authentication required." });
  //     return;
  //   }

  //   if (!venueId) {
  //     res
  //       .status(400)
  //       .json({ success: false, message: "Venue ID is required." });
  //     return;
  //   }

  //   try {
  //     const result = await VenueRepository.removeVenueManager(venueId);
  //     if (result.success && result.data) {
  //       res.status(200).json({
  //         success: true,
  //         message: "Venue manager removed successfully.",
  //         data: result.data,
  //       });
  //     } else {
  //       res.status(400).json({
  //         success: false,
  //         message: result.message || "Failed to remove venue manager.",
  //       });
  //     }
  //   } catch (err) {
  //     console.error("Error removing venue manager:", err);
  //     res.status(500).json({
  //       success: false,
  //       message: "Failed to remove venue manager due to a server error.",
  //     });
  //   }
  // }

  // // Delete venue (soft delete)
  // static async delete(req: Request, res: Response): Promise<void> {
  //   const { id } = req.params;
  //   const userId = req.user?.userId;

  //   if (!id) {
  //     res
  //       .status(400)
  //       .json({ success: false, message: "Venue ID is required." });
  //     return;
  //   }

  //   if (!userId) {
  //     res
  //       .status(401)
  //       .json({ success: false, message: "Authentication required." });
  //     return;
  //   }

  //   try {
  //     const deleteResult = await VenueRepository.delete(id);
  //     if (deleteResult.success) {
  //       res.status(200).json({
  //         success: true,
  //         message: deleteResult.message || "Venue deleted successfully.",
  //       });
  //     } else {
  //       res.status(404).json({
  //         success: false,
  //         message: deleteResult.message || "Venue not found.",
  //       });
  //     }
  //   } catch (err) {
  //     console.error("Error deleting venue:", err);
  //     res
  //       .status(500)
  //       .json({ success: false, message: "Failed to delete venue." });
  //   }
  // }

  // // Restore soft-deleted venue
  // static async restore(req: Request, res: Response): Promise<void> {
  //   const { id } = req.params;
  //   const userId = req.user?.userId;

  //   if (!id) {
  //     res
  //       .status(400)
  //       .json({ success: false, message: "Venue ID is required." });
  //     return;
  //   }

  //   if (!userId) {
  //     res
  //       .status(401)
  //       .json({ success: false, message: "Authentication required." });
  //     return;
  //   }

  //   try {
  //     const restoreResult = await VenueRepository.restore(id);
  //     if (restoreResult.success && restoreResult.data) {
  //       res.status(200).json({
  //         success: true,
  //         message: "Venue restored successfully.",
  //         data: restoreResult.data,
  //       });
  //     } else {
  //       res.status(404).json({
  //         success: false,
  //         message: restoreResult.message || "Venue not found or not deleted.",
  //       });
  //     }
  //   } catch (err) {
  //     console.error("Error restoring venue:", err);
  //     res
  //       .status(500)
  //       .json({ success: false, message: "Failed to restore venue." });
  //   }
  // }

  // // Get soft-deleted venues
  // static async getDeleted(req: Request, res: Response): Promise<void> {
  //   const userId = req.user?.userId;

  //   if (!userId) {
  //     res
  //       .status(401)
  //       .json({ success: false, message: "Authentication required." });
  //     return;
  //   }

  //   try {
  //     const result = await VenueRepository.getDeleted();
  //     if (result.success && result.data) {
  //       res.status(200).json({ success: true, data: result.data });
  //     } else {
  //       res.status(200).json({
  //         success: false,
  //         message: result.message || "No deleted venues found.",
  //       });
  //     }
  //   } catch (err) {
  //     console.error("Error getting deleted venues:", err);
  //     res
  //       .status(500)
  //       .json({ success: false, message: "Failed to get deleted venues." });
  //   }
  // }

  // // Check venue event conflicts
  // static async checkVenueEventConflicts(
  //   req: Request,
  //   res: Response
  // ): Promise<void> {
  //   const { venueId, startDate, endDate, startTime, endTime } = req.query;

  //   if (
  //     !venueId ||
  //     !startDate ||
  //     !endDate ||
  //     typeof venueId !== "string" ||
  //     typeof startDate !== "string" ||
  //     typeof endDate !== "string"
  //   ) {
  //     res.status(400).json({
  //       success: false,
  //       message: "Venue ID, startDate, and endDate are required.",
  //     });
  //     return;
  //   }

  //   try {
  //     // Use plain string comparison for dates and times
  //     const startDateStr = String(startDate);
  //     const endDateStr = String(endDate);
  //     const startTimeStr = String(startTime);
  //     const endTimeStr = String(endTime);

  //     const venueResult = await VenueRepository.getById(venueId);
  //     if (!venueResult.success || !venueResult.data) {
  //       res.status(404).json({ success: false, message: "Venue not found." });
  //       return;
  //     }

  //     // Helper to parse date and time (YYYY-MM-DD, HH:mm or HH:mm AM/PM) to minutes since epoch
  //     function parseDateTime(dateStr: string, timeStr: string): number | null {
  //       if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return null;
  //       let [hour, minute] = [0, 0];
  //       let t = timeStr.trim();
  //       let ampm = null;
  //       if (/am|pm/i.test(t)) {
  //         ampm = t.slice(-2).toLowerCase();
  //         t = t.slice(0, -2).trim();
  //       }
  //       const parts = t.split(":");
  //       if (parts.length !== 2) return null;
  //       hour = parseInt(parts[0], 10);
  //       minute = parseInt(parts[1], 10);
  //       if (isNaN(hour) || isNaN(minute)) return null;
  //       if (ampm) {
  //         if (ampm === "pm" && hour !== 12) hour += 12;
  //         if (ampm === "am" && hour === 12) hour = 0;
  //       }
  //       const date = new Date(`${dateStr}T00:00:00Z`);
  //       if (isNaN(date.getTime())) return null;
  //       return date.getTime() + hour * 60 * 60 * 1000 + minute * 60 * 1000;
  //     }

  //     const startDateTime = parseDateTime(startDateStr, startTimeStr);
  //     const endDateTime = parseDateTime(endDateStr, endTimeStr);
  //     if (startDateTime === null || endDateTime === null) {
  //       res
  //         .status(400)
  //         .json({ success: false, message: "Invalid date or time format." });
  //       return;
  //     }

  //     const eventsResult = await EventRepository.getByVenueId(venueId);
  //     if (eventsResult.success && eventsResult.data) {
  //       const conflictingEvents = eventsResult.data.filter((event) => {
  //         const eventStart = parseDateTime(event.startDate, event.startTime);
  //         const eventEnd = parseDateTime(event.endDate, event.endTime);
  //         if (eventStart === null || eventEnd === null) return false;
  //         return (
  //           eventStart <= endDateTime &&
  //           eventEnd >= startDateTime &&
  //           event.status !== "CANCELLED"
  //         );
  //       });

  //       if (conflictingEvents.length > 0) {
  //         res.status(200).json({
  //           success: true,
  //           available: false,
  //           message: "Venue is booked for the requested period.",
  //           conflicts: conflictingEvents.map((e) => ({
  //             eventId: e.eventId,
  //             eventTitle: e.eventTitle,
  //           })),
  //         });
  //         return;
  //       }
  //     }

  //     res.status(200).json({
  //       success: true,
  //       available: true,
  //       message: "Venue is available for the requested period.",
  //     });
  //   } catch (err) {
  //     console.error("Error checking venue event conflicts:", err);
  //     res.status(500).json({
  //       success: false,
  //       message: "Failed to check venue event conflicts.",
  //     });
  //   }
  // }

  // // Search venues
  // static async searchVenues(req: Request, res: Response): Promise<void> {
  //   const {
  //     name,
  //     location,
  //     minCapacity,
  //     maxCapacity,
  //     isAvailable,
  //     hasManager,
  //   } = req.query;

  //   const criteria: {
  //     name?: string;
  //     location?: string;
  //     minCapacity?: number;
  //     maxCapacity?: number;
  //     isAvailable?: boolean;
  //     hasManager?: boolean;
  //   } = {};

  //   if (name && typeof name === "string") criteria.name = name;
  //   if (location && typeof location === "string") criteria.location = location;
  //   if (minCapacity && !isNaN(Number(minCapacity)))
  //     criteria.minCapacity = Number(minCapacity);
  //   if (maxCapacity && !isNaN(Number(maxCapacity)))
  //     criteria.maxCapacity = Number(maxCapacity);
  //   if (
  //     isAvailable !== undefined &&
  //     (isAvailable === "true" || isAvailable === "false")
  //   )
  //     criteria.isAvailable = isAvailable === "true";
  //   if (
  //     hasManager !== undefined &&
  //     (hasManager === "true" || hasManager === "false")
  //   )
  //     criteria.hasManager = hasManager === "true";

  //   try {
  //     const result = await VenueRepository.searchVenues(criteria);
  //     if (result.success && result.data) {
  //       res.status(200).json({ success: true, data: result.data });
  //     } else {
  //       res.status(200).json({
  //         success: false,
  //         message: result.message || "No venues found.",
  //       });
  //     }
  //   } catch (err) {
  //     console.error("Error searching venues:", err);
  //     res
  //       .status(500)
  //       .json({ success: false, message: "Failed to search venues." });
  //   }
  // }

  // // Get venue count
  // static async getVenueCount(req: Request, res: Response): Promise<void> {
  //   try {
  //     const result = await VenueRepository.getVenueCount();
  //     if (result.success && result.count !== undefined) {
  //       res.status(200).json({ success: true, count: result.count });
  //     } else {
  //       res.status(200).json({
  //         success: false,
  //         message: result.message || "Failed to get venue count.",
  //       });
  //     }
  //   } catch (err) {
  //     console.error("Error getting venue count:", err);
  //     res
  //       .status(500)
  //       .json({ success: false, message: "Failed to get venue count." });
  //   }
  // }

  // // Get venues by proximity
  // static async getVenuesByProximity(
  //   req: Request,
  //   res: Response
  // ): Promise<void> {
  //   const { latitude, longitude, radius } = req.query;

  //   if (
  //     !latitude ||
  //     !longitude ||
  //     !radius ||
  //     typeof latitude !== "string" ||
  //     typeof longitude !== "string" ||
  //     typeof radius !== "string"
  //   ) {
  //     res.status(400).json({
  //       success: false,
  //       message: "Latitude, longitude, and radius are required.",
  //     });
  //     return;
  //   }

  //   try {
  //     const lat = parseFloat(latitude);
  //     const lon = parseFloat(longitude);
  //     const rad = parseFloat(radius);

  //     if (isNaN(lat) || isNaN(lon) || isNaN(rad)) {
  //       res.status(400).json({
  //         success: false,
  //         message: "Invalid latitude, longitude, or radius format.",
  //       });
  //       return;
  //     }

  //     const result = await VenueRepository.getVenuesByProximity(lat, lon, rad);
  //     if (result.success && result.data) {
  //       res.status(200).json({ success: true, data: result.data });
  //     } else {
  //       res.status(200).json({
  //         success: false,
  //         message: result.message || "No venues found within radius.",
  //       });
  //     }
  //   } catch (err) {
  //     console.error("Error getting venues by proximity:", err);
  //     res.status(500).json({
  //       success: false,
  //       message: "Failed to get venues by proximity.",
  //     });
  //   }
  // }

  // // Assign a user as manager to a venue (simple version)
  // static async assignManagerToVenue(
  //   req: Request,
  //   res: Response
  // ): Promise<void> {
  //   const { venueId, userId } = req.body;

  //   if (!venueId || !userId) {
  //     res
  //       .status(400)
  //       .json({ success: false, message: "venueId and userId are required." });
  //     return;
  //   }

  //   try {
  //     // Find the venue
  //     const venueResult = await VenueRepository.getById(venueId);
  //     if (!venueResult.success || !venueResult.data) {
  //       res.status(404).json({ success: false, message: "Venue not found." });
  //       return;
  //     }
  //     // Find the user
  //     const userRepo = require("../models/User");
  //     const { AppDataSource } = require("../config/Database");
  //     const user = await AppDataSource.getRepository(userRepo.User).findOne({
  //       where: { userId },
  //     });
  //     if (!user) {
  //       res.status(404).json({ success: false, message: "User not found." });
  //       return;
  //     }
  //     // Assign user as manager
  //     venueResult.data.managerId = userId;
  //     venueResult.data.manager = user;
  //     const saveResult = await VenueRepository.save(venueResult.data);
  //     if (saveResult.success && saveResult.data) {
  //       res.status(200).json({
  //         success: true,
  //         message: "User assigned as venue manager successfully.",
  //         data: saveResult.data,
  //       });
  //     } else {
  //       res.status(500).json({
  //         success: false,
  //         message: saveResult.message || "Failed to assign manager.",
  //       });
  //     }
  //   } catch (err) {
  //     console.error("Error assigning manager to venue:", err);
  //     res.status(500).json({
  //       success: false,
  //       message: "Failed to assign manager due to a server error.",
  //     });
  //   }
  // }

  // // Get resources for a venue by ID
  // static async getResourcesByVenueId(
  //   req: Request,
  //   res: Response
  // ): Promise<void> {
  //   const { id } = req.params;
  //   if (!id) {
  //     res
  //       .status(400)
  //       .json({ success: false, message: "Venue ID is required." });
  //     return;
  //   }
  //   try {
  //     const result = await VenueRepository.getResourcesByVenueId(id);
  //     if (result.success) {
  //       res.status(200).json({ success: true, data: result.data });
  //     } else {
  //       res.status(404).json({
  //         success: false,
  //         message: result.message || "No resources found for this venue.",
  //       });
  //     }
  //   } catch (err) {
  //     console.error("Error getting resources for venue:", err);
  //     res.status(500).json({
  //       success: false,
  //       message: "Failed to get resources for venue.",
  //     });
  //   }
  // }

  // // Add resources to a venue (bulk)
  // static async addResourcesToVenue(req: Request, res: Response): Promise<void> {
  //   const { resources } = req.body;
  //   const { venueId } = req.params;
  //   if (!venueId || !Array.isArray(resources) || resources.length === 0) {
  //     res.status(400).json({
  //       success: false,
  //       message: "venueId and a non-empty resources array are required",
  //     });
  //     return;
  //   }
  //   try {
  //     const created = await VenueResourceRepository.addResourcesToVenue(
  //       venueId,
  //       resources
  //     );
  //     res.status(201).json({ success: true, data: created });
  //   } catch (error) {
  //     res
  //       .status(500)
  //       .json({ success: false, message: "Failed to add resources to venue" });
  //   }
  // }

  // // Remove a resource from a venue
  // static async removeResourceFromVenue(
  //   req: Request,
  //   res: Response
  // ): Promise<void> {
  //   const { venueId, resourceId } = req.params;
  //   if (!venueId || !resourceId) {
  //     res.status(400).json({
  //       success: false,
  //       message: "venueId and resourceId are required",
  //     });
  //     return;
  //   }
  //   try {
  //     const removed = await VenueResourceRepository.removeResourceFromVenue(
  //       venueId,
  //       resourceId
  //     );
  //     if (removed) {
  //       res
  //         .status(200)
  //         .json({ success: true, message: "Resource removed from venue" });
  //     } else {
  //       res.status(404).json({
  //         success: false,
  //         message: "Resource not found for this venue",
  //       });
  //     }
  //   } catch (error) {
  //     res.status(500).json({
  //       success: false,
  //       message: "Failed to remove resource from venue",
  //     });
  //   }
  // }

  // // Get all resources assigned to a venue
  // static async getVenueResources(req: Request, res: Response): Promise<void> {
  //   const { venueId } = req.params;
  //   if (!venueId) {
  //     res.status(400).json({ success: false, message: "venueId is required" });
  //     return;
  //   }
  //   try {
  //     const resources = await VenueResourceRepository.getResourcesByVenueId(
  //       venueId
  //     );
  //     res.status(200).json({ success: true, data: resources });
  //   } catch (error) {
  //     res
  //       .status(500)
  //       .json({ success: false, message: "Failed to get resources for venue" });
  //   }
  // }

  // /**
  //  * GET /api/v1/venues/check-availability
  //  * Query params:
  //  *   - startDate
  //  *   - endDate
  //  *   - startTime
  //  *   - endTime
  //  *   - bufferMinutes (optional, default = 30)
  //  */

  static async approveVenue(req: Request, res: Response): Promise<void> {
    const authenticatedReq = req as AuthenticatedRequest;
    const userRoles = authenticatedReq.user?.roles || [];
    const isAdmin = userRoles.some((r: any) => (r.roleName || r) === "ADMIN");
    if (!isAdmin) {
      res
        .status(403)
        .json({ success: false, message: "Only ADMIN can approve venues." });
      return;
    }
    const { id } = req.params;
    if (!id) {
      res
        .status(400)
        .json({ success: false, message: "Venue ID is required." });
      return;
    }
    try {
      const venueRepo = AppDataSource.getRepository(Venue);
      const venue = await venueRepo.findOne({ where: { venueId: id } });
      if (!venue) {
        res.status(404).json({ success: false, message: "Venue not found." });
        return;
      }
      venue.status = VenueStatus.APPROVED;
      venue.cancellationReason = undefined;
      await venueRepo.save(venue);
      res.status(200).json({ success: true, data: venue });
    } catch (err) {
      res
        .status(500)
        .json({
          success: false,
          message: "Failed to approve venue",
          error: err instanceof Error ? err.message : err,
        });
    }
  }

  static async approveVenuePublic(req: Request, res: Response): Promise<void> {
    const authenticatedReq = req as AuthenticatedRequest;
    const userRoles = authenticatedReq.user?.roles || [];
    const isAdmin = userRoles.some((r: any) => (r.roleName || r) === "ADMIN");
    if (!isAdmin) {
      res
        .status(403)
        .json({
          success: false,
          message: "Only ADMIN can approve venues for public.",
        });
      return;
    }
    const { id } = req.params;
    if (!id) {
      res
        .status(400)
        .json({ success: false, message: "Venue ID is required." });
      return;
    }
    try {
      const venueRepo = AppDataSource.getRepository(Venue);
      const venue = await venueRepo.findOne({ where: { venueId: id } });
      if (!venue) {
        res.status(404).json({ success: false, message: "Venue not found." });
        return;
      }
      venue.status = VenueStatus.APPROVE_PUBLIC;
      venue.cancellationReason = undefined;
      await venueRepo.save(venue);
      res.status(200).json({ success: true, data: venue });
    } catch (err) {
      res
        .status(500)
        .json({
          success: false,
          message: "Failed to approve venue for public",
          error: err instanceof Error ? err.message : err,
        });
    }
  }

  static async rejectVenue(req: Request, res: Response): Promise<void> {
    const authenticatedReq = req as AuthenticatedRequest;
    const userRoles = authenticatedReq.user?.roles || [];
    const isAdmin = userRoles.some((r: any) => (r.roleName || r) === "ADMIN");
    if (!isAdmin) {
      res
        .status(403)
        .json({ success: false, message: "Only ADMIN can reject venues." });
      return;
    }
    const { id } = req.params;
    const { cancellationReason } = req.body;
    if (!id) {
      res
        .status(400)
        .json({ success: false, message: "Venue ID is required." });
      return;
    }
    if (!cancellationReason) {
      res
        .status(400)
        .json({
          success: false,
          message: "cancellationReason is required to reject a venue.",
        });
      return;
    }
    try {
      const venueRepo = AppDataSource.getRepository(Venue);
      const venue = await venueRepo.findOne({ where: { venueId: id } });
      if (!venue) {
        res.status(404).json({ success: false, message: "Venue not found." });
        return;
      }
      venue.status = VenueStatus.REJECTED;
      venue.cancellationReason = cancellationReason;
      await venueRepo.save(venue);
      res.status(200).json({ success: true, data: venue });
    } catch (err) {
      res
        .status(500)
        .json({
          success: false,
          message: "Failed to reject venue",
          error: err instanceof Error ? err.message : err,
        });
    }
  }

  // /**
  //  * Retrieves all approved venues.
  //  * @param req The Express request object.
  //  * @param res The Express response object.
  //  */
  // static async listApprovedVenues(req: Request, res: Response): Promise<void> {
  //   try {
  //     const result = await VenueRepository.getApprovedVenues();

  //     if (result.success) {
  //       res.status(200).json(result);
  //     } else {
  //       res.status(500).json({
  //         success: false,
  //         message: result.message || "Failed to retrieve approved venues",
  //       });
  //     }
  //   } catch (error: any) {
  //     res.status(500).json({
  //       success: false,
  //       message:
  //         "An unexpected error occurred while retrieving approved venues.",
  //       error: error?.message || error,
  //     });
  //   }
  // }

  // static async cancelVenue(req: Request, res: Response): Promise<void> {
  //   const user = (req as any).user;
  //   if (
  //     !user ||
  //     !user.role ||
  //     String(user.role.roleName || user.role).toLowerCase() !== "admin"
  //   ) {
  //     res
  //       .status(403)
  //       .json({ success: false, message: "Only admin can cancel venues." });
  //     return;
  //   }
  //   const { id } = req.params;
  //   const { feedback } = req.body;
  //   if (!feedback) {
  //     res.status(400).json({
  //       success: false,
  //       message: "Feedback is required for cancellation.",
  //     });
  //     return;
  //   }
  //   const result = await VenueRepository.update(id, {
  //     status: VenueStatus.CANCELLED,
  //     cancellationReason: feedback,
  //   });
  //   if (result.success && result.data) {
  //     res.json({
  //       success: true,
  //       message: "Venue cancelled.",
  //       data: result.data,
  //     });
  //   } else {
  //     res.status(400).json({ success: false, message: result.message });
  //   }
  // }

  // static async getEventsByVenue(req: Request, res: Response): Promise<void> {
  //   const { venueId } = req.params;
  //   if (!venueId) {
  //     res.status(400).json({ success: false, message: "venueId is required" });
  //     return;
  //   }
  //   try {
  //     const result = await EventRepository.getByVenueId(venueId);
  //     if (result.success && result.data) {
  //       res.status(200).json({ success: true, data: result.data });
  //     } else {
  //       res.status(404).json({
  //         success: false,
  //         message: result.message || "No events found for this venue.",
  //       });
  //     }
  //   } catch (error) {
  //     res
  //       .status(500)
  //       .json({ success: false, message: "Failed to get events for venue." });
  //   }
  // }

  // static async listPublicApprovedEvents(
  //   req: Request,
  //   res: Response
  // ): Promise<void> {
  //   const result = await EventRepository.getPublicApprovedEvents();
  //   if (result.success && result.data) {
  //     res.status(200).json({ success: true, data: result.data });
  //   } else {
  //     res.status(500).json({ success: false, message: result.message });
  //   }
  // }

  // static async listEventTypes(req: Request, res: Response): Promise<void> {
  //   res.status(200).json({
  //     success: true,
  //     data: Object.values(EventType),
  //   });
  // }

  // static async getVenuesWithApprovedEvents(
  //   req: Request,
  //   res: Response
  // ): Promise<void> {
  //   try {
  //     const result = await VenueRepository.getVenuesWithApprovedEvents();
  //     if (result.success && result.data) {
  //       res.status(200).json({ success: true, data: result.data });
  //     } else {
  //       res.status(404).json({
  //         success: false,
  //         message: result.message || "No venues with approved events found.",
  //       });
  //     }
  //   } catch (error) {
  //     res.status(500).json({
  //       success: false,
  //       message: "Failed to fetch venues with approved events.",
  //     });
  //   }
  // }
  // static async getVenuesWithApprovedEventsViaBookings(
  //   req: Request,
  //   res: Response
  // ): Promise<void> {
  //   try {
  //     const result =
  //       await VenueRepository.getVenuesWithApprovedEventsViaBookings();
  //     if (result.success && result.data) {
  //       res.status(200).json({ success: true, data: result.data });
  //     } else {
  //       res.status(404).json({
  //         success: false,
  //         message: result.message || "No venues with approved events found.",
  //       });
  //     }
  //   } catch (error) {
  //     res.status(500).json({
  //       success: false,
  //       message: "Failed to fetch venues with approved events.",
  //     });
  //   }
  // }

  // --- Modular GET/UPDATE endpoints for venue amenities, booking conditions, variables ---
  static async getVenueAmenities(req: Request, res: Response): Promise<void> {
    res.status(501).json({ success: false, message: "Not implemented" });
  }
  static async getVenueBookingConditions(
    req: Request,
    res: Response
  ): Promise<void> {
    res.status(501).json({ success: false, message: "Not implemented" });
  }
  static async getVenueVariables(req: Request, res: Response): Promise<void> {
    res.status(501).json({ success: false, message: "Not implemented" });
  }
  static async getVenueAmenityById(req: Request, res: Response): Promise<void> {
    res.status(501).json({ success: false, message: "Not implemented" });
  }
  static async getVenueBookingConditionById(
    req: Request,
    res: Response
  ): Promise<void> {
    res.status(501).json({ success: false, message: "Not implemented" });
  }
  static async getVenueVariableById(
    req: Request,
    res: Response
  ): Promise<void> {
    res.status(501).json({ success: false, message: "Not implemented" });
  }
  static async updateVenueAmenities(
    req: Request,
    res: Response
  ): Promise<void> {
    res.status(501).json({ success: false, message: "Not implemented" });
  }
  static async updateVenueBookingConditions(
    req: Request,
    res: Response
  ): Promise<void> {
    res.status(501).json({ success: false, message: "Not implemented" });
  }
  static async updateVenueVariables(
    req: Request,
    res: Response
  ): Promise<void> {
    res.status(501).json({ success: false, message: "Not implemented" });
  }
  static async updateVenueAmenityById(
    req: Request,
    res: Response
  ): Promise<void> {
    res.status(501).json({ success: false, message: "Not implemented" });
  }
  static async updateVenueBookingConditionById(
    req: Request,
    res: Response
  ): Promise<void> {
    res.status(501).json({ success: false, message: "Not implemented" });
  }
  static async updateVenueVariableById(
    req: Request,
    res: Response
  ): Promise<void> {
    res.status(501).json({ success: false, message: "Not implemented" });
  }
  static async addVenueAmenity(req: Request, res: Response): Promise<void> {
    const { venueId } = req.params;
    if (!venueId) {
      res.status(400).json({ success: false, message: "venueId is required" });
      return;
    }
    const amenityData = req.body;
    try {
      const venueRepo = AppDataSource.getRepository(Venue);
      const vaRepo = AppDataSource.getRepository(VenueAmenities);
      const venue = await venueRepo.findOne({ where: { venueId } });
      if (!venue) {
        res.status(404).json({ success: false, message: "Venue not found" });
        return;
      }
      // Create and save the amenity
      const amenity = vaRepo.create({ ...amenityData, venue });
      await vaRepo.save(amenity);
      res.status(201).json({ success: true, data: amenity });
    } catch (err) {
      res.status(500).json({
        success: false,
        message: "Failed to add amenity",
        error: err instanceof Error ? err.message : err,
      });
    }
  }

  static async removeVenueAmenity(req: Request, res: Response): Promise<void> {
    const { venueId, amenityId } = req.params;
    if (!venueId || !amenityId) {
      res.status(400).json({
        success: false,
        message: "venueId and amenityId are required",
      });
      return;
    }
    try {
      const vaRepo = AppDataSource.getRepository(VenueAmenities);
      const amenity = await vaRepo.findOne({
        where: { id: amenityId },
        relations: ["venue"],
      });
      if (!amenity) {
        res.status(404).json({ success: false, message: "Amenity not found" });
        return;
      }
      if (!amenity.venue || amenity.venue.venueId !== venueId) {
        res.status(400).json({
          success: false,
          message: "Amenity does not belong to the specified venue",
        });
        return;
      }
      await vaRepo.softRemove(amenity);
      res
        .status(200)
        .json({ success: true, message: "Amenity removed from venue" });
    } catch (err) {
      res.status(500).json({
        success: false,
        message: "Failed to remove amenity",
        error: err instanceof Error ? err.message : err,
      });
    }
  }

  static async getAllVenuesWithManagers(
    req: Request,
    res: Response
  ): Promise<void> {
    const authenticatedReq = req as AuthenticatedRequest;
    const userRoles = authenticatedReq.user?.roles || [];
    const isAdmin = userRoles.some((r: any) => (r.roleName || r) === "ADMIN");
    if (!isAdmin) {
      res
        .status(403)
        .json({ success: false, message: "Only ADMIN can list all venues." });
      return;
    }
    try {
      const venueRepo = AppDataSource.getRepository(Venue);
      const venues = await venueRepo.find({
        relations: [
          "amenities",
          "availabilitySlots",
          "bookingConditions",
          "venueVariables",
          "venueVariables.manager",
        ],
      });
      res.status(200).json({ success: true, data: venues });
    } catch (err) {
      res.status(500).json({
        success: false,
        message: "Server error",
        error: err instanceof Error ? err.message : err,
      });
    }
  }
}
