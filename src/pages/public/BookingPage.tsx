import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowUpRight, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';
import { useFirebase } from '../../context/FirebaseContext';
import { useToast } from '../../components/ToastProvider';
import {
  buildWhatsappInquiryUrl,
  formatIDR,
  normalizeWhatsapp,
  PATTERNS,
} from '../../lib/validation';
import {
  fetchActivePackages,
  fetchPublicAvailability,
  submitPublicBooking,
} from '../../services/firestoreService';
import {
  AVAILABILITY_STATUS_LABELS,
  type AvailabilityEntry,
  type BookingRecord,
  type ServicePackage,
} from '../../types/unscripted';

const EVENT_TYPE_OPTIONS = [
  'Akad & Resepsi',
  'Intimate Ceremony',
  'Holy Matrimony & Reception',
  'Engagement / Sangjit',
  'Reception Only',
  'Other Celebration',
];

export function BookingPage() {
  const [searchParams] = useSearchParams();
  const { settings } = useFirebase();
  const { pushToast } = useToast();

  const [packages, setPackages] = useState<ServicePackage[]>([]);
  const [availability, setAvailability] = useState<Record<string, AvailabilityEntry>>({});
  const [loadingData, setLoadingData] = useState(true);

  const [coupleName, setCoupleName] = useState('');
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [email, setEmail] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [eventLocation, setEventLocation] = useState('');
  const [eventType, setEventType] = useState(EVENT_TYPE_OPTIONS[0]);
  const [selectedPackageId, setSelectedPackageId] = useState('');
  const [notes, setNotes] = useState('');

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastSubmittedSignature, setLastSubmittedSignature] = useState<string | null>(null);
  const [confirmedBooking, setConfirmedBooking] = useState<BookingRecord | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all([fetchActivePackages(), fetchPublicAvailability()])
      .then(([pkgs, availList]) => {
        if (!active) return;
        setPackages(pkgs);
        const map: Record<string, AvailabilityEntry> = {};
        for (const entry of availList) {
          map[entry.date] = entry;
        }
        setAvailability(map);

        const requestedSlug = searchParams.get('package')?.toLowerCase();
        const matched = pkgs.find(
          (p) => p.slug.toLowerCase() === requestedSlug || p.id.toLowerCase() === requestedSlug
        );
        if (matched) {
          setSelectedPackageId(matched.id);
        } else if (pkgs.length > 0) {
          setSelectedPackageId(pkgs[0].id);
        }
      })
      .catch((err) => {
        console.error('Booking load error:', err);
        pushToast('error', 'Could not load packages', 'Please refresh the page to try again.');
      })
      .finally(() => {
        if (active) setLoadingData(false);
      });
    return () => {
      active = false;
    };
  }, [searchParams, pushToast]);

  const selectedPackage = useMemo(
    () => packages.find((p) => p.id === selectedPackageId) || null,
    [packages, selectedPackageId]
  );

  const dateAvailability = eventDate ? availability[eventDate] : undefined;
  const isDateUnavailable =
    dateAvailability?.status === 'BOOKED' || dateAvailability?.status === 'BLOCKED';

  const validate = (): boolean => {
    const errors: Record<string, string> = {};
    if (coupleName.trim().length < 2) {
      errors.coupleName = 'Enter the couple name (minimum 2 characters).';
    }
    const normalizedWa = normalizeWhatsapp(whatsappNumber);
    if (!PATTERNS.whatsappInput.test(whatsappNumber.trim()) || !PATTERNS.normalizedWhatsapp.test(normalizedWa)) {
      errors.whatsappNumber = 'Enter a valid WhatsApp number (e.g. 081234567890).';
    }
    if (email.trim() && !PATTERNS.email.test(email.trim())) {
      errors.email = 'Enter a valid email address or leave blank.';
    }
    if (!PATTERNS.dateStr.test(eventDate)) {
      errors.eventDate = 'Select your event date.';
    } else if (isDateUnavailable) {
      errors.eventDate = 'This date is currently marked as unavailable. Choose another date or contact us directly.';
    }
    if (eventLocation.trim().length < 2) {
      errors.eventLocation = 'Enter the city or venue location.';
    }
    if (!eventType.trim()) {
      errors.eventType = 'Select an event type.';
    }
    if (!selectedPackage) {
      errors.packageId = 'Select a service package.';
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (!validate() || !selectedPackage) {
      pushToast('error', 'Please review the form fields', 'Some required details need attention.');
      return;
    }

    const signature = `${normalizeWhatsapp(whatsappNumber)}|${eventDate}|${selectedPackage.id}`;
    if (lastSubmittedSignature === signature) {
      pushToast('info', 'Inquiry already submitted', 'Please check your confirmation summary.');
      return;
    }

    setIsSubmitting(true);
    try {
      const record = await submitPublicBooking({
        coupleName,
        whatsappNumber,
        email: email.trim() || undefined,
        eventDate,
        eventLocation,
        eventType,
        packageId: selectedPackage.id,
        packageName: selectedPackage.name,
        packagePrice: selectedPackage.price,
        notes: notes.trim() || undefined,
      });
      setLastSubmittedSignature(signature);
      setConfirmedBooking(record);
      pushToast(
        'success',
        'Booking inquiry saved',
        `Reference ${record.bookingCode} is ready for WhatsApp confirmation.`
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to submit booking inquiry.';
      pushToast('error', 'Submission failed', msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (confirmedBooking) {
    const whatsappHref = buildWhatsappInquiryUrl(
      settings.whatsappNumber,
      {
        bookingCode: confirmedBooking.bookingCode,
        coupleName: confirmedBooking.coupleName,
        whatsappNumber: confirmedBooking.whatsappNumber,
        eventDate: confirmedBooking.eventDate,
        eventLocation: confirmedBooking.eventLocation,
        eventType: confirmedBooking.eventType,
        packageName: confirmedBooking.packageName,
        packagePrice: confirmedBooking.packagePrice,
        notes: confirmedBooking.notes,
      },
      settings.whatsappTemplate
    );

    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-8 py-14 lg:py-20">
        <div className="bg-white border border-[#171717] p-8 sm:p-12">
          <div className="flex items-center gap-3 text-[#171717] mb-5">
            <CheckCircle2 className="w-7 h-7 text-[#16A34A]" />
            <span className="font-mono text-xs uppercase tracking-[0.2em] font-semibold">
              Inquiry Recorded · Status: New Inquiry
            </span>
          </div>
          <h1 className="font-display text-3xl sm:text-4xl font-extrabold tracking-tight">
            Thank you, {confirmedBooking.coupleName}.
          </h1>
          <p className="mt-3 text-base text-[#171717]/75 leading-relaxed">
            Your inquiry has been logged with a unique Booking ID. Send it directly to our WhatsApp studio below to confirm date availability.
          </p>

          <div className="mt-8 bg-[#F5F1E9] border border-[#171717]/15 p-6 space-y-3 text-sm">
            <div className="flex flex-wrap justify-between gap-2 pb-3 border-b border-[#171717]/12">
              <span className="text-[#171717]/65">Booking ID</span>
              <span className="font-mono font-bold text-base tabular-nums">
                {confirmedBooking.bookingCode}
              </span>
            </div>
            <div className="flex flex-wrap justify-between gap-2">
              <span className="text-[#171717]/65">Event Date</span>
              <span className="font-medium tabular-nums">{confirmedBooking.eventDate}</span>
            </div>
            <div className="flex flex-wrap justify-between gap-2">
              <span className="text-[#171717]/65">Location</span>
              <span className="font-medium">{confirmedBooking.eventLocation}</span>
            </div>
            <div className="flex flex-wrap justify-between gap-2">
              <span className="text-[#171717]/65">Event Type</span>
              <span className="font-medium">{confirmedBooking.eventType}</span>
            </div>
            <div className="flex flex-wrap justify-between gap-2">
              <span className="text-[#171717]/65">Selected Package</span>
              <span className="font-semibold tabular-nums">
                {confirmedBooking.packageName} ({formatIDR(confirmedBooking.packagePrice)})
              </span>
            </div>
          </div>

          <div className="mt-8 flex flex-col sm:flex-row gap-4">
            <a
              href={whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-4 bg-[#D8FF3E] text-[#171717] border border-[#171717] text-sm font-bold hover:bg-[#171717] hover:text-white transition-colors"
            >
              Continue to WhatsApp Confirmation
              <ArrowUpRight className="w-4 h-4" />
            </a>
            <Link
              to="/"
              className="inline-flex items-center justify-center px-6 py-4 border border-[#171717]/25 text-sm font-semibold hover:border-[#171717] transition-colors"
            >
              Back to Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-8 py-12 lg:py-20">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
        {/* Left column info */}
        <div className="lg:col-span-5">
          <p className="font-mono text-xs uppercase tracking-[0.22em] text-[#FF5A55] font-semibold mb-3">
            Booking Inquiry
          </p>
          <h1 className="font-display text-4xl sm:text-5xl font-extrabold tracking-tight leading-[1.08]">
            Reserve your wedding story.
          </h1>
          <p className="mt-4 text-base text-[#171717]/75 leading-relaxed">
            Submit your event details below. Every inquiry generates a unique Booking ID and prepares a pre-filled WhatsApp confirmation message—no automatic charge or commitment until we confirm availability together.
          </p>

          <div className="mt-8 p-6 bg-white border border-[#171717]/15 space-y-4">
            <div>
              <p className="font-mono text-xs uppercase tracking-wider text-[#171717]/60">
                Service Area
              </p>
              <p className="mt-1 text-sm font-medium">{settings.serviceArea}</p>
            </div>
            {selectedPackage && (
              <div className="pt-4 border-t border-[#171717]/12">
                <p className="font-mono text-xs uppercase tracking-wider text-[#171717]/60">
                  Selected Launch Package
                </p>
                <div className="mt-1.5 flex items-baseline justify-between gap-2">
                  <span className="font-display text-xl font-bold">{selectedPackage.name}</span>
                  <span className="font-mono font-semibold tabular-nums">
                    {formatIDR(selectedPackage.price)}
                  </span>
                </div>
                <p className="mt-2 text-xs text-[#171717]/70">{selectedPackage.description}</p>
              </div>
            )}
          </div>
        </div>

        {/* Right column form */}
        <div className="lg:col-span-7 bg-white border border-[#171717]/15 p-6 sm:p-10">
          {loadingData ? (
            <div className="py-16 flex items-center justify-center gap-3 text-sm text-[#171717]/70">
              <Loader2 className="w-5 h-5 animate-spin" />
              Loading packages and availability...
            </div>
          ) : (
            <form onSubmit={handleSubmit} noValidate className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <label htmlFor="coupleName" className="block text-xs font-mono uppercase tracking-wider font-semibold mb-2">
                    Couple Name *
                  </label>
                  <input
                    id="coupleName"
                    type="text"
                    required
                    maxLength={120}
                    value={coupleName}
                    onChange={(e) => setCoupleName(e.target.value)}
                    placeholder="e.g. Nadia & Rizky"
                    className="w-full px-4 py-3 bg-[#F5F1E9]/50 border border-[#171717]/20 focus:border-[#171717] focus:outline-none text-sm"
                  />
                  {fieldErrors.coupleName && (
                    <p className="mt-1.5 text-xs text-[#FF5A55]">{fieldErrors.coupleName}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="whatsappNumber" className="block text-xs font-mono uppercase tracking-wider font-semibold mb-2">
                    WhatsApp Number *
                  </label>
                  <input
                    id="whatsappNumber"
                    type="tel"
                    required
                    maxLength={25}
                    value={whatsappNumber}
                    onChange={(e) => setWhatsappNumber(e.target.value)}
                    placeholder="e.g. 081234567890"
                    className="w-full px-4 py-3 bg-[#F5F1E9]/50 border border-[#171717]/20 focus:border-[#171717] focus:outline-none text-sm font-mono"
                  />
                  {fieldErrors.whatsappNumber && (
                    <p className="mt-1.5 text-xs text-[#FF5A55]">{fieldErrors.whatsappNumber}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <label htmlFor="email" className="block text-xs font-mono uppercase tracking-wider font-semibold mb-2">
                    Email (Optional)
                  </label>
                  <input
                    id="email"
                    type="email"
                    maxLength={254}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="couple@example.com"
                    className="w-full px-4 py-3 bg-[#F5F1E9]/50 border border-[#171717]/20 focus:border-[#171717] focus:outline-none text-sm"
                  />
                  {fieldErrors.email && (
                    <p className="mt-1.5 text-xs text-[#FF5A55]">{fieldErrors.email}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="eventDate" className="block text-xs font-mono uppercase tracking-wider font-semibold mb-2">
                    Event Date *
                  </label>
                  <input
                    id="eventDate"
                    type="date"
                    required
                    min={new Date().toISOString().split('T')[0]}
                    value={eventDate}
                    onChange={(e) => setEventDate(e.target.value)}
                    className="w-full px-4 py-3 bg-[#F5F1E9]/50 border border-[#171717]/20 focus:border-[#171717] focus:outline-none text-sm font-mono"
                  />
                  {dateAvailability && (
                    <div
                      className={`mt-2 flex items-center gap-1.5 text-xs ${
                        isDateUnavailable ? 'text-[#FF5A55] font-semibold' : 'text-[#D97706]'
                      }`}
                    >
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                      <span>
                        Date status: {AVAILABILITY_STATUS_LABELS[dateAvailability.status]}
                        {dateAvailability.note ? ` — ${dateAvailability.note}` : ''}
                      </span>
                    </div>
                  )}
                  {fieldErrors.eventDate && (
                    <p className="mt-1.5 text-xs text-[#FF5A55]">{fieldErrors.eventDate}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <label htmlFor="eventLocation" className="block text-xs font-mono uppercase tracking-wider font-semibold mb-2">
                    Event Location *
                  </label>
                  <input
                    id="eventLocation"
                    type="text"
                    required
                    maxLength={180}
                    value={eventLocation}
                    onChange={(e) => setEventLocation(e.target.value)}
                    placeholder="e.g. Semarang / Salatiga / Venue name"
                    className="w-full px-4 py-3 bg-[#F5F1E9]/50 border border-[#171717]/20 focus:border-[#171717] focus:outline-none text-sm"
                  />
                  {fieldErrors.eventLocation && (
                    <p className="mt-1.5 text-xs text-[#FF5A55]">{fieldErrors.eventLocation}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="eventType" className="block text-xs font-mono uppercase tracking-wider font-semibold mb-2">
                    Event Type *
                  </label>
                  <select
                    id="eventType"
                    value={eventType}
                    onChange={(e) => setEventType(e.target.value)}
                    className="w-full px-4 py-3 bg-[#F5F1E9]/50 border border-[#171717]/20 focus:border-[#171717] focus:outline-none text-sm"
                  >
                    {EVENT_TYPE_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                  {fieldErrors.eventType && (
                    <p className="mt-1.5 text-xs text-[#FF5A55]">{fieldErrors.eventType}</p>
                  )}
                </div>
              </div>

              <div>
                <p className="block text-xs font-mono uppercase tracking-wider font-semibold mb-2">
                  Selected Package *
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {packages.map((pkg) => {
                    const active = pkg.id === selectedPackageId;
                    return (
                      <button
                        key={pkg.id}
                        type="button"
                        onClick={() => setSelectedPackageId(pkg.id)}
                        className={`p-4 border text-left transition-colors cursor-pointer ${
                          active
                            ? 'bg-[#171717] text-white border-[#171717]'
                            : 'bg-[#F5F1E9]/45 text-[#171717] border-[#171717]/20 hover:border-[#171717]'
                        }`}
                      >
                        <p className="font-display font-bold text-base">{pkg.name}</p>
                        <p className="mt-1 font-mono text-xs tabular-nums opacity-85">
                          {formatIDR(pkg.price)}
                        </p>
                      </button>
                    );
                  })}
                </div>
                {fieldErrors.packageId && (
                  <p className="mt-1.5 text-xs text-[#FF5A55]">{fieldErrors.packageId}</p>
                )}
              </div>

              <div>
                <label htmlFor="notes" className="block text-xs font-mono uppercase tracking-wider font-semibold mb-2">
                  Additional Notes (Optional)
                </label>
                <textarea
                  id="notes"
                  rows={4}
                  maxLength={1500}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Share your rough timeline, venue vibe, or specific moments you care most about..."
                  className="w-full px-4 py-3 bg-[#F5F1E9]/50 border border-[#171717]/20 focus:border-[#171717] focus:outline-none text-sm"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting || isDateUnavailable}
                className="w-full inline-flex items-center justify-center gap-2 px-6 py-4 bg-[#171717] text-white text-sm font-bold hover:bg-[#D8FF3E] hover:text-[#171717] disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Generating Booking ID...
                  </>
                ) : (
                  <>
                    Submit Booking Inquiry
                    <ArrowUpRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
