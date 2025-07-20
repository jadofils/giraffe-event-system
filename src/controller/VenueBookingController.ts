import { Request, Response } from "express";
import { VenueBookingRepository } from "../repositories/VenueBookingRepository";
import { AppDataSource } from "../config/Database";
import { In } from "typeorm";

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
      const result = await VenueBookingRepository.getBookingsByManagerId(
        managerId
      );
      res.status(200).json(result);
    } catch (error) {
      res.status(500).json({ success: false, message: "Server error." });
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
}
