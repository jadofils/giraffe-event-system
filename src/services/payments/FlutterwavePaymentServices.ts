import axios from 'axios';
import { PaymentRepository } from '../../repositories/PaymentRepository';
import { PaymentStatus } from '../../interfaces/Index';
import * as dotenv from 'dotenv';
dotenv.config(); // Load environment variables
const FLW_SECRET_KEY = process.env.FLW_SECRET_KEY!;
const FLW_BASE_URL = 'https://api.flutterwave.com/v3';

interface FlutterwaveVerifyResponse {
  status: string;
  message: string;
  data: {
    status: string;
    tx_ref: string;
    flw_ref: string;
    amount: number;
    created_at: string;
    payment_type: string;
  };
}

export class FlutterwavePaymentService {
  static async verifyAndRecordPayment(
    txRef: string,
    invoiceId: string
  ): Promise<{ isSuccessful: boolean; paymentData?: any }> {
    try {
      // 1. Verify payment with Flutterwave
      const response = await axios.get<FlutterwaveVerifyResponse>(
        `${FLW_BASE_URL}/transactions/verify_by_reference?tx_ref=${encodeURIComponent(txRef)}`,
        {
          headers: {
            Authorization: `Bearer ${FLW_SECRET_KEY}`,
          },
        }
      );

      if (!response.data || !response.data.data) {
        throw new Error('Invalid response from Flutterwave');
      }
      const data = response.data.data;
      const isSuccessful = data?.status === 'successful';

      // 2. Optionally, record the payment in your database
      if (isSuccessful) {
        const paymentRecord = {
          invoiceId,
          txRef: data.tx_ref,
          flwRef: data.flw_ref,
          paidAmount: data.amount,
          paymentStatus: PaymentStatus.SUCCESSFUL,
          paymentDate: data.created_at,
          paymentMethod: data.payment_type,
          isSuccessful: true,
          paymentResponse: JSON.stringify(data),
        };

        await PaymentRepository.createPayment(paymentRecord);
      }

      return { isSuccessful, paymentData: data };
    } catch (error: any) {
      console.error('Flutterwave verification failed:', error?.response?.data || error.message);
      return { isSuccessful: false };
    }
  }


   async  initiateFlutterwavePayment(paymentData: any) {
      try {
          const response = await axios.post('https://api.flutterwave.com/v3/payments', {
              tx_ref: paymentData.txRef,
              amount: paymentData.paidAmount,
              currency: 'USD',
              redirect_url: 'https://yourwebsite.com/payment-success',
              customer: {
                  email: paymentData.paidBy || 'default@example.com',
              },
              payment_options: 'card, mobilemoney, banktransfer',
          }, {
              headers: {
                  Authorization: `Bearer ${process.env.FLW_SECRET_KEY}`,
                  'Content-Type': 'application/json',
              },
          });
  
          return response.data;
      } catch (error:any) {
          console.error('Error initiating payment:', error?.response?.data || error.message);
          throw new Error('Failed to initiate payment.');
      }
  }
}