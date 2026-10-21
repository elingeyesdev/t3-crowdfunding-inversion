import type { InvestorProfile } from '../../types/investor.types';
import { 
  MapPin, 
  FileText, 
  Link2, 
  Home, 
  Globe, 
  Scale, 
  Pencil, 
  ChevronRight,
  ShieldCheck,
  ShieldAlert,
  Shield,
  Target,
  TrendingUp,
} from 'lucide-react';

type ModalType = 'profile' | 'fiscal' | 'address' | 'investment' | 'avatar' | null;

interface Props {
  profile: InvestorProfile | null;
  openModal: (type: ModalType) => void;
  userEmail?: string;
  onDeleteProfile?: () => void | Promise<void>;
}

const INVESTOR_TYPE_LABELS: Record<string, string> = {
  individual: 'Individual',
  institutional: 'Institucional',
  angel: 'Ángel',
};

export function ProfileSidebar({ profile, openModal, userEmail, onDeleteProfile: _onDeleteProfile }: Props) {
  const fields = [
    { label: 'Información básica', value: profile?.firstName && profile?.lastName && profile?.bio, modal: 'profile' },
    { label: 'Datos fiscales', value: profile?.taxId, modal: 'fiscal' },
    { label: 'Ubicación', value: profile?.addressLine1 && profile?.country, modal: 'address' },
    { label: 'Preferencias de donación', value: profile?.minInvestment || profile?.maxInvestment, modal: 'investment' },
    { label: 'Foto de perfil', value: profile?.avatarUrl, modal: 'avatar' },
  ];
  
  const filledCount = fields.filter(f => f.value).length;
  const percentage = Math.round((filledCount / fields.length) * 100) || 0;
  const nextStep = fields.find(f => !f.value);

  const cardClass = "bg-white rounded-[28px] shadow-sm border border-gray-100 p-6 animate-in fade-in slide-in-from-bottom-4 duration-300 group transition-all hover:shadow-xl hover:-translate-y-1 overflow-hidden relative";
  const sectionTitle = "text-[15px] font-black text-[#1c2b1e] flex items-center justify-between gap-2 uppercase tracking-widest";
  const iconBox = "w-10 h-10 bg-[#f0f9e0] text-[#72B626] rounded-xl flex items-center justify-center shrink-0 border border-gray-100 transition-all group-hover:scale-110";
  const editBtn = "w-9 h-9 bg-slate-50 hover:bg-[#f0f9e0] text-slate-400 hover:text-[#72B626] rounded-xl flex items-center justify-center cursor-pointer transition-all border-none active:scale-95";

  return (
    <div className="w-full lg:w-[360px] shrink-0 flex flex-col gap-6 font-['Plus Jakarta Sans',sans-serif] lg:sticky lg:top-[140px] self-start">
      
      {/* Profile completeness */}
      {percentage < 100 && (
        <div className={`${cardClass} border-l-[6px] border-l-[#72B626]`}>
          <div className="absolute top-0 right-0 w-24 h-24 bg-[#f0f9e0] rounded-full blur-3xl -mr-12 -mt-12 opacity-50"></div>
          <div className={sectionTitle}>
             Proceso de Perfil
            <span className="text-[14px] text-[#72B626] font-black">{percentage}%</span>
          </div>
          <div className="mt-4 h-2.5 bg-slate-100 rounded-full overflow-hidden shadow-inner relative z-10">
            <div 
              className="h-full bg-gradient-to-r from-[#a8d97c] to-[#72B626] rounded-full transition-all duration-1000 ease-out shadow-[0_0_8px_rgba(46,125,50,0.3)]" 
              style={{ width: `${percentage}%` }}
            ></div>
          </div>
          {nextStep && (
            <button 
              className="mt-5 w-full text-center py-3 text-[13px] text-[#72B626] font-black bg-[#f0f9e0] border border-gray-100 rounded-xl hover:bg-[#72B626] hover:text-white transition-all flex items-center justify-center gap-2 group/btn relative z-10 cursor-pointer" 
              onClick={() => openModal(nextStep.modal as any)}
            >
              Siguiente: {nextStep.label}
              <ChevronRight size={14} className="group-hover/btn:translate-x-1 transition-transform" strokeWidth={3} />
            </button>
          )}
        </div>
      )}

      {/* Bio & Type */}
      <div className={`${cardClass} hidden lg:block`}>
        <div className="flex justify-between items-center mb-6">
          <span className="text-[16px] font-black text-[#1c2b1e] uppercase tracking-widest">Biografía & Perfil</span>
          <button onClick={() => openModal('profile')} className={editBtn} title="Editar">
            <Pencil size={14} strokeWidth={2.5} />
          </button>
        </div>
        
        <div className="flex flex-col gap-5">
          <div className="flex items-center gap-4 text-[#1c2b1e] text-[14px]">
            <div className={iconBox}><Shield size={18} strokeWidth={2.5} /></div>
            <span className="font-bold text-[#72B626]">
              {profile?.investorType ? INVESTOR_TYPE_LABELS[profile.investorType] : 'Tipo no definido'}
              {profile?.accredited && (
                <span className="ml-2 bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-widest">Acreditado</span>
              )}
            </span>
          </div>

          <div className="flex items-center gap-4 text-[#1c2b1e] text-[14px]">
            <div className={iconBox}><MapPin size={18} strokeWidth={2.5} /></div>
            <span className="font-bold text-slate-700">{profile?.city && profile?.state ? `${profile.city}, ${profile.state}` : 'Ubicación no especificada'}</span>
          </div>
          
          <div className="flex items-start gap-4 text-[#1c2b1e] text-[14px]">
            <div className={iconBox}><FileText size={18} strokeWidth={2.5} /></div>
            <span className="font-medium text-slate-500 line-clamp-3 leading-relaxed">
              {profile?.bio || <span className="text-slate-300 italic font-normal">Trayectoria profesional no detallada.</span>}
            </span>
          </div>
        </div>
      </div>

      {/* Investment Preferences */}
      <div className={`${cardClass} hidden lg:block`}>
        <div className="flex justify-between items-center mb-6">
          <span className="text-[16px] font-black text-[#1c2b1e] uppercase tracking-widest">Capital & Límites</span>
          <button onClick={() => openModal('investment')} className={editBtn}>
            <Pencil size={14} strokeWidth={2.5} />
          </button>
        </div>
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-4 text-[#1c2b1e] text-[14px]">
            <div className={iconBox}>
               <TrendingUp size={18} strokeWidth={2.5} />
            </div>
            <div className="min-w-0">
              <div className="font-black truncate text-slate-900">
                Rango: {profile?.minInvestment ? `Bs. ${profile.minInvestment.toLocaleString('es-BO')}` : '—'} — {profile?.maxInvestment ? `Bs. ${profile.maxInvestment.toLocaleString('es-BO')}` : '—'}
              </div>
              <div className="text-[12px] text-slate-400 font-bold tracking-widest mt-0.5">
                Mín / Máx de donación
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Address */}
      <div className={`${cardClass} hidden lg:block`}>
        <div className="flex justify-between items-center mb-6">
          <span className="text-[16px] font-black text-[#1c2b1e] uppercase tracking-widest">Ubicación Legal</span>
          <button onClick={() => openModal('address')} className={editBtn}>
            <Pencil size={14} strokeWidth={2.5} />
          </button>
        </div>
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-4 text-[#1c2b1e] text-[14px]">
            <div className={iconBox}><Home size={18} strokeWidth={2.5} /></div>
            <span className="font-bold text-slate-700 truncate">{profile?.addressLine1 || 'Dirección no especificada'}</span>
          </div>
          <div className="flex items-center gap-4 text-[#1c2b1e] text-[14px]">
            <div className={iconBox}><Globe size={18} strokeWidth={2.5} /></div>
            <span className="font-bold text-slate-700">
              {profile?.country ? `${profile.country} · CP ${profile.postalCode || '-'}` : 'Región no especificada'}
            </span>
          </div>
        </div>
      </div>


      {userEmail && (
        <div className="hidden lg:flex px-6 py-4 bg-white border border-gray-100 rounded-[20px] shadow-sm items-center gap-3">
           <div className="w-8 h-8 rounded-lg bg-[#f0f9e0] flex items-center justify-center text-[#72B626]">
              <Link2 size={14} strokeWidth={2.5} />
           </div>
           <div className="min-w-0">
              <div className="text-[10px] font-black text-slate-300 uppercase tracking-widest leading-none mb-1">CUENTA VINCULADA</div>
              <div className="text-[12px] font-bold text-slate-600 truncate">{userEmail}</div>
           </div>
        </div>
      )}
    </div>
  );
}
