import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
} from 'typeorm';

// Only staff have accounts. Customers book and send inquiries through the
// public website without signing up, so there is no client role.
export enum UserRole {
  ADMIN = 'admin',
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  name!: string;

  @Column({ unique: true })
  email!: string;

  // Never returned by default queries; must be explicitly selected for auth.
  @Column({ select: false })
  password!: string;

  @Column({ nullable: true })
  phone!: string;

  @Column({
    type: 'enum',
    enum: UserRole,
    default: UserRole.ADMIN,
  })
  role!: UserRole;

  @Column({ default: true })
  isActive!: boolean;

  // Incremented on logout / password change to invalidate previously issued tokens.
  @Column({ default: 0 })
  tokenVersion!: number;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  // Set when an admin account is deleted (can be restored). Deleted admins cannot sign in.
  @DeleteDateColumn()
  deletedAt!: Date | null;
}
