import { Injectable, MessageEvent } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Subject, merge, interval, Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { Notification, NotificationType } from './entities/notification.entity';

// The minimal shapes this service needs to describe a notification. Kept as
// local interfaces so the notifications module stays decoupled from the
// bookings/inquiries modules (no runtime imports of their entities).
interface BookingLike {
  id: number;
  reference: string;
  customerName: string;
  carLabel: string;
  startDate: string;
  pickupTime: string | null;
  days: number;
}

interface InquiryLike {
  id: number;
  name: string;
  topic: string;
  message: string;
}

interface ChatLike {
  id: number;
  name: string;
}

// A live notification carries the persisted row plus the full booking or
// inquiry, so the admin UI can update its lists without re-fetching.
type LiveNotification = Notification & {
  booking?: BookingLike;
  inquiry?: InquiryLike;
};

// New chat messages (from a visitor, an automatic reply or another admin),
// streamed live so open inboxes and threads update without reloading. Not
// stored as notifications: the conversation itself keeps the unread count.
export interface ChatEvent {
  conversation: object & { id: number };
  messages: (object & { sender: string })[];
}

@Injectable()
export class NotificationsService {
  // Broadcasts to every open admin SSE connection. In-memory: a fresh process
  // starts with no subscribers, and past notifications are replayed from the DB
  // when the bell first loads.
  private readonly events$ = new Subject<LiveNotification>();
  private readonly chat$ = new Subject<ChatEvent>();

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

  // A booking request arrived from the website.
  notifyNewBooking(booking: BookingLike) {
    const when = [booking.startDate, booking.pickupTime].filter(Boolean);
    return this.emit(
      {
        type: NotificationType.BOOKING,
        title: `New booking ${booking.reference}`,
        message: truncate(
          `${booking.customerName} · ${booking.carLabel} · ${when.join(' ')} · ${booking.days} day${booking.days > 1 ? 's' : ''}`,
        ),
        bookingId: booking.id,
      },
      { booking },
    );
  }

  // A message arrived from the website's contact form.
  notifyNewInquiry(inquiry: InquiryLike) {
    return this.emit(
      {
        type: NotificationType.INQUIRY,
        title: `New inquiry: ${inquiry.topic}`.slice(0, 160),
        message: truncate(`${inquiry.name}: ${inquiry.message}`),
        inquiryId: inquiry.id,
      },
      { inquiry },
    );
  }

  // A visitor started a live chat (later messages only go out as chat events).
  notifyNewChat(chat: ChatLike, firstMessage: string) {
    return this.emit(
      {
        type: NotificationType.CHAT,
        title: `New chat: ${chat.name}`.slice(0, 160),
        message: truncate(firstMessage),
        chatId: chat.id,
      },
      {},
    );
  }

  // New messages in a chat, to every open dashboard.
  emitChat(event: ChatEvent) {
    this.chat$.next(event);
  }

  // SSE stream: live notifications and chat messages, plus a periodic
  // heartbeat so proxies and load balancers keep the connection open.
  stream(): Observable<MessageEvent> {
    const notifications$ = this.events$.pipe(
      map((n): MessageEvent => ({ type: 'notification', data: n })),
    );
    const chat$ = this.chat$.pipe(
      map((e): MessageEvent => ({ type: 'chat', data: e })),
    );
    const heartbeat$ = interval(25_000).pipe(
      map((): MessageEvent => ({ type: 'ping', data: 'keepalive' })),
    );
    return merge(notifications$, chat$, heartbeat$);
  }

  // Persist a notification and push it to connected admins. The persisted row
  // never stores the booking/inquiry object; that's only on the live payload.
  private async emit(
    partial: Pick<Notification, 'type' | 'title' | 'message'> & {
      bookingId?: number;
      inquiryId?: number;
      chatId?: number;
    },
    live: Pick<LiveNotification, 'booking' | 'inquiry'>,
  ) {
    const notification = this.repo.create({
      type: partial.type,
      title: partial.title,
      message: partial.message,
      bookingId: partial.bookingId ?? null,
      inquiryId: partial.inquiryId ?? null,
      chatId: partial.chatId ?? null,
    });
    const saved = await this.repo.save(notification);
    this.events$.next({ ...saved, ...live });
    return saved;
  }
}

// The message column holds 500 characters.
function truncate(text: string, max = 500) {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}
