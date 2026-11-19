import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ArrowUpRight, Check } from 'lucide-react';
import { DEFAULT_HOMEPAGE_CONFIG } from '../data/defaults';
import { formatDisplayDate, formatIDR } from '../lib/validation';
import type {
  CoupleNote,
  HomepageConfig,
  PortfolioItem,
  ServicePackage,
  SiteSettings,
} from '../types/unscripted';
import { MediaFrame } from './MediaFrame';

const WORKFLOW_STEPS = [
  {
    num: '01.',
    title: 'Inquiry',
    summary: 'Share your wedding date, venue area, and celebration style through our booking form.',
  },
  {
    num: '02.',
    title: 'Package Selection',
    summary: 'Choose CEREMONY, STORY, or FULL STORY based on the chapters you want documented.',
  },
  {
    num: '03.',
    title: 'Confirmation',
    summary: 'We verify date availability via WhatsApp and lock your slot once confirmed.',
  },
  {
    num: '04.',
    title: 'Event Coverage',
    summary: 'We shadow your celebration quietly—capturing genuine emotion without interrupting.',
  },
  {
    num: '05.',
    title: 'Content Delivery',
    summary: 'Receive your candid vertical reels and raw behind-the-scenes moments ready to relive.',
  },
];

interface HomepageSectionsProps {
  config: HomepageConfig;
  settings: SiteSettings;
  packages: ServicePackage[];
  portfolio: PortfolioItem[];
  portfolioLoading?: boolean;
  portfolioError?: string | null;
  coupleNotes: CoupleNote[];
  coupleNotesLoading?: boolean;
  coupleNotesError?: string | null;
  previewMode?: boolean;
}

function SafeLink({
  to,
  className,
  previewMode,
  children,
}: {
  to: string;
  className?: string;
  previewMode?: boolean;
  children: React.ReactNode;
}) {
  if (previewMode) {
    return (
      <span className={className} role="presentation">
        {children}
      </span>
    );
  }
  return (
    <Link to={to} className={className}>
      {children}
    </Link>
  );
}

export function HomepageSections({
  config,
  settings,
  packages,
  portfolio,
  portfolioLoading = false,
  portfolioError = null,
  coupleNotes,
  coupleNotesLoading = false,
  coupleNotesError = null,
  previewMode = false,
}: HomepageSectionsProps) {
  const heroPosition = config.heroImagePosition || { x: 50, y: 50 };
  const visibleGallery =
    config.gallerySectionEnabled !== false
      ? (config.galleryItems || [])
          .filter((item) => item.visible && item.url && item.url.trim().length > 0)
          .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
      : [];

  // Resolve portfolio stories: honor explicit admin selection & order if set, else fallback cleanly
  const publishedPortfolio = portfolio.filter((p) => p.published);
  const selectedIds = config.featuredPortfolioIds || [];
  let displayPortfolio: PortfolioItem[] = [];
  if (selectedIds.length > 0) {
    const byId = new Map(publishedPortfolio.map((item) => [item.id, item]));
    displayPortfolio = selectedIds
      .map((id) => byId.get(id))
      .filter((item): item is PortfolioItem => Boolean(item));
  }
  if (displayPortfolio.length === 0) {
    const featured = publishedPortfolio.filter((p) => p.featured).slice(0, 3);
    displayPortfolio = featured.length > 0 ? featured : publishedPortfolio.slice(0, 3);
  }

  const isDefaultAboutHeadline =
    config.aboutHeadline.trim() === DEFAULT_HOMEPAGE_CONFIG.aboutHeadline.trim();

  return (
    <div>
      {/* 1. Hero Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-8 pt-8 pb-14 lg:pt-12 lg:pb-20">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-stretch">
          <div className="lg:col-span-6 flex flex-col justify-between py-2 lg:py-6">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.22em] text-[#FF5A55] font-semibold mb-5">
                {settings.tagline || 'REAL MOMENTS. NO RETAKES.'}
              </p>
              <h1 className="font-display text-4xl sm:text-5xl lg:text-[3.6rem] font-extrabold tracking-tight leading-[1.03] text-[#171717] text-balance">
                {config.heroTitle || DEFAULT_HOMEPAGE_CONFIG.heroTitle}
              </h1>
              <p className="mt-6 text-base sm:text-lg text-[#171717]/75 leading-relaxed max-w-xl">
                {config.heroSubtitle || DEFAULT_HOMEPAGE_CONFIG.heroSubtitle}
              </p>
            </div>

            <div className="mt-10 pt-8 border-t border-[#171717]/12">
              <div className="flex flex-wrap items-center gap-4">
                <SafeLink
                  to="/booking"
                  previewMode={previewMode}
                  className="inline-flex items-center gap-2 px-7 py-3.5 bg-[#171717] text-white text-sm font-semibold hover:bg-[#D8FF3E] hover:text-[#171717] transition-colors whitespace-nowrap shrink-0"
                >
                  {config.heroPrimaryCtaLabel || 'Check Availability & Book'}
                  <ArrowUpRight className="w-4 h-4" />
                </SafeLink>
                <SafeLink
                  to="/portfolio"
                  previewMode={previewMode}
                  className="inline-flex items-center gap-2 px-5 py-3.5 border border-[#171717]/25 text-[#171717] text-sm font-semibold hover:border-[#171717] hover:bg-white transition-colors whitespace-nowrap shrink-0"
                >
                  {config.heroSecondaryCtaLabel || 'Explore Portfolio'}
                </SafeLink>
              </div>
              <p className="mt-5 text-xs text-[#171717]/60">
                Wedding Content Creator · {settings.serviceArea}
              </p>
            </div>
          </div>

          <div className="lg:col-span-6 min-h-[380px] lg:min-h-[540px] relative">
            <MediaFrame
              src={config.heroImageUrl}
              alt={config.heroImageAlt || 'UNSCRIPTED wedding storytelling'}
              className="w-full h-full min-h-[380px] lg:min-h-[540px]"
              imgClassName="w-full h-full object-cover"
              imgStyle={{
                objectPosition: `${heroPosition.x}% ${heroPosition.y}%`,
              }}
              fallbackTitle="UNSCRIPTED Wedding Storytelling"
            />
            {(config.heroCaption || config.heroImageUrl) && (
              <div className="absolute inset-x-0 bottom-0 p-6 bg-gradient-to-t from-black/80 via-black/35 to-transparent text-white">
                {config.heroCaption && (
                  <p className="font-serif-accent italic text-lg sm:text-xl">
                    {config.heroCaption}
                  </p>
                )}
                <p className="mt-1 text-xs text-white/75 font-mono">
                  Semarang · Salatiga · Boyolali
                </p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Subtle Editorial Marquee Divider */}
      <div className="border-y border-[#171717] bg-[#D8FF3E] text-[#171717] overflow-hidden py-2.5 select-none">
        <div className="flex whitespace-nowrap animate-marquee font-mono text-xs font-semibold uppercase tracking-[0.2em]">
          <span className="mx-6">REAL MOMENTS. NO RETAKES.</span>
          <span aria-hidden="true">·</span>
          <span className="mx-6">WEDDING CONTENT CREATOR</span>
          <span aria-hidden="true">·</span>
          <span className="mx-6">SEMARANG · SALATIGA · BOYOLALI</span>
          <span aria-hidden="true">·</span>
          <span className="mx-6">CANDID STORYTELLING</span>
          <span aria-hidden="true">·</span>
          <span className="mx-6">REAL MOMENTS. NO RETAKES.</span>
          <span aria-hidden="true">·</span>
          <span className="mx-6">WEDDING CONTENT CREATOR</span>
          <span aria-hidden="true">·</span>
          <span className="mx-6">SEMARANG · SALATIGA · BOYOLALI</span>
          <span aria-hidden="true">·</span>
          <span className="mx-6">CANDID STORYTELLING</span>
        </div>
      </div>

      {/* 2. Brand Statement / About Section */}
      <section className="bg-[#171717] text-[#F5F1E9] py-20 lg:py-28">
        {config.aboutImageUrl ? (
          <div className="max-w-7xl mx-auto px-4 sm:px-8 grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center">
            <div className="lg:col-span-7">
              <p className="font-mono text-xs uppercase tracking-[0.22em] text-[#D8FF3E] mb-6">
                {config.aboutEyebrow || 'The UNSCRIPTED Philosophy'}
              </p>
              <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight leading-[1.15] text-balance">
                {isDefaultAboutHeadline ? (
                  <>
                    Your wedding is not a film set.{' '}
                    <span className="font-serif-accent italic font-normal text-[#D8FF3E]">
                      We stay out of your way
                    </span>{' '}
                    so you stay present in the room.
                  </>
                ) : (
                  config.aboutHeadline
                )}
              </h2>
              <p className="mt-8 text-base sm:text-lg text-[#F5F1E9]/75 max-w-2xl leading-relaxed">
                {config.aboutText}
              </p>
              <div className="mt-8">
                <SafeLink
                  to="/about"
                  previewMode={previewMode}
                  className="inline-flex items-center gap-2 text-sm font-semibold text-white border-b border-[#D8FF3E] pb-1 hover:text-[#D8FF3E] transition-colors"
                >
                  {config.aboutCtaLabel || 'Read our story & approach'}
                  <ArrowRight className="w-4 h-4" />
                </SafeLink>
              </div>
            </div>
            <div className="lg:col-span-5">
              <MediaFrame
                src={config.aboutImageUrl}
                alt={config.aboutImageAlt || 'UNSCRIPTED wedding content creator'}
                className="aspect-[4/5] border border-white/15"
                imgClassName="w-full h-full object-cover"
                fallbackTitle="UNSCRIPTED Behind the Scenes"
              />
            </div>
          </div>
        ) : (
          <div className="max-w-5xl mx-auto px-4 sm:px-8">
            <p className="font-mono text-xs uppercase tracking-[0.22em] text-[#D8FF3E] mb-6">
              {config.aboutEyebrow || 'The UNSCRIPTED Philosophy'}
            </p>
            <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight leading-[1.15] text-balance">
              {isDefaultAboutHeadline ? (
                <>
                  Your wedding is not a film set.{' '}
                  <span className="font-serif-accent italic font-normal text-[#D8FF3E]">
                    We stay out of your way
                  </span>{' '}
                  so you stay present in the room.
                </>
              ) : (
                config.aboutHeadline
              )}
            </h2>
            <p className="mt-8 text-base sm:text-lg text-[#F5F1E9]/75 max-w-2xl leading-relaxed">
              {config.aboutText}
            </p>
            <div className="mt-8">
              <SafeLink
                to="/about"
                previewMode={previewMode}
                className="inline-flex items-center gap-2 text-sm font-semibold text-white border-b border-[#D8FF3E] pb-1 hover:text-[#D8FF3E] transition-colors"
              >
                {config.aboutCtaLabel || 'Read our story & approach'}
                <ArrowRight className="w-4 h-4" />
              </SafeLink>
            </div>
          </div>
        )}
      </section>

      {/* Optional Curated Homepage Gallery (rendered only when enabled & has visible images) */}
      {visibleGallery.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-8 pt-20 pb-4">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-8 border-b border-[#171717]/15">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-[#FF5A55] mb-2">
                Curated Frames
              </p>
              <h2 className="font-display text-3xl sm:text-4xl font-extrabold tracking-tight text-[#171717]">
                Unscripted Moments
              </h2>
            </div>
            <p className="text-xs font-mono text-[#171717]/60 tabular-nums">
              {visibleGallery.length} {visibleGallery.length === 1 ? 'Frame' : 'Frames'}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 pt-10">
            {visibleGallery.map((frame) => {
              const fp = frame.focalPoint || { x: 50, y: 50 };
              return (
                <figure key={frame.id} className="group">
                  <div className="aspect-[4/5] overflow-hidden border border-[#171717]/12 bg-white">
                    <MediaFrame
                      src={frame.url}
                      alt={frame.caption || 'UNSCRIPTED wedding moment'}
                      className="w-full h-full"
                      imgClassName="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                      imgStyle={{ objectPosition: `${fp.x}% ${fp.y}%` }}
                      fallbackTitle={frame.caption || 'UNSCRIPTED Frame'}
                    />
                  </div>
                  {frame.caption && (
                    <figcaption className="mt-2.5 text-xs text-[#171717]/70 font-medium">
                      {frame.caption}
                    </figcaption>
                  )}
                </figure>
              );
            })}
          </div>
        </section>
      )}

      {/* 3. Featured Portfolio */}
      <section className="max-w-7xl mx-auto px-4 sm:px-8 py-20 lg:py-24">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-8 border-b border-[#171717]/15">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-[#FF5A55] mb-2">
              Selected Stories
            </p>
            <h2 className="font-display text-3xl sm:text-4xl font-extrabold tracking-tight text-[#171717]">
              Featured Portfolio
            </h2>
          </div>
          <SafeLink
            to="/portfolio"
            previewMode={previewMode}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#171717] hover:text-[#FF5A55] transition-colors whitespace-nowrap shrink-0"
          >
            View All Stories
            <ArrowRight className="w-4 h-4" />
          </SafeLink>
        </div>

        {portfolioError && (
          <div className="mt-8 p-5 bg-[#FF5A55]/10 border border-[#FF5A55] text-sm">
            {portfolioError}
          </div>
        )}

        {portfolioLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pt-10">
            {[0, 1, 2].map((i) => (
              <div key={i} className="animate-pulse">
                <div className="aspect-[4/3] bg-[#171717]/10 mb-4" />
                <div className="h-5 bg-[#171717]/10 w-2/3 mb-2" />
                <div className="h-4 bg-[#171717]/10 w-1/2" />
              </div>
            ))}
          </div>
        ) : displayPortfolio.length === 0 ? (
          <div className="mt-10 p-10 bg-white border border-[#171717]/12 text-center">
            <p className="font-display text-xl font-bold text-[#171717]">
              Portfolio stories are being curated.
            </p>
            <p className="mt-2 text-sm text-[#171717]/65 max-w-md mx-auto">
              New real wedding stories will appear here as soon as they are published.
            </p>
            <SafeLink
              to="/booking"
              previewMode={previewMode}
              className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 bg-[#171717] text-white text-xs font-semibold hover:bg-[#D8FF3E] hover:text-[#171717] transition-colors"
            >
              Inquire for Your Date
              <ArrowUpRight className="w-3.5 h-3.5" />
            </SafeLink>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 pt-10">
            {displayPortfolio.map((item, idx) => (
              <SafeLink
                key={item.id}
                to={`/portfolio/${item.slug}`}
                previewMode={previewMode}
                className={`group block ${idx === 0 ? 'md:col-span-6' : 'md:col-span-3'}`}
              >
                <div
                  className={`overflow-hidden border border-[#171717]/12 bg-white ${
                    idx === 0 ? 'aspect-[4/3]' : 'aspect-[3/4]'
                  }`}
                >
                  <MediaFrame
                    src={item.coverImage}
                    alt={`${item.coupleName} wedding in ${item.location}`}
                    className="w-full h-full"
                    imgClassName="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                    fallbackTitle={item.coupleName}
                  />
                </div>
                <div className="mt-4">
                  <div className="flex items-center gap-2 text-xs text-[#171717]/60">
                    <span>{item.location}</span>
                    <span aria-hidden="true">·</span>
                    <span>{item.eventType}</span>
                    <span aria-hidden="true">·</span>
                    <span className="tabular-nums">{formatDisplayDate(item.eventDate)}</span>
                  </div>
                  <h3 className="mt-1.5 font-display text-xl font-bold text-[#171717] group-hover:text-[#FF5A55] transition-colors">
                    {item.coupleName}
                  </h3>
                  <p className="mt-1 text-sm text-[#171717]/70 line-clamp-2">{item.summary}</p>
                </div>
              </SafeLink>
            ))}
          </div>
        )}
      </section>

      {/* 4. Services & Launch Package Preview */}
      <section className="bg-white border-y border-[#171717]/12 py-20 lg:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-8">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-10 border-b border-[#171717]/12">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-[#171717]/60 mb-2">
                Launch Packages
              </p>
              <h2 className="font-display text-3xl sm:text-4xl font-extrabold tracking-tight text-[#171717]">
                Transparent starting rates.
              </h2>
            </div>
            <SafeLink
              to="/services"
              previewMode={previewMode}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#171717] hover:text-[#FF5A55] transition-colors whitespace-nowrap shrink-0"
            >
              Compare Full Details
              <ArrowRight className="w-4 h-4" />
            </SafeLink>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-10">
            {packages.map((pkg) => (
              <div
                key={pkg.id}
                className={`flex flex-col justify-between p-7 border transition-colors ${
                  pkg.isFeatured
                    ? 'bg-[#171717] text-white border-[#171717]'
                    : 'bg-[#F5F1E9]/55 text-[#171717] border-[#171717]/15'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="font-display text-2xl font-extrabold tracking-tight">
                      {pkg.name}
                    </h3>
                    {pkg.isFeatured && (
                      <span className="font-mono text-[11px] uppercase tracking-widest text-[#D8FF3E]">
                        Featured
                      </span>
                    )}
                  </div>
                  <p className="mt-4 font-mono text-2xl font-semibold tabular-nums">
                    {formatIDR(pkg.price)}
                  </p>
                  {pkg.tagline && (
                    <p
                      className={`mt-3 text-sm leading-relaxed ${
                        pkg.isFeatured ? 'text-white/80' : 'text-[#171717]/75'
                      }`}
                    >
                      {pkg.tagline}
                    </p>
                  )}
                  <p
                    className={`mt-4 text-xs leading-relaxed ${
                      pkg.isFeatured ? 'text-white/65' : 'text-[#171717]/65'
                    }`}
                  >
                    {pkg.description}
                  </p>

                  {pkg.deliverables && pkg.deliverables.length > 0 && (
                    <ul className="mt-5 pt-5 border-t border-current/15 space-y-2 text-sm">
                      {pkg.deliverables.slice(0, 5).map((item, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <Check className="w-4 h-4 shrink-0 mt-0.5 text-[#FF5A55]" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="mt-8 pt-6 border-t border-current/15">
                  <SafeLink
                    to={`/booking?package=${encodeURIComponent(pkg.slug)}`}
                    previewMode={previewMode}
                    className={`w-full inline-flex items-center justify-center gap-2 px-5 py-3 text-sm font-semibold transition-colors ${
                      pkg.isFeatured
                        ? 'bg-[#D8FF3E] text-[#171717] hover:bg-white'
                        : 'bg-[#171717] text-white hover:bg-[#FF5A55]'
                    }`}
                  >
                    Select {pkg.name}
                    <ArrowUpRight className="w-4 h-4" />
                  </SafeLink>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 5. How It Works */}
      <section className="max-w-7xl mx-auto px-4 sm:px-8 py-20 lg:py-24">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-10 border-b border-[#171717]/15">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-[#FF5A55] mb-2">
              Process
            </p>
            <h2 className="font-display text-3xl sm:text-4xl font-extrabold tracking-tight text-[#171717]">
              From inquiry to delivery.
            </h2>
          </div>
          <SafeLink
            to="/how-it-works"
            previewMode={previewMode}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#171717] hover:text-[#FF5A55] transition-colors whitespace-nowrap shrink-0"
          >
            Full Process Guide
            <ArrowRight className="w-4 h-4" />
          </SafeLink>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6 pt-10">
          {WORKFLOW_STEPS.map((step) => (
            <div key={step.num} className="border-t-2 border-[#171717] pt-5">
              <p className="font-mono text-xs text-[#FF5A55] font-semibold">{step.num}</p>
              <h3 className="mt-2 font-display text-lg font-bold text-[#171717]">{step.title}</h3>
              <p className="mt-2 text-sm text-[#171717]/70 leading-relaxed">{step.summary}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 6. Couple Notes */}
      <section className="bg-white border-t border-[#171717]/12 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-8">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-[#171717]/60 mb-8">
            Couple Notes
          </p>

          {coupleNotesError && (
            <div className="mb-6 p-4 bg-[#FF5A55]/10 border border-[#FF5A55] text-sm">
              {coupleNotesError}
            </div>
          )}

          {coupleNotesLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
              {[0, 1].map((i) => (
                <div key={i} className="p-8 bg-[#F5F1E9] border border-[#171717]/12 animate-pulse">
                  <div className="h-5 bg-[#171717]/10 w-full mb-3" />
                  <div className="h-5 bg-[#171717]/10 w-5/6 mb-6" />
                  <div className="h-4 bg-[#171717]/10 w-1/3" />
                </div>
              ))}
            </div>
          ) : coupleNotes.length === 0 ? (
            <div className="p-10 bg-[#F5F1E9] border border-[#171717]/12 text-center">
              <p className="font-display text-lg font-bold text-[#171717]">
                No published couple notes yet.
              </p>
              <p className="mt-1.5 text-sm text-[#171717]/65">
                Verified couple notes published in Admin will appear here automatically.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
              {coupleNotes.map((item) => (
                <blockquote
                  key={item.id}
                  className="p-8 bg-[#F5F1E9] border border-[#171717]/12 flex flex-col justify-between"
                >
                  <div>
                    <p className="font-serif-accent italic text-xl sm:text-2xl text-[#171717] leading-relaxed">
                      “{item.note}”
                    </p>
                    {item.description && (
                      <p className="mt-4 text-xs text-[#171717]/65 leading-relaxed">
                        {item.description}
                      </p>
                    )}
                  </div>
                  <footer className="mt-6 pt-4 border-t border-[#171717]/12 flex flex-wrap items-center justify-between gap-2 text-xs text-[#171717]/70">
                    <span className="font-semibold text-[#171717]">{item.coupleName}</span>
                    <span>
                      {item.weddingDetails}
                      {item.tag ? ` · ${item.tag}` : ''}
                    </span>
                  </footer>
                </blockquote>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* 7. Booking CTA */}
      <section className="bg-[#FF5A55] text-[#171717] py-16 lg:py-20 border-t border-[#171717]">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 flex flex-col lg:flex-row lg:items-center justify-between gap-8">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.22em] text-[#171717]/80 font-semibold mb-3">
              {config.ctaEyebrow || 'Ready When You Are'}
            </p>
            <h2 className="font-display text-3xl sm:text-5xl font-extrabold tracking-tight text-balance max-w-2xl">
              {config.ctaHeadline || 'Lock in your wedding date before it fills up.'}
            </h2>
            <p className="mt-3 text-sm sm:text-base text-[#171717]/85 max-w-xl">
              {config.ctaSubtext || settings.serviceArea}
            </p>
          </div>
          <SafeLink
            to="/booking"
            previewMode={previewMode}
            className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-[#171717] text-white text-sm font-bold hover:bg-[#D8FF3E] hover:text-[#171717] transition-colors whitespace-nowrap shrink-0"
          >
            {config.ctaButtonLabel || 'Start Booking Inquiry'}
            <ArrowUpRight className="w-4 h-4" />
          </SafeLink>
        </div>
      </section>
    </div>
  );
}
