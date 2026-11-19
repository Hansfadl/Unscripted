import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocFromServer,
  getDocs,
  getDocsFromServer,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';
import type { User } from 'firebase/auth';
import { deleteObject, getDownloadURL, ref, uploadBytesResumable } from 'firebase/storage';
import {
  db,
  handleFirestoreError,
  isAuthorizedAdminEmail,
  OperationType,
  storage,
} from '../lib/firebase';
import {
  generateBookingCode,
  normalizeWhatsapp,
  PATTERNS,
  sanitizeMultilineText,
  sanitizeText,
  SCHEMA_LIMITS,
  slugify,
} from '../lib/validation';
import {
  DEFAULT_HOMEPAGE_CONFIG,
  DEFAULT_INVOICE_SETTINGS,
  DEFAULT_SITE_SETTINGS,
  INITIAL_COUPLE_NOTES,
  INITIAL_PACKAGES,
} from '../data/defaults';
import type {
  ActivityEntityType,
  ActivityLog,
  AvailabilityEntry,
  AvailabilityStatus,
  BookingRecord,
  BookingStatus,
  CoupleNote,
  CustomerRecord,
  FocalPoint,
  HomepageConfig,
  HomepageGalleryItem,
  InvoiceDpMode,
  InvoiceLineItem,
  InvoicePaymentRecord,
  InvoicePaymentStatus,
  InvoiceRecord,
  InvoiceSettings,
  PaymentStatus,
  PortfolioItem,
  ServicePackage,
  SiteSettings,
} from '../types/unscripted';

// --- Public Reads ---

export async function fetchPublicSettings(): Promise<SiteSettings> {
  const path = 'settings/public';
  try {
    const snap = await getDoc(doc(db, 'settings', 'public'));
    if (!snap.exists()) {
      return DEFAULT_SITE_SETTINGS;
    }
    return { ...DEFAULT_SITE_SETTINGS, ...(snap.data() as Partial<SiteSettings>) };
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function fetchActivePackages(): Promise<ServicePackage[]> {
  const path = 'packages';
  try {
    const q = query(collection(db, 'packages'), where('isActive', '==', true));
    const snap = await getDocs(q);
    if (snap.empty) {
      return INITIAL_PACKAGES.map((pkg) => ({ ...pkg }));
    }
    const items = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ServicePackage, 'id'>) }));
    return items.sort((a, b) => (a.sortOrder ?? 99) - (b.sortOrder ?? 99));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

function sortPortfolioByDateDesc(items: PortfolioItem[]): PortfolioItem[] {
  return [...items].sort((a, b) => (b.eventDate || '').localeCompare(a.eventDate || ''));
}

export async function fetchPublishedPortfolio(): Promise<PortfolioItem[]> {
  const path = 'portfolio';
  try {
    const q = query(collection(db, 'portfolio'), where('published', '==', true));
    let snap;
    try {
      snap = await getDocsFromServer(q);
    } catch {
      snap = await getDocs(q);
    }
    const items = snap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as Omit<PortfolioItem, 'id'>),
    }));
    return sortPortfolioByDateDesc(items);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function fetchPublishedPortfolioBySlug(slug: string): Promise<PortfolioItem | null> {
  const path = 'portfolio';
  try {
    const q = query(
      collection(db, 'portfolio'),
      where('published', '==', true),
      where('slug', '==', slug)
    );
    let snap;
    try {
      snap = await getDocsFromServer(q);
    } catch {
      snap = await getDocs(q);
    }
    if (snap.empty) {
      return null;
    }
    const first = snap.docs[0];
    return { id: first.id, ...(first.data() as Omit<PortfolioItem, 'id'>) };
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export function subscribePublishedPortfolio(
  onData: (items: PortfolioItem[]) => void,
  onError: (error: Error) => void
): Unsubscribe {
  const q = query(collection(db, 'portfolio'), where('published', '==', true));
  return onSnapshot(
    q,
    (snap) => {
      const items = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<PortfolioItem, 'id'>),
      }));
      onData(sortPortfolioByDateDesc(items));
    },
    (error) => {
      console.error('Firestore Error (subscribePublishedPortfolio):', error);
      onError(error instanceof Error ? error : new Error('Failed to load published portfolio.'));
    }
  );
}

export function subscribePublishedPortfolioBySlug(
  slug: string,
  onData: (item: PortfolioItem | null) => void,
  onError: (error: Error) => void
): Unsubscribe {
  const q = query(
    collection(db, 'portfolio'),
    where('published', '==', true),
    where('slug', '==', slug)
  );
  return onSnapshot(
    q,
    (snap) => {
      if (snap.empty) {
        onData(null);
        return;
      }
      const first = snap.docs[0];
      onData({ id: first.id, ...(first.data() as Omit<PortfolioItem, 'id'>) });
    },
    (error) => {
      console.error('Firestore Error (subscribePublishedPortfolioBySlug):', error);
      onError(error instanceof Error ? error : new Error('Failed to load portfolio story.'));
    }
  );
}

export async function fetchPublicAvailability(): Promise<AvailabilityEntry[]> {
  const path = 'availability';
  try {
    const snap = await getDocs(collection(db, 'availability'));
    return snap.docs.map((d) => d.data() as AvailabilityEntry);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

function sortCoupleNotes(items: CoupleNote[]): CoupleNote[] {
  return [...items].sort((a, b) => (a.sortOrder ?? 99) - (b.sortOrder ?? 99));
}

export function subscribePublishedCoupleNotes(
  onData: (items: CoupleNote[]) => void,
  onError: (error: Error) => void
): Unsubscribe {
  const q = query(collection(db, 'couple_notes'), where('published', '==', true));
  return onSnapshot(
    q,
    (snap) => {
      const items = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<CoupleNote, 'id'>),
      }));
      onData(sortCoupleNotes(items));
    },
    (error) => {
      console.error('Firestore Error (subscribePublishedCoupleNotes):', error);
      onError(error instanceof Error ? error : new Error('Failed to load couple notes.'));
    }
  );
}

// --- Public Booking Submission ---

export interface PublicBookingInput {
  coupleName: string;
  whatsappNumber: string;
  email?: string;
  eventDate: string;
  eventLocation: string;
  eventType: string;
  packageId: string;
  packageName: string;
  packagePrice: number;
  notes?: string;
}

export async function submitPublicBooking(
  input: PublicBookingInput
): Promise<BookingRecord> {
  const coupleName = sanitizeText(input.coupleName, SCHEMA_LIMITS.coupleNameMax);
  const whatsappNumber = sanitizeText(input.whatsappNumber, SCHEMA_LIMITS.whatsappMax);
  const normalizedWhatsapp = normalizeWhatsapp(whatsappNumber);
  const email = input.email ? sanitizeText(input.email, SCHEMA_LIMITS.emailMax) : '';
  const eventDate = input.eventDate.trim();
  const eventLocation = sanitizeText(input.eventLocation, SCHEMA_LIMITS.locationMax);
  const eventType = sanitizeText(input.eventType, SCHEMA_LIMITS.eventTypeMax);
  const notes = input.notes ? sanitizeMultilineText(input.notes, SCHEMA_LIMITS.notesMax) : '';

  if (coupleName.length < SCHEMA_LIMITS.coupleNameMin) {
    throw new Error('Please enter the couple name (at least 2 characters).');
  }
  if (!PATTERNS.whatsappInput.test(whatsappNumber) || !PATTERNS.normalizedWhatsapp.test(normalizedWhatsapp)) {
    throw new Error('Please enter a valid WhatsApp number.');
  }
  if (email && !PATTERNS.email.test(email)) {
    throw new Error('Please enter a valid email address.');
  }
  if (!PATTERNS.dateStr.test(eventDate)) {
    throw new Error('Please select a valid event date.');
  }
  if (eventLocation.length < SCHEMA_LIMITS.locationMin) {
    throw new Error('Please enter the event location.');
  }
  if (eventType.length < SCHEMA_LIMITS.eventTypeMin) {
    throw new Error('Please select or enter an event type.');
  }

  const bookingCode = generateBookingCode();
  const path = `bookings/${bookingCode}`;

  const payload: Record<string, unknown> = {
    bookingCode,
    coupleName,
    whatsappNumber,
    normalizedWhatsapp,
    eventDate,
    eventLocation,
    eventType,
    packageId: input.packageId,
    packageName: sanitizeText(input.packageName, 80),
    packagePrice: Number(input.packagePrice),
    status: 'NEW_INQUIRY',
    paymentStatus: 'UNPAID',
    source: 'PUBLIC_WEB',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  if (email) {
    payload.email = email;
  }
  if (notes) {
    payload.notes = notes;
  }

  try {
    await setDoc(doc(db, 'bookings', bookingCode), payload);
    return {
      id: bookingCode,
      bookingCode,
      coupleName,
      whatsappNumber,
      normalizedWhatsapp,
      email: email || undefined,
      eventDate,
      eventLocation,
      eventType,
      packageId: input.packageId,
      packageName: sanitizeText(input.packageName, 80),
      packagePrice: Number(input.packagePrice),
      notes: notes || undefined,
      status: 'NEW_INQUIRY',
      paymentStatus: 'UNPAID',
      source: 'PUBLIC_WEB',
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

// --- Admin Activity Logging ---

export async function logAdminActivity(
  actor: User,
  action: string,
  entityType: ActivityEntityType,
  entityId: string,
  summary: string
): Promise<void> {
  const logId = `log_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const path = `activity_logs/${logId}`;
  try {
    await setDoc(doc(db, 'activity_logs', logId), {
      action: sanitizeText(action, 80),
      entityType,
      entityId: sanitizeText(entityId, 128),
      summary: sanitizeText(summary, 300),
      actorUid: actor.uid,
      actorEmail: actor.email || 'admin',
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

// --- Admin Bootstrap & Seeding ---

export async function syncAdminProfile(user: User): Promise<void> {
  const path = `users/${user.uid}`;
  const normalizedEmail = (user.email || '').trim().toLowerCase();
  if (!user.uid || !normalizedEmail || !user.emailVerified) {
    throw new Error('Authenticated UID and verified email are required for admin access.');
  }
  try {
    const userRef = doc(db, 'users', user.uid);
    let snap;
    try {
      snap = await getDocFromServer(userRef);
    } catch {
      snap = await getDoc(userRef);
    }
    if (!snap.exists()) {
      await setDoc(userRef, {
        uid: user.uid,
        email: normalizedEmail,
        displayName: sanitizeText(user.displayName || normalizedEmail || 'UNSCRIPTED Admin', 120),
        role: 'admin',
        ...(user.photoURL ? { photoURL: user.photoURL.slice(0, 1000) } : {}),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(userRef, {
        email: normalizedEmail,
        displayName: sanitizeText(user.displayName || normalizedEmail || 'UNSCRIPTED Admin', 120),
        role: 'admin',
        ...(user.photoURL ? { photoURL: user.photoURL.slice(0, 1000) } : {}),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function verifyBackendAdminAccess(user: User | null): Promise<boolean> {
  if (!user || !user.uid || !user.email || !user.emailVerified) {
    return false;
  }

  try {
    const tokenResult = await user.getIdTokenResult();
    const claims = tokenResult.claims;
    const tokenEmail = typeof claims.email === 'string' ? claims.email.trim().toLowerCase() : '';
    const tokenUid =
      typeof claims.user_id === 'string'
        ? claims.user_id
        : typeof claims.sub === 'string'
        ? claims.sub
        : '';

    if (claims.email_verified !== true) return false;
    if (!tokenUid || tokenUid !== user.uid) return false;
    if (!tokenEmail || tokenEmail !== user.email.trim().toLowerCase()) return false;

    const hasCustomAdminClaim = claims.admin === true;
    const isAllowlistedEmail = isAuthorizedAdminEmail(tokenEmail);

    const userRef = doc(db, 'users', user.uid);
    const existingSnap = await getDocFromServer(userRef);
    const hasValidExistingDoc =
      existingSnap.exists() &&
      existingSnap.data()?.uid === user.uid &&
      typeof existingSnap.data()?.email === 'string' &&
      existingSnap.data()?.email.trim().toLowerCase() === tokenEmail &&
      existingSnap.data()?.role === 'admin';

    if (!hasCustomAdminClaim && !isAllowlistedEmail && !hasValidExistingDoc) {
      return false;
    }

    // Backend-enforced verification: Firestore security rules only allow this write/update
    // if request.auth.uid and verified request.auth.token.email satisfy backend isAdmin().
    await syncAdminProfile(user);
    const verifiedSnap = await getDocFromServer(userRef);
    return (
      verifiedSnap.exists() &&
      verifiedSnap.data()?.uid === user.uid &&
      typeof verifiedSnap.data()?.email === 'string' &&
      verifiedSnap.data()?.email.trim().toLowerCase() === tokenEmail &&
      verifiedSnap.data()?.role === 'admin'
    );
  } catch {
    return false;
  }
}

export async function seedInitialAdminDataIfNeeded(actor: User): Promise<boolean> {
  try {
    const [pkgSnap, settingsSnap, coupleNotesSnap, seedNotesLogSnap] = await Promise.all([
      getDocs(collection(db, 'packages')),
      getDoc(doc(db, 'settings', 'public')),
      getDocs(collection(db, 'couple_notes')),
      getDocs(query(collection(db, 'activity_logs'), where('action', '==', 'SEED_COUPLE_NOTES'))),
    ]);

    const batch = writeBatch(db);
    let wroteSomething = false;
    let seededCoupleNotes = false;

    if (pkgSnap.empty) {
      for (const pkg of INITIAL_PACKAGES) {
        const { id, ...rest } = pkg;
        batch.set(doc(db, 'packages', id), {
          ...rest,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      wroteSomething = true;
    }

    if (!settingsSnap.exists()) {
      batch.set(doc(db, 'settings', 'public'), {
        ...DEFAULT_SITE_SETTINGS,
        updatedAt: serverTimestamp(),
      });
      wroteSomething = true;
    }

    if (coupleNotesSnap.empty && seedNotesLogSnap.empty) {
      for (const item of INITIAL_COUPLE_NOTES) {
        const { id, ...rest } = item;
        batch.set(doc(db, 'couple_notes', id), {
          ...rest,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      wroteSomething = true;
      seededCoupleNotes = true;
    }

    if (wroteSomething) {
      await batch.commit();
      if (seededCoupleNotes) {
        await logAdminActivity(
          actor,
          'SEED_COUPLE_NOTES',
          'COUPLE_NOTE',
          'couple_notes',
          'Initialized default UNSCRIPTED couple notes in Firestore.'
        );
      }
      if (pkgSnap.empty || !settingsSnap.exists()) {
        await logAdminActivity(
          actor,
          'SEED_INITIAL_DATA',
          'SETTINGS',
          'public',
          'Initialized default UNSCRIPTED launch packages and public settings.'
        );
      }
    }
    return wroteSomething;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'packages/settings/couple_notes');
  }
}

// --- Admin Queries ---

export async function fetchAllBookings(): Promise<BookingRecord[]> {
  const path = 'bookings';
  try {
    const q = query(collection(db, 'bookings'), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as Omit<BookingRecord, 'id'>),
    }));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function fetchAllCustomers(): Promise<CustomerRecord[]> {
  const path = 'customers';
  try {
    const q = query(collection(db, 'customers'), orderBy('updatedAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as Omit<CustomerRecord, 'id'>),
    }));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function fetchAllPackagesAdmin(): Promise<ServicePackage[]> {
  const path = 'packages';
  try {
    const snap = await getDocs(collection(db, 'packages'));
    const items = snap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as Omit<ServicePackage, 'id'>),
    }));
    return items.sort((a, b) => (a.sortOrder ?? 99) - (b.sortOrder ?? 99));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function fetchAllPortfolioAdmin(): Promise<PortfolioItem[]> {
  const path = 'portfolio';
  try {
    let snap;
    try {
      snap = await getDocsFromServer(collection(db, 'portfolio'));
    } catch {
      snap = await getDocs(collection(db, 'portfolio'));
    }
    const items = snap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as Omit<PortfolioItem, 'id'>),
    }));
    return sortPortfolioByDateDesc(items);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export function subscribeAllPortfolioAdmin(
  onData: (items: PortfolioItem[]) => void,
  onError: (error: Error) => void
): Unsubscribe {
  return onSnapshot(
    collection(db, 'portfolio'),
    (snap) => {
      const items = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<PortfolioItem, 'id'>),
      }));
      onData(sortPortfolioByDateDesc(items));
    },
    (error) => {
      console.error('Firestore Error (subscribeAllPortfolioAdmin):', error);
      onError(error instanceof Error ? error : new Error('Failed to load portfolio stories.'));
    }
  );
}

export function subscribeAllCoupleNotesAdmin(
  onData: (items: CoupleNote[]) => void,
  onError: (error: Error) => void
): Unsubscribe {
  return onSnapshot(
    collection(db, 'couple_notes'),
    (snap) => {
      const items = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<CoupleNote, 'id'>),
      }));
      onData(sortCoupleNotes(items));
    },
    (error) => {
      console.error('Firestore Error (subscribeAllCoupleNotesAdmin):', error);
      onError(error instanceof Error ? error : new Error('Failed to load couple notes.'));
    }
  );
}

export async function saveCoupleNote(
  actor: User,
  item: Omit<CoupleNote, 'createdAt' | 'updatedAt'>,
  isNew: boolean
): Promise<string> {
  const coupleName = sanitizeText(item.coupleName, SCHEMA_LIMITS.coupleNameMax);
  const weddingDetails = sanitizeText(item.weddingDetails, 160);
  const note = sanitizeMultilineText(item.note, 1000);
  const description = sanitizeMultilineText(item.description || '', 1500);
  const tag = sanitizeText(item.tag || '', 60);
  const sortOrder = Math.max(0, Math.min(1000, Math.round(Number(item.sortOrder ?? 1))));

  if (coupleName.length < SCHEMA_LIMITS.coupleNameMin) {
    throw new Error('Couple name must be at least 2 characters.');
  }
  if (weddingDetails.length < 2) {
    throw new Error('Wedding details must be at least 2 characters.');
  }
  if (note.length < 2) {
    throw new Error('Couple note / quote must be at least 2 characters.');
  }

  let id = item.id || slugify(`note-${coupleName}`) || `note-${Date.now()}`;
  if (isNew) {
    const existingSnap = await getDoc(doc(db, 'couple_notes', id));
    if (existingSnap.exists()) {
      id = `${id.slice(0, 100)}-${Date.now().toString(36).slice(-4)}`;
    }
  }

  const path = `couple_notes/${id}`;
  const payload = {
    coupleName,
    weddingDetails,
    note,
    description,
    tag,
    published: Boolean(item.published),
    sortOrder,
    updatedAt: serverTimestamp(),
  };

  try {
    if (isNew) {
      await setDoc(doc(db, 'couple_notes', id), {
        ...payload,
        createdAt: serverTimestamp(),
      });
    } else {
      await updateDoc(doc(db, 'couple_notes', id), payload);
    }
    await logAdminActivity(
      actor,
      isNew ? 'CREATE_COUPLE_NOTE' : 'UPDATE_COUPLE_NOTE',
      'COUPLE_NOTE',
      id,
      `${isNew ? 'Created' : 'Updated'} couple note for ${coupleName}`
    );
    return id;
  } catch (error) {
    handleFirestoreError(error, isNew ? OperationType.CREATE : OperationType.UPDATE, path);
  }
}

export async function deleteCoupleNote(actor: User, noteId: string): Promise<void> {
  const path = `couple_notes/${noteId}`;
  try {
    await deleteDoc(doc(db, 'couple_notes', noteId));
    await logAdminActivity(
      actor,
      'DELETE_COUPLE_NOTE',
      'COUPLE_NOTE',
      noteId,
      `Deleted couple note ${noteId}`
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function fetchRecentActivityLogs(): Promise<ActivityLog[]> {
  const path = 'activity_logs';
  try {
    const q = query(collection(db, 'activity_logs'), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.slice(0, 30).map((d) => ({
      id: d.id,
      ...(d.data() as Omit<ActivityLog, 'id'>),
    }));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

// --- Customer Deduplication & Reconciliation ---

export async function upsertCustomerForBooking(
  booking: {
    coupleName: string;
    whatsappNumber: string;
    normalizedWhatsapp: string;
    email?: string;
    eventDate: string;
  },
  existingCustomers?: CustomerRecord[]
): Promise<string> {
  const norm = booking.normalizedWhatsapp;
  const customers = existingCustomers ?? (await fetchAllCustomers());
  const match = customers.find((c) => c.normalizedWhatsapp === norm);

  if (match) {
    const path = `customers/${match.id}`;
    try {
      await updateDoc(doc(db, 'customers', match.id), {
        coupleName: booking.coupleName,
        whatsappNumber: booking.whatsappNumber,
        ...(booking.email ? { email: booking.email } : {}),
        totalBookings: (match.totalBookings || 0) + 1,
        lastBookingDate:
          !match.lastBookingDate || booking.eventDate > match.lastBookingDate
            ? booking.eventDate
            : match.lastBookingDate,
        updatedAt: serverTimestamp(),
      });
      return match.id;
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  }

  const customerId = `cust_${norm}`;
  const path = `customers/${customerId}`;
  try {
    await setDoc(doc(db, 'customers', customerId), {
      coupleName: booking.coupleName,
      whatsappNumber: booking.whatsappNumber,
      normalizedWhatsapp: norm,
      ...(booking.email ? { email: booking.email } : {}),
      notes: '',
      totalBookings: 1,
      lastBookingDate: booking.eventDate,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return customerId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function reconcileUnlinkedBookings(
  bookings: BookingRecord[],
  customers: CustomerRecord[]
): Promise<boolean> {
  const unlinked = bookings.filter((b) => !b.customerId);
  if (unlinked.length === 0) return false;

  const customerByPhone = new Map<string, CustomerRecord>();
  for (const c of customers) {
    customerByPhone.set(c.normalizedWhatsapp, c);
  }

  let updatedAny = false;
  for (const b of unlinked) {
    const norm = b.normalizedWhatsapp;
    const existing = customerByPhone.get(norm);
    const customerId = `cust_${norm}`;
    const bookingCountForPhone = bookings.filter((item) => item.normalizedWhatsapp === norm).length;
    const latestDate = bookings
      .filter((item) => item.normalizedWhatsapp === norm)
      .map((item) => item.eventDate)
      .sort()
      .reverse()[0];

    try {
      if (existing) {
        await updateDoc(doc(db, 'customers', existing.id), {
          coupleName: b.coupleName,
          whatsappNumber: b.whatsappNumber,
          ...(b.email ? { email: b.email } : {}),
          totalBookings: bookingCountForPhone,
          lastBookingDate: latestDate || b.eventDate,
          updatedAt: serverTimestamp(),
        });
        await updateDoc(doc(db, 'bookings', b.id), {
          customerId: existing.id,
          updatedAt: serverTimestamp(),
        });
      } else {
        const newCustomer: CustomerRecord = {
          id: customerId,
          coupleName: b.coupleName,
          whatsappNumber: b.whatsappNumber,
          normalizedWhatsapp: norm,
          email: b.email,
          notes: '',
          totalBookings: bookingCountForPhone,
          lastBookingDate: latestDate || b.eventDate,
        };
        await setDoc(doc(db, 'customers', customerId), {
          coupleName: b.coupleName,
          whatsappNumber: b.whatsappNumber,
          normalizedWhatsapp: norm,
          ...(b.email ? { email: b.email } : {}),
          notes: '',
          totalBookings: bookingCountForPhone,
          lastBookingDate: latestDate || b.eventDate,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        customerByPhone.set(norm, newCustomer);
        await updateDoc(doc(db, 'bookings', b.id), {
          customerId,
          updatedAt: serverTimestamp(),
        });
      }
      updatedAny = true;
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `bookings/${b.id}`);
    }
  }
  return updatedAny;
}

// --- Admin Booking Mutations ---

export interface ManualBookingInput {
  coupleName: string;
  whatsappNumber: string;
  email?: string;
  eventDate: string;
  eventLocation: string;
  eventType: string;
  packageId: string;
  packageName: string;
  packagePrice: number;
  amountPaid?: number;
  notes?: string;
  status: BookingStatus;
  paymentStatus: PaymentStatus;
}

export async function createManualBooking(
  actor: User,
  input: ManualBookingInput
): Promise<string> {
  const bookingCode = generateBookingCode();
  const coupleName = sanitizeText(input.coupleName, SCHEMA_LIMITS.coupleNameMax);
  const whatsappNumber = sanitizeText(input.whatsappNumber, SCHEMA_LIMITS.whatsappMax);
  const normalizedWhatsapp = normalizeWhatsapp(whatsappNumber);
  const email = input.email ? sanitizeText(input.email, SCHEMA_LIMITS.emailMax) : '';
  const notes = input.notes ? sanitizeMultilineText(input.notes, SCHEMA_LIMITS.notesMax) : '';

  const customerId = await upsertCustomerForBooking({
    coupleName,
    whatsappNumber,
    normalizedWhatsapp,
    email: email || undefined,
    eventDate: input.eventDate,
  });

  const path = `bookings/${bookingCode}`;
  try {
    await setDoc(doc(db, 'bookings', bookingCode), {
      bookingCode,
      coupleName,
      whatsappNumber,
      normalizedWhatsapp,
      ...(email ? { email } : {}),
      eventDate: input.eventDate,
      eventLocation: sanitizeText(input.eventLocation, SCHEMA_LIMITS.locationMax),
      eventType: sanitizeText(input.eventType, SCHEMA_LIMITS.eventTypeMax),
      packageId: input.packageId,
      packageName: sanitizeText(input.packageName, 80),
      packagePrice: Number(input.packagePrice),
      amountPaid: Number(input.amountPaid || 0),
      ...(notes ? { notes } : {}),
      status: input.status,
      paymentStatus: input.paymentStatus,
      customerId,
      source: 'ADMIN_MANUAL',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    await logAdminActivity(
      actor,
      'CREATE_MANUAL_BOOKING',
      'BOOKING',
      bookingCode,
      `Created manual booking ${bookingCode} for ${coupleName}`
    );
    return bookingCode;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateBookingRecord(
  actor: User,
  bookingId: string,
  updates: Partial<{
    coupleName: string;
    whatsappNumber: string;
    email: string;
    eventDate: string;
    eventLocation: string;
    eventType: string;
    packageId: string;
    packageName: string;
    packagePrice: number;
    amountPaid: number;
    notes: string;
    status: BookingStatus;
    paymentStatus: PaymentStatus;
  }>,
  summaryNote?: string
): Promise<void> {
  const path = `bookings/${bookingId}`;
  const cleanUpdates: Record<string, unknown> = {
    updatedAt: serverTimestamp(),
  };

  if (updates.coupleName !== undefined) {
    cleanUpdates.coupleName = sanitizeText(updates.coupleName, SCHEMA_LIMITS.coupleNameMax);
  }
  if (updates.whatsappNumber !== undefined) {
    const wa = sanitizeText(updates.whatsappNumber, SCHEMA_LIMITS.whatsappMax);
    cleanUpdates.whatsappNumber = wa;
    cleanUpdates.normalizedWhatsapp = normalizeWhatsapp(wa);
  }
  if (updates.email !== undefined) {
    cleanUpdates.email = sanitizeText(updates.email, SCHEMA_LIMITS.emailMax);
  }
  if (updates.eventDate !== undefined) cleanUpdates.eventDate = updates.eventDate;
  if (updates.eventLocation !== undefined) {
    cleanUpdates.eventLocation = sanitizeText(updates.eventLocation, SCHEMA_LIMITS.locationMax);
  }
  if (updates.eventType !== undefined) {
    cleanUpdates.eventType = sanitizeText(updates.eventType, SCHEMA_LIMITS.eventTypeMax);
  }
  if (updates.packageId !== undefined) cleanUpdates.packageId = updates.packageId;
  if (updates.packageName !== undefined) {
    cleanUpdates.packageName = sanitizeText(updates.packageName, 80);
  }
  if (updates.packagePrice !== undefined) cleanUpdates.packagePrice = Number(updates.packagePrice);
  if (updates.amountPaid !== undefined) cleanUpdates.amountPaid = Number(updates.amountPaid);
  if (updates.notes !== undefined) {
    cleanUpdates.notes = sanitizeMultilineText(updates.notes, SCHEMA_LIMITS.notesMax);
  }
  if (updates.status !== undefined) cleanUpdates.status = updates.status;
  if (updates.paymentStatus !== undefined) cleanUpdates.paymentStatus = updates.paymentStatus;

  try {
    await updateDoc(doc(db, 'bookings', bookingId), cleanUpdates);
    await logAdminActivity(
      actor,
      'UPDATE_BOOKING',
      'BOOKING',
      bookingId,
      summaryNote || `Updated booking ${bookingId}`
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteBookingRecord(actor: User, bookingId: string): Promise<void> {
  const path = `bookings/${bookingId}`;
  try {
    await deleteDoc(doc(db, 'bookings', bookingId));
    await logAdminActivity(
      actor,
      'DELETE_BOOKING',
      'BOOKING',
      bookingId,
      `Deleted booking ${bookingId}`
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// --- Admin Package Mutations ---

export async function saveServicePackage(
  actor: User,
  pkg: Omit<ServicePackage, 'createdAt' | 'updatedAt'>,
  isNew: boolean
): Promise<void> {
  const id = pkg.id || slugify(pkg.name) || `pkg-${Date.now()}`;
  const path = `packages/${id}`;
  const payload = {
    name: sanitizeText(pkg.name, 80),
    slug: slugify(pkg.slug || pkg.name) || id,
    price: Number(pkg.price),
    tagline: sanitizeText(pkg.tagline || '', 160),
    description: sanitizeMultilineText(pkg.description, 1500),
    coverageDetails: sanitizeMultilineText(pkg.coverageDetails || '', 1000),
    deliverables: pkg.deliverables.map((d) => sanitizeText(d, 200)).filter(Boolean).slice(0, 20),
    additionalNotes: sanitizeMultilineText(pkg.additionalNotes || '', 1000),
    isActive: Boolean(pkg.isActive),
    isFeatured: Boolean(pkg.isFeatured),
    sortOrder: Number(pkg.sortOrder || 1),
    updatedAt: serverTimestamp(),
  };

  try {
    if (isNew) {
      await setDoc(doc(db, 'packages', id), {
        ...payload,
        createdAt: serverTimestamp(),
      });
    } else {
      await updateDoc(doc(db, 'packages', id), payload);
    }
    await logAdminActivity(
      actor,
      isNew ? 'CREATE_PACKAGE' : 'UPDATE_PACKAGE',
      'PACKAGE',
      id,
      `${isNew ? 'Created' : 'Updated'} package ${payload.name}`
    );
  } catch (error) {
    handleFirestoreError(error, isNew ? OperationType.CREATE : OperationType.UPDATE, path);
  }
}

export async function deleteServicePackage(actor: User, packageId: string): Promise<void> {
  const path = `packages/${packageId}`;
  try {
    await deleteDoc(doc(db, 'packages', packageId));
    await logAdminActivity(
      actor,
      'DELETE_PACKAGE',
      'PACKAGE',
      packageId,
      `Deleted package ${packageId}`
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// --- Admin Portfolio Mutations & Storage Upload ---

export async function uploadPortfolioMedia(
  file: File,
  onProgress?: (percent: number) => void
): Promise<string> {
  const safeName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
  const storageRef = ref(storage, `portfolio/${safeName}`);
  return new Promise((resolve, reject) => {
    const task = uploadBytesResumable(storageRef, file);
    task.on(
      'state_changed',
      (snapshot) => {
        if (onProgress && snapshot.totalBytes > 0) {
          onProgress(Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100));
        }
      },
      (error) => reject(error),
      async () => {
        try {
          const url = await getDownloadURL(task.snapshot.ref);
          resolve(url);
        } catch (err) {
          reject(err);
        }
      }
    );
  });
}

export async function savePortfolioItem(
  actor: User,
  item: Omit<PortfolioItem, 'createdAt' | 'updatedAt'>,
  isNew: boolean
): Promise<string> {
  const coupleName = sanitizeText(item.coupleName, SCHEMA_LIMITS.coupleNameMax);
  const slug = slugify(item.slug || coupleName);
  const eventDate = (item.eventDate || '').trim();
  const location = sanitizeText(item.location, 160);
  const eventType = sanitizeText(item.eventType, SCHEMA_LIMITS.eventTypeMax);
  const summary = sanitizeText(item.summary, SCHEMA_LIMITS.summaryMax);
  const description = sanitizeMultilineText(item.description, SCHEMA_LIMITS.descriptionMax);
  const coverImage = (item.coverImage || '').trim().slice(0, 2000);

  if (coupleName.length < SCHEMA_LIMITS.coupleNameMin) {
    throw new Error('Couple name must be at least 2 characters.');
  }
  if (slug.length < 2 || !PATTERNS.slug.test(slug)) {
    throw new Error('URL slug must contain at least 2 lowercase letters, numbers, or hyphens.');
  }
  if (!PATTERNS.dateStr.test(eventDate)) {
    throw new Error('Please choose a valid event date (YYYY-MM-DD).');
  }
  if (location.length < SCHEMA_LIMITS.locationMin) {
    throw new Error('Location must be at least 2 characters.');
  }
  if (eventType.length < SCHEMA_LIMITS.eventTypeMin) {
    throw new Error('Event type must be at least 2 characters.');
  }
  if (summary.length < 2) {
    throw new Error('Short summary must be at least 2 characters.');
  }
  if (description.length < 2) {
    throw new Error('Event description must be at least 2 characters.');
  }
  if (!coverImage) {
    throw new Error('Cover image URL is required.');
  }

  let id = item.id || slug;
  if (isNew) {
    const existingSnap = await getDoc(doc(db, 'portfolio', id));
    if (existingSnap.exists()) {
      id = `${slug.slice(0, 100)}-${Date.now().toString(36).slice(-4)}`;
    }
  }

  const cleanMediaItems = (item.mediaItems || [])
    .filter((m) => m.url && m.url.trim().length > 0)
    .slice(0, 12)
    .map((m) => {
      const caption = sanitizeText(m.caption || '', 200);
      return {
        url: m.url.trim().slice(0, 2000),
        type: m.type,
        ...(caption ? { caption } : {}),
      };
    });

  const path = `portfolio/${id}`;
  const payload = {
    slug,
    coupleName,
    eventDate,
    location,
    eventType,
    summary,
    description,
    coverImage,
    mediaItems: cleanMediaItems,
    published: Boolean(item.published),
    featured: Boolean(item.featured),
    updatedAt: serverTimestamp(),
  };

  try {
    if (isNew) {
      await setDoc(doc(db, 'portfolio', id), {
        ...payload,
        createdAt: serverTimestamp(),
      });
    } else {
      await updateDoc(doc(db, 'portfolio', id), payload);
    }
    await logAdminActivity(
      actor,
      isNew ? 'CREATE_PORTFOLIO' : 'UPDATE_PORTFOLIO',
      'PORTFOLIO',
      id,
      `${isNew ? 'Created' : 'Updated'} portfolio story for ${payload.coupleName}`
    );
    return id;
  } catch (error) {
    handleFirestoreError(error, isNew ? OperationType.CREATE : OperationType.UPDATE, path);
  }
}

export async function deletePortfolioItem(actor: User, portfolioId: string): Promise<void> {
  const path = `portfolio/${portfolioId}`;
  try {
    await deleteDoc(doc(db, 'portfolio', portfolioId));
    await logAdminActivity(
      actor,
      'DELETE_PORTFOLIO',
      'PORTFOLIO',
      portfolioId,
      `Deleted portfolio story ${portfolioId}`
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// --- Admin Customer Mutations ---

export async function updateCustomerRecord(
  actor: User,
  customerId: string,
  updates: { coupleName?: string; whatsappNumber?: string; email?: string; notes?: string }
): Promise<void> {
  const path = `customers/${customerId}`;
  const clean: Record<string, unknown> = { updatedAt: serverTimestamp() };
  if (updates.coupleName !== undefined) {
    clean.coupleName = sanitizeText(updates.coupleName, SCHEMA_LIMITS.coupleNameMax);
  }
  if (updates.whatsappNumber !== undefined) {
    const wa = sanitizeText(updates.whatsappNumber, SCHEMA_LIMITS.whatsappMax);
    clean.whatsappNumber = wa;
    clean.normalizedWhatsapp = normalizeWhatsapp(wa);
  }
  if (updates.email !== undefined) {
    clean.email = sanitizeText(updates.email, SCHEMA_LIMITS.emailMax);
  }
  if (updates.notes !== undefined) {
    clean.notes = sanitizeMultilineText(updates.notes, 2000);
  }

  try {
    await updateDoc(doc(db, 'customers', customerId), clean);
    await logAdminActivity(
      actor,
      'UPDATE_CUSTOMER',
      'CUSTOMER',
      customerId,
      `Updated customer record ${customerId}`
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

// --- Admin Availability & Settings ---

export async function saveDateAvailability(
  actor: User,
  date: string,
  status: AvailabilityStatus,
  note?: string
): Promise<void> {
  const path = `availability/${date}`;
  try {
    await setDoc(doc(db, 'availability', date), {
      date,
      status,
      ...(note ? { note: sanitizeText(note, 300) } : {}),
      updatedAt: serverTimestamp(),
    });
    await logAdminActivity(
      actor,
      'UPDATE_AVAILABILITY',
      'AVAILABILITY',
      date,
      `Marked ${date} as ${status}`
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteDateAvailability(actor: User, date: string): Promise<void> {
  const path = `availability/${date}`;
  try {
    await deleteDoc(doc(db, 'availability', date));
    await logAdminActivity(
      actor,
      'CLEAR_AVAILABILITY',
      'AVAILABILITY',
      date,
      `Cleared availability override for ${date}`
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function savePublicSettings(actor: User, settings: SiteSettings): Promise<void> {
  const path = 'settings/public';
  try {
    await setDoc(doc(db, 'settings', 'public'), {
      brandName: sanitizeText(settings.brandName, 80),
      tagline: sanitizeText(settings.tagline, 120),
      whatsappNumber: sanitizeText(settings.whatsappNumber, 25),
      instagramHandle: sanitizeText(settings.instagramHandle, 80),
      instagramUrl: sanitizeText(settings.instagramUrl, 300),
      ...(settings.whatsappTemplate !== undefined
        ? { whatsappTemplate: sanitizeMultilineText(settings.whatsappTemplate, 800) }
        : {}),
      ...(settings.tiktokUrl !== undefined
        ? { tiktokUrl: sanitizeText(settings.tiktokUrl, 300) }
        : {}),
      ...(settings.youtubeUrl !== undefined
        ? { youtubeUrl: sanitizeText(settings.youtubeUrl, 300) }
        : {}),
      ...(settings.email ? { email: sanitizeText(settings.email, 254) } : {}),
      serviceArea: sanitizeText(settings.serviceArea, 300),
      heroHeadline: sanitizeText(settings.heroHeadline, 200),
      heroSubheadline: sanitizeMultilineText(settings.heroSubheadline, 500),
      aboutStatement: sanitizeMultilineText(settings.aboutStatement, 1200),
      ...(settings.bookingNotice ? { bookingNotice: sanitizeMultilineText(settings.bookingNotice, 500) } : {}),
      updatedAt: serverTimestamp(),
    });
    await logAdminActivity(
      actor,
      'UPDATE_SETTINGS',
      'SETTINGS',
      'public',
      'Updated public brand and website settings'
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

// --- Homepage Customization (Storage + Draft/Published Firestore) ---

function clampFocalPercent(value: unknown): number {
  const num = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(num)) return 50;
  const clamped = Math.max(0, Math.min(100, num));
  return Math.round(clamped * 10) / 10;
}

export function normalizeFocalPoint(fp?: Partial<FocalPoint> | null): FocalPoint {
  return {
    x: clampFocalPercent(fp?.x),
    y: clampFocalPercent(fp?.y),
  };
}

export function normalizeHomepageConfig(
  raw?: Partial<HomepageConfig> | null,
  fallbackSettings?: Partial<SiteSettings> | null
): HomepageConfig {
  const baseHeroTitle =
    fallbackSettings?.heroHeadline && fallbackSettings.heroHeadline.trim().length >= 2
      ? fallbackSettings.heroHeadline
      : DEFAULT_HOMEPAGE_CONFIG.heroTitle;
  const baseHeroSubtitle =
    fallbackSettings?.heroSubheadline && fallbackSettings.heroSubheadline.trim().length >= 2
      ? fallbackSettings.heroSubheadline
      : DEFAULT_HOMEPAGE_CONFIG.heroSubtitle;
  const baseAboutText =
    fallbackSettings?.aboutStatement && fallbackSettings.aboutStatement.trim().length >= 2
      ? fallbackSettings.aboutStatement
      : DEFAULT_HOMEPAGE_CONFIG.aboutText;

  const rawGallery = Array.isArray(raw?.galleryItems) ? raw.galleryItems : [];
  const galleryItems: HomepageGalleryItem[] = rawGallery
    .filter((item): item is HomepageGalleryItem => Boolean(item && item.url && item.url.trim()))
    .map((item, idx) => ({
      id: sanitizeText(item.id || `gal_${idx + 1}`, 64) || `gal_${idx + 1}`,
      url: item.url.trim().slice(0, 2000),
      ...(item.caption ? { caption: sanitizeText(item.caption, 200) } : {}),
      visible: item.visible !== false,
      sortOrder: typeof item.sortOrder === 'number' ? item.sortOrder : idx,
      ...(item.focalPoint ? { focalPoint: normalizeFocalPoint(item.focalPoint) } : {}),
    }))
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .slice(0, 16)
    .map((item, idx) => ({ ...item, sortOrder: idx }));

  const featuredPortfolioIds = Array.isArray(raw?.featuredPortfolioIds)
    ? Array.from(
        new Set(
          raw.featuredPortfolioIds
            .map((id) => sanitizeText(String(id || ''), 128))
            .filter(Boolean)
        )
      ).slice(0, 6)
    : [];

  return {
    heroTitle: raw?.heroTitle ?? baseHeroTitle,
    heroSubtitle: raw?.heroSubtitle ?? baseHeroSubtitle,
    heroImageUrl: raw?.heroImageUrl !== undefined ? raw.heroImageUrl : DEFAULT_HOMEPAGE_CONFIG.heroImageUrl,
    heroImageAlt: raw?.heroImageAlt ?? DEFAULT_HOMEPAGE_CONFIG.heroImageAlt ?? '',
    heroImagePosition: normalizeFocalPoint(raw?.heroImagePosition ?? DEFAULT_HOMEPAGE_CONFIG.heroImagePosition),
    heroCaption: raw?.heroCaption ?? DEFAULT_HOMEPAGE_CONFIG.heroCaption ?? '',
    heroPrimaryCtaLabel: raw?.heroPrimaryCtaLabel ?? DEFAULT_HOMEPAGE_CONFIG.heroPrimaryCtaLabel,
    heroSecondaryCtaLabel: raw?.heroSecondaryCtaLabel ?? DEFAULT_HOMEPAGE_CONFIG.heroSecondaryCtaLabel,
    gallerySectionEnabled: raw?.gallerySectionEnabled ?? DEFAULT_HOMEPAGE_CONFIG.gallerySectionEnabled,
    galleryItems,
    aboutEyebrow: raw?.aboutEyebrow ?? DEFAULT_HOMEPAGE_CONFIG.aboutEyebrow ?? '',
    aboutHeadline: raw?.aboutHeadline ?? DEFAULT_HOMEPAGE_CONFIG.aboutHeadline,
    aboutText: raw?.aboutText ?? baseAboutText,
    aboutImageUrl: raw?.aboutImageUrl ?? DEFAULT_HOMEPAGE_CONFIG.aboutImageUrl ?? '',
    aboutImageAlt: raw?.aboutImageAlt ?? DEFAULT_HOMEPAGE_CONFIG.aboutImageAlt ?? '',
    aboutCtaLabel: raw?.aboutCtaLabel ?? DEFAULT_HOMEPAGE_CONFIG.aboutCtaLabel ?? '',
    featuredPortfolioIds,
    ctaEyebrow: raw?.ctaEyebrow ?? DEFAULT_HOMEPAGE_CONFIG.ctaEyebrow ?? '',
    ctaHeadline: raw?.ctaHeadline ?? DEFAULT_HOMEPAGE_CONFIG.ctaHeadline,
    ctaSubtext: raw?.ctaSubtext ?? DEFAULT_HOMEPAGE_CONFIG.ctaSubtext ?? '',
    ctaButtonLabel: raw?.ctaButtonLabel ?? DEFAULT_HOMEPAGE_CONFIG.ctaButtonLabel,
    ...(raw?.updatedBy ? { updatedBy: raw.updatedBy } : {}),
    ...(raw?.publishedAt ? { publishedAt: raw.publishedAt } : {}),
    ...(raw?.updatedAt ? { updatedAt: raw.updatedAt } : {}),
  };
}

function buildValidatedHomepagePayload(config: HomepageConfig): Record<string, unknown> {
  const heroTitle = sanitizeText(config.heroTitle, 200);
  const heroSubtitle = sanitizeMultilineText(config.heroSubtitle, 500);
  const heroImageUrl = (config.heroImageUrl || '').trim().slice(0, 2000);
  const heroImageAlt = sanitizeText(config.heroImageAlt || '', 200);
  const heroImagePosition = normalizeFocalPoint(config.heroImagePosition);
  const heroCaption = sanitizeText(config.heroCaption || '', 200);
  const heroPrimaryCtaLabel = sanitizeText(config.heroPrimaryCtaLabel, 80);
  const heroSecondaryCtaLabel = sanitizeText(config.heroSecondaryCtaLabel, 80);

  const aboutEyebrow = sanitizeText(config.aboutEyebrow || '', 80);
  const aboutHeadline = sanitizeText(config.aboutHeadline, 240);
  const aboutText = sanitizeMultilineText(config.aboutText, 1200);
  const aboutImageUrl = (config.aboutImageUrl || '').trim().slice(0, 2000);
  const aboutImageAlt = sanitizeText(config.aboutImageAlt || '', 200);
  const aboutCtaLabel = sanitizeText(config.aboutCtaLabel || '', 80);

  const ctaEyebrow = sanitizeText(config.ctaEyebrow || '', 80);
  const ctaHeadline = sanitizeText(config.ctaHeadline, 200);
  const ctaSubtext = sanitizeMultilineText(config.ctaSubtext || '', 400);
  const ctaButtonLabel = sanitizeText(config.ctaButtonLabel, 80);

  if (heroTitle.length < 2) {
    throw new Error('Hero title must be at least 2 characters.');
  }
  if (heroSubtitle.length < 2) {
    throw new Error('Hero subtitle must be at least 2 characters.');
  }
  if (heroPrimaryCtaLabel.length < 1 || heroSecondaryCtaLabel.length < 1) {
    throw new Error('Hero button labels cannot be empty.');
  }
  if (aboutHeadline.length < 2) {
    throw new Error('About headline must be at least 2 characters.');
  }
  if (aboutText.length < 2) {
    throw new Error('About description text must be at least 2 characters.');
  }
  if (ctaHeadline.length < 2) {
    throw new Error('Bottom CTA headline must be at least 2 characters.');
  }
  if (ctaButtonLabel.length < 1) {
    throw new Error('Bottom CTA button label cannot be empty.');
  }

  const galleryItems = (config.galleryItems || [])
    .filter((item) => item.url && item.url.trim().length > 0)
    .slice(0, 16)
    .map((item, idx) => {
      const cleanId =
        sanitizeText(item.id || `gal_${Date.now()}_${idx}`, 64).replace(/[^a-zA-Z0-9_-]/g, '_') ||
        `gal_${idx + 1}`;
      const caption = sanitizeText(item.caption || '', 200);
      return {
        id: cleanId,
        url: item.url.trim().slice(0, 2000),
        visible: Boolean(item.visible),
        sortOrder: idx,
        ...(caption ? { caption } : {}),
        ...(item.focalPoint ? { focalPoint: normalizeFocalPoint(item.focalPoint) } : {}),
      };
    });

  const featuredPortfolioIds = Array.from(
    new Set(
      (config.featuredPortfolioIds || [])
        .map((id) => sanitizeText(id, 128))
        .filter(Boolean)
    )
  ).slice(0, 6);

  return {
    heroTitle,
    heroSubtitle,
    heroImageUrl,
    heroImageAlt,
    heroImagePosition,
    heroCaption,
    heroPrimaryCtaLabel,
    heroSecondaryCtaLabel,
    gallerySectionEnabled: Boolean(config.gallerySectionEnabled),
    galleryItems,
    aboutEyebrow,
    aboutHeadline,
    aboutText,
    aboutImageUrl,
    aboutImageAlt,
    aboutCtaLabel,
    featuredPortfolioIds,
    ctaEyebrow,
    ctaHeadline,
    ctaSubtext,
    ctaButtonLabel,
  };
}

export async function uploadHomepageImage(
  file: File,
  folder: 'hero' | 'gallery' | 'about',
  onProgress?: (percent: number) => void
): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Only image files (JPG, PNG, WEBP, AVIF) are supported.');
  }
  if (file.size > 15 * 1024 * 1024) {
    throw new Error('Image size must be 15 MB or smaller.');
  }

  const safeName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
  const storageRef = ref(storage, `homepage/${folder}/${safeName}`);
  return new Promise((resolve, reject) => {
    const task = uploadBytesResumable(storageRef, file, {
      contentType: file.type || 'image/jpeg',
    });
    task.on(
      'state_changed',
      (snapshot) => {
        if (onProgress && snapshot.totalBytes > 0) {
          onProgress(Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100));
        }
      },
      (error) => reject(error),
      async () => {
        try {
          const url = await getDownloadURL(task.snapshot.ref);
          resolve(url);
        } catch (err) {
          reject(err);
        }
      }
    );
  });
}

export function collectHomepageStorageUrls(config: HomepageConfig | null | undefined): string[] {
  if (!config) return [];
  const candidates = [
    config.heroImageUrl,
    config.aboutImageUrl || '',
    ...(config.galleryItems || []).map((item) => item.url),
  ];
  return Array.from(
    new Set(
      candidates.filter(
        (url) =>
          typeof url === 'string' &&
          url.includes('firebasestorage.googleapis.com') &&
          url.includes('homepage%2F')
      )
    )
  );
}

async function cleanupOrphanedHomepageStorageUrls(
  candidateUrls: string[],
  retainedUrls: Set<string>
): Promise<void> {
  const orphans = candidateUrls.filter((url) => !retainedUrls.has(url));
  await Promise.all(
    orphans.map(async (url) => {
      try {
        await deleteObject(ref(storage, url));
      } catch (err) {
        // Non-fatal: asset may already have been deleted or referenced externally
        console.warn('Skipped deleting old homepage storage asset:', err);
      }
    })
  );
}

export interface HomepageAdminState {
  draft: HomepageConfig;
  published: HomepageConfig;
  hasDraftDoc: boolean;
  hasPublishedDoc: boolean;
}

export async function fetchHomepageAdminState(): Promise<HomepageAdminState> {
  const path = 'homepage_config';
  try {
    const readServerOrCache = async (refDoc: ReturnType<typeof doc>) => {
      try {
        return await getDocFromServer(refDoc);
      } catch {
        return await getDoc(refDoc);
      }
    };

    const [draftSnap, publishedSnap, settingsSnap] = await Promise.all([
      readServerOrCache(doc(db, 'homepage_config', 'draft')),
      readServerOrCache(doc(db, 'homepage_config', 'published')),
      readServerOrCache(doc(db, 'settings', 'public')),
    ]);

    const settingsData = settingsSnap.exists()
      ? (settingsSnap.data() as Partial<SiteSettings>)
      : null;

    const published = publishedSnap.exists()
      ? normalizeHomepageConfig(publishedSnap.data() as Partial<HomepageConfig>, settingsData)
      : normalizeHomepageConfig(null, settingsData);

    const draft = draftSnap.exists()
      ? normalizeHomepageConfig(draftSnap.data() as Partial<HomepageConfig>, settingsData)
      : published;

    return {
      draft,
      published,
      hasDraftDoc: draftSnap.exists(),
      hasPublishedDoc: publishedSnap.exists(),
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export function subscribePublishedHomepageConfig(
  onData: (state: { config: HomepageConfig; exists: boolean }) => void,
  onError: (error: Error) => void
): Unsubscribe {
  return onSnapshot(
    doc(db, 'homepage_config', 'published'),
    (snap) => {
      if (!snap.exists()) {
        onData({
          config: normalizeHomepageConfig(null),
          exists: false,
        });
        return;
      }
      onData({
        config: normalizeHomepageConfig(snap.data() as Partial<HomepageConfig>),
        exists: true,
      });
    },
    (error) => {
      console.error('Firestore Error (subscribePublishedHomepageConfig):', error);
      onError(error instanceof Error ? error : new Error('Failed to load homepage configuration.'));
    }
  );
}

export async function saveHomepageDraft(
  actor: User,
  config: HomepageConfig
): Promise<HomepageConfig> {
  const path = 'homepage_config/draft';
  const payload = buildValidatedHomepagePayload(config);
  const actorLabel = sanitizeText(actor.email || actor.uid, 254);

  try {
    await setDoc(doc(db, 'homepage_config', 'draft'), {
      ...payload,
      updatedBy: actorLabel,
      updatedAt: serverTimestamp(),
    });
    await logAdminActivity(
      actor,
      'SAVE_HOMEPAGE_DRAFT',
      'HOMEPAGE',
      'draft',
      'Saved homepage customization draft'
    );
    return normalizeHomepageConfig(payload as Partial<HomepageConfig>);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function publishHomepageConfig(
  actor: User,
  config: HomepageConfig,
  previousStorageUrls: string[] = []
): Promise<HomepageConfig> {
  const path = 'homepage_config/published';
  const payload = buildValidatedHomepagePayload(config);
  const actorLabel = sanitizeText(actor.email || actor.uid, 254);

  try {
    const batch = writeBatch(db);
    batch.set(doc(db, 'homepage_config', 'draft'), {
      ...payload,
      updatedBy: actorLabel,
      publishedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    batch.set(doc(db, 'homepage_config', 'published'), {
      ...payload,
      updatedBy: actorLabel,
      publishedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    await batch.commit();

    await logAdminActivity(
      actor,
      'PUBLISH_HOMEPAGE',
      'HOMEPAGE',
      'published',
      'Published homepage customization to the public website'
    );

    const normalized = normalizeHomepageConfig(payload as Partial<HomepageConfig>);
    const retained = new Set(collectHomepageStorageUrls(normalized));
    await cleanupOrphanedHomepageStorageUrls(previousStorageUrls, retained);

    return normalized;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

// --- Invoice Management (Sequential Numbering, Package Integration & Payments) ---

export function calculateInvoiceFinancials(input: {
  packagePrice: number;
  additionalItems: InvoiceLineItem[];
  transportationFee: number;
  overtimeFee: number;
  discount: number;
  dpMode: InvoiceDpMode;
  dpPercent?: number;
  customDpAmount?: number;
  payments: InvoicePaymentRecord[];
}) {
  const cleanPkgPrice = Math.max(0, Math.round(Number(input.packagePrice) || 0));
  const cleanItems: InvoiceLineItem[] = (input.additionalItems || [])
    .filter((item) => item && item.description && item.description.trim().length > 0)
    .slice(0, 20)
    .map((item, idx) => {
      const qty = Math.max(1, Math.round(Number(item.quantity) || 1));
      const unitPrice = Math.max(0, Math.round(Number(item.unitPrice) || 0));
      return {
        id: sanitizeText(item.id || `item_${idx + 1}`, 64) || `item_${idx + 1}`,
        description: sanitizeText(item.description, 160),
        quantity: qty,
        unitPrice,
        amount: qty * unitPrice,
      };
    });

  const additionalServicesTotal = cleanItems.reduce((sum, item) => sum + item.amount, 0);
  const transportationFee = Math.max(0, Math.round(Number(input.transportationFee) || 0));
  const overtimeFee = Math.max(0, Math.round(Number(input.overtimeFee) || 0));
  const discount = Math.max(0, Math.round(Number(input.discount) || 0));

  const subtotal = cleanPkgPrice + additionalServicesTotal + transportationFee + overtimeFee;
  const grandTotal = Math.max(0, subtotal - discount);

  let dpPercent = 30;
  let downPaymentAmount = 0;
  if (input.dpMode === 'PERCENT_30') {
    dpPercent = 30;
    downPaymentAmount = Math.round(grandTotal * 0.3);
  } else if (input.dpMode === 'PERCENT_50') {
    dpPercent = 50;
    downPaymentAmount = Math.round(grandTotal * 0.5);
  } else if (input.dpMode === 'CUSTOM_PERCENT') {
    dpPercent = Math.max(0, Math.min(100, Math.round((Number(input.dpPercent) || 0) * 10) / 10));
    downPaymentAmount = Math.round(grandTotal * (dpPercent / 100));
  } else {
    downPaymentAmount = Math.max(
      0,
      Math.min(grandTotal, Math.round(Number(input.customDpAmount) || 0))
    );
    dpPercent =
      grandTotal > 0 ? Math.round((downPaymentAmount / grandTotal) * 1000) / 10 : 0;
  }

  const cleanPayments: InvoicePaymentRecord[] = (input.payments || []).slice(0, 30);
  const amountPaid = cleanPayments.reduce(
    (sum, p) => sum + Math.max(0, Math.round(Number(p.amount) || 0)),
    0
  );
  const remainingBalance = Math.max(0, grandTotal - amountPaid);

  return {
    packagePrice: cleanPkgPrice,
    additionalItems: cleanItems,
    additionalServicesTotal,
    transportationFee,
    overtimeFee,
    discount,
    grandTotal,
    dpPercent,
    downPaymentAmount,
    amountPaid,
    remainingBalance,
  };
}

export function deriveInvoicePaymentStatus(
  grandTotal: number,
  amountPaid: number,
  dueDate: string,
  requestedStatus?: InvoicePaymentStatus
): InvoicePaymentStatus {
  if (grandTotal > 0 && amountPaid >= grandTotal) {
    return 'PAID';
  }
  if (amountPaid > 0 && amountPaid < grandTotal) {
    return 'PARTIALLY_PAID';
  }
  if (requestedStatus === 'OVERDUE') {
    return 'OVERDUE';
  }
  const today = new Date().toISOString().split('T')[0];
  if (PATTERNS.dateStr.test(dueDate) && dueDate < today && requestedStatus !== 'UNPAID') {
    return 'OVERDUE';
  }
  return 'UNPAID';
}

export function resolveLatestPackageForBooking(
  booking: Pick<BookingRecord, 'packageId' | 'packageName' | 'packagePrice'>,
  packages: ServicePackage[]
): { packageId: string; packageName: string; packagePrice: number } {
  const byId = packages.find((p) => p.id === booking.packageId);
  if (byId) {
    return { packageId: byId.id, packageName: byId.name, packagePrice: Number(byId.price) };
  }
  const normalizedTarget = (booking.packageName || '').trim().toLowerCase();
  const bySlugOrName = packages.find(
    (p) =>
      p.slug.toLowerCase() === booking.packageId.toLowerCase() ||
      p.name.trim().toLowerCase() === normalizedTarget
  );
  if (bySlugOrName) {
    return {
      packageId: bySlugOrName.id,
      packageName: bySlugOrName.name,
      packagePrice: Number(bySlugOrName.price),
    };
  }
  return {
    packageId: booking.packageId,
    packageName: booking.packageName,
    packagePrice: Number(booking.packagePrice || 0),
  };
}

export function subscribeAllInvoicesAdmin(
  onData: (items: InvoiceRecord[]) => void,
  onError: (error: Error) => void
): Unsubscribe {
  return onSnapshot(
    collection(db, 'invoices'),
    (snap) => {
      const items = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<InvoiceRecord, 'id'>),
      }));
      items.sort((a, b) => {
        if ((b.sequenceYear || 0) !== (a.sequenceYear || 0)) {
          return (b.sequenceYear || 0) - (a.sequenceYear || 0);
        }
        return (b.sequenceNumber || 0) - (a.sequenceNumber || 0);
      });
      onData(items);
    },
    (error) => {
      console.error('Firestore Error (subscribeAllInvoicesAdmin):', error);
      onError(error instanceof Error ? error : new Error('Failed to load invoices.'));
    }
  );
}

export async function fetchInvoiceSettings(): Promise<InvoiceSettings> {
  const path = 'invoice_settings/default';
  try {
    let snap;
    try {
      snap = await getDocFromServer(doc(db, 'invoice_settings', 'default'));
    } catch {
      snap = await getDoc(doc(db, 'invoice_settings', 'default'));
    }
    if (!snap.exists()) {
      return { ...DEFAULT_INVOICE_SETTINGS };
    }
    return {
      ...DEFAULT_INVOICE_SETTINGS,
      ...(snap.data() as Partial<InvoiceSettings>),
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function saveInvoiceSettings(
  actor: User,
  settingsInput: Omit<InvoiceSettings, 'updatedAt'>
): Promise<InvoiceSettings> {
  const path = 'invoice_settings/default';
  const payload = {
    bankName: sanitizeText(settingsInput.bankName || '', 80),
    bankAccountNumber: sanitizeText(settingsInput.bankAccountNumber || '', 60),
    bankAccountHolder: sanitizeText(settingsInput.bankAccountHolder || '', 120),
    paymentInstructions: sanitizeMultilineText(settingsInput.paymentInstructions || '', 600),
    defaultThankYouMessage: sanitizeMultilineText(
      settingsInput.defaultThankYouMessage || DEFAULT_INVOICE_SETTINGS.defaultThankYouMessage,
      400
    ),
    defaultDueDays: Math.max(0, Math.min(365, Math.round(Number(settingsInput.defaultDueDays) || 7))),
    defaultDpMode:
      settingsInput.defaultDpMode === 'PERCENT_50' ? ('PERCENT_50' as const) : ('PERCENT_30' as const),
    updatedAt: serverTimestamp(),
  };

  try {
    await setDoc(doc(db, 'invoice_settings', 'default'), payload);
    await logAdminActivity(
      actor,
      'UPDATE_INVOICE_SETTINGS',
      'INVOICE',
      'default',
      'Updated invoice bank details and default payment instructions'
    );
    return { ...payload } as unknown as InvoiceSettings;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export interface CreateInvoiceDraftInput {
  booking: BookingRecord;
  packageOverride?: ServicePackage | null;
  issueDate: string;
  dueDate: string;
  additionalItems: InvoiceLineItem[];
  transportationFee: number;
  overtimeFee: number;
  discount: number;
  dpMode: InvoiceDpMode;
  dpPercent?: number;
  customDpAmount?: number;
  notes?: string;
  invoiceSettings: InvoiceSettings;
  finalizeImmediately?: boolean;
  allowDuplicateForBooking?: boolean;
}

class InvoicePreconditionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvoicePreconditionError';
  }
}

export async function createInvoiceFromBooking(
  actor: User,
  input: CreateInvoiceDraftInput
): Promise<InvoiceRecord> {
  const { booking } = input;
  if (!PATTERNS.dateStr.test(input.issueDate) || !PATTERNS.dateStr.test(input.dueDate)) {
    throw new Error('Issue date and due date must be valid dates (YYYY-MM-DD).');
  }
  if (!PATTERNS.dateStr.test(booking.eventDate)) {
    throw new Error('Wedding date must be valid (YYYY-MM-DD).');
  }

  const cleanClientName = sanitizeText(booking.coupleName, 120);
  const rawWhatsapp = sanitizeText(booking.whatsappNumber, 25);
  const normalizedWhatsapp = normalizeWhatsapp(rawWhatsapp);
  const cleanClientWhatsapp =
    rawWhatsapp.length >= 8 ? rawWhatsapp : normalizedWhatsapp.slice(0, 25);

  if (cleanClientName.length < 2) {
    throw new Error('Client name must be at least 2 characters.');
  }
  if (cleanClientWhatsapp.length < 8 || !PATTERNS.normalizedWhatsapp.test(normalizedWhatsapp)) {
    throw new Error('Client WhatsApp number must be at least 8 digits.');
  }

  // Duplicate protection per booking unless explicitly allowed
  if (!input.allowDuplicateForBooking) {
    const existingForBooking = await getDocs(
      query(collection(db, 'invoices'), where('bookingId', '==', booking.id))
    );
    const activeMatch = existingForBooking.docs.find(
      (d) => (d.data() as InvoiceRecord).lifecycleStatus !== 'VOID'
    );
    if (activeMatch) {
      const existingInv = activeMatch.data() as InvoiceRecord;
      throw new Error(
        `An active invoice (${existingInv.invoiceNumber}) already exists for booking ${booking.bookingCode}. Open it or confirm creating an additional invoice.`
      );
    }
  }

  // Always retrieve latest package pricing from /packages
  const latestPackages = await fetchAllPackagesAdmin();
  const resolvedPkg = input.packageOverride
    ? {
        packageId: input.packageOverride.id,
        packageName: input.packageOverride.name,
        packagePrice: Number(input.packageOverride.price),
      }
    : resolveLatestPackageForBooking(booking, latestPackages);

  const safePackageId =
    sanitizeText(resolvedPkg.packageId, 64).replace(/[^a-zA-Z0-9_-]/g, '-') || 'custom-package';
  const safePackageName = sanitizeText(resolvedPkg.packageName || 'Wedding Package', 80);

  const financials = calculateInvoiceFinancials({
    packagePrice: resolvedPkg.packagePrice,
    additionalItems: input.additionalItems,
    transportationFee: input.transportationFee,
    overtimeFee: input.overtimeFee,
    discount: input.discount,
    dpMode: input.dpMode,
    dpPercent: input.dpPercent,
    customDpAmount: input.customDpAmount,
    payments: [],
  });

  if (financials.grandTotal > 1000000000 || financials.packagePrice > 1000000000) {
    throw new Error('Invoice amounts cannot exceed IDR 1,000,000,000.');
  }

  const issueYear = Number(input.issueDate.slice(0, 4)) || new Date().getFullYear();
  const yearStr = String(issueYear);
  const counterRef = doc(db, 'invoice_counters', yearStr);

  const lifecycleStatus = input.finalizeImmediately ? 'FINALIZED' : 'DRAFT';
  const paymentStatus = deriveInvoicePaymentStatus(
    financials.grandTotal,
    0,
    input.dueDate,
    'UNPAID'
  );

  const path = `invoices/INV-USC-${yearStr}`;
  try {
    const createdInvoice = await runTransaction(db, async (tx) => {
      const counterSnap = await tx.get(counterRef);
      let nextNumber = counterSnap.exists()
        ? Math.max(1, Number(counterSnap.data()?.lastNumber || 0) + 1)
        : 1;

      // Extra defensive uniqueness check against existing invoice doc IDs
      let candidateId = `INV-USC-${yearStr}-${String(nextNumber).padStart(3, '0')}`;
      let candidateRef = doc(db, 'invoices', candidateId);
      let existingSnap = await tx.get(candidateRef);
      while (existingSnap.exists()) {
        nextNumber += 1;
        candidateId = `INV-USC-${yearStr}-${String(nextNumber).padStart(3, '0')}`;
        candidateRef = doc(db, 'invoices', candidateId);
        existingSnap = await tx.get(candidateRef);
      }

      const invoiceNumber = `INV/USC/${yearStr}/${String(nextNumber).padStart(3, '0')}`;
      const cleanNotes = input.notes ? sanitizeMultilineText(input.notes, 1000) : '';
      const cleanEmail = booking.email ? sanitizeText(booking.email, 254) : '';
      const cleanLocation = sanitizeText(booking.eventLocation, 180);
      const cleanEventType = sanitizeText(booking.eventType, 80);

      const payload: Record<string, unknown> = {
        invoiceNumber,
        sequenceYear: issueYear,
        sequenceNumber: nextNumber,
        bookingId: booking.id,
        bookingCode: sanitizeText(booking.bookingCode, 40),
        lifecycleStatus,
        paymentStatus,
        issueDate: input.issueDate,
        dueDate: input.dueDate,
        clientName: cleanClientName,
        clientWhatsapp: cleanClientWhatsapp,
        normalizedWhatsapp,
        ...(cleanEmail ? { clientEmail: cleanEmail } : {}),
        weddingDate: booking.eventDate,
        eventLocation: cleanLocation,
        eventType: cleanEventType,
        packageId: safePackageId,
        packageName: safePackageName,
        packagePrice: financials.packagePrice,
        additionalItems: financials.additionalItems,
        additionalServicesTotal: financials.additionalServicesTotal,
        transportationFee: financials.transportationFee,
        overtimeFee: financials.overtimeFee,
        discount: financials.discount,
        grandTotal: financials.grandTotal,
        dpMode: input.dpMode,
        dpPercent: financials.dpPercent,
        downPaymentAmount: financials.downPaymentAmount,
        amountPaid: 0,
        remainingBalance: financials.grandTotal,
        payments: [],
        bankName: sanitizeText(input.invoiceSettings.bankName || '', 80),
        bankAccountNumber: sanitizeText(input.invoiceSettings.bankAccountNumber || '', 60),
        bankAccountHolder: sanitizeText(input.invoiceSettings.bankAccountHolder || '', 120),
        paymentInstructions: sanitizeMultilineText(
          input.invoiceSettings.paymentInstructions || '',
          600
        ),
        thankYouMessage: sanitizeMultilineText(
          input.invoiceSettings.defaultThankYouMessage ||
            DEFAULT_INVOICE_SETTINGS.defaultThankYouMessage,
          400
        ),
        ...(cleanNotes ? { notes: cleanNotes } : {}),
        ...(lifecycleStatus === 'FINALIZED' ? { finalizedAt: serverTimestamp() } : {}),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      tx.set(counterRef, {
        year: issueYear,
        lastNumber: nextNumber,
        updatedAt: serverTimestamp(),
      });
      tx.set(candidateRef, payload);

      return {
        id: candidateId,
        invoiceNumber,
        sequenceYear: issueYear,
        sequenceNumber: nextNumber,
        bookingId: booking.id,
        bookingCode: sanitizeText(booking.bookingCode, 40),
        lifecycleStatus,
        paymentStatus,
        issueDate: input.issueDate,
        dueDate: input.dueDate,
        clientName: cleanClientName,
        clientWhatsapp: cleanClientWhatsapp,
        normalizedWhatsapp,
        ...(cleanEmail ? { clientEmail: cleanEmail } : {}),
        weddingDate: booking.eventDate,
        eventLocation: cleanLocation,
        eventType: cleanEventType,
        packageId: safePackageId,
        packageName: safePackageName,
        packagePrice: financials.packagePrice,
        additionalItems: financials.additionalItems,
        additionalServicesTotal: financials.additionalServicesTotal,
        transportationFee: financials.transportationFee,
        overtimeFee: financials.overtimeFee,
        discount: financials.discount,
        grandTotal: financials.grandTotal,
        dpMode: input.dpMode,
        dpPercent: financials.dpPercent,
        downPaymentAmount: financials.downPaymentAmount,
        amountPaid: 0,
        remainingBalance: financials.grandTotal,
        payments: [],
        bankName: sanitizeText(input.invoiceSettings.bankName || '', 80),
        bankAccountNumber: sanitizeText(input.invoiceSettings.bankAccountNumber || '', 60),
        bankAccountHolder: sanitizeText(input.invoiceSettings.bankAccountHolder || '', 120),
        paymentInstructions: sanitizeMultilineText(
          input.invoiceSettings.paymentInstructions || '',
          600
        ),
        thankYouMessage: sanitizeMultilineText(
          input.invoiceSettings.defaultThankYouMessage ||
            DEFAULT_INVOICE_SETTINGS.defaultThankYouMessage,
          400
        ),
        ...(cleanNotes ? { notes: cleanNotes } : {}),
      } as InvoiceRecord;
    });

    await logAdminActivity(
      actor,
      lifecycleStatus === 'FINALIZED' ? 'FINALIZE_INVOICE' : 'CREATE_INVOICE_DRAFT',
      'INVOICE',
      createdInvoice.id,
      `Generated invoice ${createdInvoice.invoiceNumber} for ${createdInvoice.clientName}`
    );
    return createdInvoice;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateDraftInvoice(
  actor: User,
  invoice: InvoiceRecord,
  options?: { finalize?: boolean }
): Promise<void> {
  if (invoice.lifecycleStatus !== 'DRAFT') {
    throw new Error('Only draft invoices can be edited. Finalized invoice figures are preserved.');
  }
  if (!PATTERNS.dateStr.test(invoice.issueDate) || !PATTERNS.dateStr.test(invoice.dueDate)) {
    throw new Error('Issue date and due date must be valid dates (YYYY-MM-DD).');
  }
  if (!PATTERNS.dateStr.test(invoice.weddingDate)) {
    throw new Error('Wedding date must be valid (YYYY-MM-DD).');
  }

  const cleanClientName = sanitizeText(invoice.clientName, 120);
  const rawWhatsapp = sanitizeText(invoice.clientWhatsapp, 25);
  const normalizedWhatsapp = normalizeWhatsapp(rawWhatsapp);
  const cleanWhatsapp = rawWhatsapp.length >= 8 ? rawWhatsapp : normalizedWhatsapp.slice(0, 25);
  const cleanLocation = sanitizeText(invoice.eventLocation, 180);
  const cleanEventType = sanitizeText(invoice.eventType, 80);
  const cleanPackageId =
    sanitizeText(invoice.packageId, 64).replace(/[^a-zA-Z0-9_-]/g, '-') || 'custom-package';
  const cleanPackageName = sanitizeText(invoice.packageName || 'Wedding Package', 80);
  const cleanEmail = invoice.clientEmail ? sanitizeText(invoice.clientEmail, 254) : '';
  const cleanNotes = invoice.notes ? sanitizeMultilineText(invoice.notes, 1000) : '';

  if (cleanClientName.length < 2) {
    throw new Error('Client name must be at least 2 characters.');
  }
  if (cleanWhatsapp.length < 8 || !PATTERNS.normalizedWhatsapp.test(normalizedWhatsapp)) {
    throw new Error('Client WhatsApp number must be at least 8 digits.');
  }
  if (cleanLocation.length < 2 || cleanEventType.length < 2) {
    throw new Error('Event location and event type are required.');
  }

  const path = `invoices/${invoice.id}`;
  const invRef = doc(db, 'invoices', invoice.id);

  try {
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(invRef);
      if (!snap.exists()) {
        throw new InvoicePreconditionError('Invoice record was not found.');
      }
      const serverData = snap.data() as InvoiceRecord;
      if (serverData.lifecycleStatus !== 'DRAFT') {
        throw new InvoicePreconditionError(
          `Invoice ${serverData.invoiceNumber || invoice.invoiceNumber} is ${serverData.lifecycleStatus} and its financial figures can no longer be edited.`
        );
      }

      const serverPayments = Array.isArray(serverData.payments)
        ? serverData.payments
        : invoice.payments || [];

      const financials = calculateInvoiceFinancials({
        packagePrice: invoice.packagePrice,
        additionalItems: invoice.additionalItems,
        transportationFee: invoice.transportationFee,
        overtimeFee: invoice.overtimeFee,
        discount: invoice.discount,
        dpMode: invoice.dpMode,
        dpPercent: invoice.dpPercent,
        customDpAmount: invoice.downPaymentAmount,
        payments: serverPayments,
      });

      if (financials.grandTotal > 1000000000 || financials.packagePrice > 1000000000) {
        throw new InvoicePreconditionError('Invoice amounts cannot exceed IDR 1,000,000,000.');
      }

      const nextLifecycle = options?.finalize ? 'FINALIZED' : 'DRAFT';
      const nextPaymentStatus = deriveInvoicePaymentStatus(
        financials.grandTotal,
        financials.amountPaid,
        invoice.dueDate,
        serverData.paymentStatus || invoice.paymentStatus
      );

      tx.update(invRef, {
        lifecycleStatus: nextLifecycle,
        paymentStatus: nextPaymentStatus,
        issueDate: invoice.issueDate,
        dueDate: invoice.dueDate,
        clientName: cleanClientName,
        clientWhatsapp: cleanWhatsapp,
        normalizedWhatsapp,
        clientEmail: cleanEmail,
        weddingDate: invoice.weddingDate,
        eventLocation: cleanLocation,
        eventType: cleanEventType,
        packageId: cleanPackageId,
        packageName: cleanPackageName,
        packagePrice: financials.packagePrice,
        additionalItems: financials.additionalItems,
        additionalServicesTotal: financials.additionalServicesTotal,
        transportationFee: financials.transportationFee,
        overtimeFee: financials.overtimeFee,
        discount: financials.discount,
        grandTotal: financials.grandTotal,
        dpMode: invoice.dpMode,
        dpPercent: financials.dpPercent,
        downPaymentAmount: financials.downPaymentAmount,
        amountPaid: financials.amountPaid,
        remainingBalance: financials.remainingBalance,
        payments: serverPayments.slice(0, 30),
        bankName: sanitizeText(invoice.bankName || '', 80),
        bankAccountNumber: sanitizeText(invoice.bankAccountNumber || '', 60),
        bankAccountHolder: sanitizeText(invoice.bankAccountHolder || '', 120),
        paymentInstructions: sanitizeMultilineText(invoice.paymentInstructions || '', 600),
        thankYouMessage: sanitizeMultilineText(invoice.thankYouMessage || '', 400),
        notes: cleanNotes,
        ...(options?.finalize ? { finalizedAt: serverTimestamp() } : {}),
        updatedAt: serverTimestamp(),
      });
    });

    await logAdminActivity(
      actor,
      options?.finalize ? 'FINALIZE_INVOICE' : 'UPDATE_INVOICE_DRAFT',
      'INVOICE',
      invoice.id,
      `${options?.finalize ? 'Finalized' : 'Updated draft'} invoice ${invoice.invoiceNumber}`
    );
  } catch (error) {
    if (error instanceof InvoicePreconditionError) {
      throw error;
    }
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function recordInvoicePayment(
  actor: User,
  invoice: InvoiceRecord,
  paymentInput: { date: string; amount: number; method: string; note?: string }
): Promise<void> {
  if (invoice.lifecycleStatus === 'VOID') {
    throw new Error('Cannot record payment on a voided invoice.');
  }
  const amount = Math.round(Number(paymentInput.amount) || 0);
  if (amount <= 0) {
    throw new Error('Payment amount must be greater than zero.');
  }
  if (!PATTERNS.dateStr.test(paymentInput.date)) {
    throw new Error('Please choose a valid payment date.');
  }
  const method = sanitizeText(paymentInput.method, 60);
  if (!method) {
    throw new Error('Payment method is required.');
  }

  const nextPayment: InvoicePaymentRecord = {
    id: `pay_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    date: paymentInput.date,
    amount,
    method,
    ...(paymentInput.note ? { note: sanitizeText(paymentInput.note, 200) } : {}),
    recordedBy: sanitizeText(actor.email || actor.uid, 120),
  };

  const path = `invoices/${invoice.id}`;
  const invRef = doc(db, 'invoices', invoice.id);

  try {
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(invRef);
      if (!snap.exists()) {
        throw new InvoicePreconditionError('Invoice record was not found.');
      }
      const serverData = snap.data() as InvoiceRecord;
      if (serverData.lifecycleStatus === 'VOID') {
        throw new InvoicePreconditionError('Cannot record payment on a voided invoice.');
      }

      const existingPayments = Array.isArray(serverData.payments) ? serverData.payments : [];
      if (existingPayments.length >= 30) {
        throw new InvoicePreconditionError(
          'Maximum limit of 30 payment transactions per invoice has been reached.'
        );
      }

      const nextPayments = [...existingPayments, nextPayment];
      const amountPaid = nextPayments.reduce((sum, p) => sum + Math.max(0, Math.round(p.amount)), 0);
      if (amountPaid > 1000000000) {
        throw new InvoicePreconditionError('Total amount paid cannot exceed IDR 1,000,000,000.');
      }
      const serverGrandTotal = Math.max(0, Math.round(Number(serverData.grandTotal) || 0));
      const remainingBalance = Math.max(0, serverGrandTotal - amountPaid);
      const paymentStatus = deriveInvoicePaymentStatus(
        serverGrandTotal,
        amountPaid,
        serverData.dueDate || invoice.dueDate
      );

      tx.update(invRef, {
        payments: nextPayments,
        amountPaid,
        remainingBalance,
        paymentStatus,
        updatedAt: serverTimestamp(),
      });
    });

    await logAdminActivity(
      actor,
      'RECORD_INVOICE_PAYMENT',
      'INVOICE',
      invoice.id,
      `Recorded payment of IDR ${amount.toLocaleString('en-US')} on ${invoice.invoiceNumber}`
    );
  } catch (error) {
    if (error instanceof InvoicePreconditionError) {
      throw error;
    }
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function updateInvoiceStatusAndNotes(
  actor: User,
  invoiceId: string,
  invoiceNumber: string,
  updates: { paymentStatus?: InvoicePaymentStatus; lifecycleStatus?: 'VOID'; notes?: string }
): Promise<void> {
  const path = `invoices/${invoiceId}`;
  const invRef = doc(db, 'invoices', invoiceId);
  const cleanUpdates: Record<string, unknown> = {
    updatedAt: serverTimestamp(),
  };
  if (updates.paymentStatus !== undefined) cleanUpdates.paymentStatus = updates.paymentStatus;
  if (updates.lifecycleStatus !== undefined) cleanUpdates.lifecycleStatus = updates.lifecycleStatus;
  if (updates.notes !== undefined) cleanUpdates.notes = sanitizeMultilineText(updates.notes, 1000);

  try {
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(invRef);
      if (!snap.exists()) {
        throw new InvoicePreconditionError('Invoice record was not found.');
      }
      const serverData = snap.data() as InvoiceRecord;
      if (serverData.lifecycleStatus === 'VOID') {
        throw new InvoicePreconditionError('Voided invoices are locked and cannot be modified.');
      }
      tx.update(invRef, cleanUpdates);
    });

    await logAdminActivity(
      actor,
      updates.lifecycleStatus === 'VOID' ? 'VOID_INVOICE' : 'UPDATE_INVOICE_STATUS',
      'INVOICE',
      invoiceId,
      `${
        updates.lifecycleStatus === 'VOID'
          ? 'Voided'
          : `Updated payment status (${updates.paymentStatus || 'status'}) on`
      } invoice ${invoiceNumber}`
    );
  } catch (error) {
    if (error instanceof InvoicePreconditionError) {
      throw error;
    }
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteDraftInvoice(
  actor: User,
  invoiceId: string,
  invoiceNumber: string
): Promise<void> {
  const path = `invoices/${invoiceId}`;
  try {
    await deleteDoc(doc(db, 'invoices', invoiceId));
    await logAdminActivity(
      actor,
      'DELETE_INVOICE_DRAFT',
      'INVOICE',
      invoiceId,
      `Deleted draft invoice ${invoiceNumber}`
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}
