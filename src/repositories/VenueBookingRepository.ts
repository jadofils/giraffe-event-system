import { VenueBooking } from "../models/VenueBooking";
import { AppDataSource } from "../config/Database";
import { In } from "typeorm";
import { VenueVariable } from "../models/Venue Tables/VenueVariable";
import { CacheService } from "../services/CacheService";
import {
  VenueAvailabilitySlot,
  SlotStatus,
} from "../models/Venue Tables/VenueAvailabilitySlot";

export class VenueBookingRepository {
  static async getAllBookings() {
    try {
      const repo = AppDataSource.getRepository(VenueBooking);
      const bookings = await repo.find();
      // For each booking, fetch the event, its organizer, and the venue
      const eventRepo = AppDataSource.getRepository(
        require("../models/Event Tables/Event").Event
      );
      const userRepo = AppDataSource.getRepository(
        require("../models/User").User
      );
      const orgRepo = AppDataSource.getRepository(
        require("../models/Organization").Organization
      );
      const venueRepo = AppDataSource.getRepository(
        require("../models/Venue Tables/Venue").Venue
      );
      const bookingsWithOrganizerAndVenue = await Promise.all(
        bookings.map(async (booking) => {
          let organizer = null;
          const event = await eventRepo.findOne({
            where: { eventId: booking.eventId },
          });
          if (event) {
            if (event.eventOrganizerType === "USER") {
              organizer = await userRepo.findOne({
                where: { userId: event.eventOrganizerId },
              });
            } else if (event.eventOrganizerType === "ORGANIZATION") {
              organizer = await orgRepo.findOne({
                where: { organizationId: event.eventOrganizerId },
              });
            }
          }
          let venue = booking.venue;
          if (!venue) {
            const foundVenue = await venueRepo.findOne({
              where: { venueId: booking.venueId },
              relations: ["venueVariables"],
            });
            venue = (foundVenue || null) as any;
          } else if (!venue.venueVariables) {
            // If venue is present but venueVariables is not loaded, fetch them
            const foundVenue = await venueRepo.findOne({
              where: { venueId: booking.venueId },
              relations: ["venueVariables"],
            });
            if (foundVenue) venue.venueVariables = foundVenue.venueVariables;
          }
          return { ...booking, organizer, venue };
        })
      );
      return {
        success: true,
        message: "All bookings fetched successfully.",
        data: bookingsWithOrganizerAndVenue,
      };
    } catch (error) {
      return { success: false, message: "Failed to fetch bookings.", data: [] };
    }
  }

  static async getBookingsByManagerId(managerId: string) {
    const cacheKey = `venue-bookings:manager:${managerId}`;
    return await CacheService.getOrSetMultiple(
      cacheKey,
      AppDataSource.getRepository(VenueBooking),
      async () => {
        // Find all venues managed by this manager
        const venueVariables = await AppDataSource.getRepository(
          VenueVariable
        ).find({
          where: { manager: { userId: managerId } },
          relations: ["venue"],
        });
        const venueIds = venueVariables.map((vv) => vv.venue.venueId);
        if (venueIds.length === 0) {
          return [];
        }
        // Find all bookings for these venues
        const bookings = await AppDataSource.getRepository(VenueBooking).find({
          where: { venueId: In(venueIds) },
        });
        // For each booking, fetch the event, its organizer, and the venue
        const eventRepo = AppDataSource.getRepository(
          require("../models/Event Tables/Event").Event
        );
        const userRepo = AppDataSource.getRepository(
          require("../models/User").User
        );
        const orgRepo = AppDataSource.getRepository(
          require("../models/Organization").Organization
        );
        const venueRepo = AppDataSource.getRepository(
          require("../models/Venue Tables/Venue").Venue
        );
        const bookingsWithOrganizerAndVenue = await Promise.all(
          bookings.map(async (booking) => {
            let organizer = null;
            const event = await eventRepo.findOne({
              where: { eventId: booking.eventId },
            });
            if (event) {
              if (event.eventOrganizerType === "USER") {
                organizer = await userRepo.findOne({
                  where: { userId: event.eventOrganizerId },
                });
              } else if (event.eventOrganizerType === "ORGANIZATION") {
                organizer = await orgRepo.findOne({
                  where: { organizationId: event.eventOrganizerId },
                });
              }
            }
            let venue = booking.venue;
            if (!venue) {
              const foundVenue = await venueRepo.findOne({
                where: { venueId: booking.venueId },
                relations: ["venueVariables"],
              });
              venue = (foundVenue || null) as any;
            } else if (!venue.venueVariables) {
              // If venue is present but venueVariables is not loaded, fetch them
              const foundVenue = await venueRepo.findOne({
                where: { venueId: booking.venueId },
                relations: ["venueVariables"],
              });
              if (foundVenue) venue.venueVariables = foundVenue.venueVariables;
            }
            return { ...booking, organizer, venue };
          })
        );
        return bookingsWithOrganizerAndVenue;
      }
    );
  }

  static async getBookingById(bookingId: string) {
    try {
      const repo = AppDataSource.getRepository(VenueBooking);
      const booking = await repo.findOne({
        where: { bookingId },
        relations: ["user", "venue"], // include user (organizer) and venue
      });
      if (!booking) {
        return { success: false, message: "Booking not found.", data: null };
      }
      // Fetch the event to get the organizer
      const eventRepo = AppDataSource.getRepository(
        require("../models/Event Tables/Event").Event
      );
      const event = await eventRepo.findOne({
        where: { eventId: booking.eventId },
      });
      let organizer = null;
      if (event) {
        if (event.eventOrganizerType === "USER") {
          const userRepo = AppDataSource.getRepository(
            require("../models/User").User
          );
          organizer = await userRepo.findOne({
            where: { userId: event.eventOrganizerId },
          });
        } else if (event.eventOrganizerType === "ORGANIZATION") {
          const orgRepo = AppDataSource.getRepository(
            require("../models/Organization").Organization
          );
          organizer = await orgRepo.findOne({
            where: { organizationId: event.eventOrganizerId },
          });
        }
      }
      // Attach organizer and event details to booking data
      const bookingWithOrganizer = {
        ...booking,
        organizer,
        eventTitle: event?.eventName || null,
        eventDescription: event?.eventDescription || null,
      };
      return {
        success: true,
        message: "Booking fetched successfully.",
        data: bookingWithOrganizer,
      };
    } catch (error) {
      return {
        success: false,
        message: "Failed to fetch booking.",
        data: null,
      };
    }
  }

  static async approveBooking(bookingId: string) {
    const queryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      // 1. Fetch booking, venue, and booking condition
      const bookingRepo = queryRunner.manager.getRepository(
        require("../models/VenueBooking").VenueBooking
      );
      const venueRepo = queryRunner.manager.getRepository(
        require("../models/Venue Tables/Venue").Venue
      );
      const slotRepo = queryRunner.manager.getRepository(
        require("../models/Venue Tables/VenueAvailabilitySlot")
          .VenueAvailabilitySlot
      );
      const conditionRepo = queryRunner.manager.getRepository(
        require("../models/Venue Tables/BookingCondition").BookingCondition
      );
      const paymentRepo = queryRunner.manager.getRepository(
        require("../models/VenueBookingPayment").VenueBookingPayment
      );
      const invoiceRepo = queryRunner.manager.getRepository(
        require("../models/Invoice").Invoice
      );
      const userRepo = queryRunner.manager.getRepository(
        require("../models/User").User
      );

      const booking = await bookingRepo.findOne({ where: { bookingId } });
      if (!booking) throw new Error("Booking not found");
      const venue = await venueRepo.findOne({
        where: { venueId: booking.venueId },
      });
      if (!venue) throw new Error("Venue not found");
      const condition = await conditionRepo.findOne({
        where: { venue: { venueId: venue.venueId } },
      });

      // 2. Set booking status to APPROVED_NOT_PAID
      booking.bookingStatus = "APPROVED_NOT_PAID";
      await bookingRepo.save(booking);

      // 3. Create slots
      const startDate = new Date(booking.eventStartDate);
      const endDate = new Date(booking.eventEndDate);
      const transitionTime = condition?.transitionTime || 0;
      const slotsToCreate = [];
      if (venue.bookingType === "DAILY") {
        for (
          let d = new Date(startDate);
          d <= endDate;
          d.setDate(d.getDate() + 1)
        ) {
          const slot = await slotRepo.create({
            venueId: venue.venueId,
            Date: new Date(d),
            status: SlotStatus.BOOKED,
            eventId: booking.eventId,
            notes: `Booked for event ${booking.eventId}`,
          });
          slotsToCreate.push(slot);
        }
        // Add transition time slots after last date if specified
        if (transitionTime > 0) {
          let transitionDate = new Date(endDate);
          for (let i = 1; i <= transitionTime; i++) {
            transitionDate.setDate(transitionDate.getDate() + 1);
            const slot = await slotRepo.create({
              venueId: venue.venueId,
              Date: new Date(transitionDate),
              status: SlotStatus.BOOKED,
              eventId: booking.eventId,
              notes: `Booked for event ${booking.eventId}`,
            });
            slotsToCreate.push(slot);
          }
        }
      } else if (venue.bookingType === "HOURLY") {
        for (
          let d = new Date(startDate);
          d <= endDate;
          d.setDate(d.getDate() + 1)
        ) {
          const slot = await slotRepo.create({
            venueId: venue.venueId,
            Date: new Date(d),
            startTime: booking.startTime
              ? new Date(`1970-01-01T${booking.startTime}`)
              : null,
            endTime: booking.endTime
              ? new Date(`1970-01-01T${booking.endTime}`)
              : null,
            status: SlotStatus.BOOKED,
            eventId: booking.eventId,
            notes: `Booked for event ${booking.eventId}`,
          });
          slotsToCreate.push(slot);
          // Add transition time between each day's slot if specified
          if (transitionTime > 0) {
            // For hourly, transition time could be added as a gap after endTime
            // This is a placeholder; adjust as needed for your business logic
          }
        }
      }
      for (const slot of slotsToCreate) {
        await slotRepo.save(slot);
      }

      // 4. Create payment record
      let payerId: string;
      let payerType: string;
      // Fetch event to determine organizer type
      const eventRepo = queryRunner.manager.getRepository(
        require("../models/Event Tables/Event").Event
      );
      const event = await eventRepo.findOne({
        where: { eventId: booking.eventId },
      });
      if (event?.eventOrganizerType === "USER") {
        payerId = event.eventOrganizerId;
        payerType = "USER";
      } else if (event?.eventOrganizerType === "ORGANIZATION") {
        payerId = event.eventOrganizerId;
        payerType = "ORGANIZATION";
      } else {
        throw new Error("Could not determine payer for payment record");
      }
      const amount = booking.amountToBePaid || 0;
      await paymentRepo.save({
        bookingId: booking.bookingId,
        payerId,
        payerType,
        amountPaid: 0,
        paymentStatus: "PENDING",
        paymentMethod: null,
        paymentReference: null,
      });

      // 5. Cancel conflicting bookings
      const conflictBookings = await bookingRepo.find({
        where: {
          venueId: booking.venueId,
          eventStartDate: booking.eventStartDate,
          bookingStatus: In(["PENDING", "APPROVED_NOT_PAID"]),
        },
      });
      for (const conflict of conflictBookings) {
        if (conflict.bookingId !== booking.bookingId) {
          conflict.bookingStatus = "CANCELLED";
          conflict.venueStatus = "AVAILABLE";
          conflict.cancellationReason =
            "Sorry, unfortunately you lost your slot. Please book another slot.";
          await bookingRepo.save(conflict);
        }
      }

      // 6. Generate invoice
      const invoiceDate = new Date();
      const dueDate = new Date(invoiceDate);
      if (condition?.depositRequiredTime) {
        dueDate.setDate(dueDate.getDate() + condition.depositRequiredTime);
      }
      await invoiceRepo.save({
        eventId: booking.eventId,
        payerId,
        payerType,
        invoiceDate,
        dueDate,
        totalAmount: amount,
        status: "PENDING",
        venueId: booking.venueId,
        bookingId: booking.bookingId,
      });

      await queryRunner.commitTransaction();
      return {
        success: true,
        message: "Booking approved and all related records created.",
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      return {
        success: false,
        message:
          error instanceof Error ? error.message : "Failed to approve booking.",
      };
    } finally {
      await queryRunner.release();
    }
  }

  static async getPaymentsByManagerId(managerId: string) {
    try {
      // 1. Find all venues managed by this manager
      const venueVariables = await AppDataSource.getRepository(
        VenueVariable
      ).find({
        where: { manager: { userId: managerId } },
        relations: ["venue"],
      });
      const venueIds = venueVariables.map((vv) => vv.venue.venueId);
      if (venueIds.length === 0) {
        return {
          success: true,
          data: [],
          message: "No venues managed by this manager.",
        };
      }
      // 2. Find all bookings for these venues
      const bookings = await AppDataSource.getRepository(VenueBooking).find({
        where: { venueId: In(venueIds) },
      });
      const bookingIds = bookings.map((b) => b.bookingId);
      if (bookingIds.length === 0) {
        return {
          success: true,
          data: [],
          message: "No bookings for venues managed by this manager.",
        };
      }
      // 3. Find all payments for these bookings
      const VenueBookingPayment =
        require("../models/VenueBookingPayment").VenueBookingPayment;
      const payments = await AppDataSource.getRepository(
        VenueBookingPayment
      ).find({
        where: { bookingId: In(bookingIds) },
        relations: ["booking"],
      });
      // 4. Enrich each payment with payer info
      const userRepo = AppDataSource.getRepository(
        require("../models/User").User
      );
      const orgRepo = AppDataSource.getRepository(
        require("../models/Organization").Organization
      );
      const enrichedPayments = await Promise.all(
        payments.map(async (payment) => {
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
      return {
        success: true,
        data: enrichedPayments,
        message: "Payments fetched successfully.",
      };
    } catch (error) {
      return {
        success: false,
        data: [],
        message: "Failed to fetch payments by manager.",
      };
    }
  }

  static async createVenueBookingPaymentWithDepositValidation(
    paymentData: any
  ) {
    // 1. Save the payment
    const paymentRepo = AppDataSource.getRepository(
      require("../models/VenueBookingPayment").VenueBookingPayment
    );
    let newPayment = paymentRepo.create(paymentData);
    await paymentRepo.save(newPayment);
    // Always fetch the saved payment by bookingId, payerId, and latest paymentDate
    newPayment = (await paymentRepo.findOne({
      where: {
        bookingId: paymentData.bookingId,
        payerId: paymentData.payerId,
      },
      order: { paymentDate: "DESC" },
    })) as any;

    // 2. Fetch all payments for this booking
    const allPayments = await paymentRepo.find({
      where: { bookingId: paymentData.bookingId },
    });
    const totalPaid = allPayments.reduce(
      (sum, p) => sum + (p.amountPaid || 0),
      0
    );

    // 3. Fetch booking and condition
    const bookingRepo = AppDataSource.getRepository(
      require("../models/VenueBooking").VenueBooking
    );
    const booking = await bookingRepo.findOne({
      where: { bookingId: paymentData.bookingId },
    });
    if (!booking) throw new Error("Booking not found");
    const conditionRepo = AppDataSource.getRepository(
      require("../models/Venue Tables/BookingCondition").BookingCondition
    );
    const condition = await conditionRepo.findOne({
      where: { venue: { venueId: booking.venueId } },
    });
    if (!condition) throw new Error("Booking condition not found");

    // 4. Calculate required deposit
    const requiredDeposit =
      ((booking.amountToBePaid || 0) *
        (condition.depositRequiredPercent || 0)) /
      100;

    // 5. Check if deposit is fulfilled and on time
    let depositPaidAt = null;
    let runningTotal = 0;
    for (const p of allPayments.sort(
      (a, b) => a.paymentDate.getTime() - b.paymentDate.getTime()
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
      hoursSinceBooking <= (condition.depositRequiredTime || 0);

    // 6. If deposit fulfilled, update booking status
    if (depositFulfilled) {
      booking.bookingStatus = "APPROVED_PAID";
      await bookingRepo.save(booking);
    }

    // 7. If total paid >= amountToBePaid, mark all payments as COMPLETED
    if (totalPaid >= (booking.amountToBePaid || 0)) {
      for (const p of allPayments) {
        if (p.paymentStatus !== "COMPLETED") {
          p.paymentStatus = "COMPLETED";
          await paymentRepo.save(p);
        }
      }
    }

    // 8. Get payer info
    let payer = null;
    if (newPayment && (newPayment as any).payerType === "USER") {
      payer = await AppDataSource.getRepository(
        require("../models/User").User
      ).findOne({ where: { userId: (newPayment as any).payerId } });
    } else if (newPayment && (newPayment as any).payerType === "ORGANIZATION") {
      payer = await AppDataSource.getRepository(
        require("../models/Organization").Organization
      ).findOne({ where: { organizationId: (newPayment as any).payerId } });
    }

    // 9. Return enriched response
    return {
      payment: newPayment,
      booking,
      payer,
      totalPaid,
      requiredDeposit,
      depositFulfilled,
      bookingStatus: booking.bookingStatus,
      message: depositFulfilled
        ? "Deposit paid in full and on time. Booking approved."
        : "Payment recorded. Deposit not yet fully paid or not within allowed time.",
    };
  }

  static async getPendingBookingsByManager(managerId: string) {
    const venueVariableRepo = AppDataSource.getRepository(
      require("../models/Venue Tables/VenueVariable").VenueVariable
    );
    const managedVenues = await venueVariableRepo.find({
      where: { manager: { userId: managerId } },
      relations: ["venue"],
    });
    const venueIds = managedVenues.map((vv: any) => vv.venue.venueId);
    if (!venueIds.length) return [];
    const bookingRepo = AppDataSource.getRepository(
      require("../models/VenueBooking").VenueBooking
    );
    return await bookingRepo.find({
      where: { venueId: In(venueIds), bookingStatus: "PENDING" },
      relations: ["venue", "user", "event"],
      order: { createdAt: "DESC" },
    });
  }
}
