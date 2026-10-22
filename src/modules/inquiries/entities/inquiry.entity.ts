import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

// Where the admin is with an inquiry.
export enum InquiryStatus {
  NEW = 'New',
  CONTACTED = 'Contacted',
  CLOSED = 'Closed',
}

// A question or message sent from the public website's contact form.
@Entity('inquiries')
export class Inquiry {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', length: 100 })
  name!: string;

  @Column({ type: 'varchar', length: 30 })
  contact!: string;

  @Column({ type: 'varchar', length: 120, nullable: true })
  email!: string | null;

  // What it's about, e.g. "Rates & availability".
  @Column({ type: 'varchar', length: 60 })
  topic!: string;

  @Column({ type: 'text' })
  message!: string;

  // The website page it was sent from, e.g. "/contact".
  @Column({ type: 'varchar', length: 120, nullable: true })
  page!: string | null;

  @Column({ type: 'enum', enum: InquiryStatus, default: InquiryStatus.NEW })
  status!: InquiryStatus;

  // Internal admin notes (what was replied, follow-ups).
  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
