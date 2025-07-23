import { AppDataSource } from "../../config/Database";
import {
  VenueBookingPayment,
  VenueBookingPaymentStatus,
  PaymentMethod,
  PayerType,
} from "../../models/VenueBookingPayment";
import { VenueBooking, BookingStatus } from "../../models/VenueBooking";
import {
  VenueAvailabilitySlot,
  SlotStatus,
  SlotType,
} from "../../models/Venue Tables/VenueAvailabilitySlot";
import { BookingCondition } from "../../models/Venue Tables/BookingCondition";
import { Event } from "../../models/Event Tables/Event";
import { EventStatus } from "../../interfaces/Enums/EventStatusEnum";
import { In, Not, Raw } from "typeorm";
import { DeepPartial } from "typeorm";
import {
  PaymentServiceResponse,
  PaymentServiceError,
  BookingPaymentDetails,
} from "../../interfaces/PaymentServiceInterface";

export class VenueBookingPaymentService {
  private static generateTransitionHours(
    originalHours: number[],
    transitionHoursCount: number
  ): number[] {
    const transitionHours: number[] = [];
    const firstHour = Math.min(...originalHours);

    // Generate transition hours BEFORE the event hours
    for (let i = 1; i <= transitionHoursCount; i++) {
      const transitionHour = firstHour - i;
      if (transitionHour >= 0) {
        // Don't add hours before midnight
        transitionHours.unshift(transitionHour); // Add at start to maintain order
      }
    }

    return transitionHours;
  }

  private static async createDailySlot(
    queryRunner: any,
    venueId: string,
    date: Date,
    eventId: string | undefined,
    slotType: SlotType,
    description: string
  ): Promise<VenueAvailabilitySlot> {
    const slotData: DeepPartial<VenueAvailabilitySlot> = {
      venueId,
      Date: new Date(date),
      status:
        slotType === SlotType.TRANSITION
          ? SlotStatus.TRANSITION
          : SlotStatus.BOOKED,
      eventId: slotType === SlotType.EVENT ? eventId : null,
      slotType,
      notes: description,
    };

    const slot = queryRunner.manager.create(VenueAvailabilitySlot, slotData);
    return await queryRunner.manager.save(VenueAvailabilitySlot, slot);
  }

  private static async createHourlySlot(
    queryRunner: any,
    venueId: string,
    date: Date,
    eventHours: number[],
    transitionTime: number,
    eventId: string | undefined,
    description: string
  ): Promise<VenueAvailabilitySlot> {
    // Ensure eventHours is always an array
    const safeEventHours = Array.isArray(eventHours) ? eventHours : [];

    // Calculate transition hours BEFORE event hours
    const transitionHours = this.generateTransitionHours(
      safeEventHours,
      Math.ceil(transitionTime / 60)
    );

    const slotData: DeepPartial<VenueAvailabilitySlot> = {
      venueId,
      Date: new Date(date),
      bookedHours: [...transitionHours, ...safeEventHours], // Transition hours come first
      status: SlotStatus.BOOKED,
      eventId: eventId || null,
      slotType: SlotType.EVENT,
      notes: description,
      metadata: {
        transitionHours,
        originalEventHours: safeEventHours,
      },
    };

    const slot = queryRunner.manager.create(VenueAvailabilitySlot, slotData);
    return await queryRunner.manager.save(VenueAvailabilitySlot, slot);
  }

  static async processPayment(
    paymentData: any
  ): Promise<PaymentServiceResponse> {
    const queryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Get booking with all necessary relations
      const booking = await queryRunner.manager.findOne(VenueBooking, {
        where: { bookingId: paymentData.bookingId },
        relations: [
          "venue",
          "venue.bookingConditions",
          "venue.venueVariables",
          "event",
          "venue.organization",
        ],
      });

      if (!booking) {
        throw new Error("Booking not found");
      }

      // 2. Get existing payments for this booking
      const existingPayments = await queryRunner.manager.find(
        VenueBookingPayment,
        {
          where: { bookingId: paymentData.bookingId },
        }
      );

      const totalPaidSoFar = existingPayments.reduce(
        (sum, p) => sum + Number(p.amountPaid),
        0
      );

      // Calculate total hours and amount for hourly venues
      const totalHours = booking.bookingDates.reduce((sum, date) => {
        return sum + (date.hours?.length || 1); // If no hours specified, count as 1 day
      }, 0);

      const baseVenueAmount = booking.venue.venueVariables[0]?.venueAmount || 0;
      const totalVenueAmount =
        booking.venue.bookingType === "HOURLY"
          ? baseVenueAmount * totalHours
          : baseVenueAmount;

      const remainingAmountToPay = totalVenueAmount - totalPaidSoFar;

      // 3. Validate payment amount
      if (paymentData.amountPaid <= 0) {
        throw new Error("Payment amount must be greater than 0");
      }

      if (paymentData.amountPaid > remainingAmountToPay) {
        throw new Error(
          `Payment amount (${paymentData.amountPaid}) cannot exceed remaining amount to pay (${remainingAmountToPay})`
        );
      }

      const bookingCondition = booking.venue.bookingConditions[0];
      const depositPercent = bookingCondition?.depositRequiredPercent;
      if (!depositPercent && depositPercent !== 0) {
        throw new Error(
          "Deposit percentage not set in venue booking conditions"
        );
      }

      const depositRequired = (totalVenueAmount * depositPercent) / 100;

      // If this is first payment, it must meet minimum deposit requirement
      if (totalPaidSoFar === 0 && paymentData.amountPaid < depositRequired) {
        throw new Error(
          `First payment must be at least the required deposit amount: ${depositRequired} (${depositPercent}% of total amount ${totalVenueAmount}${
            booking.venue.bookingType === "HOURLY"
              ? ` for ${totalHours} hours`
              : ""
          })`
        );
      }

      // Allow for small floating point differences
      const newTotalPaid = totalPaidSoFar + paymentData.amountPaid;
      if (Math.abs(newTotalPaid - totalVenueAmount) < 0.01) {
        paymentData.amountPaid = remainingAmountToPay;
      }

      // 4. Create payment record
      const payment = queryRunner.manager.create(VenueBookingPayment, {
        ...paymentData,
        remainingAmount: totalVenueAmount - newTotalPaid,
        isFullPayment: newTotalPaid >= totalVenueAmount,
        paymentStatus:
          newTotalPaid >= totalVenueAmount
            ? VenueBookingPaymentStatus.PAID
            : VenueBookingPaymentStatus.PARTIAL,
      });
      await queryRunner.manager.save(payment);

      // 5. Check if this is the first payment meeting deposit requirement
      const isFirstDepositPayment =
        totalPaidSoFar < depositRequired && newTotalPaid >= depositRequired;

      // 6. Update booking status
      booking.bookingStatus =
        newTotalPaid >= totalVenueAmount
          ? BookingStatus.APPROVED_PAID
          : BookingStatus.APPROVED_NOT_PAID;
      booking.isPaid = newTotalPaid >= totalVenueAmount;
      await queryRunner.manager.save(booking);

      // Handle venue availability slots ONLY on first deposit payment
      if (isFirstDepositPayment) {
        const transitionTime = bookingCondition?.transitionTime || 0;
        const availabilitySlotRepo = queryRunner.manager.getRepository(
          VenueAvailabilitySlot
        );

        if (booking.venue.bookingType === "DAILY") {
          for (const bookingDate of booking.bookingDates) {
            const eventDate = new Date(bookingDate.date);

            // Check if event slot already exists
            const existingEventSlot = await availabilitySlotRepo.findOne({
              where: {
                venueId: booking.venue.venueId,
                Date: eventDate,
              },
            });

            if (!existingEventSlot) {
              // Create slot for the event date
              await this.createDailySlot(
                queryRunner,
                booking.venue.venueId,
                eventDate,
                booking.eventId,
                SlotType.EVENT,
                `Booked for event ${booking.eventId}`
              );

              // If there's transition time, try to create slot for the day BEFORE
              if (transitionTime > 0) {
                const transitionDate = new Date(eventDate);
                transitionDate.setDate(transitionDate.getDate() - 1); // One day before

                // Check if transition slot is available
                const existingTransitionSlot =
                  await availabilitySlotRepo.findOne({
                    where: {
                      venueId: booking.venue.venueId,
                      Date: transitionDate,
                    },
                  });

                // Only create transition slot if the day before is available
                if (!existingTransitionSlot) {
                  await this.createDailySlot(
                    queryRunner,
                    booking.venue.venueId,
                    transitionDate,
                    booking.eventId,
                    SlotType.TRANSITION,
                    `Transition time for event on ${
                      eventDate.toISOString().split("T")[0]
                    }`
                  );
                }
              }
            }
          }
        } else {
          // HOURLY
          for (const bookingDate of booking.bookingDates) {
            const date = new Date(bookingDate.date);
            const hours = Array.isArray(bookingDate.hours)
              ? bookingDate.hours
              : [];

            // Check if slot already exists for this date
            const existingSlot = await availabilitySlotRepo.findOne({
              where: {
                venueId: booking.venue.venueId,
                Date: date,
              },
            });

            // For hourly bookings, check if any of the hours are already booked
            if (existingSlot) {
              const existingHours = existingSlot.bookedHours || [];
              const hasConflict = hours.some((hour) =>
                existingHours.includes(hour)
              );
              if (hasConflict) {
                throw new Error(
                  `Some hours are already booked for date ${
                    date.toISOString().split("T")[0]
                  }`
                );
              }
            }

            if (!existingSlot) {
              await this.createHourlySlot(
                queryRunner,
                booking.venue.venueId,
                date,
                hours,
                transitionTime,
                booking.eventId,
                `Booked for event ${booking.eventId}`
              );
            } else {
              // Update existing slot with new hours
              existingSlot.bookedHours = [
                ...new Set([...(existingSlot.bookedHours || []), ...hours]),
              ];
              await availabilitySlotRepo.save(existingSlot);
            }
          }
        }

        // Cancel conflicting bookings
        const conflictingBookings = await queryRunner.manager.find(
          VenueBooking,
          {
            where: {
              venueId: booking.venue.venueId,
              bookingId: Not(booking.bookingId),
              bookingStatus: In([
                BookingStatus.PENDING,
                BookingStatus.APPROVED_NOT_PAID,
              ]),
            },
            relations: ["event"],
          }
        );

        // Filter conflicting bookings
        const filteredConflictingBookings = conflictingBookings.filter(
          (conflictBooking) => {
            return conflictBooking.bookingDates.some((conflictDate) => {
              const bookingDate = new Date(conflictDate.date);

              // Check if this date is now marked as unavailable
              const isDateConflicting = booking.bookingDates.some(
                (bookedDate) => {
                  const currentBookingDate = new Date(bookedDate.date);
                  return bookingDate.getTime() === currentBookingDate.getTime();
                }
              );

              if (!isDateConflicting) return false;

              // For hourly bookings, check hour overlap
              if (booking.venue.bookingType === "HOURLY") {
                const conflictHours = conflictDate.hours || [];
                if (conflictHours.length > 0) {
                  return booking.bookingDates.some((bookedDate) => {
                    const bookedHours = bookedDate.hours || [];
                    if (bookedHours.length === 0) return false;

                    // Get all hours including transition time
                    const bookedHoursWithTransition = [
                      ...this.generateTransitionHours(
                        bookedHours,
                        Math.ceil(transitionTime / 60)
                      ),
                      ...bookedHours,
                    ];

                    return conflictHours.some((hour) =>
                      bookedHoursWithTransition.includes(hour)
                    );
                  });
                }
              }

              return true;
            });
          }
        );

        // Cancel conflicting bookings
        for (const conflictBooking of filteredConflictingBookings) {
          conflictBooking.bookingStatus = BookingStatus.CANCELLED;
          conflictBooking.cancellationReason =
            "Venue has been booked by another event";
          await queryRunner.manager.save(conflictBooking);

          if (conflictBooking.event) {
            conflictBooking.event.eventStatus = EventStatus.CANCELLED;
            await queryRunner.manager.save(conflictBooking.event);
          }
        }
      }

      await queryRunner.commitTransaction();

      // Create response with booking details
      const bookingDetails: BookingPaymentDetails = {
        ...booking,
        totalAmount: totalVenueAmount,
        totalHours:
          booking.venue.bookingType === "HOURLY" ? totalHours : undefined,
        pricePerHour:
          booking.venue.bookingType === "HOURLY" ? baseVenueAmount : undefined,
      };

      return {
        success: true,
        data: {
          payment,
          booking: bookingDetails,
        },
        message: payment.isFullPayment
          ? "Payment completed successfully"
          : isFirstDepositPayment
          ? `Deposit payment received (${
              bookingCondition?.depositRequiredPercent
            }% of total amount ${totalVenueAmount}${
              booking.venue.bookingType === "HOURLY"
                ? ` for ${totalHours} hours`
                : ""
            }) and venue slots reserved`
          : "Partial payment processed successfully",
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  static async getPaymentHistory(bookingId: string) {
    const payments = await AppDataSource.getRepository(
      VenueBookingPayment
    ).find({
      where: { bookingId },
      order: { paymentDate: "DESC" },
    });

    const totalPaid = payments.reduce(
      (sum, p) => sum + Number(p.amountPaid),
      0
    );
    const booking = await AppDataSource.getRepository(VenueBooking).findOne({
      where: { bookingId },
      relations: ["venue", "venue.bookingConditions"],
    });

    const requiredAmount = booking?.amountToBePaid || 0;
    const depositRequired = booking?.venue.bookingConditions[0]
      ?.depositRequiredPercent
      ? (requiredAmount *
          booking.venue.bookingConditions[0].depositRequiredPercent) /
        100
      : requiredAmount;

    return {
      payments,
      summary: {
        totalPaid,
        requiredAmount,
        depositRequired,
        remainingAmount: requiredAmount - totalPaid,
        isFullyPaid: totalPaid >= requiredAmount,
        hasMetDepositRequirement: totalPaid >= depositRequired,
      },
    };
  }
}
