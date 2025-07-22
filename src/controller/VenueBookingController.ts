import { Request, Response } from "express";
import { VenueBookingRepository } from "../repositories/VenueBookingRepository";
import { AppDataSource } from "../config/Database";
import { In } from "typeorm";
import { VenueBooking } from "../models/VenueBooking";
import { Event } from "../models/Event Tables/Event";
import { VenueVariable } from "../models/Venue Tables/VenueVariable";
import { User } from "../models/User";
import { VenueBookingPaymentService } from "../services/payments/VenueBookingPaymentService";
import {
  PaymentServiceResponse,
  PaymentServiceError,
} from "../interfaces/PaymentServiceInterface";

export class VenueBookingController {
  static async getAllBookings(req: Request, res: Response): Promise<void> {
    try {
      const result = await VenueBookingRepository.getAllBookings();
      res.status(200).json({
        success: result.success,
        message: result.message,
        data: result.data,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: `Failed to fetch bookings: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      });
    }
  }

  static async getBookingsByManagerId(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const { managerId } = req.params;

      // First, get all venues managed by this manager
      const venueVariableRepo = AppDataSource.getRepository(VenueVariable);
      const managedVenues = await venueVariableRepo.find({
        where: { manager: { userId: managerId } },
        relations: ["venue", "venue.bookingConditions"],
      });

      if (!managedVenues.length) {
        res.status(200).json({
          success: true,
          data: {
            bookings: [],
            summary: {
              totalVenues: 0,
              totalBookings: 0,
              totalAmount: 0,
              pendingBookings: 0,
              approvedBookings: 0,
              cancelledBookings: 0,
            },
          },
          message: "No venues found for this manager",
        });
        return;
      }

      const venueIds = managedVenues.map((vv) => vv.venue.venueId);

      // Get all bookings for these venues with necessary relations
      const bookingRepo = AppDataSource.getRepository(VenueBooking);
      const bookings = await bookingRepo.find({
        where: { venueId: In(venueIds) },
        relations: [
          "venue",
          "venue.bookingConditions",
          "venue.venueVariables",
          "event",
          "user", // Get user who made the booking
        ],
        order: {
          createdAt: "DESC", // Most recent first
        },
      });

      // Get user details for each booking
      const userRepo = AppDataSource.getRepository(User);
      const enrichedBookings = await Promise.all(
        bookings.map(async (booking) => {
          const venue = booking.venue;
          const event = booking.event;
          const bookingCondition = venue.bookingConditions[0];
          const venueAmount = venue.venueVariables[0]?.venueAmount || 0;

          // Get user who made the booking
          const user = await userRepo.findOne({
            where: { userId: booking.createdBy },
          });

          // Calculate deposit amount
          const depositAmount = bookingCondition?.depositRequiredPercent
            ? (venueAmount * bookingCondition.depositRequiredPercent) / 100
            : venueAmount;

          // Get earliest booking date
          const earliestDate = new Date(
            Math.min(
              ...booking.bookingDates.map((d) => new Date(d.date).getTime())
            )
          );
          const paymentDeadline =
            bookingCondition?.paymentComplementTimeBeforeEvent
              ? new Date(
                  earliestDate.getTime() -
                    bookingCondition.paymentComplementTimeBeforeEvent *
                      24 *
                      60 *
                      60 *
                      1000
                )
              : earliestDate;

          return {
            bookingId: booking.bookingId,
            eventDetails: {
              eventId: event?.eventId,
              eventName: event?.eventName,
              eventType: event?.eventType,
              eventDescription: event?.eventDescription,
            },
            venue: {
              venueId: venue.venueId,
              venueName: venue.venueName,
              location: venue.venueLocation,
              totalAmount: venueAmount,
              depositRequired: {
                percentage: bookingCondition?.depositRequiredPercent || 100,
                amount: depositAmount,
              },
              paymentCompletionRequired: {
                daysBeforeEvent:
                  bookingCondition?.paymentComplementTimeBeforeEvent || 0,
                amount: venueAmount - depositAmount,
                deadline: paymentDeadline,
              },
            },
            bookingDates: booking.bookingDates,
            bookingStatus: booking.bookingStatus,
            isPaid: booking.isPaid,
            createdAt: booking.createdAt,
            requester: user
              ? {
                  userId: user.userId,
                  firstName: user.firstName,
                  lastName: user.lastName,
                  email: user.email,
                  phoneNumber: user.phoneNumber,
                }
              : null,
            paymentSummary: {
              totalAmount: venueAmount,
              depositAmount: depositAmount,
              remainingAmount: venueAmount - depositAmount,
              paymentStatus: booking.isPaid ? "PAID" : "PENDING",
            },
          };
        })
      );

      // Calculate summary statistics
      const summary = {
        totalVenues: venueIds.length,
        totalBookings: bookings.length,
        totalAmount: enrichedBookings.reduce(
          (sum, b) => sum + b.paymentSummary.totalAmount,
          0
        ),
        pendingBookings: enrichedBookings.filter(
          (b) => b.bookingStatus === "PENDING"
        ).length,
        approvedBookings: enrichedBookings.filter((b) =>
          ["APPROVED_PAID", "APPROVED_NOT_PAID"].includes(b.bookingStatus)
        ).length,
        cancelledBookings: enrichedBookings.filter(
          (b) => b.bookingStatus === "CANCELLED"
        ).length,
        bookingsByVenue: venueIds.map((venueId) => ({
          venueId,
          venueName: managedVenues.find((v) => v.venue.venueId === venueId)
            ?.venue.venueName,
          totalBookings: enrichedBookings.filter(
            (b) => b.venue.venueId === venueId
          ).length,
        })),
        paymentSummary: {
          totalExpectedAmount: enrichedBookings.reduce(
            (sum, b) => sum + b.paymentSummary.totalAmount,
            0
          ),
          totalPaidAmount: enrichedBookings
            .filter((b) => b.isPaid)
            .reduce((sum, b) => sum + b.paymentSummary.totalAmount, 0),
          totalPendingAmount: enrichedBookings
            .filter((b) => !b.isPaid)
            .reduce((sum, b) => sum + b.paymentSummary.totalAmount, 0),
        },
      };

      res.status(200).json({
        success: true,
        data: {
          bookings: enrichedBookings,
          summary,
        },
        message: "Venue bookings fetched successfully",
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message:
          error instanceof Error ? error.message : "Failed to fetch bookings",
      });
    }
  }

  static async getBookingById(req: Request, res: Response): Promise<void> {
    try {
      const { bookingId } = req.params;
      const result = await VenueBookingRepository.getBookingById(bookingId);
      if (!result.success) {
        res.status(404).json({ success: false, message: result.message });
        return;
      }
      res.status(200).json({ success: true, data: result.data });
    } catch (error) {
      res.status(500).json({ success: false, message: "Server error." });
    }
  }

  static async approveBooking(req: Request, res: Response): Promise<void> {
    try {
      const { bookingId } = req.params;
      const result = await VenueBookingRepository.approveBooking(bookingId);
      if (!result.success) {
        res.status(400).json({ success: false, message: result.message });
        return;
      }
      res.status(200).json({ success: true, message: result.message });
    } catch (error) {
      res.status(500).json({ success: false, message: "Server error." });
    }
  }

  static async getPaymentsByManagerId(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const { managerId } = req.params;
      const result = await VenueBookingRepository.getPaymentsByManagerId(
        managerId
      );
      res.status(200).json(result);
    } catch (error) {
      res.status(500).json({ success: false, message: "Server error." });
    }
  }

  static async addPaymentToBooking(req: Request, res: Response): Promise<void> {
    try {
      const { bookingId } = req.params;
      const paymentData = {
        ...req.body,
        bookingId,
      };
      const result =
        await VenueBookingRepository.createVenueBookingPaymentWithDepositValidation(
          paymentData
        );
      res.status(201).json(result);
    } catch (error) {
      res.status(400).json({
        success: false,
        message:
          error instanceof Error ? error.message : "Failed to add payment.",
      });
    }
  }

  static async getPaymentsForBooking(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const { bookingId } = req.params;
      const paymentRepo = AppDataSource.getRepository(
        require("../models/VenueBookingPayment").VenueBookingPayment
      );
      const bookingRepo = AppDataSource.getRepository(
        require("../models/VenueBooking").VenueBooking
      );
      const conditionRepo = AppDataSource.getRepository(
        require("../models/Venue Tables/BookingCondition").BookingCondition
      );
      const userRepo = AppDataSource.getRepository(
        require("../models/User").User
      );
      const orgRepo = AppDataSource.getRepository(
        require("../models/Organization").Organization
      );

      const payments = await paymentRepo.find({ where: { bookingId } });
      const booking = await bookingRepo.findOne({ where: { bookingId } });
      if (!booking) {
        res.status(404).json({ success: false, message: "Booking not found" });
        return;
      }
      const condition = await conditionRepo.findOne({
        where: { venue: { venueId: booking.venueId } },
      });
      const totalPaid = payments.reduce(
        (sum: number, p: any) => sum + (p.amountPaid || 0),
        0
      );
      const requiredDeposit =
        ((booking.amountToBePaid || 0) *
          (condition?.depositRequiredPercent || 0)) /
        100;
      let depositPaidAt = null;
      let runningTotal = 0;
      for (const p of payments.sort(
        (a: any, b: any) => a.paymentDate.getTime() - b.paymentDate.getTime()
      )) {
        runningTotal += p.amountPaid || 0;
        if (runningTotal >= requiredDeposit) {
          depositPaidAt = p.paymentDate;
          break;
        }
      }
      const hoursSinceBooking = depositPaidAt
        ? (depositPaidAt.getTime() - booking.createdAt.getTime()) /
          (1000 * 60 * 60)
        : null;
      const depositFulfilled =
        totalPaid >= requiredDeposit &&
        hoursSinceBooking !== null &&
        hoursSinceBooking <= (condition?.depositRequiredTime || 0);
      // Enrich payments with payer info
      const enrichedPayments = await Promise.all(
        payments.map(async (payment: any) => {
          let payer = null;
          if (payment.payerType === "USER") {
            payer = await userRepo.findOne({
              where: { userId: payment.payerId },
            });
          } else if (payment.payerType === "ORGANIZATION") {
            payer = await orgRepo.findOne({
              where: { organizationId: payment.payerId },
            });
          }
          return { ...payment, payer };
        })
      );
      res.status(200).json({
        success: true,
        payments: enrichedPayments,
        totalPaid,
        requiredDeposit,
        depositFulfilled,
        booking,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Failed to fetch payments for booking.",
      });
    }
  }

  static async getPaymentsForUserBookings(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const { userId } = req.params;
      const paymentRepo = AppDataSource.getRepository(
        require("../models/VenueBookingPayment").VenueBookingPayment
      );
      const bookingRepo = AppDataSource.getRepository(
        require("../models/VenueBooking").VenueBooking
      );
      const venueRepo = AppDataSource.getRepository(
        require("../models/Venue Tables/Venue").Venue
      );
      // Find all bookings by this user
      const bookings = await bookingRepo.find({ where: { createdBy: userId } });
      const bookingIds = bookings.map((b: any) => b.bookingId);
      if (bookingIds.length === 0) {
        res.status(200).json({ success: true, payments: [] });
        return;
      }
      // Find all payments for these bookings
      const payments = await paymentRepo.find({
        where: { bookingId: In(bookingIds) },
      });
      // Enrich with booking and venue info
      const enrichedPayments = await Promise.all(
        payments.map(async (payment: any) => {
          const booking = bookings.find(
            (b: any) => b.bookingId === payment.bookingId
          );
          let venue = null;
          if (booking) {
            venue = await venueRepo.findOne({
              where: { venueId: booking.venueId },
            });
          }
          return { ...payment, booking, venue };
        })
      );
      res.status(200).json({ success: true, payments: enrichedPayments });
    } catch (error) {
      res
        .status(500)
        .json({ success: false, message: "Failed to fetch user payments." });
    }
  }

  static async getUserBookings(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params;

      const bookingRepo = AppDataSource.getRepository(VenueBooking);
      const bookings = await bookingRepo.find({
        where: { createdBy: userId },
        relations: [
          "venue",
          "venue.bookingConditions",
          "venue.venueVariables",
          "event",
        ],
        order: {
          createdAt: "DESC", // Most recent bookings first
        },
      });

      // Enrich booking data with event details and payment info
      const enrichedBookings = await Promise.all(
        bookings.map(async (booking) => {
          const venue = booking.venue;
          const event = booking.event;
          const bookingCondition = venue.bookingConditions[0];
          const venueAmount = venue.venueVariables[0]?.venueAmount || 0;

          // Calculate deposit amount
          const depositAmount = bookingCondition?.depositRequiredPercent
            ? (venueAmount * bookingCondition.depositRequiredPercent) / 100
            : venueAmount;

          // Get earliest booking date
          const earliestDate = new Date(
            Math.min(
              ...booking.bookingDates.map((d) => new Date(d.date).getTime())
            )
          );
          const paymentDeadline =
            bookingCondition?.paymentComplementTimeBeforeEvent
              ? new Date(
                  earliestDate.getTime() -
                    bookingCondition.paymentComplementTimeBeforeEvent *
                      24 *
                      60 *
                      60 *
                      1000
                )
              : earliestDate;

          return {
            bookingId: booking.bookingId,
            eventId: event?.eventId,
            eventName: event?.eventName,
            eventType: event?.eventType,
            eventStatus: event?.eventStatus,
            venue: {
              venueId: venue.venueId,
              venueName: venue.venueName,
              location: venue.venueLocation,
              totalAmount: venueAmount,
              depositRequired: {
                percentage: bookingCondition?.depositRequiredPercent || 100,
                amount: depositAmount,
                description: "Initial deposit required to secure the booking",
              },
              paymentCompletionRequired: {
                daysBeforeEvent:
                  bookingCondition?.paymentComplementTimeBeforeEvent || 0,
                amount: venueAmount - depositAmount,
                deadline: paymentDeadline,
                description: `Remaining payment must be completed ${
                  bookingCondition?.paymentComplementTimeBeforeEvent || 0
                } days before the event`,
              },
            },
            bookingDates: booking.bookingDates,
            bookingStatus: booking.bookingStatus,
            isPaid: booking.isPaid,
            createdAt: booking.createdAt,
            paymentSummary: {
              totalAmount: venueAmount,
              depositAmount: depositAmount,
              remainingAmount: venueAmount - depositAmount,
            },
          };
        })
      );

      // Calculate totals across all bookings
      const totals = enrichedBookings.reduce(
        (acc, booking) => {
          acc.totalBookings += 1;
          acc.totalAmount += booking.paymentSummary.totalAmount;
          acc.totalDepositRequired += booking.paymentSummary.depositAmount;
          acc.totalRemainingAmount += booking.paymentSummary.remainingAmount;
          acc.pendingBookings += booking.bookingStatus === "PENDING" ? 1 : 0;
          acc.paidBookings += booking.isPaid ? 1 : 0;
          return acc;
        },
        {
          totalBookings: 0,
          totalAmount: 0,
          totalDepositRequired: 0,
          totalRemainingAmount: 0,
          pendingBookings: 0,
          paidBookings: 0,
        }
      );

      res.status(200).json({
        success: true,
        data: {
          bookings: enrichedBookings,
          summary: {
            ...totals,
            unpaidBookings: totals.totalBookings - totals.paidBookings,
          },
        },
        message: "User bookings fetched successfully",
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Failed to fetch user bookings",
      });
    }
  }

  static async processPayment(req: Request, res: Response): Promise<void> {
    try {
      const { bookingId } = req.params;
      const paymentData = {
        ...req.body,
        bookingId,
      };

      const result = await VenueBookingPaymentService.processPayment(
        paymentData
      );

      res.status(200).json({
        success: true,
        data: result.data,
        message: result.message,
      });
    } catch (error) {
      const errorResponse: PaymentServiceError = {
        success: false,
        message:
          error instanceof Error ? error.message : "Failed to process payment",
      };
      res.status(400).json(errorResponse);
    }
  }

  static async getPaymentHistory(req: Request, res: Response): Promise<void> {
    try {
      const { bookingId } = req.params;
      const result = await VenueBookingPaymentService.getPaymentHistory(
        bookingId
      );

      res.status(200).json({
        success: true,
        data: result,
        message: "Payment history fetched successfully",
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Failed to fetch payment history",
      });
    }
  }
}
