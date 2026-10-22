import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CatalogController } from './catalog.controller';
import { CatalogService } from './catalog.service';
import { CarClass } from './entities/car-class.entity';
import { CarModel } from './entities/car-model.entity';
import { CatalogSettings } from './entities/catalog-settings.entity';

@Module({
  imports: [TypeOrmModule.forFeature([CarClass, CarModel, CatalogSettings])],
  controllers: [CatalogController],
  providers: [CatalogService],
})
export class CatalogModule {}
