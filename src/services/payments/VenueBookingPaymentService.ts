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
import { EmailService } from "../emails/EmailService";
import { PaymentPdfService } from "./PaymentPdfService";

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
      eventId: eventId, // Always set eventId for both EVENT and TRANSITION slots
      slotType,
      notes: description,
      metadata:
        slotType === SlotType.TRANSITION && eventId
          ? { relatedEventId: eventId }
          : undefined, // Add metadata for transition slots
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

      // Calculate total amount based on booking type and dates for validation
      const baseVenueAmount = booking.venue.venueVariables[0]?.venueAmount || 0;
      let totalHoursCalculated = 0; // Initialize
      let totalDaysCalculated = 0; // Initialize

      if (booking.venue.bookingType === "HOURLY") {
        totalHoursCalculated = booking.bookingDates.reduce(
          (sum: number, date: any) => {
            return sum + (date.hours?.length || 0);
          },
          0
        );
      } else if (booking.venue.bookingType === "DAILY") {
        totalDaysCalculated = booking.bookingDates.length;
      }

      const calculatedTotalVenueAmount = // Use a distinct name to avoid confusion with stored amount
        booking.venue.bookingType === "HOURLY"
          ? baseVenueAmount * totalHoursCalculated
          : baseVenueAmount * totalDaysCalculated; // Use totalDaysCalculated for daily

      // Verify calculated amount matches stored booking amount (with tolerance for floats)
      if (
        Math.abs(calculatedTotalVenueAmount - (booking.amountToBePaid ?? 0)) >
        0.01
      ) {
        throw new Error(
          `Payment amount mismatch. Expected: ${
            booking.amountToBePaid ?? 0
          }, Calculated: ${calculatedTotalVenueAmount}. This indicates an inconsistency between event creation and current venue pricing.`
        );
      }

      const remainingAmountToPay =
        (booking.amountToBePaid ?? 0) - totalPaidSoFar;

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

      const depositRequired =
        ((booking.amountToBePaid ?? 0) * depositPercent) / 100;

      // If this is first payment, it must meet minimum deposit requirement
      if (totalPaidSoFar === 0 && paymentData.amountPaid < depositRequired) {
        throw new Error(
          `First payment must be at least the required deposit amount: ${depositRequired} (${depositPercent}% of total amount ${
            booking.amountToBePaid ?? 0
          })`
        );
      }

      // Allow for small floating point differences
      const newTotalPaid = totalPaidSoFar + paymentData.amountPaid;
      const isFullPayment =
        Math.abs(newTotalPaid - (booking.amountToBePaid ?? 0)) < 0.01;

      // 4. Create payment record
      const payment = queryRunner.manager.create(VenueBookingPayment, {
        ...paymentData,
        remainingAmount: (booking.amountToBePaid ?? 0) - newTotalPaid,
        isFullPayment,
        paymentStatus:
          paymentData.amountPaid <= 0
            ? VenueBookingPaymentStatus.FAILED
            : VenueBookingPaymentStatus.COMPLETED, // Set to COMPLETED or FAILED for individual payment
      });

      await queryRunner.manager.save(payment);

      // Generate a simple receipt number after payment has been saved and payment.paymentId is available
      const receiptNumber = `REC-${new Date().getFullYear()}-${
        new Date().getMonth() + 1
      }${new Date().getDate()}-${payment.paymentId
        .substring(0, 5)
        .toUpperCase()}`;

      // Assign the generated receipt number to the payment object
      payment.receiptNumber = receiptNumber; // Assign receipt number here

      await queryRunner.manager.save(payment); // Save again to persist receiptNumber

      // 5. Check if this is the first payment meeting deposit requirement
      const isFirstDepositPayment =
        totalPaidSoFar < depositRequired && newTotalPaid >= depositRequired;

      // 6. Update booking status
      // Capture previous status to determine if slot updates are needed
      const previousBookingStatus = booking.bookingStatus;
      booking.bookingStatus =
        newTotalPaid >= (booking.amountToBePaid ?? 0)
          ? BookingStatus.APPROVED_PAID
          : newTotalPaid > 0
          ? BookingStatus.PARTIAL
          : BookingStatus.PENDING; // Keep PENDING if no payment made yet or partial is not applied
      booking.isPaid = newTotalPaid > 0;
      booking.paymentConfirmationDate = new Date(); // Update transaction date on any payment
      await queryRunner.manager.save(booking);

      // Handle venue availability slots ONLY if booking was previously HOLDING or PENDING
      if (
        previousBookingStatus === BookingStatus.HOLDING ||
        previousBookingStatus === BookingStatus.PENDING
      ) {
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
                status: SlotStatus.HOLDING, // Only consider holding slots for update
                eventId: booking.eventId, // Ensure it's for this event
              },
            });

            if (existingEventSlot) {
              // Update existing holding slot to BOOKED
              existingEventSlot.status = SlotStatus.BOOKED;
              await queryRunner.manager.save(existingEventSlot);
            } else {
              // This scenario should ideally not happen if HOLDING slots are created correctly,
              // but as a fallback, ensure it's BOOKED if it was somehow skipped.
              // Or, if it's already BOOKED by this event, then no action needed.
              // For now, let's log a warning if an event slot is not found as HOLDING.
              console.warn(
                `Event slot for ${
                  eventDate.toISOString().split("T")[0]
                } not found as HOLDING for venue ${
                  booking.venue.venueId
                } for event ${
                  booking.eventId
                }. It might already be BOOKED or AVAILABLE.`
              );
            }

            // If there's transition time, update slot for the day BEFORE
            if (transitionTime > 0) {
              const transitionDate = new Date(eventDate);
              transitionDate.setDate(transitionDate.getDate() - 1); // One day before

              // Check if transition slot is HOLDING
              const existingTransitionSlot = await availabilitySlotRepo.findOne(
                {
                  where: {
                    venueId: booking.venue.venueId,
                    Date: transitionDate,
                    status: SlotStatus.HOLDING, // Only consider holding slots for update
                    eventId: booking.eventId, // Ensure it's for this event
                    slotType: SlotType.TRANSITION,
                  },
                }
              );

              if (existingTransitionSlot) {
                // Update existing holding transition slot to TRANSITION
                existingTransitionSlot.status = SlotStatus.TRANSITION;
                await queryRunner.manager.save(existingTransitionSlot);
              } else {
                // Log a warning if a transition slot is not found as HOLDING.
                console.warn(
                  `Transition slot for ${
                    transitionDate.toISOString().split("T")[0]
                  } not found as HOLDING for venue ${
                    booking.venue.venueId
                  } for event ${
                    booking.eventId
                  }. It might already be TRANSITION or AVAILABLE.`
                );
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

            // Find the holding slot for this date and event
            const existingSlot = await availabilitySlotRepo.findOne({
              where: {
                venueId: booking.venue.venueId,
                Date: date,
                status: SlotStatus.HOLDING,
                eventId: booking.eventId,
              },
            });

            if (existingSlot) {
              // Update status to BOOKED and TRANSITION (for relevant hours)
              existingSlot.status = SlotStatus.BOOKED;
              await queryRunner.manager.save(existingSlot);
            } else {
              console.warn(
                `Hourly slot for ${
                  date.toISOString().split("T")[0]
                } not found as HOLDING for venue ${
                  booking.venue.venueId
                } for event ${
                  booking.eventId
                }. It might already be BOOKED or AVAILABLE.`
              );
            }
          }
        }
      }

      await queryRunner.commitTransaction();

      let uploadResult: { url: string; public_id: string } | undefined; // Declare uploadResult here

      // Fetch payer details for email
      let payerEmail: string | undefined;
      let payerFullName: string | undefined;

      if (booking.event) {
        if (booking.event.eventOrganizerType === PayerType.USER) {
          const userRepo = AppDataSource.getRepository(
            require("../../models/User").User
          );
          const user = await userRepo.findOne({
            where: { userId: booking.event.eventOrganizerId },
          });
          if (user) {
            payerEmail = user.email;
            payerFullName = `${user.firstName || ""} ${
              user.lastName || ""
            }`.trim();
          }
        } else if (
          booking.event.eventOrganizerType === PayerType.ORGANIZATION
        ) {
          const orgRepo = AppDataSource.getRepository(
            require("../../models/Organization").Organization
          );
          const organization = await orgRepo.findOne({
            where: { organizationId: booking.event.eventOrganizerId },
          });
          if (organization) {
            payerEmail = organization.contactEmail;
            payerFullName = organization.organizationName;
          }
        }
      }

      // Send payment receipt email
      if (payerEmail && payerFullName && booking.venue.organization) {
        try {
          const paymentDetailsDescription = `Venue booking for ${
            booking.event?.eventName || "an event"
          } at ${booking.venue.venueName}`;

          // Generate a simple receipt number
          const receiptNumber = `REC-${new Date().getFullYear()}-${
            new Date().getMonth() + 1
          }${new Date().getDate()}-${payment.paymentId
            .substring(0, 5)
            .toUpperCase()}`;

          const dateBookedFor = booking.bookingDates
            .map((b) =>
              new Date(b.date).toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })
            )
            .join(", ");

          const pdfBuffer = await PaymentPdfService.generatePaymentReceiptPdf({
            payerName: payerFullName,
            payerEmail: payerEmail,
            paymentDetails: paymentDetailsDescription,
            paidAmount: paymentData.amountPaid,
            totalAmount: booking.amountToBePaid ?? 0,
            remainingAmount: (booking.amountToBePaid ?? 0) - newTotalPaid,
            transactionId: payment.paymentId,
            paymentDate: payment.paymentDate,
            receiptNumber: receiptNumber,
            venueName: booking.venue.venueName,
            dateBookedFor: dateBookedFor,
            organizationName: booking.venue.organization.organizationName || "",
            organizationAddress: booking.venue.organization.address || "",
            organizationEmail: booking.venue.organization.contactEmail || "",
            organizationPhone: booking.venue.organization.contactPhone || "",
            organizationLogoUrl: booking.venue.organization.logo || undefined,
            paymentMethod: payment.paymentMethod, // Pass the actual payment method
          });

          uploadResult = await PaymentPdfService.uploadPaymentReceiptPdf(
            pdfBuffer,
            payerFullName,
            payment.paymentId
          );

          // Update the payment record with the receipt URL after successful upload
          payment.receiptUrl = uploadResult.url;
          await queryRunner.manager.save(payment); // Persist the receipt URL

          await EmailService.sendPaymentReceiptEmail({
            to: payerEmail,
            payerName: payerFullName,
            paymentDetails: paymentDetailsDescription,
            paidAmount: paymentData.amountPaid,
            totalAmount: booking.amountToBePaid ?? 0,
            remainingAmount: (booking.amountToBePaid ?? 0) - newTotalPaid,
            pdfUrl: uploadResult.url,
            transactionId: payment.paymentId,
            paymentDate: payment.paymentDate,
          });
        } catch (emailError) {
          console.error(
            "Failed to send payment receipt email or upload PDF:",
            emailError
          );
          // Log the error but don't block the payment process
        }
      }

      // Create response with booking details
      const baseVenueAmountForDisplay =
        booking.venue.venueVariables[0]?.venueAmount || 0;
      let displayHours = undefined;
      let displayDays = undefined;

      if (booking.venue.bookingType === "HOURLY") {
        displayHours = booking.bookingDates.reduce((sum: number, date: any) => {
          return sum + (date.hours?.length || 0);
        }, 0);
      } else if (booking.venue.bookingType === "DAILY") {
        displayDays = booking.bookingDates.length;
      }

      const bookingDetails: BookingPaymentDetails = {
        ...booking,
        totalAmount: booking.amountToBePaid,
        totalHours: displayHours,
        pricePerHour:
          booking.venue.bookingType === "HOURLY"
            ? baseVenueAmountForDisplay
            : undefined,
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
            }% of total amount ${booking.amountToBePaid ?? 0}${
              booking.venue.bookingType === "HOURLY"
                ? ` for ${displayHours} hours`
                : booking.venue.bookingType === "DAILY"
                ? ` for ${displayDays} days`
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
