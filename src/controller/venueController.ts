import { Request, Response } from "express";
import cloudinary from "../config/cloudinary";
import streamifier from "streamifier";

import { VenueInterface } from "../interfaces/VenueInterface";
import { EventRepository } from "../repositories/eventRepository";
import { VenueRepository } from "../repositories/venueRepository";
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
import { Organization } from "../models/Organization";
import { User } from "../models/User";

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
    // Instead of isVenueManager, check if user has organization and it's approved
    // const isVenueManager = userRoles.some(
    //   (r: any) => (r.roleName || r) === "GUEST"
    // );
    if (!isAdmin && !authenticatedReq.user?.organizationId) {
      res.status(403).json({
        success: false,
        message: "Only ADMIN or users with an organization can create a venue.",
      });
      return;
    }
    const data: VenueRequest = req.body;
    const organizationIdFromUser = authenticatedReq.user?.organizationId;

    // Set status based on creator role
    let status: VenueStatus;
    if (isAdmin) {
      status = VenueStatus.APPROVED;
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

    // Check if organization is APPROVED and not 'Independent'
    const orgRepo = AppDataSource.getRepository(Organization);
    const organization = await orgRepo.findOne({ where: { organizationId } });
    if (!organization) {
      res
        .status(404)
        .json({ success: false, message: "Organization not found." });
      return;
    }
    // Move this check up for clarity and early exit
    if (organization.organizationName === "Independent") {
      res.status(403).json({
        success: false,
        message: "The 'Independent' organization cannot create venues.",
      });
      return;
    }
    if (organization.status !== "APPROVED") {
      res.status(403).json({
        success: false,
        message: "Only APPROVED organizations can create venues.",
      });
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
    if ((isAdmin || !!organizationIdFromUser) && existingVenue) {
      // If rejected, allow update and set to pending (non-admin) or approved (admin)
      if (existingVenue.status === VenueStatus.REJECTED) {
        // Update fields
        existingVenue.capacity = data.capacity;
        existingVenue.latitude = data.latitude;
        existingVenue.longitude = data.longitude;
        existingVenue.googleMapsLink = data.googleMapsLink;
        existingVenue.venueTypeId = data.venueTypeId;
        existingVenue.mainPhotoUrl = data.mainPhotoUrl;
        existingVenue.photoGallery = data.photoGallery;
        existingVenue.virtualTourUrl = data.virtualTourUrl;
        existingVenue.venueDocuments = data.venueDocuments;
        existingVenue.cancellationReason = undefined;
        if (isAdmin) {
          existingVenue.status = VenueStatus.APPROVED;
        } else {
          existingVenue.status = VenueStatus.PENDING;
        }
        await venueRepo.save(existingVenue);
        res.status(200).json({
          success: true,
          venueId: existingVenue.venueId,
          message: `Venue updated and set to ${
            isAdmin ? "approved" : "pending"
          } for review.`,
        });
        return;
      } else {
        // Prevent duplicate
        res.status(409).json({
          success: false,
          message:
            "Venue with the same name and location already exists for this organization.",
        });
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
      res.status(500).json({
        success: false,
        message: "Failed to approve venue",
        error: err instanceof Error ? err.message : err,
      });
    }
  }

  static async approveVenuePublic(req: Request, res: Response): Promise<void> {
    const authenticatedReq = req as AuthenticatedRequest;
    const user = authenticatedReq.user;
    const userRoles = user?.roles || [];
    const isAdmin = userRoles.some((r: any) => (r.roleName || r) === "ADMIN");
    const isManager = userRoles.some((r: any) => (r.roleName || r) === "GUEST");
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
      // Only allow if status is APPROVED or APPROVE_PUBLIC
      if (
        venue.status !== VenueStatus.APPROVED &&
        venue.status !== VenueStatus.APPROVE_PUBLIC
      ) {
        res.status(400).json({
          success: false,
          message:
            "Venue must be in APPROVED or APPROVE_PUBLIC status to change public approval.",
        });
        return;
      }
      // Only admin or the manager of the venue can do this
      let isVenueManager = false;
      if (isManager) {
        // Find the VenueVariable for this venue and check manager
        const vvRepo = AppDataSource.getRepository(VenueVariable);
        const venueVariable = await vvRepo.findOne({
          where: { venue: { venueId: id } },
          relations: ["manager"],
        });
        if (
          venueVariable &&
          venueVariable.manager &&
          venueVariable.manager.userId === user?.userId
        ) {
          isVenueManager = true;
        }
      }
      if (!isAdmin && !isVenueManager) {
        res.status(403).json({
          success: false,
          message:
            "Only ADMIN or the venue's manager can approve/unapprove for public.",
        });
        return;
      }
      // Toggle status
      if (venue.status === VenueStatus.APPROVED) {
        venue.status = VenueStatus.APPROVE_PUBLIC;
      } else if (venue.status === VenueStatus.APPROVE_PUBLIC) {
        venue.status = VenueStatus.APPROVED;
      }
      venue.cancellationReason = undefined;
      await venueRepo.save(venue);
      res.status(200).json({ success: true, data: venue });
    } catch (err) {
      res.status(500).json({
        success: false,
        message: "Failed to change public approval status for venue",
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
      res.status(400).json({
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
      res.status(500).json({
        success: false,
        message: "Failed to reject venue",
        error: err instanceof Error ? err.message : err,
      });
    }
  }
  // --- Modular GET/UPDATE endpoints for venue amenities, booking conditions, variables ---
  static async getVenueAmenities(req: Request, res: Response): Promise<void> {
    const { venueId } = req.params;
    if (!venueId) {
      res.status(400).json({ success: false, message: "venueId is required" });
      return;
    }
    try {
      const venueRepo = AppDataSource.getRepository(Venue);
      const venue = await venueRepo.findOne({
        where: { venueId },
        relations: ["amenities"],
      });
      if (!venue) {
        res.status(404).json({ success: false, message: "Venue not found" });
        return;
      }
      res.status(200).json({ success: true, data: venue.amenities });
    } catch (err) {
      res.status(500).json({
        success: false,
        message: "Failed to get amenities",
        error: err instanceof Error ? err.message : err,
      });
    }
  }
  static async getVenueBookingConditions(
    req: Request,
    res: Response
  ): Promise<void> {
    const { venueId } = req.params;
    if (!venueId) {
      res.status(400).json({ success: false, message: "venueId is required" });
      return;
    }
    try {
      const venueRepo = AppDataSource.getRepository(Venue);
      const venue = await venueRepo.findOne({
        where: { venueId },
        relations: ["bookingConditions"],
      });
      if (!venue) {
        res.status(404).json({ success: false, message: "Venue not found" });
        return;
      }
      res.status(200).json({ success: true, data: venue.bookingConditions });
    } catch (err) {
      res.status(500).json({
        success: false,
        message: "Failed to get booking conditions",
        error: err instanceof Error ? err.message : err,
      });
    }
  }
  static async getVenueVariables(req: Request, res: Response): Promise<void> {
    const { venueId } = req.params;
    if (!venueId) {
      res.status(400).json({ success: false, message: "venueId is required" });
      return;
    }
    try {
      const venueRepo = AppDataSource.getRepository(Venue);
      const venue = await venueRepo.findOne({
        where: { venueId },
        relations: ["venueVariables", "venueVariables.manager"],
      });
      if (!venue) {
        res.status(404).json({ success: false, message: "Venue not found" });
        return;
      }
      res.status(200).json({ success: true, data: venue.venueVariables });
    } catch (err) {
      res.status(500).json({
        success: false,
        message: "Failed to get venue variables",
        error: err instanceof Error ? err.message : err,
      });
    }
  }
  static async getVenueAmenityById(req: Request, res: Response): Promise<void> {
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
      if (!amenity || !amenity.venue || amenity.venue.venueId !== venueId) {
        res.status(404).json({
          success: false,
          message: "Amenity not found for this venue",
        });
        return;
      }
      res.status(200).json({ success: true, data: amenity });
    } catch (err) {
      res.status(500).json({
        success: false,
        message: "Failed to get amenity",
        error: err instanceof Error ? err.message : err,
      });
    }
  }
  static async getVenueBookingConditionById(
    req: Request,
    res: Response
  ): Promise<void> {
    const { venueId, conditionId } = req.params;
    if (!venueId || !conditionId) {
      res.status(400).json({
        success: false,
        message: "venueId and conditionId are required",
      });
      return;
    }
    try {
      const bcRepo = AppDataSource.getRepository(BookingCondition);
      const condition = await bcRepo.findOne({
        where: { id: conditionId },
        relations: ["venue"],
      });
      if (
        !condition ||
        !condition.venue ||
        condition.venue.venueId !== venueId
      ) {
        res.status(404).json({
          success: false,
          message: "Booking condition not found for this venue",
        });
        return;
      }
      // Exclude the venue property from the response
      const { venue, ...conditionData } = condition;
      res.status(200).json({ success: true, data: conditionData });
    } catch (err) {
      res.status(500).json({
        success: false,
        message: "Failed to get booking condition",
        error: err instanceof Error ? err.message : err,
      });
    }
  }
  static async updateVenueBookingConditionById(
    req: Request,
    res: Response
  ): Promise<void> {
    const { venueId, conditionId } = req.params;
    if (!venueId || !conditionId) {
      res.status(400).json({
        success: false,
        message: "venueId and conditionId are required",
      });
      return;
    }
    try {
      const bcRepo = AppDataSource.getRepository(BookingCondition);
      const condition = await bcRepo.findOne({
        where: { id: conditionId },
        relations: ["venue"],
      });
      if (
        !condition ||
        !condition.venue ||
        condition.venue.venueId !== venueId
      ) {
        res.status(404).json({
          success: false,
          message: "Booking condition not found for this venue",
        });
        return;
      }
      // Update fields from req.body
      const {
        descriptionCondition,
        notaBene,
        transitionTime,
        depositRequiredPercent,
        depositRequiredTime,
        paymentComplementTimeBeforeEvent,
      } = req.body;
      if (descriptionCondition !== undefined)
        condition.descriptionCondition = descriptionCondition;
      if (notaBene !== undefined) condition.notaBene = notaBene;
      if (transitionTime !== undefined)
        condition.transitionTime = transitionTime;
      if (depositRequiredPercent !== undefined)
        condition.depositRequiredPercent = depositRequiredPercent;
      if (paymentComplementTimeBeforeEvent !== undefined)
        condition.paymentComplementTimeBeforeEvent =
          paymentComplementTimeBeforeEvent;
      await bcRepo.save(condition);
      // Exclude the venue property from the response
      const { venue, ...conditionData } = condition;
      res.status(200).json({ success: true, data: conditionData });
    } catch (err) {
      res.status(500).json({
        success: false,
        message: "Failed to update booking condition",
        error: err instanceof Error ? err.message : err,
      });
    }
  }
  static async getVenueVariableById(
    req: Request,
    res: Response
  ): Promise<void> {
    const { venueId, variableId } = req.params;
    if (!venueId || !variableId) {
      res.status(400).json({
        success: false,
        message: "venueId and variableId are required",
      });
      return;
    }
    try {
      const vvRepo = AppDataSource.getRepository(VenueVariable);
      const variable = await vvRepo.findOne({
        where: { id: variableId },
        relations: ["venue", "manager"],
      });
      if (!variable || !variable.venue || variable.venue.venueId !== venueId) {
        res.status(404).json({
          success: false,
          message: "Venue variable not found for this venue",
        });
        return;
      }
      res.status(200).json({ success: true, data: variable });
    } catch (err) {
      res.status(500).json({
        success: false,
        message: "Failed to get venue variable",
        error: err instanceof Error ? err.message : err,
      });
    }
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
      // Update fields from req.body
      const { resourceName, quantity, amenitiesDescription, costPerUnit } =
        req.body;
      if (resourceName !== undefined) amenity.resourceName = resourceName;
      if (quantity !== undefined) amenity.quantity = quantity;
      if (amenitiesDescription !== undefined)
        amenity.amenitiesDescription = amenitiesDescription;
      if (costPerUnit !== undefined) amenity.costPerUnit = costPerUnit;
      await vaRepo.save(amenity);
      res.status(200).json({ success: true, data: amenity });
    } catch (err) {
      res.status(500).json({
        success: false,
        message: "Failed to update amenity",
        error: err instanceof Error ? err.message : err,
      });
    }
  }
  static async updateVenueVariableById(
    req: Request,
    res: Response
  ): Promise<void> {
    const { venueId, variableId } = req.params;
    const { venueAmount, amount, venueManagerId, managerId } = req.body;

    if (!venueId || !variableId) {
      res.status(400).json({
        success: false,
        message: "venueId and variableId are required",
      });
      return;
    }

    try {
      const vvRepo = AppDataSource.getRepository(VenueVariable);
      const venueVariable = await vvRepo.findOne({
        where: { id: variableId, venue: { venueId } },
        relations: ["venue", "manager"],
      });
      if (!venueVariable) {
        res
          .status(404)
          .json({ success: false, message: "Venue variable not found" });
        return;
      }

      // Update amount/venueAmount
      if (venueAmount !== undefined)
        venueVariable.venueAmount = Number(venueAmount);
      if (amount !== undefined) venueVariable.venueAmount = Number(amount);

      // Update manager if provided
      const newManagerId = venueManagerId || managerId;
      if (newManagerId) {
        const userRepo = AppDataSource.getRepository(User);

        // First check if user exists with their organization
        const manager = await userRepo.findOne({
          where: { userId: newManagerId },
          relations: ["organizations"],
        });

        if (!manager) {
          res.status(404).json({
            success: false,
            message: "Manager not found",
          });
          return;
        }

        // Check if user has any organization
        if (!manager.organizations || manager.organizations.length === 0) {
          res.status(400).json({
            success: false,
            message:
              "User must belong to an organization to be assigned as manager.",
          });
          return;
        }

        // Find a non-Independent, approved organization
        const validOrg = manager.organizations.find(
          (org) =>
            org.organizationName !== "Independent" && org.status === "APPROVED"
        );

        if (!validOrg) {
          res.status(400).json({
            success: false,
            message:
              "User must have an approved, non-Independent organization to be assigned as manager.",
          });
          return;
        }

        venueVariable.manager = manager;
      }

      await vvRepo.save(venueVariable);
      res.status(200).json({ success: true, data: venueVariable });
    } catch (err) {
      res.status(500).json({
        success: false,
        message: "Failed to update venue variable",
        error: err instanceof Error ? err.message : err,
      });
    }
  }
  static async addVenueAmenity(req: Request, res: Response): Promise<void> {
    const { venueId } = req.params;
    if (!venueId) {
      res.status(400).json({ success: false, message: "venueId is required" });
      return;
    }
    let amenities = req.body;
    // If sent as string (from form-data), parse
    if (typeof amenities === "string") {
      try {
        amenities = JSON.parse(amenities);
      } catch (e) {
        res.status(400).json({
          success: false,
          message: "amenities must be a valid JSON object or array.",
        });
        return;
      }
    }
    // If not array, wrap as array
    if (!Array.isArray(amenities)) {
      amenities = [amenities];
    }
    try {
      const venueRepo = AppDataSource.getRepository(Venue);
      const vaRepo = AppDataSource.getRepository(VenueAmenities);
      const venue = await venueRepo.findOne({
        where: { venueId },
        relations: ["amenities"],
      });
      if (!venue) {
        res.status(404).json({ success: false, message: "Venue not found" });
        return;
      }
      // Prevent duplicate resourceName (case-insensitive, trimmed)
      const existingNames = new Set(
        (venue.amenities || []).map((a) => a.resourceName.trim().toLowerCase())
      );
      const toAdd = amenities.filter(
        (a: any) =>
          a &&
          a.resourceName &&
          !existingNames.has(a.resourceName.trim().toLowerCase())
      );
      const skipped = amenities.filter(
        (a: any) =>
          !a ||
          !a.resourceName ||
          existingNames.has(a.resourceName?.trim().toLowerCase())
      );
      const created = [];
      for (const amenity of toAdd) {
        const venueAmenity = vaRepo.create({ ...amenity, venue });
        created.push(await vaRepo.save(venueAmenity));
      }
      if (created.length === 1 && skipped.length === 0) {
        res.status(201).json({ success: true, data: created[0] });
      } else {
        res.status(201).json({ success: true, added: created, skipped });
      }
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

  static async addVenueResources(req: Request, res: Response): Promise<void> {
    const { venueId } = req.params;
    const resources = req.body.resources;
    if (!venueId || !Array.isArray(resources) || resources.length === 0) {
      res.status(400).json({
        success: false,
        message: "venueId and a non-empty resources array are required",
      });
      return;
    }
    try {
      const venueRepo = AppDataSource.getRepository(Venue);
      const resourceRepo = AppDataSource.getRepository("Resources");
      const venueResourceRepo = AppDataSource.getRepository("VenueResource");
      const venue = await venueRepo.findOne({ where: { venueId } });
      if (!venue) {
        res.status(404).json({ success: false, message: "Venue not found" });
        return;
      }
      // Get existing resources for this venue
      const existingVenueResources = await venueResourceRepo.find({
        where: { venue: { venueId } },
        relations: ["resource"],
      });
      const existingResourceIds = new Set(
        existingVenueResources.map((vr) => vr.resource.resourceId)
      );
      const toAdd = resources.filter(
        (r) => !existingResourceIds.has(r.resourceId)
      );
      const skipped = resources.filter((r) =>
        existingResourceIds.has(r.resourceId)
      );
      const created = [];
      for (const r of toAdd) {
        const resource = await resourceRepo.findOne({
          where: { resourceId: r.resourceId },
        });
        if (!resource) continue;
        const venueResource = venueResourceRepo.create({
          venue,
          resource,
          quantity: r.quantity,
        });
        created.push(await venueResourceRepo.save(venueResource));
      }
      res.status(201).json({ success: true, added: created, skipped });
    } catch (err) {
      res.status(500).json({
        success: false,
        message: "Failed to add resources to venue",
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

  // Helper to robustly delete a file from Cloudinary by URL
  static async deleteFromCloudinary(
    url: string,
    resourceType: "image" | "video" = "image"
  ) {
    if (!url) return;
    try {
      // Remove query params/fragments
      const cleanUrl = url.split("?")[0].split("#")[0];
      // Find the part after '/upload/'
      const match = cleanUrl.match(
        /\/upload\/(?:v\d+\/)?(.+?)(\.[a-zA-Z0-9]+)?$/
      );
      if (!match || !match[1]) {
        console.error(
          "Cloudinary delete error: Could not extract public_id from URL",
          url
        );
        return;
      }
      const publicId = match[1];
      await cloudinary.uploader.destroy(publicId, {
        resource_type: resourceType,
      });
    } catch (err) {
      console.error("Cloudinary delete error:", err, url);
    }
  }

  // PATCH /venues/:id - update general fields
  static async updateGeneralFields(req: Request, res: Response) {
    const { id } = req.params;
    const allowedFields = [
      "venueName",
      "venueLocation",
      "capacity",
      "description",
      "latitude",
      "longitude",
      "googleMapsLink",
      "venueTypeId",
      "venueDocuments",
    ];
    try {
      const venueRepo = AppDataSource.getRepository(Venue);
      const venue = await venueRepo.findOne({ where: { venueId: id } });
      if (!venue) {
        res.status(404).json({ success: false, message: "Venue not found" });
        return;
      }
      for (const field of allowedFields) {
        if (req.body[field] !== undefined)
          (venue as any)[field] = req.body[field];
      }
      await venueRepo.save(venue);
      res.status(200).json({ success: true, data: venue });
    } catch (err) {
      res.status(500).json({
        success: false,
        message: "Failed to update venue",
        error: err instanceof Error ? err.message : err,
      });
    }
  }

  // PATCH /venues/:id/main-photo - replace main photo
  static async updateMainPhoto(req: Request, res: Response) {
    const { id } = req.params;
    try {
      const venueRepo = AppDataSource.getRepository(Venue);
      const venue = await venueRepo.findOne({ where: { venueId: id } });
      if (!venue) {
        res.status(404).json({ success: false, message: "Venue not found" });
        return;
      }
      // Delete old photo from Cloudinary
      if (venue.mainPhotoUrl)
        await VenueController.deleteFromCloudinary(venue.mainPhotoUrl, "image");
      // Upload new photo
      const file = req.file;
      if (!file) {
        res.status(400).json({ success: false, message: "No file uploaded" });
        return;
      }
      const result = await CloudinaryUploadService.uploadBuffer(
        file.buffer,
        "venues/main_photos"
      );
      venue.mainPhotoUrl = result.url;
      await venueRepo.save(venue);
      res.status(200).json({ success: true, data: venue });
    } catch (err) {
      res.status(500).json({
        success: false,
        message: "Failed to update main photo",
        error: err instanceof Error ? err.message : err,
      });
    }
  }

  // POST /venues/:id/photo-gallery - add photo to gallery
  static async addPhotoToGallery(req: Request, res: Response) {
    const { id } = req.params;
    try {
      const venueRepo = AppDataSource.getRepository(Venue);
      const venue = await venueRepo.findOne({ where: { venueId: id } });
      if (!venue) {
        res.status(404).json({ success: false, message: "Venue not found" });
        return;
      }
      const file = req.file;
      if (!file) {
        res.status(400).json({ success: false, message: "No file uploaded" });
        return;
      }
      const result = await CloudinaryUploadService.uploadBuffer(
        file.buffer,
        "venues/gallery"
      );
      venue.photoGallery = Array.isArray(venue.photoGallery)
        ? venue.photoGallery
        : [];
      venue.photoGallery.push(result.url);
      await venueRepo.save(venue);
      res.status(200).json({ success: true, data: venue });
    } catch (err) {
      res.status(500).json({
        success: false,
        message: "Failed to add photo to gallery",
        error: err instanceof Error ? err.message : err,
      });
    }
  }

  // DELETE /venues/:id/photo-gallery - remove photo from gallery
  static async removePhotoFromGallery(req: Request, res: Response) {
    const { id } = req.params;
    const { photoUrl } = req.body;
    try {
      const venueRepo = AppDataSource.getRepository(Venue);
      const venue = await venueRepo.findOne({ where: { venueId: id } });
      if (!venue) {
        res.status(404).json({ success: false, message: "Venue not found" });
        return;
      }
      if (!photoUrl) {
        res
          .status(400)
          .json({ success: false, message: "photoUrl is required" });
        return;
      }
      venue.photoGallery = (venue.photoGallery || []).filter(
        (url) => url !== photoUrl
      );
      await VenueController.deleteFromCloudinary(photoUrl, "image");
      await venueRepo.save(venue);
      res.status(200).json({ success: true, data: venue });
    } catch (err) {
      res.status(500).json({
        success: false,
        message: "Failed to remove photo from gallery",
        error: err instanceof Error ? err.message : err,
      });
    }
  }

  // PATCH /venues/:id/virtual-tour - replace virtual tour video
  static async updateVirtualTour(req: Request, res: Response) {
    const { id } = req.params;
    try {
      const venueRepo = AppDataSource.getRepository(Venue);
      const venue = await venueRepo.findOne({ where: { venueId: id } });
      if (!venue) {
        res.status(404).json({ success: false, message: "Venue not found" });
        return;
      }
      // Delete old video from Cloudinary
      if (venue.virtualTourUrl)
        await VenueController.deleteFromCloudinary(
          venue.virtualTourUrl,
          "video"
        );
      // Upload new video
      const file = req.file;
      if (!file) {
        res.status(400).json({ success: false, message: "No file uploaded" });
        return;
      }
      const result = await CloudinaryUploadService.uploadBuffer(
        file.buffer,
        "venues/virtual_tours"
      );
      venue.virtualTourUrl = result.url;
      await venueRepo.save(venue);
      res.status(200).json({ success: true, data: venue });
    } catch (err) {
      res.status(500).json({
        success: false,
        message: "Failed to update virtual tour",
        error: err instanceof Error ? err.message : err,
      });
    }
  }
}
