import React, { useEffect, useState } from 'react';
import { Edit3, Loader2, Plus, Power, Trash2, X } from 'lucide-react';
import { useFirebase } from '../../context/FirebaseContext';
import { useToast } from '../../components/ToastProvider';
import { formatIDR, slugify } from '../../lib/validation';
import {
  deleteServicePackage,
  fetchAllPackagesAdmin,
  saveServicePackage,
} from '../../services/firestoreService';
import type { ServicePackage } from '../../types/unscripted';

export function AdminPackagesPage() {
  const { user } = useFirebase();
  const { pushToast } = useToast();

  const [packages, setPackages] = useState<ServicePackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingPkg, setEditingPkg] = useState<ServicePackage | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [deletingPkg, setDeletingPkg] = useState<ServicePackage | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [price, setPrice] = useState('399000');
  const [tagline, setTagline] = useState('');
  const [description, setDescription] = useState('');
  const [coverageDetails, setCoverageDetails] = useState('');
  const [deliverablesText, setDeliverablesText] = useState('');
  const [additionalNotes, setAdditionalNotes] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [isFeatured, setIsFeatured] = useState(false);
  const [sortOrder, setSortOrder] = useState('1');

  const loadPackages = async () => {
    setLoading(true);
    try {
      const list = await fetchAllPackagesAdmin();
      setPackages(list);
    } catch (err) {
      pushToast('error', 'Failed to load packages', err instanceof Error ? err.message : undefined);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPackages();
  }, []);

  const openCreate = () => {
    setIsCreating(true);
    setEditingPkg(null);
    setName('');
    setSlug('');
    setPrice('399000');
    setTagline('');
    setDescription('');
    setCoverageDetails('');
    setDeliverablesText('');
    setAdditionalNotes('');
    setIsActive(true);
    setIsFeatured(false);
    setSortOrder(String(packages.length + 1));
  };

  const openEdit = (pkg: ServicePackage) => {
    setIsCreating(false);
    setEditingPkg(pkg);
    setName(pkg.name);
    setSlug(pkg.slug);
    setPrice(String(pkg.price));
    setTagline(pkg.tagline || '');
    setDescription(pkg.description);
    setCoverageDetails(pkg.coverageDetails || '');
    setDeliverablesText((pkg.deliverables || []).join('\n'));
    setAdditionalNotes(pkg.additionalNotes || '');
    setIsActive(pkg.isActive);
    setIsFeatured(pkg.isFeatured);
    setSortOrder(String(pkg.sortOrder ?? 1));
  };

  const closeModal = () => {
    setIsCreating(false);
    setEditingPkg(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    try {
      const computedSlug = slugify(slug || name) || `pkg-${Date.now()}`;
      const deliverables = deliverablesText
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .slice(0, 20);

      await saveServicePackage(
        user,
        {
          id: editingPkg?.id || computedSlug,
          name,
          slug: computedSlug,
          price: Number(price) || 0,
          tagline,
          description,
          coverageDetails,
          deliverables,
          additionalNotes,
          isActive,
          isFeatured,
          sortOrder: Number(sortOrder) || 1,
        },
        isCreating
      );
      pushToast('success', isCreating ? 'Package added' : 'Package updated', name);
      closeModal();
      await loadPackages();
    } catch (err) {
      pushToast('error', 'Save failed', err instanceof Error ? err.message : undefined);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (pkg: ServicePackage) => {
    if (!user) return;
    try {
      await saveServicePackage(
        user,
        { ...pkg, isActive: !pkg.isActive },
        false
      );
      setPackages((prev) =>
        prev.map((p) => (p.id === pkg.id ? { ...p, isActive: !p.isActive } : p))
      );
      pushToast(
        'success',
        !pkg.isActive ? 'Package activated' : 'Package deactivated',
        pkg.name
      );
    } catch (err) {
      pushToast('error', 'Toggle failed', err instanceof Error ? err.message : undefined);
    }
  };

  const handleConfirmDelete = async () => {
    if (!user || !deletingPkg) return;
    setSaving(true);
    try {
      await deleteServicePackage(user, deletingPkg.id);
      setPackages((prev) => prev.filter((p) => p.id !== deletingPkg.id));
      pushToast('success', 'Package deleted', deletingPkg.name);
      setDeletingPkg(null);
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
            Package Management
          </h1>
          <p className="mt-1 text-sm text-[#171717]/65">
            Update launch pricing, edit coverage descriptions, manage deliverables, and toggle availability.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#171717] text-white text-xs font-semibold hover:bg-[#D8FF3E] hover:text-[#171717] transition-colors cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Package
        </button>
      </div>

      {loading ? (
        <div className="p-12 bg-white border border-[#171717]/12 flex items-center justify-center gap-2 text-sm">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading packages...
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {packages.map((pkg) => (
            <div
              key={pkg.id}
              className={`bg-white border p-6 flex flex-col justify-between ${
                pkg.isActive ? 'border-[#171717]/15' : 'border-[#171717]/10 opacity-65'
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-2 text-xs font-mono">
                  <span className={pkg.isActive ? 'text-[#16A34A]' : 'text-[#DC2626]'}>
                    {pkg.isActive ? 'Active' : 'Inactive'}
                  </span>
                  <span className="text-[#171717]/55">Order #{pkg.sortOrder}</span>
                </div>
                <h2 className="mt-2 font-display text-2xl font-extrabold">{pkg.name}</h2>
                <p className="mt-2 font-mono text-2xl font-bold tabular-nums">
                  {formatIDR(pkg.price)}
                </p>
                {pkg.tagline && (
                  <p className="mt-2 text-xs text-[#171717]/75">{pkg.tagline}</p>
                )}
                <p className="mt-3 text-xs text-[#171717]/65 leading-relaxed">
                  {pkg.description}
                </p>

                {pkg.deliverables && pkg.deliverables.length > 0 && (
                  <ul className="mt-4 pt-4 border-t border-[#171717]/10 space-y-1 text-xs text-[#171717]/80">
                    {pkg.deliverables.map((d, idx) => (
                      <li key={idx}>• {d}</li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="mt-6 pt-4 border-t border-[#171717]/10 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => handleToggleActive(pkg)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-[#171717]/15 text-xs font-semibold hover:border-[#171717] cursor-pointer"
                >
                  <Power className="w-3.5 h-3.5" />
                  {pkg.isActive ? 'Deactivate' : 'Activate'}
                </button>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => openEdit(pkg)}
                    className="p-2 text-[#171717]/70 hover:text-[#171717] hover:bg-[#F5F1E9] cursor-pointer"
                    title="Edit package"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeletingPkg(pkg)}
                    className="p-2 text-[#171717]/70 hover:text-[#FF5A55] hover:bg-[#FF5A55]/10 cursor-pointer"
                    title="Delete package"
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
      {(isCreating || editingPkg) && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white border border-[#171717] max-w-2xl w-full p-6 sm:p-8 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-[#171717]/12">
              <h2 className="font-display text-xl font-bold">
                {isCreating ? 'Add Service Package' : `Edit ${editingPkg?.name}`}
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
                  <label className="block text-xs font-mono uppercase mb-1">
                    Package Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      if (isCreating) setSlug(slugify(e.target.value));
                    }}
                    className="w-full px-3 py-2 border border-[#171717]/20 focus:border-[#171717] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-mono uppercase mb-1">
                    Price (IDR) *
                  </label>
                  <input
                    type="number"
                    required
                    min={0}
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    className="w-full px-3 py-2 border border-[#171717]/20 focus:border-[#171717] focus:outline-none font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-mono uppercase mb-1">Slug *</label>
                  <input
                    type="text"
                    required
                    value={slug}
                    onChange={(e) => setSlug(slugify(e.target.value))}
                    className="w-full px-3 py-2 border border-[#171717]/20 focus:border-[#171717] focus:outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-mono uppercase mb-1">Sort Order</label>
                  <input
                    type="number"
                    min={1}
                    value={sortOrder}
                    onChange={(e) => setSortOrder(e.target.value)}
                    className="w-full px-3 py-2 border border-[#171717]/20 focus:border-[#171717] focus:outline-none font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-mono uppercase mb-1">Tagline</label>
                <input
                  type="text"
                  maxLength={160}
                  value={tagline}
                  onChange={(e) => setTagline(e.target.value)}
                  className="w-full px-3 py-2 border border-[#171717]/20 focus:border-[#171717] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-mono uppercase mb-1">Description *</label>
                <textarea
                  rows={3}
                  required
                  maxLength={1500}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-[#171717]/20 focus:border-[#171717] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-mono uppercase mb-1">
                  Coverage Details
                </label>
                <input
                  type="text"
                  maxLength={1000}
                  value={coverageDetails}
                  onChange={(e) => setCoverageDetails(e.target.value)}
                  className="w-full px-3 py-2 border border-[#171717]/20 focus:border-[#171717] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-mono uppercase mb-1">
                  Deliverables (One item per line)
                </label>
                <textarea
                  rows={4}
                  value={deliverablesText}
                  onChange={(e) => setDeliverablesText(e.target.value)}
                  placeholder="Enter deliverables, one per line..."
                  className="w-full px-3 py-2 border border-[#171717]/20 focus:border-[#171717] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-mono uppercase mb-1">
                  Additional Notes
                </label>
                <input
                  type="text"
                  maxLength={1000}
                  value={additionalNotes}
                  onChange={(e) => setAdditionalNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-[#171717]/20 focus:border-[#171717] focus:outline-none"
                />
              </div>

              <div className="flex flex-wrap items-center gap-6 pt-2">
                <label className="inline-flex items-center gap-2 text-xs font-semibold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    className="w-4 h-4 accent-[#171717]"
                  />
                  Active on Public Site
                </label>
                <label className="inline-flex items-center gap-2 text-xs font-semibold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isFeatured}
                    onChange={(e) => setIsFeatured(e.target.checked)}
                    className="w-4 h-4 accent-[#171717]"
                  />
                  Highlight as Featured
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
                  {saving ? 'Saving...' : 'Save Package'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deletingPkg && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white border border-[#171717] max-w-md w-full p-6">
            <h2 className="font-display text-xl font-bold">Delete {deletingPkg.name}?</h2>
            <p className="mt-2 text-sm text-[#171717]/75">
              Existing bookings referencing this package keep their recorded snapshot, but the package will no longer appear on the booking form.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeletingPkg(null)}
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
