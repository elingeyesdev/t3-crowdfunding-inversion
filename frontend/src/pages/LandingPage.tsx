import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { fetchPublicCampaigns, type PublicCampaign } from '../api/public-campaigns.api';
import { getCategories } from '../api/categories.api';
import { UniFoundMeLogo } from '../components/UniFoundMeLogo';
import { AISupportChat } from '../components/AISupportChat';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';
import { getImageUrl } from '../utils/image.utils';
import type { Category } from '../types/category.types';
import {
  Rocket, Search, Heart, Gem, TrendingUp, Users, Target, Calendar,
  Shield, ChevronRight, ArrowRight, LayoutGrid,
  CheckCircle2, Globe, Lock, Flame,
  Play, Share2, MessageSquare,
  ChevronUp, ChevronDown,
} from 'lucide-react';

// ─── Brand ───────────────────────────────────────────────────────────────────
const UNI = '#8B1938';
const GREEN = '#72B626';
const GREEN_DARK = '#4a7f1a';

const CAMPAIGN_TYPE = {
  donation: { label: 'Donación', icon: Heart, color: '#e91e63', bg: '#fce4ec' },
  reward: { label: 'Recompensa', icon: Gem, color: '#f9a825', bg: '#fff8e1' },
  equity: { label: 'Equity', icon: TrendingUp, color: GREEN, bg: '#f0f9e0' },
};

// ─── Hero ─────────────────────────────────────────────────────────────────────
const HERO_FALLBACKS = [
  'https://images.unsplash.com/photo-1531206715517-5c0ba140b2b8?w=200&h=200&fit=crop',
  'https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?w=200&h=200&fit=crop',
  'https://images.unsplash.com/photo-1509099836639-18ba1795216d?w=200&h=200&fit=crop',
  'https://images.unsplash.com/photo-1502086223501-7ea6ecd79368?w=200&h=200&fit=crop',
  'https://images.unsplash.com/photo-1555529669-e69e7aa0ba9a?w=200&h=200&fit=crop',
  'https://images.unsplash.com/photo-1559027615-cd4628902d4a?w=200&h=200&fit=crop',
  'https://images.unsplash.com/photo-1469571486292-0ba58a3f068b?w=200&h=200&fit=crop',
  'https://images.unsplash.com/photo-1535016120720-40c646be5580?w=200&h=200&fit=crop',
];

// Arc positions for the 8 images — they fan out from bottom-left to top-right
const ARC_POSITIONS = [
  { top: '55%', left: '2%', size: 100 },
  { top: '30%', left: '10%', size: 115 },
  { top: '8%', left: '24%', size: 105 },
  { top: '0%', left: '45%', size: 120 },
  { top: '8%', left: '65%', size: 110 },
  { top: '30%', left: '76%', size: 105 },
  { top: '55%', left: '80%', size: 95 },
  { top: '75%', left: '60%', size: 90 },
];

function HeroSection({ totalCampaigns, campaigns }: { totalCampaigns: number; campaigns: PublicCampaign[] }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');

  const images = HERO_FALLBACKS.map((fb, i) => {
    const c = campaigns[i];
    return c ? (getImageUrl(c.coverImageUrl) || fb) : fb;
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    navigate(query.trim() ? `/explore?q=${encodeURIComponent(query.trim())}` : '/explore');
  };

  return (
    <section className="bg-white overflow-hidden">
      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 pt-10 sm:pt-14 pb-0">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-10 items-center min-h-[480px] sm:min-h-[520px]">

          {/* Left copy */}
          {/* Left copy */}
          <div className="pb-14 text-center lg:text-left flex flex-col items-center lg:items-start">

            <h1 className="text-[34px] sm:text-[42px] md:text-[54px] lg:text-[64px] font-black text-gray-900 leading-[1.05] tracking-tight mb-4">
              Donde comienzan<br />
              <span style={{ color: GREEN }}>los sueños</span>{' '}
              <span style={{ color: UNI }}>que se hacen</span><br />
              realidad.
            </h1>

            <p className="text-[14px] sm:text-[15px] lg:text-[16px] text-gray-500 leading-relaxed mb-8 max-w-[500px] font-medium mx-auto lg:mx-0">
              Empieza en solo unos minutos. Con nuevas herramientas es más fácil
              que nunca crear tu campaña, contar tu historia y llegar a miles de donadores.
            </p>

            {/* Search bar */}
            <form onSubmit={handleSearch} className="hidden sm:flex gap-2 mb-8 max-w-[520px] w-full">
              <div className="flex-1 relative">
                <Search size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" strokeWidth={2.5} />
                <input type="text" value={query} onChange={e => setQuery(e.target.value)}
                  placeholder="Busca una campaña..."
                  className="w-full pl-11 pr-4 py-3.5 rounded-2xl border border-gray-200 text-[14px] font-medium outline-none focus:ring-2 focus:border-transparent shadow-sm placeholder:text-gray-400 text-gray-900 bg-white"
                  style={{ '--tw-ring-color': GREEN } as React.CSSProperties}
                />
              </div>
              <button type="submit"
                className="px-6 py-3.5 rounded-xl text-white font-bold text-[13px] uppercase tracking-wider transition-all active:scale-95 border-none cursor-pointer hover:opacity-90"
                style={{ background: GREEN }}>
                Buscar
              </button>
            </form>

            {/* Mobile Arc of Images */}
            <div className="lg:hidden relative h-[240px] mb-8 w-[350px] max-w-full transform scale-[0.6] origin-top mx-auto">
              {ARC_POSITIONS.map((pos, i) => (
                <div key={i}
                  className="absolute rounded-full overflow-hidden shadow-xl ring-4 ring-white transition-transform hover:scale-105 duration-300"
                  style={{ top: pos.top, left: pos.left, width: pos.size, height: pos.size, zIndex: i }}>
                  <img src={images[i]} alt="" className="w-full h-full object-cover"
                    onError={e => { (e.target as HTMLImageElement).src = HERO_FALLBACKS[i % HERO_FALLBACKS.length]; }} />
                </div>
              ))}
              {/* Subtle radial gradient overlay */}
              <div className="absolute inset-0 pointer-events-none"
                style={{ background: 'radial-gradient(ellipse at 100% 100%, rgba(255,255,255,0.7) 0%, transparent 60%)' }} />
            </div>

            {/* CTAs */}
            <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:gap-3 mb-10 w-full sm:w-auto">
              <Link to="/entrepreneur-profile"
                className="flex justify-center items-center gap-1.5 sm:gap-2 text-white px-2 py-3 sm:px-7 sm:py-3.5 rounded-xl font-bold text-[11px] sm:text-[15px] leading-tight text-center no-underline transition-all hover:opacity-90 active:scale-95"
                style={{ background: GREEN }}>
                <Rocket className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" strokeWidth={2} />
                Comenzar campaña
              </Link>
              <Link to="/explore"
                className="flex justify-center items-center gap-1.5 sm:gap-2 text-gray-700 px-2 py-3 sm:px-7 sm:py-3.5 rounded-xl sm:rounded-2xl font-bold text-[11px] sm:text-[15px] leading-tight text-center no-underline border border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-all">
                Explorar campañas
                <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" strokeWidth={2.5} />
              </Link>
            </div>

            {/* Trust badges */}
            <div className="flex flex-wrap justify-center lg:justify-start gap-5">
              {[
                { icon: CheckCircle2, text: `${totalCampaigns > 0 ? totalCampaigns + '+' : ''} campañas activas`, color: GREEN },
                { icon: Shield, text: 'Plataforma verificada', color: '#1565c0' },
                { icon: Users, text: '100+ donadores activos', color: '#7b1fa2' },
              ].map(({ icon: Icon, text, color }) => (
                <div key={text} className="flex items-center gap-1.5 text-gray-500 text-[13px] font-semibold">
                  <Icon size={14} strokeWidth={2.5} style={{ color }} /> {text}
                </div>
              ))}
            </div>
          </div>

          {/* Right: arc of images */}
          <div className="hidden lg:block relative h-[480px]">
            {ARC_POSITIONS.map((pos, i) => (
              <div key={i}
                className="absolute rounded-full overflow-hidden shadow-xl ring-4 ring-white transition-transform hover:scale-105 duration-300"
                style={{ top: pos.top, left: pos.left, width: pos.size, height: pos.size, zIndex: i }}>
                <img src={images[i]} alt="" className="w-full h-full object-cover"
                  onError={e => { (e.target as HTMLImageElement).src = HERO_FALLBACKS[i % HERO_FALLBACKS.length]; }} />
              </div>
            ))}
            {/* Subtle radial gradient overlay */}
            <div className="absolute inset-0 pointer-events-none"
              style={{ background: 'radial-gradient(ellipse at 100% 100%, rgba(255,255,255,0.7) 0%, transparent 60%)' }} />
          </div>
        </div>
      </div>

      {/* Wave divider */}
      <div className="w-full overflow-hidden" style={{ marginTop: '-2px' }}>
        <svg viewBox="0 0 1440 60" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full block">
          <path d="M0 60H1440V20C1200 55 900 0 720 25C540 50 240 0 0 20V60Z" fill="#f7f9f7" />
        </svg>
      </div>
    </section>
  );
}


function CampaignCard({ campaign }: { campaign: PublicCampaign }) {
  const navigate = useNavigate();
  const progress = campaign.goalAmount > 0
    ? Math.min(Math.round((campaign.currentAmount / campaign.goalAmount) * 100), 100)
    : 0;
  const coverUrl = getImageUrl(campaign.coverImageUrl);
  const typeInfo = CAMPAIGN_TYPE[campaign.campaignType] || CAMPAIGN_TYPE.donation;
  const TypeIcon = typeInfo.icon;
  let daysLeft: number | null = null;
  if (campaign.endDate) {
    const ms = new Date(campaign.endDate).getTime() - Date.now();
    daysLeft = Math.max(0, Math.ceil(ms / 86_400_000));
  }

  return (
    <div onClick={() => navigate(`/campaign/${campaign.id}`)}
      className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden group hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer flex flex-col">
      {/* Image */}
      <div className="relative h-[190px] bg-gray-100 overflow-hidden">
        {coverUrl
          ? <img src={coverUrl} alt={campaign.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            onError={e => { (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1554224155-1696413565d3?w=600'; }} />
          : <div className="w-full h-full flex items-center justify-center"><Rocket size={40} strokeWidth={1} className="text-gray-300" /></div>
        }
        {/* Badges */}
        <span className="absolute top-3 left-3 bg-white/90 backdrop-blur-sm px-2 py-1 rounded-lg text-[10px] font-black text-gray-800 uppercase tracking-widest">
          {campaign.categoryName}
        </span>
        <span className="absolute top-3 right-3 px-2 py-1 rounded-lg text-[10px] font-black text-white flex items-center gap-1"
          style={{ backgroundColor: typeInfo.color }}>
          <TypeIcon size={10} strokeWidth={3} /> {typeInfo.label}
        </span>
        {daysLeft !== null && daysLeft <= 5 && daysLeft > 0 && (
          <span className="absolute bottom-3 left-3 bg-red-500/90 text-white text-[10px] font-black px-2 py-1 rounded-lg flex items-center gap-1 animate-pulse">
            <Flame size={10} strokeWidth={3} /> {daysLeft === 1 ? 'Último día' : `${daysLeft} días`}
          </span>
        )}
      </div>

      {/* Content */}
      <div className="p-5 flex-1 flex flex-col gap-3">
        <h3 className="text-[14px] font-black text-gray-900 leading-tight line-clamp-2 group-hover:text-[#4a7f1a] transition-colors">
          {campaign.title}
        </h3>
        {campaign.shortDescription && (
          <p className="text-[12px] text-gray-400 line-clamp-2 leading-relaxed flex-1">{campaign.shortDescription}</p>
        )}
        {/* Progress */}
        <div>
          <div className="flex justify-between items-baseline mb-1">
            <span className="text-[16px] font-black text-gray-900">Bs. {campaign.currentAmount.toLocaleString('es-BO')}</span>
            <span className="text-[11px] font-semibold text-gray-400">meta: Bs. {campaign.goalAmount.toLocaleString('es-BO')}</span>
          </div>
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all"
              style={{ width: `${progress}%`, background: progress >= 100 ? '#f9a825' : GREEN }} />
          </div>
        </div>
        {/* Footer */}
        <div className="flex items-center justify-between text-[11px] text-gray-400 font-semibold pt-2 border-t border-gray-50">
          <span className="flex items-center gap-1 font-black" style={{ color: GREEN }}><Target size={11} strokeWidth={3} />{progress}%</span>
          <span className="flex items-center gap-1"><Users size={11} strokeWidth={2.5} />{campaign.investorCount} donadores</span>
          {daysLeft !== null && <span className="flex items-center gap-1"><Calendar size={11} strokeWidth={2.5} />{daysLeft > 0 ? `${daysLeft}d` : 'Finalizada'}</span>}
        </div>
      </div>
    </div>
  );
}

function FeaturedCampaignsSection({ campaigns, loading }: { campaigns: PublicCampaign[]; loading: boolean }) {
  return (
    <section className="bg-[#f7f9f7] py-12 sm:py-20">
      <div className="max-w-[1280px] mx-auto px-4 sm:px-6">
        <div className="flex items-end justify-between mb-8 sm:mb-10">
          <div>
            <span className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full mb-3" style={{ background: '#f0f9e0', color: GREEN }}>
              Destacadas
            </span>
            <h2 className="text-[30px] md:text-[38px] font-black text-gray-900 tracking-tight leading-tight">
              Campañas con más<br />financiamiento
            </h2>
          </div>
          <Link to="/explore" className="hidden md:inline-flex items-center gap-1.5 font-bold text-[14px] no-underline hover:underline" style={{ color: GREEN }}>
            Ver todas <ChevronRight size={15} strokeWidth={2.5} />
          </Link>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-white rounded-3xl border border-gray-100 overflow-hidden animate-pulse">
                <div className="h-[190px] bg-gray-100" />
                <div className="p-5 space-y-3">
                  <div className="h-4 bg-gray-100 rounded-full w-3/4" />
                  <div className="h-3 bg-gray-50 rounded-full" />
                  <div className="h-1.5 bg-gray-50 rounded-full mt-2" />
                </div>
              </div>
            ))}
          </div>
        ) : campaigns.length === 0 ? (
          <p className="text-center py-16 text-gray-400 font-semibold">No hay campañas disponibles aún.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {campaigns.map(c => <CampaignCard key={c.id} campaign={c} />)}
          </div>
        )}

        <div className="mt-8 text-center md:hidden">
          <Link to="/explore" className="inline-flex items-center gap-1.5 font-bold text-[14px] no-underline" style={{ color: GREEN }}>
            Ver todas las campañas <ArrowRight size={14} strokeWidth={2.5} />
          </Link>
        </div>
      </div>
    </section>
  );
}

// ─── How It Works (animated steps) ───────────────────────────────────────────
const HOW_STEPS = [
  {
    title: 'Usa nuestras herramientas para crear tu campaña',
    desc: 'Se te guiará paso a paso para añadir detalles, definir tu objetivo y publicar tu campaña en minutos.',
    image: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=600&h=500&fit=crop',
  },
  {
    title: 'Consigue más apoyos compartiendo tu campaña',
    desc: 'Comparte el enlace de tu campaña y usa el panel de control para impulsar tu alcance.',
    image: 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=600&h=500&fit=crop',
  },
  {
    title: 'Recibe fondos de forma segura y transparente',
    desc: 'Añade tus datos bancarios y empieza a recibir los fondos directamente en tu cuenta con total seguridad.',
    image: 'https://images.unsplash.com/photo-1579621970563-ebec7560ff3e?w=600&h=500&fit=crop',
  },
];

const STEP_DURATION = 6000; // ms

function AnimatedStepNumber({ index, active, progress }: { index: number; active: boolean; progress: number }) {
  const r = 22;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - progress / 100);
  return (
    <div className="relative w-14 h-14 flex-shrink-0 flex items-center justify-center">
      <svg className="absolute inset-0 -rotate-90" width="56" height="56">
        <circle cx="28" cy="28" r={r} stroke="#e5e7eb" strokeWidth="3" fill="none" />
        {active && (
          <circle cx="28" cy="28" r={r} stroke={GREEN} strokeWidth="3" fill="none"
            strokeDasharray={circ} strokeDashoffset={offset}
            style={{ transition: 'stroke-dashoffset 0.1s linear' }} />
        )}
      </svg>
      <span className="relative z-10 text-[16px] font-black" style={{ color: active ? GREEN : '#9ca3af' }}>
        {index + 1}
      </span>
    </div>
  );
}

function HowItWorksSection() {
  const [activeStep, setActiveStep] = useState(0);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (paused) return;
    intervalRef.current = setInterval(() => {
      setProgress(p => {
        if (p >= 100) {
          setActiveStep(s => (s + 1) % HOW_STEPS.length);
          return 0;
        }
        return p + (100 / (STEP_DURATION / 100));
      });
    }, 100);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [paused, activeStep]);

  return (
    <section className="bg-[#f7f9f7] py-12 lg:py-24" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      <div className="max-w-[1280px] mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-16 items-center">

          {/* Image (changes with step) */}
          <div className="relative rounded-2xl overflow-hidden shadow-md h-[240px] sm:h-[340px] lg:h-[420px] bg-gray-100 order-2 lg:order-1">
            {HOW_STEPS.map((s, i) => (
              <img key={i} src={s.image} alt={s.title}
                className="absolute inset-0 w-full h-full object-cover transition-all duration-700"
                style={{ opacity: i === activeStep ? 1 : 0, transform: i === activeStep ? 'scale(1)' : 'scale(1.04)' }} />
            ))}
            {/* Step badge */}
            <div className="absolute bottom-5 left-5 bg-white/90 backdrop-blur-sm rounded-2xl px-4 py-2.5 shadow-lg">
              <p className="text-[11px] font-black text-gray-500 uppercase tracking-widest">Paso {activeStep + 1} de 3</p>
              <p className="text-[13px] font-black text-gray-900 mt-0.5 max-w-[200px] line-clamp-1">{HOW_STEPS[activeStep].title}</p>
            </div>
          </div>

          {/* Steps list */}
          <div className="order-1 lg:order-2">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full mb-5" style={{ background: '#f0f9e0', color: GREEN }}>
              Simple y rápido
            </span>
            <h2 className="text-[30px] md:text-[38px] font-black text-gray-900 tracking-tight leading-tight mb-10">
              Recaudar fondos es fácil,<br />eficaz y de confianza.
            </h2>

            <ol className="flex flex-col gap-8">
              {HOW_STEPS.map((step, i) => (
                <li key={i} className="flex items-start gap-5 cursor-pointer" onClick={() => { setActiveStep(i); setProgress(0); }}>
                  <AnimatedStepNumber index={i} active={i === activeStep} progress={i === activeStep ? progress : i < activeStep ? 100 : 0} />
                  <div className={`transition-opacity duration-300 ${i === activeStep ? 'opacity-100' : 'opacity-50'}`}>
                    <h3 className="text-[16px] font-black text-gray-900 mb-1.5">{step.title}</h3>
                    {i === activeStep && (
                      <p className="text-[14px] text-gray-500 leading-relaxed">{step.desc}</p>
                    )}
                  </div>
                </li>
              ))}
            </ol>

            <Link to="/entrepreneur-profile"
              className="mt-10 inline-flex items-center gap-2 text-white px-8 py-4 rounded-xl font-bold text-[15px] no-underline hover:opacity-90 active:scale-95 transition-all"
              style={{ background: GREEN }}>
              <Rocket size={16} strokeWidth={2} /> Comenzar ahora — es gratis
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

function YellowHelpSection() {
  return (
    <section className="py-20 bg-gray-50 border-y border-gray-100">
      <div className="max-w-[800px] mx-auto px-6 text-center">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-widest px-3 py-1.5 rounded-full mb-5 bg-white border border-gray-200"
          style={{ color: UNI }}>
          Te ayudamos
        </span>
        <h2 className="text-[28px] md:text-[38px] font-bold text-gray-900 tracking-tight leading-tight mb-5">
          Consigue lo que necesitas para que tu<br className="hidden md:block" /> campaña tenga éxito.
        </h2>
        <p className="text-[15px] text-gray-500 leading-relaxed mb-8 max-w-[580px] mx-auto">
          Desde causas sociales y proyectos de arte hasta startups con equity.
          Siempre que necesites financiamiento, puedes solicitarlo aquí.
        </p>
        <div className="flex flex-wrap gap-3 justify-center">
          <Link to="/entrepreneur-profile"
            className="inline-flex items-center gap-2 text-white px-8 py-4 rounded-xl font-semibold text-[15px] no-underline hover:opacity-90 active:scale-95 transition-all"
            style={{ background: UNI }}>
            Iniciar una campaña
          </Link>
          <Link to="/explore"
            className="inline-flex items-center gap-2 text-gray-700 px-8 py-4 rounded-xl font-semibold text-[15px] no-underline border border-gray-300 hover:border-gray-400 hover:bg-white transition-all">
            Explorar campañas <ArrowRight size={15} strokeWidth={2} />
          </Link>
        </div>
      </div>
    </section>
  );
}

const DONATOKS_COLORS = ['#1c2b1e', '#0d2137', '#1a1a2e', '#1c1c1e', '#0a1628'];

function DonatokPreviewSection({ campaigns }: { campaigns: PublicCampaign[] }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const items = campaigns.slice(0, 5);

  useEffect(() => {
    if (items.length === 0 || isPaused) return;
    const timer = setInterval(() => {
      setActiveIndex(prev => (prev + 1) % items.length);
    }, 3000);
    return () => clearInterval(timer);
  }, [items.length, isPaused]);

  const mockStats = items.map((_, i) => ({
    likes: [327, 184, 512, 96, 241][i % 5],
    comments: [42, 17, 88, 9, 63][i % 5],
  }));

  return (
    <section className="bg-white py-14 sm:py-20 lg:py-24 overflow-hidden">
      <div className="max-w-[1280px] mx-auto px-4 sm:px-6">

        {/* Cabecera centrada en móvil */}
        <div className="text-center lg:text-left mb-10 lg:mb-0">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full mb-4" style={{ background: '#f0f9e0', color: GREEN }}>
            <Play size={11} strokeWidth={3} fill={GREEN} /> Nueva funcionalidad
          </span>
          <h2 className="text-[26px] sm:text-[32px] lg:text-[42px] font-black text-gray-900 tracking-tight leading-[1.05] mb-3 lg:hidden">
            Descubre campañas <span style={{ color: GREEN }}>en video</span>
          </h2>
        </div>

        <div className="flex flex-col lg:grid lg:grid-cols-2 lg:gap-16 items-center gap-10">

          {/* Teléfono — arriba en móvil, derecha en desktop */}
          <div className="flex justify-center order-1 lg:order-2">
            <div className="relative">
              {/* Halo verde */}
              <div className="absolute -inset-8 sm:-inset-10 rounded-full blur-[50px] sm:blur-[70px] opacity-30 pointer-events-none"
                style={{ background: `radial-gradient(ellipse,${GREEN} 0%,transparent 70%)` }} />

              {/* Cuerpo del teléfono — responsivo */}
              <div
                className="relative rounded-[36px] sm:rounded-[42px] lg:rounded-[46px] overflow-hidden shadow-2xl"
                style={{
                  width: 'clamp(200px, 58vw, 268px)',
                  height: 'clamp(400px, 116vw, 538px)',
                  border: '9px solid #1c2b1e',
                  boxShadow: '0 32px 72px rgba(0,0,0,0.5)',
                }}
                onMouseEnter={() => setIsPaused(true)}
                onMouseLeave={() => setIsPaused(false)}
              >
                {/* Notch dinámico */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 bg-[#1c2b1e] z-30 rounded-b-[14px]"
                  style={{ width: '37%', height: 22 }} />

                {/* Slides */}
                <div className="relative w-full h-full overflow-hidden bg-gray-900">
                  {items.map((c, i) => {
                    const coverUrl = getImageUrl(c.coverImageUrl);
                    const progress = c.goalAmount > 0 ? Math.min(Math.round((c.currentAmount / c.goalAmount) * 100), 100) : 0;
                    const bgColor = DONATOKS_COLORS[i % DONATOKS_COLORS.length];
                    const isActive = i === activeIndex;
                    const isPrev = i === (activeIndex - 1 + items.length) % items.length;
                    return (
                      <div key={c.id} className="absolute inset-0 transition-all duration-500"
                        style={{ transform: isActive ? 'translateY(0%)' : isPrev ? 'translateY(-100%)' : 'translateY(100%)', opacity: isActive ? 1 : 0, zIndex: isActive ? 10 : 1 }}>
                        {coverUrl && (
                          <img src={coverUrl} alt={c.title} className="absolute inset-0 w-full h-full object-cover"
                            onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                        )}
                        <div className="absolute inset-0" style={{ backgroundColor: bgColor, opacity: coverUrl ? 0.55 : 1 }} />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/15 to-transparent" />

                        {/* Badge VIDEO */}
                        <div className="absolute top-9 left-3 z-20 flex items-center gap-1.5 bg-black/50 backdrop-blur-sm px-2 py-1 rounded-full">
                          <div className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
                          <span className="text-white text-[8px] font-black tracking-widest">VIDEO</span>
                        </div>

                        {/* Acciones laterales */}
                        <div className="absolute right-2.5 bottom-[110px] z-20 flex flex-col items-center gap-4">
                          {[
                            { Icon: Heart, val: mockStats[i]?.likes ?? 0, color: '#ff4d6d' },
                            { Icon: MessageSquare, val: mockStats[i]?.comments ?? 0, color: '#60a5fa' },
                            { Icon: Share2, val: null, color: '#a7f3d0' },
                          ].map(({ Icon, val, color }, idx) => (
                            <div key={idx} className="flex flex-col items-center gap-0.5">
                              <div className="w-9 h-9 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center">
                                <Icon size={14} strokeWidth={2.5} style={{ color }} />
                              </div>
                              <span className="text-white/70 text-[8px] font-bold">{val ?? 'Compartir'}</span>
                            </div>
                          ))}
                        </div>

                        {/* Info inferior */}
                        <div className="absolute bottom-0 left-0 right-0 z-20 px-3.5 pb-5 pt-10"
                          style={{ background: 'linear-gradient(to top,rgba(0,0,0,0.9) 0%,transparent 100%)' }}>
                          <p className="text-white/55 text-[8px] font-black uppercase tracking-widest mb-0.5">{c.categoryName || 'Campaña'}</p>
                          <h4 className="text-white text-[12px] font-black leading-tight line-clamp-2 mb-2">{c.title}</h4>
                          <div className="h-1 bg-white/20 rounded-full overflow-hidden mb-1.5">
                            <div className="h-full rounded-full" style={{ width: `${progress}%`, background: '#a7f3d0' }} />
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-[#d4f0a0] text-[9px] font-black">{progress}% financiado</span>
                            <span className="text-white/50 text-[8px] font-bold">Bs. {c.currentAmount.toLocaleString('es-BO')}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {items.length === 0 && (
                    <div className="absolute inset-0 flex items-center justify-center" style={{ background: `linear-gradient(135deg,#1c2b1e,${GREEN_DARK})` }}>
                      <div className="text-center text-white/30">
                        <Play size={36} strokeWidth={1} className="mx-auto mb-2 opacity-40" />
                        <p className="text-[11px] font-bold">DonaTok</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Botones navegar */}
                {items.length > 1 && (
                  <>
                    <button onClick={() => setActiveIndex(p => (p - 1 + items.length) % items.length)}
                      className="absolute left-1/2 -translate-x-1/2 top-9 z-30 w-7 h-7 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center border-none cursor-pointer hover:bg-white/25 transition-colors">
                      <ChevronUp size={12} className="text-white" strokeWidth={2.5} />
                    </button>
                    <button onClick={() => setActiveIndex(p => (p + 1) % items.length)}
                      className="absolute left-1/2 -translate-x-1/2 bottom-3 z-30 w-7 h-7 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center border-none cursor-pointer hover:bg-white/25 transition-colors">
                      <ChevronDown size={12} className="text-white" strokeWidth={2.5} />
                    </button>
                  </>
                )}
              </div>

              {/* Dots */}
              {items.length > 1 && (
                <div className="flex justify-center gap-1.5 mt-4">
                  {items.map((_, i) => (
                    <button key={i} onClick={() => setActiveIndex(i)}
                      className="rounded-full border-none cursor-pointer transition-all duration-300"
                      style={{ width: i === activeIndex ? 18 : 6, height: 6, background: i === activeIndex ? `linear-gradient(90deg,${GREEN},#72B626)` : '#cbd5e1' }} />
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Copy — debajo en móvil, izquierda en desktop */}
          <div className="order-2 lg:order-1 text-center lg:text-left">
            <h2 className="hidden lg:block text-[30px] xl:text-[42px] font-black text-gray-900 tracking-tight leading-[1.05] mb-5">
              Descubre campañas<br />
              <span style={{ color: GREEN }}>en formato video</span>
            </h2>
            <p className="text-gray-500 text-[15px] sm:text-[16px] leading-relaxed mb-6 sm:mb-8 max-w-[480px] mx-auto lg:mx-0">
              <strong className="text-gray-900">DonaTok</strong> es nuestra sección de videos cortos al estilo TikTok.
              Desliza para descubrir proyectos, conoce a los emprendedores y apoya en segundos.
            </p>

            {/* Features — 2 columnas en móvil, lista en desktop */}
            <ul className="grid grid-cols-2 lg:flex lg:flex-col gap-3 lg:gap-4 mb-8 max-w-[480px] mx-auto lg:mx-0">
              {[
                { icon: Play, text: 'Videos cortos', subtext: 'de cada campaña', color: GREEN },
                { icon: ChevronUp, text: 'Scroll vertical', subtext: 'para descubrir más', color: '#72B626' },
                { icon: Heart, text: 'Apoya proyectos', subtext: 'que te inspiran', color: '#e91e63' },
                { icon: Share2, text: 'Comparte', subtext: 'con tu red', color: '#1565c0' },
              ].map(({ icon: Icon, text, subtext, color }) => (
                <li key={text} className="flex items-center gap-2.5 lg:gap-3">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${color}15` }}>
                    <Icon size={15} strokeWidth={2.5} style={{ color }} />
                  </div>
                  <div className="text-left">
                    <p className="text-[13px] font-black text-gray-800 leading-tight">{text}</p>
                    <p className="text-[11px] text-gray-400 leading-tight hidden sm:block">{subtext}</p>
                  </div>
                </li>
              ))}
            </ul>

            <Link to="/donatok"
              className="inline-flex items-center gap-2.5 text-white px-7 py-3.5 sm:px-8 sm:py-4 rounded-2xl font-black text-[14px] sm:text-[15px] no-underline hover:-translate-y-0.5 transition-all active:scale-95"
              style={{ background: `linear-gradient(135deg,#1c2b1e,${GREEN})`, boxShadow: `0 8px 28px rgba(114,182,38,0.35)` }}>
              Abrir DonaTok <ArrowRight size={15} strokeWidth={2.5} />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Categories ───────────────────────────────────────────────────────────────
const CAT_IMAGES: Record<string, string> = {
  'technology': 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=600&h=420&fit=crop',
  'health': 'https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=600&h=420&fit=crop',
  'education': 'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=600&h=420&fit=crop',
  'environment': 'https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?w=600&h=420&fit=crop',
  'art': 'https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=600&h=420&fit=crop',
  'social-impact': 'https://images.unsplash.com/photo-1517048676732-d65bc937f952?w=600&h=420&fit=crop',
  'food': 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=600&h=420&fit=crop',
  'fashion': 'https://images.unsplash.com/photo-1445205170230-053b83016050?w=600&h=420&fit=crop',
  'gaming': 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=600&h=420&fit=crop',
  'real-estate': 'https://images.unsplash.com/photo-1486325212027-8081e485255e?w=600&h=420&fit=crop',
  'fintech': 'https://images.unsplash.com/photo-1563013544-824ae1b704d3?w=600&h=420&fit=crop',
  'agriculture': 'https://images.unsplash.com/photo-1574943320219-553eb213f72d?w=600&h=420&fit=crop',
  'mobility': 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600&h=420&fit=crop',
  'media': 'https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=600&h=420&fit=crop',
  'community': 'https://images.unsplash.com/photo-1511632765153-3bcf5e24d11a?w=600&h=420&fit=crop',
};
const DEFAULT_CAT_IMG = 'https://images.unsplash.com/photo-1554224155-1696413565d3?w=600&h=420&fit=crop';

function CategoriesSection({ categories }: { categories: Category[] }) {
  const cats = categories.slice(0, 9);
  if (cats.length === 0) return null;
  return (
    <section className="bg-[#f7f9f7] py-12 sm:py-20">
      <div className="max-w-[1280px] mx-auto px-4 sm:px-6">
        <div className="flex items-end justify-between mb-8 sm:mb-10">
          <div>
            <span className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full mb-3" style={{ background: '#f0f9e0', color: GREEN }}>
              <LayoutGrid size={11} strokeWidth={3} /> Temas destacados
            </span>
            <h2 className="text-[22px] sm:text-[28px] md:text-[38px] font-black text-gray-900 tracking-tight">Descubre por categoría</h2>
          </div>
          <Link to="/explore" className="hidden md:inline-flex items-center gap-1.5 text-[13px] font-bold no-underline hover:opacity-70 transition-opacity" style={{ color: GREEN }}>
            Ver todas <ArrowRight size={14} strokeWidth={2.5} />
          </Link>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {cats.map(cat => (
            <Link key={cat.id} to={`/explore?category=${cat.id}`}
              className="group relative rounded-3xl overflow-hidden h-[220px] cursor-pointer no-underline block shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
              <img src={CAT_IMAGES[cat.slug] ?? DEFAULT_CAT_IMG} alt={cat.displayName}
                className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
              <div className="absolute bottom-5 left-5 right-5">
                <h3 className="text-white text-[18px] font-black mb-1">{cat.displayName}</h3>
                <span className="inline-flex items-center gap-1 text-white/70 text-[12px] font-semibold">
                  Ver campañas <ArrowRight size={12} strokeWidth={2.5} />
                </span>
              </div>
              <span className="absolute top-4 right-4 bg-white/20 backdrop-blur-sm text-white text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full">
                Explorar
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Trust section ────────────────────────────────────────────────────────────
function TrustSection() {
  return (
    <section className="py-12 sm:py-20" style={{ background: '#1c2b1e' }}>
      <div className="max-w-[1280px] mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-14 items-center">
          {/* Text */}
          <div>
            <span className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full mb-5"
              style={{ background: 'rgba(114,182,38,0.2)', color: '#a7f3d0' }}>
              <Shield size={11} strokeWidth={3} /> Plataforma de confianza
            </span>
            <h2 className="text-[22px] sm:text-[30px] md:text-[42px] font-black text-white tracking-tight leading-tight mb-5">
              Unifundme es el líder de<br />confianza en Bolivia.
            </h2>
            <p className="text-white/60 text-[16px] leading-relaxed mb-8 max-w-[480px]">
              Con transparencia total en cada transacción, verificación de identidad KYC y un equipo de soporte
              dedicado, puedes recaudar o donar con total tranquilidad.
            </p>
            <ul className="flex flex-col gap-4 mb-10">
              {[
                { icon: Shield, text: 'Verificación KYC obligatoria para emprendedores', color: '#a7f3d0' },
                { icon: Lock, text: 'Transacciones 100% seguras y auditadas', color: '#93c5fd' },
                { icon: CheckCircle2, text: 'Equipo de revisión humana de campañas', color: '#fde68a' },
                { icon: Globe, text: 'Plataforma accesible desde toda Bolivia', color: '#f9a8d4' },
              ].map(({ icon: Icon, text, color }) => (
                <li key={text} className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: 'rgba(255,255,255,0.1)' }}>
                    <Icon size={16} strokeWidth={2.5} style={{ color }} />
                  </div>
                  <span className="text-white/80 text-[14px] font-semibold">{text}</span>
                </li>
              ))}
            </ul>
            <Link to="/entrepreneur-profile"
              className="inline-flex items-center gap-2 text-white px-8 py-4 rounded-2xl font-black text-[15px] no-underline hover:opacity-90 active:scale-95 transition-all border-2 border-white/20 hover:border-white/40 hover:bg-white/10"
            >
              Comenzar ahora <ArrowRight size={15} strokeWidth={2.5} />
            </Link>
          </div>

          {/* Image */}
          <div className="relative">
            <div className="rounded-2xl overflow-hidden shadow-md h-[260px] sm:h-[340px] lg:h-[420px]">
              <img src="https://images.unsplash.com/photo-1521737604893-d14cc237f11d?w=700&h=500&fit=crop"
                alt="Equipo Unifundme" className="w-full h-full object-cover" />
            </div>
            {/* Floating card */}
            <div className="absolute -bottom-5 -left-5 bg-white rounded-2xl p-4 shadow-2xl flex items-center gap-3 border border-gray-100">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: '#f0f9e0' }}>
                <TrendingUp size={20} style={{ color: GREEN }} strokeWidth={2.5} />
              </div>
              <div>
                <p className="text-[12px] font-black text-gray-900">Éxito comprobado</p>
                <p className="text-[11px] text-gray-400 font-semibold">94% campañas exitosas</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Final CTA ────────────────────────────────────────────────────────────────
function CTABanner() {
  return (
    <section className="py-12 sm:py-20 bg-white">
      <div className="max-w-[700px] mx-auto px-4 sm:px-6 text-center">
        <UniFoundMeLogo variant="color" className="mx-auto mb-6 h-14 sm:h-20" />
        <h2 className="text-[24px] sm:text-[30px] md:text-[44px] font-black text-gray-900 tracking-tight mb-4">
          ¿Listo para hacer realidad<br />tu proyecto?
        </h2>
        <p className="text-gray-500 text-[16px] leading-relaxed mb-8">
          Únete a cientos de emprendedores bolivianos que ya están financiando sus sueños con Unifundme.
        </p>
        <div className="flex flex-wrap gap-3 justify-center">
          <Link to="/entrepreneur-profile"
            className="inline-flex items-center gap-2 text-white px-9 py-4 rounded-xl font-semibold text-[16px] no-underline hover:opacity-90 active:scale-95 transition-all"
            style={{ background: GREEN }}>
            <Rocket size={17} strokeWidth={2} /> Comenzar campaña
          </Link>
          <Link to="/explore"
            className="inline-flex items-center gap-2 text-gray-700 px-9 py-4 rounded-2xl font-bold text-[16px] no-underline border-2 border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-all">
            Explorar campañas <ArrowRight size={15} strokeWidth={2.5} />
          </Link>
        </div>
      </div>
    </section>
  );
}

// ─── Main LandingPage ─────────────────────────────────────────────────────────
export function LandingPage() {
  const [featuredCampaigns, setFeaturedCampaigns] = useState<PublicCampaign[]>([]);
  const [campaignsLoading, setCampaignsLoading] = useState(true);
  const [categories, setCategories] = useState<Category[]>([]);
  const [totalCampaigns, setTotalCampaigns] = useState(0);

  useEffect(() => {
    fetchPublicCampaigns({ limit: 8, sortBy: 'current_amount', sortOrder: 'DESC' })
      .then(res => {
        setFeaturedCampaigns(res.data);
        setTotalCampaigns(res.meta.totalItems);
      })
      .catch(() => { })
      .finally(() => setCampaignsLoading(false));

    getCategories().then(setCategories).catch(() => { });
  }, []);

  return (
    <div>
      <Navbar />
      <HeroSection totalCampaigns={totalCampaigns} campaigns={featuredCampaigns} />
      <FeaturedCampaignsSection campaigns={featuredCampaigns.slice(0, 6)} loading={campaignsLoading} />
      <HowItWorksSection />
      <YellowHelpSection />
      <DonatokPreviewSection campaigns={featuredCampaigns} />
      <CategoriesSection categories={categories} />
      <TrustSection />
      <CTABanner />
      <Footer />
      <AISupportChat />
    </div>
  );
}
