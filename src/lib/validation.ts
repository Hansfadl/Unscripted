export const SCHEMA_LIMITS = {
  coupleNameMin: 2,
  coupleNameMax: 120,
  whatsappMin: 8,
  whatsappMax: 25,
  emailMax: 254,
  locationMin: 2,
  locationMax: 180,
  eventTypeMin: 2,
  eventTypeMax: 80,
  notesMax: 1500,
  summaryMax: 300,
  descriptionMax: 3000,
} as const;

export const PATTERNS = {
  whatsappInput: /^[0-9+\-\s()]{8,25}$/,
  normalizedWhatsapp: /^[0-9]{8,20}$/,
  dateStr: /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/,
  slug: /^[a-z0-9-]+$/,
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  bookingCode: /^UNSC-[0-9]{6}-[A-Z0-9]{4}$/,
} as const;

export function sanitizeText(value: string, maxLength: number): string {
  return value
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

export function sanitizeMultilineText(value: string, maxLength: number): string {
  return value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .trim()
    .slice(0, maxLength);
}

export function normalizeWhatsapp(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('0')) {
    return `62${digits.slice(1)}`.slice(0, 20);
  }
  return digits.slice(0, 20);
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 120);
}

export function formatIDR(amount: number): string {
  return `IDR ${new Intl.NumberFormat('en-US').format(Math.round(amount || 0))}`;
}

export function formatDisplayDate(dateStr: string): string {
  if (!PATTERNS.dateStr.test(dateStr)) return dateStr;
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return new Intl.DateTimeFormat('en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

export function generateBookingCode(): string {
  const now = new Date();
  const yy = String(now.getUTCFullYear()).slice(-2);
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(now.getUTCDate()).padStart(2, '0');
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const array = new Uint32Array(4);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(array);
  } else {
    for (let i = 0; i < 4; i++) array[i] = Math.floor(Math.random() * alphabet.length);
  }
  let suffix = '';
  for (let i = 0; i < 4; i++) {
    suffix += alphabet[array[i] % alphabet.length];
  }
  return `UNSC-${yy}${mm}${dd}-${suffix}`;
}

export function isValidHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value.trim());
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

export function isValidInstagramHandle(handle: string): boolean {
  return /^@[a-zA-Z0-9._]{1,60}$/.test(handle.trim());
}

export function isValidWhatsappWithCountryCode(raw: string): boolean {
  const digits = raw.replace(/\D/g, '');
  return digits.length >= 9 && digits.length <= 20 && !digits.startsWith('0');
}

export interface BookingMessagePayload {
  bookingCode: string;
  coupleName: string;
  whatsappNumber: string;
  eventDate: string;
  eventLocation: string;
  eventType: string;
  packageName: string;
  packagePrice: number;
  notes?: string;
}

export function buildWhatsappGeneralUrl(
  businessWhatsapp: string,
  greetingTemplate?: string
): string {
  const target = normalizeWhatsapp(businessWhatsapp) || '6281234567890';
  const greeting =
    greetingTemplate?.trim() ||
    'Halo UNSCRIPTED! I would like to ask about wedding content creator availability.';
  return `https://wa.me/${target}?text=${encodeURIComponent(greeting)}`;
}

export function buildWhatsappInquiryUrl(
  businessWhatsapp: string,
  booking: BookingMessagePayload,
  greetingTemplate?: string
): string {
  const target = normalizeWhatsapp(businessWhatsapp) || '6281234567890';
  const greeting =
    greetingTemplate?.trim() ||
    'Halo UNSCRIPTED! I just submitted a booking inquiry.';
  const lines = [
    greeting,
    '',
    `Booking ID: ${booking.bookingCode}`,
    `Couple: ${booking.coupleName}`,
    `Event Date: ${booking.eventDate}`,
    `Event Type: ${booking.eventType}`,
    `Location: ${booking.eventLocation}`,
    `Package: ${booking.packageName} (${formatIDR(booking.packagePrice)})`,
    booking.notes ? `Notes: ${booking.notes}` : null,
    '',
    'Looking forward to confirming availability!',
  ]
    .filter((line): line is string => line !== null)
    .join('\n');

  return `https://wa.me/${target}?text=${encodeURIComponent(lines)}`;
}

export function formatRp(amount: number): string {
  return `Rp${new Intl.NumberFormat('en-US').format(Math.round(amount || 0))}`;
}

export function buildWhatsappInvoiceUrl(params: {
  clientWhatsapp: string;
  clientName: string;
  invoiceNumber: string;
  weddingDate: string;
  packageName: string;
  grandTotal: number;
  downPaymentAmount: number;
  amountPaid: number;
  remainingBalance: number;
  dueDate: string;
  bankName?: string;
  bankAccountNumber?: string;
  bankAccountHolder?: string;
}): string {
  const target = normalizeWhatsapp(params.clientWhatsapp);
  const bankLine =
    params.bankAccountNumber && params.bankName
      ? `Transfer to: ${params.bankName} · ${params.bankAccountNumber}${
          params.bankAccountHolder ? ` (a.n. ${params.bankAccountHolder})` : ''
        }`
      : null;

  const lines = [
    `Halo ${params.clientName},`,
    '',
    `Here is your official invoice from UNSCRIPTED Wedding Content Creator (REAL MOMENTS. NO RETAKES.):`,
    '',
    `Invoice No: ${params.invoiceNumber}`,
    `Wedding Date: ${formatDisplayDate(params.weddingDate)}`,
    `Package: ${params.packageName}`,
    `Grand Total: ${formatRp(params.grandTotal)}`,
    `Down Payment Required: ${formatRp(params.downPaymentAmount)}`,
    params.amountPaid > 0 ? `Paid to Date: ${formatRp(params.amountPaid)}` : null,
    `Remaining Balance: ${formatRp(params.remainingBalance)}`,
    `Due Date: ${formatDisplayDate(params.dueDate)}`,
    bankLine,
    '',
    'We have attached your A4 PDF invoice to this message. Please send proof of transfer once completed. Thank you!',
  ]
    .filter((line): line is string => line !== null)
    .join('\n');

  return `https://wa.me/${target}?text=${encodeURIComponent(lines)}`;
}
