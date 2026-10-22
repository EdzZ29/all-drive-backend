import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

import {
  Availability,
  type CatalogPhoto,
  type Rates,
} from '../catalog.constants';

// Admin changes to a website car model (e.g. "toyota-vios"). No row means the
// website shows the model exactly as built in.
@Entity('car_models')
export class CarModel {
  @PrimaryColumn({ type: 'varchar', length: 60 })
  id!: string;

  @Column({
    type: 'enum',
    enum: Availability,
    default: Availability.AVAILABLE,
  })
  availability!: Availability;

  // Own daily rates; null = the website's built-in rates for this model.
  @Column({ type: 'jsonb', nullable: true })
  rates!: Rates | null;

  // Extra photos, shown after the built-in ones.
  @Column({ type: 'jsonb', default: () => "'[]'" })
  photos!: CatalogPhoto[];

  @UpdateDateColumn()
  updatedAt!: Date;
}
