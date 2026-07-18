import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

// Kinds of admin notification. Extend this as more events need surfacing
// (payments, reviews, maintenance, and — once it exists — inquiries).
export enum NotificationType {
  BOOKING = 'booking',
  BOOKING_CANCELLED = 'booking_cancelled',
}

@Entity('notifications')
export class Notification {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({
    type: 'enum',
    enum: NotificationType,
    default: NotificationType.BOOKING,
  })
  type!: NotificationType;

  @Column({ type: 'varchar', length: 160 })
  title!: string;

  @Column({ type: 'varchar', length: 500 })
  message!: string;

  // The booking this notification refers to (if any), so the admin UI can link
  // straight to it.
  @Column({ type: 'int', nullable: true })
  bookingId!: number | null;

  // Whether an admin has seen/dismissed this notification.
  @Column({ type: 'boolean', default: false })
  read!: boolean;

  @CreateDateColumn()
  createdAt!: Date;
}
