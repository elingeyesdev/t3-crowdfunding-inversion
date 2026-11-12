import { useState, useEffect, useRef } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { AlertCircle, Save, X, Plus, Trash2, Gift, Edit2, Send } from 'lucide-react';
import type { CreateRewardTierDto, EntrepreneurCampaign, CreateCampaignDto } from '../types/campaign.types';
import type { Category } from '../types/category.types';
import { getCategories } from '../api/categories.api';
import { getImageUrl } from '../utils/image.utils';
import { formatNumberSpanish, isFutureDate } from '../utils/numberFormat';
import { InfoHint } from './InfoHint';



const schema = z.object({
  title: z.string().min(5, 'El título debe tener entre 5 y 50 caracteres').max(50, 'El título debe tener entre 5 y 50 caracteres'),
  description: z.string().min(50, 'La descripción debe tener entre 50 y 800 caracteres').max(800, 'La descripción debe tener entre 50 y 800 caracteres'),
  shortDescription: z.string().min(10, 'El eslogan debe tener entre 10 y 50 caracteres').max(50, 'El eslogan debe tener entre 10 y 50 caracteres'),
  goalAmount: z.number().min(100, 'La meta mínima es Bs. 100'),
  categoryIds: z.array(z.string()).min(1, 'Debes seleccionar al menos una categoría'),
  endDate: z.string().optional().or(z.literal(''))
    .refine((val) => !val || isFutureDate(val), {
      message: 'La fecha de cierre debe ser posterior a hoy',
    }),
  videoUrl: z.string().optional().or(z.literal(''))
    .refine((val) => !val || /(youtube\.com|youtu\.be|tiktok\.com)/i.test(val), {
      message: 'El enlace debe ser un video válido de YouTube o TikTok',
    }),
});

type FormValues = z.infer<typeof schema>;

type ConfirmAction = 'discard' | 'draft' | 'review' | null;

interface Props {
  initialData?: EntrepreneurCampaign | null;
  onSuccess: (dto: CreateCampaignDto, coverFile?: File, documents?: { file: File; justification: string }[]) => Promise<boolean>;
  onSubmitForReview?: (dto: CreateCampaignDto, coverFile?: File, documents?: { file: File; justification: string }[]) => Promise<boolean>;
  onCancel: () => void;
  saving: boolean;
  saveError: string | null;
}

export function CampaignForm({ initialData, onSuccess, onSubmitForReview, onCancel, saving, saveError }: Props) {
  const {
    register,
    handleSubmit,
    reset,
    watch,
    control,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: initialData?.title || '',
      description: initialData?.description || '',
      shortDescription: initialData?.shortDescription || '',
      goalAmount: initialData?.goalAmount || 1000,
      categoryIds: initialData?.categoryIds || (initialData?.categoryId ? [initialData.categoryId] : []),
      endDate: initialData?.endDate ? new Date(initialData.endDate).toISOString().slice(0, 16) : '',
      videoUrl: initialData?.videoUrl || '',
    },
  });


  const titleVal = watch('title') || '';
  const sloganVal = watch('shortDescription') || '';
  const descVal = watch('description') || '';

  const descriptionRef = useRef<HTMLTextAreaElement | null>(null);

  const [categories, setCategories] = useState<Category[]>([]);
  const [loadingCats, setLoadingCats] = useState(true);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(getImageUrl(initialData?.coverImageUrl) || null);
  
  const [rewards, setRewards] = useState<CreateRewardTierDto[]>([]);
  const [showRewardForm, setShowRewardForm] = useState(false);
  const [editingRewardIndex, setEditingRewardIndex] = useState<number | null>(null);
  const [documents, setDocuments] = useState<{ file: File; justification: string }[]>([]);
  const [docFile, setDocFile] = useState<File | null>(null);
  const [docJustification, setDocJustification] = useState('');
  const [docError, setDocError] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
  const [pendingFormData, setPendingFormData] = useState<any>(null);

  const [rewardData, setRewardData] = useState<CreateRewardTierDto>({
    title: '',
    description: '',
    minPercentage: 0,
    maxPercentage: 10
  });

  // Sync rewards when editing
  useEffect(() => {
    if (initialData?.rewardTiers) {
      console.log('CampaignForm: Loading rewards from initialData', initialData.rewardTiers);
      setRewards(initialData.rewardTiers.map(rt => ({
        title: rt.title,
        description: rt.description,
        minPercentage: rt.minPercentage || 0,
        maxPercentage: rt.maxPercentage || 100
      })));
    } else {
      setRewards([]);
    }
  }, [initialData]);

  useEffect(() => {
    let mounted = true;
    getCategories()
      .then((data) => {
        if (mounted) setCategories(data);
      })
      .catch(console.error)
      .finally(() => {
        if (mounted) setLoadingCats(false);
      });
    return () => { mounted = false; };
  }, []);

  // Auto-expand textarea logic
  useEffect(() => {
    if (descriptionRef.current) {
      descriptionRef.current.style.height = 'auto';
      descriptionRef.current.style.height = `${descriptionRef.current.scrollHeight}px`;
    }
  }, [descVal]);

  // Sincronizar valores cuando se cargan las categorías o cambia initialData
  useEffect(() => {
    if (!loadingCats && initialData) {
      reset({
        title: initialData.title || '',
        description: initialData.description || '',
        shortDescription: initialData.shortDescription || '',
        goalAmount: initialData.goalAmount || 1000,
        categoryIds: initialData.categoryIds || (initialData.categoryId ? [initialData.categoryId] : []),
        endDate: initialData.endDate ? new Date(initialData.endDate).toISOString().slice(0, 16) : '',
        videoUrl: initialData.videoUrl || '',
      });
    }
  }, [loadingCats, initialData, reset]);

  const addReward = () => {
    if (!rewardData.title || !rewardData.description) {
      alert('Por favor completa el título y la descripción.');
      return;
    }

    if (rewardData.minPercentage < 0 || rewardData.maxPercentage > 100 || rewardData.minPercentage >= rewardData.maxPercentage) {
      alert('Los porcentajes son inválidos.');
      return;
    }

    if (editingRewardIndex !== null) {
      const updated = [...rewards];
      updated[editingRewardIndex] = { ...rewardData };
      setRewards(updated);
      setEditingRewardIndex(null);
    } else {
      setRewards([...rewards, { ...rewardData }]);
    }
    
    setRewardData({ title: '', description: '', minPercentage: 0, maxPercentage: 10 });
    setShowRewardForm(false);
  };

  const handleAddDocument = () => {
    if (!docFile || !docJustification) {
      alert('Debes seleccionar un archivo y proporcionar una justificación.');
      return;
    }
    setDocuments([...documents, { file: docFile, justification: docJustification }]);
    setDocFile(null);
    setDocJustification('');
    setDocError(null);
  };

  const removeDocument = (index: number) => {
    setDocuments(documents.filter((_, i) => i !== index));
  };

  const editRewardItem = (index: number) => {
    setRewardData({ ...rewards[index] });
    setEditingRewardIndex(index);
    setShowRewardForm(true);
  };

  const removeReward = (index: number) => {
    setRewards(rewards.filter((_, i) => i !== index));
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

  const buildDto = (data: FormValues): CreateCampaignDto => ({
    title: data.title,
    description: data.description,
    shortDescription: data.shortDescription || undefined,
    categoryIds: data.categoryIds,
    goalAmount: data.goalAmount,
    endDate: data.endDate ? `${data.endDate}:00.000Z` : undefined,
    rewards: rewards,
    videoUrl: data.videoUrl || undefined,
  });

  const requestAction = (action: 'draft' | 'review', data: FormValues) => {
    if (documents.length === 0) {
      setDocError('Debes adjuntar al menos un documento de respaldo para continuar.');
      return;
    }
    setDocError(null);
    setPendingFormData(data);
    setConfirmAction(action);
  };

  const onSubmit = (data: FormValues) => requestAction('draft', data);

  const handleConfirm = async () => {
    if (!confirmAction || !pendingFormData) return;
    if (confirmAction === 'discard') {
      setConfirmAction(null);
      onCancel();
      return;
    }
    const dto = buildDto(pendingFormData);
    setConfirmAction(null);
    setPendingFormData(null);
    let success = false;
    if (confirmAction === 'review' && onSubmitForReview) {
      success = await onSubmitForReview(dto, coverFile || undefined, documents);
    } else {
      success = await onSuccess(dto, coverFile || undefined, documents);
    }
    if (success) onCancel();
  };

  const inputClass = "w-full border-gray-200 border-[1.5px] rounded-xl px-4 py-3 text-[15px] outline-none transition-all bg-gray-50/50 focus:bg-white focus:border-[#72B626] focus:ring-4 focus:ring-green-500/10 placeholder:text-gray-400 font-medium";
  const labelClass = "text-[12px] font-black text-slate-500 mb-2 block uppercase tracking-wider ml-1";
  const errorClass = "border-[#c62828] focus:border-[#c62828] focus:ring-red-500/10 bg-red-50 focus:bg-red-50";

  return (
    <div className="bg-white rounded-[32px] p-8 md:p-12 shadow-xl shadow-gray-900/5 border border-green-50 animate-in fade-in zoom-in-95 duration-500 font-['Plus Jakarta Sans',sans-serif]">
      <div className="mb-10">
        <h2 className="text-2xl font-black text-[#1c2b1e] tracking-tight mb-2 leading-none">
          {initialData ? 'Actualizar campaña' : 'Lanzar nueva campaña'}
        </h2>
        <p className="text-[14px] font-medium text-slate-400">
          {initialData 
            ? 'Ajusta los detalles de tu propuesta para cumplir con los requisitos de revisión.' 
            : 'Completa los datos esenciales para presentar tu idea al mundo con solidez financiera.'}
        </p>
      </div>

      {saveError && (
        <div className="bg-red-50 border border-red-100 text-[#c62828] p-5 rounded-2xl text-[14px] font-bold mb-8 flex items-center gap-3 animate-in slide-in-from-top-2 duration-300">
           <AlertCircle size={20} strokeWidth={2.5} />
           {saveError}
        </div>
      )}

      <form className="flex flex-col gap-8" onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Fila 1: Título (2/3) y Meta de Recaudación (1/3) */}
          <div className="flex flex-col md:col-span-2">
            <div className="flex justify-between items-end mb-2">
              <label htmlFor="title" className={labelClass + " mb-0 flex items-center gap-2"}>Título de la Campaña <span className="text-[#c62828] font-bold">*</span><InfoHint text="Nombre principal de tu campaña. Debe ser claro y memorable." /></label>
              <span className={`text-[10px] font-bold ${titleVal.length > 50 ? 'text-red-500' : 'text-slate-400'}`}>
                {titleVal.length}/50
              </span>
            </div>
            <input
              id="title"
              type="text"
              placeholder="E.g. Botellas de agua reusables del océano"
              className={`${inputClass} ${errors.title ? errorClass : ''}`}
              maxLength={50}
              {...register('title')}
            />
            {errors.title && <span className="text-[11px] font-bold text-[#c62828] mt-2 ml-1">{errors.title.message}</span>}
          </div>

          <div className="flex flex-col md:col-span-1">
            <label htmlFor="goalAmount" className={`${labelClass} flex items-center gap-2`}>Meta de Recaudación (Bs) <span className="text-[#c62828] font-bold">*</span><InfoHint text="Monto total que quieres alcanzar con la campaña." /></label>
            <Controller
              name="goalAmount"
              control={control}
              render={({ field }) => (
                <input
                  {...field}
                  id="goalAmount"
                  type="text"
                  placeholder="1.000"
                  className={`${inputClass} ${errors.goalAmount ? errorClass : ''}`}
                  maxLength={15}
                  value={formatNumberSpanish(field.value)}
                  onChange={(e) => {
                    const rawValue = e.target.value.replace(/[^0-9]/g, '');
                    field.onChange(parseInt(rawValue, 10) || 0);
                  }}
                />
              )}
            />
            {errors.goalAmount && <span className="text-[11px] font-bold text-[#c62828] mt-2 ml-1">{String(errors.goalAmount.message)}</span>}
          </div>

          {/* Fila 2: Categorías (Ancho completo 3/3) */}
          <div className="flex flex-col md:col-span-3">
            <label className={`${labelClass} flex items-center gap-2`}>Etiquetas de Categoría <span className="text-[#c62828] font-bold">*</span><InfoHint text="Selecciona sectores relacionados al proyecto." /></label>
            <div className="flex flex-wrap gap-2 mt-2">
              {loadingCats ? (
                <div className="text-sm text-slate-500">Cargando categorías...</div>
              ) : (
                categories.map(c => (
                  <label key={c.id} className="cursor-pointer flex items-center bg-gray-50 border border-gray-200 rounded-full px-4 py-2 hover:bg-green-50 hover:border-emerald-200 transition-colors">
                    <input
                      type="checkbox"
                      value={c.id}
                      className="hidden"
                      {...register('categoryIds')}
                    />
                    <span className={`text-[13px] font-bold ${watch('categoryIds')?.includes(c.id) ? 'text-emerald-700' : 'text-slate-600'}`}>
                      {watch('categoryIds')?.includes(c.id) ? '✓ ' : ''}{c.displayName}
                    </span>
                  </label>
                ))
              )}
            </div>
            {errors.categoryIds && <span className="text-[11px] font-bold text-[#c62828] mt-2 ml-1">{errors.categoryIds.message}</span>}
          </div>

          {/* Fila 3: Eslogan / Frase corta (2/3) y Fecha de cierre (1/3) */}
          <div className="flex flex-col md:col-span-2">
            <div className="flex justify-between items-end mb-2">
              <label htmlFor="shortDescription" className={labelClass + " mb-0 flex items-center gap-2"}>Eslogan / Frase corta <span className="text-[#c62828] font-bold">*</span><InfoHint text="Resumen breve para captar atención inmediata." /></label>
              <span className={`text-[10px] font-bold ${sloganVal.length > 50 ? 'text-red-500' : 'text-slate-400'}`}>
                {sloganVal.length}/50
              </span>
            </div>
            <input
              id="shortDescription"
              type="text"
              placeholder="Una frase impactante que defina tu proyecto"
              className={`${inputClass} ${errors.shortDescription ? errorClass : ''}`}
              maxLength={50}
              {...register('shortDescription')}
            />
            {errors.shortDescription && <span className="text-[11px] font-bold text-[#c62828] mt-2 ml-1">{errors.shortDescription.message}</span>}
          </div>

          <div className="flex flex-col md:col-span-1">
            <label htmlFor="endDate" className={`${labelClass} flex items-center gap-2`}>Fecha de Cierre (Opcional)<InfoHint text="Fecha límite para recibir aportes." /></label>
            <input
              id="endDate"
              type="datetime-local"
              className={`${inputClass} ${errors.endDate ? errorClass : ''}`}
              min={(() => {
                const now = new Date();
                const y = now.getFullYear();
                const m = String(now.getMonth() + 1).padStart(2, '0');
                const d = String(now.getDate()).padStart(2, '0');
                const h = String(now.getHours()).padStart(2, '0');
                const mi = String(now.getMinutes()).padStart(2, '0');
                return `${y}-${m}-${d}T${h}:${mi}`;
              })()}
              {...register('endDate')}
            />
            {errors.endDate && <span className="text-[11px] font-bold text-[#c62828] mt-2 ml-1">{String(errors.endDate.message)}</span>}
          </div>

          {/* Fila 4: Video Pitch URL (Ancho completo 3/3) */}
          <div className="flex flex-col md:col-span-3">
            <label htmlFor="videoUrl" className={`${labelClass} flex items-center gap-2`}>URL de Video Pitch (YouTube / TikTok - Opcional)<InfoHint text="Enlace de video para presentar el proyecto." /></label>
            <input
              id="videoUrl"
              type="text"
              placeholder="Ej: https://www.youtube.com/watch?v=dQw4w9WgXcQ o https://www.tiktok.com/@usuario/video/123456789"
              className={`${inputClass} ${errors.videoUrl ? errorClass : ''}`}
              {...register('videoUrl')}
            />
            {errors.videoUrl ? (
              <span className="text-[11px] font-bold text-[#c62828] mt-2 ml-1">{errors.videoUrl.message}</span>
            ) : (
              <span className="text-[11px] text-slate-400 mt-2 ml-1 leading-relaxed">
                Agrega un enlace para mostrar el pitch de tu proyecto en <strong>DonaTok</strong>. 
                Soporta videos estándar de YouTube, Shorts de YouTube y videos de TikTok. 
                <em> Usa la URL directa del navegador.</em>
              </span>
            )}
          </div>

          {/* Fila 5: Imagen de Portada (Ancho completo 3/3) */}
          <div className="flex flex-col md:col-span-3">
            <label className={`${labelClass} flex items-center gap-2`}>Imagen de Portada <InfoHint text="Sube una imagen horizontal de buena calidad (JPG/PNG)." /></label>
            <div 
              className={`relative h-[200px] rounded-2xl border-2 border-dashed transition-all flex flex-col items-center justify-center overflow-hidden cursor-pointer ${coverPreview ? 'border-[#72B626] bg-green-50/10' : 'border-gray-200 hover:border-emerald-300 hover:bg-green-50/30'}`}
              onClick={() => document.getElementById('cover-upload')?.click()}
            >
              {coverPreview ? (
                <img src={coverPreview} className="w-full h-full object-cover" alt="Preview" />
              ) : (
                <div className="flex flex-col items-center text-slate-400">
                  <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mb-2">
                    <Save size={24} className="text-slate-300" />
                  </div>
                  <p className="text-[13px] font-bold">Seleccionar imagen de portada</p>
                  <p className="text-[11px]">Recomendado: 1200x600px (JPG, PNG)</p>
                </div>
              )}
              <input 
                id="cover-upload" 
                type="file" 
                accept="image/*" 
                className="hidden" 
                onChange={handleFileChange} 
              />
              {coverPreview && (
                <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
                   <span className="bg-white text-[#1c2b1e] px-4 py-2 rounded-lg text-[12px] font-black uppercase tracking-widest">Cambiar Imagen</span>
                </div>
              )}
            </div>
          </div>

          {/* Fila 6: Propuesta de valor en detalle (Ancho completo 3/3) */}
          <div className="flex flex-col md:col-span-3">
            <div className="flex justify-between items-end mb-2">
              <label htmlFor="description" className={labelClass + " mb-0 flex items-center gap-2"}>Propuesta de Valor en Detalle <span className="text-[#c62828] font-bold">*</span><InfoHint text="Explica problema, solución y uso de fondos." /></label>
              <span className={`text-[10px] font-bold ${descVal.length > 800 ? 'text-red-500' : 'text-slate-400'}`}>
                {descVal.length}/800
              </span>
            </div>
            <textarea
              id="description"
              placeholder="Cuenta tu historia, el origen de tu idea y cómo planeas usar el capital..."
              className={`${inputClass} resize-none overflow-hidden ${errors.description ? errorClass : ''}`}
              maxLength={800}
              {...register('description')}
              ref={(e) => {
                register('description').ref(e);
                descriptionRef.current = e;
              }}
            />
            {errors.description && <span className="text-[11px] font-bold text-[#c62828] mt-2 ml-1">{errors.description.message}</span>}
          </div>
        </div>

        <div className="bg-slate-50/50 rounded-3xl p-6 md:p-8 border border-green-50">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8">
            <div>
              <h3 className="text-lg font-black text-[#1c2b1e] tracking-tight mb-1 flex items-center gap-2">
                <Gift size={20} className="text-amber-500" />
                Estructura de Recompensas
              </h3>
              <p className="text-[13px] text-slate-500 font-medium">
                Define beneficios automáticos basados en el porcentaje de contribución respecto a la meta.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowRewardForm(true)}
              className="bg-white hover:bg-green-50 text-[#72B626] font-black px-6 py-2.5 rounded-xl border border-green-100 shadow-sm transition-all active:scale-95 flex items-center gap-2 text-[13px]"
            >
              <Plus size={16} strokeWidth={3} />
              Agregar Nivel
            </button>
          </div>

          {/* Rewards List */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {rewards.length === 0 ? (
                <div className="md:col-span-2 py-12 text-center border-2 border-dashed border-slate-200 rounded-2xl bg-white/50">
                  <p className="text-slate-400 font-medium text-[14px]">No has definido recompensas aún.</p>
                </div>
              ) : (
                rewards.map((r, idx) => (
                  <div key={idx} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex justify-between items-start group">
                    <div>
                      <h4 className="font-black text-[#1c2b1e] text-[15px] mb-1">{r.title}</h4>
                      <p className="text-[12px] text-slate-500 font-medium mb-3 line-clamp-1">{r.description}</p>
                      <div className="flex gap-4">
                        <div className="text-[11px] font-black text-[#72B626] bg-green-50 px-2 py-1 rounded-md uppercase">
                          {r.minPercentage}% - {r.maxPercentage}%
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => editRewardItem(idx)}
                        className="p-2 text-slate-300 hover:text-emerald-600 transition-colors"
                        title="Editar Nivel"
                      >
                        <Edit2 size={18} />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeReward(idx)}
                        className="p-2 text-slate-300 hover:text-red-500 transition-colors"
                        title="Eliminar Nivel"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Reward Add Form (Modal/Overlay style) */}
            {showRewardForm && (
              <div className="fixed inset-0 bg-[#1c2b1e]/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                <div className="bg-white rounded-[32px] w-full max-w-md p-8 shadow-2xl animate-in zoom-in-95 duration-300">
                  <h4 className="text-xl font-black text-[#1c2b1e] mb-6 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center">
                      {editingRewardIndex !== null ? <Edit2 size={20} className="text-[#72B626]" /> : <Plus size={20} className="text-[#72B626]" />}
                    </div>
                    {editingRewardIndex !== null ? 'Editar Nivel' : 'Nuevo Nivel'}
                  </h4>
                  
                  <div className="space-y-5">
                    <div>
                      <label className={`${labelClass} flex items-center gap-2`}>Título * <InfoHint text="Nombre del nivel de recompensa." /></label>
                      <input 
                        type="text" 
                        className={inputClass}
                        value={rewardData.title}
                        onChange={e => setRewardData({...rewardData, title: e.target.value})}
                        placeholder="Ej. Acceso Anticipado"
                        maxLength={100}
                      />
                    </div>
                    <div>
                      <label className={`${labelClass} flex items-center gap-2`}>Descripción * <InfoHint text="Beneficios concretos que recibirá el donante." /></label>
                      <textarea 
                        className={`${inputClass} resize-none`}
                        rows={3}
                        value={rewardData.description}
                        onChange={e => setRewardData({...rewardData, description: e.target.value})}
                        placeholder="Qué incluye este beneficio..."
                        maxLength={500}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className={`${labelClass} flex items-center gap-2`}>Porcentaje Mínimo (%) * <InfoHint text="Aporte mínimo para desbloquear este nivel." /></label>
                        <input 
                          type="number" 
                          className={inputClass}
                          value={rewardData.minPercentage}
                          onChange={e => {
                            setRewardData({...rewardData, minPercentage: Number(e.target.value)});
                          }}
                          placeholder="0"
                          min="0"
                          max="100"
                        />
                      </div>
                      <div>
                        <label className={`${labelClass} flex items-center gap-2`}>Porcentaje Máximo (%) * <InfoHint text="Tope de aporte para este nivel." /></label>
                        <input 
                          type="number" 
                          className={inputClass}
                          value={rewardData.maxPercentage}
                          onChange={e => {
                            setRewardData({...rewardData, maxPercentage: Number(e.target.value)});
                          }}
                          placeholder="100"
                          min="0"
                          max="100"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-3 mt-8">
                    <button
                      type="button"
                      onClick={() => {
                        setShowRewardForm(false);
                        setEditingRewardIndex(null);
                        setRewardData({ title: '', description: '', minPercentage: 0, maxPercentage: 10 });
                      }}
                      className="flex-1 px-6 py-3 rounded-xl bg-slate-100 text-slate-600 font-bold text-[14px] active:scale-95 transition-all"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={addReward}
                      className="flex-1 px-6 py-3 rounded-xl bg-[#72B626] text-white font-black text-[14px] active:scale-95 transition-all"
                    >
                      {editingRewardIndex !== null ? 'Guardar Cambios' : 'Agregar'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

        {/* Documents Section */}
        <div className="bg-slate-50/50 rounded-3xl p-6 md:p-8 border border-green-50">
          <div className="mb-6">
            <h3 className="text-lg font-black text-[#1c2b1e] tracking-tight mb-1 flex items-center gap-2">
              <AlertCircle size={20} className="text-[#72B626]" />
              Documentación de Respaldo <span className="text-[#c62828] font-bold">*</span>
            </h3>
            <p className="text-[13px] text-slate-500 font-medium">
              Sube los documentos que certifican la veracidad de tu campaña (ej. cotizaciones, permisos, actas).
            </p>
            {docError && (
              <p className="text-[12px] font-bold text-[#c62828] mt-2 flex items-center gap-1">
                <AlertCircle size={13} /> {docError}
              </p>
            )}
          </div>

          <div className="space-y-4 mb-6">
            {documents.length === 0 ? (
              <p className="text-[13px] text-slate-400">No hay documentos adjuntos aún.</p>
            ) : (
              documents.map((doc, idx) => (
                <div key={idx} className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-200">
                  <div>
                    <p className="font-bold text-[14px]">{doc.file.name}</p>
                    <p className="text-[12px] text-slate-500">{doc.justification}</p>
                  </div>
                  <button type="button" onClick={() => removeDocument(idx)} className="text-red-500 hover:bg-red-50 p-2 rounded-lg">
                    <Trash2 size={16} />
                  </button>
                </div>
              ))
            )}
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={`${labelClass} flex items-center gap-2`}>Archivo * <InfoHint text="Documento de respaldo: permisos, cotizaciones, evidencias, etc." /></label>
                <input
                  type="file"
                  className={inputClass}
                  onChange={e => setDocFile(e.target.files?.[0] || null)}
                />
              </div>
              <div>
                <label className={`${labelClass} flex items-center gap-2`}>Justificación * <InfoHint text="Describe por qué este documento valida tu campaña." /></label>
                <input
                  type="text"
                  placeholder="Ej. Cotización oficial del proveedor"
                  className={inputClass}
                  value={docJustification}
                  onChange={e => setDocJustification(e.target.value)}
                />
              </div>
            </div>
            <button
              type="button"
              onClick={handleAddDocument}
              className="mt-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-4 py-2 rounded-lg text-[13px] transition-colors"
            >
              Añadir Documento
            </button>
          </div>
        </div>

        <div className="flex flex-col md:flex-row justify-end items-center gap-4 mt-8 pt-8 border-t border-green-50">
          <button
            type="button"
            className="w-full md:w-auto bg-slate-50 hover:bg-red-50 text-slate-500 hover:text-[#c62828] font-bold px-8 py-3.5 rounded-xl transition-all border-none active:scale-95 cursor-pointer text-[14px] flex items-center justify-center gap-2"
            onClick={() => setConfirmAction('discard')}
            disabled={saving}
          >
            <X size={18} strokeWidth={2.5} />
            Descartar
          </button>
          <button
            type="submit"
            disabled={saving}
            className="w-full md:w-auto bg-white hover:bg-slate-100 text-[#1c2b1e] font-black px-8 py-3.5 rounded-xl transition-all active:scale-95 border border-slate-200 cursor-pointer text-[14px] flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {saving ? (
              <>
                <div className="w-5 h-5 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
                Guardando...
              </>
            ) : (
              <>
                <Save size={18} strokeWidth={2.5} />
                Guardar Borrador
              </>
            )}
          </button>
          {onSubmitForReview && (
            <button
              type="button"
              disabled={saving}
              className="w-full md:w-auto bg-[#72B626] hover:bg-[#1c2b1e] text-white font-black px-8 py-3.5 rounded-xl transition-all active:scale-95 shadow-lg shadow-green-500/20 border-none cursor-pointer text-[14px] flex items-center justify-center gap-2 disabled:opacity-50"
              onClick={handleSubmit((data) => requestAction('review', data))}
            >
              {saving ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <Send size={18} strokeWidth={2.5} />
                  Enviar a Revisión
                </>
              )}
            </button>
          )}
        </div>
      </form>

      {/* Confirmation Dialog */}
      {confirmAction && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setConfirmAction(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full animate-in fade-in zoom-in-95 duration-200">
            {confirmAction === 'discard' && (
              <>
                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4">
                  <X size={24} className="text-[#c62828]" />
                </div>
                <h3 className="text-lg font-black text-[#1c2b1e] mb-2">¿Descartar cambios?</h3>
                <p className="text-[14px] text-slate-500 mb-6">Se perderán todos los datos ingresados. Esta acción no se puede deshacer.</p>
              </>
            )}
            {confirmAction === 'draft' && (
              <>
                <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                  <Save size={24} className="text-slate-600" />
                </div>
                <h3 className="text-lg font-black text-[#1c2b1e] mb-2">¿Guardar como borrador?</h3>
                <p className="text-[14px] text-slate-500 mb-6">La campaña quedará guardada como borrador. Podrás editarla y enviarla a revisión más adelante.</p>
              </>
            )}
            {confirmAction === 'review' && (
              <>
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mb-4">
                  <Send size={24} className="text-[#72B626]" />
                </div>
                <h3 className="text-lg font-black text-[#1c2b1e] mb-2">¿Enviar a revisión?</h3>
                <p className="text-[14px] text-slate-500 mb-6">Se guardará la campaña y se enviará al equipo de revisión. Recibirás una notificación con el resultado.</p>
              </>
            )}
            <div className="flex gap-3">
              <button
                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 rounded-xl text-[14px] transition-colors border-none cursor-pointer"
                onClick={() => setConfirmAction(null)}
              >
                Cancelar
              </button>
              <button
                className={`flex-1 font-black py-3 rounded-xl text-[14px] transition-colors border-none cursor-pointer text-white ${
                  confirmAction === 'discard'
                    ? 'bg-[#c62828] hover:bg-red-800'
                    : confirmAction === 'review'
                    ? 'bg-[#72B626] hover:bg-[#1c2b1e]'
                    : 'bg-[#1c2b1e] hover:bg-slate-700'
                }`}
                onClick={handleConfirm}
              >
                {confirmAction === 'discard' ? 'Sí, descartar' : confirmAction === 'review' ? 'Sí, enviar' : 'Sí, guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
