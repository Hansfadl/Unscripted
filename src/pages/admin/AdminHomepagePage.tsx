import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Check,
  Crosshair,
  Eye,
  EyeOff,
  GripVertical,
  ImagePlus,
  Loader2,
  Monitor,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Smartphone,
  Sparkles,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { useFirebase } from '../../context/FirebaseContext';
import { useToast } from '../../components/ToastProvider';
import { BRAND_IMAGES, DEFAULT_HOMEPAGE_CONFIG } from '../../data/defaults';
import { formatDisplayDate } from '../../lib/validation';
import {
  collectHomepageStorageUrls,
  fetchAllPackagesAdmin,
  fetchHomepageAdminState,
  normalizeFocalPoint,
  publishHomepageConfig,
  saveHomepageDraft,
  subscribeAllCoupleNotesAdmin,
  subscribeAllPortfolioAdmin,
  uploadHomepageImage,
} from '../../services/firestoreService';
import type {
  CoupleNote,
  FocalPoint,
  HomepageConfig,
  HomepageGalleryItem,
  PortfolioItem,
  ServicePackage,
} from '../../types/unscripted';
import { MediaFrame } from '../../components/MediaFrame';
import { HomepageSections } from '../../components/HomepageSections';

type EditorTab = 'hero' | 'gallery' | 'about' | 'portfolio' | 'cta';

const HERO_FOCAL_PRESETS: { label: string; point: FocalPoint }[] = [
  { label: 'Top', point: { x: 50, y: 15 } },
  { label: 'Upper Mid', point: { x: 50, y: 32 } },
  { label: 'Center', point: { x: 50, y: 50 } },
  { label: 'Bottom', point: { x: 50, y: 82 } },
  { label: 'Left', point: { x: 22, y: 50 } },
  { label: 'Right', point: { x: 78, y: 50 } },
];

function serializeConfigForCompare(cfg: HomepageConfig): string {
  return JSON.stringify({
    heroTitle: cfg.heroTitle.trim(),
    heroSubtitle: cfg.heroSubtitle.trim(),
    heroImageUrl: cfg.heroImageUrl.trim(),
    heroImageAlt: (cfg.heroImageAlt || '').trim(),
    heroImagePosition: normalizeFocalPoint(cfg.heroImagePosition),
    heroCaption: (cfg.heroCaption || '').trim(),
    heroPrimaryCtaLabel: cfg.heroPrimaryCtaLabel.trim(),
    heroSecondaryCtaLabel: cfg.heroSecondaryCtaLabel.trim(),
    gallerySectionEnabled: Boolean(cfg.gallerySectionEnabled),
    galleryItems: (cfg.galleryItems || []).map((g, idx) => ({
      id: g.id,
      url: g.url.trim(),
      caption: (g.caption || '').trim(),
      visible: Boolean(g.visible),
      sortOrder: idx,
      focalPoint: g.focalPoint ? normalizeFocalPoint(g.focalPoint) : { x: 50, y: 50 },
    })),
    aboutEyebrow: (cfg.aboutEyebrow || '').trim(),
    aboutHeadline: cfg.aboutHeadline.trim(),
    aboutText: cfg.aboutText.trim(),
    aboutImageUrl: (cfg.aboutImageUrl || '').trim(),
    aboutImageAlt: (cfg.aboutImageAlt || '').trim(),
    aboutCtaLabel: (cfg.aboutCtaLabel || '').trim(),
    featuredPortfolioIds: cfg.featuredPortfolioIds || [],
    ctaEyebrow: (cfg.ctaEyebrow || '').trim(),
    ctaHeadline: cfg.ctaHeadline.trim(),
    ctaSubtext: (cfg.ctaSubtext || '').trim(),
    ctaButtonLabel: cfg.ctaButtonLabel.trim(),
  });
}

export function AdminHomepagePage() {
  const { user, settings } = useFirebase();
  const { pushToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<EditorTab>('hero');

  const [draft, setDraft] = useState<HomepageConfig>(() => ({
    ...DEFAULT_HOMEPAGE_CONFIG,
  }));
  const [savedDraftSnapshot, setSavedDraftSnapshot] = useState<HomepageConfig | null>(null);
  const [publishedSnapshot, setPublishedSnapshot] = useState<HomepageConfig | null>(null);
  const [hasPublishedDoc, setHasPublishedDoc] = useState(false);

  const [savingDraft, setSavingDraft] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Uploads state
  const [heroUploadProgress, setHeroUploadProgress] = useState<number | null>(null);
  const [aboutUploadProgress, setAboutUploadProgress] = useState<number | null>(null);
  const [galleryUploadStatus, setGalleryUploadStatus] = useState<string | null>(null);
  const [replacingGalleryId, setReplacingGalleryId] = useState<string | null>(null);
  const [newGalleryUrl, setNewGalleryUrl] = useState('');

  // Focal point drag tracking
  const focalCanvasRef = useRef<HTMLDivElement | null>(null);
  const [isDraggingFocal, setIsDraggingFocal] = useState(false);

  // Gallery drag-and-drop state
  const [draggedGalleryId, setDraggedGalleryId] = useState<string | null>(null);
  const [dragOverGalleryId, setDragOverGalleryId] = useState<string | null>(null);

  // Modals
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewViewport, setPreviewViewport] = useState<'desktop' | 'mobile'>('desktop');
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);

  // Live site collections for preview & featured portfolio selection
  const [portfolio, setPortfolio] = useState<PortfolioItem[]>([]);
  const [packages, setPackages] = useState<ServicePackage[]>([]);
  const [coupleNotes, setCoupleNotes] = useState<CoupleNote[]>([]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetchHomepageAdminState()
      .then((state) => {
        if (!active) return;
        setDraft(state.draft);
        setSavedDraftSnapshot(state.draft);
        setPublishedSnapshot(state.published);
        setHasPublishedDoc(state.hasPublishedDoc);
        setLoadError(null);
      })
      .catch((err) => {
        if (!active) return;
        const msg = err instanceof Error ? err.message : 'Failed to load homepage settings.';
        setLoadError(msg);
        pushToast('error', 'Failed to load Homepage Customization', msg);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    fetchAllPackagesAdmin()
      .then((pkgs) => {
        if (active) setPackages(pkgs.filter((p) => p.isActive));
      })
      .catch((err) => console.error('Admin homepage packages fetch error:', err));

    const unsubPortfolio = subscribeAllPortfolioAdmin(
      (items) => {
        if (active) setPortfolio(items);
      },
      (err) => console.error('Admin homepage portfolio listener error:', err)
    );

    const unsubNotes = subscribeAllCoupleNotesAdmin(
      (items) => {
        if (active) setCoupleNotes(items.filter((n) => n.published));
      },
      (err) => console.error('Admin homepage couple notes listener error:', err)
    );

    return () => {
      active = false;
      unsubPortfolio();
      unsubNotes();
    };
  }, [pushToast]);

  const hasUnsavedLocalEdits = useMemo(() => {
    if (!savedDraftSnapshot) return false;
    return serializeConfigForCompare(draft) !== serializeConfigForCompare(savedDraftSnapshot);
  }, [draft, savedDraftSnapshot]);

  const differsFromLivePublished = useMemo(() => {
    if (!publishedSnapshot) return false;
    return serializeConfigForCompare(draft) !== serializeConfigForCompare(publishedSnapshot);
  }, [draft, publishedSnapshot]);

  const draftAheadOfPublished = useMemo(() => {
    if (!savedDraftSnapshot || !publishedSnapshot) return false;
    return (
      serializeConfigForCompare(savedDraftSnapshot) !==
      serializeConfigForCompare(publishedSnapshot)
    );
  }, [savedDraftSnapshot, publishedSnapshot]);

  const updateHeroPositionFromPointer = useCallback((clientX: number, clientY: number) => {
    const el = focalCanvasRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const rawX = ((clientX - rect.left) / rect.width) * 100;
    const rawY = ((clientY - rect.top) / rect.height) * 100;
    const nextPoint = normalizeFocalPoint({ x: rawX, y: rawY });
    setDraft((prev) => ({
      ...prev,
      heroImagePosition: nextPoint,
    }));
  }, []);

  // --- Handlers: Uploads ---

  const handleHeroImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setHeroUploadProgress(0);
    setValidationError(null);
    try {
      const url = await uploadHomepageImage(file, 'hero', (pct) => setHeroUploadProgress(pct));
      setDraft((prev) => ({
        ...prev,
        heroImageUrl: url,
        heroImageAlt:
          prev.heroImageAlt ||
          file.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' '),
      }));
      pushToast('success', 'Hero image uploaded', 'Save draft or publish to apply.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to upload hero image.';
      pushToast('error', 'Hero upload failed', msg);
      setValidationError(msg);
    } finally {
      setHeroUploadProgress(null);
      e.target.value = '';
    }
  };

  const handleAboutImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAboutUploadProgress(0);
    setValidationError(null);
    try {
      const url = await uploadHomepageImage(file, 'about', (pct) => setAboutUploadProgress(pct));
      setDraft((prev) => ({
        ...prev,
        aboutImageUrl: url,
        aboutImageAlt:
          prev.aboutImageAlt ||
          file.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' '),
      }));
      pushToast('success', 'About image uploaded', 'Save draft or publish to apply.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to upload about image.';
      pushToast('error', 'About image upload failed', msg);
      setValidationError(msg);
    } finally {
      setAboutUploadProgress(null);
      e.target.value = '';
    }
  };

  const handleGalleryMultiUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const remainingSlots = 16 - draft.galleryItems.length;
    if (remainingSlots <= 0) {
      pushToast('error', 'Gallery limit reached', 'Maximum 16 homepage gallery images.');
      e.target.value = '';
      return;
    }

    const toUpload = files.slice(0, remainingSlots);
    if (files.length > remainingSlots) {
      pushToast(
        'info',
        'Upload capped at 16 images',
        `Uploading the first ${remainingSlots} selected images.`
      );
    }

    const uploadedItems: HomepageGalleryItem[] = [];
    try {
      for (let i = 0; i < toUpload.length; i += 1) {
        const file = toUpload[i];
        setGalleryUploadStatus(`Uploading ${i + 1} of ${toUpload.length}...`);
        const url = await uploadHomepageImage(file, 'gallery');
        uploadedItems.push({
          id: `gal_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          url,
          caption: '',
          visible: true,
          sortOrder: draft.galleryItems.length + uploadedItems.length,
          focalPoint: { x: 50, y: 50 },
        });
      }

      if (uploadedItems.length > 0) {
        setDraft((prev) => {
          const next = [...prev.galleryItems, ...uploadedItems].map((item, idx) => ({
            ...item,
            sortOrder: idx,
          }));
          return { ...prev, galleryItems: next };
        });
        pushToast(
          'success',
          `Uploaded ${uploadedItems.length} ${uploadedItems.length === 1 ? 'image' : 'images'}`,
          'Reorder, add captions, and publish when ready.'
        );
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Gallery upload failed.';
      pushToast('error', 'Gallery upload failed', msg);
      setValidationError(msg);
    } finally {
      setGalleryUploadStatus(null);
      e.target.value = '';
    }
  };

  const handleReplaceGalleryImage = async (
    itemId: string,
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setReplacingGalleryId(itemId);
    try {
      const url = await uploadHomepageImage(file, 'gallery');
      setDraft((prev) => ({
        ...prev,
        galleryItems: prev.galleryItems.map((item) =>
          item.id === itemId ? { ...item, url } : item
        ),
      }));
      pushToast('success', 'Gallery image replaced', 'Existing live image remains safe until publish.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to replace gallery image.';
      pushToast('error', 'Replace failed', msg);
    } finally {
      setReplacingGalleryId(null);
      e.target.value = '';
    }
  };

  const handleAddGalleryByUrl = () => {
    const trimmed = newGalleryUrl.trim();
    if (!trimmed) return;
    if (draft.galleryItems.length >= 16) {
      pushToast('error', 'Gallery limit reached', 'Maximum 16 homepage gallery images.');
      return;
    }
    const nextItem: HomepageGalleryItem = {
      id: `gal_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      url: trimmed,
      caption: '',
      visible: true,
      sortOrder: draft.galleryItems.length,
      focalPoint: { x: 50, y: 50 },
    };
    setDraft((prev) => ({
      ...prev,
      galleryItems: [...prev.galleryItems, nextItem].map((item, idx) => ({
        ...item,
        sortOrder: idx,
      })),
    }));
    setNewGalleryUrl('');
  };

  // --- Handlers: Gallery Reordering & Mutations ---

  const reorderGalleryByIds = (sourceId: string, targetId: string) => {
    if (sourceId === targetId) return;
    setDraft((prev) => {
      const list = [...prev.galleryItems];
      const fromIndex = list.findIndex((i) => i.id === sourceId);
      const toIndex = list.findIndex((i) => i.id === targetId);
      if (fromIndex === -1 || toIndex === -1) return prev;
      const [moved] = list.splice(fromIndex, 1);
      list.splice(toIndex, 0, moved);
      return {
        ...prev,
        galleryItems: list.map((item, idx) => ({ ...item, sortOrder: idx })),
      };
    });
  };

  const moveGalleryByOffset = (index: number, offset: -1 | 1) => {
    const target = index + offset;
    if (target < 0 || target >= draft.galleryItems.length) return;
    setDraft((prev) => {
      const list = [...prev.galleryItems];
      const [moved] = list.splice(index, 1);
      list.splice(target, 0, moved);
      return {
        ...prev,
        galleryItems: list.map((item, idx) => ({ ...item, sortOrder: idx })),
      };
    });
  };

  const updateGalleryItem = (itemId: string, patch: Partial<HomepageGalleryItem>) => {
    setDraft((prev) => ({
      ...prev,
      galleryItems: prev.galleryItems.map((item) =>
        item.id === itemId ? { ...item, ...patch } : item
      ),
    }));
  };

  const removeGalleryItem = (itemId: string) => {
    setDraft((prev) => ({
      ...prev,
      galleryItems: prev.galleryItems
        .filter((item) => item.id !== itemId)
        .map((item, idx) => ({ ...item, sortOrder: idx })),
    }));
  };

  // --- Handlers: Featured Portfolio Selection ---

  const toggleFeaturedPortfolio = (storyId: string) => {
    setDraft((prev) => {
      const current = prev.featuredPortfolioIds || [];
      if (current.includes(storyId)) {
        return {
          ...prev,
          featuredPortfolioIds: current.filter((id) => id !== storyId),
        };
      }
      if (current.length >= 6) {
        pushToast('error', 'Maximum 6 featured stories', 'Remove one before selecting another.');
        return prev;
      }
      return {
        ...prev,
        featuredPortfolioIds: [...current, storyId],
      };
    });
  };

  const moveFeaturedPortfolio = (index: number, offset: -1 | 1) => {
    setDraft((prev) => {
      const list = [...(prev.featuredPortfolioIds || [])];
      const target = index + offset;
      if (target < 0 || target >= list.length) return prev;
      const [moved] = list.splice(index, 1);
      list.splice(target, 0, moved);
      return { ...prev, featuredPortfolioIds: list };
    });
  };

  // --- Handlers: Draft & Publish Persistence ---

  const handleSaveDraft = async () => {
    if (!user) return;
    setValidationError(null);
    setSavingDraft(true);
    try {
      const saved = await saveHomepageDraft(user, draft);
      setDraft(saved);
      setSavedDraftSnapshot(saved);
      pushToast('success', 'Homepage draft saved', 'Preview or publish whenever ready.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to save homepage draft.';
      setValidationError(msg);
      pushToast('error', 'Draft save failed', msg);
    } finally {
      setSavingDraft(false);
    }
  };

  const handlePublish = async () => {
    if (!user) return;
    setValidationError(null);
    setPublishing(true);
    try {
      const candidateOrphanUrls = Array.from(
        new Set([
          ...collectHomepageStorageUrls(publishedSnapshot),
          ...collectHomepageStorageUrls(savedDraftSnapshot),
        ])
      );
      const published = await publishHomepageConfig(user, draft, candidateOrphanUrls);
      setDraft(published);
      setSavedDraftSnapshot(published);
      setPublishedSnapshot(published);
      setHasPublishedDoc(true);
      setPreviewOpen(false);
      pushToast(
        'success',
        'Homepage changes published',
        'Public homepage is now updated with your changes.'
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to publish homepage changes.';
      setValidationError(msg);
      pushToast('error', 'Publish failed', msg);
    } finally {
      setPublishing(false);
    }
  };

  const handleConfirmResetToLive = () => {
    if (!publishedSnapshot) return;
    setDraft(publishedSnapshot);
    setValidationError(null);
    setConfirmResetOpen(false);
    pushToast(
      'info',
      'Draft reset to live content',
      'Click Save Draft or Publish Changes to persist this reset.'
    );
  };

  const publishedPortfolioStories = useMemo(
    () => portfolio.filter((item) => item.published),
    [portfolio]
  );

  const selectedPortfolioMap = useMemo(() => {
    const map = new Map<string, PortfolioItem>();
    for (const item of publishedPortfolioStories) {
      map.set(item.id, item);
    }
    return map;
  }, [publishedPortfolioStories]);

  const busy = savingDraft || publishing;

  if (loading) {
    return (
      <div className="p-12 bg-white border border-[#171717]/12 flex items-center justify-center gap-3 text-sm font-mono">
        <Loader2 className="w-4 h-4 animate-spin" />
        Loading homepage customization studio...
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Sticky/Top Editorial Action Bar */}
      <div className="bg-white border border-[#171717]/15 p-5 sm:p-6">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2.5 text-xs font-mono">
              <span className="uppercase tracking-widest text-[#FF5A55] font-semibold">
                Homepage Studio
              </span>
              <span className="text-[#171717]/30" aria-hidden="true">
                ·
              </span>
              {hasUnsavedLocalEdits ? (
                <span className="text-[#D97706] font-semibold">Unsaved edits</span>
              ) : draftAheadOfPublished ? (
                <span className="text-[#D97706] font-semibold">Draft ready to publish</span>
              ) : hasPublishedDoc ? (
                <span className="text-[#16A34A] font-semibold">Live & synced</span>
              ) : (
                <span className="text-[#171717]/65">Using default site copy</span>
              )}
            </div>
            <h1 className="mt-1.5 font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-[#171717]">
              Homepage Customization
            </h1>
            <p className="mt-1 text-sm text-[#171717]/65">
              Customize hero imagery and focal framing, curate gallery frames, update story copy, preview, and publish live.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {differsFromLivePublished && publishedSnapshot && (
              <button
                type="button"
                onClick={() => setConfirmResetOpen(true)}
                disabled={busy}
                className="inline-flex items-center gap-2 px-3.5 py-2.5 border border-[#171717]/20 text-xs font-semibold text-[#171717] hover:border-[#171717] disabled:opacity-50 transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Revert to Live
              </button>
            )}

            <button
              type="button"
              onClick={() => setPreviewOpen(true)}
              disabled={busy}
              className="inline-flex items-center gap-2 px-4 py-2.5 border border-[#171717] bg-white text-[#171717] text-xs font-semibold hover:bg-[#F5F1E9] disabled:opacity-50 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <Eye className="w-3.5 h-3.5" />
              Preview Homepage
            </button>

            <button
              type="button"
              onClick={handleSaveDraft}
              disabled={busy}
              className="inline-flex items-center gap-2 px-4 py-2.5 border border-[#171717]/25 bg-[#F5F1E9] text-[#171717] text-xs font-semibold hover:border-[#171717] disabled:opacity-50 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              {savingDraft ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Saving Draft...
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  Save Draft
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handlePublish}
              disabled={busy}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#171717] text-white text-xs font-semibold hover:bg-[#D8FF3E] hover:text-[#171717] disabled:opacity-50 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              {publishing ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Publishing...
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  Publish Changes
                </>
              )}
            </button>
          </div>
        </div>

        {(loadError || validationError) && (
          <div className="mt-4 p-3.5 bg-[#FF5A55]/10 border border-[#FF5A55] text-xs text-[#171717] flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-[#FF5A55] shrink-0 mt-0.5" />
            <span>{validationError || loadError}</span>
          </div>
        )}

        {/* Editor Section Tabs */}
        <div className="mt-6 pt-4 border-t border-[#171717]/10 flex items-center gap-2 overflow-x-auto">
          {(
            [
              { id: 'hero', label: '1. Hero & Focal Point' },
              { id: 'gallery', label: `2. Gallery (${draft.galleryItems.length})` },
              { id: 'about', label: '3. About Section' },
              {
                id: 'portfolio',
                label: `4. Featured Portfolio (${draft.featuredPortfolioIds.length})`,
              },
              { id: 'cta', label: '5. Bottom CTA' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 text-xs font-semibold border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                activeTab === tab.id
                  ? 'bg-[#171717] text-white border-[#171717]'
                  : 'bg-white text-[#171717]/75 border-[#171717]/15 hover:border-[#171717] hover:text-[#171717]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* TAB 1: HERO SECTION MANAGEMENT */}
      {activeTab === 'hero' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left: Hero Copy & Image Upload */}
          <div className="lg:col-span-6 bg-white border border-[#171717]/12 p-6 space-y-5">
            <div className="pb-3 border-b border-[#171717]/10">
              <h2 className="font-display text-lg font-bold">Hero Content & Copy</h2>
              <p className="text-xs text-[#171717]/60 mt-0.5">
                Customize the main headline, subheadline, overlay quote, and CTA labels.
              </p>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="hp-hero-title" className="text-xs font-mono uppercase">
                  Hero Title *
                </label>
                <span className="text-[11px] font-mono text-[#171717]/50 tabular-nums">
                  {draft.heroTitle.length}/200
                </span>
              </div>
              <input
                id="hp-hero-title"
                type="text"
                maxLength={200}
                value={draft.heroTitle}
                onChange={(e) => setDraft({ ...draft, heroTitle: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-[#171717]/20 focus:border-[#171717] focus:outline-none"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="hp-hero-subtitle" className="text-xs font-mono uppercase">
                  Hero Subtitle *
                </label>
                <span className="text-[11px] font-mono text-[#171717]/50 tabular-nums">
                  {draft.heroSubtitle.length}/500
                </span>
              </div>
              <textarea
                id="hp-hero-subtitle"
                rows={3}
                maxLength={500}
                value={draft.heroSubtitle}
                onChange={(e) => setDraft({ ...draft, heroSubtitle: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-[#171717]/20 focus:border-[#171717] focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="hp-hero-cta1" className="block text-xs font-mono uppercase mb-1">
                  Primary Button Label *
                </label>
                <input
                  id="hp-hero-cta1"
                  type="text"
                  maxLength={80}
                  value={draft.heroPrimaryCtaLabel}
                  onChange={(e) => setDraft({ ...draft, heroPrimaryCtaLabel: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-[#171717]/20 focus:border-[#171717] focus:outline-none"
                />
              </div>
              <div>
                <label htmlFor="hp-hero-cta2" className="block text-xs font-mono uppercase mb-1">
                  Secondary Button Label *
                </label>
                <input
                  id="hp-hero-cta2"
                  type="text"
                  maxLength={80}
                  value={draft.heroSecondaryCtaLabel}
                  onChange={(e) => setDraft({ ...draft, heroSecondaryCtaLabel: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-[#171717]/20 focus:border-[#171717] focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label htmlFor="hp-hero-caption" className="block text-xs font-mono uppercase mb-1">
                Hero Image Overlay Quote (Optional)
              </label>
              <input
                id="hp-hero-caption"
                type="text"
                maxLength={200}
                value={draft.heroCaption || ''}
                onChange={(e) => setDraft({ ...draft, heroCaption: e.target.value })}
                placeholder="“The best frames happen between the poses.”"
                className="w-full px-3 py-2 text-sm border border-[#171717]/20 focus:border-[#171717] focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="hp-hero-alt" className="block text-xs font-mono uppercase mb-1">
                Hero Image Alt Description
              </label>
              <input
                id="hp-hero-alt"
                type="text"
                maxLength={200}
                value={draft.heroImageAlt || ''}
                onChange={(e) => setDraft({ ...draft, heroImageAlt: e.target.value })}
                placeholder="Describe the hero photograph for accessibility"
                className="w-full px-3 py-2 text-sm border border-[#171717]/20 focus:border-[#171717] focus:outline-none"
              />
            </div>

            <div className="pt-4 border-t border-[#171717]/10 space-y-3">
              <label htmlFor="hp-hero-url" className="block text-xs font-mono uppercase">
                Hero Image Source (Upload or URL)
              </label>
              <div className="flex flex-wrap items-center gap-2.5">
                <label className="inline-flex items-center gap-2 px-4 py-2 bg-[#171717] text-white text-xs font-semibold hover:bg-[#D8FF3E] hover:text-[#171717] transition-colors cursor-pointer whitespace-nowrap shrink-0">
                  <Upload className="w-3.5 h-3.5" />
                  {heroUploadProgress !== null
                    ? `Uploading ${heroUploadProgress}%`
                    : draft.heroImageUrl
                      ? 'Replace Hero Image'
                      : 'Upload Hero Image'}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleHeroImageUpload}
                    disabled={heroUploadProgress !== null}
                    className="hidden"
                  />
                </label>

                {draft.heroImageUrl && (
                  <button
                    type="button"
                    onClick={() => setDraft({ ...draft, heroImageUrl: '' })}
                    className="inline-flex items-center gap-1.5 px-3 py-2 border border-[#FF5A55]/40 text-[#FF5A55] text-xs font-semibold hover:bg-[#FF5A55] hover:text-white transition-colors cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Remove Image
                  </button>
                )}

                {draft.heroImageUrl !== BRAND_IMAGES.hero && (
                  <button
                    type="button"
                    onClick={() =>
                      setDraft({
                        ...draft,
                        heroImageUrl: BRAND_IMAGES.hero,
                        heroImagePosition: { x: 50, y: 50 },
                      })
                    }
                    className="inline-flex items-center gap-1.5 px-3 py-2 border border-[#171717]/20 text-xs font-semibold hover:border-[#171717] transition-colors cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Use Default
                  </button>
                )}
              </div>

              <input
                id="hp-hero-url"
                type="text"
                maxLength={2000}
                value={draft.heroImageUrl}
                onChange={(e) => setDraft({ ...draft, heroImageUrl: e.target.value })}
                placeholder="https://... or upload an image above"
                className="w-full px-3 py-2 text-xs font-mono border border-[#171717]/20 focus:border-[#171717] focus:outline-none"
              />
            </div>
          </div>

          {/* Right: Interactive Hero Image Preview & Focal Point Picker */}
          <div className="lg:col-span-6 bg-white border border-[#171717]/12 p-6 space-y-5">
            <div className="flex items-center justify-between gap-2 pb-3 border-b border-[#171717]/10">
              <div>
                <h2 className="font-display text-lg font-bold">Focal Point & Live Hero Framing</h2>
                <p className="text-xs text-[#171717]/60 mt-0.5">
                  Click or drag on the photo to set where the frame centers across desktop and mobile crops.
                </p>
              </div>
              <span className="font-mono text-xs font-semibold tabular-nums text-[#171717] bg-[#F5F1E9] px-2.5 py-1 border border-[#171717]/15">
                {draft.heroImagePosition.x}% · {draft.heroImagePosition.y}%
              </span>
            </div>

            {/* Interactive Click/Drag Focal Surface */}
            <div
              ref={focalCanvasRef}
              role="application"
              aria-label="Hero image focal point picker"
              onMouseDown={(e) => {
                if (!draft.heroImageUrl) return;
                setIsDraggingFocal(true);
                updateHeroPositionFromPointer(e.clientX, e.clientY);
              }}
              onMouseMove={(e) => {
                if (!isDraggingFocal) return;
                updateHeroPositionFromPointer(e.clientX, e.clientY);
              }}
              onMouseUp={() => setIsDraggingFocal(false)}
              onMouseLeave={() => setIsDraggingFocal(false)}
              className={`relative aspect-[4/3] w-full overflow-hidden border border-[#171717]/20 select-none ${
                draft.heroImageUrl ? 'cursor-crosshair' : 'cursor-default'
              }`}
            >
              <MediaFrame
                src={draft.heroImageUrl}
                alt={draft.heroImageAlt || 'Hero focal point preview'}
                className="w-full h-full pointer-events-none"
                imgClassName="w-full h-full object-cover pointer-events-none"
                imgStyle={{
                  objectPosition: `${draft.heroImagePosition.x}% ${draft.heroImagePosition.y}%`,
                }}
                fallbackTitle="No Hero Image Selected"
              />

              {/* Overlay caption preview */}
              {(draft.heroCaption || draft.heroImageUrl) && (
                <div className="absolute inset-x-0 bottom-0 p-5 bg-gradient-to-t from-black/80 via-black/30 to-transparent text-white pointer-events-none">
                  {draft.heroCaption && (
                    <p className="font-serif-accent italic text-base">{draft.heroCaption}</p>
                  )}
                  <p className="mt-1 text-[11px] text-white/75 font-mono">
                    Semarang · Salatiga · Boyolali
                  </p>
                </div>
              )}

              {/* Crosshair Indicator */}
              {draft.heroImageUrl && (
                <div
                  style={{
                    left: `${draft.heroImagePosition.x}%`,
                    top: `${draft.heroImagePosition.y}%`,
                  }}
                  className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none"
                >
                  <div className="w-8 h-8 rounded-full border-2 border-[#D8FF3E] bg-[#171717]/45 flex items-center justify-center shadow-sm">
                    <Crosshair className="w-4 h-4 text-[#D8FF3E]" />
                  </div>
                </div>
              )}
            </div>

            {/* Quick Presets & Fine-Tune Sliders */}
            <div className="space-y-4">
              <div>
                <p className="text-[11px] font-mono uppercase text-[#171717]/60 mb-2">
                  Quick Focal Presets
                </p>
                <div className="flex flex-wrap gap-2">
                  {HERO_FOCAL_PRESETS.map((preset) => {
                    const active =
                      Math.abs(draft.heroImagePosition.x - preset.point.x) < 1 &&
                      Math.abs(draft.heroImagePosition.y - preset.point.y) < 1;
                    return (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() =>
                          setDraft({ ...draft, heroImagePosition: { ...preset.point } })
                        }
                        className={`px-3 py-1.5 text-xs font-medium border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                          active
                            ? 'bg-[#171717] text-white border-[#171717]'
                            : 'bg-[#F5F1E9]/60 text-[#171717] border-[#171717]/15 hover:border-[#171717]'
                        }`}
                      >
                        {preset.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-[#171717]/10">
                <div>
                  <div className="flex justify-between text-xs font-mono mb-1">
                    <label htmlFor="focal-x">Horizontal (X)</label>
                    <span className="tabular-nums">{draft.heroImagePosition.x}%</span>
                  </div>
                  <input
                    id="focal-x"
                    type="range"
                    min={0}
                    max={100}
                    step={1}
                    value={draft.heroImagePosition.x}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        heroImagePosition: {
                          ...draft.heroImagePosition,
                          x: Number(e.target.value),
                        },
                      })
                    }
                    className="w-full accent-[#171717]"
                  />
                </div>
                <div>
                  <div className="flex justify-between text-xs font-mono mb-1">
                    <label htmlFor="focal-y">Vertical (Y)</label>
                    <span className="tabular-nums">{draft.heroImagePosition.y}%</span>
                  </div>
                  <input
                    id="focal-y"
                    type="range"
                    min={0}
                    max={100}
                    step={1}
                    value={draft.heroImagePosition.y}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        heroImagePosition: {
                          ...draft.heroImagePosition,
                          y: Number(e.target.value),
                        },
                      })
                    }
                    className="w-full accent-[#171717]"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: HOMEPAGE GALLERY MANAGEMENT */}
      {activeTab === 'gallery' && (
        <div className="bg-white border border-[#171717]/12 p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#171717]/12">
            <div>
              <h2 className="font-display text-lg font-bold">Homepage Gallery Management</h2>
              <p className="text-xs text-[#171717]/65 mt-0.5">
                Upload multiple photos, drag and drop to reorder, toggle visibility, replace files, and add captions.
              </p>
            </div>

            <label className="inline-flex items-center gap-2.5 text-xs font-semibold cursor-pointer select-none">
              <input
                type="checkbox"
                checked={draft.gallerySectionEnabled}
                onChange={(e) =>
                  setDraft({ ...draft, gallerySectionEnabled: e.target.checked })
                }
                className="w-4 h-4 accent-[#171717]"
              />
              Show Gallery Section on Public Homepage
            </label>
          </div>

          {/* Upload & URL Controls */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center bg-[#F5F1E9]/60 border border-[#171717]/12 p-4">
            <div className="lg:col-span-5 flex flex-wrap items-center gap-3">
              <label className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#171717] text-white text-xs font-semibold hover:bg-[#D8FF3E] hover:text-[#171717] transition-colors cursor-pointer whitespace-nowrap shrink-0">
                <ImagePlus className="w-4 h-4" />
                {galleryUploadStatus ? galleryUploadStatus : 'Upload Multiple Images'}
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={handleGalleryMultiUpload}
                  disabled={Boolean(galleryUploadStatus) || draft.galleryItems.length >= 16}
                  className="hidden"
                />
              </label>
              <span className="text-xs font-mono text-[#171717]/60 tabular-nums">
                {draft.galleryItems.length}/16 images
              </span>
            </div>

            <div className="lg:col-span-7 flex flex-col sm:flex-row gap-2">
              <input
                type="url"
                value={newGalleryUrl}
                onChange={(e) => setNewGalleryUrl(e.target.value)}
                placeholder="Or paste an image URL (https://...)"
                className="flex-1 px-3 py-2 text-xs font-mono bg-white border border-[#171717]/20 focus:border-[#171717] focus:outline-none"
              />
              <button
                type="button"
                onClick={handleAddGalleryByUrl}
                disabled={!newGalleryUrl.trim() || draft.galleryItems.length >= 16}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 border border-[#171717] bg-white text-xs font-semibold hover:bg-[#171717] hover:text-white disabled:opacity-40 transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                Add URL
              </button>
            </div>
          </div>

          {/* Drag-and-Drop Gallery Grid */}
          {draft.galleryItems.length === 0 ? (
            <div className="p-12 border border-dashed border-[#171717]/25 text-center">
              <p className="font-display text-lg font-bold text-[#171717]">
                No homepage gallery images yet.
              </p>
              <p className="mt-1.5 text-xs text-[#171717]/65 max-w-md mx-auto">
                Upload photos above to showcase curated wedding frames directly on your homepage. Leaving this empty preserves the default homepage layout.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
              {draft.galleryItems.map((item, idx) => {
                const isDragTarget =
                  dragOverGalleryId === item.id && draggedGalleryId !== item.id;
                const fp = item.focalPoint || { x: 50, y: 50 };
                return (
                  <div
                    key={item.id}
                    draggable
                    onDragStart={(e) => {
                      setDraggedGalleryId(item.id);
                      e.dataTransfer.effectAllowed = 'move';
                      e.dataTransfer.setData('text/plain', item.id);
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = 'move';
                      if (dragOverGalleryId !== item.id) {
                        setDragOverGalleryId(item.id);
                      }
                    }}
                    onDragLeave={() => {
                      if (dragOverGalleryId === item.id) {
                        setDragOverGalleryId(null);
                      }
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      const sourceId = draggedGalleryId || e.dataTransfer.getData('text/plain');
                      if (sourceId) {
                        reorderGalleryByIds(sourceId, item.id);
                      }
                      setDraggedGalleryId(null);
                      setDragOverGalleryId(null);
                    }}
                    onDragEnd={() => {
                      setDraggedGalleryId(null);
                      setDragOverGalleryId(null);
                    }}
                    className={`border p-4 bg-white transition-all flex flex-col justify-between gap-4 ${
                      isDragTarget
                        ? 'border-[#171717] ring-2 ring-[#D8FF3E]'
                        : 'border-[#171717]/15'
                    } ${draggedGalleryId === item.id ? 'opacity-50' : 'opacity-100'}`}
                  >
                    {/* Card Header: Drag Handle, Order, Reorder Arrows, Delete */}
                    <div className="flex items-center justify-between gap-2 pb-2 border-b border-[#171717]/10">
                      <div className="flex items-center gap-2 text-xs font-mono">
                        <GripVertical
                          className="w-4 h-4 text-[#171717]/45 cursor-grab"
                          aria-hidden="true"
                        />
                        <span className="font-semibold tabular-nums">Frame #{idx + 1}</span>
                        <span className="text-[#171717]/30" aria-hidden="true">
                          ·
                        </span>
                        <span className={item.visible ? 'text-[#16A34A]' : 'text-[#D97706]'}>
                          {item.visible ? 'Visible' : 'Hidden'}
                        </span>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => moveGalleryByOffset(idx, -1)}
                          disabled={idx === 0}
                          className="p-1.5 border border-[#171717]/15 hover:border-[#171717] disabled:opacity-30 cursor-pointer"
                          title="Move earlier"
                          aria-label={`Move frame ${idx + 1} earlier`}
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => moveGalleryByOffset(idx, 1)}
                          disabled={idx === draft.galleryItems.length - 1}
                          className="p-1.5 border border-[#171717]/15 hover:border-[#171717] disabled:opacity-30 cursor-pointer"
                          title="Move later"
                          aria-label={`Move frame ${idx + 1} later`}
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeGalleryItem(item.id)}
                          className="p-1.5 text-[#FF5A55] hover:bg-[#FF5A55]/10 cursor-pointer"
                          title="Delete gallery image"
                          aria-label={`Delete frame ${idx + 1}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Preview */}
                    <div className="aspect-[4/3] overflow-hidden border border-[#171717]/10 relative">
                      <MediaFrame
                        src={item.url}
                        alt={item.caption || `Gallery frame ${idx + 1}`}
                        className="w-full h-full"
                        imgClassName="w-full h-full object-cover"
                        imgStyle={{ objectPosition: `${fp.x}% ${fp.y}%` }}
                        fallbackTitle={`Frame #${idx + 1}`}
                      />
                    </div>

                    {/* Caption + Controls */}
                    <div className="space-y-3">
                      <div>
                        <label
                          htmlFor={`gal-caption-${item.id}`}
                          className="block text-[11px] font-mono uppercase text-[#171717]/60 mb-1"
                        >
                          Caption (Optional)
                        </label>
                        <input
                          id={`gal-caption-${item.id}`}
                          type="text"
                          maxLength={200}
                          value={item.caption || ''}
                          onChange={(e) =>
                            updateGalleryItem(item.id, { caption: e.target.value })
                          }
                          placeholder="e.g. Morning preparation · Semarang"
                          className="w-full px-3 py-1.5 text-xs border border-[#171717]/20 focus:border-[#171717] focus:outline-none"
                        />
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() =>
                            updateGalleryItem(item.id, { visible: !item.visible })
                          }
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold border cursor-pointer whitespace-nowrap shrink-0 ${
                            item.visible
                              ? 'bg-[#171717] text-white border-[#171717]'
                              : 'bg-white text-[#171717]/75 border-[#171717]/20 hover:border-[#171717]'
                          }`}
                        >
                          {item.visible ? (
                            <>
                              <Eye className="w-3.5 h-3.5" />
                              Show on Home
                            </>
                          ) : (
                            <>
                              <EyeOff className="w-3.5 h-3.5" />
                              Hidden
                            </>
                          )}
                        </button>

                        <label className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold border border-[#171717]/20 hover:border-[#171717] cursor-pointer whitespace-nowrap shrink-0">
                          {replacingGalleryId === item.id ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              Uploading...
                            </>
                          ) : (
                            <>
                              <Upload className="w-3.5 h-3.5" />
                              Replace
                            </>
                          )}
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => handleReplaceGalleryImage(item.id, e)}
                            disabled={replacingGalleryId === item.id}
                            className="hidden"
                          />
                        </label>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: ABOUT SECTION */}
      {activeTab === 'about' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 bg-white border border-[#171717]/12 p-6 space-y-4">
            <div className="pb-3 border-b border-[#171717]/10">
              <h2 className="font-display text-lg font-bold">About & Brand Statement Section</h2>
              <p className="text-xs text-[#171717]/60 mt-0.5">
                Customize the dark obsidian brand philosophy block shown immediately below the hero marquee.
              </p>
            </div>

            <div>
              <label htmlFor="hp-about-eyebrow" className="block text-xs font-mono uppercase mb-1">
                Section Eyebrow
              </label>
              <input
                id="hp-about-eyebrow"
                type="text"
                maxLength={80}
                value={draft.aboutEyebrow || ''}
                onChange={(e) => setDraft({ ...draft, aboutEyebrow: e.target.value })}
                placeholder="The UNSCRIPTED Philosophy"
                className="w-full px-3 py-2 text-sm border border-[#171717]/20 focus:border-[#171717] focus:outline-none"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="hp-about-headline" className="text-xs font-mono uppercase">
                  About Headline *
                </label>
                <span className="text-[11px] font-mono text-[#171717]/50 tabular-nums">
                  {draft.aboutHeadline.length}/240
                </span>
              </div>
              <textarea
                id="hp-about-headline"
                rows={2}
                maxLength={240}
                value={draft.aboutHeadline}
                onChange={(e) => setDraft({ ...draft, aboutHeadline: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-[#171717]/20 focus:border-[#171717] focus:outline-none"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="hp-about-text" className="text-xs font-mono uppercase">
                  About Description Text *
                </label>
                <span className="text-[11px] font-mono text-[#171717]/50 tabular-nums">
                  {draft.aboutText.length}/1200
                </span>
              </div>
              <textarea
                id="hp-about-text"
                rows={4}
                maxLength={1200}
                value={draft.aboutText}
                onChange={(e) => setDraft({ ...draft, aboutText: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-[#171717]/20 focus:border-[#171717] focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="hp-about-cta" className="block text-xs font-mono uppercase mb-1">
                Link Label
              </label>
              <input
                id="hp-about-cta"
                type="text"
                maxLength={80}
                value={draft.aboutCtaLabel || ''}
                onChange={(e) => setDraft({ ...draft, aboutCtaLabel: e.target.value })}
                placeholder="Read our story & approach"
                className="w-full px-3 py-2 text-sm border border-[#171717]/20 focus:border-[#171717] focus:outline-none"
              />
            </div>
          </div>

          <div className="lg:col-span-5 bg-white border border-[#171717]/12 p-6 space-y-4">
            <div className="pb-3 border-b border-[#171717]/10">
              <h2 className="font-display text-lg font-bold">Optional About Image</h2>
              <p className="text-xs text-[#171717]/60 mt-0.5">
                Leave empty to keep the classic centered typography layout, or upload an image for a two-column editorial split.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <label className="inline-flex items-center gap-2 px-4 py-2 bg-[#171717] text-white text-xs font-semibold hover:bg-[#D8FF3E] hover:text-[#171717] transition-colors cursor-pointer whitespace-nowrap shrink-0">
                <Upload className="w-3.5 h-3.5" />
                {aboutUploadProgress !== null
                  ? `Uploading ${aboutUploadProgress}%`
                  : draft.aboutImageUrl
                    ? 'Replace Image'
                    : 'Upload About Image'}
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleAboutImageUpload}
                  disabled={aboutUploadProgress !== null}
                  className="hidden"
                />
              </label>

              {draft.aboutImageUrl && (
                <button
                  type="button"
                  onClick={() => setDraft({ ...draft, aboutImageUrl: '' })}
                  className="inline-flex items-center gap-1.5 px-3 py-2 border border-[#FF5A55]/40 text-[#FF5A55] text-xs font-semibold hover:bg-[#FF5A55] hover:text-white transition-colors cursor-pointer whitespace-nowrap shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Remove Image
                </button>
              )}

              {draft.aboutImageUrl !== BRAND_IMAGES.aboutBts && (
                <button
                  type="button"
                  onClick={() =>
                    setDraft({
                      ...draft,
                      aboutImageUrl: BRAND_IMAGES.aboutBts,
                      aboutImageAlt: 'UNSCRIPTED wedding content creator filming candidly',
                    })
                  }
                  className="inline-flex items-center gap-1.5 px-3 py-2 border border-[#171717]/20 text-xs font-semibold hover:border-[#171717] transition-colors cursor-pointer whitespace-nowrap shrink-0"
                >
                  Use BTS Photo
                </button>
              )}
            </div>

            <div>
              <label htmlFor="hp-about-url" className="block text-xs font-mono uppercase mb-1">
                Image URL
              </label>
              <input
                id="hp-about-url"
                type="text"
                maxLength={2000}
                value={draft.aboutImageUrl || ''}
                onChange={(e) => setDraft({ ...draft, aboutImageUrl: e.target.value })}
                placeholder="Empty = text-only Brand Statement layout"
                className="w-full px-3 py-2 text-xs font-mono border border-[#171717]/20 focus:border-[#171717] focus:outline-none"
              />
            </div>

            {draft.aboutImageUrl ? (
              <>
                <div className="aspect-[4/5] max-w-xs border border-[#171717]/15 overflow-hidden">
                  <MediaFrame
                    src={draft.aboutImageUrl}
                    alt={draft.aboutImageAlt || 'About section preview'}
                    className="w-full h-full"
                    imgClassName="w-full h-full object-cover"
                    fallbackTitle="About Image Preview"
                  />
                </div>
                <div>
                  <label htmlFor="hp-about-alt" className="block text-xs font-mono uppercase mb-1">
                    About Image Alt Text
                  </label>
                  <input
                    id="hp-about-alt"
                    type="text"
                    maxLength={200}
                    value={draft.aboutImageAlt || ''}
                    onChange={(e) => setDraft({ ...draft, aboutImageAlt: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-[#171717]/20 focus:border-[#171717] focus:outline-none"
                  />
                </div>
              </>
            ) : (
              <div className="p-6 bg-[#171717] text-[#F5F1E9] border border-[#171717]">
                <p className="font-mono text-[11px] uppercase tracking-widest text-[#D8FF3E]">
                  Active Mode: Centered Typography
                </p>
                <p className="mt-2 text-xs text-white/75 leading-relaxed">
                  No About image selected. The homepage keeps the single-column editorial statement block. Upload an image anytime to switch to a text + photo split.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: FEATURED PORTFOLIO SELECTION */}
      {activeTab === 'portfolio' && (
        <div className="bg-white border border-[#171717]/12 p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#171717]/12">
            <div>
              <h2 className="font-display text-lg font-bold">Featured Portfolio Selection</h2>
              <p className="text-xs text-[#171717]/65 mt-0.5">
                Pick and order up to 6 published wedding stories to spotlight on the homepage. If none are picked here, the homepage automatically shows stories flagged as Featured in Portfolio Manager.
              </p>
            </div>
            {draft.featuredPortfolioIds.length > 0 && (
              <button
                type="button"
                onClick={() => setDraft({ ...draft, featuredPortfolioIds: [] })}
                className="px-3.5 py-2 border border-[#171717]/20 text-xs font-semibold hover:border-[#171717] cursor-pointer whitespace-nowrap shrink-0"
              >
                Clear Selection (Auto)
              </button>
            )}
          </div>

          {/* Selected Order Preview */}
          {draft.featuredPortfolioIds.length > 0 && (
            <div className="bg-[#F5F1E9]/65 border border-[#171717]/12 p-4 space-y-3">
              <p className="text-xs font-mono uppercase tracking-wider text-[#171717]/70">
                Homepage Display Order ({draft.featuredPortfolioIds.length}/6)
              </p>
              <div className="space-y-2">
                {draft.featuredPortfolioIds.map((storyId, idx) => {
                  const story = selectedPortfolioMap.get(storyId);
                  return (
                    <div
                      key={storyId}
                      className="flex items-center justify-between gap-3 bg-white border border-[#171717]/12 p-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="font-mono text-xs font-bold text-[#FF5A55] tabular-nums w-6">
                          #{idx + 1}
                        </span>
                        {story ? (
                          <div className="min-w-0">
                            <p className="text-sm font-bold truncate">{story.coupleName}</p>
                            <p className="text-xs text-[#171717]/60 truncate">
                              {story.location} · {story.eventType} · {formatDisplayDate(story.eventDate)}
                            </p>
                          </div>
                        ) : (
                          <p className="text-xs text-[#D97706] font-mono">
                            Story ({storyId}) is currently unpublished or deleted
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => moveFeaturedPortfolio(idx, -1)}
                          disabled={idx === 0}
                          className="p-1.5 border border-[#171717]/15 hover:border-[#171717] disabled:opacity-30 cursor-pointer"
                          aria-label="Move up"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => moveFeaturedPortfolio(idx, 1)}
                          disabled={idx === draft.featuredPortfolioIds.length - 1}
                          className="p-1.5 border border-[#171717]/15 hover:border-[#171717] disabled:opacity-30 cursor-pointer"
                          aria-label="Move down"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleFeaturedPortfolio(storyId)}
                          className="p-1.5 text-[#FF5A55] hover:bg-[#FF5A55]/10 cursor-pointer"
                          aria-label="Remove from homepage"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Available Published Stories */}
          {publishedPortfolioStories.length === 0 ? (
            <div className="p-10 border border-dashed border-[#171717]/20 text-center text-sm text-[#171717]/65">
              No published portfolio stories found yet. Publish stories in Portfolio Management to feature them here.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {publishedPortfolioStories.map((story) => {
                const selectedIndex = draft.featuredPortfolioIds.indexOf(story.id);
                const isSelected = selectedIndex !== -1;
                return (
                  <button
                    key={story.id}
                    type="button"
                    onClick={() => toggleFeaturedPortfolio(story.id)}
                    className={`text-left border p-3.5 transition-all cursor-pointer flex flex-col justify-between ${
                      isSelected
                        ? 'border-[#171717] bg-[#D8FF3E]/20 ring-1 ring-[#171717]'
                        : 'border-[#171717]/15 bg-white hover:border-[#171717]'
                    }`}
                  >
                    <div>
                      <div className="aspect-[16/10] overflow-hidden border border-[#171717]/10 mb-3 relative">
                        <MediaFrame
                          src={story.coverImage}
                          alt={story.coupleName}
                          className="w-full h-full"
                          imgClassName="w-full h-full object-cover"
                          fallbackTitle={story.coupleName}
                        />
                        {isSelected && (
                          <span className="absolute top-2 right-2 px-2 py-0.5 bg-[#171717] text-[#D8FF3E] font-mono text-[11px] font-bold flex items-center gap-1">
                            <Check className="w-3 h-3" />
                            #{selectedIndex + 1}
                          </span>
                        )}
                      </div>
                      <p className="font-display font-bold text-base text-[#171717]">
                        {story.coupleName}
                      </p>
                      <p className="text-xs text-[#171717]/60 mt-0.5">
                        {story.location} · {formatDisplayDate(story.eventDate)}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 5: BOTTOM CTA SECTION */}
      {activeTab === 'cta' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-6 bg-white border border-[#171717]/12 p-6 space-y-4">
            <div className="pb-3 border-b border-[#171717]/10">
              <h2 className="font-display text-lg font-bold">Bottom Booking CTA Section</h2>
              <p className="text-xs text-[#171717]/60 mt-0.5">
                Customize the high-contrast coral call-to-action banner at the bottom of the homepage.
              </p>
            </div>

            <div>
              <label htmlFor="hp-cta-eyebrow" className="block text-xs font-mono uppercase mb-1">
                CTA Eyebrow
              </label>
              <input
                id="hp-cta-eyebrow"
                type="text"
                maxLength={80}
                value={draft.ctaEyebrow || ''}
                onChange={(e) => setDraft({ ...draft, ctaEyebrow: e.target.value })}
                placeholder="Ready When You Are"
                className="w-full px-3 py-2 text-sm border border-[#171717]/20 focus:border-[#171717] focus:outline-none"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="hp-cta-headline" className="text-xs font-mono uppercase">
                  CTA Headline *
                </label>
                <span className="text-[11px] font-mono text-[#171717]/50 tabular-nums">
                  {draft.ctaHeadline.length}/200
                </span>
              </div>
              <input
                id="hp-cta-headline"
                type="text"
                maxLength={200}
                value={draft.ctaHeadline}
                onChange={(e) => setDraft({ ...draft, ctaHeadline: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-[#171717]/20 focus:border-[#171717] focus:outline-none"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="hp-cta-subtext" className="text-xs font-mono uppercase">
                  CTA Supporting Text (Optional)
                </label>
                <span className="text-[11px] font-mono text-[#171717]/50 tabular-nums">
                  {(draft.ctaSubtext || '').length}/400
                </span>
              </div>
              <textarea
                id="hp-cta-subtext"
                rows={3}
                maxLength={400}
                value={draft.ctaSubtext || ''}
                onChange={(e) => setDraft({ ...draft, ctaSubtext: e.target.value })}
                placeholder={`Leave empty to use default service area (${settings.serviceArea})`}
                className="w-full px-3 py-2 text-sm border border-[#171717]/20 focus:border-[#171717] focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="hp-cta-button" className="block text-xs font-mono uppercase mb-1">
                CTA Button Label *
              </label>
              <input
                id="hp-cta-button"
                type="text"
                maxLength={80}
                value={draft.ctaButtonLabel}
                onChange={(e) => setDraft({ ...draft, ctaButtonLabel: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-[#171717]/20 focus:border-[#171717] focus:outline-none"
              />
            </div>
          </div>

          <div className="lg:col-span-6 bg-white border border-[#171717]/12 p-6 space-y-4">
            <div className="pb-3 border-b border-[#171717]/10">
              <h2 className="font-display text-lg font-bold">Live CTA Banner Preview</h2>
            </div>

            <div className="bg-[#FF5A55] text-[#171717] p-8 border border-[#171717]">
              <p className="font-mono text-xs uppercase tracking-[0.22em] text-[#171717]/80 font-semibold mb-3">
                {draft.ctaEyebrow || 'Ready When You Are'}
              </p>
              <h3 className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-balance">
                {draft.ctaHeadline || 'Lock in your wedding date before it fills up.'}
              </h3>
              <p className="mt-3 text-sm text-[#171717]/85">
                {draft.ctaSubtext || settings.serviceArea}
              </p>
              <span className="mt-6 inline-flex items-center gap-2 px-6 py-3 bg-[#171717] text-white text-xs font-bold">
                {draft.ctaButtonLabel || 'Start Booking Inquiry'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* LIVE HOMEPAGE PREVIEW MODAL */}
      {previewOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 flex flex-col">
          <div className="bg-[#171717] text-white px-4 sm:px-8 py-3.5 border-b border-white/15 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="font-mono text-xs uppercase tracking-widest text-[#D8FF3E] font-semibold">
                Draft Preview
              </span>
              <span className="text-xs text-white/65 hidden sm:inline">
                Review changes before publishing to https://unscripted.id
              </span>
            </div>

            <div className="flex items-center gap-2">
              <div className="inline-flex border border-white/20">
                <button
                  type="button"
                  onClick={() => setPreviewViewport('desktop')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold cursor-pointer ${
                    previewViewport === 'desktop'
                      ? 'bg-[#D8FF3E] text-[#171717]'
                      : 'text-white/75 hover:text-white'
                  }`}
                >
                  <Monitor className="w-3.5 h-3.5" />
                  Desktop
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewViewport('mobile')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold cursor-pointer ${
                    previewViewport === 'mobile'
                      ? 'bg-[#D8FF3E] text-[#171717]'
                      : 'text-white/75 hover:text-white'
                  }`}
                >
                  <Smartphone className="w-3.5 h-3.5" />
                  Mobile
                </button>
              </div>

              <button
                type="button"
                onClick={handlePublish}
                disabled={publishing}
                className="inline-flex items-center gap-2 px-4 py-1.5 bg-[#D8FF3E] text-[#171717] text-xs font-bold hover:bg-white transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                {publishing ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5" />
                )}
                {publishing ? 'Publishing...' : 'Publish Changes'}
              </button>

              <button
                type="button"
                onClick={() => setPreviewOpen(false)}
                className="p-2 text-white/75 hover:text-white cursor-pointer"
                aria-label="Close preview"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto bg-[#262626] p-0 sm:p-6">
            <div
              className={`bg-[#F5F1E9] text-[#171717] mx-auto shadow-2xl transition-all ${
                previewViewport === 'mobile' ? 'max-w-[390px]' : 'max-w-[1320px]'
              }`}
            >
              <HomepageSections
                config={draft}
                settings={settings}
                packages={packages}
                portfolio={portfolio}
                coupleNotes={coupleNotes}
                previewMode={true}
              />
            </div>
          </div>
        </div>
      )}

      {/* REVERT TO LIVE CONFIRMATION MODAL */}
      {confirmResetOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white border border-[#171717] max-w-md w-full p-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-[#D97706] shrink-0 mt-0.5" />
              <div>
                <h2 className="font-display text-lg font-bold">
                  Revert editor to current live homepage?
                </h2>
                <p className="mt-1.5 text-sm text-[#171717]/75">
                  This replaces the current editor fields with the currently published public homepage content. Click Save Draft or Publish afterwards if you want to overwrite the saved draft.
                </p>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmResetOpen(false)}
                className="px-4 py-2 border border-[#171717]/20 text-xs font-semibold hover:border-[#171717] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmResetToLive}
                className="px-4 py-2 bg-[#FF5A55] text-white text-xs font-semibold hover:bg-[#171717] transition-colors cursor-pointer"
              >
                Revert to Live
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
