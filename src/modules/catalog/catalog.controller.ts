import { Body, Controller, Delete, Get, Param, Put } from '@nestjs/common';

import { CatalogService } from './catalog.service';
import {
  UpdateClassDto,
  UpdateModelDto,
  UpdateSettingsDto,
} from './dto/catalog.dto';
import { Public } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';

// The website fleet as edited in the admin dashboard.
@Controller('catalog')
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  // Public: the website reads this to show cars, prices and photos. It holds
  // only display data, nothing private.
  @Public()
  @Get()
  get() {
    return this.catalog.get();
  }

  @Roles(UserRole.ADMIN)
  @Put('classes/:id')
  setClassRates(@Param('id') id: string, @Body() dto: UpdateClassDto) {
    return this.catalog.setClassRates(id, dto.rates);
  }

  // Back to the website's built-in rates for this class.
  @Roles(UserRole.ADMIN)
  @Delete('classes/:id')
  resetClass(@Param('id') id: string) {
    return this.catalog.resetClass(id);
  }

  @Roles(UserRole.ADMIN)
  @Put('models/:id')
  updateModel(@Param('id') id: string, @Body() dto: UpdateModelDto) {
    return this.catalog.updateModel(id, dto);
  }

  // Back to how the website shows this model by default.
  @Roles(UserRole.ADMIN)
  @Delete('models/:id')
  resetModel(@Param('id') id: string) {
    return this.catalog.resetModel(id);
  }

  @Roles(UserRole.ADMIN)
  @Put('settings')
  updateSettings(@Body() dto: UpdateSettingsDto) {
    return this.catalog.updateSettings(dto);
  }
}
