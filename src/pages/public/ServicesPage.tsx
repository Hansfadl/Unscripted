import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, Check } from 'lucide-react';
import { useFirebase } from '../../context/FirebaseContext';
import { formatIDR } from '../../lib/validation';
import { fetchActivePackages } from '../../services/firestoreService';
import type { ServicePackage } from '../../types/unscripted';

export function ServicesPage() {
  const { settings } = useFirebase();
  const [packages, setPackages] = useState<ServicePackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetchActivePackages()
      .then((data) => {
        if (active) setPackages(data);
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : 'Unable to load packages.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-8 py-12 lg:py-20">
      <div className="max-w-3xl pb-12 border-b border-[#171717]/15">
        <p className="font-mono text-xs uppercase tracking-[0.22em] text-[#FF5A55] font-semibold mb-3">
          Services & Launch Pricing
        </p>
        <h1 className="font-display text-4xl sm:text-5xl font-extrabold tracking-tight leading-[1.08] text-balance">
          Choose the coverage tier that fits your celebration.
        </h1>
        <p className="mt-4 text-base text-[#171717]/75 leading-relaxed">
          All packages are managed directly by UNSCRIPTED. Final coverage schedules and custom deliverables are confirmed together during inquiry.
        </p>
      </div>

      {error && (
        <div className="mt-8 p-5 bg-[#FF5A55]/10 border border-[#FF5A55] text-sm text-[#171717]">
          {error}
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 py-12">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-80 bg-white border border-[#171717]/10 animate-pulse p-7" />
          ))}
        </div>
      ) : packages.length === 0 ? (
        <div className="py-16 text-center bg-white border border-[#171717]/12 mt-10 p-8">
          <p className="font-display text-xl font-bold">No active packages listed yet.</p>
          <p className="mt-2 text-sm text-[#171717]/70">
            Reach out directly via our booking form or WhatsApp for a custom quote.
          </p>
        </div>
      ) : (
        <>
          {/* Package Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 py-12">
            {packages.map((pkg) => (
              <div
                key={pkg.id}
                className={`flex flex-col justify-between p-8 border ${
                  pkg.isFeatured
                    ? 'bg-[#171717] text-white border-[#171717]'
                    : 'bg-white text-[#171717] border-[#171717]/15'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="font-display text-2xl font-extrabold tracking-tight">
                      {pkg.name}
                    </h2>
                    {pkg.isFeatured && (
                      <span className="font-mono text-[11px] uppercase tracking-widest text-[#D8FF3E]">
                        Featured
                      </span>
                    )}
                  </div>
                  <p className="mt-4 font-mono text-3xl font-semibold tabular-nums">
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

                  <div className="mt-6 pt-6 border-t border-current/15 space-y-4">
                    <div>
                      <p className="text-xs font-mono uppercase tracking-wider opacity-60 mb-1.5">
                        Overview
                      </p>
                      <p className="text-sm leading-relaxed opacity-85">{pkg.description}</p>
                    </div>

                    {pkg.coverageDetails && (
                      <div>
                        <p className="text-xs font-mono uppercase tracking-wider opacity-60 mb-1.5">
                          Coverage Details
                        </p>
                        <p className="text-sm leading-relaxed opacity-85">
                          {pkg.coverageDetails}
                        </p>
                      </div>
                    )}

                    <div>
                      <p className="text-xs font-mono uppercase tracking-wider opacity-60 mb-2">
                        Deliverables
                      </p>
                      {pkg.deliverables && pkg.deliverables.length > 0 ? (
                        <ul className="space-y-2 text-sm">
                          {pkg.deliverables.map((item, i) => (
                            <li key={i} className="flex items-start gap-2">
                              <Check className="w-4 h-4 shrink-0 mt-0.5 text-[#FF5A55]" />
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-xs opacity-65 italic">
                          Custom deliverables confirmed upon inquiry and editable by admin.
                        </p>
                      )}
                    </div>

                    {pkg.additionalNotes && (
                      <p className="text-xs opacity-65 pt-2">{pkg.additionalNotes}</p>
                    )}
                  </div>
                </div>

                <div className="mt-8 pt-6 border-t border-current/15">
                  <Link
                    to={`/booking?package=${encodeURIComponent(pkg.slug)}`}
                    className={`w-full inline-flex items-center justify-center gap-2 px-5 py-3.5 text-sm font-semibold transition-colors ${
                      pkg.isFeatured
                        ? 'bg-[#D8FF3E] text-[#171717] hover:bg-white'
                        : 'bg-[#171717] text-white hover:bg-[#FF5A55]'
                    }`}
                  >
                    Book {pkg.name}
                    <ArrowUpRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>
            ))}
          </div>

          {/* Comparison Table */}
          <div className="mt-6 bg-white border border-[#171717]/15 overflow-x-auto">
            <div className="px-6 py-5 border-b border-[#171717]/12">
              <h2 className="font-display text-xl font-bold">Package Comparison</h2>
            </div>
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-[#171717]/12 bg-[#F5F1E9]/60">
                  <th className="py-3.5 px-6 font-mono text-xs uppercase tracking-wider text-[#171717]/65">
                    Specification
                  </th>
                  {packages.map((pkg) => (
                    <th key={pkg.id} className="py-3.5 px-6 font-display font-bold text-[#171717]">
                      {pkg.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#171717]/10">
                <tr>
                  <td className="py-4 px-6 font-medium text-[#171717]/70">Launch Price</td>
                  {packages.map((pkg) => (
                    <td key={pkg.id} className="py-4 px-6 font-mono font-semibold tabular-nums">
                      {formatIDR(pkg.price)}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="py-4 px-6 font-medium text-[#171717]/70">Coverage Scope</td>
                  {packages.map((pkg) => (
                    <td key={pkg.id} className="py-4 px-6 text-[#171717]/80">
                      {pkg.coverageDetails || 'Confirmed via inquiry'}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="py-4 px-6 font-medium text-[#171717]/70">Deliverables</td>
                  {packages.map((pkg) => (
                    <td key={pkg.id} className="py-4 px-6 text-[#171717]/80">
                      {pkg.deliverables && pkg.deliverables.length > 0
                        ? pkg.deliverables.join(' · ')
                        : 'Managed per inquiry'}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Additional Services & Area */}
      <div className="mt-14 grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="p-8 bg-white border border-[#171717]/15">
          <p className="font-mono text-xs uppercase tracking-widest text-[#FF5A55] mb-2">
            Additional Services
          </p>
          <h3 className="font-display text-2xl font-bold">Custom Event Requests</h3>
          <p className="mt-3 text-sm text-[#171717]/75 leading-relaxed">
            Planning multi-day celebrations, intimate pre-wedding sessions, or travel outside our primary zone? Include your schedule details in the booking form and we will tailor a custom proposal.
          </p>
        </div>
        <div className="p-8 bg-[#171717] text-white">
          <p className="font-mono text-xs uppercase tracking-widest text-[#D8FF3E] mb-2">
            Service Area
          </p>
          <h3 className="font-display text-2xl font-bold">Central Java & Surrounding</h3>
          <p className="mt-3 text-sm text-white/75 leading-relaxed">{settings.serviceArea}</p>
          <Link
            to="/booking"
            className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-[#D8FF3E] hover:underline"
          >
            Submit an inquiry
            <ArrowUpRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
