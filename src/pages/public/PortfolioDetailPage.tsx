import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowUpRight, X } from 'lucide-react';
import { formatDisplayDate } from '../../lib/validation';
import { subscribePublishedPortfolioBySlug } from '../../services/firestoreService';
import type { PortfolioItem, PortfolioMediaItem } from '../../types/unscripted';
import { MediaFrame } from '../../components/MediaFrame';

export function PortfolioDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const [item, setItem] = useState<PortfolioItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lightboxMedia, setLightboxMedia] = useState<PortfolioMediaItem | null>(null);

  useEffect(() => {
    if (!slug) {
      setItem(null);
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    setError(null);
    const unsubscribe = subscribePublishedPortfolioBySlug(
      slug,
      (data) => {
        if (!active) return;
        setItem(data);
        setError(null);
        setLoading(false);
      },
      (err) => {
        if (!active) return;
        setError(err.message || 'Unable to load story.');
        setLoading(false);
      }
    );
    return () => {
      active = false;
      unsubscribe();
    };
  }, [slug]);

  useEffect(() => {
    if (!lightboxMedia) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightboxMedia(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lightboxMedia]);

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-8 py-16 animate-pulse">
        <div className="h-6 w-32 bg-[#171717]/10 mb-6" />
        <div className="h-12 w-2/3 bg-[#171717]/10 mb-8" />
        <div className="aspect-[16/9] bg-[#171717]/10" />
      </div>
    );
  }

  if (error || !item) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-8 py-20 text-center">
        <p className="font-mono text-xs uppercase tracking-widest text-[#FF5A55] mb-3">
          Story Unavailable
        </p>
        <h1 className="font-display text-3xl font-extrabold mb-4">
          {error || 'This wedding story could not be found.'}
        </h1>
        <Link
          to="/portfolio"
          className="inline-flex items-center gap-2 px-6 py-3 bg-[#171717] text-white text-sm font-semibold"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Portfolio
        </Link>
      </div>
    );
  }

  const gallery =
    item.mediaItems && item.mediaItems.length > 0
      ? item.mediaItems
      : [{ url: item.coverImage, type: 'image' as const, caption: item.coupleName }];

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-8 py-12 lg:py-16">
      <Link
        to="/portfolio"
        className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-[#171717]/70 hover:text-[#171717] mb-8"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Portfolio
      </Link>

      <div className="pb-10 border-b border-[#171717]/15">
        <div className="flex flex-wrap items-center gap-2.5 text-xs text-[#171717]/65 mb-3">
          <span>{item.location}</span>
          <span aria-hidden="true">·</span>
          <span>{item.eventType}</span>
          <span aria-hidden="true">·</span>
          <span className="tabular-nums">{formatDisplayDate(item.eventDate)}</span>
        </div>
        <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight">
          {item.coupleName}
        </h1>
        <p className="mt-5 text-lg text-[#171717]/80 max-w-3xl leading-relaxed">
          {item.description}
        </p>
      </div>

      {/* Cover Media */}
      <div className="mt-10">
        <button
          type="button"
          onClick={() =>
            setLightboxMedia({ url: item.coverImage, type: 'image', caption: item.coupleName })
          }
          className="w-full block text-left cursor-pointer group"
        >
          <MediaFrame
            src={item.coverImage}
            alt={item.coupleName}
            className="aspect-[16/9] w-full border border-[#171717]/12"
            imgClassName="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.01]"
            fallbackTitle={item.coupleName}
          />
        </button>
      </div>

      {/* Media Gallery */}
      <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-6">
        {gallery.map((media, idx) => (
          <div key={idx} className="bg-white border border-[#171717]/12">
            {media.type === 'video' ? (
              <MediaFrame
                src={media.url}
                type="video"
                alt={media.caption || `${item.coupleName} clip ${idx + 1}`}
                className="aspect-[4/3] w-full"
              />
            ) : (
              <button
                type="button"
                onClick={() => setLightboxMedia(media)}
                className="w-full block cursor-pointer group"
              >
                <MediaFrame
                  src={media.url}
                  alt={media.caption || `${item.coupleName} frame ${idx + 1}`}
                  className="aspect-[4/3] w-full"
                  imgClassName="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                  fallbackTitle={item.coupleName}
                />
              </button>
            )}
            {media.caption && (
              <p className="px-4 py-3 text-xs text-[#171717]/70 border-t border-[#171717]/10">
                {media.caption}
              </p>
            )}
          </div>
        ))}
      </div>

      {/* Conversion Strip */}
      <div className="mt-16 p-8 sm:p-10 bg-[#171717] text-white flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-[#D8FF3E] mb-2">
            Inspired by this story?
          </p>
          <h2 className="font-display text-2xl sm:text-3xl font-bold">
            Let us capture your celebration without retakes.
          </h2>
        </div>
        <Link
          to="/booking"
          className="inline-flex items-center gap-2 px-6 py-3.5 bg-[#D8FF3E] text-[#171717] text-sm font-bold hover:bg-white transition-colors whitespace-nowrap shrink-0"
        >
          Book Your Date
          <ArrowUpRight className="w-4 h-4" />
        </Link>
      </div>

      {/* Fullscreen Lightbox */}
      {lightboxMedia && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4 sm:p-8"
          onClick={() => setLightboxMedia(null)}
        >
          <button
            type="button"
            onClick={() => setLightboxMedia(null)}
            className="absolute top-5 right-5 p-2.5 bg-white text-[#171717] hover:bg-[#D8FF3E] transition-colors cursor-pointer"
            aria-label="Close media viewer"
          >
            <X className="w-5 h-5" />
          </button>
          <div
            className="max-w-5xl w-full max-h-[88vh] flex flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={lightboxMedia.url}
              alt={lightboxMedia.caption || item.coupleName}
              referrerPolicy="no-referrer"
              className="max-h-[78vh] w-auto object-contain"
            />
            <div className="mt-4 flex items-center gap-3 text-xs text-white/80 font-mono">
              <span>{item.coupleName}</span>
              <span aria-hidden="true">·</span>
              <span>{formatDisplayDate(item.eventDate)}</span>
              {lightboxMedia.caption && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>{lightboxMedia.caption}</span>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
