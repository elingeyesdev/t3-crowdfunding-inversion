import { useState, useEffect } from 'react';
import type { EntrepreneurProfile } from '../../types/entrepreneur.types';
import { 
  Lightbulb, 
  Lock, 
  Image as ImageIcon, 
  User, 
  X, 
  Check, 
  Loader2,
  ChevronDown
} from 'lucide-react';

type ModalType = 'profile' | 'personal' | 'company' | 'address' | 'banking' | 'avatar' | 'new-campaign' | null;

interface Props {
  type: ModalType;
  profile: EntrepreneurProfile | null;
  onClose: () => void;
  onSave: (section: string, data: any, file?: File) => Promise<void>;
  saving: boolean;
}

const BOLIVIAN_DEPARTMENTS = [
  'Beni', 'Chuquisaca', 'Cochabamba', 'La Paz', 'Oruro', 'Pando', 'Potosí', 'Santa Cruz', 'Tarija'
];

const BOLIVIAN_CITIES_BY_DEPARTMENT: Record<string, string[]> = {
  'Beni': ['Trinidad', 'Riberalta', 'Guayaramerín', 'San Borja', 'Santa Ana del Yacuma', 'Rurrenabaque'],
  'Chuquisaca': ['Sucre', 'Monteagudo', 'Camargo', 'Tarabuco', 'Muyupampa', 'Villa Serrano'],
  'Cochabamba': ['Cochabamba', 'Sacaba', 'Quillacollo', 'Tiquipaya', 'Colcapirhua', 'Punata', 'Ivirgarzama', 'Villa Tunari'],
  'La Paz': ['La Paz', 'El Alto', 'Viacha', 'Caranavi', 'Achacachi', 'Patacamaya', 'Copacabana'],
  'Oruro': ['Oruro', 'Challapata', 'Huanuni', 'Caracollo'],
  'Pando': ['Cobija', 'Porvenir', 'Puerto Rico'],
  'Potosí': ['Potosí', 'Uyuni', 'Tupiza', 'Villazón', 'Llallagua', 'Uncía'],
  'Santa Cruz': ['Santa Cruz de la Sierra', 'Montero', 'Warnes', 'La Guardia', 'El Torno', 'Cotoca', 'San Ignacio de Velasco', 'Puerto Suárez'],
  'Tarija': ['Tarija', 'Yacuiba', 'Bermejo', 'Villa Montes', 'Entre Ríos']
};

const BOLIVIAN_BANKS = [
  'Banco Unión', 'Banco Nacional de Bolivia (BNB)', 'Banco Mercantil Santa Cruz (BMSC)', 'Banco de Crédito de Bolivia (BCP)', 'Banco Económico', 'Banco Ganadero', 'Banco Solidario (BancoSol)', 'Banco Fortaleza', 'Banco FIE', 'Banco Pyme de la Comunidad', 'Banco Pyme Ecofuturo'
];

export function EditProfileModal({ type, profile, onClose, onSave, saving }: Props) {
  const [formData, setFormData] = useState<any>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);

  useEffect(() => {
    setErrors({});
    setCoverFile(null);
    setCoverPreview(null);
    if (profile && type) {
      setFormData({ ...profile });
    } else {
      setFormData({});
    }
  }, [profile, type]);

  if (!type) {
    return null;
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    // Lógica para selectores dependientes (Dpto -> Ciudad)
    if (name === 'state') {
      setFormData({ ...formData, [name]: value, city: '' });
    } else {
      setFormData({ ...formData, [name]: value });
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setCoverFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setCoverPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async () => {
    const newErrors: Record<string, string> = {};

    // Validaciones por tipo de modal
    if (type === 'profile') {
      if (!formData.firstName || formData.firstName.trim().length < 2) {
        newErrors.firstName = 'El nombre es obligatorio (min. 2 caracteres)';
      }
      if (!formData.lastName || formData.lastName.trim().length < 2) {
        newErrors.lastName = 'El apellido es obligatorio (min. 2 caracteres)';
      }
      if (!formData.bio || formData.bio.trim().length < 30) {
        newErrors.bio = 'La biografía debe tener al menos 30 caracteres';
      }
    }

    if (type === 'personal') {
      if (!formData.bio || formData.bio.trim().length < 30) {
        newErrors.bio = 'La biografía debe tener al menos 30 caracteres';
      }
    }

    if (type === 'new-campaign') {
      if (!formData.title || formData.title.trim().length < 5) {
        newErrors.title = 'El título es obligatorio (min. 5 caracteres)';
      }
      const g = Number(formData.goalAmount);
      if (!Number.isFinite(g) || g < 100) {
        newErrors.goalAmount = 'La meta mínima es 100 (Bs. u moneda de la plataforma)';
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setErrors({});
    const dataToSave = { ...formData };
    
    // Forzar país por defecto si es modal de dirección y no está presente
    if (type === 'address' && !dataToSave.country) {
      dataToSave.country = 'Bolivia';
    }

    if (dataToSave.website) dataToSave.website = formatUrl(dataToSave.website);
    if (dataToSave.linkedinUrl) dataToSave.linkedinUrl = formatUrl(dataToSave.linkedinUrl);
    
    await onSave(type, dataToSave, coverFile || undefined);
  };

  const inputClass = "w-full border-gray-200 border-[1.5px] rounded-xl px-4 py-3 text-[15px] outline-none transition-all bg-gray-50/50 focus:bg-white focus:border-[#72B626] focus:ring-4 focus:ring-[#72B626]/10 placeholder:text-gray-400 font-medium appearance-none disabled:opacity-30 disabled:cursor-not-allowed";
  const labelClass = "text-[12px] font-black text-slate-500 mb-2 block uppercase tracking-wider ml-1";
  const btnSec = "flex-1 bg-gray-50 hover:bg-red-50 text-slate-500 hover:text-[#c62828] border-none rounded-xl py-3 text-[15px] font-bold cursor-pointer transition-all active:scale-95 flex items-center justify-center gap-2";
  const btnPri = "flex-1 bg-[#72B626] hover:bg-[#1c2b1e] text-white border-none rounded-xl py-3 text-[15px] font-bold cursor-pointer transition-all active:scale-95 disabled:opacity-50 shadow-lg shadow-[#72B626]/20/20 px-6 flex items-center justify-center gap-2";

  const formatUrl = (url: string) => {
    if (!url) return '';
    if (!/^https?:\/\//i.test(url)) {
      return `https://${url}`;
    }
    return url;
  };

  // Wrapper for Select to include icon
  const SelectWrapper = ({ children }: { children: React.ReactNode }) => (
    <div className="relative">
      {children}
      <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
        <ChevronDown size={18} strokeWidth={2.5} />
      </div>
    </div>
  );

  let modalTitle = '';
  let modalContent: React.ReactNode = null;

  switch (type) {
    case 'profile': {
      modalTitle = 'Información Principal';
      modalContent = (
        <div className="flex flex-col gap-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Nombre <span className="text-red-500">*</span></label>
              <input name="firstName" value={formData.firstName || ''} onChange={handleChange} className={`${inputClass} ${errors.firstName ? 'border-red-500 bg-red-50 focus:ring-red-500/10' : ''}`} />
              {errors.firstName && <p className="text-[10px] text-red-500 font-bold mt-1 uppercase tracking-wider ml-1">{errors.firstName}</p>}
            </div>
            <div>
              <label className={labelClass}>Apellido <span className="text-red-500">*</span></label>
              <input name="lastName" value={formData.lastName || ''} onChange={handleChange} className={`${inputClass} ${errors.lastName ? 'border-red-500 bg-red-50 focus:ring-red-500/10' : ''}`} />
              {errors.lastName && <p className="text-[10px] text-red-500 font-bold mt-1 uppercase tracking-wider ml-1">{errors.lastName}</p>}
            </div>
          </div>
          <div><label className={labelClass}>Nombre Público</label><input name="displayName" value={formData.displayName || ''} onChange={handleChange} className={inputClass} placeholder="@nombre_comercial" /></div>
          <div><label className={labelClass}>Perfil LinkedIn</label><input name="linkedinUrl" value={formData.linkedinUrl || ''} onChange={handleChange} className={inputClass} placeholder="https://linkedin.com/in/usuario" /></div>
          <div>
            <label className={labelClass}>Biografía Profesional <span className="text-red-500">*</span></label>
            <textarea name="bio" value={formData.bio || ''} onChange={handleChange} className={`${inputClass} resize-none ${errors.bio ? 'border-red-500 bg-red-50 focus:ring-red-500/10' : ''}`} rows={4} placeholder="Describe tu trayectoria..."></textarea>
            {errors.bio && <p className="text-[10px] text-red-500 font-bold mt-1 uppercase tracking-wider ml-1">{errors.bio}</p>}
          </div>
        </div>
      );
      break;
    }
    case 'personal': {
      modalTitle = 'Biografía & Social';
      modalContent = (
        <div className="flex flex-col gap-5">
          <div>
            <label className={labelClass}>Biografía Profesional <span className="text-red-500">*</span></label>
            <textarea 
              name="bio" 
              value={formData.bio || ''} 
              onChange={handleChange} 
              className={`${inputClass} resize-none ${errors.bio ? 'border-red-500 bg-red-50 focus:ring-red-500/10' : ''}`} 
              rows={4} 
              placeholder="Resume tu carrera..." 
            ></textarea>
            {errors.bio && <p className="text-[10px] text-red-500 font-bold mt-1 uppercase tracking-wider ml-1">{errors.bio}</p>}
          </div>
          <div><label className={labelClass}>Perfil LinkedIn</label><input name="linkedinUrl" value={formData.linkedinUrl || ''} onChange={handleChange} className={inputClass} placeholder="https://linkedin.com/in/usuario" /></div>
          <div className="bg-[#f0f9e0] border border-gray-100 p-4 rounded-xl text-sm text-[#1c2b1e] leading-relaxed font-bold flex items-start gap-3">
             <Lightbulb size={20} className="text-[#72B626] shrink-0" strokeWidth={2.5} />
             <span>Un perfil de LinkedIn actualizado aumenta la confianza de los donantes un 40%.</span>
          </div>
        </div>
      );
      break;
    }
    case 'company': {
      modalTitle = 'Información de la Empresa';
      modalContent = (
        <div className="flex flex-col gap-5">
          <div><label className={labelClass}>Nombre de la Empresa / Startup</label><input name="companyName" value={formData.companyName || ''} onChange={handleChange} className={inputClass} /></div>
          <div><label className={labelClass}>Sitio Web Oficial</label><input name="website" value={formData.website || ''} onChange={handleChange} className={inputClass} placeholder="https://miempresa.com" /></div>
        </div>
      );
      break;
    }
    case 'address': {
      modalTitle = 'Ubicación de Operaciones';
      const availableCities = formData.state ? (BOLIVIAN_CITIES_BY_DEPARTMENT[formData.state] || []) : [];
      modalContent = (
        <div className="flex flex-col gap-5">
          <div><label className={labelClass}>Dirección Fiscal / Oficina</label><input name="addressLine" value={formData.addressLine || ''} onChange={handleChange} className={inputClass} /></div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Estado / Dpto</label>
              <SelectWrapper>
                <select name="state" value={formData.state || ''} onChange={handleChange} className={inputClass}>
                  <option value="">Selecciona Dpto</option>
                  {BOLIVIAN_DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </SelectWrapper>
            </div>
            <div>
              <label className={labelClass}>Ciudad</label>
              <SelectWrapper>
                <select 
                  name="city" 
                  value={formData.city || ''} 
                  onChange={handleChange} 
                  className={inputClass}
                  disabled={!formData.state}
                >
                  <option value="">{formData.state ? 'Selecciona Ciudad' : 'Primero elige Dpto'}</option>
                  {availableCities.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </SelectWrapper>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>País</label>
              <SelectWrapper>
                <select name="country" value={formData.country || 'Bolivia'} onChange={handleChange} className={inputClass}>
                  <option value="Bolivia">Bolivia</option>
                </select>
              </SelectWrapper>
            </div>
            <div><label className={labelClass}>Código Postal</label><input name="postalCode" value={formData.postalCode || ''} onChange={handleChange} className={inputClass} /></div>
          </div>
        </div>
      );
      break;
    }
    case 'banking': {
      modalTitle = 'Canal de Recaudación';
      modalContent = (
        <div className="flex flex-col gap-5">
          <div className="bg-[#f0f9e0] border border-gray-100 rounded-xl p-4 flex items-start gap-3">
             <Lock size={20} className="text-[#72B626] shrink-0" strokeWidth={2.5} />
             <p className="text-[13px] text-[#1c2b1e] font-bold leading-tight uppercase tracking-tight italic">
                Tus datos bancarios se manejan bajo protocolos de seguridad máxima. Solo serán visibles de forma enmascarada para terceros.
             </p>
          </div>
          <div>
            <label className={labelClass}>Institución Bancaria</label>
            <SelectWrapper>
              <select name="bankName" value={formData.bankName || ''} onChange={handleChange} className={inputClass}>
                <option value="">Selecciona Banco</option>
                {BOLIVIAN_BANKS.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </SelectWrapper>
          </div>
          <div><label className={labelClass}>Número de Cuenta / IBAN</label><input name="bankAccountNumber" value={formData.bankAccountNumber || ''} onChange={handleChange} className={inputClass} placeholder="Número de cuenta para recibir fondos" /></div>
        </div>
      );
      break;
    }
    case 'new-campaign': {
      modalTitle = 'Lanzar Nueva Campaña';
      modalContent = (
        <div className="flex flex-col gap-5">
          <div>
            <label className={labelClass}>Título Inspirador <span className="text-red-500">*</span></label>
            <input name="title" value={formData.title || ''} onChange={handleChange} className={`${inputClass} ${errors.title ? 'border-red-500 bg-red-50' : ''}`} placeholder="Ej: Revolución Energética en Potosí" />
            {errors.title && <p className="text-[10px] text-red-500 font-bold mt-1 uppercase tracking-wider ml-1">{errors.title}</p>}
          </div>
          <div><label className={labelClass}>Resumen Ejecutivo</label><textarea name="description" value={formData.description || ''} onChange={handleChange} className={inputClass} rows={3} placeholder="¿Qué problema estás resolviendo?"></textarea></div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Meta de Fondos (Bs.) <span className="text-red-500">*</span></label>
              <input name="goalAmount" value={formData.goalAmount || ''} onChange={handleChange} className={`${inputClass} ${errors.goalAmount ? 'border-red-500 bg-red-50' : ''}`} placeholder="50000" type="number" />
              {errors.goalAmount && <p className="text-[10px] text-red-500 font-bold mt-1 uppercase tracking-wider ml-1">{errors.goalAmount}</p>}
            </div>
            <div><label className={labelClass}>Tiempo Estimado (Días)</label><input name="duration" value={formData.duration || ''} onChange={handleChange} className={inputClass} placeholder="45" type="number" /></div>
          </div>
          <div>
            <label className={labelClass}>Imagen de Portada</label>
            <div 
              className={`relative h-[160px] rounded-2xl border-2 border-dashed transition-all flex flex-col items-center justify-center overflow-hidden cursor-pointer ${coverPreview ? 'border-[#72B626] bg-[#f0f9e0]/10' : 'border-gray-200 hover:border-gray-100 hover:bg-[#f0f9e0]/30'}`}
              onClick={() => document.getElementById('cover-upload-modal')?.click()}
            >
              {coverPreview ? (
                <img src={coverPreview} className="w-full h-full object-cover" alt="Preview" />
              ) : (
                <div className="flex flex-col items-center text-slate-400">
                  <div className="w-10 h-10 bg-gray-50 rounded-full flex items-center justify-center mb-2">
                    <ImageIcon size={20} className="text-slate-300" />
                  </div>
                  <p className="text-[12px] font-bold">Seleccionar imagen</p>
                </div>
              )}
              <input 
                id="cover-upload-modal" 
                type="file" 
                accept="image/*" 
                className="hidden" 
                onChange={handleFileChange} 
              />
              {coverPreview && (
                <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
                   <span className="bg-white text-[#1c2b1e] px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest">Cambiar</span>
                </div>
              )}
            </div>
          </div>
        </div>
      );
      break;
    }
    case 'avatar': {
      modalTitle = 'Foto de Identidad';
      modalContent = (
        <div className="flex flex-col gap-6 items-center py-4 text-center">
          <div 
            className="w-[140px] h-[140px] rounded-full border-[5px] border-gray-100 bg-gradient-to-tr from-[#1c2b1e] to-[#72B626] flex items-center justify-center text-5xl font-black text-white shadow-xl shadow-[#1c2b1e]/20/10 overflow-hidden cursor-pointer relative group"
            onClick={() => document.getElementById('avatar-upload-modal')?.click()}
          >
            {coverPreview || profile?.avatarUrl ? (
              <div 
                className="w-full h-full"
                style={{ 
                  backgroundImage: `url(${coverPreview || profile?.avatarUrl})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center'
                }}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                {profile?.firstName ? (profile.firstName[0] + (profile.lastName?.[0] || '')).toUpperCase() : <User size={64} strokeWidth={1} />}
              </div>
            )}
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <span className="bg-white text-[#1c2b1e] px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center gap-1"><ImageIcon size={12}/> Cambiar</span>
            </div>
            <input 
              id="avatar-upload-modal" 
              type="file" 
              accept="image/*" 
              className="hidden" 
              onChange={handleFileChange} 
            />
          </div>
          <p className="text-center text-[14px] text-slate-500 max-w-[280px] font-medium leading-relaxed">Selecciona una foto profesional para transmitir confianza a tus posibles inversores.</p>
          <div className="w-full h-px bg-[#f0f9e0]"></div>
        </div>
      );
      break;
    }
    default:
      modalTitle = '';
      modalContent = null;
  }

  return (
    <div className="fixed inset-0 bg-[#1c2b1e]/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-[32px] w-[540px] max-w-full shadow-2xl flex flex-col max-h-[95vh] border border-white/20 relative" onClick={e => e.stopPropagation()}>
        <div className="absolute top-0 right-0 w-32 h-32 bg-[#f0f9e0] rounded-full blur-3xl -mr-16 -mt-16"></div>

        <div className="px-5 md:px-8 py-4 md:py-6 border-b border-gray-100 flex items-center justify-between z-10 shrink-0">
          <span className="text-[18px] md:text-[20px] font-black text-[#1c2b1e] tracking-tight">{modalTitle}</span>
          <button onClick={onClose} className="bg-slate-50 hover:bg-[#f0f9e0] border-none w-10 h-10 rounded-xl cursor-pointer flex items-center justify-center shrink-0">
            <X size={20} className="text-slate-400" strokeWidth={2.5} />
          </button>
        </div>

        <div className="px-5 md:px-8 py-4 md:py-6 overflow-y-auto z-10">
          {modalContent}
        </div>

        <div className="px-5 md:px-8 py-4 md:py-6 border-t border-gray-100 flex flex-col sm:flex-row gap-3 md:gap-4 z-10 bg-slate-50/30 shrink-0">
          <button className={btnSec} onClick={onClose}>
            <X size={18} strokeWidth={2.5} />
            Descartar
          </button>
          <button 
            className={btnPri} 
            onClick={handleSubmit} 
            disabled={saving || type === 'avatar'} 
          >
            {saving ? (
              <>
                <Loader2 className="animate-spin" size={20} strokeWidth={2.5} />
                Salvando Cambios...
              </>
            ) : (
              <>
                <Check size={20} strokeWidth={2.5} />
                {type === 'new-campaign' ? 'Publicar Campaña' : 'Confirmar Cambios'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
