import { Body, Controller, Delete, Get, Param, Patch } from '@nestjs/common';

import { InquiriesService } from './inquiries.service';
import { UpdateInquiryDto } from './dto/update-inquiry.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';

// Admin inbox for website inquiries. New ones arrive through
// WebsiteController (POST /website/inquiries).
@Roles(UserRole.ADMIN)
@Controller('inquiries')
export class InquiriesController {
  constructor(private readonly inquiriesService: InquiriesService) {}

  @Get()
  findAll() {
    return this.inquiriesService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: number) {
    return this.inquiriesService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: number, @Body() dto: UpdateInquiryDto) {
    return this.inquiriesService.update(+id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: number) {
    return this.inquiriesService.remove(+id);
  }
}
