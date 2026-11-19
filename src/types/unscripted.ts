import type { Timestamp } from 'firebase/firestore';

export type BookingStatus =
  | 'NEW_INQUIRY'
  | 'CONTACTED'
  | 'WAITING_CONFIRMATION'
  | 'CONFIRMED'
  | 'COMPLETED'
  | 'CANCELLED';

export type PaymentStatus =
  | 'UNPAID'
  | 'DP_PAID'
  | 'PARTIALLY_PAID'
  | 'FULLY_PAID'
  | 'REFUNDED';

export type AvailabilityStatus = 'AVAILABLE' | 'LIMITED' | 'BOOKED' | 'BLOCKED';

export type BookingSource = 'PUBLIC_WEB' | 'ADMIN_MANUAL';

export type ActivityEntityType =
  | 'BOOKING'
  | 'PORTFOLIO'
  | 'PACKAGE'
  | 'CUSTOMER'
  | 'SETTINGS'
  | 'AVAILABILITY'
  | 'COUPLE_NOTE'
  | 'HOMEPAGE'
  | 'INVOICE';

export const BOOKING_STATUS_LABELS: Record<BookingStatus, string> = {
  NEW_INQUIRY: 'New Inquiry',
  CONTACTED: 'Contacted',
  WAITING_CONFIRMATION: 'Waiting Confirmation',
  CONFIRMED: 'Confirmed',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
};

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  UNPAID: 'Unpaid',
  DP_PAID: 'DP Paid',
  PARTIALLY_PAID: 'Partially Paid',
  FULLY_PAID: 'Fully Paid',
  REFUNDED: 'Refunded',
};

export const AVAILABILITY_STATUS_LABELS: Record<AvailabilityStatus, string> = {
  AVAILABLE: 'Available',
  LIMITED: 'Limited Slots',
  BOOKED: 'Booked',
  BLOCKED: 'Unavailable',
};

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: 'admin';
  photoURL?: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface BookingRecord {
  id: string;
  bookingCode: string;
  coupleName: string;
  whatsappNumber: string;
  normalizedWhatsapp: string;
  email?: string;
  eventDate: string; // YYYY-MM-DD
  eventLocation: string;
  eventType: string;
  packageId: string;
  packageName: string;
  packagePrice: number;
  amountPaid?: number;
  notes?: string;
  status: BookingStatus;
  paymentStatus: PaymentStatus;
  customerId?: string;
  source: BookingSource;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface CustomerRecord {
  id: string;
  coupleName: string;
  whatsappNumber: string;
  normalizedWhatsapp: string;
  email?: string;
  notes?: string;
  totalBookings: number;
  lastBookingDate?: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface ServicePackage {
  id: string;
  name: string;
  slug: string;
  price: number;
  tagline?: string;
  description: string;
  coverageDetails?: string;
  deliverables: string[];
  additionalNotes?: string;
  isActive: boolean;
  isFeatured: boolean;
  sortOrder: number;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface PortfolioMediaItem {
  url: string;
  type: 'image' | 'video';
  caption?: string;
}

export interface PortfolioItem {
  id: string;
  slug: string;
  coupleName: string;
  eventDate: string;
  location: string;
  eventType: string;
  summary: string;
  description: string;
  coverImage: string;
  mediaItems: PortfolioMediaItem[];
  published: boolean;
  featured: boolean;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface AvailabilityEntry {
  date: string; // YYYY-MM-DD
  status: AvailabilityStatus;
  note?: string;
  updatedAt?: Timestamp;
}

export interface SiteSettings {
  brandName: string;
  tagline: string;
  whatsappNumber: string;
  instagramHandle: string;
  instagramUrl: string;
  whatsappTemplate?: string;
  tiktokUrl?: string;
  youtubeUrl?: string;
  email?: string;
  serviceArea: string;
  heroHeadline: string;
  heroSubheadline: string;
  aboutStatement: string;
  bookingNotice?: string;
  updatedAt?: Timestamp;
}

export interface CoupleNote {
  id: string;
  coupleName: string;
  weddingDetails: string;
  note: string;
  description?: string;
  tag?: string;
  published: boolean;
  sortOrder: number;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface FocalPoint {
  x: number; // 0 to 100 (%)
  y: number; // 0 to 100 (%)
}

export interface HomepageGalleryItem {
  id: string;
  url: string;
  caption?: string;
  visible: boolean;
  sortOrder: number;
  focalPoint?: FocalPoint;
}

export interface HomepageConfig {
  heroTitle: string;
  heroSubtitle: string;
  heroImageUrl: string;
  heroImageAlt?: string;
  heroImagePosition: FocalPoint;
  heroCaption?: string;
  heroPrimaryCtaLabel: string;
  heroSecondaryCtaLabel: string;
  gallerySectionEnabled: boolean;
  galleryItems: HomepageGalleryItem[];
  aboutEyebrow?: string;
  aboutHeadline: string;
  aboutText: string;
  aboutImageUrl?: string;
  aboutImageAlt?: string;
  aboutCtaLabel?: string;
  featuredPortfolioIds: string[];
  ctaEyebrow?: string;
  ctaHeadline: string;
  ctaSubtext?: string;
  ctaButtonLabel: string;
  updatedBy?: string;
  publishedAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface ActivityLog {
  id: string;
  action: string;
  entityType: ActivityEntityType;
  entityId: string;
  summary: string;
  actorUid: string;
  actorEmail: string;
  createdAt?: Timestamp;
}

export type InvoiceLifecycleStatus = 'DRAFT' | 'FINALIZED' | 'VOID';

export type InvoicePaymentStatus = 'UNPAID' | 'PARTIALLY_PAID' | 'PAID' | 'OVERDUE';

export type InvoiceDpMode =
  | 'PERCENT_30'
  | 'PERCENT_50'
  | 'CUSTOM_PERCENT'
  | 'CUSTOM_AMOUNT';

export const INVOICE_PAYMENT_STATUS_LABELS: Record<InvoicePaymentStatus, string> = {
  UNPAID: 'Unpaid',
  PARTIALLY_PAID: 'Partially Paid',
  PAID: 'Paid',
  OVERDUE: 'Overdue',
};

export const INVOICE_LIFECYCLE_LABELS: Record<InvoiceLifecycleStatus, string> = {
  DRAFT: 'Draft',
  FINALIZED: 'Finalized',
  VOID: 'Voided',
};

export interface InvoiceLineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

export interface InvoicePaymentRecord {
  id: string;
  date: string; // YYYY-MM-DD
  amount: number;
  method: string;
  note?: string;
  recordedBy?: string;
}

export interface InvoiceSettings {
  bankName: string;
  bankAccountNumber: string;
  bankAccountHolder: string;
  paymentInstructions: string;
  defaultThankYouMessage: string;
  defaultDueDays: number;
  defaultDpMode: 'PERCENT_30' | 'PERCENT_50';
  updatedAt?: Timestamp;
}

export interface InvoiceRecord {
  id: string;
  invoiceNumber: string; // INV/USC/YYYY/NNN
  sequenceYear: number;
  sequenceNumber: number;
  bookingId: string;
  bookingCode: string;
  lifecycleStatus: InvoiceLifecycleStatus;
  paymentStatus: InvoicePaymentStatus;
  issueDate: string; // YYYY-MM-DD
  dueDate: string; // YYYY-MM-DD
  clientName: string;
  clientWhatsapp: string;
  normalizedWhatsapp: string;
  clientEmail?: string;
  weddingDate: string; // YYYY-MM-DD
  eventLocation: string;
  eventType: string;
  packageId: string;
  packageName: string;
  packagePrice: number;
  additionalItems: InvoiceLineItem[];
  additionalServicesTotal: number;
  transportationFee: number;
  overtimeFee: number;
  discount: number;
  grandTotal: number;
  dpMode: InvoiceDpMode;
  dpPercent: number;
  downPaymentAmount: number;
  amountPaid: number;
  remainingBalance: number;
  payments: InvoicePaymentRecord[];
  bankName: string;
  bankAccountNumber: string;
  bankAccountHolder: string;
  paymentInstructions: string;
  thankYouMessage: string;
  notes?: string;
  finalizedAt?: Timestamp;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}
