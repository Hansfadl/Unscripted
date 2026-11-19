import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import { useFirebase } from '../../context/FirebaseContext';

const DETAILED_STEPS = [
  {
    step: '01.',
    phase: 'Inquiry',
    headline: 'Tell us when and where you are celebrating.',
    details:
      'Submit your wedding date, venue city, event type, and preferred package via our online booking form. You immediately receive a unique Booking ID and direct WhatsApp summary.',
  },
  {
    step: '02.',
    phase: 'Package Selection',
    headline: 'Match your coverage to your wedding rhythm.',
    details:
      'Start with CEREMONY, STORY, or FULL STORY. Together we align on the key moments that matter most to you—from quiet morning prep to late-night confetti.',
  },
  {
    step: '03.',
    phase: 'Confirmation',
    headline: 'Lock your date with zero ambiguity.',
    details:
      'Once we verify schedule availability for your location and finalize your booking details on WhatsApp, your date is officially reserved on the UNSCRIPTED calendar.',
  },
  {
    step: '04.',
    phase: 'Event Coverage',
    headline: 'Real moments, zero retakes on the day.',
    details:
      'We arrive early, coordinate effortlessly with your photo/video team, and move quietly through the celebration capturing raw laughter, vows, tears, and candid atmosphere.',
  },
  {
    step: '05.',
    phase: 'Content Delivery',
    headline: 'Relive the day while the feeling is still fresh.',
    details:
      'We organize and deliver your curated vertical edits and authentic behind-the-scenes clips in accordance with your confirmed package scope.',
  },
];

export function HowItWorksPage() {
  const { settings } = useFirebase();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-8 py-12 lg:py-20">
      <div className="max-w-3xl pb-12 border-b border-[#171717]/15">
        <p className="font-mono text-xs uppercase tracking-[0.22em] text-[#FF5A55] font-semibold mb-3">
          How It Works
        </p>
        <h1 className="font-display text-4xl sm:text-5xl font-extrabold tracking-tight leading-[1.08] text-balance">
          A clear five-step flow from first message to final clips.
        </h1>
        <p className="mt-4 text-base text-[#171717]/75 leading-relaxed">
          Simple, human communication without complicated back-and-forth. {settings.serviceArea}
        </p>
      </div>

      <div className="divide-y divide-[#171717]/15">
        {DETAILED_STEPS.map((item) => (
          <div
            key={item.step}
            className="py-10 grid grid-cols-1 md:grid-cols-12 gap-6 items-start"
          >
            <div className="md:col-span-3 flex items-baseline gap-3">
              <span className="font-mono text-sm font-semibold text-[#FF5A55]">{item.step}</span>
              <span className="font-display text-xl font-bold text-[#171717]">
                {item.phase}
              </span>
            </div>
            <div className="md:col-span-4">
              <h2 className="font-display text-2xl font-bold tracking-tight text-[#171717]">
                {item.headline}
              </h2>
            </div>
            <div className="md:col-span-5">
              <p className="text-base text-[#171717]/75 leading-relaxed">{item.details}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-10 p-8 sm:p-12 bg-[#171717] text-white flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-[#D8FF3E] mb-2">
            Step 01 Starts Here
          </p>
          <h2 className="font-display text-2xl sm:text-3xl font-bold">
            Ready to check if your wedding date is open?
          </h2>
        </div>
        <Link
          to="/booking"
          className="inline-flex items-center justify-center gap-2 px-7 py-3.5 bg-[#D8FF3E] text-[#171717] text-sm font-bold hover:bg-white transition-colors whitespace-nowrap shrink-0"
        >
          Go to Booking Form
          <ArrowUpRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
}
