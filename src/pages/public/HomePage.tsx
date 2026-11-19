import { useEffect, useState } from 'react';
import { useFirebase } from '../../context/FirebaseContext';
import {
  fetchActivePackages,
  normalizeHomepageConfig,
  subscribePublishedCoupleNotes,
  subscribePublishedHomepageConfig,
  subscribePublishedPortfolio,
} from '../../services/firestoreService';
import type {
  CoupleNote,
  HomepageConfig,
  PortfolioItem,
  ServicePackage,
} from '../../types/unscripted';
import { HomepageSections } from '../../components/HomepageSections';

export function HomePage() {
  const { settings } = useFirebase();
  const [packages, setPackages] = useState<ServicePackage[]>([]);
  const [portfolio, setPortfolio] = useState<PortfolioItem[]>([]);
  const [portfolioLoading, setPortfolioLoading] = useState(true);
  const [portfolioError, setPortfolioError] = useState<string | null>(null);
  const [coupleNotes, setCoupleNotes] = useState<CoupleNote[]>([]);
  const [coupleNotesLoading, setCoupleNotesLoading] = useState(true);
  const [coupleNotesError, setCoupleNotesError] = useState<string | null>(null);
  const [publishedConfig, setPublishedConfig] = useState<HomepageConfig | null>(null);
  const [hasPublishedConfig, setHasPublishedConfig] = useState(false);

  useEffect(() => {
    let active = true;
    fetchActivePackages()
      .then((pkgs) => {
        if (active) setPackages(pkgs);
      })
      .catch((err) => {
        console.error('Homepage packages fetch error:', err);
      });

    const unsubscribeHomepage = subscribePublishedHomepageConfig(
      ({ config, exists }) => {
        if (!active) return;
        setHasPublishedConfig(exists);
        setPublishedConfig(exists ? config : null);
      },
      (err) => {
        console.error('Homepage customization listener error:', err);
      }
    );

    const unsubscribePortfolio = subscribePublishedPortfolio(
      (items) => {
        if (!active) return;
        setPortfolio(items);
        setPortfolioError(null);
        setPortfolioLoading(false);
      },
      (err) => {
        if (!active) return;
        setPortfolioError(err.message || 'Unable to load portfolio stories.');
        setPortfolioLoading(false);
      }
    );

    const unsubscribeCoupleNotes = subscribePublishedCoupleNotes(
      (items) => {
        if (!active) return;
        setCoupleNotes(items);
        setCoupleNotesError(null);
        setCoupleNotesLoading(false);
      },
      (err) => {
        if (!active) return;
        setCoupleNotesError(err.message || 'Unable to load couple notes.');
        setCoupleNotesLoading(false);
      }
    );

    return () => {
      active = false;
      unsubscribeHomepage();
      unsubscribePortfolio();
      unsubscribeCoupleNotes();
    };
  }, []);

  const effectiveConfig =
    hasPublishedConfig && publishedConfig
      ? publishedConfig
      : normalizeHomepageConfig(null, settings);

  return (
    <HomepageSections
      config={effectiveConfig}
      settings={settings}
      packages={packages}
      portfolio={portfolio}
      portfolioLoading={portfolioLoading}
      portfolioError={portfolioError}
      coupleNotes={coupleNotes}
      coupleNotesLoading={coupleNotesLoading}
      coupleNotesError={coupleNotesError}
    />
  );
}
