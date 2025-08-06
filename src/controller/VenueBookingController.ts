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
import { Venue } from "../models/Venue Tables/Venue";
import {
  VenueBookingPayment,
  VenueBookingPaymentStatus,
  PayerType,
} from "../models/VenueBookingPayment";
import { SimpleNotificationService } from "../services/notifications/SimpleNotificationService";
import { EmailService } from "../services/emails/EmailService";
import { BookingStatus } from "../models/VenueBooking";
import { EventStatus } from "../interfaces/Enums/EventStatusEnum";
import {
  VenueAvailabilitySlot,
  SlotStatus,
  SlotType,
} from "../models/Venue Tables/VenueAvailabilitySlot";
import { Organization } from "../models/Organization";
import { Raw, Or } from "typeorm";

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
              totalPaid: 0,
              totalRemaining: 0,
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
      const paymentRepo = AppDataSource.getRepository(VenueBookingPayment);
      const bookings = await bookingRepo.find({
        where: { venueId: In(venueIds) },
        relations: [
          "venue",
          "venue.bookingConditions",
          "venue.venueVariables",
          "event",
          "user",
        ],
        order: {
          createdAt: "DESC", // Most recent first
        },
      });

      // Get payment details for each booking
      const enrichedBookings = await Promise.all(
        bookings.map(async (booking) => {
          const venue = booking.venue;
          const event = booking.event;
          const bookingCondition = venue.bookingConditions[0];

          const baseVenueAmount = venue.venueVariables[0]?.venueAmount || 0; // Needed for response
          const totalHours = booking.bookingDates.reduce(
            (sum: any, date: any) => {
              // Needed for hourly venue display
              return sum + (date.hours?.length || 1);
            },
            0
          );

          // Use the stored amountToBePaid from the booking entity as the source of truth
          const totalVenueAmount = booking.amountToBePaid || 0;

          const depositAmount = bookingCondition?.depositRequiredPercent
            ? (totalVenueAmount * bookingCondition.depositRequiredPercent) / 100
            : totalVenueAmount;

          // Get all payments for this booking
          const payments = await paymentRepo.find({
            where: { bookingId: booking.bookingId },
            order: { paymentDate: "ASC" },
          });

          const totalPaid = payments.reduce(
            (sum, p) => sum + Number(p.amountPaid),
            0
          );

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

          // Format payment history with running balance
          let runningBalance = totalVenueAmount;
          const paymentHistory = payments.map((payment) => {
            runningBalance -= Number(payment.amountPaid);
            return {
              paymentId: payment.paymentId,
              amountPaid: payment.amountPaid,
              paymentDate: payment.paymentDate,
              paymentMethod: payment.paymentMethod,
              paymentStatus: payment.paymentStatus,
              paymentReference: payment.paymentReference,
              balanceAfterPayment: runningBalance,
              notes: payment.notes,
            };
          });

          // Payment status logic
          let paymentStatus = "PENDING";
          if (booking.isPaid || totalPaid >= totalVenueAmount) {
            paymentStatus = "PAID";
          } else if (totalPaid >= depositAmount) {
            paymentStatus = "DEPOSIT_PAID";
          }

          // Deposit status
          const depositStatus =
            totalPaid >= depositAmount ? "FULFILLED" : "PENDING";

          // Deposit description for clarity
          let depositDescription = "";
          if (venue.bookingType === "HOURLY") {
            depositDescription = `Initial deposit required (${bookingCondition?.depositRequiredPercent}% of total amount ${totalVenueAmount} for ${totalHours} hours)`;
          } else if (venue.bookingType === "DAILY") {
            depositDescription = `Initial deposit required (${bookingCondition?.depositRequiredPercent}% of total amount ${baseVenueAmount} x ${booking.bookingDates.length} days = ${totalVenueAmount})`;
          } else {
            depositDescription = `Initial deposit required (${bookingCondition?.depositRequiredPercent}% of total amount ${totalVenueAmount})`;
          }

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
              bookingType: venue.bookingType,
              baseAmount: baseVenueAmount,
              totalHours: venue.bookingType === "HOURLY" ? totalHours : null,
              totalAmount: totalVenueAmount,
              depositRequired: {
                percentage: bookingCondition?.depositRequiredPercent || 100,
                amount: depositAmount,
                description: depositDescription,
              },
              paymentCompletionRequired: {
                daysBeforeEvent:
                  bookingCondition?.paymentComplementTimeBeforeEvent || 0,
                deadline: paymentDeadline,
              },
            },
            bookingDates: booking.bookingDates,
            bookingStatus: booking.bookingStatus,
            isPaid: booking.isPaid,
            createdAt: booking.createdAt,
            requester: booking.user
              ? {
                  userId: booking.user.userId,
                  firstName: booking.user.firstName,
                  lastName: booking.user.lastName,
                  email: booking.user.email,
                  phoneNumber: booking.user.phoneNumber,
                }
              : null,
            paymentSummary: {
              totalAmount: totalVenueAmount,
              depositAmount: depositAmount,
              totalPaid: totalPaid,
              remainingAmount: totalVenueAmount - totalPaid,
              paymentStatus: paymentStatus,
              paymentProgress:
                ((totalPaid / totalVenueAmount) * 100).toFixed(2) + "%",
              depositStatus: depositStatus,
              paymentHistory: paymentHistory,
              nextPaymentDue:
                totalPaid < totalVenueAmount ? totalVenueAmount - totalPaid : 0,
              paymentDeadline: paymentDeadline,
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
        totalPaid: enrichedBookings.reduce(
          (sum, b) => sum + b.paymentSummary.totalPaid,
          0
        ),
        totalRemaining: enrichedBookings.reduce(
          (sum, b) => sum + b.paymentSummary.remainingAmount,
          0
        ),
        pendingBookings: enrichedBookings.filter(
          (b) => b.bookingStatus === "PENDING"
        ).length,
        approvedBookings: enrichedBookings.filter((b) =>
          ["APPROVED_PAID", "APPROVED_NOT_PAID", "PARTIAL"].includes(
            b.bookingStatus
          )
        ).length,
        partialBookings: enrichedBookings.filter(
          (b) => b.bookingStatus === "PARTIAL"
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
          totalAmount: enrichedBookings
            .filter((b) => b.venue.venueId === venueId)
            .reduce((sum, b) => sum + b.paymentSummary.totalAmount, 0),
          totalPaid: enrichedBookings
            .filter((b) => b.venue.venueId === venueId)
            .reduce((sum, b) => sum + b.paymentSummary.totalPaid, 0),
        })),
        paymentSummary: {
          totalExpectedAmount: enrichedBookings.reduce(
            (sum, b) => sum + b.paymentSummary.totalAmount,
            0
          ),
          totalPaidAmount: enrichedBookings.reduce(
            (sum, b) => sum + b.paymentSummary.totalPaid,
            0
          ),
          totalPendingAmount: enrichedBookings.reduce(
            (sum, b) => sum + b.paymentSummary.remainingAmount,
            0
          ),
          collectionProgress:
            (
              (enrichedBookings.reduce(
                (sum, b) => sum + b.paymentSummary.totalPaid,
                0
              ) /
                enrichedBookings.reduce(
                  (sum, b) => sum + b.paymentSummary.totalAmount,
                  0
                )) *
              100
            ).toFixed(2) + "%",
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
      const bookingRepo = AppDataSource.getRepository(VenueBooking);
      const paymentRepo = AppDataSource.getRepository(VenueBookingPayment);

      const booking = await bookingRepo.findOne({
        where: { bookingId },
        relations: [
          "venue",
          "venue.bookingConditions",
          "venue.venueVariables",
          "event",
          "user",
        ],
      });

      if (!booking) {
        res.status(404).json({ success: false, message: "Booking not found." });
        return;
      }

      const venue = booking.venue;
      const event = booking.event;
      const bookingCondition = venue.bookingConditions[0];

      const baseVenueAmount = venue.venueVariables[0]?.venueAmount || 0; // Needed for response
      const totalHours = booking.bookingDates.reduce((sum: any, date: any) => {
        // Needed for hourly venue display
        return sum + (date.hours?.length || 1);
      }, 0);

      // Use the stored amountToBePaid from the booking entity as the source of truth
      const totalVenueAmount = booking.amountToBePaid || 0;

      const depositAmount = bookingCondition?.depositRequiredPercent
        ? (totalVenueAmount * bookingCondition.depositRequiredPercent) / 100
        : totalVenueAmount;

      // Get all payments for this booking
      const payments = await paymentRepo.find({
        where: { bookingId: booking.bookingId },
        order: { paymentDate: "ASC" },
      });

      const totalPaid = payments.reduce(
        (sum, p) => sum + Number(p.amountPaid),
        0
      );

      // Get earliest booking date
      const earliestDate = new Date(
        Math.min(
          ...booking.bookingDates.map((d: any) => new Date(d.date).getTime())
        )
      );
      const paymentDeadline = bookingCondition?.paymentComplementTimeBeforeEvent
        ? new Date(
            earliestDate.getTime() -
              bookingCondition.paymentComplementTimeBeforeEvent *
                24 *
                60 *
                60 *
                1000
          )
        : earliestDate;

      // Get payer details based on event organizer type
      let payerDetails = null;
      if (event) {
        if (event.eventOrganizerType === "USER") {
          const userRepo = AppDataSource.getRepository(User);
          const user = await userRepo.findOne({
            where: { userId: event.eventOrganizerId },
          });
          if (user) {
            payerDetails = {
              payerId: user.userId,
              payerType: "USER",
              firstName: user.firstName,
              lastName: user.lastName,
              email: user.email,
              phoneNumber: user.phoneNumber,
            };
          }
        } else if (event.eventOrganizerType === "ORGANIZATION") {
          const orgRepo = AppDataSource.getRepository(Organization);
          const organization = await orgRepo.findOne({
            where: { organizationId: event.eventOrganizerId },
          });
          if (organization) {
            payerDetails = {
              payerId: organization.organizationId,
              payerType: "ORGANIZATION",
              organizationName: organization.organizationName,
              contactEmail: organization.contactEmail,
              contactPhone: organization.contactPhone,
              address: organization.address,
            };
          }
        }
      }

      // Format payment history with running balance
      let runningBalance = totalVenueAmount;
      const paymentHistory = payments.map((p) => {
        runningBalance -= Number(p.amountPaid);
        return {
          paymentId: p.paymentId,
          amountPaid: p.amountPaid,
          paymentDate: p.paymentDate,
          paymentMethod: p.paymentMethod,
          paymentStatus: p.paymentStatus,
          paymentReference: p.paymentReference,
          balanceAfterPayment: runningBalance,
          notes: p.notes,
        };
      });

      // Payment status logic
      let paymentStatus = "PENDING";
      if (booking.isPaid || totalPaid >= totalVenueAmount) {
        paymentStatus = "PAID";
      } else if (totalPaid >= depositAmount) {
        paymentStatus = "DEPOSIT_PAID";
      }

      // Deposit status
      const depositStatus =
        totalPaid >= depositAmount ? "FULFILLED" : "PENDING";

      // Deposit description for clarity
      let depositDescription = "";
      if (venue.bookingType === "HOURLY") {
        depositDescription = `Initial deposit required (${bookingCondition?.depositRequiredPercent}% of total amount ${totalVenueAmount} for ${totalHours} hours)`;
      } else if (venue.bookingType === "DAILY") {
        depositDescription = `Initial deposit required (${bookingCondition?.depositRequiredPercent}% of total amount ${baseVenueAmount} x ${booking.bookingDates.length} days = ${totalVenueAmount})`;
      } else {
        depositDescription = `Initial deposit required (${bookingCondition?.depositRequiredPercent}% of total amount ${totalVenueAmount})`;
      }

      const enrichedBooking = {
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
          bookingType: venue.bookingType,
          baseAmount: baseVenueAmount,
          totalHours: venue.bookingType === "HOURLY" ? totalHours : null,
          totalAmount: totalVenueAmount,
          mainPhotoUrl: venue.mainPhotoUrl, // Added venue main photo
          photoGallery: venue.photoGallery, // Added venue photo gallery
          depositRequired: {
            percentage: bookingCondition?.depositRequiredPercent || 100,
            amount: depositAmount,
            description: depositDescription,
          },
          paymentCompletionRequired: {
            daysBeforeEvent:
              bookingCondition?.paymentComplementTimeBeforeEvent || 0,
            deadline: paymentDeadline,
          },
        },
        bookingDates: booking.bookingDates,
        bookingStatus: booking.bookingStatus,
        isPaid: booking.isPaid,
        createdAt: booking.createdAt,
        requester: booking.user
          ? {
              userId: booking.user.userId,
              firstName: booking.user.firstName,
              lastName: booking.user.lastName,
              email: booking.user.email,
              phoneNumber: booking.user.phoneNumber,
            }
          : null,
        payer: payerDetails, // Added payer details here
        paymentSummary: {
          totalAmount: totalVenueAmount,
          depositAmount: depositAmount,
          totalPaid: totalPaid,
          remainingAmount: totalVenueAmount - totalPaid,
          paymentStatus: paymentStatus,
          paymentProgress:
            ((totalPaid / totalVenueAmount) * 100).toFixed(2) + "%",
          depositStatus: depositStatus,
          paymentHistory: paymentHistory,
          nextPaymentDue:
            totalPaid < totalVenueAmount ? totalVenueAmount - totalPaid : 0,
          paymentDeadline: paymentDeadline,
        },
      };
      res.status(200).json({ success: true, data: enrichedBooking });
    } catch (error) {
      res.status(500).json({ success: false, message: "Server error." });
    }
  }

  static async approveBooking(req: Request, res: Response): Promise<void> {
    try {
      const { bookingId } = req.params;
      const authenticatedReq = req as any;
      const userId = authenticatedReq.user?.userId;

      // Fetch booking with venue
      const bookingRepo = AppDataSource.getRepository(VenueBooking);
      const booking = await bookingRepo.findOne({
        where: { bookingId },
        relations: ["venue"],
      });
      if (!booking) {
        res.status(404).json({ success: false, message: "Booking not found." });
        return;
      }

      // Check if user is the manager of the venue
      const venueVariableRepo = AppDataSource.getRepository(VenueVariable);
      const venueVariable = await venueVariableRepo.findOne({
        where: { venue: { venueId: booking.venue.venueId } },
        relations: ["manager"],
      });
      if (!venueVariable || venueVariable.manager.userId !== userId) {
        res.status(403).json({
          success: false,
          message: "You are not the manager of this venue.",
        });
        return;
      }

      // Approve booking and create slots with transition time logic
      const result = await VenueBookingRepository.approveBookingWithTransition(
        bookingId
      );
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
      // Check if booking is canceled
      const bookingRepo = AppDataSource.getRepository(VenueBooking);
      const booking = await bookingRepo.findOne({ where: { bookingId } });
      if (!booking) {
        res.status(404).json({ success: false, message: "Booking not found." });
        return;
      }
      if (booking.bookingStatus === "CANCELLED") {
        res.status(400).json({
          success: false,
          message: "Cannot create payment for a canceled booking.",
        });
        return;
      }
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
        hoursSinceBooking <= (condition?.bookingPaymentTimeoutMinutes || 0);
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
      // Deposit status
      const depositStatus =
        totalPaid >= requiredDeposit ? "FULFILLED" : "PENDING";

      // Needed for deposit description and venue details
      const baseVenueAmount = booking.venue.venueVariables[0]?.venueAmount || 0;
      const totalHours = booking.bookingDates.reduce((sum: any, date: any) => {
        return sum + (date.hours?.length || 1);
      }, 0);

      // Calculate totalVenueAmount from booking.amountToBePaid
      const totalVenueAmount = booking.amountToBePaid || 0; // Use booking.amountToBePaid as source of truth
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
      const paymentRepo = AppDataSource.getRepository(VenueBookingPayment);
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

          // Calculate total hours across all booking dates (needed for hourly venue display)
          const totalHours = booking.bookingDates.reduce(
            (sum: any, date: any) => {
              return sum + (date.hours?.length || 1);
            },
            0
          );

          // Calculate deposit amount
          const depositAmount = bookingCondition?.depositRequiredPercent
            ? (venueAmount * bookingCondition.depositRequiredPercent) / 100
            : venueAmount;

          // Get earliest booking date
          const earliestDate = new Date(
            Math.min(
              ...booking.bookingDates.map((d: any) =>
                new Date(d.date).getTime()
              )
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

          // Fetch all payments for this booking
          const payments = await paymentRepo.find({
            where: { bookingId: booking.bookingId },
            order: { paymentDate: "ASC" },
          });
          const totalPaid = payments.reduce(
            (sum, p) => sum + Number(p.amountPaid || 0),
            0
          );
          const remainingAmount = venueAmount - totalPaid;

          // Determine refund status if cancelled
          let refundStatus = null;
          if (booking.bookingStatus === "CANCELLED") {
            // If any payment is in refund process, show that
            if (
              payments.some((p) => p.paymentStatus === "REFUND_IN_PROGRESS")
            ) {
              refundStatus = "REFUND_IN_PROGRESS";
            } else if (payments.every((p) => p.paymentStatus === "REFUNDED")) {
              refundStatus = "REFUNDED";
            } else if (payments.length > 0) {
              refundStatus = "PENDING_REFUND";
            }
          }

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
            payments: payments.map((p: any) => ({
              paymentId: p.paymentId,
              amountPaid: Number(p.amountPaid),
              paymentDate: p.paymentDate,
              paymentMethod: p.paymentMethod,
              paymentStatus: p.paymentStatus,
              paymentReference: p.paymentReference,
              notes: p.notes,
            })),
            totalPaid,
            remainingAmount,
            refundStatus,
            paymentSummary: {
              totalAmount: venueAmount,
              depositAmount: depositAmount,
              totalPaid,
              remainingAmount,
              refundStatus,
            },
          };
        })
      );

      // Calculate totals across all bookings
      const totals = enrichedBookings.reduce(
        (acc: any, booking: any) => {
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
      // Check if booking is canceled
      const bookingRepo = AppDataSource.getRepository(VenueBooking);
      const booking = await bookingRepo.findOne({
        where: { bookingId },
        relations: ["event"],
      });
      if (!booking) {
        res.status(404).json({ success: false, message: "Booking not found." });
        return;
      }
      if (booking.bookingStatus === "CANCELLED") {
        res.status(400).json({
          success: false,
          message: "Cannot create payment for a canceled booking.",
        });
        return;
      }
      // Extract payerId and payerType from the event
      const event = booking.event;
      if (!event) {
        res.status(400).json({
          success: false,
          message: "Booking does not have an associated event.",
        });
        return;
      }
      const paymentData = {
        ...req.body,
        bookingId,
        payerId: event.eventOrganizerId,
        payerType: event.eventOrganizerType,
      };

      const result = await VenueBookingPaymentService.processPayment(
        paymentData
      );

      if (result.success) {
        res.status(200).json({
          success: true,
          data: result.data,
          message: result.message,
        });
      } else {
        res.status(400).json(result);
      }
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

  private static calculateBookingAmount(
    venue: Venue,
    bookingDates: any[]
  ): number {
    const variable = venue.venueVariables?.[0];
    if (variable?.isFree) return 0;
    const baseAmount = variable?.venueAmount || 0;

    if (venue.bookingType === "HOURLY") {
      // Calculate total hours across all booking dates
      const totalHours = bookingDates.reduce((sum: any, date: any) => {
        return sum + (date.hours?.length || 1); // If no hours specified, count as 1
      }, 0);
      return baseAmount * totalHours;
    }

    return baseAmount;
  }

  static async createBooking(req: Request, res: Response): Promise<void> {
    try {
      const booking = req.body;
      const venue = await AppDataSource.getRepository(Venue).findOne({
        where: { venueId: booking.venueId },
        relations: ["venueVariables"],
      });

      if (!venue) {
        res.status(404).json({ success: false, message: "Venue not found" });
        return;
      }

      // Calculate total amount based on venue type and hours
      const totalAmount = this.calculateBookingAmount(
        venue,
        booking.bookingDates
      );

      const newBooking = await AppDataSource.getRepository(VenueBooking).create(
        {
          ...booking,
          amountToBePaid: totalAmount,
        }
      );

      await AppDataSource.getRepository(VenueBooking).save(newBooking);

      res.status(201).json({
        success: true,
        data: newBooking,
        message: "Booking created successfully",
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message:
          error instanceof Error ? error.message : "Failed to create booking",
      });
    }
  }

  static async updateBooking(req: Request, res: Response): Promise<void> {
    try {
      const { bookingId } = req.params;
      const updates = req.body;

      const booking = await AppDataSource.getRepository(VenueBooking).findOne({
        where: { bookingId },
        relations: ["venue", "venue.venueVariables"],
      });

      if (!booking) {
        res.status(404).json({ success: false, message: "Booking not found" });
        return;
      }

      // Recalculate amount if booking dates are being updated
      if (updates.bookingDates) {
        updates.amountToBePaid = this.calculateBookingAmount(
          booking.venue,
          updates.bookingDates
        );
      }

      await AppDataSource.getRepository(VenueBooking).update(
        bookingId,
        updates
      );

      res.status(200).json({
        success: true,
        message: "Booking updated successfully",
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message:
          error instanceof Error ? error.message : "Failed to update booking",
      });
    }
  }

  static async cancelByManager(req: Request, res: Response): Promise<void> {
    try {
      const { bookingId } = req.params;
      const { reason } = req.body;
      const authenticatedReq = req as any;
      const userId = authenticatedReq.user?.userId;

      if (!reason) {
        res.status(400).json({
          success: false,
          message: "Cancellation reason is required.",
        });
        return;
      }

      // Fetch booking with venue, event, and user
      const bookingRepo = AppDataSource.getRepository(VenueBooking);
      const booking = await bookingRepo.findOne({
        where: { bookingId },
        relations: ["venue", "event", "user", "venue.organization"],
      });
      if (!booking) {
        res.status(404).json({ success: false, message: "Booking not found." });
        return;
      }

      // Check if user is the manager of the venue
      const venueVariableRepo = AppDataSource.getRepository(VenueVariable);
      const venueVariable = await venueVariableRepo.findOne({
        where: { venue: { venueId: booking.venue.venueId } },
        relations: ["manager"],
      });
      if (!venueVariable || venueVariable.manager.userId !== userId) {
        res.status(403).json({
          success: false,
          message: "You are not the manager of this venue.",
        });
        return;
      }

      // Only allow if status is APPROVED_PAID or APPROVED_NOT_PAID
      if (
        !["APPROVED_PAID", "APPROVED_NOT_PAID"].includes(booking.bookingStatus)
      ) {
        res.status(400).json({
          success: false,
          message: "Only approved bookings can be cancelled by manager.",
        });
        return;
      }

      // Cancel booking
      booking.bookingStatus = BookingStatus.CANCELLED;
      booking.cancellationReason = reason;
      await bookingRepo.save(booking);

      // Set all payments for this booking to REFUND_IN_PROGRESS
      const paymentRepo = AppDataSource.getRepository(VenueBookingPayment);
      const payments = await paymentRepo.find({ where: { bookingId } });
      for (const payment of payments) {
        payment.paymentStatus = VenueBookingPaymentStatus.REFUND_IN_PROGRESS;
        await paymentRepo.save(payment);
      }

      // Cancel event
      if (booking.event) {
        booking.event.eventStatus = EventStatus.CANCELLED;
        booking.event.cancellationReason = `Event cancelled because the venue is no longer available: ${reason}`;
        await AppDataSource.getRepository(Event).save(booking.event);
      }

      // Debug: log booking.user
      console.log("booking.user before notification:", booking.user);
      if (!booking.user) {
        // Try to load the user manually using createdBy
        if (booking.createdBy) {
          const foundUser = await AppDataSource.getRepository(User).findOne({
            where: { userId: booking.createdBy },
          });
          if (foundUser) {
            booking.user = foundUser;
            console.log("booking.user after manual load:", booking.user);
          } else {
            console.log("User not found for createdBy:", booking.createdBy);
          }
        } else {
          console.log("No user relation and no createdBy on booking.");
        }
      }
      // System notification
      try {
        if (booking.user && booking.user.userId) {
          await SimpleNotificationService.notifyUser(
            booking.user,
            `Your booking for venue '${booking.venue.venueName}' has been cancelled by the manager. Reason: ${reason}`
          );
        }
      } catch (e) {
        // Log but do not block
        console.error("Failed to send system notification:", e);
      }
      // Email notification
      try {
        if (booking.user && booking.user.email) {
          await EmailService.sendBookingCancellationEmail({
            to: booking.user.email,
            userName: booking.user.firstName || booking.user.username || "User",
            venueName: booking.venue.venueName,
            eventName: booking.event?.eventName || "Event",
            reason,
            refundInfo: booking.isPaid
              ? "Your payment will be refunded as soon as possible."
              : undefined,
            managerPhone: venueVariable?.manager?.phoneNumber,
            organizationName:
              booking.venue.organization?.organizationName || "Giraffe Space",
            organizationLogoUrl: booking.venue.organization?.logo,
            bookingDates: booking.bookingDates,
          });
        }
      } catch (e) {
        // Log but do not block
        console.error("Failed to send email notification:", e);
      }

      res.status(200).json({
        success: true,
        message: "Booking and related event cancelled.",
        booking,
        event: booking.event,
        payments, // Return updated payments for user visibility
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message:
          error instanceof Error ? error.message : "Failed to cancel booking.",
      });
    }
  }

  static async cancelAndDeleteSlotsByManager(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const { bookingId } = req.params;
      const { reason } = req.body;
      const authenticatedReq = req as any;
      const userId = authenticatedReq.user?.userId;

      if (!reason) {
        res.status(400).json({
          success: false,
          message: "Cancellation reason is required.",
        });
        return;
      }

      // Fetch booking with venue, event, and user
      const bookingRepo = AppDataSource.getRepository(VenueBooking);
      const booking = await bookingRepo.findOne({
        where: { bookingId },
        relations: ["venue", "event", "user", "venue.organization"],
      });
      if (!booking) {
        res.status(404).json({ success: false, message: "Booking not found." });
        return;
      }

      // Check if user is the manager of the venue
      const venueVariableRepo = AppDataSource.getRepository(VenueVariable);
      const venueVariable = await venueVariableRepo.findOne({
        where: { venue: { venueId: booking.venue.venueId } },
        relations: ["manager"],
      });
      if (!venueVariable || venueVariable.manager.userId !== userId) {
        res.status(403).json({
          success: false,
          message: "You are not the manager of this venue.",
        });
        return;
      }

      // Only allow if status is APPROVED_PAID or APPROVED_NOT_PAID
      if (
        !["PENDING", "APPROVED_PAID", "APPROVED_NOT_PAID"].includes(
          booking.bookingStatus
        )
      ) {
        res.status(400).json({
          success: false,
          message: "Only approved bookings can be cancelled by manager.",
        });
        return;
      }

      // Cancel booking
      booking.bookingStatus = BookingStatus.CANCELLED;
      booking.cancellationReason = reason;
      await bookingRepo.save(booking);

      // Cancel event
      if (booking.event) {
        booking.event.eventStatus = EventStatus.CANCELLED;
        booking.event.cancellationReason = `Event cancelled because the venue is no longer available: ${reason}`;
        await AppDataSource.getRepository(Event).save(booking.event);
      }

      // Delete all VenueAvailabilitySlot entries for this booking (booked and transition)
      const slotRepo = AppDataSource.getRepository(
        require("../models/Venue Tables/VenueAvailabilitySlot")
          .VenueAvailabilitySlot
      );
      // Find all slots for this venue and event
      const slots = await slotRepo.find({
        where: {
          venueId: booking.venue.venueId,
          eventId: booking.event?.eventId,
        },
      });
      for (const slot of slots) {
        await slotRepo.remove(slot);
      }
      // Also remove transition slots (slotType: TRANSITION, eventId: null, but notes reference this event)
      const transitionSlots = await slotRepo.find({
        where: { venueId: booking.venue.venueId, slotType: "TRANSITION" },
      });
      for (const slot of transitionSlots) {
        if (slot.notes && slot.notes.includes(booking.event?.eventId)) {
          await slotRepo.remove(slot);
        }
      }

      // Email notification
      try {
        if (booking.user && booking.user.email) {
          await EmailService.sendBookingCancellationEmail({
            to: booking.user.email,
            userName: booking.user.firstName || booking.user.username || "User",
            venueName: booking.venue.venueName,
            eventName: booking.event?.eventName || "Event",
            reason,
            refundInfo: booking.isPaid
              ? "Your payment will be refunded as soon as possible."
              : undefined,
            managerPhone: venueVariable?.manager?.phoneNumber,
            organizationName:
              booking.venue.organization?.organizationName || "Giraffe Space",
            organizationLogoUrl: booking.venue.organization?.logo,
            bookingDates: booking.bookingDates,
          });
        }
      } catch (e) {
        // Log but do not block
        console.error("Failed to send email notification:", e);
      }

      res.status(200).json({
        success: true,
        message: "Booking and event cancelled (slots not deleted).",
        booking,
        event: booking.event,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message:
          error instanceof Error ? error.message : "Failed to cancel booking.",
      });
    }
  }

  static async cancelByManagerWithoutSlotDeletion(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const { bookingId } = req.params;
      const { reason } = req.body;
      const authenticatedReq = req as any;
      const userId = authenticatedReq.user?.userId;

      if (!reason) {
        res.status(400).json({
          success: false,
          message: "Cancellation reason is required.",
        });
        return;
      }

      // Fetch booking with venue, event, and user
      const bookingRepo = AppDataSource.getRepository(VenueBooking);
      const booking = await bookingRepo.findOne({
        where: { bookingId },
        relations: ["venue", "event", "user", "venue.organization"],
      });
      if (!booking) {
        res.status(404).json({ success: false, message: "Booking not found." });
        return;
      }

      // Check if user is the manager of the venue
      const venueVariableRepo = AppDataSource.getRepository(VenueVariable);
      const venueVariable = await venueVariableRepo.findOne({
        where: { venue: { venueId: booking.venue.venueId } },
        relations: ["manager"],
      });
      if (!venueVariable || venueVariable.manager.userId !== userId) {
        res.status(403).json({
          success: false,
          message: "You are not the manager of this venue.",
        });
        return;
      }

      // Only allow if status is APPROVED_PAID or APPROVED_NOT_PAID
      if (
        !["PENDING", "APPROVED_PAID", "APPROVED_NOT_PAID"].includes(
          booking.bookingStatus
        )
      ) {
        res.status(400).json({
          success: false,
          message: "Only approved bookings can be cancelled by manager.",
        });
        return;
      }

      // Cancel booking
      booking.bookingStatus = BookingStatus.CANCELLED;
      booking.cancellationReason = reason;
      await bookingRepo.save(booking);

      // Cancel event
      if (booking.event) {
        booking.event.eventStatus = EventStatus.CANCELLED;
        booking.event.cancellationReason = `Event cancelled because the venue is no longer available: ${reason}`;
        await AppDataSource.getRepository(Event).save(booking.event);
      }

      // Email notification
      try {
        if (booking.user && booking.user.email) {
          await EmailService.sendBookingCancellationEmail({
            to: booking.user.email,
            userName: booking.user.firstName || booking.user.username || "User",
            venueName: booking.venue.venueName,
            eventName: booking.event?.eventName || "Event",
            reason,
            refundInfo: booking.isPaid
              ? "Your payment will be refunded as soon as possible."
              : undefined,
            managerPhone: venueVariable?.manager?.phoneNumber,
            organizationName:
              booking.venue.organization?.organizationName || "Giraffe Space",
            organizationLogoUrl: booking.venue.organization?.logo,
            bookingDates: booking.bookingDates,
          });
        }
      } catch (e) {
        // Log but do not block
        console.error("Failed to send email notification:", e);
      }

      res.status(200).json({
        success: true,
        message: "Booking and event cancelled (slots not deleted).",
        booking,
        event: booking.event,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message:
          error instanceof Error ? error.message : "Failed to cancel booking.",
      });
    }
  }

  static async getPendingBookingsByManager(req: Request, res: Response) {
    const { managerId } = req.params;
    if (!managerId) {
      return res
        .status(400)
        .json({ success: false, message: "managerId is required" });
    }
    const bookings = await VenueBookingRepository.getPendingBookingsByManager(
      managerId
    );
    res.json({ success: true, data: bookings });
  }

  static async getFormattedPaymentsByManager(req: Request, res: Response) {
    const { managerId } = req.params;
    if (!managerId) {
      return res
        .status(400)
        .json({ success: false, message: "managerId is required" });
    }
    // Get all payments for this manager (reuse existing logic)
    const result = await VenueBookingRepository.getPaymentsByManagerId(
      managerId
    );
    if (!result.success) {
      return res.status(500).json({ success: false, message: result.message });
    }
    // Group payments by bookingId
    const bookingsMap: Record<string, any> = {};
    const payments: any[] = Array.isArray(result.data) ? result.data : [];
    for (const payment of payments) {
      const b = payment.booking;
      if (!b) continue;
      if (!bookingsMap[b.bookingId]) {
        bookingsMap[b.bookingId] = {
          bookingId: b.bookingId,
          bookingReason: b.bookingReason,
          bookingDate: b.bookingDates?.[0]?.date || null,
          venueName: payment.venueName, // Add venueName here
          amountToBePaid: b.amountToBePaid,
          totalAmountPaid: 0,
          remainingAmount: b.amountToBePaid,
          isFullyPaid: false,
          payments: [],
          payer: payment.payer
            ? {
                userId: payment.payer.userId,
                username: payment.payer.username,
                fullName:
                  `${payment.payer.firstName} ${payment.payer.lastName}`.trim(),
                email: payment.payer.email,
                phoneNumber: payment.payer.phoneNumber,
                role: payment.payer.roleId || undefined,
                location: {
                  city: payment.payer.city || undefined,
                  country: payment.payer.country || undefined,
                },
              }
            : undefined,
        };
      }
      bookingsMap[b.bookingId].payments.push({
        paymentId: payment.paymentId,
        amountPaid: Number(payment.amountPaid),
        paymentMethod: payment.paymentMethod,
        paymentStatus: payment.paymentStatus,
        paymentReference: payment.paymentReference,
        paymentDate: payment.paymentDate,
        notes: payment.notes,
      });
      bookingsMap[b.bookingId].totalAmountPaid += Number(payment.amountPaid);
    }
    // Finalize remainingAmount and isFullyPaid
    for (const booking of Object.values(bookingsMap)) {
      booking.remainingAmount =
        booking.amountToBePaid - booking.totalAmountPaid;
      booking.isFullyPaid = booking.remainingAmount <= 0;
    }
    res.json({ success: true, data: Object.values(bookingsMap) });
  }

  static async refundAllPaymentsByManager(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const { bookingId } = req.params;
      const authenticatedReq = req as any;
      const userId = authenticatedReq.user?.userId;

      // Fetch booking with venue
      const bookingRepo = AppDataSource.getRepository(VenueBooking);
      const booking = await bookingRepo.findOne({
        where: { bookingId },
        relations: ["venue"],
      });
      if (!booking) {
        res.status(404).json({ success: false, message: "Booking not found." });
        return;
      }

      // Check if user is the manager of the venue
      const venueVariableRepo = AppDataSource.getRepository(VenueVariable);
      const venueVariable = await venueVariableRepo.findOne({
        where: { venue: { venueId: booking.venue.venueId } },
        relations: ["manager"],
      });
      if (!venueVariable || venueVariable.manager.userId !== userId) {
        res.status(403).json({
          success: false,
          message: "You are not the manager of this venue.",
        });
        return;
      }

      // Set all payments for this booking to REFUNDED
      const paymentRepo = AppDataSource.getRepository(VenueBookingPayment);
      const payments = await paymentRepo.find({ where: { bookingId } });
      for (const payment of payments) {
        payment.paymentStatus = VenueBookingPaymentStatus.REFUNDED;
        await paymentRepo.save(payment);
      }

      res.status(200).json({
        success: true,
        message: "All payments for this booking have been marked as refunded.",
        payments,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message:
          error instanceof Error ? error.message : "Failed to refund payments.",
      });
    }
  }

  static async getAllAccessiblePaymentsForUser(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const { userId } = req.params;
      // Get all organizations for user
      const orgRepo = require("../repositories/OrganizationRepository");
      const orgsResult =
        await orgRepo.OrganizationRepository.getOrganizationsByUserId(userId);
      if (!orgsResult.success || !orgsResult.data) {
        console.log(`[DEBUG] No organizations found for userId: ${userId}`);
        res.status(404).json({
          success: false,
          message: "Could not fetch organizations for user.",
        });
        return;
      }
      // Filter out 'Independent' organizations
      const organizations = orgsResult.data.filter(
        (org: any) => org.organizationName?.toLowerCase() !== "independent"
      );

      // Always get userPayments, even if organizations is empty
      const paymentRepo = AppDataSource.getRepository(VenueBookingPayment);
      const userPayments = await paymentRepo.find({
        where: { payerId: userId, payerType: PayerType.USER },
        order: { paymentDate: "DESC" },
      });

      // Only get organizationPayments if there are non-Independent organizations
      const organizationPayments: Record<string, any[]> = {};
      for (const org of organizations) {
        const orgPayments = await paymentRepo.find({
          where: {
            payerId: org.organizationId,
            payerType: PayerType.ORGANIZATION,
          },
          order: { paymentDate: "DESC" },
        });
        organizationPayments[org.organizationId] = orgPayments;
      }

      res
        .status(200)
        .json({ success: true, organizationPayments, userPayments });
    } catch (error) {
      res.status(500).json({
        success: false,
        message:
          error instanceof Error ? error.message : "Failed to fetch payments.",
      });
    }
  }

  static async getBookingsByVenueId(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const { venueId } = req.params;
      if (!venueId) {
        res
          .status(400)
          .json({ success: false, message: "venueId is required" });
        return;
      }
      const bookingRepo = AppDataSource.getRepository(VenueBooking);
      const paymentRepo = AppDataSource.getRepository(VenueBookingPayment);
      const slotRepo = AppDataSource.getRepository(VenueAvailabilitySlot); // Add this line
      const bookings = await bookingRepo.find({
        where: { venueId },
        order: { createdAt: "DESC" },
        relations: ["user", "venue.bookingConditions"], // Add venue.bookingConditions
      });
      // Fetch venue summary
      const venueRepo = AppDataSource.getRepository(Venue);
      const venue = await venueRepo.findOne({ where: { venueId } });
      // Enhanced venue summary with payment stats
      let venueSummary = null;
      if (venue) {
        let fullPaidCount = 0;
        let partialPaidCount = 0;
        let unpaidCount = 0;
        let totalRevenue = 0;
        let totalExpectedRevenue = 0;
        let totalPaidBookings = 0;
        let totalUnpaidAmount = 0;
        // For each booking, fetch payments and calculate payment status
        for (const booking of bookings) {
          const payments = await paymentRepo.find({
            where: { bookingId: booking.bookingId },
          });
          const totalPaid = payments.reduce(
            (sum, p) => sum + Number(p.amountPaid || 0),
            0
          );
          totalExpectedRevenue += Number(booking.amountToBePaid || 0);
          if (totalPaid >= Number(booking.amountToBePaid || 0)) {
            fullPaidCount++;
            totalRevenue += Number(booking.amountToBePaid || 0);
            totalPaidBookings++;
          } else if (totalPaid > 0) {
            partialPaidCount++;
            totalRevenue += totalPaid;
            totalUnpaidAmount +=
              Number(booking.amountToBePaid || 0) - totalPaid;
          } else {
            unpaidCount++;
            totalUnpaidAmount += Number(booking.amountToBePaid || 0);
          }
        }
        venueSummary = {
          venueId: venue.venueId,
          venueName: venue.venueName,
          capacity: venue.capacity,
          location: venue.venueLocation,
          totalBookings: bookings.length,
          fullPaidCount,
          partialPaidCount,
          unpaidCount,
          totalRevenue,
          totalExpectedRevenue,
          totalPaidBookings,
          totalUnpaidAmount,
          occupancyRate: venue.capacity
            ? ((bookings.length / venue.capacity) * 100).toFixed(2) + "%"
            : null,
        };
      }
      const userRepo = AppDataSource.getRepository(User);
      res.status(200).json({
        success: true,
        venueSummary,
        bookings: await Promise.all(
          bookings.map(async (booking) => {
            let userInfo = null;
            if (booking.user) {
              userInfo = {
                userId: booking.user.userId,
                firstName: booking.user.firstName,
                lastName: booking.user.lastName,
                email: booking.user.email,
                phoneNumber: booking.user.phoneNumber,
              };
            } else if (booking.createdBy) {
              const user = await userRepo.findOne({
                where: { userId: booking.createdBy },
              });
              if (user) {
                userInfo = {
                  userId: user.userId,
                  firstName: user.firstName,
                  lastName: user.lastName,
                  email: user.email,
                  phoneNumber: user.phoneNumber,
                };
              }
            }
            // Calculate totalPaid and remainingAmount for this booking
            const payments = await paymentRepo.find({
              where: { bookingId: booking.bookingId },
            });
            const totalPaid = payments.reduce(
              (sum, p) => sum + Number(p.amountPaid || 0),
              0
            );
            const remainingAmount =
              Number(booking.amountToBePaid || 0) - totalPaid;

            // Fetch main event slots (which might also contain hourly transition info in metadata)
            const mainEventSlots = await slotRepo.find({
              where: { venueId: booking.venueId, eventId: booking.eventId },
              order: { Date: "ASC" },
            });

            // Fetch dedicated transition slots linked by metadata.relatedEventId
            const dedicatedTransitionSlots = await slotRepo.find({
              where: {
                venueId: booking.venueId,
                slotType: SlotType.TRANSITION,
              },
              order: { Date: "ASC" },
            });

            // Combine all relevant slots and remove duplicates
            const combinedSlots = [
              ...mainEventSlots,
              ...dedicatedTransitionSlots,
            ];
            const uniqueSlots = Array.from(
              new Map(combinedSlots.map((item) => [item["id"], item])).values()
            );

            const formattedTransitionDates: {
              date: string;
              hours?: number[];
              notes?: string;
            }[] = [];

            const bookingDatesSet = new Set(
              booking.bookingDates.map(
                (bd) => new Date(bd.date).toISOString().split("T")[0]
              )
            );

            for (const slot of uniqueSlots) {
              if (slot.slotType === SlotType.TRANSITION) {
                const slotDate = new Date(slot.Date);
                let shouldAddTransition = false;

                // Condition 1: Direct eventId link
                if (slot.eventId === booking.eventId) {
                  shouldAddTransition = true;
                }
                // Condition 2: Metadata relatedEventId link
                if (
                  !shouldAddTransition &&
                  slot.metadata?.relatedEventId === booking.eventId
                ) {
                  shouldAddTransition = true;
                }
                // Condition 3: Notes contains eventId (fallback for old data)
                if (
                  !shouldAddTransition &&
                  slot.notes &&
                  booking.eventId &&
                  slot.notes.includes(booking.eventId)
                ) {
                  shouldAddTransition = true;
                }

                // Condition 4: Chronological relationship (if not already linked by explicit ID)
                if (!shouldAddTransition) {
                  for (const bookingDateObj of booking.bookingDates) {
                    const bookingDate = new Date(bookingDateObj.date);

                    if (booking.venue.bookingType === "DAILY") {
                      const dayBeforeBooking = new Date(bookingDate);
                      dayBeforeBooking.setDate(dayBeforeBooking.getDate() - 1);
                      if (
                        slotDate.toISOString().split("T")[0] ===
                        dayBeforeBooking.toISOString().split("T")[0]
                      ) {
                        shouldAddTransition = true;
                        break;
                      }
                    } else if (booking.venue.bookingType === "HOURLY") {
                      // Only proceed if bookingDateObj.hours exists and has elements
                      if (
                        slotDate.toISOString().split("T")[0] ===
                          bookingDate.toISOString().split("T")[0] &&
                        slot.bookedHours &&
                        bookingDateObj.hours &&
                        bookingDateObj.hours.length > 0
                      ) {
                        const minSlotHour = Math.min(...slot.bookedHours);
                        const minBookingHour = Math.min(
                          ...bookingDateObj.hours
                        );
                        if (minSlotHour < minBookingHour) {
                          // Simplified check: transition hours must precede booking hours
                          shouldAddTransition = true;
                          break;
                        }
                      }
                    }
                  }
                }

                if (shouldAddTransition) {
                  formattedTransitionDates.push({
                    date: new Date(slot.Date).toISOString().split("T")[0],
                    hours: slot.bookedHours,
                    notes: slot.notes,
                  });
                }
              } else if (
                slot.slotType === SlotType.EVENT &&
                slot.metadata?.transitionHours &&
                slot.metadata.transitionHours.length > 0
              ) {
                // This is an event slot for hourly bookings, containing embedded transition hours
                formattedTransitionDates.push({
                  date: new Date(slot.Date).toISOString().split("T")[0],
                  hours: slot.metadata.transitionHours,
                  notes: `Transition time for event ${booking.eventId}`,
                });
              }
            }

            // Remove the previous inference logic since we are now checking existing slots more comprehensively

            const responseBooking: any = {
              ...booking,
              user: userInfo,
              totalPaid,
              remainingAmount,
              transitionDates: formattedTransitionDates, // Always include formatted transition dates
            };

            return responseBooking;
          })
        ),
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Failed to fetch bookings by venueId.",
      });
    }
  }
}
