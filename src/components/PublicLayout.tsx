import React, { useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { Menu, X, ArrowUpRight } from 'lucide-react';
import { useFirebase } from '../context/FirebaseContext';
import { buildWhatsappGeneralUrl } from '../lib/validation';

const NAV_ITEMS = [
  { label: 'Portfolio', to: '/portfolio' },
  { label: 'Services', to: '/services' },
  { label: 'How It Works', to: '/how-it-works' },
  { label: 'About', to: '/about' },
  { label: 'Contact', to: '/contact' },
];

export function PublicLayout({ children }: { children?: React.ReactNode }) {
  const { settings } = useFirebase();
  const [mobileOpen, setMobileOpen] = useState(false);

  const waHref = buildWhatsappGeneralUrl(
    settings.whatsappNumber,
    settings.whatsappTemplate
  );

  return (
    <div className="min-h-screen flex flex-col bg-[#F5F1E9] text-[#171717]">
      <header className="sticky top-0 z-40 bg-[#F5F1E9]/95 backdrop-blur-sm border-b border-[#171717]/12">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 h-16 flex items-center justify-between gap-8">
          <Link
            to="/"
            onClick={() => setMobileOpen(false)}
            className="font-display text-xl font-extrabold tracking-tight text-[#171717] whitespace-nowrap shrink-0"
          >
            {settings.brandName || 'UNSCRIPTED'}
          </Link>

          <nav
            aria-label="Primary navigation"
            className="hidden md:flex items-center gap-7 text-sm font-medium text-[#171717]/75"
          >
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `whitespace-nowrap shrink-0 py-1 border-b-2 transition-colors ${
                    isActive
                      ? 'text-[#171717] border-[#171717] font-semibold'
                      : 'border-transparent hover:text-[#171717] hover:border-[#171717]/30'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-3 shrink-0">
            <Link
              to="/booking"
              className="hidden sm:inline-flex items-center gap-1.5 px-5 py-2.5 bg-[#171717] text-[#FFFFFF] text-sm font-semibold hover:bg-[#D8FF3E] hover:text-[#171717] transition-colors whitespace-nowrap shrink-0"
            >
              Book Now
              <ArrowUpRight className="w-4 h-4" />
            </Link>

            <button
              type="button"
              onClick={() => setMobileOpen((prev) => !prev)}
              className="md:hidden p-2.5 text-[#171717] border border-[#171717]/15 hover:bg-white transition-colors cursor-pointer"
              aria-label={mobileOpen ? 'Close navigation menu' : 'Open navigation menu'}
              aria-expanded={mobileOpen}
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {mobileOpen && (
          <div className="md:hidden border-t border-[#171717]/12 bg-[#F5F1E9] px-4 py-4">
            <nav className="flex flex-col gap-1">
              {NAV_ITEMS.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={() => setMobileOpen(false)}
                  className={({ isActive }) =>
                    `px-3 py-3 text-base font-medium border-b border-[#171717]/8 ${
                      isActive ? 'text-[#171717] font-semibold bg-white/60' : 'text-[#171717]/80'
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              ))}
              <Link
                to="/booking"
                onClick={() => setMobileOpen(false)}
                className="mt-3 px-4 py-3 bg-[#171717] text-white text-center text-sm font-semibold"
              >
                Book Your Date
              </Link>
            </nav>
          </div>
        )}
      </header>

      <main className="flex-1">{children ?? <Outlet />}</main>

      <footer className="bg-[#171717] text-[#F5F1E9] border-t border-[#171717]">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 py-14 sm:py-16">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-10 pb-12 border-b border-white/12">
            <div className="md:col-span-5">
              <p className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
                {settings.brandName || 'UNSCRIPTED'}
              </p>
              <p className="mt-2 font-mono text-xs uppercase tracking-[0.2em] text-[#D8FF3E]">
                {settings.tagline || 'REAL MOMENTS. NO RETAKES.'}
              </p>
              <p className="mt-4 text-sm text-white/70 max-w-md leading-relaxed">
                {settings.serviceArea}
              </p>
            </div>

            <div className="md:col-span-3">
              <p className="text-xs font-mono uppercase tracking-widest text-white/50 mb-4">
                Explore
              </p>
              <ul className="space-y-2.5 text-sm">
                <li>
                  <Link to="/portfolio" className="text-white/80 hover:text-[#D8FF3E] transition-colors">
                    Portfolio Stories
                  </Link>
                </li>
                <li>
                  <Link to="/services" className="text-white/80 hover:text-[#D8FF3E] transition-colors">
                    Service Packages
                  </Link>
                </li>
                <li>
                  <Link to="/how-it-works" className="text-white/80 hover:text-[#D8FF3E] transition-colors">
                    How It Works
                  </Link>
                </li>
                <li>
                  <Link to="/about" className="text-white/80 hover:text-[#D8FF3E] transition-colors">
                    About UNSCRIPTED
                  </Link>
                </li>
                <li>
                  <Link to="/booking" className="text-white/80 hover:text-[#D8FF3E] transition-colors">
                    Book a Date
                  </Link>
                </li>
              </ul>
            </div>

            <div className="md:col-span-4">
              <p className="text-xs font-mono uppercase tracking-widest text-white/50 mb-4">
                Connect
              </p>
              <ul className="space-y-2.5 text-sm">
                <li>
                  <a
                    href={waHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-white/80 hover:text-[#D8FF3E] transition-colors"
                  >
                    WhatsApp Studio
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </a>
                </li>
                <li>
                  <a
                    href={settings.instagramUrl || 'https://instagram.com/unscripted.id'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-white/80 hover:text-[#D8FF3E] transition-colors"
                  >
                    Instagram ({settings.instagramHandle || '@unscripted.id'})
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </a>
                </li>
                {settings.tiktokUrl && (
                  <li>
                    <a
                      href={settings.tiktokUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-white/80 hover:text-[#D8FF3E] transition-colors"
                    >
                      TikTok
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </a>
                  </li>
                )}
                {settings.youtubeUrl && (
                  <li>
                    <a
                      href={settings.youtubeUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-white/80 hover:text-[#D8FF3E] transition-colors"
                    >
                      YouTube
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </a>
                  </li>
                )}
                {settings.email && (
                  <li className="text-white/75">{settings.email}</li>
                )}
                <li className="pt-2">
                  <Link
                    to="/contact"
                    className="inline-block text-xs font-mono uppercase tracking-wider text-[#FF5A55] hover:underline"
                  >
                    Contact & Service Area
                  </Link>
                </li>
              </ul>
            </div>
          </div>

          <div className="pt-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs text-white/55">
            <p>© {new Date().getFullYear()} UNSCRIPTED. Wedding Content Creator · unscripted.id</p>
            <Link
              to="/admin/login"
              className="hover:text-white transition-colors font-mono"
            >
              Admin Portal
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
