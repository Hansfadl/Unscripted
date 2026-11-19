import React, { useEffect, useMemo, useState } from 'react';
import {
  Download,
  Edit3,
  Eye,
  Plus,
  Search,
  Trash2,
  X,
  MessageCircle,
  Loader2,
} from 'lucide-react';
import { useFirebase } from '../../context/FirebaseContext';
import { useToast } from '../../components/ToastProvider';
import { formatDisplayDate, formatIDR, normalizeWhatsapp } from '../../lib/validation';
import {
  createManualBooking,
  deleteBookingRecord,
  fetchAllBookings,
  fetchAllCustomers,
  fetchAllPackagesAdmin,
  reconcileUnlinkedBookings,
  updateBookingRecord,
} from '../../services/firestoreService';
import {
  BOOKING_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
  type BookingRecord,
  type BookingStatus,
  type PaymentStatus,
  type ServicePackage,
} from '../../types/unscripted';

const BOOKING_STATUSES: BookingStatus[] = [
  'NEW_INQUIRY',
  'CONTACTED',
  'WAITING_CONFIRMATION',
  'CONFIRMED',
  'COMPLETED',
  'CANCELLED',
];

const PAYMENT_STATUSES: PaymentStatus[] = [
  'UNPAID',
  'DP_PAID',
  'PARTIALLY_PAID',
  'FULLY_PAID',
  'REFUNDED',
];

function statusTextColor(status: BookingStatus): string {
  switch (status) {
    case 'CONFIRMED':
    case 'COMPLETED':
      return 'text-[#16A34A]';
    case 'CANCELLED':
      return 'text-[#DC2626]';
    case 'WAITING_CONFIRMATION':
    case 'CONTACTED':
      return 'text-[#D97706]';
    default:
      return 'text-[#FF5A55]';
  }
}

function paymentTextColor(status: PaymentStatus): string {
  switch (status) {
    case 'FULLY_PAID':
      return 'text-[#16A34A]';
    case 'DP_PAID':
    case 'PARTIALLY_PAID':
      return 'text-[#D97706]';
    case 'REFUNDED':
    case 'UNPAID':
      return 'text-[#DC2626]';
    default:
      return 'text-[#171717]';
  }
}

function escapeCsvCell(val: unknown): string {
  const str = String(val ?? '');
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function AdminBookingsPage() {
  const { user } = useFirebase();
  const { pushToast } = useToast();

  const [bookings, setBookings] = useState<BookingRecord[]>([]);
  const [packages, setPackages] = useState<ServicePackage[]>([]);
  const [loading, setLoading] = useState(true);

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | BookingStatus>('ALL');
  const [paymentFilter, setPaymentFilter] = useState<'ALL' | PaymentStatus>('ALL');

  const [viewingBooking, setViewingBooking] = useState<BookingRecord | null>(null);
  const [editingBooking, setEditingBooking] = useState<BookingRecord | null>(null);
  const [isCreatingManual, setIsCreatingManual] = useState(false);
  const [deletingBooking, setDeletingBooking] = useState<BookingRecord | null>(null);
  const [saving, setSaving] = useState(false);

  // Shared modal form state
  const [formCoupleName, setFormCoupleName] = useState('');
  const [formWhatsapp, setFormWhatsapp] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formEventDate, setFormEventDate] = useState('');
  const [formLocation, setFormLocation] = useState('');
  const [formEventType, setFormEventType] = useState('Akad & Resepsi');
  const [formPackageId, setFormPackageId] = useState('');
  const [formAmountPaid, setFormAmountPaid] = useState('0');
  const [formStatus, setFormStatus] = useState<BookingStatus>('NEW_INQUIRY');
  const [formPaymentStatus, setFormPaymentStatus] = useState<PaymentStatus>('UNPAID');
  const [formNotes, setFormNotes] = useState('');

  const loadBookings = async () => {
    setLoading(true);
    try {
      const [bList, cList, pkgList] = await Promise.all([
        fetchAllBookings(),
        fetchAllCustomers(),
        fetchAllPackagesAdmin(),
      ]);
      const reconciled = await reconcileUnlinkedBookings(bList, cList);
      setBookings(reconciled ? await fetchAllBookings() : bList);
      setPackages(pkgList);
    } catch (err) {
      pushToast('error', 'Failed to load bookings', err instanceof Error ? err.message : undefined);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBookings();
  }, []);

  const filteredBookings = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return bookings.filter((b) => {
      if (statusFilter !== 'ALL' && b.status !== statusFilter) return false;
      if (paymentFilter !== 'ALL' && b.paymentStatus !== paymentFilter) return false;
      if (!q) return true;
      return (
        b.bookingCode.toLowerCase().includes(q) ||
        b.coupleName.toLowerCase().includes(q) ||
        b.whatsappNumber.toLowerCase().includes(q) ||
        b.eventLocation.toLowerCase().includes(q) ||
        b.packageName.toLowerCase().includes(q)
      );
    });
  }, [bookings, searchTerm, statusFilter, paymentFilter]);

  const openCreateModal = () => {
    setIsCreatingManual(true);
    setEditingBooking(null);
    setFormCoupleName('');
    setFormWhatsapp('');
    setFormEmail('');
    setFormEventDate(new Date().toISOString().split('T')[0]);
    setFormLocation('');
    setFormEventType('Akad & Resepsi');
    setFormPackageId(packages[0]?.id || 'story');
    setFormAmountPaid('0');
    setFormStatus('CONFIRMED');
    setFormPaymentStatus('DP_PAID');
    setFormNotes('');
  };

  const openEditModal = (b: BookingRecord) => {
    setEditingBooking(b);
    setIsCreatingManual(false);
    setFormCoupleName(b.coupleName);
    setFormWhatsapp(b.whatsappNumber);
    setFormEmail(b.email || '');
    setFormEventDate(b.eventDate);
    setFormLocation(b.eventLocation);
    setFormEventType(b.eventType);
    setFormPackageId(b.packageId);
    setFormAmountPaid(String(b.amountPaid ?? 0));
    setFormStatus(b.status);
    setFormPaymentStatus(b.paymentStatus);
    setFormNotes(b.notes || '');
  };

  const closeFormModal = () => {
    setEditingBooking(null);
    setIsCreatingManual(false);
  };

  const handleSaveBookingForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const selectedPkg = packages.find((p) => p.id === formPackageId) || packages[0];
    if (!selectedPkg) {
      pushToast('error', 'No package selected', 'Create at least one package first.');
      return;
    }

    setSaving(true);
    try {
      if (isCreatingManual) {
        const code = await createManualBooking(user, {
          coupleName: formCoupleName,
          whatsappNumber: formWhatsapp,
          email: formEmail.trim() || undefined,
          eventDate: formEventDate,
          eventLocation: formLocation,
          eventType: formEventType,
          packageId: selectedPkg.id,
          packageName: selectedPkg.name,
          packagePrice: selectedPkg.price,
          amountPaid: Number(formAmountPaid) || 0,
          notes: formNotes.trim() || undefined,
          status: formStatus,
          paymentStatus: formPaymentStatus,
        });
        pushToast('success', 'Manual booking created', `Booking ID: ${code}`);
      } else if (editingBooking) {
        await updateBookingRecord(
          user,
          editingBooking.id,
          {
            coupleName: formCoupleName,
            whatsappNumber: formWhatsapp,
            email: formEmail.trim(),
            eventDate: formEventDate,
            eventLocation: formLocation,
            eventType: formEventType,
            packageId: selectedPkg.id,
            packageName: selectedPkg.name,
            packagePrice: selectedPkg.price,
            amountPaid: Number(formAmountPaid) || 0,
            status: formStatus,
            paymentStatus: formPaymentStatus,
            notes: formNotes,
          },
          `Edited booking ${editingBooking.bookingCode}`
        );
        pushToast('success', 'Booking updated', editingBooking.bookingCode);
      }
      closeFormModal();
      await loadBookings();
    } catch (err) {
      pushToast('error', 'Save failed', err instanceof Error ? err.message : undefined);
    } finally {
      setSaving(false);
    }
  };

  const handleQuickStatusUpdate = async (
    booking: BookingRecord,
    nextStatus: BookingStatus
  ) => {
    if (!user) return;
    try {
      await updateBookingRecord(
        user,
        booking.id,
        { status: nextStatus },
        `Changed ${booking.bookingCode} status to ${BOOKING_STATUS_LABELS[nextStatus]}`
      );
      setBookings((prev) =>
        prev.map((b) => (b.id === booking.id ? { ...b, status: nextStatus } : b))
      );
      if (viewingBooking?.id === booking.id) {
        setViewingBooking({ ...viewingBooking, status: nextStatus });
      }
      pushToast('success', 'Status updated', `${booking.bookingCode}: ${BOOKING_STATUS_LABELS[nextStatus]}`);
    } catch (err) {
      pushToast('error', 'Update failed', err instanceof Error ? err.message : undefined);
    }
  };

  const handleQuickPaymentUpdate = async (
    booking: BookingRecord,
    nextPayment: PaymentStatus
  ) => {
    if (!user) return;
    try {
      await updateBookingRecord(
        user,
        booking.id,
        { paymentStatus: nextPayment },
        `Changed ${booking.bookingCode} payment status to ${PAYMENT_STATUS_LABELS[nextPayment]}`
      );
      setBookings((prev) =>
        prev.map((b) => (b.id === booking.id ? { ...b, paymentStatus: nextPayment } : b))
      );
      if (viewingBooking?.id === booking.id) {
        setViewingBooking({ ...viewingBooking, paymentStatus: nextPayment });
      }
      pushToast(
        'success',
        'Payment status updated',
        `${booking.bookingCode}: ${PAYMENT_STATUS_LABELS[nextPayment]}`
      );
    } catch (err) {
      pushToast('error', 'Update failed', err instanceof Error ? err.message : undefined);
    }
  };

  const handleConfirmDelete = async () => {
    if (!user || !deletingBooking) return;
    setSaving(true);
    try {
      await deleteBookingRecord(user, deletingBooking.id);
      setBookings((prev) => prev.filter((b) => b.id !== deletingBooking.id));
      pushToast('success', 'Booking deleted', deletingBooking.bookingCode);
      setDeletingBooking(null);
      if (viewingBooking?.id === deletingBooking.id) setViewingBooking(null);
    } catch (err) {
      pushToast('error', 'Delete failed', err instanceof Error ? err.message : undefined);
    } finally {
      setSaving(false);
    }
  };

  const handleExportCsv = () => {
    const headers = [
      'Booking ID',
      'Couple Name',
      'WhatsApp',
      'Email',
      'Event Date',
      'Location',
      'Event Type',
      'Package',
      'Package Price (IDR)',
      'Amount Paid (IDR)',
      'Booking Status',
      'Payment Status',
      'Source',
      'Notes',
    ];
    const rows = filteredBookings.map((b) => [
      b.bookingCode,
      b.coupleName,
      b.whatsappNumber,
      b.email || '',
      b.eventDate,
      b.eventLocation,
      b.eventType,
      b.packageName,
      b.packagePrice,
      b.amountPaid ?? 0,
      BOOKING_STATUS_LABELS[b.status],
      PAYMENT_STATUS_LABELS[b.paymentStatus],
      b.source,
      b.notes || '',
    ]);
    const csv = [headers, ...rows]
      .map((row) => row.map(escapeCsvCell).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `unscripted-bookings-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    pushToast('success', 'CSV exported', `${filteredBookings.length} booking rows downloaded.`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight">
            Booking Management
          </h1>
          <p className="mt-1 text-sm text-[#171717]/65">
            Track inquiries, update booking & payment states independently, and export records.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={filteredBookings.length === 0}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-[#171717]/20 text-xs font-semibold hover:border-[#171717] disabled:opacity-45 transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </button>
          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#171717] text-white text-xs font-semibold hover:bg-[#D8FF3E] hover:text-[#171717] transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            Manual Booking
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border border-[#171717]/12 p-4 grid grid-cols-1 md:grid-cols-12 gap-3">
        <div className="md:col-span-6 relative">
          <Search className="w-4 h-4 text-[#171717]/45 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search Booking ID, couple name, WhatsApp, or location..."
            className="w-full pl-9 pr-3 py-2 bg-[#F7F6F2] border border-[#171717]/15 text-sm focus:outline-none focus:border-[#171717]"
          />
        </div>
        <div className="md:col-span-3">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'ALL' | BookingStatus)}
            className="w-full px-3 py-2 bg-[#F7F6F2] border border-[#171717]/15 text-sm focus:outline-none focus:border-[#171717]"
          >
            <option value="ALL">All Booking Statuses</option>
            {BOOKING_STATUSES.map((st) => (
              <option key={st} value={st}>
                {BOOKING_STATUS_LABELS[st]}
              </option>
            ))}
          </select>
        </div>
        <div className="md:col-span-3">
          <select
            value={paymentFilter}
            onChange={(e) => setPaymentFilter(e.target.value as 'ALL' | PaymentStatus)}
            className="w-full px-3 py-2 bg-[#F7F6F2] border border-[#171717]/15 text-sm focus:outline-none focus:border-[#171717]"
          >
            <option value="ALL">All Payment Statuses</option>
            {PAYMENT_STATUSES.map((ps) => (
              <option key={ps} value={ps}>
                {PAYMENT_STATUS_LABELS[ps]}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-[#171717]/12 overflow-x-auto">
        {loading ? (
          <div className="p-10 flex items-center justify-center gap-2 text-sm text-[#171717]/60">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading bookings...
          </div>
        ) : filteredBookings.length === 0 ? (
          <div className="p-12 text-center">
            <p className="font-display text-lg font-bold">No matching bookings found.</p>
            <p className="mt-1 text-xs text-[#171717]/60">
              Try clearing your filters or add a manual booking.
            </p>
          </div>
        ) : (
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-[#171717]/12 bg-[#F7F6F2] text-xs font-mono uppercase text-[#171717]/60">
                <th className="py-3 px-4">Booking ID</th>
                <th className="py-3 px-4">Couple & Contact</th>
                <th className="py-3 px-4">Event</th>
                <th className="py-3 px-4">Package</th>
                <th className="py-3 px-4">Booking Status</th>
                <th className="py-3 px-4">Payment Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#171717]/10">
              {filteredBookings.map((b) => (
                <tr key={b.id} className="hover:bg-[#F5F1E9]/35">
                  <td className="py-3.5 px-4 font-mono text-xs font-semibold tabular-nums whitespace-nowrap">
                    {b.bookingCode}
                  </td>
                  <td className="py-3.5 px-4">
                    <p className="font-semibold text-[#171717]">{b.coupleName}</p>
                    <p className="text-xs font-mono text-[#171717]/60">{b.whatsappNumber}</p>
                  </td>
                  <td className="py-3.5 px-4">
                    <p className="font-mono text-xs tabular-nums">
                      {formatDisplayDate(b.eventDate)}
                    </p>
                    <p className="text-xs text-[#171717]/65">
                      {b.eventLocation} · {b.eventType}
                    </p>
                  </td>
                  <td className="py-3.5 px-4 whitespace-nowrap">
                    <p className="font-semibold text-xs">{b.packageName}</p>
                    <p className="text-xs font-mono tabular-nums text-[#171717]/65">
                      {formatIDR(b.packagePrice)}
                    </p>
                  </td>
                  <td className="py-3.5 px-4">
                    <select
                      aria-label={`Booking status for ${b.coupleName}`}
                      value={b.status}
                      onChange={(e) =>
                        handleQuickStatusUpdate(b, e.target.value as BookingStatus)
                      }
                      className={`text-xs font-semibold bg-transparent border border-[#171717]/15 px-2 py-1 focus:outline-none focus:border-[#171717] cursor-pointer ${statusTextColor(
                        b.status
                      )}`}
                    >
                      {BOOKING_STATUSES.map((st) => (
                        <option key={st} value={st} className="text-[#171717]">
                          {BOOKING_STATUS_LABELS[st]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="py-3.5 px-4">
                    <select
                      aria-label={`Payment status for ${b.coupleName}`}
                      value={b.paymentStatus}
                      onChange={(e) =>
                        handleQuickPaymentUpdate(b, e.target.value as PaymentStatus)
                      }
                      className={`text-xs font-semibold bg-transparent border border-[#171717]/15 px-2 py-1 focus:outline-none focus:border-[#171717] cursor-pointer ${paymentTextColor(
                        b.paymentStatus
                      )}`}
                    >
                      {PAYMENT_STATUSES.map((ps) => (
                        <option key={ps} value={ps} className="text-[#171717]">
                          {PAYMENT_STATUS_LABELS[ps]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="py-3.5 px-4 text-right whitespace-nowrap">
                    <div className="inline-flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setViewingBooking(b)}
                        className="p-2 text-[#171717]/70 hover:text-[#171717] hover:bg-[#F5F1E9] cursor-pointer"
                        title="View details"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => openEditModal(b)}
                        className="p-2 text-[#171717]/70 hover:text-[#171717] hover:bg-[#F5F1E9] cursor-pointer"
                        title="Edit booking"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeletingBooking(b)}
                        className="p-2 text-[#171717]/70 hover:text-[#FF5A55] hover:bg-[#FF5A55]/10 cursor-pointer"
                        title="Delete booking"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* View Booking Details Modal */}
      {viewingBooking && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white border border-[#171717] max-w-lg w-full p-6 sm:p-8 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-4 pb-4 border-b border-[#171717]/12">
              <div>
                <p className="font-mono text-xs text-[#FF5A55] font-semibold">
                  {viewingBooking.bookingCode}
                </p>
                <h2 className="font-display text-2xl font-bold mt-1">
                  {viewingBooking.coupleName}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setViewingBooking(null)}
                className="p-1.5 hover:bg-[#F5F1E9] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-5 space-y-3 text-sm">
              <div className="flex justify-between gap-4">
                <span className="text-[#171717]/60">WhatsApp</span>
                <span className="font-mono">{viewingBooking.whatsappNumber}</span>
              </div>
              {viewingBooking.email && (
                <div className="flex justify-between gap-4">
                  <span className="text-[#171717]/60">Email</span>
                  <span>{viewingBooking.email}</span>
                </div>
              )}
              <div className="flex justify-between gap-4">
                <span className="text-[#171717]/60">Event Date</span>
                <span className="font-mono tabular-nums">{viewingBooking.eventDate}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-[#171717]/60">Location</span>
                <span>{viewingBooking.eventLocation}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-[#171717]/60">Event Type</span>
                <span>{viewingBooking.eventType}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-[#171717]/60">Package</span>
                <span className="font-semibold tabular-nums">
                  {viewingBooking.packageName} ({formatIDR(viewingBooking.packagePrice)})
                </span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-[#171717]/60">Amount Paid</span>
                <span className="font-mono tabular-nums">
                  {formatIDR(viewingBooking.amountPaid ?? 0)}
                </span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-[#171717]/60">Booking Status</span>
                <span className={`font-semibold ${statusTextColor(viewingBooking.status)}`}>
                  {BOOKING_STATUS_LABELS[viewingBooking.status]}
                </span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-[#171717]/60">Payment Status</span>
                <span
                  className={`font-semibold ${paymentTextColor(viewingBooking.paymentStatus)}`}
                >
                  {PAYMENT_STATUS_LABELS[viewingBooking.paymentStatus]}
                </span>
              </div>
              {viewingBooking.notes && (
                <div className="pt-3 border-t border-[#171717]/10">
                  <p className="text-xs font-mono uppercase text-[#171717]/55 mb-1">Notes</p>
                  <p className="text-sm text-[#171717]/80 whitespace-pre-wrap">
                    {viewingBooking.notes}
                  </p>
                </div>
              )}
            </div>

            <div className="mt-6 pt-4 border-t border-[#171717]/12 flex flex-wrap gap-3">
              <a
                href={`https://wa.me/${normalizeWhatsapp(viewingBooking.whatsappNumber)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-[#D8FF3E] text-[#171717] text-xs font-bold border border-[#171717]"
              >
                <MessageCircle className="w-4 h-4" />
                Message Customer
              </a>
              <button
                type="button"
                onClick={() => {
                  const target = viewingBooking;
                  setViewingBooking(null);
                  openEditModal(target);
                }}
                className="px-4 py-2.5 bg-[#171717] text-white text-xs font-semibold cursor-pointer"
              >
                Edit Record
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create / Edit Booking Modal */}
      {(isCreatingManual || editingBooking) && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white border border-[#171717] max-w-2xl w-full p-6 sm:p-8 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-[#171717]/12">
              <h2 className="font-display text-xl font-bold">
                {isCreatingManual
                  ? 'Create Manual Booking'
                  : `Edit Booking ${editingBooking?.bookingCode}`}
              </h2>
              <button
                type="button"
                onClick={closeFormModal}
                className="p-1.5 hover:bg-[#F5F1E9] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveBookingForm} className="mt-5 space-y-4 text-sm">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-mono uppercase mb-1">Couple Name *</label>
                  <input
                    type="text"
                    required
                    value={formCoupleName}
                    onChange={(e) => setFormCoupleName(e.target.value)}
                    className="w-full px-3 py-2 border border-[#171717]/20 focus:border-[#171717] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-mono uppercase mb-1">
                    WhatsApp Number *
                  </label>
                  <input
                    type="tel"
                    required
                    value={formWhatsapp}
                    onChange={(e) => setFormWhatsapp(e.target.value)}
                    className="w-full px-3 py-2 border border-[#171717]/20 focus:border-[#171717] focus:outline-none font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-mono uppercase mb-1">Email</label>
                  <input
                    type="email"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    className="w-full px-3 py-2 border border-[#171717]/20 focus:border-[#171717] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-mono uppercase mb-1">Event Date *</label>
                  <input
                    type="date"
                    required
                    value={formEventDate}
                    onChange={(e) => setFormEventDate(e.target.value)}
                    className="w-full px-3 py-2 border border-[#171717]/20 focus:border-[#171717] focus:outline-none font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-mono uppercase mb-1">
                    Event Location *
                  </label>
                  <input
                    type="text"
                    required
                    value={formLocation}
                    onChange={(e) => setFormLocation(e.target.value)}
                    className="w-full px-3 py-2 border border-[#171717]/20 focus:border-[#171717] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-mono uppercase mb-1">Event Type *</label>
                  <input
                    type="text"
                    required
                    value={formEventType}
                    onChange={(e) => setFormEventType(e.target.value)}
                    className="w-full px-3 py-2 border border-[#171717]/20 focus:border-[#171717] focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-mono uppercase mb-1">Package *</label>
                  <select
                    value={formPackageId}
                    onChange={(e) => setFormPackageId(e.target.value)}
                    className="w-full px-3 py-2 border border-[#171717]/20 focus:border-[#171717] focus:outline-none"
                  >
                    {packages.map((pkg) => (
                      <option key={pkg.id} value={pkg.id}>
                        {pkg.name} ({formatIDR(pkg.price)})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-mono uppercase mb-1">
                    Amount Paid (IDR)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={formAmountPaid}
                    onChange={(e) => setFormAmountPaid(e.target.value)}
                    className="w-full px-3 py-2 border border-[#171717]/20 focus:border-[#171717] focus:outline-none font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-mono uppercase mb-1">
                    Booking Status
                  </label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as BookingStatus)}
                    className="w-full px-3 py-2 border border-[#171717]/20 focus:border-[#171717] focus:outline-none"
                  >
                    {BOOKING_STATUSES.map((st) => (
                      <option key={st} value={st}>
                        {BOOKING_STATUS_LABELS[st]}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-mono uppercase mb-1">
                    Payment Status
                  </label>
                  <select
                    value={formPaymentStatus}
                    onChange={(e) => setFormPaymentStatus(e.target.value as PaymentStatus)}
                    className="w-full px-3 py-2 border border-[#171717]/20 focus:border-[#171717] focus:outline-none"
                  >
                    {PAYMENT_STATUSES.map((ps) => (
                      <option key={ps} value={ps}>
                        {PAYMENT_STATUS_LABELS[ps]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-mono uppercase mb-1">Notes</label>
                <textarea
                  rows={3}
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-[#171717]/20 focus:border-[#171717] focus:outline-none"
                />
              </div>

              <div className="pt-4 border-t border-[#171717]/12 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={closeFormModal}
                  className="px-4 py-2.5 border border-[#171717]/20 text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2.5 bg-[#171717] text-white text-xs font-semibold hover:bg-[#D8FF3E] hover:text-[#171717] disabled:opacity-50 cursor-pointer"
                >
                  {saving ? 'Saving...' : 'Save Booking'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingBooking && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white border border-[#171717] max-w-md w-full p-6">
            <h2 className="font-display text-xl font-bold text-[#171717]">
              Delete Booking {deletingBooking.bookingCode}?
            </h2>
            <p className="mt-2 text-sm text-[#171717]/75">
              This will permanently remove the booking for{' '}
              <strong>{deletingBooking.coupleName}</strong> on {deletingBooking.eventDate}.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeletingBooking(null)}
                className="px-4 py-2 border border-[#171717]/20 text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={saving}
                className="px-4 py-2 bg-[#FF5A55] text-white text-xs font-semibold hover:bg-[#DC2626] disabled:opacity-50 cursor-pointer"
              >
                {saving ? 'Deleting...' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
