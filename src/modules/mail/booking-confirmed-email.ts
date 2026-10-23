// The "your booking is confirmed" email sent to the customer when an admin approves a booking.
// Tables and inline styles so Gmail, Outlook and phone mail apps show it the same.
import { business, requirements } from './business';

// The booking fields the email uses (kept local so this file has no app imports).
export interface ConfirmedBooking {
  reference: string;
  customerName: string;
  carLabel: string;
  vehicle: {
    brand: string;
    model: string;
    color: string;
    plateNumber: string;
  } | null;
  startDate: string;
  endDate: string;
  pickupTime: string | null;
  days: number;
  driveType: string;
  destination: string;
  specificPlace: string | null;
  handover: string;
  location: string | null;
  totalPrice: number | string | null;
  paymentStatus: string;
}

const C = {
  ink: '#070c16',
  brand: '#27abff',
  muted: '#5d6879',
  soft: '#94a0b4',
  line: '#e2e8f0',
  bg: '#f3f6fa',
  green: '#16a34a',
};

const escapeHtml = (s: string) =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

// "2026-10-25" -> "Oct 25, 2026" (no time zone shifts).
function day(date: string) {
  const d = new Date(`${date.slice(0, 10)}T00:00:00Z`);
  return Number.isNaN(d.getTime())
    ? date
    : d.toLocaleDateString('en-PH', { dateStyle: 'medium', timeZone: 'UTC' });
}

// "14:30" -> "2:30 PM".
function time(value: string | null) {
  const m = value && /^(\d{1,2}):(\d{2})/.exec(value);
  if (!m) return '';
  const h = Number(m[1]);
  return `${h % 12 || 12}:${m[2]} ${h < 12 ? 'AM' : 'PM'}`;
}

const peso = (n: number) =>
  `PHP ${n.toLocaleString('en-PH', { maximumFractionDigits: 2 })}`;

export function buildBookingConfirmedEmail(b: ConfirmedBooking) {
  const firstName = b.customerName.split(/\s+/)[0];
  const pickup = `${day(b.startDate)}${b.pickupTime ? `, ${time(b.pickupTime)}` : ''}`;
  const car = b.vehicle
    ? `${b.vehicle.brand} ${b.vehicle.model} (${b.vehicle.color}, plate ${b.vehicle.plateNumber})`
    : b.carLabel;
  const total =
    b.totalPrice == null || b.totalPrice === ''
      ? 'To be confirmed with you'
      : peso(Number(b.totalPrice));
  const destination = b.specificPlace
    ? `${b.destination} (${b.specificPlace})`
    : b.destination;
  const handover =
    b.handover === 'Delivery'
      ? `We deliver the car${b.location ? ` to ${b.location}` : ''}`
      : `Pick up at ${b.location || 'our office'}`;
  const needs = [
    ...requirements.everyone,
    ...(b.driveType === 'With Driver'
      ? requirements.withDriver
      : requirements.selfDrive),
  ];

  const rows: [string, string][] = [
    ['Booking reference', b.reference],
    ['Car', car],
    ['Service', b.driveType],
    ['Destination', destination],
    ['Handover', handover],
    ['Total', total],
    ['Payment', b.paymentStatus],
  ];

  const duration = `${b.days} day${b.days > 1 ? 's' : ''}`;
  const subject = `Your booking is approved (${b.reference}): ${car} on ${pickup}`;

  const text = [
    `Hi ${firstName},`,
    '',
    'YOUR BOOKING IS APPROVED. Your car is confirmed and reserved for you.',
    '',
    `Car: ${car}`,
    `Pickup: ${pickup}`,
    `Return: ${day(b.endDate)} (${duration})`,
    '',
    ...rows.map(([k, v]) => `${k}: ${v}`),
    '',
    'Please bring:',
    ...needs.map((n) => `- ${n}`),
    '',
    'Questions or changes? Reply to this email, or contact us:',
    ...business.phones.map((p) => `Call/text ${p.network}: ${p.display}`),
    `WhatsApp: https://api.whatsapp.com/send?phone=${business.whatsappNumber}`,
    `Messenger: ${business.messenger}`,
    `Visit: ${business.address}`,
    '',
    `Thank you for choosing ${business.name}!`,
  ].join('\n');

  const html = `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"></head>
<body style="margin:0;padding:0;background:${C.bg};font-family:Arial,Helvetica,sans-serif;color:${C.ink}">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0">Your booking is approved: ${escapeHtml(car)} on ${escapeHtml(pickup)}.</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.bg};padding:24px 12px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden">
        <tr><td style="background:${C.ink};padding:24px">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
            <td style="color:${C.brand};font-size:12px;font-weight:bold;letter-spacing:2px;text-transform:uppercase">Booking approved</td>
            <td align="right" style="color:${C.soft};font-size:12px;white-space:nowrap">Ref <b style="color:#ffffff">${escapeHtml(b.reference)}</b></td>
          </tr></table>
          <p style="margin:8px 0 0;color:#ffffff;font-size:26px;line-height:1.2;font-weight:bold">Your booking is approved</p>
          <p style="margin:6px 0 0;color:#ffffff;font-size:16px;line-height:1.5">&#10003; Confirmed and reserved: <b>${escapeHtml(car)}</b></p>
        </td></tr>
        <tr><td style="padding:20px 24px 0;font-size:15px;line-height:1.6">
          Hi ${escapeHtml(firstName)},<br>Your booking with ${escapeHtml(business.name)} has been <b style="color:${C.green}">approved</b>. Your car is confirmed and reserved for you. Here are your booking details:
        </td></tr>
        <tr><td style="padding:16px 24px 0">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ecfdf3;border:1px solid #bbf7d0;border-radius:12px">
            <tr>
              <td width="50%" style="padding:14px 16px;vertical-align:top">
                <p style="margin:0;color:${C.muted};font-size:12px;font-weight:bold;letter-spacing:1px;text-transform:uppercase">Pickup</p>
                <p style="margin:4px 0 0;font-size:17px;font-weight:bold">${escapeHtml(day(b.startDate))}</p>
                <p style="margin:2px 0 0;font-size:15px;font-weight:bold;color:${C.green}">${escapeHtml(time(b.pickupTime) || 'Time to be confirmed')}</p>
              </td>
              <td width="50%" style="padding:14px 16px;vertical-align:top;border-left:1px solid #bbf7d0">
                <p style="margin:0;color:${C.muted};font-size:12px;font-weight:bold;letter-spacing:1px;text-transform:uppercase">Return</p>
                <p style="margin:4px 0 0;font-size:17px;font-weight:bold">${escapeHtml(day(b.endDate))}</p>
                <p style="margin:2px 0 0;font-size:15px;color:${C.muted}">${escapeHtml(duration)}</p>
              </td>
            </tr>
          </table>
        </td></tr>
        <tr><td style="padding:16px 24px 0">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;line-height:1.45">
            ${rows
              .map(
                ([k, v]) => `<tr>
              <td style="padding:9px 12px 9px 0;border-bottom:1px solid ${C.line};color:${C.muted};width:38%;vertical-align:top">${escapeHtml(k)}</td>
              <td style="padding:9px 0;border-bottom:1px solid ${C.line};font-weight:bold;vertical-align:top;word-break:break-word">${escapeHtml(v)}</td>
            </tr>`,
              )
              .join('')}
          </table>
        </td></tr>
        <tr><td style="padding:20px 24px 0">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef8ff;border:1px solid #cdeaff;border-radius:12px">
            <tr><td style="padding:14px 16px;font-size:14px;line-height:1.6">
              <b>Please bring:</b><br>${needs.map((n) => `&#10003; ${escapeHtml(n)}`).join('<br>')}
            </td></tr>
          </table>
        </td></tr>
        <tr><td style="padding:20px 24px 0;font-size:14px;line-height:1.6">
          <b>Questions or changes?</b> Reply to this email, or reach us:<br>
          ${business.phones
            .map(
              (p) =>
                `Call/text ${escapeHtml(p.network)}: <a href="tel:${p.href}" style="color:${C.ink};font-weight:bold">${escapeHtml(p.display)}</a>`,
            )
            .join('<br>')}<br>
          <a href="https://api.whatsapp.com/send?phone=${business.whatsappNumber}" style="color:${C.ink}">WhatsApp</a> &middot;
          <a href="${business.messenger}" style="color:${C.ink}">Messenger</a>
        </td></tr>
        <tr><td style="padding:16px 24px 24px;font-size:13px;line-height:1.6;color:${C.muted}">
          <b>Visit us:</b> ${escapeHtml(business.address)} &middot; <a href="${business.directionsUrl}" style="color:${C.ink}">Get directions</a>
        </td></tr>
      </table>
      <p style="margin:14px 0 0;color:${C.soft};font-size:12px;line-height:1.5">You're getting this email because you booked a car on the ${escapeHtml(business.name)} website.</p>
    </td></tr>
  </table>
</body></html>`;

  return { subject, text, html };
}
