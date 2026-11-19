import React, { useEffect, useMemo, useState } from 'react';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Loader2,
  RotateCcw,
  Save,
  Trash2,
} from 'lucide-react';
import { useFirebase } from '../../context/FirebaseContext';
import { useToast } from '../../components/ToastProvider';
import {
  formatDisplayDate,
  isValidHttpUrl,
  isValidInstagramHandle,
  isValidWhatsappWithCountryCode,
  PATTERNS,
} from '../../lib/validation';
import {
  deleteDateAvailability,
  fetchAllBookings,
  fetchPublicAvailability,
  saveDateAvailability,
  savePublicSettings,
} from '../../services/firestoreService';
import {
  AVAILABILITY_STATUS_LABELS,
  type AvailabilityEntry,
  type AvailabilityStatus,
  type BookingRecord,
  type SiteSettings,
} from '../../types/unscripted';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function AdminSettingsPage() {
  const { user, settings, refreshSettings } = useFirebase();
  const { pushToast } = useToast();

  const [form, setForm] = useState<SiteSettings>(settings);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [savingSettings, setSavingSettings] = useState(false);

  const [availabilityList, setAvailabilityList] = useState<AvailabilityEntry[]>([]);
  const [confirmedDates, setConfirmedDates] = useState<Record<string, BookingRecord[]>>({});
  const [loadingAvail, setLoadingAvail] = useState(true);
  const [availDate, setAvailDate] = useState('');
  const [availStatus, setAvailStatus] = useState<AvailabilityStatus>('BOOKED');
  const [availNote, setAvailNote] = useState('');
  const [savingAvail, setSavingAvail] = useState(false);

  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  useEffect(() => {
    setForm(settings);
  }, [settings]);

  const isDirty = useMemo(() => {
    return (
      form.brandName !== settings.brandName ||
      form.tagline !== settings.tagline ||
      form.whatsappNumber !== settings.whatsappNumber ||
      (form.whatsappTemplate || '') !== (settings.whatsappTemplate || '') ||
      form.instagramHandle !== settings.instagramHandle ||
      form.instagramUrl !== settings.instagramUrl ||
      (form.tiktokUrl || '') !== (settings.tiktokUrl || '') ||
      (form.youtubeUrl || '') !== (settings.youtubeUrl || '') ||
      (form.email || '') !== (settings.email || '') ||
      form.serviceArea !== settings.serviceArea ||
      form.heroHeadline !== settings.heroHeadline ||
      form.heroSubheadline !== settings.heroSubheadline ||
      form.aboutStatement !== settings.aboutStatement
    );
  }, [form, settings]);

  const loadAvailabilityAndCalendar = async () => {
    setLoadingAvail(true);
    try {
      const [availEntries, bookings] = await Promise.all([
        fetchPublicAvailability(),
        fetchAllBookings(),
      ]);
      setAvailabilityList(availEntries.sort((a, b) => a.date.localeCompare(b.date)));

      const byDate: Record<string, BookingRecord[]> = {};
      for (const b of bookings) {
        if (b.status === 'CONFIRMED') {
          if (!byDate[b.eventDate]) byDate[b.eventDate] = [];
          byDate[b.eventDate].push(b);
        }
      }
      setConfirmedDates(byDate);
    } catch (err) {
      pushToast(
        'error',
        'Failed to load availability',
        err instanceof Error ? err.message : undefined
      );
    } finally {
      setLoadingAvail(false);
    }
  };

  useEffect(() => {
    loadAvailabilityAndCalendar();
  }, []);

  const validateSettings = (): boolean => {
    const errs: Record<string, string> = {};
    if (!form.brandName.trim()) errs.brandName = 'Brand name is required.';
    if (!form.tagline.trim()) errs.tagline = 'Tagline is required.';
    if (!isValidWhatsappWithCountryCode(form.whatsappNumber)) {
      errs.whatsappNumber =
        'Include country code without leading 0 (e.g. 6281234567890).';
    }
    if (!isValidInstagramHandle(form.instagramHandle)) {
      errs.instagramHandle = 'Enter a valid handle starting with @ (e.g. @unscripted.id).';
    }
    if (!isValidHttpUrl(form.instagramUrl)) {
      errs.instagramUrl = 'Enter a valid https:// Instagram profile URL.';
    }
    if (form.tiktokUrl?.trim() && !isValidHttpUrl(form.tiktokUrl)) {
      errs.tiktokUrl = 'Enter a valid https:// TikTok URL or leave blank.';
    }
    if (form.youtubeUrl?.trim() && !isValidHttpUrl(form.youtubeUrl)) {
      errs.youtubeUrl = 'Enter a valid https:// YouTube URL or leave blank.';
    }
    if (form.email?.trim() && !PATTERNS.email.test(form.email.trim())) {
      errs.email = 'Enter a valid email address or leave blank.';
    }
    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!validateSettings()) {
      pushToast('error', 'Validation failed', 'Please fix the highlighted fields.');
      return;
    }

    setSavingSettings(true);
    try {
      await savePublicSettings(user, {
        ...form,
        whatsappNumber: form.whatsappNumber.replace(/\D/g, ''),
      });
      await refreshSettings();
      pushToast(
        'success',
        'Settings saved',
        'Contact links, WhatsApp routing, and website copy are now live.'
      );
    } catch (err) {
      pushToast('error', 'Save failed', err instanceof Error ? err.message : undefined);
    } finally {
      setSavingSettings(false);
    }
  };

  const handleCancelSettings = () => {
    setForm(settings);
    setFormErrors({});
    pushToast('info', 'Changes discarded', 'Reverted to last saved settings.');
  };

  const handleSaveAvailability = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !availDate) return;
    setSavingAvail(true);
    try {
      await saveDateAvailability(user, availDate, availStatus, availNote.trim() || undefined);
      setAvailDate('');
      setAvailNote('');
      await loadAvailabilityAndCalendar();
      pushToast('success', 'Date availability updated', `${availDate} marked ${availStatus}`);
    } catch (err) {
      pushToast('error', 'Failed to update date', err instanceof Error ? err.message : undefined);
    } finally {
      setSavingAvail(false);
    }
  };

  const handleRemoveAvailability = async (date: string) => {
    if (!user) return;
    try {
      await deleteDateAvailability(user, date);
      setAvailabilityList((prev) => prev.filter((item) => item.date !== date));
      pushToast('success', 'Date override cleared', date);
    } catch (err) {
      pushToast('error', 'Delete failed', err instanceof Error ? err.message : undefined);
    }
  };

  // Calendar Grid Helpers
  const availabilityByDate = useMemo(() => {
    const map: Record<string, AvailabilityEntry> = {};
    for (const item of availabilityList) {
      map[item.date] = item;
    }
    return map;
  }, [availabilityList]);

  const calendarDays = useMemo(() => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const firstWeekday = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: (string | null)[] = [];
    for (let i = 0; i < firstWeekday; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      const mm = String(month + 1).padStart(2, '0');
      const dd = String(d).padStart(2, '0');
      cells.push(`${year}-${mm}-${dd}`);
    }
    return cells;
  }, [calendarMonth]);

  const monthLabel = new Intl.DateTimeFormat('en-US', {
    month: 'long',
    year: 'numeric',
  }).format(calendarMonth);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight">
          Settings & Availability Calendar
        </h1>
        <p className="mt-1 text-sm text-[#171717]/65">
          Update Instagram, WhatsApp number & greeting template, social channels, editorial copy, and date availability without redeploying.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Brand & Contact Settings */}
        <form
          onSubmit={handleSaveSettings}
          noValidate
          className="lg:col-span-7 bg-white border border-[#171717]/12 p-6 space-y-5 text-sm"
        >
          <div className="flex items-center justify-between pb-3 border-b border-[#171717]/10">
            <h2 className="font-display text-xl font-bold">Dynamic Brand & Contact Settings</h2>
            {isDirty && (
              <span className="text-xs font-mono text-[#D97706]">Unsaved changes</span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-mono uppercase mb-1">Brand Name *</label>
              <input
                type="text"
                required
                value={form.brandName}
                onChange={(e) => setForm({ ...form, brandName: e.target.value })}
                className="w-full px-3 py-2 border border-[#171717]/20 focus:border-[#171717] focus:outline-none"
              />
              {formErrors.brandName && (
                <p className="mt-1 text-xs text-[#FF5A55]">{formErrors.brandName}</p>
              )}
            </div>
            <div>
              <label className="block text-xs font-mono uppercase mb-1">Tagline *</label>
              <input
                type="text"
                required
                value={form.tagline}
                onChange={(e) => setForm({ ...form, tagline: e.target.value })}
                className="w-full px-3 py-2 border border-[#171717]/20 focus:border-[#171717] focus:outline-none"
              />
              {formErrors.tagline && (
                <p className="mt-1 text-xs text-[#FF5A55]">{formErrors.tagline}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-mono uppercase mb-1">
                WhatsApp Number (with country code) *
              </label>
              <input
                type="text"
                required
                value={form.whatsappNumber}
                onChange={(e) => setForm({ ...form, whatsappNumber: e.target.value })}
                placeholder="6281234567890"
                className="w-full px-3 py-2 border border-[#171717]/20 focus:border-[#171717] focus:outline-none font-mono"
              />
              {formErrors.whatsappNumber && (
                <p className="mt-1 text-xs text-[#FF5A55]">{formErrors.whatsappNumber}</p>
              )}
            </div>
            <div>
              <label className="block text-xs font-mono uppercase mb-1">
                Public Contact Email (Optional)
              </label>
              <input
                type="email"
                value={form.email || ''}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="hello@unscripted.id"
                className="w-full px-3 py-2 border border-[#171717]/20 focus:border-[#171717] focus:outline-none"
              />
              {formErrors.email && (
                <p className="mt-1 text-xs text-[#FF5A55]">{formErrors.email}</p>
              )}
            </div>
          </div>

          <div>
            <label className="block text-xs font-mono uppercase mb-1">
              WhatsApp Default Greeting / Message Template
            </label>
            <textarea
              rows={2}
              maxLength={800}
              value={form.whatsappTemplate || ''}
              onChange={(e) => setForm({ ...form, whatsappTemplate: e.target.value })}
              placeholder="Halo UNSCRIPTED! I would like to inquire about wedding content creator availability."
              className="w-full px-3 py-2 border border-[#171717]/20 focus:border-[#171717] focus:outline-none"
            />
            <p className="mt-1 text-[11px] text-[#171717]/55">
              Used as the opening line on all public WhatsApp buttons and booking redirects.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-mono uppercase mb-1">
                Instagram Username *
              </label>
              <input
                type="text"
                required
                value={form.instagramHandle}
                onChange={(e) => setForm({ ...form, instagramHandle: e.target.value })}
                placeholder="@unscripted.id"
                className="w-full px-3 py-2 border border-[#171717]/20 focus:border-[#171717] focus:outline-none font-mono"
              />
              {formErrors.instagramHandle && (
                <p className="mt-1 text-xs text-[#FF5A55]">{formErrors.instagramHandle}</p>
              )}
            </div>
            <div>
              <label className="block text-xs font-mono uppercase mb-1">
                Instagram Profile URL *
              </label>
              <input
                type="url"
                required
                value={form.instagramUrl}
                onChange={(e) => setForm({ ...form, instagramUrl: e.target.value })}
                placeholder="https://instagram.com/unscripted.id"
                className="w-full px-3 py-2 border border-[#171717]/20 focus:border-[#171717] focus:outline-none font-mono text-xs"
              />
              {formErrors.instagramUrl && (
                <p className="mt-1 text-xs text-[#FF5A55]">{formErrors.instagramUrl}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-mono uppercase mb-1">
                TikTok URL (Optional)
              </label>
              <input
                type="url"
                value={form.tiktokUrl || ''}
                onChange={(e) => setForm({ ...form, tiktokUrl: e.target.value })}
                placeholder="https://tiktok.com/@unscripted.id"
                className="w-full px-3 py-2 border border-[#171717]/20 focus:border-[#171717] focus:outline-none font-mono text-xs"
              />
              {formErrors.tiktokUrl && (
                <p className="mt-1 text-xs text-[#FF5A55]">{formErrors.tiktokUrl}</p>
              )}
            </div>
            <div>
              <label className="block text-xs font-mono uppercase mb-1">
                YouTube URL (Optional)
              </label>
              <input
                type="url"
                value={form.youtubeUrl || ''}
                onChange={(e) => setForm({ ...form, youtubeUrl: e.target.value })}
                placeholder="https://youtube.com/@unscripted"
                className="w-full px-3 py-2 border border-[#171717]/20 focus:border-[#171717] focus:outline-none font-mono text-xs"
              />
              {formErrors.youtubeUrl && (
                <p className="mt-1 text-xs text-[#FF5A55]">{formErrors.youtubeUrl}</p>
              )}
            </div>
          </div>

          <div>
            <label className="block text-xs font-mono uppercase mb-1">Service Area *</label>
            <input
              type="text"
              required
              value={form.serviceArea}
              onChange={(e) => setForm({ ...form, serviceArea: e.target.value })}
              className="w-full px-3 py-2 border border-[#171717]/20 focus:border-[#171717] focus:outline-none"
            />
          </div>

          <h2 className="font-display text-xl font-bold pt-4 pb-3 border-b border-[#171717]/10">
            Website Editorial Copy
          </h2>

          <div>
            <label className="block text-xs font-mono uppercase mb-1">Hero Headline *</label>
            <input
              type="text"
              required
              value={form.heroHeadline}
              onChange={(e) => setForm({ ...form, heroHeadline: e.target.value })}
              className="w-full px-3 py-2 border border-[#171717]/20 focus:border-[#171717] focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-mono uppercase mb-1">Hero Subheadline *</label>
            <textarea
              rows={2}
              required
              value={form.heroSubheadline}
              onChange={(e) => setForm({ ...form, heroSubheadline: e.target.value })}
              className="w-full px-3 py-2 border border-[#171717]/20 focus:border-[#171717] focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-mono uppercase mb-1">About Statement *</label>
            <textarea
              rows={3}
              required
              value={form.aboutStatement}
              onChange={(e) => setForm({ ...form, aboutStatement: e.target.value })}
              className="w-full px-3 py-2 border border-[#171717]/20 focus:border-[#171717] focus:outline-none"
            />
          </div>

          <div className="pt-3 border-t border-[#171717]/10 flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={savingSettings}
              className="inline-flex items-center gap-2 px-5 py-3 bg-[#171717] text-white text-xs font-semibold hover:bg-[#D8FF3E] hover:text-[#171717] disabled:opacity-50 transition-colors cursor-pointer"
            >
              <Save className="w-4 h-4" />
              {savingSettings ? 'Saving Settings...' : 'Save Settings'}
            </button>
            <button
              type="button"
              onClick={handleCancelSettings}
              disabled={!isDirty || savingSettings}
              className="inline-flex items-center gap-2 px-4 py-3 border border-[#171717]/20 text-xs font-semibold hover:border-[#171717] disabled:opacity-40 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Cancel
            </button>
          </div>
        </form>

        {/* Availability Calendar & Override Manager */}
        <div className="lg:col-span-5 bg-white border border-[#171717]/12 p-6 space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-[#171717]/10">
            <div className="flex items-center gap-2">
              <CalendarIcon className="w-5 h-5" />
              <h2 className="font-display text-xl font-bold">Availability Calendar</h2>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() =>
                  setCalendarMonth(
                    new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1)
                  )
                }
                className="p-1.5 border border-[#171717]/15 hover:border-[#171717] cursor-pointer"
                aria-label="Previous month"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() =>
                  setCalendarMonth(
                    new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1)
                  )
                }
                className="p-1.5 border border-[#171717]/15 hover:border-[#171717] cursor-pointer"
                aria-label="Next month"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div>
            <p className="font-mono text-xs font-semibold uppercase tracking-wider mb-2">
              {monthLabel}
            </p>
            <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-mono text-[#171717]/55 mb-1">
              {WEEKDAYS.map((w) => (
                <div key={w} className="py-1">
                  {w}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {calendarDays.map((dateStr, idx) => {
                if (!dateStr) return <div key={`empty-${idx}`} className="h-9" />;
                const override = availabilityByDate[dateStr];
                const confirmed = confirmedDates[dateStr];
                const isSelected = availDate === dateStr;
                let cellStyle = 'bg-[#F7F6F2] text-[#171717] border-[#171717]/10';
                if (confirmed && confirmed.length > 0) {
                  cellStyle = 'bg-[#171717] text-[#D8FF3E] border-[#171717] font-bold';
                } else if (override?.status === 'BOOKED' || override?.status === 'BLOCKED') {
                  cellStyle = 'bg-[#FF5A55]/15 text-[#DC2626] border-[#FF5A55]/40 font-semibold';
                } else if (override?.status === 'LIMITED') {
                  cellStyle = 'bg-[#D8FF3E]/50 text-[#171717] border-[#171717]/40 font-semibold';
                }

                return (
                  <button
                    key={dateStr}
                    type="button"
                    onClick={() => {
                      setAvailDate(dateStr);
                      setAvailStatus(override?.status || (confirmed ? 'BOOKED' : 'LIMITED'));
                      setAvailNote(override?.note || '');
                    }}
                    className={`h-9 border text-xs font-mono tabular-nums transition-colors cursor-pointer ${cellStyle} ${
                      isSelected ? 'ring-2 ring-[#171717]' : ''
                    }`}
                    title={
                      confirmed
                        ? `${confirmed.length} confirmed booking(s)`
                        : override
                        ? AVAILABILITY_STATUS_LABELS[override.status]
                        : 'Available'
                    }
                  >
                    {Number(dateStr.slice(-2))}
                  </button>
                );
              })}
            </div>
            <div className="mt-3 flex flex-wrap gap-3 text-[11px] font-mono text-[#171717]/65">
              <span>Dark = Confirmed Event</span>
              <span>·</span>
              <span>Coral = Booked/Blocked</span>
              <span>·</span>
              <span>Lime = Limited</span>
            </div>
          </div>

          <form onSubmit={handleSaveAvailability} className="space-y-3 text-sm pt-3 border-t border-[#171717]/10">
            <div>
              <label className="block text-xs font-mono uppercase mb-1">Selected Date</label>
              <input
                type="date"
                required
                value={availDate}
                onChange={(e) => setAvailDate(e.target.value)}
                className="w-full px-3 py-2 border border-[#171717]/20 font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-mono uppercase mb-1">Status</label>
              <select
                value={availStatus}
                onChange={(e) => setAvailStatus(e.target.value as AvailabilityStatus)}
                className="w-full px-3 py-2 border border-[#171717]/20"
              >
                <option value="BOOKED">Booked</option>
                <option value="LIMITED">Limited Slots</option>
                <option value="BLOCKED">Unavailable</option>
                <option value="AVAILABLE">Available</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-mono uppercase mb-1">Note (Optional)</label>
              <input
                type="text"
                maxLength={300}
                value={availNote}
                onChange={(e) => setAvailNote(e.target.value)}
                placeholder="e.g. Afternoon slot only"
                className="w-full px-3 py-2 border border-[#171717]/20"
              />
            </div>
            <button
              type="submit"
              disabled={savingAvail}
              className="w-full py-2.5 bg-[#171717] text-white text-xs font-semibold hover:bg-[#D8FF3E] hover:text-[#171717] transition-colors cursor-pointer"
            >
              {savingAvail ? 'Saving...' : 'Set Date Status'}
            </button>
          </form>

          <div className="pt-4 border-t border-[#171717]/10">
            <p className="text-xs font-mono uppercase text-[#171717]/55 mb-3">
              Scheduled Date Overrides
            </p>
            {loadingAvail ? (
              <div className="flex items-center gap-2 text-xs text-[#171717]/60">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Loading dates...
              </div>
            ) : availabilityList.length === 0 ? (
              <p className="text-xs text-[#171717]/60">No date overrides set.</p>
            ) : (
              <div className="divide-y divide-[#171717]/10 max-h-56 overflow-y-auto">
                {availabilityList.map((entry) => (
                  <div
                    key={entry.date}
                    className="py-2.5 flex items-center justify-between gap-2 text-xs"
                  >
                    <div>
                      <p className="font-mono font-semibold tabular-nums">
                        {formatDisplayDate(entry.date)}
                      </p>
                      <p className="text-[#171717]/70">
                        {AVAILABILITY_STATUS_LABELS[entry.status]}
                        {entry.note ? ` · ${entry.note}` : ''}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveAvailability(entry.date)}
                      className="p-1.5 text-[#FF5A55] hover:bg-[#FF5A55]/10 cursor-pointer"
                      title="Remove override"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
