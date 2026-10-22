import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

// Catalog-wide settings. A single row with id 1.
@Entity('catalog_settings')
export class CatalogSettings {
  @PrimaryColumn({ type: 'int' })
  id!: number;

  // Professional driver fee per day in PHP; null = the website's built-in fee.
  @Column({ type: 'int', nullable: true })
  driverRate!: number | null;

  @UpdateDateColumn()
  updatedAt!: Date;
}
