import type { ReactNode } from 'react';
import {
  Building2, Award, Compass, Wrench, ShieldCheck,
  Clock, Users, Ruler, Sparkles, LineChart, Leaf,
  type LucideIcon,
} from 'lucide-react';
import type { MediaKey } from '../lib/media';

/* ---- CONTACT / BRAND ---------------------------------------------------- */
export const CONTACT = {
  phone: '+91 98765 43210',
  phoneHref: 'tel:+919876543210',
  whatsapp: 'https://wa.me/919876543210',
  email: 'hello@alipsonbuilders.com',
  address: 'Ambalappadi, Wandoor, Malappuram, Kerala — PIN: 679328',
  mapEmbed:
    'https://www.google.com/maps?q=Ambalappadi%2C%20Wandoor%2C%20Kerala%20679328&output=embed',
};

export const NAV = [
  { id: 'hero', label: 'Home' },
  { id: 'studio', label: 'Story' },
  { id: 'work', label: 'Projects' },
  { id: 'services', label: 'Services' },
  { id: 'founder', label: 'Founder & Legacy' },
  { id: 'footer', label: 'Contact' },
];

/* ---- STATS -------------------------------------------------------------- */
export type Stat = { value: number; suffix: string; label: string };
export const STATS: Stat[] = [
  { value: 150, suffix: '+', label: 'Projects Delivered' },
  { value: 100, suffix: '%', label: 'On-Time Completion' },
  { value: 15, suffix: '+', label: 'Years Combined Expertise' },
  { value: 100, suffix: '%', label: 'Client Satisfaction' },
];

/* ---- SERVICES ----------------------------------------------------------- */
export type Service = { num: string; icon: LucideIcon; title: string; desc: string };
export const SERVICES: Service[] = [
  { num: '01', icon: Award, title: 'Luxury Villa Construction', desc: 'Bespoke Kerala villas with private pools, courtyards and double-height volumes — engineered for a lifetime of gracious living.' },
  { num: '02', icon: Building2, title: 'Commercial Complexes & Hubs', desc: 'Signature offices, retail and mixed-use landmarks built to green standards and optimised for footfall and output.' },
  { num: '03', icon: Compass, title: 'Architectural Planning & Interior Design', desc: 'End-to-end design — 3D visualisation, structural planning and curated interiors in marble, teak and warm brass.' },
  { num: '04', icon: Wrench, title: 'Renovation & Structural Upgrades', desc: 'Reviving legacy homes and buildings with modern reinforcement, refined spatial plans and premium finishes.' },
];

/* ---- PROJECTS ----------------------------------------------------------- */
export type Project = {
  title: string; category: string; location: string; year: string;
  image: MediaKey; desc: string; area: string; tags: string[];
};
export const PROJECT_FILTERS = ['All', 'Modern Villas', 'Apartments', 'Commercial Buildings'];
export const PROJECTS: Project[] = [
  { title: 'Alipson Grandeur', category: 'Modern Villa', location: 'Ernakulam', year: '2025', image: 'villa', area: '18,400 sq.ft', desc: 'A contemporary villa of board-formed concrete, panoramic glazing and a mirror-still reflecting pool.', tags: ['Modern Villas'] },
  { title: 'Alipson Heights', category: 'Apartments', location: 'Kozhikode', year: '2026', image: 'heights', area: '240,000 sq.ft', desc: 'A skyline residence bringing sky-decks and resort amenities to the Kozhikode waterfront.', tags: ['Apartments'] },
  { title: 'Alipson Business Hub', category: 'Commercial', location: 'Ernakulam', year: '2025', image: 'hub', area: '96,000 sq.ft', desc: 'An iconic glass-facade workplace built to green-building standards around open courtyards.', tags: ['Commercial Buildings'] },
  { title: 'The Bronze Residence', category: 'Modern Villa', location: 'Malappuram', year: '2024', image: 'interior', area: '6,200 sq.ft', desc: 'A warm, tactile interior of travertine, bronze and hand-finished plaster across three levels.', tags: ['Modern Villas'] },
  { title: 'Alipson Residency', category: 'Apartments', location: 'Malappuram', year: '2026', image: 'residency', area: '132,000 sq.ft', desc: 'Family-centric residences blending sustainable layouts with premium interior finishes.', tags: ['Apartments'] },
  { title: 'Riverside Commercial Park', category: 'Commercial', location: 'Kozhikode', year: '2023', image: 'riverside', area: '84,000 sq.ft', desc: 'A landmark retail-and-office park anchoring the riverfront with a naturally-lit central atrium.', tags: ['Commercial Buildings'] },
];

/* ---- WHY US (bento) ----------------------------------------------------- */
export type Bento = { icon: LucideIcon; title: string; desc: string; span: string };
export const WHY: Bento[] = [
  { icon: ShieldCheck, title: 'Transparent Contracts', desc: 'Itemised invoices, verified material specs and absolutely zero hidden costs.', span: 'span-2' },
  { icon: Clock, title: 'On-Time, Every Time', desc: 'Digital Gantt tracking and dedicated site supervisors keep milestones exact.', span: 'span-1' },
  { icon: Users, title: 'Master Craftsmen', desc: 'Licensed architects and elite finishing crews.', span: 'span-1' },
  { icon: Leaf, title: 'Sustainable by Design', desc: 'Green-building methods and energy-conscious material planning throughout.', span: 'span-2' },
];

/* ---- PROCESS ------------------------------------------------------------ */
export type Step = { num: string; title: string; desc: string };
export const PROCESS: Step[] = [
  { num: '01', title: 'Consultation & Feasibility', desc: 'Site inspection, soil testing and structural feasibility to frame the brief.' },
  { num: '02', title: 'Architectural Design', desc: 'Detailed 3D visualisation, structural calculation and zoning approvals.' },
  { num: '03', title: 'Civil Execution', desc: 'Precision foundation casting, RCC columns and the skeletal shell build.' },
  { num: '04', title: 'Premium Finishes', desc: 'Marble flooring, MEP fit-out and interior completion to the last detail.' },
  { num: '05', title: 'Handover & Care', desc: 'Elegant key handover backed by a structural warranty and aftercare.' },
];

/* ---- TESTIMONIALS ------------------------------------------------------- */
export type Testimonial = { initials: string; name: string; role: string; quote: string };
export const TESTIMONIALS: Testimonial[] = [
  { initials: 'AM', name: 'Anand Madhavan', role: 'Villa Owner · Kochi', quote: 'Alipson turned our plot into an absolute masterpiece. The transparency and site updates were phenomenal from day one.' },
  { initials: 'SR', name: 'Shreya Ramachandran', role: 'Home Owner · Calicut', quote: 'Professional, punctual and deeply artistic. The interior detailing in our double-height lounge is simply premium.' },
  { initials: 'RA', name: 'Rahul & Anjali', role: 'Luxury Villa Owner · Calicut', quote: 'The transparency in budgeting and quality of materials used was top-notch. Delivered our dream home exactly on schedule!' },
  { initials: 'KM', name: 'K. M. Mathew', role: 'Mathew Commercials', quote: 'Their layout maximised our usable space by 20% and they still finished ahead of the deadline. Remarkable.' },
  { initials: 'FP', name: 'Fathima P.', role: 'Apartment Owner · Kozhikode', quote: 'From soil test to handover, one accountable team. It felt less like construction and more like collaboration.' },
];

/* ---- GALLERY ------------------------------------------------------------ */
export type GalleryItem = { image: MediaKey; title: string; cat: string; size: string };
export const GALLERY: GalleryItem[] = [
  { image: 'villa', title: 'Grandeur Estate', cat: 'Residential', size: 'tall' },
  { image: 'interior', title: 'Bronze Lounge', cat: 'Interior', size: 'wide' },
  { image: 'hub', title: 'Business Hub', cat: 'Commercial', size: 'reg' },
  { image: 'heights', title: 'Heights Tower', cat: 'Structural', size: 'tall' },
  { image: 'residency', title: 'The Residency', cat: 'Residential', size: 'reg' },
  { image: 'heroPoster', title: 'Golden Hour Site', cat: 'Process', size: 'wide' },
];

/* ---- FAQ ---------------------------------------------------------------- */
export type Faq = { q: string; a: string };
export const FAQS: Faq[] = [
  { q: 'How do you price a project?', a: 'Every engagement begins with a free consultation and a fully itemised estimate — material grade, labour and timelines are laid out transparently before a single stone is laid.' },
  { q: 'Do you handle design and construction together?', a: 'Yes. We are a turnkey design-build studio, so architecture, structural engineering, interiors and execution are delivered by one accountable team.' },
  { q: 'How do I track progress on my build?', a: 'Clients receive weekly photo and video updates plus access to a digital milestone tracker, so you always know exactly where your project stands.' },
  { q: 'What warranty do you offer?', a: 'All structural works carry a multi-year warranty, with dedicated aftercare for finishes and MEP systems following handover.' },
  { q: 'Which regions do you build in?', a: 'We operate across Kerala — Kochi, Kozhikode, Calicut, Malappuram, Thrissur and surrounding districts — with select projects beyond.' },
];

/* ---- STUDIO / ABOUT HIGHLIGHTS ------------------------------------------ */
export type Highlight = { icon: LucideIcon; title: string; desc: string };
export const HIGHLIGHTS: Highlight[] = [
  { icon: Sparkles, title: 'Award-Winning Design', desc: 'Recognised across Kerala for innovative, sustainable architecture.' },
  { icon: Ruler, title: 'Precision Engineering', desc: 'Zero-compromise structural detailing on every landmark.' },
  { icon: LineChart, title: 'On-Budget Delivery', desc: 'Digital cost control that protects your investment end-to-end.' },
];

/* ---- FOUNDER & LEADERSHIP ----------------------------------------------- */
export const FOUNDER = {
  eyebrow: 'Founder & Legacy',
  title: 'The Visionaries Behind',
  titleEm: 'Alipson Builders.',
  quote: 'Building is not just about brick and mortar; it\'s about shaping lifetime memories and trust for families in Kerala.',
  body: [
    'For over fifteen years, Alipson Builders has grown from a small Kerala practice into one of the region\'s most trusted names in luxury construction — built on relationships, referrals and homes that stand the test of time.',
    'Our leadership pairs deep local expertise in Kerala real estate with a customer-first philosophy: transparent contracts, on-time delivery and a relentless commitment to quality on every site, from foundation to final finish.',
  ],
  name: 'Kanunnilal',
  role: 'Founders · Alipson Builders, Kerala',
  values: [
    { k: '15+', v: 'Years of trusted craftsmanship' },
    { k: '100%', v: 'On-time, on-budget delivery' },
    { k: 'Kerala', v: 'Deep-rooted local expertise' },
  ],
};

export const CLIENTS = [
  'Buildcorp Studio', 'L&T Infrastructure', 'Emaar Landmark', 'Sobha Developers',
  'Foster Studio', 'Prestige Group', 'DLF Homes',
];

export type IconEl = ReactNode;
