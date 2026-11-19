import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { formatDisplayDate } from '../../lib/validation';
import { subscribePublishedPortfolio } from '../../services/firestoreService';
import type { PortfolioItem } from '../../types/unscripted';
import { MediaFrame } from '../../components/MediaFrame';

export function PortfolioPage() {
  const [items, setItems] = useState<PortfolioItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<string>('ALL');

  useEffect(() => {
    let active = true;
    const unsubscribe = subscribePublishedPortfolio(
      (data) => {
        if (!active) return;
        setItems(data);
        setError(null);
        setLoading(false);
      },
      (err) => {
        if (!active) return;
        setError(err.message || 'Failed to load portfolio.');
        setLoading(false);
      }
    );
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const eventTypes = useMemo(() => {
    const types = Array.from(new Set(items.map((item) => item.eventType).filter(Boolean)));
    return ['ALL', ...types];
  }, [items]);

  useEffect(() => {
    if (selectedType !== 'ALL' && !eventTypes.includes(selectedType)) {
      setSelectedType('ALL');
    }
  }, [eventTypes, selectedType]);

  const filteredItems = useMemo(() => {
    if (selectedType === 'ALL') return items;
    return items.filter((item) => item.eventType === selectedType);
  }, [items, selectedType]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-8 py-12 lg:py-20">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 pb-10 border-b border-[#171717]/15">
        <div className="max-w-2xl">
          <p className="font-mono text-xs uppercase tracking-[0.22em] text-[#FF5A55] font-semibold mb-3">
            Portfolio Archive
          </p>
          <h1 className="font-display text-4xl sm:text-5xl font-extrabold tracking-tight leading-[1.08]">
            Unscripted wedding stories.
          </h1>
          <p className="mt-4 text-base text-[#171717]/75">
            Real moments documented across Semarang, Salatiga, Boyolali, and surrounding celebrations.
          </p>
        </div>

        {eventTypes.length > 1 && (
          <div className="flex flex-wrap items-center gap-1.5 bg-white p-1 border border-[#171717]/15">
            {eventTypes.map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setSelectedType(type)}
                className={`px-3.5 py-2 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  selectedType === type
                    ? 'bg-[#171717] text-white'
                    : 'text-[#171717]/70 hover:text-[#171717]'
                }`}
              >
                {type === 'ALL' ? 'All Stories' : type}
              </button>
            ))}
          </div>
        )}
      </div>

      {error && (
        <div className="mt-8 p-5 bg-[#FF5A55]/10 border border-[#FF5A55] text-sm">{error}</div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 pt-12">
          {[0, 1, 2].map((i) => (
            <div key={i} className="animate-pulse">
              <div className="aspect-[4/3] bg-[#171717]/10 mb-4" />
              <div className="h-5 bg-[#171717]/10 w-1/2 mb-2" />
              <div className="h-4 bg-[#171717]/10 w-3/4" />
            </div>
          ))}
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="mt-12 p-12 bg-white border border-[#171717]/12 text-center">
          <p className="font-display text-xl font-bold">No published portfolio stories yet.</p>
          <p className="mt-2 text-sm text-[#171717]/65">
            Stories published in the Admin Portfolio Manager will appear here automatically.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-12 pt-12">
          {filteredItems.map((item) => (
            <Link key={item.id} to={`/portfolio/${item.slug}`} className="group block">
              <div className="aspect-[4/3] overflow-hidden border border-[#171717]/12 bg-white">
                <MediaFrame
                  src={item.coverImage}
                  alt={`${item.coupleName} — ${item.location}`}
                  className="w-full h-full"
                  imgClassName="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                  fallbackTitle={item.coupleName}
                />
              </div>
              <div className="mt-4">
                <div className="flex flex-wrap items-center gap-2 text-xs text-[#171717]/60">
                  <span>{item.location}</span>
                  <span aria-hidden="true">·</span>
                  <span>{item.eventType}</span>
                  <span aria-hidden="true">·</span>
                  <span className="tabular-nums">{formatDisplayDate(item.eventDate)}</span>
                </div>
                <h2 className="mt-1.5 font-display text-2xl font-bold text-[#171717] group-hover:text-[#FF5A55] transition-colors">
                  {item.coupleName}
                </h2>
                <p className="mt-1.5 text-sm text-[#171717]/75 line-clamp-2">{item.summary}</p>
                <span className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-[#171717] group-hover:translate-x-1 transition-transform">
                  Read Story
                  <ArrowRight className="w-3.5 h-3.5" />
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
