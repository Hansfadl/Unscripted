import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, RefreshCw } from 'lucide-react';
import { formatDisplayDate, formatIDR } from '../../lib/validation';
import {
  fetchAllBookings,
  fetchAllCustomers,
  fetchRecentActivityLogs,
  reconcileUnlinkedBookings,
} from '../../services/firestoreService';
import {
  BOOKING_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
  type ActivityLog,
  type BookingRecord,
} from '../../types/unscripted';

export function AdminDashboardPage() {
  const [bookings, setBookings] = useState<BookingRecord[]>([]);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [bList, cList, logList] = await Promise.all([
        fetchAllBookings(),
        fetchAllCustomers(),
        fetchRecentActivityLogs(),
      ]);
      const reconciled = await reconcileUnlinkedBookings(bList, cList);
      const finalBookings = reconciled ? await fetchAllBookings() : bList;
      setBookings(finalBookings);
      setLogs(logList);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load dashboard metrics.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const today = new Date().toISOString().split('T')[0];

  const metrics = useMemo(() => {
    const totalBookings = bookings.length;
    const upcomingConfirmed = bookings.filter(
      (b) => b.status === 'CONFIRMED' && b.eventDate >= today
    ).length;
    const pendingInquiries = bookings.filter((b) =>
      ['NEW_INQUIRY', 'CONTACTED', 'WAITING_CONFIRMATION'].includes(b.status)
    ).length;
    const recordedRevenue = bookings.reduce((sum, b) => {
      if (b.paymentStatus === 'REFUNDED' || b.status === 'CANCELLED') return sum;
      if (typeof b.amountPaid === 'number' && b.amountPaid > 0) {
        return sum + b.amountPaid;
      }
      if (b.paymentStatus === 'FULLY_PAID') {
        return sum + (b.packagePrice || 0);
      }
      return sum;
    }, 0);

    return {
      totalBookings,
      upcomingConfirmed,
      pendingInquiries,
      recordedRevenue,
    };
  }, [bookings, today]);

  const upcomingEvents = useMemo(
    () =>
      bookings
        .filter((b) => b.status === 'CONFIRMED' && b.eventDate >= today)
        .sort((a, b) => a.eventDate.localeCompare(b.eventDate))
        .slice(0, 6),
    [bookings, today]
  );

  const pendingList = useMemo(
    () =>
      bookings
        .filter((b) => ['NEW_INQUIRY', 'CONTACTED', 'WAITING_CONFIRMATION'].includes(b.status))
        .slice(0, 5),
    [bookings]
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight">
            Dashboard Overview
          </h1>
          <p className="mt-1 text-sm text-[#171717]/65">
            Live metrics computed directly from your Firestore records.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-[#171717]/20 text-xs font-semibold hover:border-[#171717] transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <Link
            to="/admin/bookings"
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#171717] text-white text-xs font-semibold hover:bg-[#D8FF3E] hover:text-[#171717] transition-colors"
          >
            Manage Bookings
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-[#FF5A55]/10 border border-[#FF5A55] text-sm">{error}</div>
      )}

      {/* KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-[#171717]/12 p-5">
          <p className="text-xs font-mono uppercase tracking-wider text-[#171717]/55">
            Total Bookings
          </p>
          <p className="mt-2 font-mono text-3xl font-bold tabular-nums">
            {loading ? '—' : metrics.totalBookings}
          </p>
        </div>
        <div className="bg-white border border-[#171717]/12 p-5">
          <p className="text-xs font-mono uppercase tracking-wider text-[#171717]/55">
            Upcoming Confirmed
          </p>
          <p className="mt-2 font-mono text-3xl font-bold tabular-nums text-[#16A34A]">
            {loading ? '—' : metrics.upcomingConfirmed}
          </p>
        </div>
        <div className="bg-white border border-[#171717]/12 p-5">
          <p className="text-xs font-mono uppercase tracking-wider text-[#171717]/55">
            Pending Inquiries
          </p>
          <p className="mt-2 font-mono text-3xl font-bold tabular-nums text-[#D97706]">
            {loading ? '—' : metrics.pendingInquiries}
          </p>
        </div>
        <div className="bg-[#171717] text-white p-5">
          <p className="text-xs font-mono uppercase tracking-wider text-white/60">
            Recorded Revenue
          </p>
          <p className="mt-2 font-mono text-2xl font-bold tabular-nums text-[#D8FF3E]">
            {loading ? '—' : formatIDR(metrics.recordedRevenue)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Upcoming Confirmed Events */}
        <div className="lg:col-span-7 bg-white border border-[#171717]/12">
          <div className="px-5 py-4 border-b border-[#171717]/12 flex items-center justify-between">
            <h2 className="font-display text-lg font-bold">Upcoming Confirmed Events</h2>
            <Link to="/admin/bookings" className="text-xs font-semibold hover:underline">
              View All
            </Link>
          </div>
          {loading ? (
            <div className="p-6 text-sm text-[#171717]/60">Loading schedule...</div>
          ) : upcomingEvents.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-sm font-medium text-[#171717]/75">
                No upcoming confirmed events yet.
              </p>
              <p className="mt-1 text-xs text-[#171717]/55">
                Confirm a pending inquiry or create a manual booking to populate your calendar.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-[#171717]/10 text-xs font-mono uppercase text-[#171717]/55">
                    <th className="py-3 px-5">Date</th>
                    <th className="py-3 px-5">Couple</th>
                    <th className="py-3 px-5">Package</th>
                    <th className="py-3 px-5">Payment</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#171717]/8">
                  {upcomingEvents.map((b) => (
                    <tr key={b.id} className="hover:bg-[#F5F1E9]/40">
                      <td className="py-3 px-5 font-mono text-xs tabular-nums whitespace-nowrap">
                        {formatDisplayDate(b.eventDate)}
                      </td>
                      <td className="py-3 px-5">
                        <p className="font-semibold">{b.coupleName}</p>
                        <p className="text-xs text-[#171717]/60">{b.eventLocation}</p>
                      </td>
                      <td className="py-3 px-5 text-xs">{b.packageName}</td>
                      <td className="py-3 px-5 text-xs font-mono">
                        {PAYMENT_STATUS_LABELS[b.paymentStatus]}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pending Inquiries & Recent Activities */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white border border-[#171717]/12">
            <div className="px-5 py-4 border-b border-[#171717]/12 flex items-center justify-between">
              <h2 className="font-display text-lg font-bold">Pending Inquiries</h2>
              <span className="font-mono text-xs tabular-nums text-[#171717]/60">
                {pendingList.length} shown
              </span>
            </div>
            {pendingList.length === 0 ? (
              <div className="p-6 text-xs text-[#171717]/60">No pending inquiries right now.</div>
            ) : (
              <div className="divide-y divide-[#171717]/8">
                {pendingList.map((b) => (
                  <div key={b.id} className="px-5 py-3.5 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate">{b.coupleName}</p>
                      <p className="text-xs text-[#171717]/60 font-mono truncate">
                        {b.bookingCode} · {b.eventDate} · {b.packageName}
                      </p>
                    </div>
                    <span className="text-xs font-mono text-[#D97706] shrink-0">
                      {BOOKING_STATUS_LABELS[b.status]}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white border border-[#171717]/12">
            <div className="px-5 py-4 border-b border-[#171717]/12">
              <h2 className="font-display text-lg font-bold">Recent Activity</h2>
            </div>
            {logs.length === 0 ? (
              <div className="p-6 text-xs text-[#171717]/60">No activity logs recorded yet.</div>
            ) : (
              <div className="divide-y divide-[#171717]/8 max-h-72 overflow-y-auto">
                {logs.slice(0, 10).map((log) => (
                  <div key={log.id} className="px-5 py-3 text-xs">
                    <p className="font-medium text-[#171717]">{log.summary}</p>
                    <p className="mt-1 font-mono text-[11px] text-[#171717]/55">
                      {log.entityType} · {log.actorEmail}
                    </p>
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
