import { useState, useEffect } from 'react';
import { useEntrepreneurProfile } from '../hooks/useEntrepreneurProfile';
import { useCampaigns } from '../hooks/useCampaigns';
import { getCampaignFinancialProgress, getMyCampaignById } from '../api/campaign.api';
import { Navbar } from '../components/Navbar';

import { ProfileHeader } from '../components/entrepreneur-profile/ProfileHeader';
import { ProfileTabs } from '../components/entrepreneur-profile/ProfileTabs';
import { ProfileSidebar } from '../components/entrepreneur-profile/ProfileSidebar';
import { CampaignsFeed } from '../components/entrepreneur-profile/CampaignsFeed';
import { EditProfileModal } from '../components/entrepreneur-profile/EditProfileModal';
import { NewCampaignFAB } from '../components/entrepreneur-profile/NewCampaignFAB';
import { CampaignPreviewModal } from '../components/CampaignPreviewModal';
import { CampaignForm } from '../components/CampaignForm';
import { KYCUploadModal } from '../components/KYCUploadModal';
import { CampaignAnalyticsDashboard } from '../components/CampaignAnalyticsDashboard';
import {
  FolderOpen,
  AlertCircle,
  Loader2,
  User,
  Building2,
  MapPin,
  CreditCard,
  Globe,
  ExternalLink,
  Rocket,
  Wallet,
  Building
} from 'lucide-react';

type ModalType = 'profile' | 'personal' | 'company' | 'address' | 'banking' | 'avatar' | 'new-campaign' | 'edit-campaign' | 'kyc' | null;

export function EntrepreneurProfilePage() {
  const {
    profile,
    loading: profileLoading,
    saving,
    submitProfile,
    uploadAvatarPhoto,
    uploadCoverPhoto,
    deleteProfile: performDeleteProfile,
  } = useEntrepreneurProfile();

  const handleDeleteProfile = async () => {
    const ok = window.confirm(
      '¿Eliminar tu perfil de emprendedor? Tu cuenta seguirá activa. No es posible si ya tienes campañas registradas en la plataforma.',
    );
    if (!ok) return;
    await performDeleteProfile();
  };

  const [selectedCampaign, setSelectedCampaign] = useState<any>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const {
    campaigns,
    loading: campaignsLoading,
    addCampaign,
    updateCampaign,
    submitForReview,
    publishCampaign,
    uploadCampaignImage,
    adding,
    addError,
  } = useCampaigns();

  const [modalType, setModalType] = useState<ModalType>(null);
  const [activeTab, setActiveTab] = useState('campaigns');
  const [onboardingTriggered, setOnboardingTriggered] = useState(false);

  const [selectedFinanceCampaignId, setSelectedFinanceCampaignId] = useState<string>('');
  const [campaignFinance, setCampaignFinance] = useState<any>(null);
  const [financeLoading, setFinanceLoading] = useState(false);

  useEffect(() => {
    if (campaigns && campaigns.length > 0 && !selectedFinanceCampaignId) {
      setSelectedFinanceCampaignId(campaigns[0].id);
    }
  }, [campaigns, selectedFinanceCampaignId]);

  useEffect(() => {
    if (selectedFinanceCampaignId) {
      const loadFinanceData = async () => {
        setFinanceLoading(true);
        try {
          const data = await getCampaignFinancialProgress(selectedFinanceCampaignId);
          setCampaignFinance(data);
        } catch (err) {
          console.error('Error loading campaign finance details:', err);
        } finally {
          setFinanceLoading(false);
        }
      };
      loadFinanceData();
    } else {
      setCampaignFinance(null);
    }
  }, [selectedFinanceCampaignId]);

  const userEmail = localStorage.getItem('userEmail') ?? '';

  // Auto-onboarding: Abrir modal si el perfil está vacío por primera vez
  useEffect(() => {
    if (!profileLoading && !profile && !onboardingTriggered) {
      const timer = setTimeout(() => {
        setModalType('profile');
        setOnboardingTriggered(true);
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [profileLoading, profile, onboardingTriggered]);

  const handleSave = async (type: string, data: any, file?: File, documents?: { file: File; justification: string }[]) => {
    if (type === 'new-campaign') {
      const id = await addCampaign(data, file, documents);
      return id !== null;
    } else if (type === 'edit-campaign' && selectedCampaign) {
      await updateCampaign(selectedCampaign.id, data, file, documents);
    } else {
      // Filtrar el payload para enviar solo campos permitidos por el DTO
      const baseData = { ...profile, ...data };

      // Si es un perfil nuevo, necesitamos asegurar firstName y lastName (campos obligatorios en DTO)
      if (!profile) {
        if (!baseData.firstName) baseData.firstName = 'Usuario';
        if (!baseData.lastName) baseData.lastName = 'Sin Registrar';
      }

      const {
        id,
        userId,
        avatarUrl,
        coverUrl,
        identityVerified,
        identityVerifiedAt,
        kycStatus,
        kycRejectionReason,
        verificationDocuments,
        totalCampaigns,
        totalRaised,
        rating,
        createdAt,
        updatedAt,
        ...sanitizedData
      } = baseData;

      await submitProfile(sanitizedData);

      if (type === 'avatar' && file) {
        await uploadAvatarPhoto(file);
      }
    }
    setModalType(null);
  };

  const handleOpenModal = (type: ModalType) => {
    if (type === 'new-campaign') {
      if (!profile || !profile.identityVerified) {
        alert('Primero debes completar todo tu perfil con KYC');
        return;
      }
    }
    setModalType(type);
  };

  return (
    <div className="min-h-screen font-sans bg-[#f4f7f4] flex flex-col font-['Plus Jakarta Sans',sans-serif]">
      <Navbar />

      <main className="flex-1 w-full relative z-0 pb-20">

        {profileLoading ? (
          <div className="max-w-[1100px] mx-auto py-32 flex flex-col items-center justify-center gap-6">
            <Loader2 className="w-14 h-14 text-[#72B626] animate-spin" strokeWidth={2.5} />
            <p className="text-slate-400 font-black uppercase tracking-widest text-[11px]">Sincronizando Perfil Corporativo...</p>
          </div>
        ) : (
          <>
            {/* HEADER & TABS */}
            <div className="bg-white shadow-sm">
              <ProfileHeader
                profile={profile}
                onEdit={(type: any) => setModalType(type as ModalType)}
                uploadAvatar={uploadAvatarPhoto}
                uploadCover={uploadCoverPhoto}
              />
              <div className="sticky top-[72px] z-10 bg-white shadow-sm">
                <ProfileTabs
                  activeTab={activeTab}
                  setActiveTab={setActiveTab}
                />
              </div>
            </div>

            {/* MAIN GRID */}
            <div className="max-w-[1100px] mx-auto px-4 sm:px-6 mt-8 flex flex-col lg:flex-row gap-8 items-start">

              <ProfileSidebar
                profile={profile}
                openModal={handleOpenModal}
                userEmail={userEmail}
                onDeleteProfile={profile ? handleDeleteProfile : undefined}
              />

              <div className="flex-1 min-w-0 flex flex-col  w-full">
                {/* Mensajes de Estado y Onboarding */}
                <div className="w-full mb-2 flex flex-col gap-4">
                  {!profileLoading && !profile && (
                    <div className="bg-gradient-to-r from-emerald-600 to-emerald-800 text-white p-6 rounded-[32px] shadow-xl shadow-gray-900/10 flex items-center justify-between animate-in slide-in-from-top-4 duration-700">
                      <div className="flex items-center gap-5">
                        <div className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center text-white ring-1 ring-white/30">
                          <Rocket size={24} strokeWidth={2.5} />
                        </div>
                        <div>
                          <h4 className="text-[16px] font-black tracking-tight uppercase tracking-widest leading-none mb-1">¡Casi listo para emprender!</h4>
                          <p className="text-green-100/80 text-[13px] font-medium leading-tight">Completa tu información principal para poder publicar tu primera campaña.</p>
                        </div>
                      </div>
                      <button
                        onClick={() => setModalType('profile')}
                        className="bg-white text-[#72B626] px-6 py-3 rounded-xl text-[13px] font-black uppercase tracking-widest hover:bg-green-50 transition-all active:scale-95 shadow-lg border-none cursor-pointer"
                      >
                        Completar Ahora
                      </button>
                    </div>
                  )}

                  {profile?.kycStatus === 'rejected' && (
                    <div className="bg-gradient-to-r from-red-600 to-red-800 text-white p-6 rounded-[32px] shadow-xl shadow-red-900/10 flex items-center justify-between animate-in slide-in-from-top-4 duration-700">
                      <div className="flex items-center gap-5">
                        <div className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center text-white ring-1 ring-white/30 shrink-0">
                          <AlertCircle size={24} strokeWidth={2.5} />
                        </div>
                        <div>
                          <h4 className="text-[16px] font-black tracking-tight uppercase tracking-widest leading-none mb-1">Verificación KYC Rechazada</h4>
                          <p className="text-red-100/90 text-[13px] font-medium leading-tight">
                            {profile.kycRejectionReason || 'Tus documentos no cumplen con los requisitos. Por favor, vuelve a intentar.'}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => setModalType('kyc')}
                        className="bg-white text-red-700 px-6 py-3 rounded-xl text-[13px] font-black uppercase tracking-widest hover:bg-red-50 transition-all active:scale-95 shadow-lg border-none cursor-pointer shrink-0 ml-4"
                      >
                        Reintentar KYC
                      </button>
                    </div>
                  )}
                </div>

                {activeTab === 'campaigns' ? (
                  <CampaignsFeed
                    openModal={handleOpenModal}
                    hasBanking={!!profile?.bankAccountNumber}
                    campaigns={campaigns}
                    loading={campaignsLoading}
                    onCampaignClick={async (campaign) => {
                      try {
                        const fullCampaign = await getMyCampaignById(campaign.id);
                        setSelectedCampaign(fullCampaign);
                      } catch (err) {
                        console.error('Error fetching full campaign for preview:', err);
                        setSelectedCampaign(campaign);
                      }
                      setPreviewOpen(true);
                    }}
                  />
                ) : activeTab === 'info' ? (
                  <div className="flex flex-col gap-8">
                    {/* Personal */}
                    <section className="bg-white rounded-[32px] border border-green-50 p-8 shadow-sm">
                      <div className="flex justify-between items-center mb-6">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-green-50 text-[#72B626] rounded-xl flex items-center justify-center">
                            <User size={20} strokeWidth={2.5} />
                          </div>
                          <h3 className="text-[15px] font-black text-[#1c2b1e] uppercase tracking-widest">Datos Personales</h3>
                        </div>
                        <button onClick={() => setModalType('profile')} className="text-[#72B626] font-black uppercase text-[12px] cursor-pointer hover:underline border-none bg-transparent">Editar</button>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-[14px]">
                        <div><p className="text-slate-400 font-black uppercase text-[10px] tracking-widest mb-1">Nombre Completo</p><p className="font-bold text-[#1c2b1e]">{profile?.firstName} {profile?.lastName}</p></div>
                        <div><p className="text-slate-400 font-black uppercase text-[10px] tracking-widest mb-1">Nombre Público</p><p className="font-bold text-[#72B626]">@{profile?.displayName || 'No definido'}</p></div>
                        <div className="md:col-span-2"><p className="text-slate-400 font-black uppercase text-[10px] tracking-widest mb-1">LinkedIn</p><p className="font-bold text-[#72B626] flex items-center gap-2"><ExternalLink size={14} /> {profile?.linkedinUrl || '-'}</p></div>
                        <div className="md:col-span-2"><p className="text-slate-400 font-black uppercase text-[10px] tracking-widest mb-1">Biografía</p><p className="text-slate-600 leading-relaxed">{profile?.bio || 'Sin biografía.'}</p></div>
                      </div>
                    </section>

                    {/* Company */}
                    <section className="bg-white rounded-[32px] border border-green-50 p-8 shadow-sm">
                      <div className="flex justify-between items-center mb-6">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-green-50 text-[#72B626] rounded-xl flex items-center justify-center">
                            <Building size={20} strokeWidth={2.5} />
                          </div>
                          <h3 className="text-[15px] font-black text-[#1c2b1e] uppercase tracking-widest">Startup & Site</h3>
                        </div>
                        <button onClick={() => setModalType('company')} className="text-[#72B626] font-black uppercase text-[12px] cursor-pointer hover:underline border-none bg-transparent">Editar</button>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-[14px]">
                        <div><p className="text-slate-400 font-black uppercase text-[10px] tracking-widest mb-1">Nombre de Empresa</p><p className="font-bold text-[#1c2b1e]">{profile?.companyName || '-'}</p></div>
                        <div><p className="text-slate-400 font-black uppercase text-[10px] tracking-widest mb-1">Sitio Web</p><p className="font-bold text-[#72B626] flex items-center gap-2"><Globe size={14} /> {profile?.website || '-'}</p></div>
                      </div>
                    </section>

                    {/* Location */}
                    <section className="bg-white rounded-[32px] border border-green-50 p-8 shadow-sm">
                      <div className="flex justify-between items-center mb-6">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-green-50 text-[#72B626] rounded-xl flex items-center justify-center">
                            <MapPin size={20} strokeWidth={2.5} />
                          </div>
                          <h3 className="text-[15px] font-black text-[#1c2b1e] uppercase tracking-widest">Ubicación</h3>
                        </div>
                        <button onClick={() => setModalType('address')} className="text-[#72B626] font-black uppercase text-[12px] cursor-pointer hover:underline border-none bg-transparent">Editar</button>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-[14px]">
                        <div><p className="text-slate-400 font-black uppercase text-[10px] tracking-widest mb-1">País</p><p className="font-bold text-[#1c2b1e]">{profile?.country || '-'}</p></div>
                        <div><p className="text-slate-400 font-black uppercase text-[10px] tracking-widest mb-1">Estado / Ciudad</p><p className="font-bold text-[#1c2b1e]">{profile?.state}, {profile?.city}</p></div>
                        <div className="md:col-span-2"><p className="text-slate-400 font-black uppercase text-[10px] tracking-widest mb-1">Dirección</p><p className="font-bold text-[#1c2b1e]">{profile?.addressLine || '-'}</p></div>
                      </div>
                    </section>

                    {/* Banking */}
                    <section className="bg-white rounded-[32px] border border-green-50 p-8 shadow-sm text-center md:text-left">
                      <div className="flex justify-between items-center mb-6">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-green-50 text-[#72B626] rounded-xl flex items-center justify-center">
                            <CreditCard size={20} strokeWidth={2.5} />
                          </div>
                          <h3 className="text-[15px] font-black text-[#1c2b1e] uppercase tracking-widest">Canal de Fondos</h3>
                        </div>
                        <button onClick={() => setModalType('banking')} className="text-[#72B626] font-black uppercase text-[12px] cursor-pointer hover:underline border-none bg-transparent">Editar</button>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-[14px]">
                        <div><p className="text-slate-400 font-black uppercase text-[10px] tracking-widest mb-1">Banco</p><p className="font-bold text-[#1c2b1e]">{profile?.bankName || '-'}</p></div>
                        <div><p className="text-slate-400 font-black uppercase text-[10px] tracking-widest mb-1">Cuenta</p><p className="font-bold text-[#1c2b1e] tracking-widest">{profile?.bankAccountNumber ? `**** **** ${profile.bankAccountNumber.slice(-4)}` : '-'}</p></div>
                      </div>
                    </section>
                  </div>
                ) : activeTab === 'banking' ? (
                  <div className="flex flex-col gap-8">
                    {/* Banking */}
                    <section className="bg-white rounded-[32px] border border-green-50 p-8 shadow-sm text-center md:text-left">
                      <div className="flex justify-between items-center mb-6">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-green-50 text-[#72B626] rounded-xl flex items-center justify-center">
                            <CreditCard size={20} strokeWidth={2.5} />
                          </div>
                          <h3 className="text-[15px] font-black text-[#1c2b1e] uppercase tracking-widest">Canal de Fondos</h3>
                        </div>
                        <button onClick={() => setModalType('banking')} className="text-[#72B626] font-black uppercase text-[12px] cursor-pointer hover:underline border-none bg-transparent">Editar</button>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-[14px]">
                        <div><p className="text-slate-400 font-black uppercase text-[10px] tracking-widest mb-1">Banco</p><p className="font-bold text-[#1c2b1e]">{profile?.bankName || '-'}</p></div>
                        <div><p className="text-slate-400 font-black uppercase text-[10px] tracking-widest mb-1">Cuenta</p><p className="font-bold text-[#1c2b1e] tracking-widest">{profile?.bankAccountNumber ? `**** **** ${profile.bankAccountNumber.slice(-4)}` : '-'}</p></div>
                      </div>
                    </section>
                  </div>
                ) : activeTab === 'finance' ? (
                  <div className="space-y-6 w-full">
                    {/* Header y Selector */}
                    <div className="bg-white rounded-[32px] border border-green-50 p-8 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
                      <div>
                        <h3 className="text-[16px] font-black text-[#1c2b1e] uppercase tracking-widest mb-1">Metas Económicas</h3>
                        <p className="text-slate-400 text-xs font-semibold">Análisis en tiempo real y proyecciones de recaudación</p>
                      </div>
                      
                      {campaigns.length > 0 ? (
                        <div className="relative min-w-[240px]">
                          <select
                            value={selectedFinanceCampaignId}
                            onChange={(e) => setSelectedFinanceCampaignId(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 text-[13px] font-bold outline-none focus:border-[#72B626] transition-colors appearance-none cursor-pointer"
                          >
                            {campaigns.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.title}
                              </option>
                            ))}
                          </select>
                          <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                            ▼
                          </div>
                        </div>
                      ) : (
                        <p className="text-slate-400 text-xs font-black uppercase tracking-widest">Sin campañas registradas</p>
                      )}
                    </div>

                    {financeLoading ? (
                      <div className="bg-white rounded-[32px] border border-green-50 p-12 text-center py-32 flex flex-col items-center justify-center gap-4">
                        <Loader2 className="w-10 h-10 text-[#72B626] animate-spin" />
                        <p className="text-slate-400 text-xs font-black uppercase tracking-widest">Cargando métricas financieras...</p>
                      </div>
                    ) : campaignFinance ? (
                      <CampaignAnalyticsDashboard
                        finance={campaignFinance}
                        campaignType={
                          campaigns.find((c) => c.id === selectedFinanceCampaignId)?.campaignType || 'donation'
                        }
                        startDate={campaigns.find((c) => c.id === selectedFinanceCampaignId)?.startDate}
                        createdAt={campaigns.find((c) => c.id === selectedFinanceCampaignId)?.createdAt}
                      />
                    ) : (
                      <div className="bg-white rounded-[32px] border border-green-50 p-12 text-center text-slate-400 py-32">
                        <Wallet size={80} strokeWidth={1} className="text-green-100 mb-6 mx-auto" />
                        <h3 className="text-2xl font-black text-[#1c2b1e] tracking-tight mb-3 uppercase tracking-widest">
                          Gestión Financiera
                        </h3>
                        <p className="max-w-md mx-auto text-[15px] font-medium leading-relaxed text-slate-500">
                          Crea y publica tu primera campaña de financiamiento para visualizar estadísticas en tiempo real y proyecciones de recaudación.
                        </p>
                      </div>
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

      {/* Acciones Rápidas */}
      <NewCampaignFAB
        openModal={handleOpenModal}
      />

      {/* Modales */}
      <EditProfileModal
        type={modalType !== 'new-campaign' && modalType !== 'edit-campaign' && modalType !== 'kyc' ? modalType : null}
        profile={profile}
        saving={saving}
        onClose={() => setModalType(null)}
        onSave={async (section, data, file) => {
          await handleSave(section, data, file);
        }}
      />

      {(modalType === 'new-campaign' || modalType === 'edit-campaign') && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-[#1c2b1e]/80 backdrop-blur-sm" onClick={() => setModalType(null)} />
          <div className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <CampaignForm
              initialData={modalType === 'edit-campaign' ? selectedCampaign : null}
              onSuccess={(dto, file, documents) => handleSave(modalType, dto, file, documents).then(() => true)}
              onSubmitForReview={async (dto, file, documents) => {
                let campaignId: string | null = null;
                if (modalType === 'new-campaign') {
                  campaignId = await addCampaign(dto, file, documents);
                } else if (modalType === 'edit-campaign' && selectedCampaign) {
                  const ok = await updateCampaign(selectedCampaign.id, dto, file, documents);
                  campaignId = ok ? selectedCampaign.id : null;
                }
                if (!campaignId) return false;
                return await submitForReview(campaignId);
              }}
              onCancel={() => setModalType(null)}
              saving={adding}
              saveError={addError}
            />
          </div>
        </div>
      )}

      {modalType === 'kyc' && (
        <KYCUploadModal
          onClose={() => setModalType(null)}
          onSuccess={() => {
            setModalType(null);
            window.location.reload();
          }}
        />
      )}

      <CampaignPreviewModal
        open={previewOpen}
        campaign={selectedCampaign}
        onClose={() => {
          setPreviewOpen(false);
          setSelectedCampaign(null);
        }}
        onSubmitForReview={() => {
          if (selectedCampaign) {
            submitForReview(selectedCampaign.id).then(() => setPreviewOpen(false));
          }
        }}
        onPublish={() => {
          if (selectedCampaign) {
            publishCampaign(selectedCampaign.id).then(() => setPreviewOpen(false));
          }
        }}
        onEdit={async (campaign) => {
          setPreviewOpen(false);
          try {
            const fullCampaign = await getMyCampaignById(campaign.id);
            setSelectedCampaign(fullCampaign);
            setModalType('edit-campaign');
          } catch (err) {
            console.error('Error fetching campaign detail for edit:', err);
            setSelectedCampaign(campaign);
            setModalType('edit-campaign');
          }
        }}
        onUploadImage={uploadCampaignImage}
        actionLoading={adding}
        entrepreneur={profile ? {
          firstName: profile.firstName,
          lastName: profile.lastName,
          email: userEmail,
          avatar: profile.avatarUrl ?? undefined,
          website: profile.website ?? undefined,
          linkedin: profile.linkedinUrl ?? undefined
        } : undefined}
      />

    </div>
  );
}
