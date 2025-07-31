import { AppDataSource } from "../config/Database";
import { TicketPayment } from "../models/TicketPayment";
import { Repository } from "typeorm";

export class TicketPaymentRepository {
  private static repository: Repository<TicketPayment> =
    AppDataSource.getRepository(TicketPayment);

  static async createTicketPayment(
    paymentData: Partial<TicketPayment>
  ): Promise<TicketPayment> {
    const newPayment = this.repository.create(paymentData);
    return await this.repository.save(newPayment);
  }

  static async getTicketPaymentById(
    paymentId: string
  ): Promise<TicketPayment | null> {
    return await this.repository.findOne({ where: { paymentId } });
  }

  // static async getPaymentsByRegistrationId(
  //   registrationId: string
  // ): Promise<TicketPayment[]> {
  //   return await this.repository.find({ where: { registrationId } });
  // }

  static async updateTicketPayment(
    paymentId: string,
    updates: Partial<TicketPayment>
  ): Promise<TicketPayment | null> {
    const payment = await this.repository.findOne({ where: { paymentId } });
    if (!payment) return null;

    Object.assign(payment, updates);
    return await this.repository.save(payment);
  }

  static async deleteTicketPayment(paymentId: string): Promise<boolean> {
    const result = await this.repository.delete(paymentId);
    return result.affected !== 0;
  }
}
