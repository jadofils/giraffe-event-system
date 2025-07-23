import { VenueBookingPayment } from "../models/VenueBookingPayment";
import { VenueBooking } from "../models/VenueBooking";

export interface BookingPaymentDetails extends VenueBooking {
  totalAmount?: number;
  totalHours?: number;
  pricePerHour?: number;
}

export interface PaymentServiceResponse {
  success: boolean;
  data: {
    payment: VenueBookingPayment;
    booking: BookingPaymentDetails;
  };
  message: string;
}

export interface PaymentServiceError {
  success: boolean;
  message: string;
}
