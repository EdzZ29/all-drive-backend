import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

// Kinds of admin notification. Extend this as more events need surfacing
// (payments, reviews, maintenance).
export enum NotificationType {
  // A booking request arrived from the website.
  BOOKING = 'booking',
  // A message arrived from the website's contact form.
  INQUIRY = 'inquiry',
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

  // Likewise for an inquiry notification.
  @Column({ type: 'int', nullable: true })
  inquiryId!: number | null;

  // Whether an admin has seen/dismissed this notification.
  @Column({ type: 'boolean', default: false })
  read!: boolean;

  @CreateDateColumn()
  createdAt!: Date;
}
