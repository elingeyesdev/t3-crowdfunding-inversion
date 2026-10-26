import { useRef } from 'react';
import type { InvestorProfile } from '../../types/investor.types';
import { 
  MapPin, 
  Camera, 
  Pencil, 
  CheckCircle2,
  TrendingUp,
  Shield
} from 'lucide-react';

interface Props {
  profile: InvestorProfile | null;
  onEdit: (section: string) => void;
  uploadAvatar: (file: File) => Promise<void>;
  uploadCover: (file: File) => Promise<void>;
}

const INVESTOR_TYPE_LABELS: Record<string, string> = {
  individual: 'Donador Individual',
  institutional: 'Donador Institucional',
  angel: 'Donador Ángel',
};

export function ProfileHeader({ profile, onEdit, uploadAvatar, uploadCover }: Props) {
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  const initials = profile 
    ? (profile.firstName[0] + (profile.lastName?.[0] || '')).toUpperCase()
    : '??';

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await uploadAvatar(file);
    }
  };

  const handleCoverChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await uploadCover(file);
    }
  };

  return (
    <div className="relative mb-8 font-['Plus Jakarta Sans',sans-serif]">
      <input type="file" ref={avatarInputRef} className="hidden" accept="image/*" onChange={handleAvatarChange} />
      <input type="file" ref={coverInputRef} className="hidden" accept="image/*" onChange={handleCoverChange} />

      {/* COVER */}
      <div className="h-48 md:h-80 w-full bg-[#1c2b1e] relative overflow-hidden rounded-b-[32px] md:rounded-b-[40px] shadow-2xl flex items-center justify-center">
        <div className="absolute inset-0 opacity-40">
          <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-[#72B626] rounded-full blur-[120px]"></div>
          <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-[#72B626] rounded-full blur-[120px]"></div>
        </div>
        
        {profile?.coverUrl ? (
          <div className="absolute inset-0 z-10 transition-opacity duration-700" style={{ backgroundImage: `url(${profile.coverUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
        ) : (
          <div className="relative z-10 flex flex-col items-center gap-2 text-white/20">
             <TrendingUp size={48} strokeWidth={1} />
             <span className="text-[10px] font-black uppercase tracking-[0.2em]">Perfil Corporativo</span>
          </div>
        )}

        <button onClick={() => coverInputRef.current?.click()} className="absolute bottom-6 right-8 bg-white/10 backdrop-blur-md hover:bg-white/20 text-white border border-white/20 px-4 py-2 rounded-xl text-[12px] font-bold transition-all active:scale-95 flex items-center gap-2 z-20 cursor-pointer">
          <Camera size={14} strokeWidth={2.5} /> Actualizar Portada
        </button>
      </div>

      {/* ── AVATAR & INFO CORE ───────────────────────────── */}
      <div className="max-w-[1100px] mx-auto px-4 sm:px-8">
        <div className="relative -mt-20 flex flex-col md:flex-row items-center md:items-end gap-4 md:gap-8">

          {/* Avatar con Anillo de Estatus */}
          <div className="relative group">
            <div className="w-24 h-24 md:w-40 md:h-40 rounded-[32px] md:rounded-[48px] border-4 md:border-[6px] border-[#f4f7f4] bg-white shadow-2xl overflow-hidden flex items-center justify-center relative z-10">
              {profile?.avatarUrl ? (
                <div
                  className="w-full h-full transition-opacity duration-500"
                  style={{
                    backgroundImage: `url(${profile.avatarUrl})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center'
                  }}
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-tr from-[#1c2b1e] to-[#72B626] flex items-center justify-center text-3xl md:text-4xl font-black text-white">
                  {initials}
                </div>
              )}
            </div>

            {/* Cámara hover avatar */}
            <button
              onClick={() => avatarInputRef.current?.click()}
              className="absolute inset-0 z-20 bg-[#1c2b1e]/60 text-white opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2 rounded-[48px] cursor-pointer border-none"
            >
              <Camera size={24} strokeWidth={2.5} />
              <span className="text-[10px] font-black uppercase tracking-widest">Cambiar</span>
            </button>

            {/* Verificado Badge */}
            {profile?.identityVerified && (
              <div className="absolute -right-2 -bottom-2 z-30 bg-white p-1.5 rounded-2xl shadow-lg">
                <div className="bg-[#72B626] text-white p-1 rounded-lg">
                  <CheckCircle2 size={18} strokeWidth={3} />
                </div>
              </div>
            )}
          </div>

          {/* Info Principal */}
          <div className="flex-1 pb-2 text-center md:text-left mt-2 md:mt-0">
            <div className="flex flex-col md:flex-row md:items-center justify-center md:justify-start gap-2 mb-3">
              <h1 className="text-3xl md:text-4xl font-black text-[#1c2b1e] tracking-tighter leading-none break-words">
                {profile ? `${profile.firstName} ${profile.lastName}` : 'Cargando Perfil...'}
              </h1>
              {profile?.displayName && (
                <span className="text-[14px] font-bold text-[#72B626] bg-[#f0f9e0] px-3 py-1 rounded-lg inline-block self-center md:self-auto">
                  @{profile.displayName}
                </span>
              )}
            </div>

            <div className="flex flex-wrap justify-center md:justify-start items-center gap-4 md:gap-6 text-slate-500">
              {profile?.investorType && (
                <div className="flex items-center gap-2 text-[13px] font-medium">
                  <Shield size={14} className="text-[#72B626]" />
                  <span className="text-[#72B626] font-bold">{INVESTOR_TYPE_LABELS[profile.investorType] || profile.investorType}</span>
                </div>
              )}

              {profile?.city && (
                <div className="flex items-center gap-2 text-[13px] font-medium">
                  <MapPin size={14} className="text-slate-400" />
                  {profile.city}{profile.country ? `, ${profile.country}` : ''}
                </div>
              )}

              {profile && (
                <div className="flex items-center gap-2 text-[13px] font-medium">
                  <TrendingUp size={14} className="text-[#72B626]" />
                  <span className="text-[#72B626] font-bold">{profile.totalInvestments} donaciones</span>
                </div>
              )}
            </div>
          </div>

          {/* Acciones de Edición */}
          <div className="flex gap-3 pb-2 w-full md:w-auto mt-4 md:mt-0 px-4 md:px-0">
            <button
              onClick={() => onEdit('profile')}
              className="flex-1 md:flex-none bg-white hover:bg-[#f0f9e0] text-slate-600 font-bold px-6 py-3 rounded-xl border border-gray-100 shadow-sm transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer text-[13px]"
            >
              <Pencil size={16} strokeWidth={2.5} />
              Editar Perfil
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
