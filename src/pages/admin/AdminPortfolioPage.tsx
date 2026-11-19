import React, { useEffect, useState } from 'react';
import {
  Check,
  Edit3,
  Eye,
  EyeOff,
  Loader2,
  Plus,
  Star,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { useFirebase } from '../../context/FirebaseContext';
import { useToast } from '../../components/ToastProvider';
import { BRAND_IMAGES } from '../../data/defaults';
import { formatDisplayDate, slugify } from '../../lib/validation';
import {
  deletePortfolioItem,
  savePortfolioItem,
  subscribeAllPortfolioAdmin,
  uploadPortfolioMedia,
} from '../../services/firestoreService';
import type { PortfolioItem, PortfolioMediaItem } from '../../types/unscripted';
import { MediaFrame } from '../../components/MediaFrame';

export function AdminPortfolioPage() {
  const { user } = useFirebase();
  const { pushToast } = useToast();

  const [items, setItems] = useState<PortfolioItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<PortfolioItem | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [deletingItem, setDeletingItem] = useState<PortfolioItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

  // Form state
  const [coupleName, setCoupleName] = useState('');
  const [slug, setSlug] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [location, setLocation] = useState('');
  const [eventType, setEventType] = useState('Garden Ceremony');
  const [summary, setSummary] = useState('');
  const [description, setDescription] = useState('');
  const [coverImage, setCoverImage] = useState<string>(BRAND_IMAGES.semarangCeremony);
  const [mediaItems, setMediaItems] = useState<PortfolioMediaItem[]>([]);
  const [published, setPublished] = useState(true);
  const [featured, setFeatured] = useState(false);

  const [newMediaUrl, setNewMediaUrl] = useState('');
  const [newMediaType, setNewMediaType] = useState<'image' | 'video'>('image');
  const [newMediaCaption, setNewMediaCaption] = useState('');

  useEffect(() => {
    let active = true;
    const unsubscribe = subscribeAllPortfolioAdmin(
      (list) => {
        if (!active) return;
        setItems(list);
        setLoadError(null);
        setLoading(false);
      },
      (err) => {
        if (!active) return;
        const msg = err.message || 'Failed to load portfolio.';
        setLoadError(msg);
        setLoading(false);
        pushToast('error', 'Failed to load portfolio', msg);
      }
    );
    return () => {
      active = false;
      unsubscribe();
    };
  }, [pushToast]);

  const openCreate = () => {
    setIsCreating(true);
    setEditingItem(null);
    setCoupleName('');
    setSlug('');
    setEventDate(new Date().toISOString().split('T')[0]);
    setLocation('Semarang');
    setEventType('Garden Ceremony');
    setSummary('');
    setDescription('');
    setCoverImage(BRAND_IMAGES.semarangCeremony);
    setMediaItems([]);
    setPublished(true);
    setFeatured(false);
  };

  const openEdit = (item: PortfolioItem) => {
    setIsCreating(false);
    setEditingItem(item);
    setCoupleName(item.coupleName);
    setSlug(item.slug);
    setEventDate(item.eventDate);
    setLocation(item.location);
    setEventType(item.eventType);
    setSummary(item.summary);
    setDescription(item.description);
    setCoverImage(item.coverImage);
    setMediaItems(item.mediaItems || []);
    setPublished(item.published);
    setFeatured(item.featured);
  };

  const closeModal = () => {
    setIsCreating(false);
    setEditingItem(null);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (mediaItems.length >= 12) {
      pushToast('error', 'Gallery limit reached', 'Maximum 12 media items per story.');
      return;
    }

    setUploadProgress(0);
    try {
      const url = await uploadPortfolioMedia(file, (pct) => setUploadProgress(pct));
      const mediaType: 'image' | 'video' = file.type.startsWith('video/') ? 'video' : 'image';
      const nextItem: PortfolioMediaItem = {
        url,
        type: mediaType,
        caption: file.name.replace(/\.[^.]+$/, ''),
      };
      setMediaItems((prev) => [...prev, nextItem]);
      if (mediaType === 'image' && !coverImage) {
        setCoverImage(url);
      }
      pushToast('success', 'Media uploaded', 'Added to story gallery.');
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Storage upload failed. Ensure Firebase Storage is enabled or paste a hosted media URL.';
      pushToast('error', 'Upload failed', msg);
    } finally {
      setUploadProgress(null);
      e.target.value = '';
    }
  };

  const handleAddMediaUrl = () => {
    if (!newMediaUrl.trim()) return;
    if (mediaItems.length >= 12) {
      pushToast('error', 'Gallery limit reached', 'Maximum 12 media items per story.');
      return;
    }
    const entry: PortfolioMediaItem = {
      url: newMediaUrl.trim(),
      type: newMediaType,
      caption: newMediaCaption.trim() || undefined,
    };
    setMediaItems((prev) => [...prev, entry]);
    if (newMediaType === 'image' && !coverImage) {
      setCoverImage(entry.url);
    }
    setNewMediaUrl('');
    setNewMediaCaption('');
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const computedSlug = slugify(slug || coupleName);
    if (computedSlug.length < 2) {
      pushToast('error', 'Invalid slug', 'URL slug must be at least 2 characters.');
      return;
    }
    const slugConflict = items.find(
      (p) => p.slug === computedSlug && p.id !== editingItem?.id
    );
    if (slugConflict) {
      pushToast(
        'error',
        'Duplicate URL slug',
        `Another story (${slugConflict.coupleName}) already uses "${computedSlug}".`
      );
      return;
    }

    setSaving(true);
    try {
      await savePortfolioItem(
        user,
        {
          id: editingItem?.id || computedSlug,
          slug: computedSlug,
          coupleName,
          eventDate,
          location,
          eventType,
          summary,
          description,
          coverImage,
          mediaItems,
          published,
          featured,
        },
        isCreating
      );
      pushToast('success', isCreating ? 'Story created' : 'Story updated', coupleName);
      closeModal();
    } catch (err) {
      pushToast('error', 'Save failed', err instanceof Error ? err.message : undefined);
    } finally {
      setSaving(false);
    }
  };

  const handleTogglePublish = async (item: PortfolioItem) => {
    if (!user || togglingId === item.id) return;
    setTogglingId(item.id);
    try {
      await savePortfolioItem(
        user,
        {
          id: item.id,
          slug: item.slug,
          coupleName: item.coupleName,
          eventDate: item.eventDate,
          location: item.location,
          eventType: item.eventType,
          summary: item.summary,
          description: item.description,
          coverImage: item.coverImage,
          mediaItems: item.mediaItems || [],
          published: !item.published,
          featured: item.featured,
        },
        false
      );
      pushToast(
        'success',
        !item.published ? 'Published to website' : 'Unpublished (draft)',
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
      const deletedName = deletingItem.coupleName;
      await deletePortfolioItem(user, deletingItem.id);
      pushToast('success', 'Story deleted', `${deletedName} removed from Firestore.`);
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
            Portfolio Management
          </h1>
          <p className="mt-1 text-sm text-[#171717]/65">
            Changes save directly to Firestore and sync immediately with the public website.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#171717] text-white text-xs font-semibold hover:bg-[#D8FF3E] hover:text-[#171717] transition-colors cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          New Portfolio Story
        </button>
      </div>

      {loadError && (
        <div className="p-4 bg-[#FF5A55]/10 border border-[#FF5A55] text-sm">{loadError}</div>
      )}

      {loading ? (
        <div className="p-12 bg-white border border-[#171717]/12 flex items-center justify-center gap-2 text-sm">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading portfolio stories...
        </div>
      ) : items.length === 0 ? (
        <div className="p-12 bg-white border border-[#171717]/12 text-center">
          <p className="font-display text-lg font-bold">No portfolio stories yet.</p>
          <button
            type="button"
            onClick={openCreate}
            className="mt-4 px-5 py-2.5 bg-[#171717] text-white text-xs font-semibold cursor-pointer"
          >
            Create First Story
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {items.map((item) => (
            <div key={item.id} className="bg-white border border-[#171717]/12 flex flex-col">
              <div className="aspect-[4/3] relative">
                <MediaFrame
                  src={item.coverImage}
                  alt={item.coupleName}
                  className="w-full h-full"
                  fallbackTitle={item.coupleName}
                />
              </div>
              <div className="p-5 flex-1 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between gap-2 text-xs font-mono">
                    <span className={item.published ? 'text-[#16A34A]' : 'text-[#D97706]'}>
                      {item.published ? 'Published' : 'Draft'}
                    </span>
                    {item.featured && (
                      <span className="text-[#171717]/65 inline-flex items-center gap-1">
                        <Star className="w-3 h-3 fill-[#D8FF3E]" />
                        Featured
                      </span>
                    )}
                  </div>
                  <h2 className="mt-2 font-display text-xl font-bold">{item.coupleName}</h2>
                  <p className="text-xs text-[#171717]/60 mt-1">
                    {item.location} · {item.eventType} · {formatDisplayDate(item.eventDate)}
                  </p>
                  <p className="mt-2 text-xs text-[#171717]/75 line-clamp-2">{item.summary}</p>
                </div>

                <div className="mt-5 pt-4 border-t border-[#171717]/10 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => handleTogglePublish(item)}
                    disabled={togglingId === item.id}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 border border-[#171717]/15 hover:border-[#171717] disabled:opacity-50 cursor-pointer"
                  >
                    {item.published ? (
                      <>
                        <EyeOff className="w-3.5 h-3.5" />
                        Unpublish
                      </>
                    ) : (
                      <>
                        <Eye className="w-3.5 h-3.5" />
                        Publish
                      </>
                    )}
                  </button>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => openEdit(item)}
                      className="p-2 text-[#171717]/70 hover:text-[#171717] hover:bg-[#F5F1E9] cursor-pointer"
                      title="Edit story"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeletingItem(item)}
                      className="p-2 text-[#171717]/70 hover:text-[#FF5A55] hover:bg-[#FF5A55]/10 cursor-pointer"
                      title="Delete story"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit Story Modal */}
      {(isCreating || editingItem) && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white border border-[#171717] max-w-3xl w-full p-6 sm:p-8 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-[#171717]/12">
              <h2 className="font-display text-xl font-bold">
                {isCreating ? 'New Portfolio Story' : `Edit ${editingItem?.coupleName}`}
              </h2>
              <button
                type="button"
                onClick={closeModal}
                className="p-1.5 hover:bg-[#F5F1E9] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="mt-5 space-y-4 text-sm">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-mono uppercase mb-1">Couple Name *</label>
                  <input
                    type="text"
                    required
                    minLength={2}
                    maxLength={120}
                    value={coupleName}
                    onChange={(e) => {
                      setCoupleName(e.target.value);
                      if (isCreating) setSlug(slugify(e.target.value));
                    }}
                    className="w-full px-3 py-2 border border-[#171717]/20 focus:border-[#171717] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-mono uppercase mb-1">URL Slug *</label>
                  <input
                    type="text"
                    required
                    minLength={2}
                    maxLength={120}
                    value={slug}
                    onChange={(e) => setSlug(slugify(e.target.value))}
                    className="w-full px-3 py-2 border border-[#171717]/20 focus:border-[#171717] focus:outline-none font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-mono uppercase mb-1">Event Date *</label>
                  <input
                    type="date"
                    required
                    value={eventDate}
                    onChange={(e) => setEventDate(e.target.value)}
                    className="w-full px-3 py-2 border border-[#171717]/20 focus:border-[#171717] focus:outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-mono uppercase mb-1">Location *</label>
                  <input
                    type="text"
                    required
                    minLength={2}
                    maxLength={160}
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="w-full px-3 py-2 border border-[#171717]/20 focus:border-[#171717] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-mono uppercase mb-1">Event Type *</label>
                  <input
                    type="text"
                    required
                    minLength={2}
                    maxLength={80}
                    value={eventType}
                    onChange={(e) => setEventType(e.target.value)}
                    className="w-full px-3 py-2 border border-[#171717]/20 focus:border-[#171717] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-mono uppercase mb-1">Short Summary *</label>
                <input
                  type="text"
                  required
                  minLength={2}
                  maxLength={300}
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  className="w-full px-3 py-2 border border-[#171717]/20 focus:border-[#171717] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-mono uppercase mb-1">
                  Event Description *
                </label>
                <textarea
                  rows={3}
                  required
                  minLength={2}
                  maxLength={3000}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-[#171717]/20 focus:border-[#171717] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-mono uppercase mb-1">
                  Cover Image URL *
                </label>
                <input
                  type="text"
                  required
                  value={coverImage}
                  onChange={(e) => setCoverImage(e.target.value)}
                  className="w-full px-3 py-2 border border-[#171717]/20 focus:border-[#171717] focus:outline-none font-mono text-xs"
                />
              </div>

              {/* Media Upload & URL Adder */}
              <div className="p-4 bg-[#F7F6F2] border border-[#171717]/12 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-mono uppercase font-semibold">
                    Story Media Gallery ({mediaItems.length}/12)
                  </p>
                  <label className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#171717] text-white text-xs font-semibold hover:bg-[#D8FF3E] hover:text-[#171717] cursor-pointer">
                    <Upload className="w-3.5 h-3.5" />
                    <span>
                      {uploadProgress !== null ? `Uploading ${uploadProgress}%` : 'Upload Media'}
                    </span>
                    <input
                      type="file"
                      accept="image/*,video/*"
                      onChange={handleFileUpload}
                      className="sr-only"
                    />
                  </label>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                  <input
                    type="text"
                    value={newMediaUrl}
                    onChange={(e) => setNewMediaUrl(e.target.value)}
                    placeholder="Or paste image/video URL..."
                    className="sm:col-span-6 px-3 py-2 bg-white border border-[#171717]/15 text-xs font-mono"
                  />
                  <select
                    value={newMediaType}
                    onChange={(e) => setNewMediaType(e.target.value as 'image' | 'video')}
                    className="sm:col-span-2 px-2 py-2 bg-white border border-[#171717]/15 text-xs"
                  >
                    <option value="image">Image</option>
                    <option value="video">Video</option>
                  </select>
                  <input
                    type="text"
                    value={newMediaCaption}
                    onChange={(e) => setNewMediaCaption(e.target.value)}
                    placeholder="Caption (optional)"
                    className="sm:col-span-3 px-3 py-2 bg-white border border-[#171717]/15 text-xs"
                  />
                  <button
                    type="button"
                    onClick={handleAddMediaUrl}
                    className="sm:col-span-1 px-3 py-2 bg-[#171717] text-white text-xs font-semibold cursor-pointer"
                  >
                    Add
                  </button>
                </div>

                {mediaItems.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {mediaItems.map((m, idx) => (
                      <div
                        key={idx}
                        className="p-2.5 bg-white border border-[#171717]/12 flex items-center justify-between gap-2"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-mono uppercase text-[#171717]/60">
                            {m.type} {coverImage === m.url ? '· Cover' : ''}
                          </p>
                          <p className="text-xs truncate">{m.caption || m.url}</p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {m.type === 'image' && coverImage !== m.url && (
                            <button
                              type="button"
                              onClick={() => setCoverImage(m.url)}
                              className="px-2 py-1 text-[11px] font-semibold border border-[#171717]/20 hover:bg-[#D8FF3E] cursor-pointer"
                            >
                              Set Cover
                            </button>
                          )}
                          {coverImage === m.url && <Check className="w-4 h-4 text-[#16A34A]" />}
                          <button
                            type="button"
                            onClick={() =>
                              setMediaItems((prev) => prev.filter((_, i) => i !== idx))
                            }
                            className="p-1 text-[#FF5A55] cursor-pointer"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-6 pt-2">
                <label className="inline-flex items-center gap-2 text-xs font-semibold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={published}
                    onChange={(e) => setPublished(e.target.checked)}
                    className="w-4 h-4 accent-[#171717]"
                  />
                  Published on Public Website
                </label>
                <label className="inline-flex items-center gap-2 text-xs font-semibold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={featured}
                    onChange={(e) => setFeatured(e.target.checked)}
                    className="w-4 h-4 accent-[#171717]"
                  />
                  Featured on Homepage
                </label>
              </div>

              <div className="pt-4 border-t border-[#171717]/12 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2.5 border border-[#171717]/20 text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2.5 bg-[#171717] text-white text-xs font-semibold hover:bg-[#D8FF3E] hover:text-[#171717] disabled:opacity-50 cursor-pointer"
                >
                  {saving ? 'Saving...' : 'Save Portfolio Story'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deletingItem && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white border border-[#171717] max-w-md w-full p-6">
            <h2 className="font-display text-xl font-bold">
              Delete {deletingItem.coupleName}?
            </h2>
            <p className="mt-2 text-sm text-[#171717]/75">
              This permanently removes this story from Firestore.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeletingItem(null)}
                className="px-4 py-2 border border-[#171717]/20 text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={saving}
                className="px-4 py-2 bg-[#FF5A55] text-white text-xs font-semibold cursor-pointer"
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
