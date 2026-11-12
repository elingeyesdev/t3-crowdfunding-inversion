import { useRef } from 'react';
import type { EntrepreneurProfile } from '../../types/entrepreneur.types';
import {
  Building2,
  MapPin,
  Globe,
  Camera,
  Pencil,
  CheckCircle2
} from 'lucide-react';
import { getImageUrl } from '../../utils/image.utils';

interface Props {
  profile: EntrepreneurProfile | null;
  onEdit: (section: string) => void;
  uploadAvatar: (file: File) => Promise<void>;
  uploadCover: (file: File) => Promise<void>;
}

export function ProfileHeader({ profile, onEdit, uploadAvatar, uploadCover }: Props) {
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  // Iniciales si no hay imagen
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


  const coverUrl = getImageUrl(profile?.coverUrl);
  const avatarUrl = getImageUrl(profile?.avatarUrl);

  return (
    <div className="relative font-['Plus Jakarta Sans',sans-serif] lg:mb-8">
      {/* Inputs ocultos para subida */}
      <input
        type="file"
        ref={avatarInputRef}
        className="hidden"
        accept="image/*"
        onChange={handleAvatarChange}
      />
      <input
        type="file"
        ref={coverInputRef}
        className="hidden"
        accept="image/*"
        onChange={handleCoverChange}
      />

      {/* ── PORTADA / COVER ──────────────────────────────── */}
      <div className="mx-auto max-w-[1100px] px-0 sm:px-4 lg:max-w-none lg:px-0">
        <div className="h-40 sm:h-56 md:h-72 lg:h-80 w-full bg-[#1c2b1e] relative overflow-hidden sm:rounded-b-lg lg:rounded-b-[40px] lg:shadow-2xl flex items-center justify-center">
          <div className="absolute inset-0 bg-gradient-to-br from-[#203421] via-[#315d1e] to-[#72B626]" />

          {coverUrl ? (
            <div
              className="absolute inset-0 z-10 transition-opacity duration-700"
              style={{
                backgroundImage: `url(${coverUrl})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center'
              }}
            />
          ) : (
            <div className="relative z-10 flex flex-col items-center gap-2 text-white/70 lg:text-white/20">
              <Camera className="w-[34px] h-[34px] lg:w-12 lg:h-12" strokeWidth={1.5} />
              <span className="text-[11px] lg:text-[10px] font-bold lg:font-black uppercase lg:tracking-[0.2em]">Perfil corporativo</span>
            </div>
          )}

          {/* Botón editar portada */}
          <button
            onClick={() => coverInputRef.current?.click()}
            className="absolute bottom-3 right-3 sm:bottom-4 sm:right-4 lg:bottom-6 lg:right-8 bg-white/95 hover:bg-white lg:bg-white/10 lg:hover:bg-white/20 text-slate-700 lg:text-white border border-white/80 lg:border-white/20 px-3 lg:px-4 py-2 rounded-md lg:rounded-xl text-[12px] font-bold transition-all active:scale-95 flex items-center gap-2 z-20 cursor-pointer shadow-sm lg:backdrop-blur-md"
          >
            <Camera size={14} strokeWidth={2.5} />
            <span className="hidden sm:inline">Actualizar Portada</span>
          </button>
        </div>
      </div>

      {/* ── AVATAR & INFO CORE ───────────────────────────── */}
      <div className="max-w-[1100px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="relative -mt-12 sm:-mt-16 lg:-mt-20 flex flex-col sm:flex-row sm:items-end lg:items-end gap-3 sm:gap-5 lg:gap-8 border-b border-slate-200 lg:border-b-0 pb-4 lg:pb-0">

          {/* Avatar con Anillo de Estatus */}
          <div className="relative group self-start lg:self-auto">
            <div className="w-24 h-24 sm:w-32 sm:h-32 lg:w-40 lg:h-40 rounded-full lg:rounded-[48px] border-4 lg:border-[6px] border-white lg:border-[#f4f7f4] bg-white shadow-md lg:shadow-2xl overflow-hidden flex items-center justify-center relative z-10">
              {avatarUrl ? (
                <div
                  className="w-full h-full transition-opacity duration-500"
                  style={{
                    backgroundImage: `url(${avatarUrl})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center'
                  }}
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-tr from-[#1c2b1e] to-[#72B626] flex items-center justify-center text-2xl sm:text-4xl font-black text-white">
                  {initials}
                </div>
              )}
            </div>

            {/* Cámara hover avatar */}
            <button
              onClick={() => avatarInputRef.current?.click()}
              className="absolute inset-0 z-20 bg-[#1c2b1e]/60 text-white opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1 lg:gap-2 rounded-full lg:rounded-[48px] cursor-pointer border-none"
            >
              <Camera className="w-5 h-5 lg:w-6 lg:h-6" strokeWidth={2.5} />
              <span className="text-[10px] font-black uppercase lg:tracking-widest">Cambiar</span>
            </button>

            {/* Verificado Badge */}
            {profile?.identityVerified && (
              <div className="absolute right-0 bottom-1 lg:-right-2 lg:-bottom-2 z-30 bg-white p-1 lg:p-1.5 rounded-full lg:rounded-2xl shadow lg:shadow-lg">
                <div className="bg-[#72B626] text-white p-1 rounded-full lg:rounded-lg">
                  <CheckCircle2 className="w-[15px] h-[15px] lg:w-[18px] lg:h-[18px]" strokeWidth={3} />
                </div>
              </div>
            )}
          </div>

          {/* Info Principal */}
          <div className="flex-1 min-w-0 pb-1 lg:pb-2 text-left">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-2">
              <h1 className="text-[24px] sm:text-[30px] md:text-[34px] lg:text-4xl font-black text-[#1c2b1e] leading-tight lg:leading-none lg:tracking-tighter break-words">
                {profile ? `${profile.firstName} ${profile.lastName}` : 'Cargando Perfil...'}
              </h1>
              {profile?.displayName && (
                <span className="w-fit text-[12px] sm:text-[13px] lg:text-[14px] font-bold text-[#4a7f1a] lg:text-[#72B626] bg-[#f0f9e0] px-2.5 lg:px-3 py-1 rounded-md lg:rounded-lg">
                  @{profile.displayName}
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-x-4 lg:gap-x-6 gap-y-2 text-slate-500">
              {profile?.companyName && (
                <div className="flex items-center gap-1.5 lg:gap-2 text-[12px] sm:text-[13px] font-medium min-w-0">
                  <Building2 size={14} className="text-slate-400" />
                  <span className="truncate">{profile.companyName}</span>
                </div>
              )}

              {profile?.city && (
                <div className="flex items-center gap-1.5 lg:gap-2 text-[12px] sm:text-[13px] font-medium">
                  <MapPin size={14} className="text-slate-400" />
                  {profile.city}, {profile.country}
                </div>
              )}

              {profile?.website && (
                <div className="flex items-center gap-1.5 lg:gap-2 text-[12px] sm:text-[13px] font-medium text-[#72B626] hover:underline cursor-pointer min-w-0">
                  <Globe size={14} />
                  <span className="truncate">{profile.website.replace(/^https?:\/\//, '')}</span>
                </div>
              )}
            </div>
          </div>

          {/* Acciones de Edición */}
          <div className="flex gap-2 lg:gap-3 w-full sm:w-auto sm:pb-1 lg:pb-2">
            <button
              onClick={() => onEdit('profile')}
              className="flex-1 sm:flex-none bg-slate-100 lg:bg-white hover:bg-[#f0f9e0] text-slate-700 font-bold px-4 lg:px-6 py-2.5 lg:py-3 rounded-md lg:rounded-xl border border-slate-200 lg:border-gray-100 transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer text-[13px] lg:shadow-sm"
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
