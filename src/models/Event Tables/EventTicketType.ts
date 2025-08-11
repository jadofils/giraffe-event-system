import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from "typeorm";
import { Event } from "./Event";
import { Registration } from "../Registration";
import {
  TicketCategory,
  AgeRestriction,
  TicketStatus,
} from "../../interfaces/Enums/TicketEnums";

@Entity()
export class EventTicketType {
  @PrimaryGeneratedColumn("uuid")
  ticketTypeId!: string;

  @Column()
  eventId!: string;

  @ManyToOne(() => Event, (event) => event.ticketTypes)
  @JoinColumn({ name: "eventId" })
  event!: Event;

  @Column()
  name!: string;

  @Column("decimal", { precision: 10, scale: 2 })
  price!: number;

  @Column("int")
  quantityAvailable!: number;

  @Column("int", { default: 0 })
  quantitySold!: number;

  @Column({ default: "USD" })
  currency!: string;

  @Column({ nullable: true, type: "text" })
  description?: string;

  @Column({ type: "timestamp", nullable: true })
  saleStartsAt?: Date;

  @Column({ type: "timestamp", nullable: true })
  saleEndsAt?: Date;

  @Column({ type: "date", nullable: true }) // New field for the specific date this ticket type is valid for
  validForDate?: string;

  @Column({ type: "timestamp", default: () => "CURRENT_TIMESTAMP" })
  createdAt!: Date;

  @Column({
    type: "timestamp",
    default: () => "CURRENT_TIMESTAMP",
    onUpdate: "CURRENT_TIMESTAMP",
  })
  updatedAt!: Date;

  @Column("int", { default: 1 })
  maxPerPerson!: number;

  @Column({ type: "boolean", default: true })
  isActive!: boolean;

  @Column({ type: "varchar", length: 50, nullable: true })
  startTime?: string;

  @Column({ type: "varchar", length: 50, nullable: true })
  endTime?: string;

  @Column({ type: "jsonb", nullable: true, default: [] })
  customerBenefits?: { title: string; description: string }[];

  @Column({ type: "jsonb", nullable: true })
  discount?: {
    discountName: string;
    percentage: number;
    startDate: Date;
    endDate: Date;
  };

  @Column({ type: "boolean", default: false })
  isRefundable!: boolean;

  @Column({ type: "text", nullable: true })
  refundPolicy?: string;

  @Column({ type: "boolean", default: true })
  transferable!: boolean;

  @Column({
    type: "enum",
    enum: AgeRestriction,
    default: AgeRestriction.NO_RESTRICTION,
  })
  ageRestriction!: AgeRestriction;

  @Column({ type: "text", nullable: true })
  specialInstructions?: string;

  @Column({ type: "enum", enum: TicketStatus, default: TicketStatus.ACTIVE })
  status!: TicketStatus;

  @OneToMany(() => Registration, (registration) => registration.ticketType)
  registrations!: Registration[];
}
