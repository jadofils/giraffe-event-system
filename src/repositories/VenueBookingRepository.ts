import { VenueBooking } from "../models/VenueBooking";
import { AppDataSource } from "../config/Database";
import { In } from "typeorm";
import { VenueVariable } from "../models/Venue Tables/VenueVariable";
import { CacheService } from "../services/CacheService";

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
      // Attach organizer to booking data
      const bookingWithOrganizer = { ...booking, organizer };
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
          slotsToCreate.push({
            venueId: venue.venueId,
            Date: new Date(d),
            startTime: null,
            endTime: null,
            isAvailable: false,
          });
        }
        // Add transition time slots after last date if specified
        if (transitionTime > 0) {
          let transitionDate = new Date(endDate);
          for (let i = 1; i <= transitionTime; i++) {
            transitionDate.setDate(transitionDate.getDate() + 1);
            slotsToCreate.push({
              venueId: venue.venueId,
              Date: new Date(transitionDate),
              startTime: null,
              endTime: null,
              isAvailable: false,
            });
          }
        }
      } else if (venue.bookingType === "HOURLY") {
        for (
          let d = new Date(startDate);
          d <= endDate;
          d.setDate(d.getDate() + 1)
        ) {
          slotsToCreate.push({
            venueId: venue.venueId,
            Date: new Date(d),
            startTime: booking.startTime
              ? new Date(`1970-01-01T${booking.startTime}`)
              : null,
            endTime: booking.endTime
              ? new Date(`1970-01-01T${booking.endTime}`)
              : null,
            isAvailable: false,
          });
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
}
