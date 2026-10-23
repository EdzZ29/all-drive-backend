import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
} from 'typeorm';

export enum VehicleStatus {
  AVAILABLE = 'Available',
  BOOKED = 'Booked',
  MAINTENANCE = 'Maintenance',
  // Admin-hidden: kept in the fleet but not shown on the public site.
  UNLISTED = 'Unlisted',
}

@Entity('vehicles')
export class Vehicle {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  brand!: string;

  @Column()
  model!: string;

  @Column()
  vehicleType!: string;

  @Column()
  year!: number;

  @Column()
  color!: string;

  @Column({ unique: true })
  plateNumber!: string;

  @Column()
  transmission!: string;

  @Column()
  fuelType!: string;

  @Column()
  seats!: number;

  @Column('decimal')
  dailyRate!: number;

  @Column()
  description!: string;

  @Column({
    type: 'enum',
    enum: VehicleStatus,
    default: VehicleStatus.AVAILABLE,
  })
  status!: VehicleStatus;

  @Column({ nullable: true })
  image!: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  // Set when deleted from the dashboard (hidden everywhere; can be restored).
  @DeleteDateColumn()
  deletedAt!: Date | null;
}
