"use strict";
// import { Request, Response, Router } from "express";
// // import { VenueBookingRepository } from "../repositories/VenueBookingRepository";
// import { VenueBookingInterface } from "../interfaces/VenueBookingInterface";
// import { ApprovalStatus } from "../models/VenueBooking";
// import { validate } from "class-validator";
// import { AppDataSource } from "../config/Database"; // adjust path as needed
// import { Venue } from "../models/Venue Tables/Venue";
// export class VenueBookingController {
//   // Create a single booking
//   static async createBooking(req: Request, res: Response): Promise<void> {
//     try {
//       // Extract fields one by one from req.body
//       const bookingData: Partial<VenueBookingInterface> = {
//         eventId: req.body.eventId,
//         venueId: req.body.venueId,
//         venueInvoiceId: req.body.venueInvoiceId,
//         approvalStatus: req.body.approvalStatus,
//         notes: req.body.notes,
//         totalAmountDue: req.body.totalAmountDue,
//         event: req.body.event,
//       };
//       // Set fields from token
//       if (!req.user) {
//         res.status(401).json({
//           success: false,
//           message: "Unauthorized: User token required.",
//         });
//         return;
//       }
//       bookingData.userId = req.user.id;
//       bookingData.organizerId = req.user.id;
//       bookingData.organizationId = req.user.organizationId;
//       // Create and validate instance
//       const bookingInstance = new VenueBookingInterface(bookingData);
//       const errors = await validate(bookingInstance, {
//         forbidUnknownValues: true,
//       });
//       if (errors.length > 0) {
//         res.status(400).json({
//           success: false,
//           message: `Validation errors: ${errors
//             .map((e) => Object.values(e.constraints || {}))
//             .join(", ")}`,
//         });
//         return;
//       }
//       // Validate custom logic
//       const validationErrors = VenueBookingInterface.validate(bookingData);
//       if (validationErrors.length > 0) {
//         res.status(400).json({
//           success: false,
//           message: `Validation errors: ${validationErrors.join(", ")}`,
//         });
//         return;
//       }
//       // Create booking
//       const result = await VenueBookingRepository.createBooking(
//         bookingInstance
//       );
//       if (!result.success) {
//         res.status(400).json({ success: false, message: result.message });
//         return;
//       }
//       res.status(201).json({
//         success: true,
//         message: result.message,
//         data: result.data,
//       });
//     } catch (error) {
//       console.error("Error creating booking:", error);
//       res.status(500).json({
//         success: false,
//         message: `Failed to create booking: ${
//           error instanceof Error ? error.message : "Unknown error"
//         }`,
//       });
//     }
//   }
//   // Create multiple bookings
//   static async createMultipleBookings(
//     req: Request,
//     res: Response
//   ): Promise<void> {
//     try {
//       const bookingsData: VenueBookingInterface[] = req.body;
//       // Validate each booking and build a list of venueIds
//       const venueIds = [];
//       for (let i = 0; i < bookingsData.length; i++) {
//         bookingsData[i].organizerId = req.user?.id;
//         const bookingInstance = new VenueBookingInterface(bookingsData[i]);
//         const errors = await validate(bookingInstance);
//         if (errors.length > 0) {
//           res.status(400).json({
//             success: false,
//             message: `Validation errors in booking at index ${i} (eventId: ${
//               bookingsData[i].eventId
//             }, venueId: ${bookingsData[i].venueId}): ${errors
//               .map((e) => Object.values(e.constraints || {}))
//               .join(", ")}`,
//           });
//           return;
//         }
//         bookingsData[i] = bookingInstance;
//         venueIds.push(bookingInstance.venueId);
//       }
//       // Fetch all venues in one query
//       const venueRepo = AppDataSource.getRepository(Venue);
//       const venues = await venueRepo.findByIds(venueIds);
//       if (venues.length !== bookingsData.length) {
//         res.status(400).json({
//           success: false,
//           message: "One or more venues do not exist.",
//         });
//         return;
//       }
//       // Check all venues have the same organizationId and location
//       const firstOrgId = venues[0].organizationId;
//       const firstLocation = venues[0].venueLocation;
//       const invalidVenue = venues.find(
//         (v) =>
//           v.organizationId !== firstOrgId || v.venueLocation !== firstLocation
//       );
//       if (invalidVenue) {
//         res.status(400).json({
//           success: false,
//           message: `All venues must belong to the same organization and have the same location. Venue ${invalidVenue.venueId} does not match.`,
//         });
//         return;
//       }
//       const result = await VenueBookingRepository.createMultipleBookings(
//         bookingsData
//       );
//       res.status(result.success ? 201 : 400).json({
//         success: result.success,
//         message: result.success
//           ? "Bookings created successfully."
//           : "Some bookings failed to create.",
//         data: { bookings: result.bookings, errors: result.errors },
//       });
//     } catch (error) {
//       console.error("Error creating multiple bookings:", error);
//       res.status(500).json({
//         success: false,
//         message: `Failed to create multiple bookings: ${
//           error instanceof Error ? error.message : "Unknown error"
//         }`,
//       });
//     }
//   }
//   // Get all bookings
//   static async getAllBookings(req: Request, res: Response): Promise<void> {
//     try {
//       const result = await VenueBookingRepository.getAllBookings();
//       res.status(200).json({
//         success: result.success,
//         message: result.message,
//         data: result.data,
//       });
//     } catch (error) {
//       console.error("Error fetching all bookings:", error);
//       res.status(500).json({
//         success: false,
//         message: `Failed to fetch bookings: ${
//           error instanceof Error ? error.message : "Unknown error"
//         }`,
//       });
//     }
//   }
//   // Get booking by ID
//   static async getBookingById(req: Request, res: Response): Promise<void> {
//     try {
//       const { id } = req.params;
//       const result = await VenueBookingRepository.getBookingById(id);
//       res.status(result.success ? 200 : 404).json({
//         success: result.success,
//         message: result.message,
//         data: result.data,
//       });
//     } catch (error) {
//       console.error("Error fetching booking by ID:", error);
//       res.status(500).json({
//         success: false,
//         message: `Failed to fetch booking: ${
//           error instanceof Error ? error.message : "Unknown error"
//         }`,
//       });
//     }
//   }
//   // Update a booking
//   static async updateBooking(req: Request, res: Response): Promise<void> {
//     try {
//       const { id } = req.params;
//       const bookingData: Partial<VenueBookingInterface> = req.body;
//       // Validate request body
//       const errors = await validate(bookingData);
//       if (errors.length > 0) {
//         res.status(400).json({
//           success: false,
//           message: `Validation errors: ${errors
//             .map((e) => Object.values(e.constraints || {}))
//             .join(", ")}`,
//         });
//         return;
//       }
//       const result = await VenueBookingRepository.updateBooking(
//         id,
//         bookingData
//       );
//       res.status(result.success ? 200 : 400).json({
//         success: result.success,
//         message: result.message,
//         data: result.data,
//       });
//     } catch (error) {
//       console.error("Error updating booking:", error);
//       res.status(500).json({
//         success: false,
//         message: `Failed to update booking: ${
//           error instanceof Error ? error.message : "Unknown error"
//         }`,
//       });
//     }
//   }
//   // Delete a booking
//   static async deleteBooking(req: Request, res: Response): Promise<void> {
//     try {
//       const { id } = req.params;
//       const result = await VenueBookingRepository.deleteBooking(id);
//       res.status(result.success ? 200 : 404).json({
//         success: result.success,
//         message: result.message,
//       });
//     } catch (error) {
//       console.error("Error deleting booking:", error);
//       res.status(500).json({
//         success: false,
//         message: `Failed to delete booking: ${
//           error instanceof Error ? error.message : "Unknown error"
//         }`,
//       });
//     }
//   }
//   // Update booking status
//   static async updateBookingStatus(req: Request, res: Response): Promise<void> {
//     try {
//       const { id } = req.params;
//       const { status } = req.body;
//       const normalizedStatus =
//         typeof status === "string" ? status.toLowerCase() : status;
//       console.log(
//         `[updateBookingStatus] PATCH /venue-bookings/${id}/status with status:`,
//         status,
//         `(normalized: ${normalizedStatus})`
//       );
//       if (!Object.values(ApprovalStatus).includes(normalizedStatus)) {
//         console.error(
//           `[updateBookingStatus] Invalid approval status received:`,
//           status
//         );
//         res.status(400).json({
//           success: false,
//           message: "Invalid approval status.",
//         });
//         return;
//       }
//       const result = await VenueBookingRepository.updateBookingStatus(
//         id,
//         normalizedStatus
//       );
//       if (!result.success) {
//         console.error(
//           `[updateBookingStatus] Failed to update booking status for ID ${id}:`,
//           result.message
//         );
//       }
//       res.status(result.success ? 200 : 400).json({
//         success: result.success,
//         message: result.message,
//         data: result.data,
//       });
//     } catch (error) {
//       console.error("Error updating booking status:", error);
//       res.status(500).json({
//         success: false,
//         message: `Failed to update booking status: ${
//           error instanceof Error ? error.message : "Unknown error"
//         }`,
//       });
//     }
//   }
//   // Get bookings by event ID
//   static async getBookingsByEventId(
//     req: Request,
//     res: Response
//   ): Promise<void> {
//     try {
//       const { eventId } = req.params;
//       const result = await VenueBookingRepository.getBookingsByEventId(eventId);
//       res.status(result.success ? 200 : 404).json({
//         success: result.success,
//         message: result.message,
//         data: result.data,
//       });
//     } catch (error) {
//       console.error("Error fetching bookings by event ID:", error);
//       res.status(500).json({
//         success: false,
//         message: `Failed to fetch bookings: ${
//           error instanceof Error ? error.message : "Unknown error"
//         }`,
//       });
//     }
//   }
//   // Get bookings by venue ID
//   static async getBookingsByVenueId(
//     req: Request,
//     res: Response
//   ): Promise<void> {
//     try {
//       const { venueId } = req.params;
//       const result = await VenueBookingRepository.getBookingsByVenueId(venueId);
//       res.status(result.success ? 200 : 404).json({
//         success: result.success,
//         message: result.message,
//         data: result.data,
//       });
//     } catch (error) {
//       console.error("Error fetching bookings by venue ID:", error);
//       res.status(500).json({
//         success: false,
//         message: `Failed to fetch bookings: ${
//           error instanceof Error ? error.message : "Unknown error"
//         }`,
//       });
//     }
//   }
//   // Get bookings by organizer ID
//   static async getBookingsByOrganizerId(
//     req: Request,
//     res: Response
//   ): Promise<void> {
//     try {
//       const { organizerId } = req.params;
//       const result = await VenueBookingRepository.getBookingsByOrganizerId(
//         organizerId
//       );
//       res.status(result.success ? 200 : 404).json({
//         success: result.success,
//         message: result.message,
//         data: result.data,
//       });
//     } catch (error) {
//       console.error("Error fetching bookings by organizer ID:", error);
//       res.status(500).json({
//         success: false,
//         message: `Failed to fetch bookings: ${
//           error instanceof Error ? error.message : "Unknown error"
//         }`,
//       });
//     }
//   }
//   // Get bookings by organization ID
//   static async getBookingsByOrganizationId(
//     req: Request,
//     res: Response
//   ): Promise<void> {
//     try {
//       const { organizationId } = req.params;
//       const result = await VenueBookingRepository.getBookingsByOrganizationId(
//         organizationId
//       );
//       res.status(result.success ? 200 : 404).json({
//         success: result.success,
//         message: result.message,
//         data: result.data,
//       });
//     } catch (error) {
//       console.error("Error fetching bookings by organization ID:", error);
//       res.status(500).json({
//         success: false,
//         message: `Failed to fetch bookings: ${
//           error instanceof Error ? error.message : "Unknown error"
//         }`,
//       });
//     }
//   }
//   // Get bookings by status
//   static async getBookingsByStatus(req: Request, res: Response): Promise<void> {
//     try {
//       const { status } = req.params;
//       if (!Object.values(ApprovalStatus).includes(status as ApprovalStatus)) {
//         res.status(400).json({
//           success: false,
//           message: "Invalid approval status.",
//         });
//         return;
//       }
//       const result = await VenueBookingRepository.getBookingsByStatus(
//         status as ApprovalStatus
//       );
//       res.status(result.success ? 200 : 404).json({
//         success: result.success,
//         message: result.message,
//         data: result.data,
//       });
//     } catch (error) {
//       console.error("Error fetching bookings by status:", error);
//       res.status(500).json({
//         success: false,
//         message: `Failed to fetch bookings: ${
//           error instanceof Error ? error.message : "Unknown error"
//         }`,
//       });
//     }
//   }
//   // Get bookings by date range
//   static async getBookingsByDateRange(
//     req: Request,
//     res: Response
//   ): Promise<void> {
//     try {
//       const { startDate, endDate } = req.params;
//       const filterOptions = ((req.query.filterOptions as string)?.split(
//         ","
//       ) as ("min" | "hours" | "days" | "all")[]) || ["all"];
//       const start = new Date(startDate);
//       const end = new Date(endDate);
//       if (isNaN(start.getTime()) || isNaN(end.getTime())) {
//         res.status(400).json({
//           success: false,
//           message: "Invalid date format.",
//         });
//         return;
//       }
//       const result = await VenueBookingRepository.getBookingsByDateRange(
//         start,
//         end,
//         filterOptions
//       );
//       res.status(result.success ? 200 : 404).json({
//         success: result.success,
//         message: result.message,
//         data: result.data,
//       });
//     } catch (error) {
//       console.error("Error fetching bookings by date range:", error);
//       res.status(500).json({
//         success: false,
//         message: `Failed to fetch bookings: ${
//           error instanceof Error ? error.message : "Unknown error"
//         }`,
//       });
//     }
//   }
//   // Get total booking amount for an event
//   static async getTotalBookingAmountForEvent(
//     req: Request,
//     res: Response
//   ): Promise<void> {
//     try {
//       const { eventId } = req.params;
//       const result = await VenueBookingRepository.getTotalBookingAmountForEvent(
//         eventId
//       );
//       res.status(result.success ? 200 : 404).json({
//         success: result.success,
//         message: result.message,
//         data: { totalAmount: result.totalAmount },
//       });
//     } catch (error) {
//       console.error("Error fetching total booking amount:", error);
//       res.status(500).json({
//         success: false,
//         message: `Failed to fetch total amount: ${
//           error instanceof Error ? error.message : "Unknown error"
//         }`,
//       });
//     }
//   }
// }
