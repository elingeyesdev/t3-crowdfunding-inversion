import type { EntrepreneurProfile } from '../../types/entrepreneur.types';
import { 
  MapPin, 
  FileText, 
  Link2, 
  Building2, 
  Home, 
  Globe, 
  Scale, 
  Pencil, 
  ChevronRight,
  ShieldCheck,
  ShieldAlert,
  Trash2,
} from 'lucide-react';

type ModalType = 'profile' | 'personal' | 'company' | 'address' | 'banking' | 'avatar' | 'new-campaign' | 'kyc' | null;

interface Props {
  profile: EntrepreneurProfile | null;
  openModal: (type: ModalType) => void;
  userEmail?: string;
  /** Eliminar solo datos de emprendedor (no la cuenta). */
  onDeleteProfile?: () => void | Promise<void>;
}

export function ProfileSidebar({ profile, openModal, userEmail, onDeleteProfile }: Props) {
  // Calculate completion percentage based on key fields
  const fields = [
    { label: 'Información básica', value: profile?.firstName && profile?.lastName && profile?.bio, modal: 'profile' },
    { label: 'Empresa', value: profile?.companyName && profile?.website, modal: 'company' },
    { label: 'Ubicación', value: profile?.addressLine && profile?.country, modal: 'address' },
    { label: 'Datos bancarios', value: profile?.bankAccountNumber, modal: 'banking' },
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
    <div className="flex flex-col w-full lg:w-[360px] shrink-0 gap-6 font-['Plus Jakarta Sans',sans-serif] lg:sticky lg:top-[140px] self-start">
      
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
              className="h-full bg-gradient-to-r from-[#aed581] to-[#72B626] rounded-full transition-all duration-1000 ease-out shadow-[0_0_8px_rgba(46,125,50,0.3)]" 
              style={{ width: `${percentage}%` }}
            ></div>
          </div>
          {nextStep && (
            <button 
              className="mt-5 w-full text-center py-3 text-[13px] text-[#72B626] font-black bg-[#f0f9e0] border border-gray-100 rounded-xl hover:bg-[#72B626] hover:text-white transition-all flex items-center justify-center gap-2 group/btn relative z-10" 
              onClick={() => openModal(nextStep.modal as any)}
            >
              Siguiente: {nextStep.label}
              <ChevronRight size={14} className="group-hover/btn:translate-x-1 transition-transform" strokeWidth={3} />
            </button>
          )}
        </div>
      )}

      {/* Personal data */}
      <div className={`${cardClass} hidden lg:block`}>
        <div className="flex justify-between items-center mb-6">
          <span className="text-[16px] font-black text-[#1c2b1e] uppercase tracking-widest">Biografía & Social</span>
          <button onClick={() => openModal('personal')} className={editBtn} title="Editar">
            <Pencil size={14} strokeWidth={2.5} />
          </button>
        </div>
        
        <div className="flex flex-col gap-5">
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
          
          <div className="flex items-center gap-4 text-[#1c2b1e] text-[14px]">
            <div className={iconBox}><Link2 size={18} strokeWidth={2.5} /></div>
            {profile?.linkedinUrl ? (
              <a href={profile.linkedinUrl} target="_blank" rel="noreferrer" className="text-[#72B626] font-black hover:underline truncate transition-colors no-underline">
                {profile.linkedinUrl.replace(/https?:\/\/(www\.)?/, '')}
              </a>
            ) : (
              <span className="text-slate-300 font-normal italic">LinkedIn no vinculado</span>
            )}
          </div>
        </div>
      </div>

      {/* Company */}
      <div className={`${cardClass} hidden lg:block`}>
        <div className="flex justify-between items-center mb-6">
          <span className="text-[16px] font-black text-[#1c2b1e] uppercase tracking-widest">Startup / Empresa</span>
          <button onClick={() => openModal('company')} className={editBtn}>
            <Pencil size={14} strokeWidth={2.5} />
          </button>
        </div>
        <div className="flex items-center gap-4 text-[#1c2b1e] text-[14px]">
          <div className={iconBox}>
             <Building2 size={18} strokeWidth={2.5} />
          </div>
          <div className="min-w-0">
            <div className="font-black truncate text-slate-900">{profile?.companyName || 'Sin Empresa Vinculada'}</div>
            {profile?.website && (
              <a href={profile.website} target="_blank" rel="noreferrer" className="text-[12px] text-[#72B626] font-black hover:underline truncate block no-underline mt-0.5">
                {profile.website.replace(/https?:\/\/(www\.)?/, '')}
              </a>
            )}
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
            <span className="font-bold text-slate-700 truncate">{profile?.addressLine || 'Dirección no especificada'}</span>
          </div>
          <div className="flex items-center gap-4 text-[#1c2b1e] text-[14px]">
            <div className={iconBox}><Globe size={18} strokeWidth={2.5} /></div>
            <span className="font-bold text-slate-700">
              {profile?.country ? `${profile.country} · CP ${profile.postalCode || '-'}` : 'Región no especificada'}
            </span>
          </div>
        </div>
      </div>

      {/* Banking Data */}
      <div className={`${cardClass} hidden lg:block`}>
        <div className="flex justify-between items-center mb-6">
          <span className="text-[16px] font-black text-[#1c2b1e] uppercase tracking-widest">Datos Bancarios</span>
          <button onClick={() => openModal('banking')} className={editBtn}>
            <Pencil size={14} strokeWidth={2.5} />
          </button>
        </div>
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-4 text-[#1c2b1e] text-[14px]">
            <div className={iconBox}><Building2 size={18} strokeWidth={2.5} /></div>
            <div className="min-w-0">
               <div className="font-black text-slate-900 truncate uppercase tracking-tight">{profile?.bankName || 'Banco no configurado'}</div>
               <div className="text-[12px] text-slate-400 font-bold tracking-widest mt-1">
                  {profile?.bankAccountNumber 
                    ? `**** **** ${profile.bankAccountNumber.slice(-4)}` 
                    : 'Cuenta no vinculada'}
               </div>
            </div>
          </div>
        </div>
      </div>

      {/* Identity verification */}
      <div className={`rounded-[28px] p-6 shadow-sm ring-1 group transition-all hover:shadow-lg ${profile?.identityVerified ? 'bg-[#f0f9e0]/50 ring-[#f0f9e0]' : 'bg-slate-50/50 ring-slate-100 hover:ring-slate-200'}`}>
        <div className="flex justify-between items-center mb-5">
          <span className="text-[15px] font-black text-[#1c2b1e] uppercase tracking-widest leading-none">Status de Revisión</span>
        </div>
        
        {profile?.identityVerified ? (
          <div className="flex flex-col gap-5">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-white border border-gray-100 rounded-2xl flex items-center justify-center text-[#72B626] shadow-sm shrink-0">
                 <ShieldCheck size={24} strokeWidth={2.5} />
              </div>
              <div className="min-w-0">
                <div className="font-black text-[#1c2b1e] text-[14px] leading-tight mb-1 uppercase tracking-tight">Identidad Certificada</div>
                {profile.identityVerifiedAt && (
                  <div className="text-[11px] text-[#72B626] font-black uppercase tracking-tighter opacity-70">Sincronizado {new Date(profile.identityVerifiedAt).toLocaleDateString()}</div>
                )}
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              <span className="bg-white border border-gray-100 text-[#72B626] px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-xs flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-[#72B626] rounded-full animate-pulse"></div> Check KYC
              </span>
              <span className="bg-white border border-gray-100 text-[#72B626] px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-xs flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-[#72B626] rounded-full animate-pulse"></div> Biometría
              </span>
            </div>
          </div>
        ) : profile?.kycStatus === 'pending' ? (
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-white border border-amber-100 rounded-2xl flex items-center justify-center text-amber-500 shadow-sm shrink-0">
                 <ShieldAlert size={24} strokeWidth={2.5} />
              </div>
              <div className="min-w-0">
                <div className="font-black text-slate-700 text-[14px] leading-tight mb-1 uppercase tracking-tight">Verificación en Proceso</div>
                <div className="text-[11px] text-slate-400 font-bold leading-tight">Tus documentos están siendo revisados por el equipo.</div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-white border border-red-50 rounded-2xl flex items-center justify-center text-[#f9a825] shadow-sm shrink-0">
                 <Scale size={24} strokeWidth={2.5} />
              </div>
              <div className="min-w-0">
                <div className="font-black text-slate-700 text-[14px] leading-tight mb-1 uppercase tracking-tight">Verificación Requerida</div>
                <div className="text-[11px] text-slate-400 font-bold leading-tight">Envía tus documentos para proteger tu cuenta y habilitar recaudación.</div>
              </div>
            </div>
            {profile?.kycStatus === 'rejected' && profile?.kycRejectionReason && (
              <div className="mt-2 p-3 bg-red-50 border border-red-100 rounded-xl text-xs text-red-700">
                <div className="font-bold uppercase mb-1">Motivo de rechazo:</div>
                <div className="leading-snug">{profile.kycRejectionReason}</div>
              </div>
            )}
            <button 
              onClick={() => openModal('kyc')}
              className="w-full mt-2 py-3.5 bg-[#f9a825] hover:bg-[#c62828] text-white font-black rounded-xl transition-all text-[12px] uppercase tracking-widest shadow-lg shadow-amber-500/20 active:scale-95 border-none cursor-pointer flex items-center justify-center gap-2"
            >
              <ShieldAlert size={16} strokeWidth={3} />
              Iniciar Verificación
            </button>
          </div>
        )}
      </div>
      {userEmail && (
        <div className="hidden lg:flex px-6 py-4 bg-white border border-gray-100 rounded-[20px] shadow-sm items-center gap-3">
           <div className="w-8 h-8 rounded-lg bg-[#f0f9e0] flex items-center justify-center text-[#72B626]">
              <Link2 size={14} strokeWidth={2.5} />
           </div>
           <div className="min-w-0">
              <div className="text-[10px] font-black text-slate-300 uppercase tracking-widest leading-none mb-1">REVISOR LÍDER</div>
              <div className="text-[12px] font-bold text-slate-600 truncate">{userEmail}</div>
           </div>
        </div>
      )}
    </div>
  );
}
