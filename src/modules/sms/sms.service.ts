import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { business } from '../mail/business';

const SEMAPHORE_URL = 'https://api.semaphore.co/api/v4/messages';

// What happened when we tried to text the customer, shown to the admin.
export type SmsResult =
  | { sent: true; to: string }
  | {
      sent: false;
      reason: 'no-phone' | 'not-configured' | 'failed';
      message: string;
    };

// The booking fields the text uses.
export interface SmsBooking {
  reference: string;
  customerPhone: string;
  carLabel: string;
  vehicle: { brand: string; model: string } | null;
  startDate: string;
  endDate: string;
  pickupTime: string | null;
  days: number;
}

/**
 * "0917 123 4567", "+63 917 123 4567", "9171234567" -> "09171234567".
 * Returns null for anything that isn't a PH mobile number. (Same as the website.)
 */
export function toPhMobile(value: string) {
  const digits = value.replace(/\D/g, '');
  const local = digits.startsWith('63')
    ? `0${digits.slice(2)}`
    : digits.startsWith('9')
      ? `0${digits}`
      : digits;
  return /^09\d{9}$/.test(local) ? local : null;
}

// "2026-10-25" -> "Oct 25, 2026".
const day = (date: string) => {
  const d = new Date(`${date.slice(0, 10)}T00:00:00Z`);
  return Number.isNaN(d.getTime())
    ? date
    : d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        timeZone: 'UTC',
      });
};

// "14:30" -> "2:30 PM".
const time = (value: string | null) => {
  const m = value && /^(\d{1,2}):(\d{2})/.exec(value);
  if (!m) return '';
  const h = Number(m[1]);
  return `${h % 12 || 12}:${m[2]} ${h < 12 ? 'AM' : 'PM'}`;
};

/** The confirmation text. Plain characters only, so it stays a normal (cheaper) SMS. */
export function buildBookingConfirmedSms(b: SmsBooking) {
  const car = b.vehicle ? `${b.vehicle.brand} ${b.vehicle.model}` : b.carLabel;
  const at = time(b.pickupTime);
  // Kept under 160 characters for usual car names, so it's billed as one SMS.
  return [
    `AllDrive: Booking CONFIRMED ${b.reference}. Car available: ${car}.`,
    `Pickup ${day(b.startDate)}${at ? ` ${at}` : ''} (${b.days} day${b.days > 1 ? 's' : ''}), return ${day(b.endDate)}.`,
    `Call ${business.phones[0].display}`,
  ]
    .join(' ')
    .replace(/₱\s*/g, 'PHP ');
}

// Texts customers through Semaphore (https://semaphore.co), a Philippine SMS gateway. Needs
// SEMAPHORE_API_KEY (optional SEMAPHORE_SENDER_NAME); without it nothing is sent.
@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);
  private readonly apiKey: string | undefined;
  private readonly senderName: string | undefined;

  constructor(config: ConfigService) {
    this.apiKey = config.get<string>('SEMAPHORE_API_KEY') || undefined;
    this.senderName = config.get<string>('SEMAPHORE_SENDER_NAME') || undefined;
    if (!this.apiKey) {
      this.logger.warn('Customer texts are off: set SEMAPHORE_API_KEY');
    }
  }

  // "Booking confirmed, your car is available", to the customer's mobile number.
  async sendBookingConfirmed(booking: SmsBooking): Promise<SmsResult> {
    const to = toPhMobile(booking.customerPhone);
    if (!to) {
      return {
        sent: false,
        reason: 'no-phone',
        message: `${booking.customerPhone} isn't a PH mobile number, so it can't get a text.`,
      };
    }
    if (!this.apiKey) {
      return {
        sent: false,
        reason: 'not-configured',
        message: 'Texting is not set up on the server (SEMAPHORE_API_KEY).',
      };
    }
    const body = new URLSearchParams({
      apikey: this.apiKey,
      number: to,
      message: buildBookingConfirmedSms(booking),
    });
    if (this.senderName) body.set('sendername', this.senderName);
    try {
      const res = await fetch(SEMAPHORE_URL, {
        method: 'POST',
        body,
        signal: AbortSignal.timeout(10_000),
      });
      const result: unknown = await res.json().catch(() => null);
      // Success is a list of queued messages; errors come back as an object or string.
      if (!res.ok || !Array.isArray(result)) {
        throw new Error(`Semaphore ${res.status}: ${JSON.stringify(result)}`);
      }
      return { sent: true, to };
    } catch (err) {
      this.logger.error(
        `Confirmation text for ${booking.reference} failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      return {
        sent: false,
        reason: 'failed',
        message: "Couldn't send the text. Check the number, or try again.",
      };
    }
  }
}
