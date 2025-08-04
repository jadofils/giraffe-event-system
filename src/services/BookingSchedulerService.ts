import cron from "node-cron";
import { AppDataSource } from "../config/Database";
import { VenueBooking, BookingStatus } from "../models/VenueBooking";
import {
  VenueAvailabilitySlot,
  SlotStatus,
  SlotType,
} from "../models/Venue Tables/VenueAvailabilitySlot";
import { LessThan, In, Not } from "typeorm";
import { Event } from "../models/Event Tables/Event";
import { EventStatus } from "../interfaces/Enums/EventStatusEnum"; // Correct import path for EventStatus
import { CloudinaryUploadService } from "./CloudinaryUploadService"; // Assuming this is needed for cleanup

export class BookingSchedulerService {
  public static startScheduling(): void {
    console.log("BookingSchedulerService: Starting cron jobs...");

    // 1. Task to transition HOLDING bookings to FAILED after timeout
    cron.schedule(
      "* * * * *",
      async () => {
        // Run every minute
        console.log("Running cron job: Check for expired HOLDING bookings");
        const queryRunner = AppDataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
          const now = new Date();
          const bookingRepo = queryRunner.manager.getRepository(VenueBooking);
          const vaSlotRepo = queryRunner.manager.getRepository(
            VenueAvailabilitySlot
          );

          const expiredHoldings = await bookingRepo.find({
            where: {
              bookingStatus: BookingStatus.HOLDING,
              holdingExpiresAt: LessThan(now),
            },
            relations: ["event"], // Load event to update its status if necessary
          });

          if (expiredHoldings.length > 0) {
            console.log(
              `Found ${expiredHoldings.length} expired HOLDING bookings.`
            );
          }

          for (const booking of expiredHoldings) {
            booking.bookingStatus = BookingStatus.FAILED;
            booking.cancellationReason =
              "Booking timed out: payment not received within the allowed period.";
            await queryRunner.manager.save(booking);

            // Delete associated HOLDING availability slots (event and transition)
            if (booking.eventId) {
              const slots = await vaSlotRepo.find({
                where: {
                  venueId: booking.venueId,
                  eventId: booking.eventId,
                  status: SlotStatus.HOLDING, // Only delete slots that are currently holding
                },
              });
              for (const slot of slots) {
                await queryRunner.manager.remove(slot); // Delete the slot
              }

              // Optional: Mark event as CANCELLED if it's a single-booking event or all its bookings failed
              if (booking.event) {
                // If this is the only booking for the event OR if all other bookings for this event are also FAILED/CANCELLED
                const otherBookingsForEvent = await bookingRepo.find({
                  where: {
                    eventId: booking.eventId,
                    bookingId: Not(booking.bookingId), // Exclude current booking
                    bookingStatus: Not(
                      In([BookingStatus.FAILED, BookingStatus.CANCELLED])
                    ),
                  },
                });

                if (otherBookingsForEvent.length === 0) {
                  const eventRepo = queryRunner.manager.getRepository(Event);
                  booking.event.eventStatus = EventStatus.CANCELLED;
                  booking.event.cancellationReason =
                    "Event cancelled due to venue booking failure: timed out.";
                  await eventRepo.save(booking.event);
                }
              }
            }
          }

          await queryRunner.commitTransaction();
        } catch (error) {
          console.error("Cron job (HOLDING to FAILED) failed:", error);
          await queryRunner.rollbackTransaction();
        } finally {
          await queryRunner.release();
        }
      },
      { timezone: "UTC" }
    ); // Removed 'scheduled: true'

    // 2. Task to delete FAILED bookings after an additional 5 minutes and free up slots
    cron.schedule(
      "* * * * *",
      async () => {
        // Run every minute
        console.log("Running cron job: Check for FAILED bookings to delete");
        const queryRunner = AppDataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
          const now = new Date();
          const gracePeriod = 5 * 60 * 1000; // 5 minutes in milliseconds
          const bookingRepo = queryRunner.manager.getRepository(VenueBooking);
          const vaSlotRepo = queryRunner.manager.getRepository(
            VenueAvailabilitySlot
          );

          // Find FAILED bookings that are older than (holdingExpiresAt + gracePeriod)
          // OR FAILED bookings whose createdAt is older than 5 minutes (for manual FAILED set)
          const bookingsToDelete = await bookingRepo
            .createQueryBuilder("booking")
            .where("booking.bookingStatus = :status", {
              status: BookingStatus.FAILED,
            })
            .andWhere(
              "((booking.holdingExpiresAt IS NOT NULL AND booking.holdingExpiresAt + INTERVAL '1 minute' * :graceMinutes < :now) OR (booking.holdingExpiresAt IS NULL AND booking.createdAt + INTERVAL '1 minute' * :graceMinutes < :now))",
              { graceMinutes: 5, now: now.toISOString() }
            )
            .getMany();

          if (bookingsToDelete.length > 0) {
            console.log(
              `Found ${bookingsToDelete.length} FAILED bookings to delete.`
            );
          }

          for (const booking of bookingsToDelete) {
            // Delete all associated availability slots (event and transition) for this eventId
            if (booking.eventId) {
              const slots = await vaSlotRepo.find({
                where: {
                  venueId: booking.venueId,
                  eventId: booking.eventId, // Slots still associated with this event
                  // Do not filter by status here, as we want to clean up any remaining slot linked to this event
                },
              });
              for (const slot of slots) {
                await queryRunner.manager.remove(slot); // Delete the slot
              }
            }

            await queryRunner.manager.remove(booking); // Delete the booking record
          }

          await queryRunner.commitTransaction();
        } catch (error) {
          console.error("Cron job (FAILED to DELETED) failed:", error);
          await queryRunner.rollbackTransaction();
        } finally {
          await queryRunner.release();
        }
      },
      { timezone: "UTC" }
    ); // Removed 'scheduled: true'

    console.log("BookingSchedulerService: All cron jobs scheduled.");
  }
}
