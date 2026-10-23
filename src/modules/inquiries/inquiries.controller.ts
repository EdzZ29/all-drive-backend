import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';

import { InquiriesService } from './inquiries.service';
import { UpdateInquiryDto } from './dto/update-inquiry.dto';
import { InquiriesQueryDto } from './dto/inquiries-query.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';

// Admin inbox for website inquiries. New ones arrive through
// WebsiteController (POST /website/inquiries).
@Roles(UserRole.ADMIN)
@Controller('inquiries')
export class InquiriesController {
  constructor(private readonly inquiriesService: InquiriesService) {}

  // ?filter=Open|New|Contacted|Closed|All&page=&limit=&q=
  @Get()
  list(@Query() query: InquiriesQueryDto) {
    return this.inquiriesService.list(query);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.inquiriesService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateInquiryDto) {
    return this.inquiriesService.update(id, dto);
  }

  // Hidden everywhere, but kept: POST :id/restore brings it back.
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.inquiriesService.remove(id);
  }

  @HttpCode(HttpStatus.OK)
  @Post(':id/restore')
  restore(@Param('id', ParseIntPipe) id: number) {
    return this.inquiriesService.restore(id);
  }
}
