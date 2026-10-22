import {
  Injectable,
  Logger,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as webpush from 'web-push';

import { PushSubscription } from './entities/push-subscription.entity';
import { SubscribeDto } from './dto/push-subscription.dto';
import { UserRole } from '../users/entities/user.entity';

// What the service worker (alldrive-website/public/sw.js) receives.
export interface PushPayload {
  title: string;
  body: string;
  // Path in the admin dashboard to open on click, e.g. "/admin/bookings?id=3".
  url: string;
  // Notifications with the same tag replace each other instead of stacking.
  tag: string;
}

// The minimal shapes needed to describe a notification. Local interfaces keep
// this module independent of the bookings/inquiries modules.
interface BookingLike {
  id: number;
  reference: string;
  customerName: string;
  driveType: string;
  startDate: string;
  pickupTime: string | null;
}

interface InquiryLike {
  id: number;
  name: string;
  topic: string;
  message: string;
}

// Push services drop undelivered messages after this long (seconds).
const TTL_SECONDS = 24 * 60 * 60;

@Injectable()
export class PushService implements OnModuleInit {
  private readonly logger = new Logger(PushService.name);
  private publicKey: string | null = null;

  constructor(
    @InjectRepository(PushSubscription)
    private readonly repo: Repository<PushSubscription>,
    private readonly config: ConfigService,
  ) {}

  onModuleInit() {
    const publicKey = this.config.get<string>('VAPID_PUBLIC_KEY');
    const privateKey = this.config.get<string>('VAPID_PRIVATE_KEY');
    const subject = this.config.get<string>('VAPID_SUBJECT');
    if (!publicKey || !privateKey || !subject) {
      this.logger.warn(
        'Web push is off: set VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY and VAPID_SUBJECT',
      );
      return;
    }
    try {
      // Throws on a malformed key or a subject that isn't mailto:/https:.
      webpush.setVapidDetails(subject, publicKey, privateKey);
      this.publicKey = publicKey;
    } catch (err) {
      this.logger.error(
        `Web push is off: invalid VAPID settings (${errorText(err)})`,
      );
    }
  }

  getPublicKey() {
    if (!this.publicKey) {
      throw new ServiceUnavailableException(
        'Push notifications are not configured',
      );
    }
    return { publicKey: this.publicKey };
  }

  // Saves this browser for the admin, or updates it if it already exists
  // (same endpoint: new keys, or another admin signed in on that browser).
  async subscribe(userId: number, dto: SubscribeDto, userAgent?: string) {
    this.getPublicKey(); // 503 early if push isn't configured
    const existing = await this.repo.findOne({
      where: { endpoint: dto.endpoint },
    });
    const sub = existing ?? this.repo.create({ endpoint: dto.endpoint });
    Object.assign(sub, {
      userId,
      p256dh: dto.keys.p256dh,
      auth: dto.keys.auth,
      userAgent: userAgent?.slice(0, 500) || null,
    });
    await this.repo.save(sub);
    return { subscribed: true };
  }

  // Removes this browser. Only the admin who owns it can remove it; an
  // unknown endpoint is not an error (already gone).
  async unsubscribe(userId: number, endpoint: string) {
    await this.repo.delete({ endpoint, userId });
    return { subscribed: false };
  }

  // A booking request arrived from the website.
  notifyAdmins(booking: BookingLike) {
    const when = formatPickup(booking.startDate, booking.pickupTime);
    return this.sendToAdmins({
      title: 'New Booking Inquiry',
      body: `${booking.customerName} · ${when} · ${booking.driveType}`,
      url: `/admin/bookings?id=${booking.id}`,
      tag: `booking-${booking.id}`,
    });
  }

  // A message arrived from the website's contact form.
  notifyAdminsOfInquiry(inquiry: InquiryLike) {
    const message =
      inquiry.message.length > 120
        ? `${inquiry.message.slice(0, 119)}…`
        : inquiry.message;
    return this.sendToAdmins({
      title: 'New Inquiry',
      body: `${inquiry.name} · ${inquiry.topic}: ${message}`,
      url: `/admin/inquiries?id=${inquiry.id}`,
      tag: `inquiry-${inquiry.id}`,
    });
  }

  // Sends to every subscribed browser of every active admin. Never throws:
  // callers fire it without awaiting, and a failed push must not affect them.
  private async sendToAdmins(payload: PushPayload) {
    if (!this.publicKey) return;
    try {
      const subs = await this.repo
        .createQueryBuilder('s')
        .innerJoin('s.user', 'u')
        .where('u.isActive = true AND u.role = :role', { role: UserRole.ADMIN })
        .getMany();
      if (subs.length === 0) return;

      const body = JSON.stringify(payload);
      const results = await Promise.allSettled(
        subs.map((s) =>
          webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            body,
            { TTL: TTL_SECONDS, urgency: 'high', timeout: 10_000 },
          ),
        ),
      );

      const expired: number[] = [];
      results.forEach((result, i) => {
        if (result.status === 'fulfilled') return;
        const status = statusOf(result.reason);
        if (status === 404 || status === 410) {
          // The browser unsubscribed or the subscription expired.
          expired.push(subs[i].id);
        } else {
          this.logger.warn(
            `Push to subscription ${subs[i].id} failed${status ? ` (HTTP ${status})` : ''}: ${errorText(result.reason)}`,
          );
        }
      });
      if (expired.length) {
        await this.repo.delete(expired);
        this.logger.log(
          `Removed ${expired.length} expired push subscription(s)`,
        );
      }
    } catch (err) {
      this.logger.error(`Sending push notifications failed: ${errorText(err)}`);
    }
  }
}

// "2026-10-25" + "09:30" -> "Oct 25, 2026, 9:30 AM" (no time zone shifts).
function formatPickup(date: string, time: string | null) {
  const hasTime = !!time && /^\d{2}:\d{2}$/.test(time);
  const d = new Date(`${date}T${hasTime ? time : '00:00'}:00Z`);
  if (Number.isNaN(d.getTime())) return date;
  return d.toLocaleString('en-PH', {
    timeZone: 'UTC',
    dateStyle: 'medium',
    ...(hasTime ? { timeStyle: 'short' as const } : {}),
  });
}

// web-push rejects with a WebPushError that carries the push service's status.
function statusOf(err: unknown) {
  return err instanceof webpush.WebPushError ? err.statusCode : undefined;
}

function errorText(err: unknown) {
  if (err instanceof webpush.WebPushError) return err.body || err.message;
  if (err instanceof Error) {
    // Network failures (e.g. an AggregateError for ECONNREFUSED) can have an
    // empty message but carry a code.
    const code = (err as Error & { code?: string }).code;
    return err.message || code || err.name;
  }
  return String(err);
}
