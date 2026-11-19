import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import { useFirebase } from '../../context/FirebaseContext';
import { BRAND_IMAGES } from '../../data/defaults';
import { MediaFrame } from '../../components/MediaFrame';

const VALUES = [
  {
    num: '01.',
    title: 'Authentic Presence',
    body: 'We observe quietly instead of orchestrating scenes. Your day stays about your people—not about production schedules.',
  },
  {
    num: '02.',
    title: 'Editorial Eye',
    body: 'Modern framing, kinetic vertical motion, and textured documentary honesty tailored for how Gen-Z couples actually share memories.',
  },
  {
    num: '03.',
    title: 'Zero Retakes',
    body: 'If a tear falls, someone bursts out laughing, or confetti catches the wind, it only happens once. We capture it live.',
  },
  {
    num: '04.',
    title: 'Local Grounding',
    body: 'Rooted in Semarang, Salatiga, Boyolali, and surrounding areas—adapting effortlessly to joglo courtyards, highlands, and city halls.',
  },
];

export function AboutPage() {
  const { settings } = useFirebase();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-8 py-12 lg:py-20">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-stretch pb-16 border-b border-[#171717]/15">
        <div className="lg:col-span-7 flex flex-col justify-between">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.22em] text-[#FF5A55] font-semibold mb-4">
              About UNSCRIPTED
            </p>
            <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.06] text-balance">
              Candid wedding storytelling for couples who hate stiff posing.
            </h1>
            <p className="mt-6 text-lg text-[#171717]/80 leading-relaxed max-w-2xl">
              {settings.aboutStatement}
            </p>
          </div>

          <div className="mt-10 pt-8 border-t border-[#171717]/12">
            <p className="font-serif-accent italic text-2xl text-[#171717]">
              “{settings.tagline || 'REAL MOMENTS. NO RETAKES.'}”
            </p>
            <p className="mt-3 text-sm text-[#171717]/65">
              Service area: {settings.serviceArea}
            </p>
          </div>
        </div>

        <div className="lg:col-span-5">
          <MediaFrame
            src={BRAND_IMAGES.aboutBts}
            alt="UNSCRIPTED wedding content creator filming behind the scenes"
            className="w-full h-full min-h-[420px]"
            fallbackTitle="Behind The Scenes"
          />
        </div>
      </div>

      {/* Philosophy & Approach */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-10 py-16 border-b border-[#171717]/15">
        <div className="md:col-span-4">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-[#171717]/60">
            Our Approach
          </p>
          <h2 className="mt-2 font-display text-3xl font-extrabold tracking-tight">
            Built to feel like a trusted friend with an editorial lens.
          </h2>
        </div>
        <div className="md:col-span-8 space-y-5 text-base text-[#171717]/80 leading-relaxed">
          <p>
            Traditional wedding production often turns your celebration into a checklist of scripted angles. UNSCRIPTED was created as the counterbalance: nimble, unobtrusive, smartphone-and-rig content creation focused on immediacy, atmosphere, and unguarded emotion.
          </p>
          <p>
            We collaborate seamlessly alongside your primary photographer and videographer—focusing on vertical storytelling, candid backstage moments, audio snippets, and spontaneous reactions that traditional setups often miss.
          </p>
        </div>
      </div>

      {/* Brand Values */}
      <div className="py-16">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-[#FF5A55] mb-8">
          What Guides Every Frame
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {VALUES.map((v) => (
            <div key={v.num} className="border-t-2 border-[#171717] pt-5">
              <p className="font-mono text-xs text-[#FF5A55] font-semibold">{v.num}</p>
              <h3 className="mt-2 font-display text-xl font-bold">{v.title}</h3>
              <p className="mt-3 text-sm text-[#171717]/75 leading-relaxed">{v.body}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-[#171717] text-white p-8 sm:p-12 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div>
          <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight">
            Planning your celebration in Central Java?
          </h2>
          <p className="mt-2 text-sm text-white/75">{settings.serviceArea}</p>
        </div>
        <Link
          to="/booking"
          className="inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-[#D8FF3E] text-[#171717] text-sm font-bold hover:bg-white transition-colors whitespace-nowrap shrink-0"
        >
          Inquire About Your Date
          <ArrowUpRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
}
