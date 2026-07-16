import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

import { User } from '../../users/entities/user.entity';
import { Vehicle } from '../../vehicles/entities/vehicles.entity';

export enum BookingStatus {
  PENDING = 'Pending',
  APPROVED = 'Approved',
  DECLINED = 'Declined',
  RETURNED = 'Returned',
  COMPLETED = 'Completed',
  CANCELLED = 'Cancelled',
}

// How the client wants to drive the vehicle.
export enum DriveType {
  SELF_DRIVE = 'Self Drive',
  WITH_DRIVER = 'With Driver',
}

// How the vehicle changes hands: the client picks it up, or we deliver/drop it.
export enum HandoverMethod {
  PICKUP = 'Pickup',
  DELIVERY = 'Delivery',
}

// Accepted down-payment / payment methods.
export enum PaymentMethod {
  GCASH = 'GCash',
  MAYA = 'Maya',
  BANK_TRANSFER = 'Bank Transfer',
  CASH = 'Cash',
}

// How much of the total has actually been paid (set by admin after validating).
export enum PaymentStatus {
  UNPAID = 'Unpaid',
  DOWNPAYMENT = 'Down Payment',
  FULLY_PAID = 'Fully Paid',
}

@Entity('bookings')
export class Booking {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => User, { eager: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'clientId' })
  client!: User;

  @Column()
  clientId!: number;

  @ManyToOne(() => Vehicle, { eager: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'vehicleId' })
  vehicle!: Vehicle;

  @Column()
  vehicleId!: number;

  @Column({ type: 'date' })
  startDate!: string;

  @Column({ type: 'date' })
  endDate!: string;

  @Column('decimal')
  totalPrice!: number;

  @Column({
    type: 'enum',
    enum: DriveType,
    default: DriveType.SELF_DRIVE,
  })
  driveType!: DriveType;

  @Column({
    type: 'enum',
    enum: HandoverMethod,
    default: HandoverMethod.PICKUP,
  })
  handover!: HandoverMethod;

  // Pickup point (for Pickup) or delivery address (for Delivery).
  @Column({ type: 'varchar', length: 255, nullable: true })
  location!: string | null;

  // Preferred handover time, e.g. '10:00'. Stored as free text for flexibility.
  @Column({ type: 'varchar', length: 20, nullable: true })
  pickupTime!: string | null;

  @Column({ type: 'varchar', length: 30, nullable: true })
  contactPhone!: string | null;

  // --- Requirements / documents -----------------------------------------

  // The type of valid ID submitted (Student ID is not accepted).
  @Column({ type: 'varchar', length: 60, nullable: true })
  idType!: string | null;

  // Uploaded file URL for the valid ID.
  @Column({ type: 'varchar', length: 255, nullable: true })
  idImage!: string | null;

  // Driver's license number (Self Drive) — validated format on input.
  @Column({ type: 'varchar', length: 40, nullable: true })
  licenseNumber!: string | null;

  // Uploaded file URL for the driver's license (Self Drive).
  @Column({ type: 'varchar', length: 255, nullable: true })
  licenseImage!: string | null;

  // --- Payment -----------------------------------------------------------

  @Column({ type: 'enum', enum: PaymentMethod, nullable: true })
  paymentMethod!: PaymentMethod | null;

  // 50% reservation down-payment amount.
  @Column('decimal', { nullable: true })
  downpaymentAmount!: number | null;

  // Uploaded proof/receipt of the down-payment.
  @Column({ type: 'varchar', length: 255, nullable: true })
  downpaymentProof!: string | null;

  // Payment progress — admin sets this after validating the receipt.
  @Column({
    type: 'enum',
    enum: PaymentStatus,
    default: PaymentStatus.UNPAID,
  })
  paymentStatus!: PaymentStatus;

  // Admin confirms the submitted documents/payment are valid. Required before
  // a booking can be approved.
  @Column({ type: 'boolean', default: false })
  documentsVerified!: boolean;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @Column({
    type: 'enum',
    enum: BookingStatus,
    default: BookingStatus.PENDING,
  })
  status!: BookingStatus;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
