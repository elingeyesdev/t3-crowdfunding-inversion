import { useState, useEffect, useRef, useMemo } from 'react';
import type { QueryCampaignsDto, CampaignFilterPreset } from '../types/campaign.types';
import { 
  Search, 
  SlidersHorizontal, 
  ChevronDown, 
  ChevronUp, 
  Zap, 
  MoveRight 
} from 'lucide-react';

const PRESETS: {
  id: CampaignFilterPreset;
  label: string;
  hint: string;
}[] = [
  { id: 'all', label: 'Todas', hint: 'Sin filtrar por estado' },
  { id: 'draft', label: 'Borradores', hint: 'Aún no publicadas' },
  { id: 'approval', label: 'En revisión', hint: 'Pendientes o en aprobación' },
  { id: 'published', label: 'Activas', hint: 'Publicadas o en curso' },
  { id: 'archived', label: 'Cerradas', hint: 'Finalizadas o rechazadas' },
];

const SORT_OPTIONS: {
  key: string;
  sortBy: QueryCampaignsDto['sortBy'];
  sortOrder: 'ASC' | 'DESC';
  label: string;
}[] = [
  { key: 'created_at__DESC', sortBy: 'created_at', sortOrder: 'DESC', label: 'Últimas creadas' },
  { key: 'created_at__ASC', sortBy: 'created_at', sortOrder: 'ASC', label: 'Más antiguas primero' },
  { key: 'end_date__ASC', sortBy: 'end_date', sortOrder: 'ASC', label: 'Cierran pronto' },
  { key: 'end_date__DESC', sortBy: 'end_date', sortOrder: 'DESC', label: 'Cierre más lejano' },
  { key: 'title__ASC', sortBy: 'title', sortOrder: 'ASC', label: 'Título A a Z' },
  { key: 'current_amount__DESC', sortBy: 'current_amount', sortOrder: 'DESC', label: 'Más recaudación' },
  { key: 'goal_amount__DESC', sortBy: 'goal_amount', sortOrder: 'DESC', label: 'Mayor meta' },
];

function sortKeyFromQuery(q: QueryCampaignsDto): string {
  const sb = q.sortBy ?? 'created_at';
  const so = q.sortOrder ?? 'DESC';
  const found = SORT_OPTIONS.find((o) => o.sortBy === sb && o.sortOrder === so);
  return found?.key ?? 'created_at__DESC';
}

interface Props {
  query: QueryCampaignsDto;
  onChange: (patch: Partial<QueryCampaignsDto>) => void;
}

export function CampaignFilters({ query, onChange }: Props) {
  const [searchDraft, setSearchDraft] = useState(query.search ?? '');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const presetActive = query.filterPreset ?? 'all';
  const sortSelectValue = sortKeyFromQuery(query);

  const hasExtraFilters = useMemo(() => {
    return (
      !!query.createdFrom ||
      !!query.createdTo ||
      !!query.endDateFrom ||
      !!query.endDateTo
    );
  }, [query.createdFrom, query.createdTo, query.endDateFrom, query.endDateTo]);

  const showClear = useMemo(() => {
    return (
      presetActive !== 'all' ||
      !!query.search?.trim() ||
      hasExtraFilters ||
      sortSelectValue !== 'created_at__DESC'
    );
  }, [presetActive, query.search, hasExtraFilters, sortSelectValue]);

  useEffect(() => {
    setSearchDraft(query.search ?? '');
  }, [query.search]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      const next = searchDraft.trim();
      const cur = (query.search ?? '').trim();
      if (next === cur) return;
      onChangeRef.current({ search: next || undefined, page: 1 });
    }, 400);
    return () => window.clearTimeout(t);
  }, [searchDraft, query.search]);

  const clearAll = () => {
    setSearchDraft('');
    onChange({
      filterPreset: 'all',
      search: undefined,
      createdFrom: undefined,
      createdTo: undefined,
      endDateFrom: undefined,
      endDateTo: undefined,
      sortBy: 'created_at',
      sortOrder: 'DESC',
      page: 1,
    });
  };

  const onSortChange = (key: string) => {
    const opt = SORT_OPTIONS.find((o) => o.key === key);
    if (!opt) return;
    onChange({ sortBy: opt.sortBy, sortOrder: opt.sortOrder, page: 1 });
  };

  const presetLabel = PRESETS.find((p) => p.id === presetActive)?.label ?? 'Todas';
  const sortLabel = SORT_OPTIONS.find((o) => o.key === sortSelectValue)?.label ?? '';

  const inputClass = "w-full border-gray-200 border-[1.5px] rounded-xl px-4 py-3 text-[14px] outline-none transition-all bg-gray-50/50 focus:bg-white focus:border-[#72B626] focus:ring-4 focus:ring-[#72B626]/10 placeholder:text-gray-400 font-medium";

  return (
    <section
      className="mb-8 font-['Plus Jakarta Sans',sans-serif] animate-in fade-in duration-500"
      aria-label="Filtros de campañas"
    >
      {!filtersOpen ? (
        <button
          type="button"
          className="w-full bg-white border border-gray-100/50 rounded-[24px] p-5 flex items-center gap-4 hover:shadow-lg hover:shadow-[#1c2b1e]/20/5 transition-all text-left shadow-sm group active:scale-[0.99] cursor-pointer"
          onClick={() => setFiltersOpen(true)}
          aria-expanded="false"
        >
          <div className="w-12 h-12 rounded-2xl bg-[#f0f9e0] flex items-center justify-center group-hover:scale-110 transition-all">
             <SlidersHorizontal className="text-[#72B626]" size={22} strokeWidth={2.5} />
          </div>
          <div className="flex-1">
            <span className="block text-[15px] font-black text-[#1c2b1e] tracking-tight">Panel de Control de Listado</span>
            <span className="block text-[12px] font-medium text-slate-400">Búsqueda avanzada, filtrado por estado y ordenamiento</span>
          </div>
          {showClear && (
            <span className="bg-[#f0f9e0] text-[#72B626] text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest mr-2 animate-pulse">
              Filtros Activos
            </span>
          )}
          <ChevronDown className="text-slate-300 group-hover:text-slate-500 transition-colors mr-2" size={20} />
        </button>
      ) : (
        <div className="bg-white border border-gray-100 rounded-[32px] p-8 shadow-xl shadow-[#1c2b1e]/20/5 relative overflow-hidden animate-in zoom-in-95 duration-300">
           {/* Decorative background element */}
           <div className="absolute top-0 right-0 w-32 h-32 bg-[#f0f9e0]/50 rounded-full blur-3xl -mr-16 -mt-16"></div>

           <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8 border-b border-gray-100 pb-8">
              <div>
                <h2 className="text-xl font-black text-[#1c2b1e] tracking-tight mb-1 flex items-center gap-3 leading-none">
                   <Zap className="text-[#72B626]" size={24} strokeWidth={2.5} /> 
                   Criterios de Visualización
                </h2>
                <p className="text-[13px] font-medium text-slate-400 leading-relaxed max-w-sm mt-2">
                   Personaliza el feed de campañas para encontrar exactamente lo que buscas.
                </p>
              </div>
              <div className="flex items-center gap-3">
                {showClear && (
                  <button type="button" className="bg-[#f0f9e0] hover:bg-[#f0f9e0] text-[#72B626] font-black px-5 py-2.5 rounded-xl transition-all active:scale-95 text-[13px] border-none cursor-pointer" onClick={clearAll}>
                    Limpiar Todo
                  </button>
                )}
                <button
                  type="button"
                  className="bg-[#72B626] hover:bg-[#1c2b1e] text-white font-black px-6 py-2.5 rounded-xl transition-all active:scale-95 text-[13px] border-none shadow-lg shadow-[#72B626]/20/20 cursor-pointer flex items-center gap-2"
                  onClick={() => setFiltersOpen(false)}
                >
                  Confirmar & Cerrar
                </button>
              </div>
           </div>

           <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
              {/* Columna Izquierda: Búsqueda y Estados */}
              <div className="flex flex-col gap-8">
                 <div className="flex flex-col gap-3">
                    <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1" htmlFor="campaign-search">
                       Búsqueda de Título
                    </label>
                    <div className="relative group">
                       <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                          <Search size={18} strokeWidth={2.5} />
                       </div>
                       <input
                          id="campaign-search"
                          type="search"
                          className={`${inputClass} pl-12`}
                          placeholder="Escribe el nombre de la campaña..."
                          value={searchDraft}
                          onChange={(e) => setSearchDraft(e.target.value)}
                          autoComplete="off"
                       />
                    </div>
                 </div>

                 <div className="flex flex-col gap-3">
                    <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1">
                       Segmentación por Estado
                    </label>
                    <div className="flex flex-wrap gap-2">
                       {PRESETS.map(({ id, label, hint }) => (
                          <button
                            key={id}
                            type="button"
                            className={`
                               px-4 py-2.5 rounded-xl text-[12px] font-black transition-all border-[1.5px] cursor-pointer
                               ${presetActive === id 
                                 ? 'bg-[#72B626] text-white border-[#72B626] shadow-md shadow-[#72B626]/20/20' 
                                 : 'bg-white text-slate-500 border-gray-100 hover:border-gray-100'
                               }
                            `}
                            onClick={() => onChange({ filterPreset: id, page: 1 })}
                            title={hint}
                            aria-pressed={presetActive === id}
                          >
                             {label}
                          </button>
                       ))}
                    </div>
                 </div>
              </div>

              {/* Columna Derecha: Orden y Fechas */}
              <div className="flex flex-col gap-8 bg-[#f0f9e0]/10 p-6 rounded-3xl border border-gray-100/50">
                 <div className="flex flex-col gap-3">
                    <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1">
                       Prioridad de Visualización
                    </label>
                    <select
                      className={inputClass}
                      value={sortSelectValue}
                      onChange={(e) => onSortChange(e.target.value)}
                    >
                      {SORT_OPTIONS.map((o) => (
                        <option key={o.key} value={o.key}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                 </div>

                 <div className="flex flex-col gap-4">
                    <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1">
                       Filtrado por Rango Temporal
                    </label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                       <div className="flex flex-col gap-2">
                          <span className="text-[10px] font-bold text-slate-400 ml-1 flex items-center gap-2">
                             Publicación desde 
                             <MoveRight size={12} strokeWidth={2} /> 
                             hasta
                          </span>
                          <div className="flex items-center gap-2">
                             <input
                                type="date"
                                className={`${inputClass} !py-2 !px-3 text-[12px]`}
                                value={query.createdFrom ?? ''}
                                onChange={(e) => onChange({ createdFrom: e.target.value || undefined, page: 1 })}
                             />
                             <input
                                type="date"
                                className={`${inputClass} !py-2 !px-3 text-[12px]`}
                                value={query.createdTo ?? ''}
                                onChange={(e) => onChange({ createdTo: e.target.value || undefined, page: 1 })}
                             />
                          </div>
                       </div>
                       <div className="flex flex-col gap-2">
                          <span className="text-[10px] font-bold text-slate-400 ml-1 flex items-center gap-2">
                             Cierre desde 
                             <MoveRight size={12} strokeWidth={2} /> 
                             hasta
                          </span>
                          <div className="flex items-center gap-2">
                             <input
                                type="date"
                                className={`${inputClass} !py-2 !px-3 text-[12px]`}
                                value={query.endDateFrom ?? ''}
                                onChange={(e) => onChange({ endDateFrom: e.target.value || undefined, page: 1 })}
                             />
                             <input
                                type="date"
                                className={`${inputClass} !py-2 !px-3 text-[12px]`}
                                value={query.endDateTo ?? ''}
                                onChange={(e) => onChange({ endDateTo: e.target.value || undefined, page: 1 })}
                             />
                          </div>
                       </div>
                    </div>
                 </div>
              </div>
           </div>

           <div className="mt-8 pt-6 border-t border-gray-100 flex items-center justify-between">
              <div className="text-[12px] font-medium text-slate-400">
                 Modo: <strong className="text-slate-900">{presetLabel}</strong> · 
                 Orden: <strong className="text-slate-900">{sortLabel}</strong>
                 {query.search?.trim() && <> · Búsqueda: <strong className="text-slate-900">"{query.search}"</strong></>}
              </div>
              <button 
                className="text-[13px] font-black text-[#72B626] hover:underline decoration-2 underline-offset-4 cursor-pointer border-none bg-transparent flex items-center gap-2"
                onClick={() => setFiltersOpen(false)}
              >
                <ChevronUp size={16} strokeWidth={2.5} />
                Colapsar panel
              </button>
           </div>
        </div>
      )}
    </section>
  );
}
