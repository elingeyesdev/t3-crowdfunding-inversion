import { useState, useEffect } from 'react';
import { useInvestorProfile } from '../hooks/useInvestorProfile';
import { useInvestorDashboard } from '../hooks/useInvestorDashboard';
import { Navbar } from '../components/Navbar';

import { ProfileHeader } from '../components/investor-profile/ProfileHeader';
import { ProfileTabs } from '../components/investor-profile/ProfileTabs';
import { ProfileSidebar } from '../components/investor-profile/ProfileSidebar';
import { InvestmentsFeed } from '../components/investor-profile/InvestmentsFeed';
import { EditProfileModal } from '../components/investor-profile/EditProfileModal';
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  User,
  MapPin,
  Shield,
  FolderOpen,
  Rocket,
  Target,
} from 'lucide-react';

type ModalType = 'profile' | 'fiscal' | 'address' | 'investment' | 'avatar' | null;

const INVESTOR_TYPE_LABELS: Record<string, string> = {
  individual: 'Donador Individual',
  institutional: 'Donador Institucional',
  angel: 'Donador Ángel',
};

export function InvestorProfilePage() {
  const {
    profile,
    loading: profileLoading,
    saving,
    error: profileError,
    successMessage,
    submitProfile,
    uploadAvatarPhoto,
    uploadCoverPhoto,
    deleteProfile,
  } = useInvestorProfile();

  const {
    data: capitalData,
    loading: capitalLoading,
  } = useInvestorDashboard();

  const handleDeleteInvestorProfile = async () => {
    const ok = window.confirm(
      '¿Eliminar tu perfil de donador? Tu cuenta seguirá activa. No es posible si ya tienes donaciones registradas.',
    );
    if (!ok) return;
    await deleteProfile();
  };

  const [modalType, setModalType] = useState<ModalType>(null);
  const [activeTab, setActiveTab] = useState('donations');
  const [onboardingTriggered, setOnboardingTriggered] = useState(false);

  const userEmail = localStorage.getItem('userEmail') ?? '';

  useEffect(() => {
    if (!profileLoading && !profile && !onboardingTriggered) {
      const timer = setTimeout(() => {
        setModalType('profile');
        setOnboardingTriggered(true);
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [profileLoading, profile, onboardingTriggered]);

  const handleSave = async (_type: string, data: any) => {
    const baseData = { ...profile, ...data };
    if (!profile) {
      if (!baseData.firstName) baseData.firstName = 'Usuario';
      if (!baseData.lastName) baseData.lastName = 'Sin Registrar';
    }
    const {
      id, userId, avatarUrl, coverUrl, identityVerified, identityVerifiedAt,
      verificationDocuments, totalInvestments, totalInvested, accredited,
      metadata, createdAt, updatedAt, ...sanitizedData
    } = baseData;
    await submitProfile(sanitizedData);
    setModalType(null);
  };

  const error = profileError;

  return (
    <div className="min-h-screen font-sans bg-[#f4f7f4] flex flex-col font-['Plus Jakarta Sans',sans-serif]">
      <Navbar />

      <main className="flex-1 w-full relative z-0 pb-20">

        {profileLoading ? (
          <div className="max-w-[1100px] mx-auto p-40 flex flex-col items-center justify-center gap-6">
            <Loader2 className="w-14 h-14 text-[#72B626] animate-spin" strokeWidth={2.5} />
            <p className="text-slate-400 font-black uppercase tracking-widest text-[11px]">Sincronizando Perfil Corporativo...</p>
          </div>
        ) : (
          <>
            <div className="bg-white shadow-sm">
              <ProfileHeader
                profile={profile}
                onEdit={(type: any) => setModalType(type as ModalType)}
                uploadAvatar={uploadAvatarPhoto}
                uploadCover={uploadCoverPhoto}
              />
              <div className="sticky top-[72px] z-10 bg-white shadow-sm">
                <ProfileTabs activeTab={activeTab} setActiveTab={setActiveTab} />
              </div>
            </div>

            <div className="max-w-[1100px] mx-auto px-4 sm:px-6 mt-8 flex flex-col lg:flex-row gap-8 items-start">

              <ProfileSidebar
                profile={profile}
                openModal={(type: ModalType) => setModalType(type)}
                userEmail={userEmail}
                onDeleteProfile={profile ? handleDeleteInvestorProfile : undefined}
              />

              <div className="flex-1 min-w-0 flex flex-col w-full">
                {((!profileLoading && !profile) || error || successMessage) && (
                  <div className="w-full mb-8 flex flex-col gap-4">
                    {!profileLoading && !profile && (
                      <div className="bg-gradient-to-r from-[#72B626] to-[#1c2b1e] text-white p-5 sm:p-6 rounded-[24px] sm:rounded-[32px] shadow-xl shadow-gray-900/10 flex flex-col sm:flex-row items-center sm:justify-between gap-5 sm:gap-4 text-center sm:text-left animate-in slide-in-from-top-4 duration-700">
                        <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-5">
                          <div className="w-10 h-10 sm:w-12 sm:h-12 bg-white/20 backdrop-blur-md rounded-xl sm:rounded-2xl flex items-center justify-center text-white ring-1 ring-white/30 shrink-0">
                            <Rocket size={20} strokeWidth={2.5} className="sm:w-6 sm:h-6" />
                          </div>
                          <div>
                            <h4 className="text-[16px] font-black tracking-tight uppercase tracking-widest leading-none mb-2 sm:mb-1">¡Casi listo para donar!</h4>
                            <p className="text-green-100/80 text-[13px] font-medium leading-tight">Completa tu información principal para poder realizar tu primera donación.</p>
                          </div>
                        </div>
                        <button
                          onClick={() => setModalType('profile')}
                          className="w-full sm:w-auto bg-white text-[#72B626] px-6 py-3 rounded-xl text-[13px] font-black uppercase tracking-widest hover:bg-green-50 transition-all active:scale-95 shadow-lg border-none cursor-pointer shrink-0"
                        >
                          Completar Ahora
                        </button>
                      </div>
                    )}

                    {error && (
                      <div className="bg-red-50 text-[#c62828] p-5 rounded-[24px] text-[14px] font-bold border border-red-100 shadow-sm flex items-center gap-3">
                        <AlertCircle size={20} strokeWidth={2.5} className="shrink-0" /> {error}
                      </div>
                    )}
                    {successMessage && (
                      <div className="bg-green-50 text-[#72B626] p-5 rounded-[24px] text-[14px] font-bold border border-green-100 shadow-sm flex items-center gap-3">
                        <CheckCircle2 size={20} strokeWidth={2.5} className="shrink-0" /> {successMessage}
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'donations' ? (
                  <InvestmentsFeed capitalData={capitalData} capitalLoading={capitalLoading} />
                ) : activeTab === 'info' ? (
                  <div className="flex flex-col gap-6 sm:gap-8">
                    <section className="bg-white rounded-[24px] sm:rounded-[32px] border border-green-50 p-6 sm:p-8 shadow-sm">
                      <div className="flex justify-between items-center mb-6">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-green-50 text-[#72B626] rounded-xl flex items-center justify-center shrink-0"><User size={20} strokeWidth={2.5} /></div>
                          <h3 className="text-[14px] sm:text-[15px] font-black text-[#1c2b1e] uppercase tracking-widest">Datos Personales</h3>
                        </div>
                        <button onClick={() => setModalType('profile')} className="text-[#72B626] font-black uppercase text-[12px] cursor-pointer hover:underline border-none bg-transparent">Editar</button>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8 text-[14px]">
                        <div><p className="text-slate-400 font-black uppercase text-[10px] tracking-widest mb-1">Nombre Completo</p><p className="font-bold text-[#1c2b1e]">{profile?.firstName} {profile?.lastName}</p></div>
                        <div><p className="text-slate-400 font-black uppercase text-[10px] tracking-widest mb-1">Nombre Público</p><p className="font-bold text-[#72B626]">@{profile?.displayName || 'No definido'}</p></div>
                        <div><p className="text-slate-400 font-black uppercase text-[10px] tracking-widest mb-1">Tipo de Donador</p><p className="font-bold text-[#72B626] flex items-center gap-2"><Shield size={14} className="shrink-0" /> {profile?.investorType ? INVESTOR_TYPE_LABELS[profile.investorType] : '-'}</p></div>
                        <div><p className="text-slate-400 font-black uppercase text-[10px] tracking-widest mb-1">Tax ID</p><p className="font-bold text-[#1c2b1e] break-all">{profile?.taxId || '-'}</p></div>
                        <div className="md:col-span-2"><p className="text-slate-400 font-black uppercase text-[10px] tracking-widest mb-1">Biografía</p><p className="text-slate-600 leading-relaxed">{profile?.bio || 'Sin biografía.'}</p></div>
                      </div>
                    </section>

                    <section className="bg-white rounded-[24px] sm:rounded-[32px] border border-green-50 p-6 sm:p-8 shadow-sm">
                      <div className="flex justify-between items-center mb-6">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-green-50 text-[#72B626] rounded-xl flex items-center justify-center shrink-0"><MapPin size={20} strokeWidth={2.5} /></div>
                          <h3 className="text-[14px] sm:text-[15px] font-black text-[#1c2b1e] uppercase tracking-widest">Ubicación</h3>
                        </div>
                        <button onClick={() => setModalType('address')} className="text-[#72B626] font-black uppercase text-[12px] cursor-pointer hover:underline border-none bg-transparent">Editar</button>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8 text-[14px]">
                        <div><p className="text-slate-400 font-black uppercase text-[10px] tracking-widest mb-1">País</p><p className="font-bold text-[#1c2b1e]">{profile?.country || '-'}</p></div>
                        <div><p className="text-slate-400 font-black uppercase text-[10px] tracking-widest mb-1">Estado / Ciudad</p><p className="font-bold text-[#1c2b1e]">{profile?.state || '-'}, {profile?.city || '-'}</p></div>
                        <div><p className="text-slate-400 font-black uppercase text-[10px] tracking-widest mb-1">Dirección Principal</p><p className="font-bold text-[#1c2b1e] break-words">{profile?.addressLine1 || '-'}</p></div>
                        <div><p className="text-slate-400 font-black uppercase text-[10px] tracking-widest mb-1">Complemento</p><p className="font-bold text-[#1c2b1e] break-words">{profile?.addressLine2 || '-'}</p></div>
                      </div>
                    </section>

                    <section className="bg-white rounded-[24px] sm:rounded-[32px] border border-green-50 p-6 sm:p-8 shadow-sm">
                      <div className="flex justify-between items-center mb-6">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-green-50 text-[#72B626] rounded-xl flex items-center justify-center shrink-0"><Target size={20} strokeWidth={2.5} /></div>
                          <h3 className="text-[14px] sm:text-[15px] font-black text-[#1c2b1e] uppercase tracking-widest">Preferencias de Donación</h3>
                        </div>
                        <button onClick={() => setModalType('investment')} className="text-[#72B626] font-black uppercase text-[12px] cursor-pointer hover:underline border-none bg-transparent">Editar</button>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8 text-[14px]">
                        <div><p className="text-slate-400 font-black uppercase text-[10px] tracking-widest mb-1">Donación Mínima</p><p className="font-bold text-[#1c2b1e]">{profile?.minInvestment ? `Bs. ${profile.minInvestment.toLocaleString('es-BO')}` : '-'}</p></div>
                        <div><p className="text-slate-400 font-black uppercase text-[10px] tracking-widest mb-1">Capacidad Máxima</p><p className="font-bold text-[#1c2b1e]">{profile?.maxInvestment ? `Bs. ${profile.maxInvestment.toLocaleString('es-BO')}` : '-'}</p></div>
                      </div>
                    </section>
                  </div>
                ) : activeTab === 'capital' ? (
                  <div className="bg-white rounded-2xl sm:rounded-[32px] border border-green-50 p-5 sm:p-8 shadow-sm space-y-6 sm:space-y-8 w-full">
                    <div>
                      <h3 className="text-[16px] font-black text-[#1c2b1e] uppercase tracking-widest mb-1">Capital & Fondos</h3>
                      <p className="text-slate-400 text-xs font-semibold">Resumen de límites financieros y donaciones acumuladas</p>
                    </div>

                    {capitalLoading ? (
                      <div className="py-20 flex flex-col items-center justify-center gap-4">
                        <Loader2 className="w-8 h-8 text-[#72B626] animate-spin" />
                        <p className="text-slate-400 text-xs font-black uppercase tracking-widest">Cargando datos financieros...</p>
                      </div>
                    ) : capitalData ? (
                      <div className="space-y-8">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                          {/* Card 1 */}
                          <div className="border border-slate-100 rounded-xl sm:rounded-2xl p-4 sm:p-6 bg-slate-50/50">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Capital Disponible</span>
                            <span className="text-xl sm:text-2xl font-black text-[#1c2b1e]">
                              {capitalData.maxInvestmentLimit !== null
                                ? `Bs. ${new Intl.NumberFormat('es-BO', { maximumFractionDigits: 0 }).format(capitalData.availableCapital || 0)}`
                                : 'No configurado'}
                            </span>
                          </div>
                          
                          {/* Card 2 */}
                          <div className="border border-slate-100 rounded-xl sm:rounded-2xl p-4 sm:p-6 bg-slate-50/50">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Total Donado</span>
                            <span className="text-xl sm:text-2xl font-black text-[#72B626]">
                              {`Bs. ${new Intl.NumberFormat('es-BO', { maximumFractionDigits: 0 }).format(capitalData.totalInvested || 0)}`}
                            </span>
                          </div>

                          {/* Card 3 */}
                          <div className="border border-slate-100 rounded-xl sm:rounded-2xl p-4 sm:p-6 bg-slate-50/50">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Límite Máximo</span>
                            <span className="text-xl sm:text-2xl font-black text-[#1c2b1e]">
                              {capitalData.maxInvestmentLimit !== null
                                ? `Bs. ${new Intl.NumberFormat('es-BO', { maximumFractionDigits: 0 }).format(capitalData.maxInvestmentLimit)}`
                                : 'No configurado'}
                            </span>
                          </div>
                        </div>

                        {/* Progress bar */}
                        {capitalData.maxInvestmentLimit !== null && capitalData.maxInvestmentLimit > 0 && (
                          <div className="bg-slate-50 border border-slate-100 rounded-2xl p-6">
                            <div className="flex justify-between items-center mb-3">
                              <span className="text-xs font-bold text-slate-500">Progreso de Donación (Capital Utilizado)</span>
                              <span className="text-xs font-black text-[#72B626]">
                                {Math.round(((capitalData.totalInvested || 0) / capitalData.maxInvestmentLimit) * 100)}%
                              </span>
                            </div>
                            <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-gradient-to-r from-[#a8d97c] to-[#72B626] rounded-full transition-all duration-1000"
                                style={{ width: `${Math.min(100, ((capitalData.totalInvested || 0) / capitalData.maxInvestmentLimit) * 100)}%` }}
                              />
                            </div>
                            <div className="flex justify-between mt-2 text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                              <span>Aportado: Bs. {new Intl.NumberFormat('es-BO', { maximumFractionDigits: 0 }).format(capitalData.totalInvested || 0)}</span>
                              <span>Límite: Bs. {new Intl.NumberFormat('es-BO', { maximumFractionDigits: 0 }).format(capitalData.maxInvestmentLimit)}</span>
                            </div>
                          </div>
                        )}

                        {/* Preferences / settings */}
                        <div className="bg-[#f0f9e0] border border-gray-100 rounded-2xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          <div>
                            <h4 className="text-[14px] font-black text-[#1c2b1e] uppercase tracking-wider mb-1">Ajustar Configuración Financiera</h4>
                            <p className="text-xs text-slate-500 font-medium">Puedes cambiar tus montos mínimo/máximo de donación desde tu panel de información.</p>
                          </div>
                          <button
                            onClick={() => setModalType('investment')}
                            className="bg-[#72B626] hover:bg-[#4a7f1a] text-white border-none rounded-xl py-3 px-6 text-[13px] font-black uppercase tracking-widest cursor-pointer transition-all active:scale-95"
                          >
                            Editar Límites
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-slate-400 text-sm font-medium">No se pudieron cargar los datos del capital.</p>
                    )}
                  </div>
                ) : (
                  <div className="bg-white rounded-[50px] shadow-sm border border-green-50 p-12 text-center text-slate-400 py-32 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-green-50 rounded-full blur-[100px] -mr-32 -mt-32 opacity-50"></div>
                    <div className="text-green-100 mb-6 flex justify-center">
                      <FolderOpen size={80} strokeWidth={1} />
                    </div>
                    <h3 className="text-2xl font-black text-[#1c2b1e] tracking-tight mb-3 uppercase tracking-widest">
                      Módulo en Desarrollo
                    </h3>
                    <p className="max-w-md mx-auto text-[15px] font-medium leading-relaxed text-slate-500">
                      Este módulo estará disponible próximamente para fortalecer la transparencia de tu perfil corporativo.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </main>

      <EditProfileModal
        type={modalType} profile={profile} saving={saving}
        onClose={() => setModalType(null)} onSave={handleSave}
      />
    </div>
  );
}
