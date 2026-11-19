import { useEffect, useMemo, useState } from 'react';
import { Loader2, MessageCircle, Search, Save } from 'lucide-react';
import { useFirebase } from '../../context/FirebaseContext';
import { useToast } from '../../components/ToastProvider';
import { formatDisplayDate, formatIDR, normalizeWhatsapp } from '../../lib/validation';
import {
  fetchAllBookings,
  fetchAllCustomers,
  reconcileUnlinkedBookings,
  updateCustomerRecord,
} from '../../services/firestoreService';
import {
  BOOKING_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
  type BookingRecord,
  type CustomerRecord,
} from '../../types/unscripted';

export function AdminCustomersPage() {
  const { user } = useFirebase();
  const { pushToast } = useToast();

  const [customers, setCustomers] = useState<CustomerRecord[]>([]);
  const [bookings, setBookings] = useState<BookingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [notesDraft, setNotesDraft] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [bList, cList] = await Promise.all([fetchAllBookings(), fetchAllCustomers()]);
      const reconciled = await reconcileUnlinkedBookings(bList, cList);
      const [finalCustomers, finalBookings] = reconciled
        ? await Promise.all([fetchAllCustomers(), fetchAllBookings()])
        : [cList, bList];
      setCustomers(finalCustomers);
      setBookings(finalBookings);
      if (!selectedId && finalCustomers.length > 0) {
        setSelectedId(finalCustomers[0].id);
        setNotesDraft(finalCustomers[0].notes || '');
      }
    } catch (err) {
      pushToast('error', 'Failed to load customers', err instanceof Error ? err.message : undefined);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredCustomers = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter(
      (c) =>
        c.coupleName.toLowerCase().includes(q) ||
        c.whatsappNumber.toLowerCase().includes(q) ||
        (c.email && c.email.toLowerCase().includes(q))
    );
  }, [customers, searchTerm]);

  const selectedCustomer = useMemo(
    () => customers.find((c) => c.id === selectedId) || null,
    [customers, selectedId]
  );

  const customerBookings = useMemo(() => {
    if (!selectedCustomer) return [];
    return bookings.filter(
      (b) =>
        b.customerId === selectedCustomer.id ||
        b.normalizedWhatsapp === selectedCustomer.normalizedWhatsapp
    );
  }, [bookings, selectedCustomer]);

  const handleSelectCustomer = (c: CustomerRecord) => {
    setSelectedId(c.id);
    setNotesDraft(c.notes || '');
  };

  const handleSaveNotes = async () => {
    if (!user || !selectedCustomer) return;
    setSavingNotes(true);
    try {
      await updateCustomerRecord(user, selectedCustomer.id, { notes: notesDraft });
      setCustomers((prev) =>
        prev.map((c) => (c.id === selectedCustomer.id ? { ...c, notes: notesDraft } : c))
      );
      pushToast('success', 'Customer notes saved', selectedCustomer.coupleName);
    } catch (err) {
      pushToast('error', 'Save failed', err instanceof Error ? err.message : undefined);
    } finally {
      setSavingNotes(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight">
          Customer Directory
        </h1>
        <p className="mt-1 text-sm text-[#171717]/65">
          Deduplicated client profiles grouped by WhatsApp number, with complete booking history and internal notes.
        </p>
      </div>

      <div className="bg-white border border-[#171717]/12 p-4">
        <div className="relative max-w-md">
          <Search className="w-4 h-4 text-[#171717]/45 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search couple name, WhatsApp, or email..."
            className="w-full pl-9 pr-3 py-2 bg-[#F7F6F2] border border-[#171717]/15 text-sm focus:outline-none focus:border-[#171717]"
          />
        </div>
      </div>

      {loading ? (
        <div className="p-12 bg-white border border-[#171717]/12 flex items-center justify-center gap-2 text-sm">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading customer directory...
        </div>
      ) : filteredCustomers.length === 0 ? (
        <div className="p-12 bg-white border border-[#171717]/12 text-center">
          <p className="font-display text-lg font-bold">No customer records yet.</p>
          <p className="mt-1 text-xs text-[#171717]/60">
            Customers appear automatically when inquiries or manual bookings are created.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Directory list */}
          <div className="lg:col-span-5 bg-white border border-[#171717]/12 divide-y divide-[#171717]/10">
            {filteredCustomers.map((c) => {
              const active = c.id === selectedCustomer?.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => handleSelectCustomer(c)}
                  className={`w-full text-left p-4 transition-colors cursor-pointer ${
                    active ? 'bg-[#171717] text-white' : 'hover:bg-[#F5F1E9]/50'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold text-sm">{c.coupleName}</p>
                    <span
                      className={`text-xs font-mono tabular-nums ${
                        active ? 'text-[#D8FF3E]' : 'text-[#171717]/60'
                      }`}
                    >
                      {c.totalBookings} booking{c.totalBookings === 1 ? '' : 's'}
                    </span>
                  </div>
                  <p
                    className={`mt-1 text-xs font-mono ${
                      active ? 'text-white/75' : 'text-[#171717]/60'
                    }`}
                  >
                    {c.whatsappNumber}
                  </p>
                </button>
              );
            })}
          </div>

          {/* Customer Detail */}
          <div className="lg:col-span-7 bg-white border border-[#171717]/12 p-6 space-y-6">
            {selectedCustomer ? (
              <>
                <div className="flex flex-wrap items-start justify-between gap-4 pb-5 border-b border-[#171717]/12">
                  <div>
                    <h2 className="font-display text-2xl font-bold">
                      {selectedCustomer.coupleName}
                    </h2>
                    <p className="mt-1 text-sm font-mono text-[#171717]/70">
                      {selectedCustomer.whatsappNumber}
                      {selectedCustomer.email ? ` · ${selectedCustomer.email}` : ''}
                    </p>
                  </div>
                  <a
                    href={`https://wa.me/${normalizeWhatsapp(selectedCustomer.whatsappNumber)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-[#D8FF3E] text-[#171717] border border-[#171717] text-xs font-bold"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    WhatsApp
                  </a>
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-xs font-mono uppercase text-[#171717]/60 mb-2">
                    Internal Customer Notes
                  </label>
                  <textarea
                    rows={3}
                    value={notesDraft}
                    onChange={(e) => setNotesDraft(e.target.value)}
                    placeholder="Preferences, venue notes, follow-up reminders..."
                    className="w-full px-3 py-2 bg-[#F7F6F2] border border-[#171717]/15 text-sm focus:outline-none focus:border-[#171717]"
                  />
                  <button
                    type="button"
                    onClick={handleSaveNotes}
                    disabled={savingNotes}
                    className="mt-2 inline-flex items-center gap-2 px-4 py-2 bg-[#171717] text-white text-xs font-semibold hover:bg-[#D8FF3E] hover:text-[#171717] disabled:opacity-50 transition-colors cursor-pointer"
                  >
                    <Save className="w-3.5 h-3.5" />
                    {savingNotes ? 'Saving...' : 'Save Notes'}
                  </button>
                </div>

                {/* Booking History */}
                <div className="pt-4 border-t border-[#171717]/12">
                  <h3 className="font-display text-base font-bold mb-3">
                    Booking History ({customerBookings.length})
                  </h3>
                  {customerBookings.length === 0 ? (
                    <p className="text-xs text-[#171717]/60">No linked bookings.</p>
                  ) : (
                    <div className="space-y-3">
                      {customerBookings.map((b) => (
                        <div
                          key={b.id}
                          className="p-4 bg-[#F7F6F2] border border-[#171717]/10 flex flex-wrap items-center justify-between gap-3 text-xs"
                        >
                          <div>
                            <p className="font-mono font-semibold">{b.bookingCode}</p>
                            <p className="mt-1 text-[#171717]/75">
                              {formatDisplayDate(b.eventDate)} · {b.eventLocation} · {b.packageName}
                            </p>
                          </div>
                          <div className="text-right font-mono">
                            <p className="font-semibold">{BOOKING_STATUS_LABELS[b.status]}</p>
                            <p className="text-[#171717]/65 mt-0.5">
                              {PAYMENT_STATUS_LABELS[b.paymentStatus]} · {formatIDR(b.packagePrice)}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
