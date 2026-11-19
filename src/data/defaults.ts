import type {
  CoupleNote,
  HomepageConfig,
  InvoiceSettings,
  ServicePackage,
  SiteSettings,
} from '../types/unscripted';

export const BRAND_IMAGES = {
  hero: '/src/assets/images/hero_candid_wedding_1795048275086.jpg',
  semarangCeremony: '/src/assets/images/portfolio_joglo_ceremony_1795048276595.jpg',
  salatigaHighland: '/src/assets/images/portfolio_salatiga_golden_1795048276998.jpg',
  boyolaliReception: '/src/assets/images/portfolio_boyolali_reception_1795048277703.jpg',
  aboutBts: '/src/assets/images/about_creator_bts_1795048277417.jpg',
} as const;

export const DEFAULT_SITE_SETTINGS: SiteSettings = {
  brandName: 'UNSCRIPTED',
  tagline: 'REAL MOMENTS. NO RETAKES.',
  whatsappNumber: '6281234567890',
  instagramHandle: '@unscripted.id',
  instagramUrl: 'https://instagram.com/unscripted.id',
  whatsappTemplate: 'Halo UNSCRIPTED! I would like to inquire about wedding content creator availability.',
  tiktokUrl: '',
  youtubeUrl: '',
  email: 'hello@unscripted.id',
  serviceArea: 'Semarang, Salatiga, Boyolali, and surrounding areas, subject to availability.',
  heroHeadline: 'Candid wedding stories told as they actually happen.',
  heroSubheadline:
    'We capture raw laughter, quiet glances, and spontaneous energy from behind the scenes—so you can relive your day the way it genuinely felt.',
  aboutStatement:
    'UNSCRIPTED is a modern wedding content creator studio built for couples who prefer lived-in emotion over stiff choreography. No forced retakes, no staged perfection—just honest visual storytelling.',
  bookingNotice:
    'Serving Semarang, Salatiga, Boyolali, and surrounding areas, subject to availability.',
};

// Initial launch pricing packages (descriptions & deliverables are editable via Admin Dashboard)
export const INITIAL_PACKAGES: Omit<ServicePackage, 'createdAt' | 'updatedAt'>[] = [
  {
    id: 'ceremony',
    name: 'CEREMONY',
    slug: 'ceremony',
    price: 399000,
    tagline: 'Focused launch package for intimate vows and ceremony moments.',
    description:
      'Launch-tier wedding content coverage centered on your ceremony. Detailed scope and deliverables are customizable in the UNSCRIPTED admin dashboard.',
    coverageDetails: 'Editable in Admin Dashboard',
    deliverables: [],
    additionalNotes: 'Initial launch pricing. Final coverage details confirmed via inquiry.',
    isActive: true,
    isFeatured: false,
    sortOrder: 1,
  },
  {
    id: 'story',
    name: 'STORY',
    slug: 'story',
    price: 599000,
    tagline: 'Balanced candid storytelling across your key wedding chapters.',
    description:
      'Launch-tier wedding content package designed for couples wanting broader candid storytelling. Detailed scope and deliverables are customizable in the UNSCRIPTED admin dashboard.',
    coverageDetails: 'Editable in Admin Dashboard',
    deliverables: [],
    additionalNotes: 'Initial launch pricing. Final coverage details confirmed via inquiry.',
    isActive: true,
    isFeatured: true,
    sortOrder: 2,
  },
  {
    id: 'full-story',
    name: 'FULL STORY',
    slug: 'full-story',
    price: 799000,
    tagline: 'Comprehensive launch package capturing your full celebration arc.',
    description:
      'Complete launch-tier wedding content coverage from candid preparations through evening celebrations. Detailed scope and deliverables are customizable in the UNSCRIPTED admin dashboard.',
    coverageDetails: 'Editable in Admin Dashboard',
    deliverables: [],
    additionalNotes: 'Initial launch pricing. Final coverage details confirmed via inquiry.',
    isActive: true,
    isFeatured: false,
    sortOrder: 3,
  },
];

// Initial couple notes seeded once into Firestore /couple_notes (editable and deletable in Admin)
export const INITIAL_COUPLE_NOTES: Omit<CoupleNote, 'createdAt' | 'updatedAt'>[] = [
  {
    id: 'couple-note-nadia-rizky',
    coupleName: 'Nadia & Rizky',
    weddingDetails: 'Garden Ceremony · Semarang',
    note: 'We did not want to spend half our wedding day repeating entrances for cameras. UNSCRIPTED blended right in with our friends and sent us moments we did not even realize happened.',
    description: 'Intimate courtyard ceremony in Semarang captured with handheld candid coverage.',
    tag: 'Client Note',
    published: true,
    sortOrder: 1,
  },
  {
    id: 'couple-note-alya-bagas',
    coupleName: 'Alya & Bagas',
    weddingDetails: 'Evening Reception · Boyolali',
    note: 'Looking at our clips the next morning felt like stepping straight back into the noise, laughter, and happy tears. Zero awkward posing.',
    description: 'Evening outdoor reception in Boyolali with next-day raw clips and highlight reels.',
    tag: 'Client Note',
    published: true,
    sortOrder: 2,
  },
];

export const DEFAULT_HOMEPAGE_CONFIG: Omit<HomepageConfig, 'updatedAt' | 'publishedAt'> = {
  heroTitle: DEFAULT_SITE_SETTINGS.heroHeadline,
  heroSubtitle: DEFAULT_SITE_SETTINGS.heroSubheadline,
  heroImageUrl: BRAND_IMAGES.hero,
  heroImageAlt: 'Candid Indonesian bride and groom laughing together at golden hour',
  heroImagePosition: { x: 50, y: 50 },
  heroCaption: '“The best frames happen between the poses.”',
  heroPrimaryCtaLabel: 'Check Availability & Book',
  heroSecondaryCtaLabel: 'Explore Portfolio',
  gallerySectionEnabled: true,
  galleryItems: [],
  aboutEyebrow: 'The UNSCRIPTED Philosophy',
  aboutHeadline: 'Your wedding is not a film set. We stay out of your way so you stay present in the room.',
  aboutText: DEFAULT_SITE_SETTINGS.aboutStatement,
  aboutImageUrl: '',
  aboutImageAlt: 'UNSCRIPTED wedding content creator filming candidly behind the scenes',
  aboutCtaLabel: 'Read our story & approach',
  featuredPortfolioIds: [],
  ctaEyebrow: 'Ready When You Are',
  ctaHeadline: 'Lock in your wedding date before it fills up.',
  ctaSubtext: '',
  ctaButtonLabel: 'Start Booking Inquiry',
};

export const DEFAULT_INVOICE_SETTINGS: Omit<InvoiceSettings, 'updatedAt'> = {
  bankName: 'Bank Central Asia (BCA)',
  bankAccountNumber: '',
  bankAccountHolder: 'UNSCRIPTED STUDIO',
  paymentInstructions:
    'Please include your Invoice Number in the transfer remarks and reply via WhatsApp with your proof of transfer to lock your wedding date.',
  defaultThankYouMessage:
    'Thank you for trusting UNSCRIPTED to preserve your candid wedding moments. Real moments. No retakes.',
  defaultDueDays: 7,
  defaultDpMode: 'PERCENT_30',
};
