import { Request, Response } from "express";
import { AuthenticatedRequest } from "../middlewares/AuthMiddleware";
import { VenueBookingRepository } from "../repositories/VenueBookingRepository";
import { VenueBookingInterface } from "../interfaces/VenueBookingInterface";

export class VenueBookingController {
  private static readonly UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  /**
   * Create a new event booking
   * @route POST /api/bookings
   * @access Private (Authenticated Users)
   */
  static async createVenueBooking(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const bookingData: VenueBookingInterface = req.body;

      // Validate authentication
      if (!req.user || !req.user.userId || !req.user.organizationId) {
        console.log("User token data:", req.user);
        res.status(401).json({ success: false, message: "Unauthorized: User is not properly authenticated." });
        return;
      }

      const organizerId = req.user.userId;
      const organizationId = req.user.organizationId;

      // Validate UUIDs
      if (!this.UUID_REGEX.test(organizerId)) {
        console.log("Invalid UUID format for organizerId:", organizerId);
        res.status(400).json({ success: false, message: "Invalid user ID format in token." });
        return;
      }

      if (!this.UUID_REGEX.test(organizationId)) {
        console.log("Invalid UUID format for organizationId:", organizationId);
        res.status(400).json({ success: false, message: "Invalid organization ID format in token." });
        return;
      }

      // Validate required fields
      if (
        !bookingData.eventId ||
        !bookingData.venueId ||
        !bookingData.event?.startDate ||
        !bookingData.event?.endDate ||
        !bookingData.event?.startTime ||
        !bookingData.event?.endTime
      ) {
        res.status(400).json({ success: false, message: "Missing required fields: eventId, venueId, startDate, endDate, startTime, endTime." });
        return;
      }

      // Validate UUIDs for eventId and venueId
      if (!this.UUID_REGEX.test(bookingData.eventId)) {
        res.status(400).json({ success: false, message: "Invalid event ID format." });
        return;
      }

      if (!this.UUID_REGEX.test(bookingData.venueId)) {
        res.status(400).json({ success: false, message: "Invalid venue ID format." });
        return;
      }

      // Validate dates
      const startDate = new Date(bookingData.event.startDate);
      const endDate = new Date(bookingData.event.endDate);
      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        res.status(400).json({ success: false, message: "Invalid date format." });
        return;
      }

      if (startDate > endDate) {
        res.status(400).json({ success: false, message: "Start date cannot be after end date." });
        return;
      }

      // Check organization existence
      const organization = await VenueBookingRepository.getOrganizationRepository().findOne({
        where: { organizationId },
      });
      if (!organization) {
        console.log("Organization not found:", organizationId);
        res.status(404).json({ success: false, message: "Organization not found." });
        return;
      }

      // Validate organizer and organization membership
      const organizer = await VenueBookingRepository.getUserRepository().findOne({
        where: { userId: organizerId },
        relations: ["organizations"],
      });
      if (!organizer) {
        res.status(404).json({ success: false, message: "Organizer not found." });
        return;
      }

      const userBelongsToOrg = organizer.organizations.some(org => org.organizationId === organizationId);
      if (!userBelongsToOrg) {
        res.status(403).json({ success: false, message: "Forbidden: User is not part of the specified organization." });
        return;
      }

      // Check for duplicate bookings
      const conflictCheck = await VenueBookingRepository.checkDuplicateBookings(
        bookingData.venueId,
        startDate,
        endDate,
        bookingData.event.startTime,
        bookingData.event.endTime
      );
      if (!conflictCheck.success) {
        res.status(400).json({ success: false, message: conflictCheck.message });
        return;
      }

      // Create booking
      const result = await VenueBookingRepository.createBooking({
        ...bookingData,
        organizerId,
        organizationId,
        approvalStatus: bookingData.approvalStatus || "pending",
      });

      if (result.success && result.data) {
        res.status(201).json({ success: true, message: "Event booking created successfully.", data: result.data });
      } else {
        res.status(500).json({ success: false, message: result.message || "Failed to create event booking." });
      }
    } catch (error) {
      console.error("Error in createVenueBooking:", error);
      res.status(500).json({ success: false, message: "Internal Server Error." });
    }
  }

  /**
   * Create multiple event bookings
   * @route POST /api/bookings/bulk
   * @access Private (Authenticated Users)
   */
  static async createMultipleVenueBookings(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const bookingsData: VenueBookingInterface[] = req.body.bookings;

      // Validate authentication
      if (!req.user || !req.user.userId || !req.user.organizationId) {
        res.status(401).json({ success: false, message: "Unauthorized: User is not properly authenticated." });
        return;
      }

      const organizerId = req.user.userId;
      const organizationId = req.user.organizationId;

      // Validate input
      if (!bookingsData || !Array.isArray(bookingsData) || bookingsData.length === 0) {
        res.status(400).json({ success: false, message: "An array of booking data is required." });
        return;
      }

      // Validate UUIDs and organization
      const organization = await VenueBookingRepository.getOrganizationRepository().findOne({
        where: { organizationId },
      });
      if (!organization) {
        res.status(404).json({ success: false, message: "Organization not found." });
        return;
      }

      const organizer = await VenueBookingRepository.getUserRepository().findOne({
        where: { userId: organizerId },
        relations: ["organizations"],
      });
      if (!organizer || !organizer.organizations.some(org => org.organizationId === organizationId)) {
        res.status(403).json({ success: false, message: "Forbidden: User is not part of the specified organization." });
        return;
      }

      // Prepare bookings with organizerId and organizationId
      const preparedBookings = bookingsData.map(booking => ({
        ...booking,
        organizerId,
        organizationId,
        approvalStatus: booking.approvalStatus || "pending",
      }));

      // Create bookings
      const result = await VenueBookingRepository.createMultipleBookings(preparedBookings);

      res.status(result.success ? 201 : 207).json({
        success: result.success,
        message: result.success ? "All bookings created successfully." : "Some bookings failed to create.",
        data: result.bookings,
        errors: result.errors,
      });
    } catch (error) {
      console.error("Error in createMultipleVenueBookings:", error);
      res.status(500).json({ success: false, message: "Internal Server Error." });
    }
  }

  /**
   * Get all event bookings
   * @route GET /api/bookings
   * @access Private (Admins)
   */
  static async getAllVenueBookings(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user || !req.user.userId) {
        res.status(401).json({ success: false, message: "Unauthorized: Authentication required." });
        return;
      }

      const result = await VenueBookingRepository.getAllBookings();

      if (result.success && result.data) {
        res.status(200).json({
          success: true,
          message: result.data.length ? "Event bookings retrieved successfully." : "No event bookings found.",
          data: result.data,
        });
      } else {
        res.status(500).json({ success: false, message: result.message || "Failed to retrieve event bookings." });
      }
    } catch (error) {
      console.error("Error in getAllVenueBookings:", error);
      res.status(500).json({ success: false, message: "Internal Server Error." });
    }
  }

  /**
   * Get event booking by ID
   * @route GET /api/bookings/:id
   * @access Private (Booking Owner, Event Organizer, Admins)
   */
  static async getVenueBookingById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      if (!id || !this.UUID_REGEX.test(id)) {
        res.status(400).json({ success: false, message: "Invalid or missing booking ID." });
        return;
      }

      const result = await VenueBookingRepository.getBookingById(id);

      if (result.success && result.data) {
        res.status(200).json({ success: true, message: "Event booking retrieved successfully.", data: result.data });
      } else {
        res.status(404).json({ success: false, message: result.message || "Event booking not found." });
      }
    } catch (error) {
      console.error("Error in getVenueBookingById:", error);
      res.status(500).json({ success: false, message: "Internal Server Error." });
    }
  }

  /**
   * Update event booking
   * @route PUT /api/bookings/:id
   * @access Private (Booking Owner, Event Organizer, Admins)
   */
  static async updateVenueBooking(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const updates: Partial<VenueBookingInterface> = req.body;

      if (!req.user || !req.user.userId) {
        res.status(401).json({ success: false, message: "Unauthorized: Authentication required." });
        return;
      }

      if (!id || !this.UUID_REGEX.test(id)) {
        res.status(400).json({ success: false, message: "Invalid or missing booking ID." });
        return;
      }

      if (Object.keys(updates).length === 0) {
        res.status(400).json({ success: false, message: "No update data provided." });
        return;
      }

      // Validate UUIDs if provided
      if (updates.eventId && !this.UUID_REGEX.test(updates.eventId)) {
        res.status(400).json({ success: false, message: "Invalid event ID format." });
        return;
      }

      if (updates.venueId && !this.UUID_REGEX.test(updates.venueId)) {
        res.status(400).json({ success: false, message: "Invalid venue ID format." });
        return;
      }

      // Validate dates if provided
      if (updates.event?.startDate || updates.event?.endDate) {
        const startDate = updates.event?.startDate ? new Date(updates.event.startDate) : undefined;
        const endDate = updates.event?.endDate ? new Date(updates.event.endDate) : undefined;

        if ((startDate && isNaN(startDate.getTime())) || (endDate && isNaN(endDate.getTime()))) {
          res.status(400).json({ success: false, message: "Invalid date format." });
          return;
        }

        if (startDate && endDate && startDate > endDate) {
          res.status(400).json({ success: false, message: "Start date cannot be after end date." });
          return;
        }
      }

      // Validate approval status
      if (updates.approvalStatus && !["pending", "approved", "rejected"].includes(updates.approvalStatus)) {
        res.status(400).json({ success: false, message: "Invalid approval status." });
        return;
      }

      const result = await VenueBookingRepository.updateBooking(id, updates);

      if (result.success && result.data) {
        res.status(200).json({ success: true, message: "Event booking updated successfully.", data: result.data });
      } else {
        res.status(404).json({ success: false, message: result.message || "Event booking not found." });
      }
    } catch (error) {
      console.error("Error in updateVenueBooking:", error);
      res.status(500).json({ success: false, message: "Internal Server Error." });
    }
  }

  /**
   * Update event booking status
   * @route PATCH /api/bookings/:id/status
   * @access Private (Event Organizer, Admins)
   */
  static async updateVenueBookingStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { approvalStatus } = req.body;

      if (!req.user || !req.user.userId) {
        res.status(401).json({ success: false, message: "Unauthorized: Authentication required." });
        return;
      }

      if (!id || !this.UUID_REGEX.test(id)) {
        res.status(400).json({ success: false, message: "Invalid or missing booking ID." });
        return;
      }

      if (!approvalStatus || !["pending", "approved", "rejected"].includes(approvalStatus)) {
        res.status(400).json({ success: false, message: "Invalid or missing approval status." });
        return;
      }

      const result = await VenueBookingRepository.updateBookingStatus(id, approvalStatus as "pending" | "approved" | "rejected");

      if (result.success && result.data) {
        res.status(200).json({ success: true, message: "Event booking status updated successfully.", data: result.data });
      } else {
        res.status(404).json({ success: false, message: result.message || "Event booking not found." });
      }
    } catch (error) {
      console.error("Error in updateVenueBookingStatus:", error);
      res.status(500).json({ success: false, message: "Internal Server Error." });
    }
  }

  /**
   * Delete an event booking
   * @route DELETE /api/bookings/:id
   * @access Private (Booking Owner, Event Organizer, Admins)
   */
  static async deleteVenueBooking(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      if (!req.user || !req.user.userId) {
        res.status(401).json({ success: false, message: "Unauthorized: Authentication required." });
        return;
      }

      if (!id || !this.UUID_REGEX.test(id)) {
        res.status(400).json({ success: false, message: "Invalid or missing booking ID." });
        return;
      }

      const result = await VenueBookingRepository.deleteBooking(id);

      if (result.success) {
        res.status(204).send();
      } else {
        res.status(404).json({ success: false, message: result.message || "Event booking not found." });
      }
    } catch (error) {
      console.error("Error in deleteVenueBooking:", error);
      res.status(500).json({ success: false, message: "Internal Server Error." });
    }
  }

  /**
   * Get bookings by event ID
   * @route GET /api/events/:eventId/bookings
   * @access Private (Event Organizer, Admins)
   */
  static async getBookingsByEventId(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { eventId } = req.params;

      if (!req.user || !req.user.userId) {
        res.status(401).json({ success: false, message: "Unauthorized: Authentication required." });
        return;
      }

      if (!eventId || !this.UUID_REGEX.test(eventId)) {
        res.status(400).json({ success: false, message: "Invalid or missing event ID." });
        return;
      }

      const result = await VenueBookingRepository.getBookingsByEventId(eventId);

      if (result.success && result.data) {
        res.status(200).json({
          success: true,
          message: result.data.length ? "Bookings retrieved successfully." : "No bookings found for this event.",
          data: result.data,
        });
      } else {
        res.status(500).json({ success: false, message: result.message || "Failed to retrieve bookings." });
      }
    } catch (error) {
      console.error("Error in getBookingsByEventId:", error);
      res.status(500).json({ success: false, message: "Internal Server Error." });
    }
  }

  /**
   * Get bookings by venue ID
   * @route GET /api/venues/:venueId/bookings
   * @access Private (Venue Owner, Admins)
   */
  static async getBookingsByVenueId(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { venueId } = req.params;

      if (!req.user || !req.user.userId) {
        res.status(401).json({ success: false, message: "Unauthorized: Authentication required." });
        return;
      }

      if (!venueId || !this.UUID_REGEX.test(venueId)) {
        res.status(400).json({ success: false, message: "Invalid or missing venue ID." });
        return;
      }

      const result = await VenueBookingRepository.getBookingsByVenueId(venueId);

      if (result.success && result.data) {
        res.status(200).json({
          success: true,
          message: result.data.length ? "Bookings retrieved successfully." : "No bookings found for this venue.",
          data: result.data,
        });
      } else {
        res.status(500).json({ success: false, message: result.message || "Failed to retrieve bookings." });
      }
    } catch (error) {
      console.error("Error in getBookingsByVenueId:", error);
      res.status(500).json({ success: false, message: "Internal Server Error." });
    }
  }

  /**
   * Get bookings by organizer ID
   * @route GET /api/bookings/organizer
   * @access Private (Authenticated Organizer)
   */
  static async getBookingsByOrganizerId(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user || !req.user.userId) {
        res.status(401).json({ success: false, message: "Unauthorized: Authentication required." });
        return;
      }

      const organizerId = req.user.userId;

      if (!this.UUID_REGEX.test(organizerId)) {
        res.status(400).json({ success: false, message: "Invalid organizer ID format." });
        return;
      }

      const result = await VenueBookingRepository.getBookingsByOrganizerId(organizerId);

      if (result.success && result.data) {
        res.status(200).json({
          success: true,
          message: result.data.length ? "Bookings retrieved successfully." : "No bookings found for this organizer.",
          data: result.data,
        });
      } else {
        res.status(500).json({ success: false, message: result.message || "Failed to retrieve bookings." });
      }
    } catch (error) {
      console.error("Error in getBookingsByOrganizerId:", error);
      res.status(500).json({ success: false, message: "Internal Server Error." });
    }
  }

  /**
   * Get bookings by organization ID
   * @route GET /api/organizations/:organizationId/bookings
   * @access Private (Organization Members, Admins)
   */
  static async getBookingsByOrganizationId(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { organizationId } = req.params;

      if (!req.user || !req.user.userId) {
        res.status(401).json({ success: false, message: "Unauthorized: Authentication required." });
        return;
      }

      if (!organizationId || !this.UUID_REGEX.test(organizationId)) {
        res.status(400).json({ success: false, message: "Invalid or missing organization ID." });
        return;
      }

      // Verify user belongs to organization
      const user = await VenueBookingRepository.getUserRepository().findOne({
        where: { userId: req.user.userId },
        relations: ["organizations"],
      });
      if (!user || !user.organizations.some(org => org.organizationId === organizationId)) {
        res.status(403).json({ success: false, message: "Forbidden: User is not part of the specified organization." });
        return;
      }

      const result = await VenueBookingRepository.getBookingsByOrganizationId(organizationId);

      if (result.success && result.data) {
        res.status(200).json({
          success: true,
          message: result.data.length ? "Bookings retrieved successfully." : "No bookings found for this organization.",
          data: result.data,
        });
      } else {
        res.status(500).json({ success: false, message: result.message || "Failed to retrieve bookings." });
      }
    } catch (error) {
      console.error("Error in getBookingsByOrganizationId:", error);
      res.status(500).json({ success: false, message: "Internal Server Error." });
    }
  }

  /**
   * Get bookings by approval status
   * @route GET /api/bookings/status/:status
   * @access Private (Admins)
   */
  static async getBookingsByStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { status } = req.params;

      if (!req.user || !req.user.userId) {
        res.status(401).json({ success: false, message: "Unauthorized: Authentication required." });
        return;
      }

      if (!status || !["pending", "approved", "rejected"].includes(status)) {
        res.status(400).json({ success: false, message: "Invalid or missing status." });
        return;
      }

      const result = await VenueBookingRepository.getBookingsByStatus(status as "pending" | "approved" | "rejected");

      if (result.success && result.data) {
        res.status(200).json({
          success: true,
          message: result.data.length ? `Bookings with status '${status}' retrieved successfully.` : `No bookings found with status: ${status}.`,
          data: result.data,
        });
      } else {
        res.status(500).json({ success: false, message: result.message || "Failed to retrieve bookings." });
      }
    } catch (error) {
      console.error("Error in getBookingsByStatus:", error);
      res.status(500).json({ success: false, message: "Internal Server Error." });
    }
  }

  /**
   * Get bookings by date range
   * @route GET /api/bookings/date-range
   * @access Private (Admins)
   */
  static async getBookingsByDateRange(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { startDate, endDate, filterOptions } = req.query;

      if (!req.user || !req.user.userId) {
        res.status(401).json({ success: false, message: "Unauthorized: Authentication required." });
        return;
      }

      if (!startDate || !endDate) {
        res.status(400).json({ success: false, message: "Start date and end date are required." });
        return;
      }

      const parsedStartDate = new Date(startDate as string);
      const parsedEndDate = new Date(endDate as string);

      if (isNaN(parsedStartDate.getTime()) || isNaN(parsedEndDate.getTime())) {
        res.status(400).json({ success: false, message: "Invalid date format." });
        return;
      }

      if (parsedStartDate > parsedEndDate) {
        res.status(400).json({ success: false, message: "Start date cannot be after end date." });
        return;
      }

      // Parse filter options
      let filters: ("min" | "hours" | "days" | "all")[] = ["all"];
      if (filterOptions) {
        const options = Array.isArray(filterOptions) ? filterOptions : [filterOptions];
        filters = options.filter(opt => ["min", "hours", "days", "all"].includes(opt as string)) as ("min" | "hours" | "days" | "all")[];
        if (filters.length === 0) {
          res.status(400).json({ success: false, message: "Invalid filter options. Use 'min', 'hours', 'days', or 'all'." });
          return;
        }
      }

      const result = await VenueBookingRepository.getBookingsByDateRange(parsedStartDate, parsedEndDate, filters);

      if (result.success && result.data) {
        res.status(200).json({
          success: true,
          message: result.data.length ? "Bookings retrieved successfully." : "No bookings found for the selected date range.",
          data: result.data,
        });
      } else {
        res.status(500).json({ success: false, message: result.message || "Failed to retrieve bookings." });
      }
    } catch (error) {
      console.error("Error in getBookingsByDateRange:", error);
      res.status(500).json({ success: false, message: "Internal Server Error." });
    }
  }

  /**
   * Check for duplicate bookings in a specific time range
   * @route GET /api/bookings/check-duplicates
   * @access Private (Authenticated Users)
   */
  static async checkDuplicateBookings(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { venueId, startDate, endDate, startTime, endTime } = req.query;

      if (!req.user || !req.user.userId) {
        res.status(401).json({ success: false, message: "Unauthorized: Authentication required." });
        return;
      }

      if (!venueId || !startDate || !endDate) {
        res.status(400).json({ success: false, message: "Venue ID, start date, and end date are required." });
        return;
      }

      if (!this.UUID_REGEX.test(venueId as string)) {
        res.status(400).json({ success: false, message: "Invalid venue ID format." });
        return;
      }

      const parsedStartDate = new Date(startDate as string);
      const parsedEndDate = new Date(endDate as string);

      if (isNaN(parsedStartDate.getTime()) || isNaN(parsedEndDate.getTime())) {
        res.status(400).json({ success: false, message: "Invalid date format." });
        return;
      }

      if (parsedStartDate > parsedEndDate) {
        res.status(400).json({ success: false, message: "Start date cannot be after end date." });
        return;
      }

      const result = await VenueBookingRepository.checkDuplicateBookings(
        venueId as string,
        parsedStartDate,
        parsedEndDate,
        startTime as string,
        endTime as string
      );

      if (result.success) {
        res.status(200).json({ success: true, message: "No conflicting bookings found.", data: [] });
      } else {
        res.status(200).json({
          success: false,
          message: result.message || "Conflicting bookings found.",
          data: result.conflicts || [],
        });
      }
    } catch (error) {
      console.error("Error in checkDuplicateBookings:", error);
      res.status(500).json({ success: false, message: "Internal Server Error." });
    }
  }

  /**
   * Handle Method Not Allowed
   * @route Any unsupported HTTP method
   * @access Public
   */
  static async methodNotAllowed(req: Request, res: Response): Promise<void> {
    res.status(405).json({ success: false, message: "Method Not Allowed: This HTTP method is not supported for this endpoint." });
  }

  /**
   * Handle Unauthorized
   * @route Any route requiring authentication
   * @access Public
   */
  static async unauthorized(req: Request, res: Response): Promise<void> {
    res.status(401).json({ success: false, message: "Unauthorized: Authentication is required or has failed." });
  }

  /**
   * Handle Forbidden
   * @route Any route requiring specific permissions
   * @access Private (Authenticated Users)
   */
  static async forbidden(req: Request, res: Response): Promise<void> {
    res.status(403).json({ success: false, message: "Forbidden: You do not have permission to perform this action." });
  }
}