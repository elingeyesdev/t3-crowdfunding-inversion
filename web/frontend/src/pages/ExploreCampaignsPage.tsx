import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { usePublicCampaigns } from '../hooks/usePublicCampaigns';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';
import { getImageUrl } from '../utils/image.utils';
import { StoriesAvatarBar } from '../components/StoriesAvatarBar';
import { getCategories } from '../api/categories.api';
import { fetchPublicCampaigns, type PublicCampaign } from '../api/public-campaigns.api';
import type { Category } from '../types/category.types';
import {
  Search,
  AlertCircle,
  Users,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Filter,
  Rocket,
  Target,
  FolderOpen,
  LayoutGrid,
  Loader2,
  ArrowRight,
  ChevronDown,
  Check,
  Flame,
  Share2,
} from 'lucide-react';
import { ShareModal } from '../components/ShareModal';



function CampaignCard({ campaign, onClick }: { campaign: PublicCampaign; onClick?: () => void }) {
  const [showShare, setShowShare] = useState(false);
  const progress = campaign.goalAmount > 0
    ? Math.min(Math.round((campaign.currentAmount / campaign.goalAmount) * 100), 100)
    : 0;


  const coverUrl = getImageUrl(campaign.coverImageUrl);
  const avatarUrl = getImageUrl(campaign.entrepreneurAvatar);

  let daysRemaining: number | null = null;
  if (campaign.endDate) {
    const ms = new Date(campaign.endDate).getTime() - Date.now();
    daysRemaining = Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
  }

  return (
    <div
      onClick={onClick}
      className="bg-white rounded-xl border border-gray-200 overflow-hidden group hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 flex flex-col cursor-pointer">

      {/* Cover Image */}
      <div className="relative h-48 bg-gradient-to-br from-[#1c2b1e] to-[#72B626] overflow-hidden">
        {coverUrl ? (
          <img
            src={coverUrl}
            alt={campaign.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            onError={(e) => {
              (e.target as HTMLImageElement).onerror = null;
              (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1554224155-1696413565d3?q=80&w=1000'; // Default business image
            }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Rocket size={48} strokeWidth={1} className="text-white/20" />
          </div>
        )}

        {/* Category Badge */}
        <div className="absolute top-3 left-3 bg-white/95 px-2.5 py-1 rounded-md text-[11px] font-semibold text-gray-700 shadow-sm">
          {campaign.categoryName}
        </div>

        {/* Ending Soon Badge */}
        {daysRemaining !== null && daysRemaining > 0 && daysRemaining <= 7 && (
          <div className="absolute bottom-3 left-4 bg-red-500/90 backdrop-blur-sm px-2.5 py-1 rounded-lg text-[10px] font-black text-white uppercase tracking-wider shadow-lg shadow-red-500/30 flex items-center gap-1 animate-pulse">
            <Flame size={11} strokeWidth={3} />
            {daysRemaining === 1 ? '¡Último día!' : `${daysRemaining} días`}
          </div>
        )}

        {/* Botón de Compartir Flotante */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setShowShare(true);
          }}
          className="absolute bottom-4 right-4 w-9 h-9 rounded-xl bg-white/95 backdrop-blur-md flex items-center justify-center text-slate-700 hover:bg-[#72B626] hover:text-white transition-all shadow-lg shadow-black/10 active:scale-90 border-none cursor-pointer group/share"
          title="Compartir Campaña"
        >
          <Share2 size={14} strokeWidth={2.5} className="group-hover/share:rotate-12 transition-transform" />
        </button>

        {/* Progress overlay */}
        <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-black/20">
          <div
            className="h-full bg-white/90 transition-all duration-1000 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Content */}
      <div className="p-4 flex-1 flex flex-col gap-3">
        {/* Entrepreneur info */}
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-full bg-[#72B626]/10 flex items-center justify-center text-[#72B626] text-[10px] font-bold overflow-hidden shrink-0">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt=""
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).onerror = null;
                  (e.target as HTMLImageElement).src = '/default-avatar.png';
                }}
              />
            ) : (
              campaign.entrepreneurName?.charAt(0)?.toUpperCase() || '?'
            )}
          </div>
          <div className="min-w-0">
            <p className="text-[12px] font-bold text-slate-700 truncate">
              {campaign.entrepreneurDisplayName
                ? `@${campaign.entrepreneurDisplayName}`
                : campaign.entrepreneurName}
            </p>
          </div>
        </div>

        {/* Title */}
        <h3 className="text-[15px] font-bold text-gray-900 leading-tight line-clamp-2 group-hover:text-[#72B626] transition-colors">
          {campaign.title}
        </h3>

        {/* Description */}
        {campaign.shortDescription && (
          <p className="text-[13px] text-slate-500 leading-relaxed line-clamp-2 flex-1">
            {campaign.shortDescription}
          </p>
        )}

        {/* Progress bar */}
        <div>
          <div className="flex justify-between items-baseline mb-1.5">
            <span className="text-[18px] font-bold text-gray-900">
              Bs. {campaign.currentAmount.toLocaleString('es-BO')}
            </span>
            <span className="text-[12px] text-gray-400">
              de Bs. {campaign.goalAmount.toLocaleString('es-BO')}
            </span>
          </div>
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${progress}%`,
                background: progress >= 100 ? '#F59E0B' : '#72B626',
              }}
            />
          </div>
        </div>

        {/* Stats */}
        <div className="flex items-center justify-between text-[12px] text-gray-400 pt-2 border-t border-gray-100">
          <div className="flex items-center gap-1">
            <Target size={12} strokeWidth={2} style={{ color: '#72B626' }} />
            <span className="font-semibold" style={{ color: '#72B626' }}>{progress}%</span>
          </div>
          <div className="flex items-center gap-1">
            <Users size={12} strokeWidth={2} />
            <span>{campaign.investorCount} donadores</span>
          </div>
          {daysRemaining !== null && (
            <div className="flex items-center gap-1">
              <Calendar size={12} strokeWidth={2} />
              <span>{daysRemaining > 0 ? `${daysRemaining} días` : 'Finalizada'}</span>
            </div>
          )}
        </div>
      </div>

      {showShare && (
        <ShareModal
          campaignId={campaign.id}
          campaignTitle={campaign.title}
          onClose={() => setShowShare(false)}
        />
      )}
    </div>
  );
}

export function ExploreCampaignsPage() {
  const { campaigns, meta, loading, error, filters, updateFilters, goToPage } = usePublicCampaigns();
  const [searchInput, setSearchInput] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();

  // ── Search suggestions state ──
  const [suggestions, setSuggestions] = useState<PublicCampaign[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // ── Category dropdown state ──
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const categoryDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getCategories()
      .then(setCategories)
      .catch(() => { })
      .finally(() => setCategoriesLoading(false));
  }, []);

  // ── Debounced search suggestions ──
  useEffect(() => {
    const trimmed = searchInput.trim();
    if (trimmed.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      setSelectedIndex(-1);
      return;
    }

    const timer = setTimeout(async () => {
      setSuggestionsLoading(true);
      try {
        const result = await fetchPublicCampaigns({ q: trimmed, limit: 5 });
        setSuggestions(result.data);
        setShowSuggestions(true);
        setSelectedIndex(-1);
      } catch {
        setSuggestions([]);
      } finally {
        setSuggestionsLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchInput]);

  // ── Close suggestions on outside click ──
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
      if (categoryDropdownRef.current && !categoryDropdownRef.current.contains(e.target as Node)) {
        setShowCategoryDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleCardClick = (campaignId: string) => {
    navigate(`/campaign/${campaignId}`, {
      state: { from: location.pathname + location.search },
    });
  };

  const handleSuggestionClick = useCallback((campaignId: string) => {
    setShowSuggestions(false);
    navigate(`/campaign/${campaignId}`, {
      state: { from: location.pathname + location.search },
    });
  }, [navigate, location]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setShowSuggestions(false);
    updateFilters({ q: searchInput || undefined });
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestions || suggestions.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => (prev < suggestions.length - 1 ? prev + 1 : 0));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => (prev > 0 ? prev - 1 : suggestions.length - 1));
        break;
      case 'Enter':
        if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
          e.preventDefault();
          handleSuggestionClick(suggestions[selectedIndex].id);
        }
        break;
      case 'Escape':
        setShowSuggestions(false);
        setSelectedIndex(-1);
        break;
    }
  };

  const sortOptions = [
    { value: 'created_at:DESC', label: 'Más recientes' },
    { value: 'created_at:ASC', label: 'Más antiguas' },
    { value: 'current_amount:DESC', label: 'Mayor recaudación' },
    { value: 'goal_amount:ASC', label: 'Menor meta' },
    { value: 'goal_amount:DESC', label: 'Mayor meta' },
  ];



  const currentSort = `${filters.sortBy || 'created_at'}:${filters.sortOrder || 'DESC'}`;

  return (
    <div className="min-h-screen bg-gray-50" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <Navbar />

      {/* Hero Section */}
      <div className="bg-white border-b border-gray-200 relative">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-6 md:py-8 relative z-10 text-center">
          <span className="inline-block px-3 py-1 rounded-full text-[12px] font-semibold bg-[#f5fce8] text-[#4a7f1a] mb-3">
            Proyectos verificados
          </span>
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 tracking-tight mb-3 leading-tight">
            Descubre campañas con impacto real
          </h1>
          <p className="text-gray-500 text-[15px] max-w-[560px] mx-auto mb-2 leading-relaxed">
            Explora proyectos de emprendedores y apoya ideas que transforman comunidades.
          </p>
        </div>
      </div>

      {/* Filters Bar */}
      {/* Filters Bar */}
      <div className="bg-white border-b border-gray-100 shadow-sm sticky top-0 z-40">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-2.5 sm:py-3 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-4">
          
          {/* Left section: Category filter */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-4 w-full sm:w-auto">
            <div className="hidden sm:flex items-center gap-2 text-slate-400 text-[13px] font-semibold mr-1">
              <Filter size={16} className="text-[#72B626]" />
              Filtrar por:
            </div>

            {/* Category custom dropdown */}
            <div ref={categoryDropdownRef} className="relative flex-1 sm:flex-none">
              <button
                type="button"
                onClick={() => setShowCategoryDropdown(prev => !prev)}
                className={`w-full sm:w-auto flex items-center justify-between sm:justify-start gap-2 px-3 sm:px-4 py-2 rounded-xl text-[13px] font-semibold border transition-all cursor-pointer ${filters.categoryId
                  ? 'border-[#72B626] bg-[#72B626]/5 text-[#4a7f1a] shadow-sm shadow-[#72B626]/5'
                  : 'border-gray-200 bg-white text-slate-600 hover:border-[#72B626] hover:bg-slate-50'
                  }`}
              >
                <div className="flex items-center gap-2 truncate">
                  <LayoutGrid size={14} className={`shrink-0 ${filters.categoryId ? 'text-[#4a7f1a]' : 'text-slate-400'}`} />
                  <span className="truncate">
                    {filters.categoryId
                      ? categories.find(c => c.id === filters.categoryId)?.displayName || 'Sector'
                      : 'Sector'}
                  </span>
                </div>
                <ChevronDown size={12} className="text-slate-400 shrink-0" />
              </button>

              {showCategoryDropdown && (
                <div className="absolute top-full left-0 mt-1.5 w-[calc(100vw-2rem)] sm:w-60 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden z-50 animate-in fade-in slide-in-from-top-1 duration-150 max-w-[300px]">
                  <div className="max-h-[260px] overflow-y-auto py-1">
                    <button
                      type="button"
                      onClick={() => {
                        updateFilters({ categoryId: undefined });
                        setShowCategoryDropdown(false);
                      }}
                      className={`w-full flex items-center justify-between px-4 py-2 text-left text-[13px] font-semibold transition-all cursor-pointer border-none bg-transparent ${!filters.categoryId
                        ? 'text-[#4a7f1a] bg-green-50/50'
                        : 'text-slate-600 hover:bg-slate-50'
                        }`}
                    >
                      <span>Todos los sectores</span>
                      {!filters.categoryId && <Check size={14} strokeWidth={2.5} className="text-[#72B626]" />}
                    </button>
                    
                    <div className="h-px bg-gray-100 my-1" />

                    {!categoriesLoading && categories.filter(c => c.isActive).map(cat => {
                      const isActive = filters.categoryId === cat.id;
                      return (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => {
                            updateFilters({ categoryId: isActive ? undefined : cat.id });
                            setShowCategoryDropdown(false);
                          }}
                          className={`w-full flex items-center justify-between px-4 py-2 text-left text-[13px] font-semibold transition-all cursor-pointer border-none bg-transparent ${isActive
                            ? 'text-[#4a7f1a] bg-green-50/50'
                            : 'text-slate-600 hover:bg-slate-50'
                            }`}
                        >
                          <span>{cat.displayName}</span>
                          {isActive && <Check size={14} strokeWidth={2.5} className="text-[#72B626]" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right section: Search Bar with Autocomplete */}
          <div ref={searchContainerRef} className="relative z-40 w-full sm:w-[280px]">
            <form onSubmit={handleSearch} className="relative">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 z-10" strokeWidth={2.5} />
              {suggestionsLoading && (
                <Loader2 size={14} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-green-500 animate-spin z-10" strokeWidth={2.5} />
              )}
              <input
                ref={inputRef}
                type="text"
                value={searchInput}
                onChange={e => {
                  setSearchInput(e.target.value);
                  if (!e.target.value.trim()) setShowSuggestions(false);
                }}
                onFocus={() => {
                  if (suggestions.length > 0 && searchInput.trim().length >= 2) setShowSuggestions(true);
                }}
                onKeyDown={handleSearchKeyDown}
                placeholder="Buscar campañas..."
                className="w-full pl-9 pr-8 py-2 rounded-xl bg-white border border-gray-300 text-[13px] outline-none focus:border-[#72B626] focus:ring-2 focus:ring-[#72B626]/10 placeholder:text-gray-400 shadow-sm"
                autoComplete="off"
                role="combobox"
                aria-expanded={showSuggestions}
                aria-haspopup="listbox"
                style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
              />
            </form>

            {/* ── Suggestions Dropdown ── */}
            {showSuggestions && (
              <div
                className="absolute top-full right-0 w-[320px] md:w-[380px] mt-2 bg-white/98 backdrop-blur-xl rounded-2xl shadow-2xl shadow-black/15 border border-green-100/50 overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200"
                role="listbox"
              >
                {suggestions.length === 0 && !suggestionsLoading ? (
                  <div className="px-5 py-6 text-center">
                    <Search size={24} className="text-slate-300 mx-auto mb-2" strokeWidth={1.5} />
                    <p className="text-[13px] font-bold text-slate-400">No se encontraron campañas</p>
                    <p className="text-[11px] text-slate-300 mt-1">Intenta con otros términos de búsqueda</p>
                  </div>
                ) : (
                  <>
                    <div className="px-4 py-2.5 border-b border-slate-50 flex items-center justify-between">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        Sugerencias
                      </span>
                      <span className="text-[10px] font-bold text-slate-300">
                        {suggestions.length} resultado{suggestions.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                    {suggestions.map((s, idx) => {
                      const progress = s.goalAmount > 0
                        ? Math.min(Math.round((s.currentAmount / s.goalAmount) * 100), 100)
                        : 0;
                      const thumbUrl = getImageUrl(s.coverImageUrl);
                      const isSelected = idx === selectedIndex;

                      return (
                        <button
                          key={s.id}
                          type="button"
                          role="option"
                          aria-selected={isSelected}
                          className={`w-full flex items-center gap-3.5 px-4 py-3 text-left transition-all cursor-pointer border-none ${isSelected
                            ? 'bg-green-50/80'
                            : 'bg-transparent hover:bg-slate-50/80'
                            }`}
                          onClick={() => handleSuggestionClick(s.id)}
                          onMouseEnter={() => setSelectedIndex(idx)}
                        >
                          {/* Thumbnail */}
                          <div className="w-14 h-14 rounded-xl overflow-hidden bg-gradient-to-br from-[#1c2b1e] to-[#72B626] shrink-0 shadow-sm">
                            {thumbUrl ? (
                              <img src={thumbUrl} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <Rocket size={20} strokeWidth={1} className="text-white/30" />
                              </div>
                            )}
                          </div>

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <p className="text-[14px] font-black text-[#1c2b1e] truncate leading-tight">
                              {s.title}
                            </p>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-[10px] font-black text-white bg-[#72B626]/80 px-2 py-0.5 rounded-md uppercase tracking-wider">
                                {s.categoryName}
                              </span>
                              <span className="text-[11px] font-medium text-slate-400 truncate">
                                por {s.entrepreneurDisplayName ? `@${s.entrepreneurDisplayName}` : s.entrepreneurName}
                              </span>
                            </div>
                            {/* Mini progress bar */}
                            <div className="flex items-center gap-2 mt-1.5">
                              <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                <div
                                  className="h-full rounded-full"
                                  style={{
                                    width: `${progress}%`,
                                    background: progress >= 100
                                      ? 'linear-gradient(90deg, #f9a825, #ff6f00)'
                                      : 'linear-gradient(90deg, #a8d97c, #72B626)',
                                  }}
                                />
                              </div>
                              <span className="text-[10px] font-black text-[#72B626] shrink-0">
                                {progress}%
                              </span>
                            </div>
                          </div>

                          {/* Arrow indicator */}
                          <ArrowRight size={14} strokeWidth={2.5} className={`shrink-0 transition-all ${isSelected ? 'text-[#72B626] translate-x-0.5' : 'text-slate-300'
                            }`} />
                        </button>
                      );
                    })}

                    {/* "Ver todos" footer */}
                    <button
                      type="button"
                      className="w-full px-4 py-3 text-center border-t border-slate-50 text-[12px] font-black text-[#72B626] uppercase tracking-widest hover:bg-green-50/50 transition-all cursor-pointer border-x-0 border-b-0 bg-transparent flex items-center justify-center gap-2"
                      onClick={() => {
                        setShowSuggestions(false);
                        updateFilters({ q: searchInput || undefined });
                      }}
                    >
                      <Search size={13} strokeWidth={2.5} />
                      Ver todos los resultados
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

        </div>
      </div>

      {/* Campaign Grid */}
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-10">

        {/* Novedades / Stories bar */}
        <StoriesAvatarBar style={{ marginBottom: '32px' }} />

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="bg-white rounded-[28px] shadow-sm border border-green-50 overflow-hidden flex flex-col animate-pulse"
              >
                {/* Cover image skeleton */}
                <div className="h-48 bg-slate-200 relative">
                  <div className="absolute top-4 left-4 w-20 h-6 bg-slate-300 rounded-xl" />
                  <div className="absolute top-4 right-4 w-24 h-6 bg-slate-300 rounded-xl" />
                  <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-slate-300" />
                </div>

                {/* Content skeleton */}
                <div className="p-6 flex-1 flex flex-col gap-4">
                  {/* Entrepreneur avatar + name */}
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-slate-200 shrink-0" />
                    <div className="w-28 h-3 bg-slate-200 rounded-full" />
                  </div>

                  {/* Title */}
                  <div className="space-y-2">
                    <div className="h-4 bg-slate-200 rounded-full w-[85%]" />
                    <div className="h-4 bg-slate-200 rounded-full w-[55%]" />
                  </div>

                  {/* Description */}
                  <div className="space-y-2 flex-1">
                    <div className="h-3 bg-slate-100 rounded-full w-full" />
                    <div className="h-3 bg-slate-100 rounded-full w-[70%]" />
                  </div>

                  {/* Amount + progress bar */}
                  <div>
                    <div className="flex justify-between items-baseline mb-2">
                      <div className="h-5 w-28 bg-slate-200 rounded-full" />
                      <div className="h-3 w-20 bg-slate-100 rounded-full" />
                    </div>
                    <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-slate-200 rounded-full w-[45%]" />
                    </div>
                  </div>

                  {/* Stats row */}
                  <div className="flex items-center justify-between pt-2 border-t border-slate-50">
                    <div className="h-3 w-14 bg-slate-200 rounded-full" />
                    <div className="h-3 w-24 bg-slate-100 rounded-full" />
                    <div className="h-3 w-16 bg-slate-100 rounded-full" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-100 rounded-[24px] p-6 text-center max-w-md mx-auto my-20 shadow-sm">
            <AlertCircle size={32} className="text-red-400 mx-auto mb-4" strokeWidth={2} />
            <p className="text-red-700 font-bold text-[15px]">{error}</p>
          </div>
        ) : campaigns.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 gap-6">
            <div className="w-20 h-20 bg-white rounded-[28px] shadow-sm flex items-center justify-center text-emerald-200">
              <FolderOpen size={40} strokeWidth={1} />
            </div>
            <h3 className="text-2xl font-black text-[#1c2b1e] tracking-tight uppercase">Sin Resultados</h3>
            <p className="text-slate-400 font-medium text-[15px] max-w-[360px] text-center leading-relaxed">
              No hay campañas que coincidan con tus filtros. Intenta con otra búsqueda o cambia los filtros.
            </p>
            <button
              onClick={() => {
                setSearchInput('');
                updateFilters({ q: undefined, campaignType: undefined, categoryId: undefined });
              }}
              className="text-[#72B626] font-black text-[13px] uppercase tracking-widest hover:underline cursor-pointer border-none bg-transparent"
            >
              Limpiar filtros
            </button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
              {campaigns.map(campaign => (
                <CampaignCard key={campaign.id} campaign={campaign} onClick={() => handleCardClick(campaign.id)} />
              ))}
            </div>

            {/* Pagination */}
            {meta && meta.totalPages > 1 && (
              <div className="flex items-center justify-center gap-3 mt-14">
                <button
                  onClick={() => goToPage(meta.currentPage - 1)}
                  disabled={meta.currentPage <= 1}
                  className="w-12 h-12 bg-white rounded-xl shadow-sm border border-green-50 flex items-center justify-center text-slate-400 hover:bg-green-50 hover:text-[#72B626] transition-all active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer border-none"
                >
                  <ChevronLeft size={20} strokeWidth={2.5} />
                </button>

                {Array.from({ length: meta.totalPages }, (_, i) => i + 1)
                  .filter(p => p === 1 || p === meta.totalPages || Math.abs(p - meta.currentPage) <= 2)
                  .map((page, idx, arr) => (
                    <span key={page} className="flex items-center gap-1">
                      {idx > 0 && arr[idx - 1] !== page - 1 && (
                        <span className="text-slate-300 font-bold px-1">…</span>
                      )}
                      <button
                        onClick={() => goToPage(page)}
                        className={`w-12 h-12 rounded-xl font-black text-[14px] transition-all active:scale-95 cursor-pointer border-none ${page === meta.currentPage
                          ? 'bg-[#72B626] text-white shadow-lg shadow-green-500/20'
                          : 'bg-white text-slate-500 hover:bg-green-50 hover:text-[#72B626] shadow-sm'
                          }`}
                      >
                        {page}
                      </button>
                    </span>
                  ))}

                <button
                  onClick={() => goToPage(meta.currentPage + 1)}
                  disabled={meta.currentPage >= meta.totalPages}
                  className="w-12 h-12 bg-white rounded-xl shadow-sm border border-green-50 flex items-center justify-center text-slate-400 hover:bg-green-50 hover:text-[#72B626] transition-all active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer border-none"
                >
                  <ChevronRight size={20} strokeWidth={2.5} />
                </button>
              </div>
            )}
          </>
        )}
      </div>
      <Footer />
    </div>
  );
}
