import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Download,
  Edit3,
  Eye,
  FileText,
  Landmark,
  Loader2,
  Lock,
  MessageCircle,
  Plus,
  Search,
  Trash2,
  Wallet,
  X,
} from 'lucide-react';
import { useFirebase } from '../../context/FirebaseContext';
import { useToast } from '../../components/ToastProvider';
import { InvoicePreviewA4 } from '../../components/InvoicePreviewA4';
import { DEFAULT_INVOICE_SETTINGS } from '../../data/defaults';
import { downloadInvoicePdf } from '../../lib/invoicePdf';
import {
  buildWhatsappInvoiceUrl,
  formatDisplayDate,
  formatRp,
  normalizeWhatsapp,
  PATTERNS,
} from '../../lib/validation';
import {
  calculateInvoiceFinancials,
  createInvoiceFromBooking,
  deleteDraftInvoice,
  fetchAllBookings,
  fetchAllPackagesAdmin,
  fetchInvoiceSettings,
  recordInvoicePayment,
  resolveLatestPackageForBooking,
  saveInvoiceSettings,
  subscribeAllInvoicesAdmin,
  updateDraftInvoice,
  updateInvoiceStatusAndNotes,
} from '../../services/firestoreService';
import {
  INVOICE_LIFECYCLE_LABELS,
  INVOICE_PAYMENT_STATUS_LABELS,
  type BookingRecord,
  type InvoiceDpMode,
  type InvoiceLifecycleStatus,
  type InvoiceLineItem,
  type InvoicePaymentStatus,
  type InvoiceRecord,
  type InvoiceSettings,
  type ServicePackage,
} from '../../types/unscripted';

const PAYMENT_FILTER_OPTIONS: Array<'ALL' | InvoicePaymentStatus> = [
  'ALL',
  'UNPAID',
  'PARTIALLY_PAID',
  'PAID',
  'OVERDUE',
];

function todayIso(): string {
  return new Date().toISOString().split('T')[0];
}

function addDaysIso(baseIso: string, days: number): string {
  const [y, m, d] = baseIso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, (m || 1) - 1, (d || 1) + days));
  return dt.toISOString().split('T')[0];
}

function paymentStatusTextColor(status: InvoicePaymentStatus): string {
  switch (status) {
    case 'PAID':
      return 'text-[#16A34A]';
    case 'PARTIALLY_PAID':
      return 'text-[#D97706]';
    case 'OVERDUE':
      return 'text-[#DC2626]';
    default:
      return 'text-[#171717]';
  }
}

export function AdminInvoicesPage() {
  const { user } = useFirebase();
  const { pushToast } = useToast();

  const [invoices, setInvoices] = useState<InvoiceRecord[]>([]);
  const [bookings, setBookings] = useState<BookingRecord[]>([]);
  const [packages, setPackages] = useState<ServicePackage[]>([]);
  const [invoiceSettings, setInvoiceSettings] = useState<InvoiceSettings>({
    ...DEFAULT_INVOICE_SETTINGS,
  });
  const [loading, setLoading] = useState(true);

  const [searchTerm, setSearchTerm] = useState('');
  const [paymentFilter, setPaymentFilter] = useState<'ALL' | InvoicePaymentStatus>('ALL');
  const [lifecycleFilter, setLifecycleFilter] = useState<'ALL' | InvoiceLifecycleStatus>('ALL');

  // Modals
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingDraft, setEditingDraft] = useState<InvoiceRecord | null>(null);
  const [previewInvoice, setPreviewInvoice] = useState<InvoiceRecord | null>(null);
  const [paymentModalInvoice, setPaymentModalInvoice] = useState<InvoiceRecord | null>(null);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [deletingDraft, setDeletingDraft] = useState<InvoiceRecord | null>(null);
  const [voidingInvoice, setVoidingInvoice] = useState<InvoiceRecord | null>(null);
  const [saving, setSaving] = useState(false);

  // Create/Edit Invoice Form State
  const [selectedBookingId, setSelectedBookingId] = useState('');
  const [bookingSearch, setBookingSearch] = useState('');
  const [allowDuplicate, setAllowDuplicate] = useState(false);

  const [formIssueDate, setFormIssueDate] = useState(todayIso());
  const [formDueDate, setFormDueDate] = useState(addDaysIso(todayIso(), 7));
  const [formClientName, setFormClientName] = useState('');
  const [formClientWhatsapp, setFormClientWhatsapp] = useState('');
  const [formClientEmail, setFormClientEmail] = useState('');
  const [formWeddingDate, setFormWeddingDate] = useState('');
  const [formEventLocation, setFormEventLocation] = useState('');
  const [formEventType, setFormEventType] = useState('');
  const [formPackageId, setFormPackageId] = useState('');
  const [formAdditionalItems, setFormAdditionalItems] = useState<InvoiceLineItem[]>([]);
  const [formTransportationFee, setFormTransportationFee] = useState('0');
  const [formOvertimeFee, setFormOvertimeFee] = useState('0');
  const [formDiscount, setFormDiscount] = useState('0');
  const [formDpMode, setFormDpMode] = useState<InvoiceDpMode>('PERCENT_30');
  const [formCustomDpPercent, setFormCustomDpPercent] = useState('40');
  const [formCustomDpAmount, setFormCustomDpAmount] = useState('0');
  const [formBankName, setFormBankName] = useState('');
  const [formBankAccountNumber, setFormBankAccountNumber] = useState('');
  const [formBankAccountHolder, setFormBankAccountHolder] = useState('');
  const [formPaymentInstructions, setFormPaymentInstructions] = useState('');
  const [formThankYouMessage, setFormThankYouMessage] = useState('');
  const [formNotes, setFormNotes] = useState('');

  // Record Payment Modal State
  const [payDate, setPayDate] = useState(todayIso());
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('Bank Transfer BCA');
  const [payNote, setPayNote] = useState('');
  const [overridePaymentStatus, setOverridePaymentStatus] = useState<InvoicePaymentStatus>('UNPAID');
  const [editFinalizedNotes, setEditFinalizedNotes] = useState('');

  // Bank Settings Modal State
  const [cfgBankName, setCfgBankName] = useState('');
  const [cfgBankAccNo, setCfgBankAccNo] = useState('');
  const [cfgBankHolder, setCfgBankHolder] = useState('');
  const [cfgInstructions, setCfgInstructions] = useState('');
  const [cfgThankYou, setCfgThankYou] = useState('');
  const [cfgDueDays, setCfgDueDays] = useState('7');
  const [cfgDefaultDpMode, setCfgDefaultDpMode] = useState<'PERCENT_30' | 'PERCENT_50'>('PERCENT_30');

  useEffect(() => {
    let active = true;
    const loadStaticRefs = async () => {
      try {
        const [bList, pList, cfg] = await Promise.all([
          fetchAllBookings(),
          fetchAllPackagesAdmin(),
          fetchInvoiceSettings(),
        ]);
        if (!active) return;
        setBookings(bList);
        setPackages(pList);
        setInvoiceSettings(cfg);
      } catch (err) {
        if (active) {
          pushToast(
            'error',
            'Failed to load bookings or packages',
            err instanceof Error ? err.message : undefined
          );
        }
      }
    };
    loadStaticRefs();

    const unsub = subscribeAllInvoicesAdmin(
      (items) => {
        if (!active) return;
        setInvoices(items);
        setLoading(false);
      },
      (err) => {
        if (!active) return;
        setLoading(false);
        pushToast('error', 'Failed to subscribe to invoices', err.message);
      }
    );

    return () => {
      active = false;
      unsub();
    };
  }, [pushToast]);

  // Keep open preview/payment/draft modals synchronized with real-time snapshot updates
  useEffect(() => {
    if (previewInvoice) {
      const updated = invoices.find((inv) => inv.id === previewInvoice.id);
      if (updated) setPreviewInvoice(updated);
    }
    if (paymentModalInvoice) {
      const updated = invoices.find((inv) => inv.id === paymentModalInvoice.id);
      if (updated) {
        setPaymentModalInvoice(updated);
        if (updated.paymentStatus !== paymentModalInvoice.paymentStatus) {
          setOverridePaymentStatus(updated.paymentStatus);
        }
      }
    }
    if (editingDraft) {
      const updated = invoices.find((inv) => inv.id === editingDraft.id);
      if (updated && updated.lifecycleStatus !== 'DRAFT') {
        setEditingDraft(null);
        setEditorOpen(false);
        pushToast(
          'info',
          'Invoice locked',
          `${updated.invoiceNumber} is now ${INVOICE_LIFECYCLE_LABELS[updated.lifecycleStatus]} and can no longer be edited as a draft.`
        );
      }
    }
  }, [invoices]);

  const activeInvoices = useMemo(
    () => invoices.filter((inv) => inv.lifecycleStatus !== 'VOID'),
    [invoices]
  );

  const summaryStats = useMemo(() => {
    let outstandingBalance = 0;
    let collectedRevenue = 0;
    let attentionCount = 0;

    for (const inv of activeInvoices) {
      outstandingBalance += inv.remainingBalance || 0;
      collectedRevenue += inv.amountPaid || 0;
      if (
        inv.paymentStatus === 'UNPAID' ||
        inv.paymentStatus === 'OVERDUE' ||
        inv.lifecycleStatus === 'DRAFT'
      ) {
        attentionCount += 1;
      }
    }

    return {
      totalCount: activeInvoices.length,
      outstandingBalance,
      collectedRevenue,
      attentionCount,
    };
  }, [activeInvoices]);

  const filteredInvoices = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return invoices.filter((inv) => {
      if (paymentFilter !== 'ALL' && inv.paymentStatus !== paymentFilter) return false;
      if (lifecycleFilter !== 'ALL' && inv.lifecycleStatus !== lifecycleFilter) return false;
      if (!q) return true;
      return (
        inv.invoiceNumber.toLowerCase().includes(q) ||
        inv.clientName.toLowerCase().includes(q) ||
        inv.bookingCode.toLowerCase().includes(q) ||
        inv.packageName.toLowerCase().includes(q) ||
        inv.eventLocation.toLowerCase().includes(q)
      );
    });
  }, [invoices, searchTerm, paymentFilter, lifecycleFilter]);

  const activeInvoicesByBookingId = useMemo(() => {
    const map = new Map<string, InvoiceRecord[]>();
    for (const inv of activeInvoices) {
      const list = map.get(inv.bookingId) || [];
      list.push(inv);
      map.set(inv.bookingId, list);
    }
    return map;
  }, [activeInvoices]);

  const selectableBookings = useMemo(() => {
    const q = bookingSearch.trim().toLowerCase();
    return bookings
      .filter((b) => b.status !== 'CANCELLED')
      .filter((b) => {
        if (!q) return true;
        return (
          b.bookingCode.toLowerCase().includes(q) ||
          b.coupleName.toLowerCase().includes(q) ||
          b.eventDate.includes(q) ||
          b.packageName.toLowerCase().includes(q)
        );
      });
  }, [bookings, bookingSearch]);

  const selectedBooking = useMemo(
    () => bookings.find((b) => b.id === selectedBookingId) || null,
    [bookings, selectedBookingId]
  );

  const selectedBookingExistingInvoices = useMemo(
    () => (selectedBooking ? activeInvoicesByBookingId.get(selectedBooking.id) || [] : []),
    [selectedBooking, activeInvoicesByBookingId]
  );

  const selectedPackageObj = useMemo(() => {
    return packages.find((p) => p.id === formPackageId) || null;
  }, [packages, formPackageId]);

  const resolvedPackagePrice = useMemo(() => {
    if (selectedPackageObj) return Number(selectedPackageObj.price);
    if (editingDraft) return Number(editingDraft.packagePrice);
    if (selectedBooking) {
      return resolveLatestPackageForBooking(selectedBooking, packages).packagePrice;
    }
    return 0;
  }, [selectedPackageObj, editingDraft, selectedBooking, packages]);

  const liveFinancials = useMemo(() => {
    return calculateInvoiceFinancials({
      packagePrice: resolvedPackagePrice,
      additionalItems: formAdditionalItems,
      transportationFee: Number(formTransportationFee) || 0,
      overtimeFee: Number(formOvertimeFee) || 0,
      discount: Number(formDiscount) || 0,
      dpMode: formDpMode,
      dpPercent: Number(formCustomDpPercent) || 0,
      customDpAmount: Number(formCustomDpAmount) || 0,
      payments: editingDraft?.payments || [],
    });
  }, [
    resolvedPackagePrice,
    formAdditionalItems,
    formTransportationFee,
    formOvertimeFee,
    formDiscount,
    formDpMode,
    formCustomDpPercent,
    formCustomDpAmount,
    editingDraft,
  ]);

  const applyBookingSelection = (booking: BookingRecord | null) => {
    if (!booking) {
      setSelectedBookingId('');
      return;
    }
    setSelectedBookingId(booking.id);
    setAllowDuplicate(false);
    setFormClientName(booking.coupleName);
    setFormClientWhatsapp(booking.whatsappNumber);
    setFormClientEmail(booking.email || '');
    setFormWeddingDate(booking.eventDate);
    setFormEventLocation(booking.eventLocation);
    setFormEventType(booking.eventType);
    const resolved = resolveLatestPackageForBooking(booking, packages);
    setFormPackageId(resolved.packageId);
    setFormNotes(booking.notes || '');
  };

  const openCreateModal = () => {
    const issue = todayIso();
    const due = addDaysIso(issue, invoiceSettings.defaultDueDays ?? 7);
    setEditingDraft(null);
    setBookingSearch('');
    setAllowDuplicate(false);
    setFormIssueDate(issue);
    setFormDueDate(due);
    setFormAdditionalItems([]);
    setFormTransportationFee('0');
    setFormOvertimeFee('0');
    setFormDiscount('0');
    setFormDpMode(invoiceSettings.defaultDpMode || 'PERCENT_30');
    setFormCustomDpPercent('40');
    setFormCustomDpAmount('0');
    setFormBankName(invoiceSettings.bankName);
    setFormBankAccountNumber(invoiceSettings.bankAccountNumber);
    setFormBankAccountHolder(invoiceSettings.bankAccountHolder);
    setFormPaymentInstructions(invoiceSettings.paymentInstructions);
    setFormThankYouMessage(invoiceSettings.defaultThankYouMessage);

    const firstValidBooking = bookings.find((b) => b.status !== 'CANCELLED') || null;
    applyBookingSelection(firstValidBooking);
    setEditorOpen(true);
  };

  const openEditDraftModal = (inv: InvoiceRecord) => {
    setEditingDraft(inv);
    setSelectedBookingId(inv.bookingId);
    setAllowDuplicate(true);
    setFormIssueDate(inv.issueDate);
    setFormDueDate(inv.dueDate);
    setFormClientName(inv.clientName);
    setFormClientWhatsapp(inv.clientWhatsapp);
    setFormClientEmail(inv.clientEmail || '');
    setFormWeddingDate(inv.weddingDate);
    setFormEventLocation(inv.eventLocation);
    setFormEventType(inv.eventType);

    const matchedPkg =
      packages.find((p) => p.id === inv.packageId) ||
      packages.find((p) => p.name.trim().toLowerCase() === inv.packageName.trim().toLowerCase());
    setFormPackageId(matchedPkg ? matchedPkg.id : inv.packageId);

    setFormAdditionalItems(inv.additionalItems || []);
    setFormTransportationFee(String(inv.transportationFee || 0));
    setFormOvertimeFee(String(inv.overtimeFee || 0));
    setFormDiscount(String(inv.discount || 0));
    setFormDpMode(inv.dpMode);
    setFormCustomDpPercent(String(inv.dpPercent || 30));
    setFormCustomDpAmount(String(inv.downPaymentAmount || 0));
    setFormBankName(inv.bankName);
    setFormBankAccountNumber(inv.bankAccountNumber);
    setFormBankAccountHolder(inv.bankAccountHolder);
    setFormPaymentInstructions(inv.paymentInstructions);
    setFormThankYouMessage(inv.thankYouMessage);
    setFormNotes(inv.notes || '');
    setEditorOpen(true);
  };

  const handleAddLineItem = () => {
    setFormAdditionalItems((prev) => [
      ...prev,
      {
        id: `svc_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
        description: '',
        quantity: 1,
        unitPrice: 0,
        amount: 0,
      },
    ]);
  };

  const handleUpdateLineItem = (
    id: string,
    patch: Partial<Pick<InvoiceLineItem, 'description' | 'quantity' | 'unitPrice'>>
  ) => {
    setFormAdditionalItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const nextQty = patch.quantity !== undefined ? Math.max(1, patch.quantity) : item.quantity;
        const nextUnit = patch.unitPrice !== undefined ? Math.max(0, patch.unitPrice) : item.unitPrice;
        return {
          ...item,
          ...patch,
          quantity: nextQty,
          unitPrice: nextUnit,
          amount: nextQty * nextUnit,
        };
      })
    );
  };

  const handleRemoveLineItem = (id: string) => {
    setFormAdditionalItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleSaveInvoice = async (finalizeImmediately: boolean, openPreviewAfter?: boolean) => {
    if (!user) return;
    if (!editingDraft && !selectedBooking) {
      pushToast('error', 'Select a booking', 'Please choose an existing client booking first.');
      return;
    }
    if (formClientName.trim().length < 2) {
      pushToast('error', 'Invalid client name', 'Client name must be at least 2 characters.');
      return;
    }
    if (
      formClientWhatsapp.trim().length < 8 ||
      formClientWhatsapp.trim().length > 25 ||
      normalizeWhatsapp(formClientWhatsapp).length < 8
    ) {
      pushToast(
        'error',
        'Invalid WhatsApp number',
        'Please provide a WhatsApp number between 8 and 25 characters.'
      );
      return;
    }
    if (formEventLocation.trim().length < 2 || formEventType.trim().length < 2) {
      pushToast('error', 'Missing wedding details', 'Event location and event type are required.');
      return;
    }
    if (
      !PATTERNS.dateStr.test(formIssueDate) ||
      !PATTERNS.dateStr.test(formDueDate) ||
      !PATTERNS.dateStr.test(formWeddingDate)
    ) {
      pushToast('error', 'Invalid dates', 'Issue date, due date, and wedding date must be valid.');
      return;
    }

    if (
      !editingDraft &&
      selectedBookingExistingInvoices.length > 0 &&
      !allowDuplicate
    ) {
      pushToast(
        'error',
        'Active invoice already exists',
        `Booking ${selectedBooking?.bookingCode} already has ${selectedBookingExistingInvoices[0].invoiceNumber}. Tick the confirmation box to issue an additional invoice.`
      );
      return;
    }

    setSaving(true);
    try {
      if (editingDraft) {
        const pkgName = selectedPackageObj?.name || editingDraft.packageName;
        const pkgId = selectedPackageObj?.id || editingDraft.packageId;

        const updatedDraft: InvoiceRecord = {
          ...editingDraft,
          issueDate: formIssueDate,
          dueDate: formDueDate,
          clientName: formClientName.trim(),
          clientWhatsapp: formClientWhatsapp.trim(),
          normalizedWhatsapp: normalizeWhatsapp(formClientWhatsapp),
          clientEmail: formClientEmail.trim(),
          weddingDate: formWeddingDate,
          eventLocation: formEventLocation.trim(),
          eventType: formEventType.trim(),
          packageId: pkgId,
          packageName: pkgName,
          packagePrice: resolvedPackagePrice,
          additionalItems: liveFinancials.additionalItems,
          additionalServicesTotal: liveFinancials.additionalServicesTotal,
          transportationFee: liveFinancials.transportationFee,
          overtimeFee: liveFinancials.overtimeFee,
          discount: liveFinancials.discount,
          grandTotal: liveFinancials.grandTotal,
          dpMode: formDpMode,
          dpPercent: liveFinancials.dpPercent,
          downPaymentAmount: liveFinancials.downPaymentAmount,
          amountPaid: liveFinancials.amountPaid,
          remainingBalance: liveFinancials.remainingBalance,
          bankName: formBankName.trim(),
          bankAccountNumber: formBankAccountNumber.trim(),
          bankAccountHolder: formBankAccountHolder.trim(),
          paymentInstructions: formPaymentInstructions.trim(),
          thankYouMessage: formThankYouMessage.trim(),
          notes: formNotes.trim(),
        };

        await updateDraftInvoice(user, updatedDraft, { finalize: finalizeImmediately });
        pushToast(
          'success',
          finalizeImmediately ? 'Invoice finalized' : 'Draft updated',
          `${editingDraft.invoiceNumber} has been saved.`
        );
        setEditorOpen(false);
        if (openPreviewAfter) {
          setPreviewInvoice({
            ...updatedDraft,
            lifecycleStatus: finalizeImmediately ? 'FINALIZED' : 'DRAFT',
          });
        }
      } else if (selectedBooking) {
        const bookingSnapshot: BookingRecord = {
          ...selectedBooking,
          coupleName: formClientName.trim(),
          whatsappNumber: formClientWhatsapp.trim(),
          email: formClientEmail.trim(),
          eventDate: formWeddingDate,
          eventLocation: formEventLocation.trim(),
          eventType: formEventType.trim(),
        };
        const effectiveSettings: InvoiceSettings = {
          ...invoiceSettings,
          bankName: formBankName.trim(),
          bankAccountNumber: formBankAccountNumber.trim(),
          bankAccountHolder: formBankAccountHolder.trim(),
          paymentInstructions: formPaymentInstructions.trim(),
          defaultThankYouMessage: formThankYouMessage.trim(),
        };

        const created = await createInvoiceFromBooking(user, {
          booking: bookingSnapshot,
          packageOverride: selectedPackageObj,
          issueDate: formIssueDate,
          dueDate: formDueDate,
          additionalItems: liveFinancials.additionalItems,
          transportationFee: liveFinancials.transportationFee,
          overtimeFee: liveFinancials.overtimeFee,
          discount: liveFinancials.discount,
          dpMode: formDpMode,
          dpPercent: Number(formCustomDpPercent) || 0,
          customDpAmount: Number(formCustomDpAmount) || 0,
          notes: formNotes.trim(),
          invoiceSettings: effectiveSettings,
          finalizeImmediately,
          allowDuplicateForBooking: allowDuplicate,
        });

        pushToast(
          'success',
          finalizeImmediately ? 'Invoice finalized & generated' : 'Invoice draft created',
          `Generated ${created.invoiceNumber} for ${created.clientName}.`
        );
        setEditorOpen(false);
        if (openPreviewAfter) {
          setPreviewInvoice(created);
        }
      }
    } catch (err) {
      pushToast(
        'error',
        'Failed to save invoice',
        err instanceof Error ? err.message : undefined
      );
    } finally {
      setSaving(false);
    }
  };

  const handleFinalizeFromPreview = async (inv: InvoiceRecord) => {
    if (!user || inv.lifecycleStatus !== 'DRAFT') return;
    setSaving(true);
    try {
      await updateDraftInvoice(user, inv, { finalize: true });
      pushToast('success', 'Invoice finalized', `${inv.invoiceNumber} is now locked & finalized.`);
    } catch (err) {
      pushToast('error', 'Failed to finalize', err instanceof Error ? err.message : undefined);
    } finally {
      setSaving(false);
    }
  };

  const openPaymentModal = (inv: InvoiceRecord) => {
    setPaymentModalInvoice(inv);
    setPayDate(todayIso());
    setPayAmount(
      inv.amountPaid === 0 && inv.downPaymentAmount > 0
        ? String(inv.downPaymentAmount)
        : String(inv.remainingBalance || 0)
    );
    setPayMethod('Bank Transfer BCA');
    setPayNote('');
    setOverridePaymentStatus(inv.paymentStatus);
    setEditFinalizedNotes(inv.notes || '');
  };

  const handleRecordPaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !paymentModalInvoice) return;
    const numericAmount = Math.round(Number(payAmount) || 0);
    if (numericAmount <= 0) {
      pushToast('error', 'Invalid amount', 'Payment amount must be greater than zero.');
      return;
    }

    setSaving(true);
    try {
      await recordInvoicePayment(user, paymentModalInvoice, {
        date: payDate,
        amount: numericAmount,
        method: payMethod,
        note: payNote.trim() || undefined,
      });
      pushToast(
        'success',
        'Payment recorded',
        `Added ${formatRp(numericAmount)} to ${paymentModalInvoice.invoiceNumber}.`
      );
      setPayAmount('');
      setPayNote('');
    } catch (err) {
      pushToast('error', 'Payment failed', err instanceof Error ? err.message : undefined);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveStatusAndNotes = async () => {
    if (!user || !paymentModalInvoice) return;
    setSaving(true);
    try {
      await updateInvoiceStatusAndNotes(
        user,
        paymentModalInvoice.id,
        paymentModalInvoice.invoiceNumber,
        {
          paymentStatus: overridePaymentStatus,
          notes: editFinalizedNotes,
        }
      );
      pushToast('success', 'Invoice status updated');
      setPaymentModalInvoice(null);
    } catch (err) {
      pushToast('error', 'Update failed', err instanceof Error ? err.message : undefined);
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmVoid = async () => {
    if (!user || !voidingInvoice) return;
    setSaving(true);
    try {
      await updateInvoiceStatusAndNotes(
        user,
        voidingInvoice.id,
        voidingInvoice.invoiceNumber,
        { lifecycleStatus: 'VOID' }
      );
      pushToast('info', 'Invoice voided', `${voidingInvoice.invoiceNumber} marked as voided.`);
      setVoidingInvoice(null);
    } catch (err) {
      pushToast('error', 'Failed to void invoice', err instanceof Error ? err.message : undefined);
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmDeleteDraft = async () => {
    if (!user || !deletingDraft) return;
    setSaving(true);
    try {
      await deleteDraftInvoice(user, deletingDraft.id, deletingDraft.invoiceNumber);
      pushToast('info', 'Draft deleted', `${deletingDraft.invoiceNumber} removed.`);
      setDeletingDraft(null);
    } catch (err) {
      pushToast('error', 'Delete failed', err instanceof Error ? err.message : undefined);
    } finally {
      setSaving(false);
    }
  };

  const openBankSettingsModal = () => {
    setCfgBankName(invoiceSettings.bankName);
    setCfgBankAccNo(invoiceSettings.bankAccountNumber);
    setCfgBankHolder(invoiceSettings.bankAccountHolder);
    setCfgInstructions(invoiceSettings.paymentInstructions);
    setCfgThankYou(invoiceSettings.defaultThankYouMessage);
    setCfgDueDays(String(invoiceSettings.defaultDueDays ?? 7));
    setCfgDefaultDpMode(invoiceSettings.defaultDpMode || 'PERCENT_30');
    setSettingsModalOpen(true);
  };

  const handleSaveBankSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    try {
      const saved = await saveInvoiceSettings(user, {
        bankName: cfgBankName,
        bankAccountNumber: cfgBankAccNo,
        bankAccountHolder: cfgBankHolder,
        paymentInstructions: cfgInstructions,
        defaultThankYouMessage: cfgThankYou,
        defaultDueDays: Number(cfgDueDays) || 7,
        defaultDpMode: cfgDefaultDpMode,
      });
      setInvoiceSettings(saved);
      pushToast('success', 'Invoice settings saved');
      setSettingsModalOpen(false);
    } catch (err) {
      pushToast('error', 'Failed to save settings', err instanceof Error ? err.message : undefined);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-[#171717]/55">
            Billing & Financial Records
          </p>
          <h1 className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight mt-1">
            Invoice Management
          </h1>
          <p className="text-sm text-[#171717]/65 mt-1">
            Generate sequential INV/USC invoices from client bookings, track payments, and export A4 PDFs.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={openBankSettingsModal}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-[#171717]/20 text-xs font-semibold hover:border-[#171717] transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <Landmark className="w-4 h-4" />
            Bank & Terms
          </button>
          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#171717] text-white text-xs font-semibold hover:bg-[#D8FF3E] hover:text-[#171717] transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <Plus className="w-4 h-4" />
            Generate Invoice
          </button>
        </div>
      </div>

      {/* Warning Banner if Bank Account Number Not Yet Configured */}
      {!invoiceSettings.bankAccountNumber.trim() && (
        <div className="bg-[#FFFBEB] border border-[#F59E0B]/40 px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-2.5 text-xs text-[#92400E]">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>
              Bank account number is not configured yet. Set your studio bank details so newly generated invoices include complete transfer instructions.
            </span>
          </div>
          <button
            type="button"
            onClick={openBankSettingsModal}
            className="px-3 py-1.5 bg-[#171717] text-white text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer"
          >
            Configure Bank Details
          </button>
        </div>
      )}

      {/* Summary Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-[#171717]/12 p-4">
          <p className="font-mono text-[11px] uppercase tracking-wider text-[#171717]/55">
            Active Invoices
          </p>
          <p className="font-display text-2xl font-extrabold mt-1 tabular-nums">
            {summaryStats.totalCount}
          </p>
        </div>
        <div className="bg-white border border-[#171717]/12 p-4">
          <p className="font-mono text-[11px] uppercase tracking-wider text-[#171717]/55">
            Collected Revenue
          </p>
          <p className="font-display text-2xl font-extrabold mt-1 text-[#16A34A] tabular-nums">
            {formatRp(summaryStats.collectedRevenue)}
          </p>
        </div>
        <div className="bg-white border border-[#171717]/12 p-4">
          <p className="font-mono text-[11px] uppercase tracking-wider text-[#171717]/55">
            Outstanding Balance
          </p>
          <p className="font-display text-2xl font-extrabold mt-1 text-[#171717] tabular-nums">
            {formatRp(summaryStats.outstandingBalance)}
          </p>
        </div>
        <div className="bg-white border border-[#171717]/12 p-4">
          <p className="font-mono text-[11px] uppercase tracking-wider text-[#171717]/55">
            Unpaid / Drafts
          </p>
          <p className="font-display text-2xl font-extrabold mt-1 text-[#D97706] tabular-nums">
            {summaryStats.attentionCount}
          </p>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="bg-white border border-[#171717]/12 p-4 space-y-3">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-[#171717]/40 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search invoice no, client name, booking code, package, or venue..."
              className="w-full pl-10 pr-4 py-2.5 bg-[#FAF8F4] border border-[#171717]/15 text-sm focus:outline-none focus:border-[#171717]"
            />
          </div>

          <select
            value={lifecycleFilter}
            onChange={(e) =>
              setLifecycleFilter(e.target.value as 'ALL' | InvoiceLifecycleStatus)
            }
            aria-label="Filter by invoice lifecycle status"
            className="px-3 py-2.5 bg-[#FAF8F4] border border-[#171717]/15 text-xs font-semibold focus:outline-none focus:border-[#171717]"
          >
            <option value="ALL">All Records</option>
            <option value="DRAFT">Draft Only</option>
            <option value="FINALIZED">Finalized Only</option>
            <option value="VOID">Voided</option>
          </select>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {PAYMENT_FILTER_OPTIONS.map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => setPaymentFilter(status)}
              className={`px-3 py-1.5 text-xs font-semibold border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                paymentFilter === status
                  ? 'bg-[#171717] text-[#D8FF3E] border-[#171717]'
                  : 'bg-white text-[#171717]/75 border-[#171717]/15 hover:border-[#171717]'
              }`}
            >
              {status === 'ALL' ? 'All Payments' : INVOICE_PAYMENT_STATUS_LABELS[status]}
            </button>
          ))}
        </div>
      </div>

      {/* Invoices Table */}
      <div className="bg-white border border-[#171717]/12 overflow-x-auto">
        {loading ? (
          <div className="p-10 flex items-center justify-center gap-2 text-sm text-[#171717]/60">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading invoices...
          </div>
        ) : filteredInvoices.length === 0 ? (
          <div className="p-12 text-center">
            <FileText className="w-8 h-8 text-[#171717]/25 mx-auto mb-3" />
            <p className="font-display text-lg font-bold">No invoices found</p>
            <p className="text-xs text-[#171717]/60 mt-1 max-w-md mx-auto">
              {invoices.length === 0
                ? 'Select an existing booking to generate your first sequential INV/USC invoice.'
                : 'Adjust your search query or payment filter to see matching invoices.'}
            </p>
            {invoices.length === 0 && (
              <button
                type="button"
                onClick={openCreateModal}
                className="mt-5 inline-flex items-center gap-2 px-4 py-2 bg-[#171717] text-white text-xs font-semibold hover:bg-[#D8FF3E] hover:text-[#171717] transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                Generate First Invoice
              </button>
            )}
          </div>
        ) : (
          <table className="w-full text-left border-collapse min-w-[920px]">
            <thead>
              <tr className="border-b border-[#171717]/12 bg-[#FAF8F4] font-mono text-[10px] uppercase tracking-wider text-[#171717]/60">
                <th className="py-3 px-4">Invoice No</th>
                <th className="py-3 px-4">Client & Wedding</th>
                <th className="py-3 px-4">Booking & Package</th>
                <th className="py-3 px-4 text-right">Total</th>
                <th className="py-3 px-4 text-right">Paid</th>
                <th className="py-3 px-4 text-right">Remaining</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#171717]/10 text-sm">
              {filteredInvoices.map((inv) => {
                const whatsappHref = buildWhatsappInvoiceUrl({
                  clientWhatsapp: inv.clientWhatsapp,
                  clientName: inv.clientName,
                  invoiceNumber: inv.invoiceNumber,
                  weddingDate: inv.weddingDate,
                  packageName: inv.packageName,
                  grandTotal: inv.grandTotal,
                  downPaymentAmount: inv.downPaymentAmount,
                  amountPaid: inv.amountPaid,
                  remainingBalance: inv.remainingBalance,
                  dueDate: inv.dueDate,
                  bankName: inv.bankName,
                  bankAccountNumber: inv.bankAccountNumber,
                  bankAccountHolder: inv.bankAccountHolder,
                });

                return (
                  <tr key={inv.id} className="hover:bg-[#FAF8F4]/70 transition-colors">
                    <td className="py-3.5 px-4 align-top">
                      <p className="font-mono text-xs font-bold text-[#171717] tabular-nums">
                        {inv.invoiceNumber}
                      </p>
                      <p className="text-[11px] text-[#171717]/55 mt-0.5 tabular-nums">
                        Issued {formatDisplayDate(inv.issueDate)} · Due{' '}
                        {formatDisplayDate(inv.dueDate)}
                      </p>
                    </td>

                    <td className="py-3.5 px-4 align-top">
                      <p className="font-semibold text-[#171717]">{inv.clientName}</p>
                      <p className="text-xs text-[#171717]/60 mt-0.5 tabular-nums">
                        {formatDisplayDate(inv.weddingDate)} · {inv.eventType}
                      </p>
                    </td>

                    <td className="py-3.5 px-4 align-top">
                      <p className="font-mono text-xs text-[#171717] tabular-nums">
                        {inv.bookingCode}
                      </p>
                      <p className="text-xs text-[#171717]/65 mt-0.5">{inv.packageName}</p>
                    </td>

                    <td className="py-3.5 px-4 align-top text-right font-semibold tabular-nums">
                      {formatRp(inv.grandTotal)}
                    </td>

                    <td className="py-3.5 px-4 align-top text-right text-xs font-semibold text-[#16A34A] tabular-nums">
                      {formatRp(inv.amountPaid)}
                    </td>

                    <td className="py-3.5 px-4 align-top text-right font-bold tabular-nums">
                      {formatRp(inv.remainingBalance)}
                    </td>

                    <td className="py-3.5 px-4 align-top">
                      <p
                        className={`text-xs font-bold ${
                          inv.lifecycleStatus === 'VOID'
                            ? 'text-[#171717]/40 line-through'
                            : paymentStatusTextColor(inv.paymentStatus)
                        }`}
                      >
                        {INVOICE_PAYMENT_STATUS_LABELS[inv.paymentStatus]}
                      </p>
                      <p className="font-mono text-[10px] uppercase tracking-wider text-[#171717]/50 mt-0.5">
                        {INVOICE_LIFECYCLE_LABELS[inv.lifecycleStatus]}
                      </p>
                    </td>

                    <td className="py-3.5 px-4 align-top">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => setPreviewInvoice(inv)}
                          title="Preview & PDF"
                          className="p-2 border border-[#171717]/15 text-[#171717] hover:bg-[#171717] hover:text-white transition-colors cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={() => downloadInvoicePdf(inv)}
                          title="Download A4 PDF"
                          className="p-2 border border-[#171717]/15 text-[#171717] hover:bg-[#171717] hover:text-white transition-colors cursor-pointer"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>

                        <a
                          href={whatsappHref}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Share via WhatsApp"
                          className="p-2 border border-[#171717]/15 text-[#16A34A] hover:bg-[#16A34A] hover:text-white transition-colors"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                        </a>

                        {inv.lifecycleStatus === 'DRAFT' && (
                          <button
                            type="button"
                            onClick={() => openEditDraftModal(inv)}
                            title="Edit Draft"
                            className="p-2 border border-[#171717]/15 text-[#171717] hover:bg-[#D8FF3E] transition-colors cursor-pointer"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {inv.lifecycleStatus !== 'VOID' && (
                          <button
                            type="button"
                            onClick={() => openPaymentModal(inv)}
                            title="Record Payment / Manage Status"
                            className="p-2 border border-[#171717]/15 text-[#171717] hover:bg-[#171717] hover:text-[#D8FF3E] transition-colors cursor-pointer"
                          >
                            <Wallet className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {inv.lifecycleStatus === 'DRAFT' ? (
                          <button
                            type="button"
                            onClick={() => setDeletingDraft(inv)}
                            title="Delete Draft"
                            className="p-2 border border-[#171717]/15 text-[#DC2626] hover:bg-[#DC2626] hover:text-white transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        ) : inv.lifecycleStatus === 'FINALIZED' ? (
                          <button
                            type="button"
                            onClick={() => setVoidingInvoice(inv)}
                            title="Void Finalized Invoice"
                            className="p-2 border border-[#171717]/15 text-[#171717]/50 hover:text-[#DC2626] hover:border-[#DC2626] transition-colors cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* CREATE / EDIT DRAFT MODAL */}
      {editorOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-3 sm:p-6">
          <div className="bg-white border border-[#171717] w-full max-w-5xl max-h-[92vh] flex flex-col">
            <div className="px-6 py-4 bg-[#171717] text-white flex items-center justify-between gap-4 shrink-0">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-widest text-[#D8FF3E]">
                  {editingDraft ? `Editing Draft · ${editingDraft.invoiceNumber}` : 'New Invoice'}
                </p>
                <h2 className="font-display text-lg font-extrabold">
                  {editingDraft ? 'Edit Draft Invoice' : 'Generate Invoice from Booking'}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setEditorOpen(false)}
                className="p-1.5 text-white/75 hover:text-white cursor-pointer"
                aria-label="Close modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Booking Picker (only when creating new) */}
              {!editingDraft && (
                <div className="bg-[#FAF8F4] border border-[#171717]/15 p-4 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <label className="font-mono text-[11px] uppercase tracking-wider font-semibold text-[#171717]">
                      1. Select Client Booking
                    </label>
                    <input
                      type="text"
                      value={bookingSearch}
                      onChange={(e) => setBookingSearch(e.target.value)}
                      placeholder="Filter bookings by couple or code..."
                      className="px-3 py-1.5 bg-white border border-[#171717]/15 text-xs sm:w-64 focus:outline-none focus:border-[#171717]"
                    />
                  </div>

                  <select
                    value={selectedBookingId}
                    onChange={(e) => {
                      const match = bookings.find((b) => b.id === e.target.value) || null;
                      applyBookingSelection(match);
                    }}
                    className="w-full px-3.5 py-2.5 bg-white border border-[#171717]/20 text-sm font-medium focus:outline-none focus:border-[#171717]"
                  >
                    <option value="">-- Choose a booking --</option>
                    {selectableBookings.map((b) => {
                      const hasExisting = (activeInvoicesByBookingId.get(b.id) || []).length > 0;
                      return (
                        <option key={b.id} value={b.id}>
                          {b.bookingCode} · {b.coupleName} · {formatDisplayDate(b.eventDate)} ·{' '}
                          {b.packageName}
                          {hasExisting ? ' (Has Active Invoice)' : ''}
                        </option>
                      );
                    })}
                  </select>

                  {selectedBookingExistingInvoices.length > 0 && (
                    <div className="bg-[#FFFBEB] border border-[#F59E0B]/50 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="text-xs text-[#92400E] space-y-1">
                        <p className="font-semibold">
                          Duplicate Protection: Active invoice{' '}
                          {selectedBookingExistingInvoices.map((i) => i.invoiceNumber).join(', ')}{' '}
                          already exists for {selectedBooking?.bookingCode}.
                        </p>
                        <label className="inline-flex items-center gap-2 cursor-pointer font-medium">
                          <input
                            type="checkbox"
                            checked={allowDuplicate}
                            onChange={(e) => setAllowDuplicate(e.target.checked)}
                          />
                          Confirm creating an additional invoice for this booking
                        </label>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setEditorOpen(false);
                          setPreviewInvoice(selectedBookingExistingInvoices[0]);
                        }}
                        className="px-3 py-1.5 bg-[#171717] text-white text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        Open Existing
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Grid: Left Form Inputs | Right Live Calculation */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div className="lg:col-span-7 space-y-5">
                  {/* Dates */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block font-mono text-[10px] uppercase tracking-wider text-[#171717]/65 mb-1">
                        Issue Date
                      </label>
                      <input
                        type="date"
                        value={formIssueDate}
                        onChange={(e) => setFormIssueDate(e.target.value)}
                        className="w-full px-3 py-2 border border-[#171717]/20 text-sm focus:outline-none focus:border-[#171717]"
                      />
                    </div>
                    <div>
                      <label className="block font-mono text-[10px] uppercase tracking-wider text-[#171717]/65 mb-1">
                        Due Date
                      </label>
                      <input
                        type="date"
                        value={formDueDate}
                        onChange={(e) => setFormDueDate(e.target.value)}
                        className="w-full px-3 py-2 border border-[#171717]/20 text-sm focus:outline-none focus:border-[#171717]"
                      />
                    </div>
                  </div>

                  {/* Client & Wedding Details */}
                  <div className="border-t border-[#171717]/10 pt-4 space-y-3">
                    <p className="font-mono text-[10px] uppercase tracking-wider text-[#171717]/65">
                      Client & Wedding Snapshot
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium mb-1">Client / Couple Name</label>
                        <input
                          type="text"
                          value={formClientName}
                          onChange={(e) => setFormClientName(e.target.value)}
                          className="w-full px-3 py-2 border border-[#171717]/20 text-sm focus:outline-none focus:border-[#171717]"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium mb-1">WhatsApp Number</label>
                        <input
                          type="text"
                          value={formClientWhatsapp}
                          onChange={(e) => setFormClientWhatsapp(e.target.value)}
                          className="w-full px-3 py-2 border border-[#171717]/20 text-sm focus:outline-none focus:border-[#171717]"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium mb-1">Client Email</label>
                        <input
                          type="email"
                          value={formClientEmail}
                          onChange={(e) => setFormClientEmail(e.target.value)}
                          className="w-full px-3 py-2 border border-[#171717]/20 text-sm focus:outline-none focus:border-[#171717]"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium mb-1">Wedding Date</label>
                        <input
                          type="date"
                          value={formWeddingDate}
                          onChange={(e) => setFormWeddingDate(e.target.value)}
                          className="w-full px-3 py-2 border border-[#171717]/20 text-sm focus:outline-none focus:border-[#171717]"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium mb-1">Event Type</label>
                        <input
                          type="text"
                          value={formEventType}
                          onChange={(e) => setFormEventType(e.target.value)}
                          className="w-full px-3 py-2 border border-[#171717]/20 text-sm focus:outline-none focus:border-[#171717]"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium mb-1">Venue / Location</label>
                        <input
                          type="text"
                          value={formEventLocation}
                          onChange={(e) => setFormEventLocation(e.target.value)}
                          className="w-full px-3 py-2 border border-[#171717]/20 text-sm focus:outline-none focus:border-[#171717]"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Live Package Integration */}
                  <div className="border-t border-[#171717]/10 pt-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="font-mono text-[10px] uppercase tracking-wider text-[#171717]/65">
                        Selected Package (Synced from Package Catalog)
                      </label>
                      <span className="font-mono text-xs font-bold text-[#171717] tabular-nums">
                        {formatRp(resolvedPackagePrice)}
                      </span>
                    </div>
                    <select
                      value={formPackageId}
                      onChange={(e) => setFormPackageId(e.target.value)}
                      className="w-full px-3 py-2.5 bg-white border border-[#171717]/20 text-sm font-medium focus:outline-none focus:border-[#171717]"
                    >
                      {packages.map((pkg) => (
                        <option key={pkg.id} value={pkg.id}>
                          {pkg.name} — {formatRp(pkg.price)}
                          {!pkg.isActive ? ' (Inactive)' : ''}
                        </option>
                      ))}
                      {!selectedPackageObj && editingDraft && (
                        <option value={editingDraft.packageId}>
                          {editingDraft.packageName} — {formatRp(editingDraft.packagePrice)}
                        </option>
                      )}
                    </select>
                  </div>

                  {/* Additional Services */}
                  <div className="border-t border-[#171717]/10 pt-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="font-mono text-[10px] uppercase tracking-wider text-[#171717]/65">
                        Additional Services
                      </p>
                      <button
                        type="button"
                        onClick={handleAddLineItem}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#171717] text-white text-xs font-semibold hover:bg-[#D8FF3E] hover:text-[#171717] transition-colors cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Add Service
                      </button>
                    </div>

                    {formAdditionalItems.length === 0 ? (
                      <p className="text-xs text-[#171717]/50 py-2">
                        No extra services added. Click "Add Service" to add custom add-ons (e.g., Extra Reels, Same-Day Edit, Polaroid Prints).
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {formAdditionalItems.map((item) => (
                          <div
                            key={item.id}
                            className="grid grid-cols-12 gap-2 items-center bg-[#FAF8F4] p-2 border border-[#171717]/10"
                          >
                            <input
                              type="text"
                              value={item.description}
                              onChange={(e) =>
                                handleUpdateLineItem(item.id, { description: e.target.value })
                              }
                              placeholder="Service description"
                              className="col-span-6 px-2.5 py-1.5 bg-white border border-[#171717]/15 text-xs"
                            />
                            <input
                              type="number"
                              min={1}
                              value={item.quantity}
                              onChange={(e) =>
                                handleUpdateLineItem(item.id, {
                                  quantity: Math.max(1, Number(e.target.value) || 1),
                                })
                              }
                              aria-label="Quantity"
                              className="col-span-2 px-2 py-1.5 bg-white border border-[#171717]/15 text-xs text-right tabular-nums"
                            />
                            <input
                              type="number"
                              min={0}
                              step={1000}
                              value={item.unitPrice}
                              onChange={(e) =>
                                handleUpdateLineItem(item.id, {
                                  unitPrice: Math.max(0, Number(e.target.value) || 0),
                                })
                              }
                              aria-label="Unit price"
                              className="col-span-3 px-2 py-1.5 bg-white border border-[#171717]/15 text-xs text-right tabular-nums"
                            />
                            <button
                              type="button"
                              onClick={() => handleRemoveLineItem(item.id)}
                              aria-label="Remove service"
                              className="col-span-1 flex items-center justify-center p-1.5 text-[#DC2626] hover:bg-[#DC2626]/10 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Fees & Discount */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-medium mb-1">
                        Transportation Fee (Rp)
                      </label>
                      <input
                        type="number"
                        min={0}
                        step={5000}
                        value={formTransportationFee}
                        onChange={(e) => setFormTransportationFee(e.target.value)}
                        className="w-full px-3 py-2 border border-[#171717]/20 text-sm text-right tabular-nums"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1">Overtime Fee (Rp)</label>
                      <input
                        type="number"
                        min={0}
                        step={5000}
                        value={formOvertimeFee}
                        onChange={(e) => setFormOvertimeFee(e.target.value)}
                        className="w-full px-3 py-2 border border-[#171717]/20 text-sm text-right tabular-nums"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1">Discount (Rp)</label>
                      <input
                        type="number"
                        min={0}
                        step={5000}
                        value={formDiscount}
                        onChange={(e) => setFormDiscount(e.target.value)}
                        className="w-full px-3 py-2 border border-[#171717]/20 text-sm text-right tabular-nums"
                      />
                    </div>
                  </div>

                  {/* Notes & Thank You Message */}
                  <div className="border-t border-[#171717]/10 pt-4 space-y-3">
                    <div>
                      <label className="block text-xs font-medium mb-1">
                        Bank Details (Pre-filled from Settings)
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <input
                          type="text"
                          value={formBankName}
                          onChange={(e) => setFormBankName(e.target.value)}
                          placeholder="Bank Name"
                          className="px-3 py-2 border border-[#171717]/20 text-xs"
                        />
                        <input
                          type="text"
                          value={formBankAccountNumber}
                          onChange={(e) => setFormBankAccountNumber(e.target.value)}
                          placeholder="Account Number"
                          className="px-3 py-2 border border-[#171717]/20 text-xs font-mono"
                        />
                        <input
                          type="text"
                          value={formBankAccountHolder}
                          onChange={(e) => setFormBankAccountHolder(e.target.value)}
                          placeholder="Account Holder"
                          className="px-3 py-2 border border-[#171717]/20 text-xs"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium mb-1">
                        Payment Instructions
                      </label>
                      <textarea
                        rows={2}
                        value={formPaymentInstructions}
                        onChange={(e) => setFormPaymentInstructions(e.target.value)}
                        className="w-full px-3 py-2 border border-[#171717]/20 text-xs"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium mb-1">
                        Thank-You Message
                      </label>
                      <input
                        type="text"
                        value={formThankYouMessage}
                        onChange={(e) => setFormThankYouMessage(e.target.value)}
                        className="w-full px-3 py-2 border border-[#171717]/20 text-xs"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium mb-1">
                        Invoice Notes (Optional)
                      </label>
                      <textarea
                        rows={2}
                        value={formNotes}
                        onChange={(e) => setFormNotes(e.target.value)}
                        placeholder="Add special coverage remarks, crew schedule notes, or promo info..."
                        className="w-full px-3 py-2 border border-[#171717]/20 text-xs"
                      />
                    </div>
                  </div>
                </div>

                {/* Right Sticky Summary Column */}
                <div className="lg:col-span-5">
                  <div className="bg-[#FAF8F4] border border-[#171717]/15 p-5 space-y-4 sticky top-0">
                    <p className="font-mono text-[11px] uppercase tracking-wider font-bold text-[#171717]">
                      Payment Calculation
                    </p>

                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-[#171717]/70">Package Price</span>
                        <span className="font-semibold tabular-nums">
                          {formatRp(liveFinancials.packagePrice)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#171717]/70">Additional Services</span>
                        <span className="font-semibold tabular-nums">
                          {formatRp(liveFinancials.additionalServicesTotal)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#171717]/70">Transportation Fee</span>
                        <span className="font-semibold tabular-nums">
                          {formatRp(liveFinancials.transportationFee)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#171717]/70">Overtime Fee</span>
                        <span className="font-semibold tabular-nums">
                          {formatRp(liveFinancials.overtimeFee)}
                        </span>
                      </div>
                      {liveFinancials.discount > 0 && (
                        <div className="flex justify-between text-[#FF5A55]">
                          <span>Discount</span>
                          <span className="font-semibold tabular-nums">
                            - {formatRp(liveFinancials.discount)}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="bg-[#171717] text-white px-4 py-3 flex items-center justify-between">
                      <span className="font-mono text-xs uppercase tracking-wider">Grand Total</span>
                      <span className="font-display text-xl font-extrabold text-[#D8FF3E] tabular-nums">
                        {formatRp(liveFinancials.grandTotal)}
                      </span>
                    </div>

                    {/* Configurable DP Selector */}
                    <div className="space-y-2.5 pt-2 border-t border-[#171717]/12">
                      <label className="block font-mono text-[10px] uppercase tracking-wider text-[#171717]/65">
                        Down Payment Structure
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        {(
                          [
                            ['PERCENT_30', '30% DP'],
                            ['PERCENT_50', '50% DP'],
                            ['CUSTOM_PERCENT', 'Custom %'],
                            ['CUSTOM_AMOUNT', 'Custom Rp'],
                          ] as const
                        ).map(([mode, label]) => (
                          <button
                            key={mode}
                            type="button"
                            onClick={() => setFormDpMode(mode)}
                            className={`px-3 py-2 text-xs font-semibold border transition-colors cursor-pointer ${
                              formDpMode === mode
                                ? 'bg-[#171717] text-[#D8FF3E] border-[#171717]'
                                : 'bg-white text-[#171717] border-[#171717]/20 hover:border-[#171717]'
                            }`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>

                      {formDpMode === 'CUSTOM_PERCENT' && (
                        <div>
                          <label className="block text-xs text-[#171717]/70 mb-1">
                            Custom DP Percentage (%)
                          </label>
                          <input
                            type="number"
                            min={0}
                            max={100}
                            step={5}
                            value={formCustomDpPercent}
                            onChange={(e) => setFormCustomDpPercent(e.target.value)}
                            className="w-full px-3 py-2 bg-white border border-[#171717]/20 text-sm text-right tabular-nums"
                          />
                        </div>
                      )}

                      {formDpMode === 'CUSTOM_AMOUNT' && (
                        <div>
                          <label className="block text-xs text-[#171717]/70 mb-1">
                            Custom DP Amount (Rp)
                          </label>
                          <input
                            type="number"
                            min={0}
                            step={10000}
                            value={formCustomDpAmount}
                            onChange={(e) => setFormCustomDpAmount(e.target.value)}
                            className="w-full px-3 py-2 bg-white border border-[#171717]/20 text-sm text-right tabular-nums"
                          />
                        </div>
                      )}
                    </div>

                    <div className="space-y-1.5 text-sm pt-2 border-t border-[#171717]/12">
                      <div className="flex justify-between">
                        <span className="text-[#171717]/70">
                          Down Payment ({liveFinancials.dpPercent}%)
                        </span>
                        <span className="font-bold tabular-nums">
                          {formatRp(liveFinancials.downPaymentAmount)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#171717]/70">Paid to Date</span>
                        <span className="font-semibold text-[#16A34A] tabular-nums">
                          {formatRp(liveFinancials.amountPaid)}
                        </span>
                      </div>
                      <div className="flex justify-between font-bold text-base pt-1">
                        <span>Remaining Balance</span>
                        <span className="tabular-nums">
                          {formatRp(liveFinancials.remainingBalance)}
                        </span>
                      </div>
                    </div>

                    <p className="text-[11px] text-[#171717]/60 leading-relaxed pt-2 border-t border-[#171717]/12">
                      Drafts remain editable. Finalizing preserves client, wedding, and financial breakdown against later package or booking edits while still letting you record payments.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="px-6 py-4 bg-[#FAF8F4] border-t border-[#171717]/15 flex flex-wrap items-center justify-between gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setEditorOpen(false)}
                className="px-4 py-2 border border-[#171717]/20 text-xs font-semibold hover:border-[#171717] cursor-pointer"
              >
                Cancel
              </button>

              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => handleSaveInvoice(false, true)}
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-[#171717] text-xs font-semibold hover:bg-[#F5F1E9] disabled:opacity-50 cursor-pointer"
                >
                  {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Save Draft & Preview
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => handleSaveInvoice(true, true)}
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#171717] text-[#D8FF3E] text-xs font-bold hover:bg-[#171717]/90 disabled:opacity-50 cursor-pointer"
                >
                  {saving ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Lock className="w-3.5 h-3.5" />
                  )}
                  Finalize & Preview PDF
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PREVIEW & EXPORT MODAL */}
      {previewInvoice && (
        <div className="fixed inset-0 z-50 bg-black/65 flex items-center justify-center p-3 sm:p-6">
          <div className="bg-[#EFECE6] border border-[#171717] w-full max-w-5xl max-h-[94vh] flex flex-col">
            <div className="px-5 py-3.5 bg-[#171717] text-white flex flex-wrap items-center justify-between gap-3 shrink-0">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-widest text-[#D8FF3E]">
                  A4 Invoice Preview · {previewInvoice.invoiceNumber}
                </p>
                <p className="text-xs text-white/75 mt-0.5">
                  {previewInvoice.clientName} · {INVOICE_LIFECYCLE_LABELS[previewInvoice.lifecycleStatus]}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {previewInvoice.lifecycleStatus === 'DRAFT' && (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setPreviewInvoice(null);
                        openEditDraftModal(previewInvoice);
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/10 text-white text-xs font-semibold hover:bg-white/20 cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      Edit Draft
                    </button>
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => handleFinalizeFromPreview(previewInvoice)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#D8FF3E] text-[#171717] text-xs font-bold hover:opacity-90 cursor-pointer"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Finalize
                    </button>
                  </>
                )}

                {previewInvoice.lifecycleStatus !== 'VOID' && (
                  <button
                    type="button"
                    onClick={() => openPaymentModal(previewInvoice)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/10 text-white text-xs font-semibold hover:bg-white/20 cursor-pointer"
                  >
                    <Wallet className="w-3.5 h-3.5" />
                    Record Payment
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => downloadInvoicePdf(previewInvoice)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-white text-[#171717] text-xs font-bold hover:bg-[#D8FF3E] cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download A4 PDF
                </button>

                <a
                  href={buildWhatsappInvoiceUrl({
                    clientWhatsapp: previewInvoice.clientWhatsapp,
                    clientName: previewInvoice.clientName,
                    invoiceNumber: previewInvoice.invoiceNumber,
                    weddingDate: previewInvoice.weddingDate,
                    packageName: previewInvoice.packageName,
                    grandTotal: previewInvoice.grandTotal,
                    downPaymentAmount: previewInvoice.downPaymentAmount,
                    amountPaid: previewInvoice.amountPaid,
                    remainingBalance: previewInvoice.remainingBalance,
                    dueDate: previewInvoice.dueDate,
                    bankName: previewInvoice.bankName,
                    bankAccountNumber: previewInvoice.bankAccountNumber,
                    bankAccountHolder: previewInvoice.bankAccountHolder,
                  })}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-[#16A34A] text-white text-xs font-bold hover:bg-[#15803D]"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  Share WhatsApp
                </a>

                <button
                  type="button"
                  onClick={() => setPreviewInvoice(null)}
                  className="p-1.5 text-white/75 hover:text-white cursor-pointer"
                  aria-label="Close preview"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 sm:p-8">
              <InvoicePreviewA4 invoice={previewInvoice} />
            </div>
          </div>
        </div>
      )}

      {/* RECORD PAYMENT & STATUS MODAL */}
      {paymentModalInvoice && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white border border-[#171717] w-full max-w-xl max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 bg-[#171717] text-white flex items-center justify-between shrink-0">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-widest text-[#D8FF3E]">
                  {paymentModalInvoice.invoiceNumber}
                </p>
                <h3 className="font-display text-lg font-bold">
                  Payments & Status · {paymentModalInvoice.clientName}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setPaymentModalInvoice(null)}
                className="p-1 text-white/75 hover:text-white cursor-pointer"
                aria-label="Close payment modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              <div className="grid grid-cols-3 gap-3 bg-[#FAF8F4] border border-[#171717]/12 p-4">
                <div>
                  <p className="font-mono text-[10px] uppercase text-[#171717]/55">Grand Total</p>
                  <p className="text-sm font-bold tabular-nums mt-0.5">
                    {formatRp(paymentModalInvoice.grandTotal)}
                  </p>
                </div>
                <div>
                  <p className="font-mono text-[10px] uppercase text-[#171717]/55">Amount Paid</p>
                  <p className="text-sm font-bold text-[#16A34A] tabular-nums mt-0.5">
                    {formatRp(paymentModalInvoice.amountPaid)}
                  </p>
                </div>
                <div>
                  <p className="font-mono text-[10px] uppercase text-[#171717]/55">Remaining</p>
                  <p className="text-sm font-bold tabular-nums mt-0.5">
                    {formatRp(paymentModalInvoice.remainingBalance)}
                  </p>
                </div>
              </div>

              {/* Add Payment Form */}
              <form onSubmit={handleRecordPaymentSubmit} className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="font-mono text-[10px] uppercase tracking-wider font-bold text-[#171717]">
                    Record New Payment
                  </p>
                  <div className="flex items-center gap-2">
                    {paymentModalInvoice.downPaymentAmount > 0 && (
                      <button
                        type="button"
                        onClick={() =>
                          setPayAmount(String(paymentModalInvoice.downPaymentAmount))
                        }
                        className="text-[11px] font-mono underline text-[#171717]/75 hover:text-[#171717] cursor-pointer"
                      >
                        Fill DP ({formatRp(paymentModalInvoice.downPaymentAmount)})
                      </button>
                    )}
                    {paymentModalInvoice.remainingBalance > 0 && (
                      <button
                        type="button"
                        onClick={() =>
                          setPayAmount(String(paymentModalInvoice.remainingBalance))
                        }
                        className="text-[11px] font-mono underline text-[#171717]/75 hover:text-[#171717] cursor-pointer"
                      >
                        Fill Balance
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium mb-1">Payment Date</label>
                    <input
                      type="date"
                      value={payDate}
                      onChange={(e) => setPayDate(e.target.value)}
                      required
                      className="w-full px-3 py-2 border border-[#171717]/20 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">Amount (Rp)</label>
                    <input
                      type="number"
                      min={1}
                      value={payAmount}
                      onChange={(e) => setPayAmount(e.target.value)}
                      placeholder="e.g. 250000"
                      required
                      className="w-full px-3 py-2 border border-[#171717]/20 text-sm text-right tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">Method</label>
                    <input
                      type="text"
                      value={payMethod}
                      onChange={(e) => setPayMethod(e.target.value)}
                      placeholder="Bank Transfer BCA / QRIS / Cash"
                      required
                      className="w-full px-3 py-2 border border-[#171717]/20 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">Note (Optional)</label>
                    <input
                      type="text"
                      value={payNote}
                      onChange={(e) => setPayNote(e.target.value)}
                      placeholder="e.g. 30% DP Settlement"
                      className="w-full px-3 py-2 border border-[#171717]/20 text-sm"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={saving}
                  className="w-full py-2.5 bg-[#171717] text-[#D8FF3E] text-xs font-bold hover:bg-[#171717]/90 disabled:opacity-50 cursor-pointer"
                >
                  {saving ? 'Recording...' : 'Record Payment Transaction'}
                </button>
              </form>

              {/* Payment History */}
              <div className="border-t border-[#171717]/12 pt-4">
                <p className="font-mono text-[10px] uppercase tracking-wider font-bold text-[#171717]/65 mb-2">
                  Transaction History ({paymentModalInvoice.payments?.length || 0})
                </p>
                {!paymentModalInvoice.payments || paymentModalInvoice.payments.length === 0 ? (
                  <p className="text-xs text-[#171717]/55">No payments recorded yet.</p>
                ) : (
                  <div className="space-y-1.5">
                    {paymentModalInvoice.payments.map((p) => (
                      <div
                        key={p.id}
                        className="flex items-center justify-between text-xs py-2 px-3 bg-[#FAF8F4] border border-[#171717]/10"
                      >
                        <div>
                          <span className="font-semibold">{p.method}</span> ·{' '}
                          <span className="tabular-nums">{formatDisplayDate(p.date)}</span>
                          {p.note && <span className="text-[#171717]/60"> · {p.note}</span>}
                        </div>
                        <span className="font-bold text-[#16A34A] tabular-nums">
                          {formatRp(p.amount)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Manual Payment Status & Notes */}
              <div className="border-t border-[#171717]/12 pt-4 space-y-3">
                <p className="font-mono text-[10px] uppercase tracking-wider font-bold text-[#171717]/65">
                  Manual Status & Notes
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium mb-1">Payment Status</label>
                    <select
                      value={overridePaymentStatus}
                      onChange={(e) =>
                        setOverridePaymentStatus(e.target.value as InvoicePaymentStatus)
                      }
                      className="w-full px-3 py-2 border border-[#171717]/20 text-sm bg-white"
                    >
                      {(['UNPAID', 'PARTIALLY_PAID', 'PAID', 'OVERDUE'] as const).map((s) => (
                        <option key={s} value={s}>
                          {INVOICE_PAYMENT_STATUS_LABELS[s]}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Invoice Notes</label>
                  <textarea
                    rows={2}
                    value={editFinalizedNotes}
                    onChange={(e) => setEditFinalizedNotes(e.target.value)}
                    className="w-full px-3 py-2 border border-[#171717]/20 text-xs"
                  />
                </div>
                <button
                  type="button"
                  disabled={saving}
                  onClick={handleSaveStatusAndNotes}
                  className="px-4 py-2 border border-[#171717] text-xs font-semibold hover:bg-[#171717] hover:text-white transition-colors cursor-pointer"
                >
                  Save Status & Notes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* BANK & DEFAULT INVOICE SETTINGS MODAL */}
      {settingsModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white border border-[#171717] w-full max-w-lg max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 bg-[#171717] text-white flex items-center justify-between shrink-0">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-widest text-[#D8FF3E]">
                  Invoice Defaults
                </p>
                <h3 className="font-display text-lg font-bold">Bank Account & Payment Terms</h3>
              </div>
              <button
                type="button"
                onClick={() => setSettingsModalOpen(false)}
                className="p-1 text-white/75 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveBankSettings} className="flex-1 overflow-y-auto p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold mb-1">Bank Name</label>
                <input
                  type="text"
                  value={cfgBankName}
                  onChange={(e) => setCfgBankName(e.target.value)}
                  placeholder="e.g. Bank Central Asia (BCA)"
                  className="w-full px-3 py-2 border border-[#171717]/20 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Account Number</label>
                <input
                  type="text"
                  value={cfgBankAccNo}
                  onChange={(e) => setCfgBankAccNo(e.target.value)}
                  placeholder="e.g. 1234567890"
                  className="w-full px-3 py-2 border border-[#171717]/20 text-sm font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Account Holder Name</label>
                <input
                  type="text"
                  value={cfgBankHolder}
                  onChange={(e) => setCfgBankHolder(e.target.value)}
                  placeholder="e.g. UNSCRIPTED STUDIO"
                  className="w-full px-3 py-2 border border-[#171717]/20 text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1">Default Due Days</label>
                  <input
                    type="number"
                    min={0}
                    max={365}
                    value={cfgDueDays}
                    onChange={(e) => setCfgDueDays(e.target.value)}
                    className="w-full px-3 py-2 border border-[#171717]/20 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Default Down Payment</label>
                  <select
                    value={cfgDefaultDpMode}
                    onChange={(e) =>
                      setCfgDefaultDpMode(e.target.value as 'PERCENT_30' | 'PERCENT_50')
                    }
                    className="w-full px-3 py-2 border border-[#171717]/20 text-sm bg-white"
                  >
                    <option value="PERCENT_30">30% Down Payment</option>
                    <option value="PERCENT_50">50% Down Payment</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">
                  Default Payment Instructions
                </label>
                <textarea
                  rows={3}
                  value={cfgInstructions}
                  onChange={(e) => setCfgInstructions(e.target.value)}
                  className="w-full px-3 py-2 border border-[#171717]/20 text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">
                  Default Thank-You Message
                </label>
                <textarea
                  rows={2}
                  value={cfgThankYou}
                  onChange={(e) => setCfgThankYou(e.target.value)}
                  className="w-full px-3 py-2 border border-[#171717]/20 text-xs"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setSettingsModalOpen(false)}
                  className="px-4 py-2 border border-[#171717]/20 text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 bg-[#171717] text-[#D8FF3E] text-xs font-bold cursor-pointer disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Save Settings'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE DRAFT CONFIRMATION */}
      {deletingDraft && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white border border-[#171717] max-w-md w-full p-6 space-y-4">
            <h3 className="font-display text-lg font-bold">Delete Draft Invoice?</h3>
            <p className="text-sm text-[#171717]/75">
              Permanently remove draft <span className="font-mono font-bold">{deletingDraft.invoiceNumber}</span> for{' '}
              <strong>{deletingDraft.clientName}</strong>? Finalized invoices cannot be deleted.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeletingDraft(null)}
                className="px-4 py-2 border border-[#171717]/20 text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={handleConfirmDeleteDraft}
                className="px-4 py-2 bg-[#DC2626] text-white text-xs font-bold cursor-pointer disabled:opacity-50"
              >
                Delete Draft
              </button>
            </div>
          </div>
        </div>
      )}

      {/* VOID FINALIZED INVOICE CONFIRMATION */}
      {voidingInvoice && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white border border-[#171717] max-w-md w-full p-6 space-y-4">
            <h3 className="font-display text-lg font-bold">Void Finalized Invoice?</h3>
            <p className="text-sm text-[#171717]/75">
              Voiding <span className="font-mono font-bold">{voidingInvoice.invoiceNumber}</span> preserves the sequential record for audit purposes and removes it from active revenue totals, allowing a replacement invoice to be generated for booking{' '}
              <span className="font-mono">{voidingInvoice.bookingCode}</span>.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setVoidingInvoice(null)}
                className="px-4 py-2 border border-[#171717]/20 text-xs font-semibold cursor-pointer"
              >
                Keep Active
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={handleConfirmVoid}
                className="px-4 py-2 bg-[#171717] text-[#FF5A55] text-xs font-bold cursor-pointer disabled:opacity-50"
              >
                Confirm Void
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
