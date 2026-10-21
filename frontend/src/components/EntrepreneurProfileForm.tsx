import React, { useState, useEffect } from 'react';
import type { EntrepreneurProfile, CreateEntrepreneurProfileDto } from '../types/entrepreneur.types';
import { KYCUploadModal } from './KYCUploadModal';

interface Props {
  profile: EntrepreneurProfile | null;
  saving: boolean;
  isNew: boolean;
  onSubmit: (data: CreateEntrepreneurProfileDto) => Promise<void>;
  activeSection: string;
}

export function EntrepreneurProfileForm({ profile, saving, isNew, onSubmit, activeSection }: Props) {
  // Global form state based on profile
  const [formData, setFormData] = useState<CreateEntrepreneurProfileDto>({
    firstName: '', lastName: '', displayName: '', bio: '',
    companyName: '', website: '', linkedinUrl: '',
    addressLine: '', city: '', state: '', country: '', postalCode: '',
    bankAccountNumber: '', bankName: '',
  });

  // Track edit mode per section
  const [editSection, setEditSection] = useState<string | null>(isNew ? 'basic' : null);
  const [showKycModal, setShowKycModal] = useState(false);
  
  useEffect(() => {
    if (profile) {
      setFormData({
        firstName: profile.firstName ?? '',
        lastName: profile.lastName ?? '',
        displayName: profile.displayName ?? '',
        bio: profile.bio ?? '',
        companyName: profile.companyName ?? '',
        website: profile.website ?? '',
        linkedinUrl: profile.linkedinUrl ?? '',
        addressLine: profile.addressLine ?? '',
        city: profile.city ?? '',
        state: profile.state ?? '',
        country: profile.country ?? '',
        postalCode: profile.postalCode ?? '',
        bankAccountNumber: profile.bankAccountNumber ?? '',
        bankName: profile.bankName ?? '',
      });
    }
  }, [profile]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSaveSection = async () => {
    await onSubmit(formData);
    setEditSection(null);
  };

  const handleCancelSection = () => {
    // Revert local changes for this section
    if (profile) {
      setFormData(prev => ({
        ...prev,
        firstName: profile.firstName ?? '',
        lastName: profile.lastName ?? '',
        displayName: profile.displayName ?? '',
        bio: profile.bio ?? '',
        companyName: profile.companyName ?? '',
        website: profile.website ?? '',
        linkedinUrl: profile.linkedinUrl ?? '',
        addressLine: profile.addressLine ?? '',
        city: profile.city ?? '',
        state: profile.state ?? '',
        country: profile.country ?? '',
        postalCode: profile.postalCode ?? '',
        bankAccountNumber: profile.bankAccountNumber ?? '',
        bankName: profile.bankName ?? '',
      }));
    }
    setEditSection(null);
  };

  // Reusable Input styles for a premium capulse look
  const inputClassName = "w-full bg-gray-50/50 border border-gray-200/80 rounded-xl px-4 py-3 text-gray-800 font-medium transition-all duration-300 focus:bg-white focus:outline-none focus:ring-[3px] focus:ring-blue-500/20 focus:border-blue-500 hover:bg-white placeholder:font-normal placeholder:text-gray-400";
  const labelClassName = "block text-[0.8rem] font-bold text-gray-600 uppercase tracking-wider mb-2 ml-1";
  
  // Reusable Container
  const cardClassName = "bg-white/90 backdrop-blur-3xl rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white/60 p-6 md:p-8 mb-6 transition-all duration-300";
  
  // Sections definitions
  const renderBasicInfo = () => {
    const isEditing = editSection === 'basic';
    return (
      <div className={cardClassName}>
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-extrabold text-gray-900 tracking-tight">Información Básica</h2>
          {!isEditing && (
            <button onClick={() => setEditSection('basic')} className="text-sm font-semibold text-[#1a56db] hover:bg-blue-50 px-4 py-2 rounded-xl transition-all duration-300 active:scale-95">
              Editar sección
            </button>
          )}
        </div>
        
        {isEditing ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className={labelClassName}>Nombre <span className="text-red-500">*</span></label>
              <input type="text" name="firstName" value={formData.firstName} onChange={handleChange} className={inputClassName} placeholder="Ej. Ana" />
            </div>
            <div>
              <label className={labelClassName}>Apellido <span className="text-red-500">*</span></label>
              <input type="text" name="lastName" value={formData.lastName} onChange={handleChange} className={inputClassName} placeholder="Ej. García" />
            </div>
            <div className="col-span-1 md:col-span-2">
              <label className={labelClassName}>Nombre público</label>
              <input type="text" name="displayName" value={formData.displayName} onChange={handleChange} className={inputClassName} placeholder="¿Cómo te gustaría que te llamen en la plataforma?" />
            </div>
            <div className="col-span-1 md:col-span-2">
              <label className={labelClassName}>Biografía</label>
              <textarea name="bio" value={formData.bio} onChange={handleChange} rows={4} className={`${inputClassName} resize-none leading-relaxed`} placeholder="Cuéntanos un poco sobre ti, tu experiencia y tus metas..." />
            </div>
            <div className="col-span-1 md:col-span-2 flex justify-end gap-3 mt-4 border-t border-gray-100 pt-6">
              {!isNew && <button type="button" onClick={() => handleCancelSection()} className="px-6 py-2.5 text-sm font-bold text-gray-600 bg-gray-100/80 hover:bg-gray-200 rounded-xl transition-all duration-300 active:scale-95">Cancelar</button>}
              <button type="button" onClick={() => handleSaveSection()} disabled={saving} className="px-6 py-2.5 text-sm font-bold text-white bg-gradient-to-r from-[#1a56db] to-blue-600 hover:-translate-y-0.5 hover:shadow-[0_8px_20px_rgb(26,86,219,0.3)] rounded-xl transition-all duration-300 active:translate-y-0 disabled:opacity-70 disabled:hover:translate-y-0">
                {saving ? 'Guardando...' : 'Guardar cambios'}
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-y-6">
            <div>
              <p className={labelClassName}>Nombre completo</p>
              <p className="font-semibold text-gray-900 text-lg">{profile?.firstName} {profile?.lastName}</p>
            </div>
            <div>
              <p className={labelClassName}>Nombre público</p>
              <p className="font-semibold text-gray-900 text-lg">{profile?.displayName || <span className="text-gray-400 italic">No especificado</span>}</p>
            </div>
            <div className="col-span-1 md:col-span-2">
              <p className={labelClassName}>Biografía</p>
              <p className="font-medium text-gray-700 leading-relaxed max-w-3xl">{profile?.bio || <span className="text-gray-400 italic">Aún no has escrito tu biografía. Anímate a compartir tu historia.</span>}</p>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderCompany = () => {
    const isEditing = editSection === 'company';
    return (
      <div className={cardClassName}>
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-extrabold text-gray-900 tracking-tight">Empresa / Proyecto</h2>
          {!isEditing && (
            <button onClick={() => setEditSection('company')} className="text-sm font-semibold text-[#1a56db] hover:bg-blue-50 px-4 py-2 rounded-xl transition-all duration-300 active:scale-95">
              Editar sección
            </button>
          )}
        </div>
        
        {isEditing ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="col-span-1 md:col-span-2">
              <label className={labelClassName}>Nombre de la Empresa</label>
              <div className="relative">
                 <input type="text" name="companyName" value={formData.companyName} onChange={handleChange} className={`${inputClassName} pl-11`} placeholder="Ingresa el nombre de tu negocio/startup" />
                 <svg className="w-5 h-5 absolute left-4 top-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"></path></svg>
              </div>
            </div>
            <div>
              <label className={labelClassName}>Sitio Web</label>
              <div className="relative">
                 <input type="url" name="website" value={formData.website} onChange={handleChange} placeholder="https://" className={`${inputClassName} pl-11`} />
                 <svg className="w-5 h-5 absolute left-4 top-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"></path></svg>
              </div>
            </div>
            <div>
              <label className={labelClassName}>Perfil en LinkedIn</label>
              <div className="relative">
                 <input type="url" name="linkedinUrl" value={formData.linkedinUrl} onChange={handleChange} placeholder="https://linkedin.com/..." className={`${inputClassName} pl-11`} />
                 <svg className="w-5 h-5 absolute left-4 top-3.5 text-gray-400" fill="currentColor" viewBox="0 0 24 24"><path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/></svg>
              </div>
            </div>
            <div className="col-span-1 md:col-span-2 flex justify-end gap-3 mt-4 border-t border-gray-100 pt-6">
              <button type="button" onClick={() => handleCancelSection()} className="px-6 py-2.5 text-sm font-bold text-gray-600 bg-gray-100/80 hover:bg-gray-200 rounded-xl transition-all duration-300 active:scale-95">Cancelar</button>
              <button type="button" onClick={() => handleSaveSection()} disabled={saving} className="px-6 py-2.5 text-sm font-bold text-white bg-gradient-to-r from-[#1a56db] to-blue-600 hover:-translate-y-0.5 hover:shadow-[0_8px_20px_rgb(26,86,219,0.3)] rounded-xl transition-all duration-300 active:translate-y-0 disabled:opacity-70 disabled:hover:translate-y-0">
                {saving ? 'Guardando...' : 'Guardar empresa'}
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-y-6">
            <div className="col-span-1 md:col-span-2">
              <p className={labelClassName}>Nombre de la empresa</p>
              <p className="font-semibold text-gray-900 text-lg">{profile?.companyName || <span className="text-gray-400 italic">No especificado</span>}</p>
            </div>
            <div>
              <p className={labelClassName}>Sitio web</p>
              {profile?.website ? <a href={profile.website} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 font-bold text-[#1a56db] hover:text-blue-700 transition-colors uppercase text-sm tracking-wide bg-blue-50/50 px-3 py-1.5 rounded-lg">{profile.website} <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg></a> : <p className="text-gray-400 italic font-medium">No especificado</p>}
            </div>
            <div>
              <p className={labelClassName}>LinkedIn</p>
              {profile?.linkedinUrl ? <a href={profile.linkedinUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 font-bold text-[#1a56db] hover:text-blue-700 transition-colors uppercase text-sm tracking-wide bg-blue-50/50 px-3 py-1.5 rounded-lg">Ver perfil profesional <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg></a> : <p className="text-gray-400 italic font-medium">No especificado</p>}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderLocation = () => {
    const isEditing = editSection === 'location';
    return (
      <div className={cardClassName}>
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-extrabold text-gray-900 tracking-tight">Ubicación de Operaciones</h2>
          {!isEditing && (
            <button onClick={() => setEditSection('location')} className="text-sm font-semibold text-[#1a56db] hover:bg-blue-50 px-4 py-2 rounded-xl transition-all duration-300 active:scale-95">
              Editar sección
            </button>
          )}
        </div>
        
        {isEditing ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="col-span-1 md:col-span-2">
              <label className={labelClassName}>Avenida / Calle</label>
              <input type="text" name="addressLine" value={formData.addressLine} onChange={handleChange} className={inputClassName} placeholder="Dirección principal" />
            </div>
            <div>
              <label className={labelClassName}>Ciudad</label>
              <input type="text" name="city" value={formData.city} onChange={handleChange} className={inputClassName} />
            </div>
            <div>
              <label className={labelClassName}>Provincia / Estado</label>
              <input type="text" name="state" value={formData.state} onChange={handleChange} className={inputClassName} />
            </div>
            <div>
              <label className={labelClassName}>País <span className="text-red-500">*</span></label>
              <input type="text" name="country" value={formData.country} onChange={handleChange} className={inputClassName} />
            </div>
            <div>
              <label className={labelClassName}>Código Postal</label>
              <input type="text" name="postalCode" value={formData.postalCode} onChange={handleChange} className={inputClassName} />
            </div>
            <div className="col-span-1 md:col-span-2 flex justify-end gap-3 mt-4 border-t border-gray-100 pt-6">
              <button type="button" onClick={() => handleCancelSection()} className="px-6 py-2.5 text-sm font-bold text-gray-600 bg-gray-100/80 hover:bg-gray-200 rounded-xl transition-all duration-300 active:scale-95">Cancelar</button>
              <button type="button" onClick={() => handleSaveSection()} disabled={saving} className="px-6 py-2.5 text-sm font-bold text-white bg-gradient-to-r from-[#1a56db] to-blue-600 hover:-translate-y-0.5 hover:shadow-[0_8px_20px_rgb(26,86,219,0.3)] rounded-xl transition-all duration-300 active:translate-y-0 disabled:opacity-70 disabled:hover:translate-y-0">
                {saving ? 'Guardando...' : 'Guardar ubicación'}
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-y-6">
            <div className="col-span-1 md:col-span-2">
              <p className={labelClassName}>Dirección Física</p>
              <p className="font-semibold text-gray-900 text-lg">{profile?.addressLine || <span className="text-gray-400 italic">No especificado</span>}</p>
            </div>
            <div>
              <p className={labelClassName}>Ciudad, Estado</p>
              <p className="font-semibold text-gray-900 text-lg">{profile?.city ? `${profile.city}, ${profile.state}` : <span className="text-gray-400 italic">No especificado</span>}</p>
            </div>
            <div>
              <p className={labelClassName}>País • Postal</p>
              <p className="font-semibold text-gray-900 text-lg">
                {profile?.country ? profile.country : <span className="text-gray-400 italic">No especificado</span>}
                {profile?.postalCode && <span className="text-gray-500 ml-2 font-mono bg-gray-100 px-2 py-1 rounded-md text-sm">{profile.postalCode}</span>}
              </p>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderBanking = () => {
    const isEditing = editSection === 'banking';
    return (
      <div className={cardClassName}>
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-extrabold text-gray-900 tracking-tight flex items-center gap-2">
            Datos Bancarios
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-green-100 ring-2 ring-white shadow-sm">
               <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-green-600" viewBox="0 0 20 20" fill="currentColor">
                 <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
               </svg>
            </span>
          </h2>
          {!isEditing && (
            <button onClick={() => setEditSection('banking')} className="text-sm font-semibold text-[#1a56db] hover:bg-blue-50 px-4 py-2 rounded-xl transition-all duration-300 active:scale-95">
              Editar sección
            </button>
          )}
        </div>
        
        {isEditing ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className={labelClassName}>Entidad Bancaria</label>
              <input type="text" name="bankName" value={formData.bankName} onChange={handleChange} className={inputClassName} placeholder="Nombre del banco" />
            </div>
            <div>
              <label className={labelClassName}>Número de cuenta</label>
              <input type="text" name="bankAccountNumber" value={formData.bankAccountNumber} onChange={handleChange} className={`${inputClassName} font-mono`} placeholder="Ej. 1234567890" />
            </div>
            <div className="col-span-1 md:col-span-2 flex justify-end gap-3 mt-4 border-t border-gray-100 pt-6">
              <button type="button" onClick={() => handleCancelSection()} className="px-6 py-2.5 text-sm font-bold text-gray-600 bg-gray-100/80 hover:bg-gray-200 rounded-xl transition-all duration-300 active:scale-95">Cancelar</button>
              <button type="button" onClick={() => handleSaveSection()} disabled={saving} className="px-6 py-2.5 text-sm font-bold text-white bg-gradient-to-r from-[#1a56db] to-blue-600 hover:-translate-y-0.5 hover:shadow-[0_8px_20px_rgb(26,86,219,0.3)] rounded-xl transition-all duration-300 active:translate-y-0 disabled:opacity-70 disabled:hover:translate-y-0">
                 {saving ? 'Validando...' : 'Guardar y proteger'}
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-y-6">
            <div className="bg-gradient-to-r from-gray-50 to-white border border-gray-200 rounded-xl p-5 col-span-1 md:col-span-2 flex items-center justify-between">
              <div>
                 <p className={labelClassName}>Entidad receptora</p>
                 <p className="font-semibold text-gray-900 text-lg">{profile?.bankName || <span className="text-gray-400 italic">Bóveda vacía</span>}</p>
              </div>
              <div className="text-right">
                 <p className={labelClassName}>Nº Cuenta / IBAN</p>
                 <p className="font-semibold text-gray-900 text-lg font-mono">
                    {profile?.bankAccountNumber ? `••••${profile.bankAccountNumber.slice(-4)}` : <span className="text-gray-400 italic font-sans text-base">No especificado</span>}
                 </p>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderVerification = () => {
    return (
      <div className={`${cardClassName} border-l-[6px] ${profile?.identityVerified ? 'border-l-green-500' : 'border-l-yellow-400'}`}>
        <h2 className="text-xl font-extrabold text-gray-900 tracking-tight mb-4">Verificación KYC</h2>
        
        <div className="flex flex-col sm:flex-row sm:items-center gap-6 p-6 rounded-2xl border border-gray-100 bg-gray-50/50 mb-2">
          <div className={`w-16 h-16 rounded-2xl flex items-center justify-center shrink-0 shadow-inner ${profile?.identityVerified ? 'bg-green-100/80 text-green-600' : 'bg-yellow-100/80 text-yellow-600'}`}>
            {profile?.identityVerified ? (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            )}
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900">{profile?.identityVerified ? 'Identidad Certificada Oficialmente' : 'Verificación Pendiente'}</h3>
            <p className="text-[0.95rem] font-medium text-gray-500 mt-1 max-w-xl">
              {profile?.identityVerified && profile?.identityVerifiedAt 
                ? `Tus documentos fueron aprobados en nuestra red confirmada con fecha del ${new Date(profile.identityVerifiedAt).toLocaleDateString()}. Puedes operar al 100%. ` 
                : 'Debes cumplir las regulaciones "Conoce a tu cliente" (KYC) enviando un documento gubernamental válido antes de poder lanzar tu campaña.'}
            </p>
          </div>
          
          {!profile?.identityVerified && profile?.kycStatus !== 'pending' && profile?.kycStatus !== 'approved' && (
            <div className="sm:ml-auto shrink-0">
               <button 
                 onClick={() => setShowKycModal(true)}
                 className="px-6 py-3 text-sm font-bold text-gray-800 bg-yellow-400 hover:bg-yellow-500 rounded-xl transition-all duration-300 shadow-[0_8px_20px_rgb(250,204,21,0.3)] hover:-translate-y-0.5 active:translate-y-0 focus:ring-4 focus:ring-yellow-400/20"
               >
                 Iniciar Proceso
               </button>
            </div>
          )}
          
          {profile?.kycStatus === 'pending' && (
             <div className="sm:ml-auto shrink-0">
               <span className="px-6 py-3 text-sm font-bold text-yellow-800 bg-yellow-100 rounded-xl border border-yellow-200">
                 En Revisión...
               </span>
             </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="w-full">
       {activeSection === 'basic' && renderBasicInfo()}
       {activeSection === 'company' && renderCompany()}
       {activeSection === 'location' && renderLocation()}
       {activeSection === 'banking' && renderBanking()}
       {activeSection === 'verification' && renderVerification()}

       {showKycModal && (
         <KYCUploadModal 
           onClose={() => setShowKycModal(false)}
           onSuccess={() => {
             setShowKycModal(false);
             window.location.reload(); // Simple way to refresh for now
           }}
         />
       )}
    </div>
  );
}
