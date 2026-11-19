import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Edit3,
  Eye,
  EyeOff,
  Loader2,
  Plus,
  Quote,
  Save,
  Trash2,
  X,
} from 'lucide-react';
import { useFirebase } from '../../context/FirebaseContext';
import { useToast } from '../../components/ToastProvider';
import {
  deleteCoupleNote,
  saveCoupleNote,
  subscribeAllCoupleNotesAdmin,
} from '../../services/firestoreService';
import type { CoupleNote } from '../../types/unscripted';

interface NoteDraft {
  coupleName: string;
  weddingDetails: string;
  note: string;
  description: string;
  tag: string;
  published: boolean;
  sortOrder: number;
}

const EMPTY_DRAFT: NoteDraft = {
  coupleName: '',
  weddingDetails: '',
  note: '',
  description: '',
  tag: 'Client Note',
  published: true,
  sortOrder: 1,
};

export function AdminCoupleNotesPage() {
  const { user } = useFirebase();
  const { pushToast } = useToast();

  const [items, setItems] = useState<CoupleNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [editingItem, setEditingItem] = useState<CoupleNote | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [draft, setDraft] = useState<NoteDraft>(EMPTY_DRAFT);
  const [initialDraft, setInitialDraft] = useState<NoteDraft>(EMPTY_DRAFT);
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmDiscardOpen, setConfirmDiscardOpen] = useState(false);

  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deletingItem, setDeletingItem] = useState<CoupleNote | null>(null);

  useEffect(() => {
    let active = true;
    const unsubscribe = subscribeAllCoupleNotesAdmin(
      (list) => {
        if (!active) return;
        setItems(list);
        setLoadError(null);
        setLoading(false);
      },
      (err) => {
        if (!active) return;
        const msg = err.message || 'Failed to load couple notes.';
        setLoadError(msg);
        setLoading(false);
        pushToast('error', 'Failed to load couple notes', msg);
      }
    );
    return () => {
      active = false;
      unsubscribe();
    };
  }, [pushToast]);

  const isDirty = useMemo(() => {
    return (
      draft.coupleName !== initialDraft.coupleName ||
      draft.weddingDetails !== initialDraft.weddingDetails ||
      draft.note !== initialDraft.note ||
      draft.description !== initialDraft.description ||
      draft.tag !== initialDraft.tag ||
      draft.published !== initialDraft.published ||
      draft.sortOrder !== initialDraft.sortOrder
    );
  }, [draft, initialDraft]);

  const openCreate = () => {
    const nextOrder =
      items.length > 0 ? Math.max(...items.map((i) => i.sortOrder || 0)) + 1 : 1;
    const nextDraft: NoteDraft = {
      ...EMPTY_DRAFT,
      sortOrder: nextOrder,
    };
    setIsCreating(true);
    setEditingItem(null);
    setDraft(nextDraft);
    setInitialDraft(nextDraft);
    setFormError(null);
    setConfirmDiscardOpen(false);
  };

  const openEdit = (item: CoupleNote) => {
    const nextDraft: NoteDraft = {
      coupleName: item.coupleName || '',
      weddingDetails: item.weddingDetails || '',
      note: item.note || '',
      description: item.description || '',
      tag: item.tag || '',
      published: Boolean(item.published),
      sortOrder: item.sortOrder ?? 1,
    };
    setIsCreating(false);
    setEditingItem(item);
    setDraft(nextDraft);
    setInitialDraft(nextDraft);
    setFormError(null);
    setConfirmDiscardOpen(false);
  };

  const forceCloseModal = () => {
    setIsCreating(false);
    setEditingItem(null);
    setFormError(null);
    setConfirmDiscardOpen(false);
  };

  const requestCloseModal = () => {
    if (saving) return;
    if (isDirty) {
      setConfirmDiscardOpen(true);
    } else {
      forceCloseModal();
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setFormError(null);

    if (draft.coupleName.trim().length < 2) {
      setFormError('Couple name must be at least 2 characters.');
      return;
    }
    if (draft.weddingDetails.trim().length < 2) {
      setFormError('Wedding details must be at least 2 characters.');
      return;
    }
    if (draft.note.trim().length < 2) {
      setFormError('Couple note must be at least 2 characters.');
      return;
    }

    setSaving(true);
    try {
      await saveCoupleNote(
        user,
        {
          id: editingItem?.id || '',
          coupleName: draft.coupleName,
          weddingDetails: draft.weddingDetails,
          note: draft.note,
          description: draft.description,
          tag: draft.tag,
          published: draft.published,
          sortOrder: draft.sortOrder,
        },
        isCreating
      );
      pushToast(
        'success',
        isCreating ? 'Couple Note created' : 'Couple Note saved',
        draft.coupleName.trim()
      );
      forceCloseModal();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to save couple note.';
      setFormError(msg);
      pushToast('error', 'Save failed', msg);
    } finally {
      setSaving(false);
    }
  };

  const handleTogglePublish = async (item: CoupleNote) => {
    if (!user || togglingId === item.id) return;
    setTogglingId(item.id);
    try {
      await saveCoupleNote(
        user,
        {
          id: item.id,
          coupleName: item.coupleName,
          weddingDetails: item.weddingDetails,
          note: item.note,
          description: item.description || '',
          tag: item.tag || '',
          published: !item.published,
          sortOrder: item.sortOrder ?? 1,
        },
        false
      );
      pushToast(
        'success',
        !item.published ? 'Published to homepage' : 'Unpublished (draft)',
        item.coupleName
      );
    } catch (err) {
      pushToast('error', 'Update failed', err instanceof Error ? err.message : undefined);
    } finally {
      setTogglingId(null);
    }
  };

  const handleConfirmDelete = async () => {
    if (!user || !deletingItem) return;
    setSaving(true);
    try {
      const couple = deletingItem.coupleName;
      await deleteCoupleNote(user, deletingItem.id);
      pushToast('success', 'Couple Note deleted', couple);
      setDeletingItem(null);
    } catch (err) {
      pushToast('error', 'Delete failed', err instanceof Error ? err.message : undefined);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight">
            Couple Notes
          </h1>
          <p className="mt-1 text-sm text-[#171717]/65">
            Edit couple testimonials, wedding details, and descriptions displayed on the public homepage.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#171717] text-white text-xs font-semibold hover:bg-[#D8FF3E] hover:text-[#171717] transition-colors cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          New Couple Note
        </button>
      </div>

      {loadError && (
        <div className="p-4 bg-[#FF5A55]/10 border border-[#FF5A55] text-sm">{loadError}</div>
      )}

      {loading ? (
        <div className="p-12 bg-white border border-[#171717]/12 flex items-center justify-center gap-2 text-sm">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading couple notes...
        </div>
      ) : items.length === 0 ? (
        <div className="p-12 bg-white border border-[#171717]/12 text-center">
          <Quote className="w-8 h-8 mx-auto text-[#171717]/30 mb-3" />
          <p className="font-display text-lg font-bold">No Couple Notes yet.</p>
          <p className="mt-1 text-xs text-[#171717]/60">
            Create a Couple Note to publish verified couple reflections on the homepage.
          </p>
          <button
            type="button"
            onClick={openCreate}
            className="mt-4 px-5 py-2.5 bg-[#171717] text-white text-xs font-semibold hover:bg-[#D8FF3E] hover:text-[#171717] transition-colors cursor-pointer"
          >
            Create Couple Note
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {items.map((item) => (
            <div
              key={item.id}
              className="bg-white border border-[#171717]/12 p-6 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between gap-2 text-xs font-mono pb-4 border-b border-[#171717]/10">
                  <div className="flex items-center gap-2">
                    <span className={item.published ? 'text-[#16A34A]' : 'text-[#D97706]'}>
                      {item.published ? 'Published' : 'Draft'}
                    </span>
                    <span className="text-[#171717]/35" aria-hidden="true">
                      ·
                    </span>
                    <span className="text-[#171717]/60 tabular-nums">
                      Order #{item.sortOrder ?? 1}
                    </span>
                  </div>
                  {item.tag && (
                    <span className="text-[#171717]/65 font-mono">{item.tag}</span>
                  )}
                </div>

                <blockquote className="mt-5 font-serif-accent italic text-xl text-[#171717] leading-relaxed">
                  “{item.note}”
                </blockquote>

                <div className="mt-5 pt-4 border-t border-[#171717]/10">
                  <p className="font-display text-lg font-bold text-[#171717]">
                    {item.coupleName}
                  </p>
                  <p className="text-xs text-[#171717]/65 mt-0.5">{item.weddingDetails}</p>
                  {item.description && (
                    <p className="mt-3 text-xs text-[#171717]/75 leading-relaxed">
                      {item.description}
                    </p>
                  )}
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-[#171717]/10 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => handleTogglePublish(item)}
                  disabled={togglingId === item.id}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 border border-[#171717]/15 hover:border-[#171717] disabled:opacity-50 cursor-pointer"
                >
                  {togglingId === item.id ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : item.published ? (
                    <EyeOff className="w-3.5 h-3.5" />
                  ) : (
                    <Eye className="w-3.5 h-3.5" />
                  )}
                  <span>{item.published ? 'Unpublish' : 'Publish'}</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => openEdit(item)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#171717] text-white text-xs font-semibold hover:bg-[#D8FF3E] hover:text-[#171717] transition-colors cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeletingItem(item)}
                    className="p-2 text-[#171717]/70 hover:text-[#FF5A55] hover:bg-[#FF5A55]/10 cursor-pointer"
                    title="Delete Couple Note"
                    aria-label={`Delete ${item.coupleName}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit Modal */}
      {(isCreating || editingItem) && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white border border-[#171717] max-w-2xl w-full p-6 sm:p-8 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-[#171717]/12">
              <div>
                <h2 className="font-display text-xl font-bold">
                  {isCreating ? 'New Couple Note' : `Edit Couple Note · ${editingItem?.coupleName}`}
                </h2>
                {isDirty && (
                  <p className="text-[11px] font-mono text-[#D97706] mt-0.5">
                    Unsaved changes
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={requestCloseModal}
                disabled={saving}
                className="p-1.5 hover:bg-[#F5F1E9] cursor-pointer"
                aria-label="Close editor"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="mt-4 p-3 bg-[#FF5A55]/10 border border-[#FF5A55] text-xs text-[#171717]">
                {formError}
              </div>
            )}

            <form onSubmit={handleSave} className="mt-5 space-y-4 text-sm">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="couple-note-name" className="block text-xs font-mono uppercase mb-1">
                    Couple Name *
                  </label>
                  <input
                    id="couple-note-name"
                    type="text"
                    required
                    minLength={2}
                    maxLength={120}
                    value={draft.coupleName}
                    onChange={(e) => setDraft({ ...draft, coupleName: e.target.value })}
                    placeholder="e.g. Nadia & Rizky"
                    className="w-full px-3 py-2 border border-[#171717]/20 focus:border-[#171717] focus:outline-none"
                  />
                </div>

                <div>
                  <label htmlFor="couple-note-details" className="block text-xs font-mono uppercase mb-1">
                    Wedding Details *
                  </label>
                  <input
                    id="couple-note-details"
                    type="text"
                    required
                    minLength={2}
                    maxLength={160}
                    value={draft.weddingDetails}
                    onChange={(e) => setDraft({ ...draft, weddingDetails: e.target.value })}
                    placeholder="e.g. Garden Ceremony · Semarang"
                    className="w-full px-3 py-2 border border-[#171717]/20 focus:border-[#171717] focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="couple-note-tag" className="block text-xs font-mono uppercase mb-1">
                    Tag / Label (Optional)
                  </label>
                  <input
                    id="couple-note-tag"
                    type="text"
                    maxLength={60}
                    value={draft.tag}
                    onChange={(e) => setDraft({ ...draft, tag: e.target.value })}
                    placeholder="e.g. Client Note"
                    className="w-full px-3 py-2 border border-[#171717]/20 focus:border-[#171717] focus:outline-none"
                  />
                </div>

                <div>
                  <label htmlFor="couple-note-order" className="block text-xs font-mono uppercase mb-1">
                    Display Order
                  </label>
                  <input
                    id="couple-note-order"
                    type="number"
                    min={0}
                    max={1000}
                    value={draft.sortOrder}
                    onChange={(e) =>
                      setDraft({ ...draft, sortOrder: Number(e.target.value) || 0 })
                    }
                    className="w-full px-3 py-2 border border-[#171717]/20 focus:border-[#171717] focus:outline-none font-mono"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label htmlFor="couple-note-quote" className="block text-xs font-mono uppercase">
                    Couple Note / Quote *
                  </label>
                  <span className="text-[11px] font-mono text-[#171717]/55 tabular-nums">
                    {draft.note.length}/1000
                  </span>
                </div>
                <textarea
                  id="couple-note-quote"
                  rows={4}
                  required
                  minLength={2}
                  maxLength={1000}
                  value={draft.note}
                  onChange={(e) => setDraft({ ...draft, note: e.target.value })}
                  placeholder="Write the couple's testimonial or candid reflection..."
                  className="w-full px-3 py-2 border border-[#171717]/20 focus:border-[#171717] focus:outline-none"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label htmlFor="couple-note-description" className="block text-xs font-mono uppercase">
                    Description / Additional Context (Optional)
                  </label>
                  <span className="text-[11px] font-mono text-[#171717]/55 tabular-nums">
                    {draft.description.length}/1500
                  </span>
                </div>
                <textarea
                  id="couple-note-description"
                  rows={3}
                  maxLength={1500}
                  value={draft.description}
                  onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                  placeholder="Optional wedding coverage context, date, or story description..."
                  className="w-full px-3 py-2 border border-[#171717]/20 focus:border-[#171717] focus:outline-none"
                />
              </div>

              <div className="pt-1">
                <label className="inline-flex items-center gap-2 text-xs font-semibold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={draft.published}
                    onChange={(e) => setDraft({ ...draft, published: e.target.checked })}
                    className="w-4 h-4 accent-[#171717]"
                  />
                  Published on Public Website
                </label>
              </div>

              <div className="pt-4 border-t border-[#171717]/12 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={requestCloseModal}
                  disabled={saving}
                  className="px-4 py-2.5 border border-[#171717]/20 text-xs font-semibold hover:border-[#171717] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#171717] text-white text-xs font-semibold hover:bg-[#D8FF3E] hover:text-[#171717] disabled:opacity-50 transition-colors cursor-pointer"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-3.5 h-3.5" />
                      Save Changes
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Discard Unsaved Changes Prompt */}
      {confirmDiscardOpen && (
        <div className="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white border border-[#171717] max-w-md w-full p-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-[#D97706] shrink-0 mt-0.5" />
              <div>
                <h3 className="font-display text-lg font-bold">Discard unsaved changes?</h3>
                <p className="mt-1.5 text-sm text-[#171717]/75">
                  You have unsaved edits for{' '}
                  <span className="font-semibold">{draft.coupleName || 'this Couple Note'}</span>.
                  Closing now will discard those edits.
                </p>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmDiscardOpen(false)}
                className="px-4 py-2 border border-[#171717]/20 text-xs font-semibold hover:border-[#171717] cursor-pointer"
              >
                Keep Editing
              </button>
              <button
                type="button"
                onClick={forceCloseModal}
                className="px-4 py-2 bg-[#FF5A55] text-white text-xs font-semibold hover:bg-[#171717] transition-colors cursor-pointer"
              >
                Discard Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deletingItem && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white border border-[#171717] max-w-md w-full p-6">
            <h2 className="font-display text-xl font-bold">
              Delete Couple Note for {deletingItem.coupleName}?
            </h2>
            <p className="mt-2 text-sm text-[#171717]/75">
              This permanently removes this note from Firestore and the public homepage.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeletingItem(null)}
                disabled={saving}
                className="px-4 py-2 border border-[#171717]/20 text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={saving}
                className="inline-flex items-center gap-2 px-4 py-2 bg-[#FF5A55] text-white text-xs font-semibold cursor-pointer"
              >
                {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {saving ? 'Deleting...' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
