import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

export enum AuditActorType {
  // A signed-in admin, from the dashboard.
  ADMIN = 'admin',
  // A customer on the public website (booking form, contact form, chat).
  WEBSITE = 'website',
  // Something the server did by itself.
  SYSTEM = 'system',
}

// What an entry is about. Kept as text so new kinds don't need a migration.
export type AuditEntityType =
  'booking' | 'inquiry' | 'chat' | 'vehicle' | 'admin' | 'catalog' | 'account';

// One line of the activity log: who did what, to what, and when. Names and
// labels are copied in, so the entry still reads right after a rename or delete.
@Entity('audit_logs')
@Index(['entityType', 'entityId'])
export class AuditLog {
  @PrimaryGeneratedColumn()
  id!: number;

  @Index()
  @CreateDateColumn()
  createdAt!: Date;

  @Column({ type: 'enum', enum: AuditActorType })
  actorType!: AuditActorType;

  // The admin's user id (admins only).
  @Column({ type: 'int', nullable: true })
  actorId!: number | null;

  @Column({ type: 'varchar', length: 120 })
  actorName!: string;

  // e.g. "booking.status", "booking.deleted", "admin.created".
  @Column({ type: 'varchar', length: 60 })
  action!: string;

  @Column({ type: 'varchar', length: 30 })
  entityType!: AuditEntityType;

  @Column({ type: 'int', nullable: true })
  entityId!: number | null;

  // e.g. the booking reference or the admin's name.
  @Column({ type: 'varchar', length: 160, default: '' })
  entityLabel!: string;

  // Plain-language description shown in the log.
  @Column({ type: 'varchar', length: 500 })
  summary!: string;

  // Extra detail, e.g. { changes: { price: [1300, 1500] } }.
  @Column({ type: 'jsonb', nullable: true })
  details!: Record<string, unknown> | null;
}
