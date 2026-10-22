import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

import type { Rates } from '../catalog.constants';

// Admin-set daily rates for a website car class (sedan, mpv, suv, van). No row
// means the website's built-in rates apply.
@Entity('car_classes')
export class CarClass {
  @PrimaryColumn({ type: 'varchar', length: 20 })
  id!: string;

  @Column({ type: 'jsonb' })
  rates!: Rates;

  @UpdateDateColumn()
  updatedAt!: Date;
}
