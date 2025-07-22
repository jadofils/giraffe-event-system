import { VenueBookingPayment } from "../models/VenueBookingPayment";

export interface PaymentServiceResponse {
  success: boolean;
  data: VenueBookingPayment;
  message: string;
}

export interface PaymentServiceError {
  success: false;
  message: string;
}
