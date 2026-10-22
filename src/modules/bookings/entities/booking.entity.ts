import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

import { Vehicle } from '../../vehicles/entities/vehicles.entity';

export enum BookingStatus {
  PENDING = 'Pending',
  APPROVED = 'Approved',
  DECLINED = 'Declined',
  RETURNED = 'Returned',
  COMPLETED = 'Completed',
  CANCELLED = 'Cancelled',
}

// How the customer wants to drive the vehicle.
export enum DriveType {
  SELF_DRIVE = 'Self Drive',
  WITH_DRIVER = 'With Driver',
}

// How the vehicle changes hands: the customer picks it up, or we deliver it.
export enum HandoverMethod {
  PICKUP = 'Pickup',
  DELIVERY = 'Delivery',
}

// Accepted payment methods (recorded by the admin).
export enum PaymentMethod {
  GCASH = 'GCash',
  MAYA = 'Maya',
  BANK_TRANSFER = 'Bank Transfer',
  CASH = 'Cash',
}

// How much of the total has been paid (set by the admin).
export enum PaymentStatus {
  UNPAID = 'Unpaid',
  DOWNPAYMENT = 'Down Payment',
  FULLY_PAID = 'Fully Paid',
}

// A reservation request. Customers don't have accounts: the website's booking
// form sends their details, and an admin confirms by phone, assigns a car from
// the fleet and manages the booking from the dashboard.
@Entity('bookings')
export class Booking {
  @PrimaryGeneratedColumn()
  id!: number;

  // Short reference shown to the customer, e.g. "AD-1013-7K2Q".
  @Column({ type: 'varchar', length: 20, unique: true })
  reference!: string;

  // --- Customer ------------------------------------------------------------

  @Column({ type: 'varchar', length: 100 })
  customerName!: string;

  @Column({ type: 'varchar', length: 30 })
  customerPhone!: string;

  @Column({ type: 'varchar', length: 120, nullable: true })
  customerEmail!: string | null;

  @Column({ type: 'varchar', length: 200, default: '' })
  customerAddress!: string;

  // Work place / business.
  @Column({ type: 'varchar', length: 200, default: '' })
  customerWork!: string;

  // --- Car requested -------------------------------------------------------

  // Website car class: sedan | mpv | suv | van.
  @Column({ type: 'varchar', length: 20, nullable: true })
  carCategory!: string | null;

  // Website model id (e.g. "toyota-vios"); null means "any car in the class".
  @Column({ type: 'varchar', length: 60, nullable: true })
  carModel!: string | null;

  // What the customer picked, as shown to them, e.g. "Toyota Vios (Sedan)".
  @Column({ type: 'varchar', length: 120, default: '' })
  carLabel!: string;

  // The fleet unit the admin assigns. Optional until the booking is handled.
  @ManyToOne(() => Vehicle, {
    eager: true,
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'vehicleId' })
  vehicle!: Vehicle | null;

  @Column({ type: 'int', nullable: true })
  vehicleId!: number | null;

  // --- Trip ----------------------------------------------------------------

  @Column({ type: 'varchar', length: 120, default: '' })
  destination!: string;

  // Rate zone label, e.g. "Within Caraga".
  @Column({ type: 'varchar', length: 60, default: '' })
  rateZone!: string;

  @Column({ type: 'varchar', length: 200, nullable: true })
  specificPlace!: string | null;

  // Pickup date; endDate is the return date (startDate + days).
  @Column({ type: 'date' })
  startDate!: string;

  @Column({ type: 'date' })
  endDate!: string;

  // Pickup time, e.g. "10:00" (Philippine time).
  @Column({ type: 'varchar', length: 20, nullable: true })
  pickupTime!: string | null;

  @Column({ type: 'int', default: 1 })
  days!: number;

  @Column({
    type: 'enum',
    enum: DriveType,
    default: DriveType.SELF_DRIVE,
  })
  driveType!: DriveType;

  // Self-drive only.
  @Column({ type: 'int', nullable: true })
  yearsDriving!: number | null;

  @Column({ type: 'text', default: '' })
  purpose!: string;

  @Column({
    type: 'enum',
    enum: HandoverMethod,
    default: HandoverMethod.PICKUP,
  })
  handover!: HandoverMethod;

  // Pickup point or delivery address, set by the admin when confirming.
  @Column({ type: 'varchar', length: 255, nullable: true })
  location!: string | null;

  // --- Price & payment -----------------------------------------------------

  // Website estimate; null when the rate is "on request" (e.g. vans).
  @Column('decimal', { nullable: true })
  estimatedTotal!: number | null;

  // The estimate as the customer saw it, e.g. "₱3,600 (incl. ₱1,000/day driver)".
  @Column({ type: 'varchar', length: 120, default: '' })
  estimateText!: string;

  // Final agreed price, confirmed by the admin. Starts as the estimate.
  @Column('decimal', { nullable: true })
  totalPrice!: number | null;

  @Column({ type: 'enum', enum: PaymentMethod, nullable: true })
  paymentMethod!: PaymentMethod | null;

  @Column({
    type: 'enum',
    enum: PaymentStatus,
    default: PaymentStatus.UNPAID,
  })
  paymentStatus!: PaymentStatus;

  // Internal admin notes.
  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @Column({
    type: 'enum',
    enum: BookingStatus,
    default: BookingStatus.PENDING,
  })
  status!: BookingStatus;

  // When the "booking confirmed" email last reached the customer (null = not sent).
  @Column({ type: 'timestamp', nullable: true })
  confirmationEmailSentAt!: Date | null;

  // When the "booking confirmed" text (SMS) last reached the customer.
  @Column({ type: 'timestamp', nullable: true })
  confirmationSmsSentAt!: Date | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
