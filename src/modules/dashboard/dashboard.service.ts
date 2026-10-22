import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';

import { Booking, BookingStatus } from '../bookings/entities/booking.entity';
import { Inquiry, InquiryStatus } from '../inquiries/entities/inquiry.entity';
import { Notification } from '../notifications/entities/notification.entity';
import { Vehicle, VehicleStatus } from '../vehicles/entities/vehicles.entity';
import { ChatConversation } from '../chat/entities/chat-conversation.entity';

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(Booking) private readonly bookings: Repository<Booking>,
    @InjectRepository(Inquiry) private readonly inquiries: Repository<Inquiry>,
    @InjectRepository(Notification)
    private readonly notifications: Repository<Notification>,
    @InjectRepository(Vehicle) private readonly vehicles: Repository<Vehicle>,
    @InjectRepository(ChatConversation)
    private readonly chats: Repository<ChatConversation>,
  ) {}

  // Counts for the admin sidebar badges and the overview page.
  async summary() {
    const [
      pendingBookings,
      activeBookings,
      newInquiries,
      unreadNotifications,
      vehicleRows,
      revenue,
      unreadChats,
    ] = await Promise.all([
      this.bookings.count({ where: { status: BookingStatus.PENDING } }),
      this.bookings.count({
        where: {
          status: In([BookingStatus.APPROVED, BookingStatus.RETURNED]),
        },
      }),
      this.inquiries.count({ where: { status: InquiryStatus.NEW } }),
      this.notifications.count({ where: { read: false } }),
      this.vehicles
        .createQueryBuilder('v')
        .select('v.status', 'status')
        .addSelect('COUNT(*)::int', 'count')
        .groupBy('v.status')
        .getRawMany<{ status: VehicleStatus; count: number }>(),
      this.bookings
        .createQueryBuilder('b')
        .select('COALESCE(SUM(b.totalPrice), 0)', 'total')
        .where('b.status = :status', { status: BookingStatus.COMPLETED })
        .getRawOne<{ total: string }>(),
      // Chats with visitor messages no admin has opened yet.
      this.chats.createQueryBuilder('c').where('c.adminUnread > 0').getCount(),
    ]);

    const units = Object.fromEntries(
      Object.values(VehicleStatus).map((s) => [s, 0]),
    ) as Record<VehicleStatus, number>;
    for (const row of vehicleRows) units[row.status] = Number(row.count);

    return {
      pendingBookings,
      activeBookings,
      newInquiries,
      unreadNotifications,
      unreadChats,
      units,
      completedRevenue: Number(revenue?.total ?? 0),
    };
  }
}
