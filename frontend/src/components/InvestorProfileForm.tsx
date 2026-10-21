import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState } from 'react';
import type { InvestorProfile } from '../types/investor.types';
import { CategorySelector } from './CategorySelector';
import { User, Scale, Home, CircleDollarSign, Target, Sparkles, Save } from 'lucide-react';

// ── Esquema de validación (alineado con DTOs del backend) ──────────────────
const schema = z.object({
  firstName:    z.string().min(2, 'Mínimo 2 caracteres').max(100),
  lastName:     z.string().min(2, 'Mínimo 2 caracteres').max(100),
  displayName:  z.string().max(150).optional().or(z.literal('')),
  bio:          z.string().max(2000).optional().or(z.literal('')),
  investorType: z.enum(['individual', 'institutional', 'angel']).optional(),
  taxId:        z.string().max(50).optional().or(z.literal('')),
  addressLine1: z.string().max(255).optional().or(z.literal('')),
  addressLine2: z.string().max(255).optional().or(z.literal('')),
  city:         z.string().max(100).optional().or(z.literal('')),
  state:        z.string().max(100).optional().or(z.literal('')),
  country:      z.string().max(100).optional().or(z.literal('')),
  postalCode:   z.string().max(20).optional().or(z.literal('')),
  minInvestment: z.coerce.number().positive().optional().or(z.literal('' as any)),
  maxInvestment: z.coerce.number().positive().optional().or(z.literal('' as any)),
});

type FormValues = z.infer<typeof schema>;

interface Props {
  profile: InvestorProfile | null;
  saving: boolean;
  isNew: boolean;
  onSubmit: (data: FormValues & { preferredCategories: string[] }) => void;
}

export function InvestorProfileForm({ profile, saving, isNew, onSubmit }: Props) {
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      firstName:    '',
      lastName:     '',
      displayName:  '',
      bio:          '',
      investorType: 'individual',
      taxId:        '',
      addressLine1: '',
      addressLine2: '',
      city:         '',
      state:        '',
      country:      '',
      postalCode:   '',
      minInvestment: '' as any,
      maxInvestment: '' as any,
    },
  });

  // Pre-llenar formulario si ya existe perfil
  useEffect(() => {
    if (profile) {
      reset({
        firstName:    profile.firstName,
        lastName:     profile.lastName,
        displayName:  profile.displayName ?? '',
        bio:          profile.bio ?? '',
        investorType: profile.investorType,
        taxId:        profile.taxId ?? '',
        addressLine1: profile.addressLine1 ?? '',
        addressLine2: profile.addressLine2 ?? '',
        city:         profile.city ?? '',
        state:        profile.state ?? '',
        country:      profile.country ?? '',
        postalCode:   profile.postalCode ?? '',
        minInvestment: profile.minInvestment ?? ('' as any),
        maxInvestment: profile.maxInvestment ?? ('' as any),
      });
      // Cargar categorías seleccionadas previamente
      setSelectedCategories(profile.preferredCategories ?? []);
    }
  }, [profile, reset]);

  const inputClass = "w-full border-gray-200 border-[1.5px] rounded-xl px-4 py-3 text-[15px] outline-none transition-all bg-gray-50/50 focus:bg-white focus:border-[#72B626] focus:ring-4 focus:ring-[#72B626]/10 placeholder:text-gray-400 font-medium";
  const labelClass = "text-[12px] font-black text-slate-500 mb-2 block uppercase tracking-wider ml-1";
  const sectionTitle = "text-[14px] font-black text-[#1c2b1e] border-b border-gray-100 pb-3 mb-6 uppercase tracking-widest flex items-center gap-2";
  const errorClass = "border-[#c62828] focus:border-[#c62828] focus:ring-red-500/10 bg-red-50 focus:bg-red-50";

  return (
    <form className="flex flex-col gap-12 font-['Plus Jakarta Sans',sans-serif]" onSubmit={handleSubmit((data) => onSubmit({ ...data, preferredCategories: selectedCategories }))} noValidate>

      {/* ── DATOS PERSONALES ─────────────────────────────── */}
      <div className="flex flex-col">
        <div className={sectionTitle}>
           <span className="w-8 h-8 rounded-lg bg-[#f0f9e0] text-[#72B626] flex items-center justify-center text-sm shadow-sm border border-gray-100">
             <User size={16} strokeWidth={2.5} />
           </span>
           Identidad & Trayectoria
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="flex flex-col">
            <label htmlFor="firstName" className={labelClass}>Nombre <span className="text-[#c62828]">*</span></label>
            <input
              id="firstName"
              type="text"
              placeholder="Laura"
              className={`${inputClass} ${errors.firstName ? errorClass : ''}`}
              {...register('firstName')}
            />
            {errors.firstName && <span className="text-[11px] font-bold text-[#c62828] mt-2 ml-1">{errors.firstName.message}</span>}
          </div>

          <div className="flex flex-col">
            <label htmlFor="lastName" className={labelClass}>Apellido <span className="text-[#c62828]">*</span></label>
            <input
              id="lastName"
              type="text"
              placeholder="Gómez"
              className={`${inputClass} ${errors.lastName ? errorClass : ''}`}
              {...register('lastName')}
            />
            {errors.lastName && <span className="text-[11px] font-bold text-[#c62828] mt-2 ml-1">{errors.lastName.message}</span>}
          </div>

          <div className="flex flex-col">
            <label htmlFor="displayName" className={labelClass}>Nombre público (Avatar)</label>
            <input
              id="displayName"
              type="text"
              placeholder="Laura G."
              className={inputClass}
              {...register('displayName')}
            />
          </div>

          <div className="flex flex-col relative">
            <label htmlFor="investorType" className={labelClass}>Tipo de perfil donador</label>
            <select id="investorType" {...register('investorType')} className={`${inputClass} cursor-pointer appearance-none bg-[url('https://www.svgrepo.com/show/511116/dropdown.svg')] bg-[length:16px] bg-[right_1rem_center] bg-no-repeat`}>
              <option value="individual">Individual</option>
              <option value="institutional">Institucional</option>
              <option value="angel">Donador Ángel</option>
            </select>
          </div>

          <div className="flex flex-col md:col-span-2">
            <label htmlFor="bio" className={labelClass}>Resumen de Trayectoria</label>
            <textarea
              id="bio"
              rows={4}
              placeholder="Donadora con experiencia en proyectos de tecnología y sostenibilidad..."
              className={`${inputClass} resize-none`}
              {...register('bio')}
            />
          </div>
        </div>
      </div>

      {/* ── INFORMACIÓN FISCAL ───────────────────────────── */}
      <div className="flex flex-col">
        <div className={sectionTitle}>
           <span className="w-8 h-8 rounded-lg bg-[#f0f9e0] text-[#72B626] flex items-center justify-center text-sm shadow-sm border border-gray-100">
             <Scale size={16} strokeWidth={2.5} />
           </span>
           Documentación de Capital
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="flex flex-col">
            <label htmlFor="taxId" className={labelClass}>CI / NIT / Tax ID</label>
            <input
              id="taxId"
              type="text"
              placeholder="123456789"
              className={inputClass}
              {...register('taxId')}
            />
          </div>
        </div>
      </div>

      {/* ── DIRECCIÓN ────────────────────────────────────── */}
      <div className="flex flex-col">
        <div className={sectionTitle}>
           <span className="w-8 h-8 rounded-lg bg-[#f0f9e0] text-[#1c2b1e] flex items-center justify-center text-sm shadow-sm border border-gray-100">
             <Home size={16} strokeWidth={2.5} />
           </span>
           Residencia Operativa
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="flex flex-col md:col-span-2">
            <label htmlFor="addressLine1" className={labelClass}>Dirección Principal</label>
            <input
              id="addressLine1"
              type="text"
              placeholder="Calle 72 #10-34"
              className={inputClass}
              {...register('addressLine1')}
            />
          </div>

          <div className="flex flex-col md:col-span-2">
            <label htmlFor="addressLine2" className={labelClass}>Complemento (Apto, Bloque, Oficina)</label>
            <input
              id="addressLine2"
              type="text"
              placeholder="Torre 2, AP 501"
              className={inputClass}
              {...register('addressLine2')}
            />
          </div>

          <div className="flex flex-col">
            <label htmlFor="city" className={labelClass}>Ciudad</label>
            <input id="city" type="text" placeholder="Medellín" className={inputClass} {...register('city')} />
          </div>

          <div className="flex flex-col">
            <label htmlFor="state" className={labelClass}>Estado / Departamento</label>
            <input id="state" type="text" placeholder="Antioquia" className={inputClass} {...register('state')} />
          </div>

          <div className="flex flex-col">
            <label htmlFor="country" className={labelClass}>País de Residencia</label>
            <input id="country" type="text" placeholder="Colombia" className={inputClass} {...register('country')} />
          </div>

          <div className="flex flex-col">
            <label htmlFor="postalCode" className={labelClass}>Código Postal</label>
            <input id="postalCode" type="text" placeholder="050001" className={inputClass} {...register('postalCode')} />
          </div>
        </div>
      </div>

      {/* ── PREFERENCIAS DE DONACIÓN ────────────────────── */}
      <div className="flex flex-col">
        <div className={sectionTitle}>
           <span className="w-8 h-8 rounded-lg bg-[#aed581]/20 text-[#72B626] flex items-center justify-center text-sm shadow-sm border border-[#aed581]/50">
             <CircleDollarSign size={16} strokeWidth={2.5} />
           </span>
           Límites de Capital
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="flex flex-col">
            <label htmlFor="minInvestment" className={labelClass}>Donación Mínima (Bs)</label>
            <input
              id="minInvestment"
              type="number"
              placeholder="500"
              min="1"
              className={`${inputClass} ${errors.minInvestment ? errorClass : ''}`}
              {...register('minInvestment')}
            />
            {errors.minInvestment && <span className="text-[11px] font-bold text-[#c62828] mt-2 ml-1">{String(errors.minInvestment.message)}</span>}
          </div>

          <div className="flex flex-col">
            <label htmlFor="maxInvestment" className={labelClass}>Capacidad Máxima (Bs)</label>
            <input
              id="maxInvestment"
              type="number"
              placeholder="50000"
              min="1"
              className={`${inputClass} ${errors.maxInvestment ? errorClass : ''}`}
              {...register('maxInvestment')}
            />
            {errors.maxInvestment && <span className="text-[11px] font-bold text-[#c62828] mt-2 ml-1">{String(errors.maxInvestment.message)}</span>}
          </div>
        </div>
      </div>

      {/* ── SECTORES DE INTERÉS ──────────────────────────── */}
      <div className="flex flex-col">
        <div className={sectionTitle}>
           <span className="w-8 h-8 rounded-lg bg-[#f0f9e0] text-[#72B626] flex items-center justify-center text-sm shadow-sm border border-gray-100">
             <Target size={16} strokeWidth={2.5} />
           </span>
           Sectores de Interés Técnico
        </div>
        <CategorySelector
          selected={selectedCategories}
          onChange={setSelectedCategories}
        />
      </div>

      {/* ── ACCIONES ─────────────────────────────────────── */}
      <div className="mt-4 pt-8 border-t border-gray-100 flex justify-end">
        <button
          type="submit"
          id="btn-save-profile"
          className="bg-[#72B626] hover:bg-[#1c2b1e] text-white font-black px-12 py-4 rounded-xl transition-all active:scale-95 shadow-lg shadow-[#72B626]/20/20 border-none cursor-pointer flex items-center justify-center gap-3 disabled:opacity-50"
          disabled={saving}
        >
          {saving ? (
            <>
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Sincronizando Cambios...
            </>
          ) : (
            <>
              {isNew ? (
                <>
                  <Sparkles size={20} strokeWidth={2.5} />
                  Crear Perfil Corporativo
                </>
              ) : (
                <>
                  <Save size={20} strokeWidth={2.5} />
                  Actualizar Perfil Corporativo
                </>
              )}
            </>
          )}
        </button>
      </div>
    </form>
  );
}
