import { useEffect, useState } from 'react';
import { getCategories } from '../api/categories.api';
import type { Category } from '../types/category.types';
import { 
  Cpu, 
  Stethoscope, 
  GraduationCap, 
  Leaf, 
  Palette, 
  Handshake, 
  Utensils, 
  Shirt, 
  Gamepad2, 
  Building2, 
  Coins, 
  Sprout, 
  Car, 
  Radio, 
  Users, 
  Pin,
  Check,
  AlertCircle
} from 'lucide-react';

// Mapa de íconos por nombre de categoría
const CATEGORY_ICONS: Record<string, any> = {
  technology:   Cpu,
  health:       Stethoscope,
  education:    GraduationCap,
  environment:  Leaf,
  art:          Palette,
  social_impact:Handshake,
  food:         Utensils,
  fashion:      Shirt,
  gaming:       Gamepad2,
  real_estate:  Building2,
  fintech:      Coins,
  agriculture:  Sprout,
  mobility:     Car,
  media:        Radio,
  community:    Users,
};

interface Props {
  selected: string[];           // IDs de categorías seleccionadas
  onChange: (ids: string[]) => void;
}

export function CategorySelector({ selected, onChange }: Props) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getCategories()
      .then(setCategories)
      .catch(() => setError('No se pudieron cargar las categorías.'))
      .finally(() => setLoading(false));
  }, []);

  const toggle = (id: string) => {
    if (selected.includes(id)) {
      onChange(selected.filter((s) => s !== id));
    } else {
      onChange([...selected, id]);
    }
  };

  if (loading) {
    return (
      <div className="py-10 flex flex-col items-center justify-center gap-4">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-[#72B626] rounded-full animate-spin" />
        <span className="text-[11px] font-black uppercase text-slate-400 tracking-widest leading-none">Cargando sectores...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-100 text-[#c62828] p-4 rounded-xl text-[13px] font-bold flex items-center gap-2">
        <AlertCircle size={16} strokeWidth={2.5} /> {error}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 font-['Plus Jakarta Sans',sans-serif]">
      {/* Contador de seleccionados */}
      <p className="text-[13px] font-bold text-slate-500 uppercase tracking-tight ml-1">
        {selected.length === 0
          ? 'Selecciona los sectores de tu interés'
          : `${selected.length} sector${selected.length > 1 ? 'es' : ''} seleccionado${selected.length > 1 ? 's' : ''}`}
      </p>

      {/* Grid de chips */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {categories.map((cat) => {
          const isSelected = selected.includes(cat.id);
          const IconComponent = CATEGORY_ICONS[cat.name] ?? Pin;
          const chipColor = cat.color ?? '#72B626';
          
          return (
            <button
              key={cat.id}
              type="button"
              id={`cat-${cat.name}`}
              className={`
                flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 cursor-pointer border-[1.5px] shadow-sm active:scale-95 text-left group
                ${isSelected 
                  ? 'bg-white font-black text-[#1c2b1e] border-[#72B626] shadow-md translate-y-[-2px]' 
                  : 'bg-gray-50/50 border-gray-100 text-slate-500 hover:bg-white hover:border-[#72B626]'
                }
              `}
              onClick={() => toggle(cat.id)}
              aria-pressed={isSelected}
            >
              <span className={`transition-transform group-hover:scale-110 ${isSelected ? 'text-[#72B626]' : 'text-slate-400'}`}>
                 <IconComponent size={18} strokeWidth={isSelected ? 2.5 : 2} />
              </span>
              <span className="text-[11px] uppercase tracking-wider flex-1 truncate font-bold">{cat.displayName}</span>
              {isSelected && (
                <div 
                  className="w-4 h-4 rounded-full flex items-center justify-center text-white shrink-0"
                  style={{ backgroundColor: chipColor }}
                >
                  <Check size={10} strokeWidth={4} />
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
