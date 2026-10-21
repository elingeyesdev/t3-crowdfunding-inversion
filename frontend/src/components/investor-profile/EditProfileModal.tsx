import { useState, useEffect } from 'react';
import type { InvestorProfile } from '../../types/investor.types';
import { 
  Lightbulb, 
  User, 
  X, 
  Check, 
  Loader2,
  ChevronDown,
  Shield,
} from 'lucide-react';

type ModalType = 'profile' | 'fiscal' | 'address' | 'investment' | 'avatar' | null;

interface Props {
  type: ModalType;
  profile: InvestorProfile | null;
  onClose: () => void;
  onSave: (section: string, data: any) => Promise<void>;
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

export function EditProfileModal({ type, profile, onClose, onSave, saving }: Props) {
  const [formData, setFormData] = useState<any>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    setErrors({});
    if (profile && type) {
      setFormData({ ...profile });
    } else {
      setFormData({});
    }
  }, [profile, type]);

  if (!type) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    if (name === 'state') {
      setFormData({ ...formData, [name]: value, city: '' });
    } else {
      setFormData({ ...formData, [name]: value });
    }
  };

  const handleSubmit = async () => {
    const newErrors: Record<string, string> = {};
    if (type === 'profile') {
      if (!formData.firstName || formData.firstName.trim().length < 2) newErrors.firstName = 'El nombre es obligatorio (min. 2 caracteres)';
      if (!formData.lastName || formData.lastName.trim().length < 2) newErrors.lastName = 'El apellido es obligatorio (min. 2 caracteres)';
    }
    if (Object.keys(newErrors).length > 0) { setErrors(newErrors); return; }
    setErrors({});
    const dataToSave = { ...formData };
    if (type === 'address' && !dataToSave.country) dataToSave.country = 'Bolivia';
    if (dataToSave.minInvestment) dataToSave.minInvestment = Number(dataToSave.minInvestment);
    if (dataToSave.maxInvestment) dataToSave.maxInvestment = Number(dataToSave.maxInvestment);
    await onSave(type, dataToSave);
  };

  const inputClass = "w-full border-gray-200 border-[1.5px] rounded-xl px-4 py-3 text-[15px] outline-none transition-all bg-gray-50/50 focus:bg-white focus:border-[#72B626] focus:ring-4 focus:ring-[#72B626]/10 placeholder:text-gray-400 font-medium appearance-none disabled:opacity-30 disabled:cursor-not-allowed";
  const labelClass = "text-[12px] font-black text-slate-500 mb-2 block uppercase tracking-wider ml-1";
  const btnSec = "flex-1 bg-gray-50 hover:bg-red-50 text-slate-500 hover:text-[#c62828] border-none rounded-xl py-3 text-[15px] font-bold cursor-pointer transition-all active:scale-95 flex items-center justify-center gap-2";
  const btnPri = "flex-1 bg-[#72B626] hover:bg-[#1c2b1e] text-white border-none rounded-xl py-3 text-[15px] font-bold cursor-pointer transition-all active:scale-95 disabled:opacity-50 shadow-lg shadow-[#72B626]/20/20 px-6 flex items-center justify-center gap-2";

  const SelectWrapper = ({ children }: { children: React.ReactNode }) => (
    <div className="relative">
      {children}
      <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400"><ChevronDown size={18} strokeWidth={2.5} /></div>
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
          <div><label className={labelClass}>Nombre Público</label><input name="displayName" value={formData.displayName || ''} onChange={handleChange} className={inputClass} placeholder="@nombre_donador" /></div>
          <div>
            <label className={labelClass}>Tipo de Perfil Donador</label>
            <SelectWrapper>
              <select name="investorType" value={formData.investorType || 'individual'} onChange={handleChange} className={inputClass}>
                <option value="individual">Individual</option>
                <option value="institutional">Institucional</option>
                <option value="angel">Donador Ángel</option>
              </select>
            </SelectWrapper>
          </div>
          <div><label className={labelClass}>Biografía Profesional</label><textarea name="bio" value={formData.bio || ''} onChange={handleChange} className={`${inputClass} resize-none`} rows={4} placeholder="Describe tu trayectoria como donador..."></textarea></div>
        </div>
      );
      break;
    }
    case 'fiscal': {
      modalTitle = 'Documentación Fiscal';
      modalContent = (
        <div className="flex flex-col gap-5">
          <div className="bg-[#f0f9e0] border border-gray-100 rounded-xl p-4 flex items-start gap-3">
             <Shield size={20} className="text-[#72B626] shrink-0" strokeWidth={2.5} />
             <p className="text-[13px] text-[#1c2b1e] font-bold leading-tight uppercase tracking-tight italic">
                Tu identificación fiscal se maneja bajo protocolos de seguridad máxima. Solo será visible para procesos de verificación internos.
             </p>
          </div>
          <div><label className={labelClass}>CI / NIT / Tax ID</label><input name="taxId" value={formData.taxId || ''} onChange={handleChange} className={inputClass} placeholder="Número de identificación fiscal" /></div>
        </div>
      );
      break;
    }
    case 'address': {
      modalTitle = 'Ubicación de Residencia';
      const availableCities = formData.state ? (BOLIVIAN_CITIES_BY_DEPARTMENT[formData.state] || []) : [];
      modalContent = (
        <div className="flex flex-col gap-5">
          <div><label className={labelClass}>Dirección Principal</label><input name="addressLine1" value={formData.addressLine1 || ''} onChange={handleChange} className={inputClass} /></div>
          <div><label className={labelClass}>Complemento (Apto, Bloque, Oficina)</label><input name="addressLine2" value={formData.addressLine2 || ''} onChange={handleChange} className={inputClass} placeholder="Torre 2, AP 501" /></div>
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
                <select name="city" value={formData.city || ''} onChange={handleChange} className={inputClass} disabled={!formData.state}>
                  <option value="">{formData.state ? 'Selecciona Ciudad' : 'Primero elige Dpto'}</option>
                  {availableCities.map((c: string) => <option key={c} value={c}>{c}</option>)}
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
    case 'investment': {
      modalTitle = 'Preferencias de Donación';
      modalContent = (
        <div className="flex flex-col gap-5">
          <div className="bg-[#f0f9e0] border border-gray-100 p-4 rounded-xl text-sm text-[#1c2b1e] leading-relaxed font-bold flex items-start gap-3">
             <Lightbulb size={20} className="text-[#72B626] shrink-0" strokeWidth={2.5} />
             <span>Definir tus límites de capital ayuda al algoritmo a mostrarte campañas que se adapten a tu perfil financiero.</span>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Donación Mínima (Bs)</label>
              <input name="minInvestment" value={formData.minInvestment || ''} onChange={handleChange} className={inputClass} placeholder="500" type="number" />
            </div>
            <div>
              <label className={labelClass}>Capacidad Máxima (Bs)</label>
              <input name="maxInvestment" value={formData.maxInvestment || ''} onChange={handleChange} className={inputClass} placeholder="50000" type="number" />
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
          <div className="w-[140px] h-[140px] rounded-full border-[5px] border-gray-100 bg-gradient-to-tr from-[#1c2b1e] to-[#72B626] flex items-center justify-center text-5xl font-black text-white shadow-xl shadow-[#1c2b1e]/20/10 overflow-hidden">
            {profile?.avatarUrl ? (
              <div className="w-full h-full" style={{ backgroundImage: `url(${profile.avatarUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                {profile?.firstName ? (profile.firstName[0] + (profile.lastName?.[0] || '')).toUpperCase() : <User size={64} strokeWidth={1} />}
              </div>
            )}
          </div>
          <p className="text-center text-[14px] text-slate-500 max-w-[280px] font-medium leading-relaxed">Utiliza una foto profesional. Puedes actualizarla directamente desde el botón de cámara en tu perfil.</p>
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
        <div className="px-5 md:px-8 py-4 md:py-6 overflow-y-auto z-10">{modalContent}</div>
        <div className="px-5 md:px-8 py-4 md:py-6 border-t border-gray-100 flex flex-col sm:flex-row gap-3 md:gap-4 z-10 bg-slate-50/30 shrink-0">
          <button className={btnSec} onClick={onClose}><X size={18} strokeWidth={2.5} /> Descartar</button>
          <button className={btnPri} onClick={handleSubmit} disabled={saving || type === 'avatar'}>
            {saving ? (<><Loader2 className="animate-spin" size={20} strokeWidth={2.5} /> Salvando Cambios...</>) : (<><Check size={20} strokeWidth={2.5} /> Confirmar Cambios</>)}
          </button>
        </div>
      </div>
    </div>
  );
}
