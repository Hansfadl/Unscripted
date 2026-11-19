import { Link } from 'react-router-dom';
import { ArrowUpRight, Instagram, Mail, MapPin, MessageCircle } from 'lucide-react';
import { useFirebase } from '../../context/FirebaseContext';
import { buildWhatsappGeneralUrl, normalizeWhatsapp } from '../../lib/validation';

export function ContactPage() {
  const { settings } = useFirebase();
  const waNumber = normalizeWhatsapp(settings.whatsappNumber) || '6281234567890';
  const waHref = buildWhatsappGeneralUrl(
    settings.whatsappNumber,
    settings.whatsappTemplate
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-8 py-12 lg:py-20">
      <div className="max-w-3xl pb-12 border-b border-[#171717]/15">
        <p className="font-mono text-xs uppercase tracking-[0.22em] text-[#FF5A55] font-semibold mb-3">
          Contact & Area
        </p>
        <h1 className="font-display text-4xl sm:text-5xl font-extrabold tracking-tight leading-[1.08]">
          Reach out directly.
        </h1>
        <p className="mt-4 text-base text-[#171717]/75 leading-relaxed">
          Have questions about dates, custom schedules, or traveling outside our base area? Message us directly or submit a formal booking inquiry.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 py-12">
        <a
          href={waHref}
          target="_blank"
          rel="noopener noreferrer"
          className="p-8 bg-[#171717] text-white flex flex-col justify-between group hover:bg-[#171717]/92 transition-colors"
        >
          <div>
            <MessageCircle className="w-6 h-6 text-[#D8FF3E] mb-6" />
            <p className="font-mono text-xs uppercase tracking-widest text-white/60">
              Fastest Response
            </p>
            <h2 className="mt-2 font-display text-2xl font-bold">WhatsApp Studio</h2>
            <p className="mt-2 font-mono text-sm text-white/80">+{waNumber}</p>
          </div>
          <span className="mt-8 inline-flex items-center gap-1.5 text-sm font-semibold text-[#D8FF3E]">
            Chat on WhatsApp
            <ArrowUpRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </span>
        </a>

        <a
          href={settings.instagramUrl || 'https://instagram.com/unscripted.id'}
          target="_blank"
          rel="noopener noreferrer"
          className="p-8 bg-white border border-[#171717]/15 flex flex-col justify-between group hover:border-[#171717] transition-colors"
        >
          <div>
            <Instagram className="w-6 h-6 text-[#FF5A55] mb-6" />
            <p className="font-mono text-xs uppercase tracking-widest text-[#171717]/55">
              Reels & Daily Updates
            </p>
            <h2 className="mt-2 font-display text-2xl font-bold">Instagram</h2>
            <p className="mt-2 font-mono text-sm text-[#171717]/80">
              {settings.instagramHandle || '@unscripted.id'}
            </p>
          </div>
          <span className="mt-8 inline-flex items-center gap-1.5 text-sm font-semibold text-[#171717]">
            Follow {settings.instagramHandle || '@unscripted.id'}
            <ArrowUpRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </span>
        </a>

        <div className="p-8 bg-white border border-[#171717]/15 flex flex-col justify-between">
          <div>
            <MapPin className="w-6 h-6 text-[#171717] mb-6" />
            <p className="font-mono text-xs uppercase tracking-widest text-[#171717]/55">
              Coverage Region
            </p>
            <h2 className="mt-2 font-display text-2xl font-bold">Service Area</h2>
            <p className="mt-2 text-sm text-[#171717]/80 leading-relaxed">
              {settings.serviceArea}
            </p>
          </div>
          <div className="mt-8 pt-4 border-t border-[#171717]/10 space-y-2 text-xs font-mono text-[#171717]/70">
            {settings.email && (
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 shrink-0" />
                <span>{settings.email}</span>
              </div>
            )}
            {(settings.tiktokUrl || settings.youtubeUrl) && (
              <div className="flex flex-wrap items-center gap-4 pt-1">
                {settings.tiktokUrl && (
                  <a
                    href={settings.tiktokUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[#171717] hover:text-[#FF5A55]"
                  >
                    TikTok
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </a>
                )}
                {settings.youtubeUrl && (
                  <a
                    href={settings.youtubeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[#171717] hover:text-[#FF5A55]"
                  >
                    YouTube
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="p-8 sm:p-10 bg-white border border-[#171717]/15 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div>
          <h2 className="font-display text-2xl font-bold">Ready to lock your date?</h2>
          <p className="mt-1 text-sm text-[#171717]/70">
            Use the booking form to generate a Booking ID before messaging us.
          </p>
        </div>
        <Link
          to="/booking"
          className="inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-[#171717] text-white text-sm font-semibold hover:bg-[#D8FF3E] hover:text-[#171717] transition-colors whitespace-nowrap shrink-0"
        >
          Open Booking Form
          <ArrowUpRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
}
