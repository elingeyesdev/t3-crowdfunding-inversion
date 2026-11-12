import type { RewardTier } from '../../api/public-campaigns.api';
import {
  Check,
  Gift,
  Calendar,
  Users,
  Lock,
} from 'lucide-react';

interface RewardTierCardsProps {
  tiers: RewardTier[];
  selectedTierId: string | null;
  onSelect: (tierId: string) => void;
  disabled?: boolean;
}

export function RewardTierCards({
  tiers,
  selectedTierId,
  onSelect,
  disabled = false,
}: RewardTierCardsProps) {
  if (!tiers || tiers.length === 0) return null;

  return (
    <div className="bg-white rounded-[28px] shadow-sm border border-gray-100 p-8 md:p-10 mb-8">
      <h2 className="text-xl font-black text-[#1c2b1e] tracking-tight mb-2 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
          <Gift size={20} strokeWidth={2.5} className="text-amber-500" />
        </div>
        Niveles de Recompensa
      </h2>
      <p className="text-[13px] text-slate-400 font-medium mb-8 ml-[52px]">
        Selecciona un nivel para aportar y recibir tu recompensa
      </p>

      <div className="flex flex-col gap-4">
        {tiers.map((tier) => {
          const isSelected = selectedTierId === tier.id;
          const isSoldOut =
            tier.maxClaims !== null && tier.currentClaims >= tier.maxClaims;
          const isDisabled = disabled || isSoldOut;

          return (
            <button
              key={tier.id}
              type="button"
              onClick={() => !isDisabled && onSelect(tier.id)}
              disabled={isDisabled}
              className={`
                relative w-full text-left rounded-[20px] p-6 border-2 transition-all duration-300 cursor-pointer
                ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-lg hover:-translate-y-0.5 active:scale-[0.99]'}
                ${
                  isSelected
                    ? 'border-[#72B626] bg-[#f0f9e0]/50 shadow-lg shadow-[#72B626]/20/10 ring-1 ring-[#d4f0a0]'
                    : 'border-slate-100 bg-white hover:border-gray-100'
                }
              `}
              style={{ outline: 'none' }}
            >
              {/* Selected checkmark */}
              {isSelected && (
                <div className="absolute top-4 right-4 w-7 h-7 bg-[#72B626] rounded-full flex items-center justify-center shadow-lg shadow-[#72B626]/20/30 animate-[scale-in_0.2s_ease-out]">
                  <Check size={14} strokeWidth={3} className="text-white" />
                </div>
              )}

              {/* Sold out badge */}
              {isSoldOut && (
                <div className="absolute top-4 right-4 flex items-center gap-1.5 bg-slate-100 px-3 py-1.5 rounded-lg">
                  <Lock size={11} strokeWidth={3} className="text-slate-400" />
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    Agotada
                  </span>
                </div>
              )}

              {/* Amount badge */}
              <div className="flex items-baseline gap-2 mb-3">
                <span
                  className={`text-2xl font-black tracking-tighter ${
                    isSelected ? 'text-[#72B626]' : 'text-[#1c2b1e]'
                  }`}
                >
                  Bs. {tier.amount.toLocaleString('es-BO')}
                </span>
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                  {tier.currency || 'BOB'} o más
                </span>
              </div>

              {/* Title */}
              <h3
                className={`text-[15px] font-black mb-2 tracking-tight ${
                  isSelected ? 'text-[#72B626]' : 'text-[#1c2b1e]'
                }`}
              >
                <Gift
                  size={14}
                  strokeWidth={2.5}
                  className="inline mr-2 opacity-50"
                />
                {tier.title}
              </h3>

              {/* Description */}
              <p className="text-[13px] text-slate-500 leading-relaxed mb-4 pr-8">
                {tier.description}
              </p>

              {/* Footer: delivery + claims */}
              <div className="flex items-center gap-4 text-[11px] font-bold text-slate-400">
                {tier.estimatedDelivery && (
                  <div className="flex items-center gap-1.5">
                    <Calendar size={12} strokeWidth={2.5} />
                    <span>
                      Entrega:{' '}
                      {new Date(tier.estimatedDelivery).toLocaleDateString(
                        'es-BO',
                        { month: 'short', year: 'numeric' },
                      )}
                    </span>
                  </div>
                )}
                {tier.maxClaims !== null && (
                  <div className="flex items-center gap-1.5">
                    <Users size={12} strokeWidth={2.5} />
                    <span>
                      {tier.currentClaims}/{tier.maxClaims} reclamadas
                    </span>
                  </div>
                )}
                {tier.maxClaims === null && (
                  <div className="flex items-center gap-1.5">
                    <Users size={12} strokeWidth={2.5} />
                    <span>Ilimitada</span>
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
