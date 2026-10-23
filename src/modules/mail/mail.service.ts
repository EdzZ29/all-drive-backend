import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer, { type Transporter } from 'nodemailer';

import { business } from './business';
import {
  buildBookingConfirmedEmail,
  type ConfirmedBooking,
} from './booking-confirmed-email';

// What happened when we tried to email the customer, shown to the admin.
export type EmailResult =
  | { sent: true; to: string }
  | {
      sent: false;
      reason: 'no-email' | 'not-configured' | 'failed';
      message: string;
    };

// Give up quickly when the mail server can't be reached (some hosts block email ports), so
// approving a booking never hangs. The website then sends the email instead.
const TIMEOUTS = {
  connectionTimeout: 8_000,
  greetingTimeout: 8_000,
  socketTimeout: 15_000,
};

// Sends emails to customers from the AllDrive Gmail account. Needs GMAIL_USER and
// GMAIL_APP_PASSWORD (a Google "App password"); without them nothing is sent.
// Another email provider can be used instead with SMTP_HOST (+ SMTP_PORT, SMTP_SECURE).
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: Transporter | null;
  private readonly from: string | null;
  private readonly replyTo: string;

  constructor(config: ConfigService) {
    const user = config.get<string>('GMAIL_USER');
    const pass = config.get<string>('GMAIL_APP_PASSWORD');
    const smtpHost = config.get<string>('SMTP_HOST');
    this.replyTo = config.get<string>('BOOKING_EMAIL_TO') || business.email;
    if (smtpHost) {
      this.transporter = nodemailer.createTransport({
        host: smtpHost,
        port: Number(config.get<string>('SMTP_PORT') ?? 587),
        secure: config.get<string>('SMTP_SECURE') === 'true',
        ...TIMEOUTS,
        ...(user && pass ? { auth: { user, pass } } : {}),
      });
      this.from = `"${business.name}" <${user || business.email}>`;
    } else if (user && pass) {
      this.transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: { user, pass },
        ...TIMEOUTS,
      });
      this.from = `"${business.name}" <${user}>`;
    } else {
      this.transporter = null;
      this.from = null;
      this.logger.warn(
        'Customer emails are off: set GMAIL_USER and GMAIL_APP_PASSWORD',
      );
    }
  }

  // The finished confirmation email (recipient, subject, body), so the website can send it
  // with its own Gmail when this server can't. null when the customer left no email.
  composeBookingConfirmed(
    booking: ConfirmedBooking & { customerEmail: string | null },
  ) {
    const to = booking.customerEmail?.trim();
    if (!to) return null;
    return {
      to,
      replyTo: this.replyTo,
      ...buildBookingConfirmedEmail(booking),
    };
  }

  // "Your booking is approved", to the customer's email (if they gave one).
  async sendBookingConfirmed(
    booking: ConfirmedBooking & { customerEmail: string | null },
  ): Promise<EmailResult> {
    const to = booking.customerEmail?.trim();
    if (!to) {
      return {
        sent: false,
        reason: 'no-email',
        message: 'The customer did not leave an email. Call or text them.',
      };
    }
    if (!this.transporter || !this.from) {
      return {
        sent: false,
        reason: 'not-configured',
        message:
          'Email is not set up on the server (GMAIL_USER / GMAIL_APP_PASSWORD).',
      };
    }
    try {
      await this.transporter.sendMail({
        from: this.from,
        to,
        // Customer replies go to the team inbox.
        replyTo: this.replyTo,
        ...buildBookingConfirmedEmail(booking),
      });
      return { sent: true, to };
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `Confirmation email for ${booking.reference} failed: ${detail}`,
      );
      return {
        sent: false,
        reason: 'failed',
        message: "Couldn't send the email. Check the address, or try again.",
      };
    }
  }
}
