import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Inquiry, InquiryStatus } from './entities/inquiry.entity';
import { CreateInquiryDto } from './dto/create-inquiry.dto';
import { UpdateInquiryDto } from './dto/update-inquiry.dto';
import { NotificationsService } from '../notifications/notifications.service';
import { PushService } from '../push/push.service';

@Injectable()
export class InquiriesService {
  constructor(
    @InjectRepository(Inquiry)
    private readonly repo: Repository<Inquiry>,
    private readonly notifications: NotificationsService,
    private readonly push: PushService,
  ) {}

  // A message from the website's contact form.
  async createFromWebsite(dto: CreateInquiryDto) {
    const saved = await this.repo.save(
      this.repo.create({
        name: dto.name,
        contact: dto.contact,
        email: dto.email || null,
        topic: dto.topic,
        message: dto.message,
        page: dto.page || null,
        status: InquiryStatus.NEW,
      }),
    );

    // Fire-and-forget, like bookings: never lose the inquiry over an alert.
    this.notifications.notifyNewInquiry(saved).catch(() => undefined);
    void this.push.notifyAdminsOfInquiry(saved);

    return { id: saved.id };
  }

  findAll() {
    return this.repo.find({ order: { createdAt: 'DESC' } });
  }

  async findOne(id: number) {
    const inquiry = await this.repo.findOne({ where: { id } });
    if (!inquiry) throw new NotFoundException('Inquiry not found');
    return inquiry;
  }

  async update(id: number, dto: UpdateInquiryDto) {
    const inquiry = await this.findOne(id);
    Object.assign(inquiry, {
      status: dto.status ?? inquiry.status,
      notes: dto.notes ?? inquiry.notes,
    });
    return this.repo.save(inquiry);
  }

  // For spam.
  async remove(id: number) {
    const inquiry = await this.findOne(id);
    await this.repo.remove(inquiry);
    return { message: 'Inquiry deleted' };
  }
}
