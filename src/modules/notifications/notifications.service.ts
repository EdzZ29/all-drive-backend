import { Injectable, MessageEvent } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Subject, merge, interval, Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { Notification, NotificationType } from './entities/notification.entity';

// The minimal shape of a booking this service needs to describe a notification.
// Kept as a local interface so the notifications module stays decoupled from
// the bookings module (it only imports the type, not the entity at runtime).
interface BookingLike {
  id: number;
  clientId: number;
  vehicleId: number;
  startDate: string;
  endDate: string;
  client?: { name?: string | null } | null;
  vehicle?: { brand?: string | null; model?: string | null } | null;
}

// A live notification carries the persisted row plus, for booking events, the
// full booking so the admin UI can update its list without re-fetching.
type LiveNotification = Notification & { booking?: BookingLike };

@Injectable()
export class NotificationsService {
  // Broadcasts to every open admin SSE connection. In-memory: a fresh process
  // starts with no subscribers, and past notifications are replayed from the DB
  // when the bell first loads.
  private readonly events$ = new Subject<LiveNotification>();

  constructor(
    @InjectRepository(Notification)
    private readonly repo: Repository<Notification>,
  ) {}

  // Recent notifications, newest first (capped so the bell stays light).
  findRecent(limit = 50) {
    return this.repo.find({ order: { createdAt: 'DESC' }, take: limit });
  }

  async unreadCount() {
    const count = await this.repo.count({ where: { read: false } });
    return { count };
  }

  async markRead(id: number) {
    await this.repo.update({ id }, { read: true });
    return { id, read: true };
  }

  async markAllRead() {
    await this.repo.update({ read: false }, { read: true });
    return { success: true };
  }

  // A client placed a new booking / reservation.
  notifyNewBooking(booking: BookingLike) {
    return this.emit(
      {
        type: NotificationType.BOOKING,
        title: 'New booking request',
        message: `${clientName(booking)} requested ${vehicleName(booking)} · ${booking.startDate} → ${booking.endDate}`,
        bookingId: booking.id,
      },
      booking,
    );
  }

  // A client cancelled their booking.
  notifyBookingCancelled(booking: BookingLike) {
    return this.emit(
      {
        type: NotificationType.BOOKING_CANCELLED,
        title: 'Booking cancelled',
        message: `${clientName(booking)} cancelled their booking for ${vehicleName(booking)}`,
        bookingId: booking.id,
      },
      booking,
    );
  }

  // SSE stream: live notifications plus a periodic heartbeat so proxies and
  // load balancers keep the connection open.
  stream(): Observable<MessageEvent> {
    const notifications$ = this.events$.pipe(
      map((n): MessageEvent => ({ type: 'notification', data: n })),
    );
    const heartbeat$ = interval(25_000).pipe(
      map((): MessageEvent => ({ type: 'ping', data: 'keepalive' })),
    );
    return merge(notifications$, heartbeat$);
  }

  // Persist a notification and push it to connected admins. The persisted row
  // never stores the booking object — that's attached only to the live payload.
  private async emit(
    partial: Pick<Notification, 'type' | 'title' | 'message'> & {
      bookingId?: number | null;
    },
    booking?: BookingLike,
  ) {
    const notification = this.repo.create({
      type: partial.type,
      title: partial.title,
      message: partial.message,
      bookingId: partial.bookingId ?? null,
    });
    const saved = await this.repo.save(notification);
    this.events$.next({ ...saved, ...(booking ? { booking } : {}) });
    return saved;
  }
}

function clientName(booking: BookingLike) {
  return booking.client?.name ?? `Client #${booking.clientId}`;
}

function vehicleName(booking: BookingLike) {
  return booking.vehicle
    ? `${booking.vehicle.brand ?? ''} ${booking.vehicle.model ?? ''}`.trim()
    : `Vehicle #${booking.vehicleId}`;
}
