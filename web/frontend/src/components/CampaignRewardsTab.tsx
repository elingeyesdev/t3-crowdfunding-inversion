import { useAsyncResource } from '../hooks/useAsyncResource.ts';
import { useCallback } from 'react';
import { getApiErrorMessage } from '../utils/apiError.ts';
import { useState } from 'react';
import {
  getRewardTiers,
  createRewardTier,
  updateRewardTier,
  deleteRewardTier,
  getRewardClaims,
  updateRewardClaim,
} from '../api/campaign.api';
import { getAdminRewardClaims } from '../api/admin.api';
import type {
  RewardTier,
  CreateRewardTierDto,
  UpdateRewardTierDto,
  RewardClaim,
} from '../types/campaign.types';
import {
  Gift,
  Plus,
  Edit2,
  Trash2,
  Users,
  Save,
  Loader2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { formatCampaignCurrency } from '../utils/campaignFunding';
import { rewardTrackingLabel } from '../utils/rewardTracking';

interface Props {
  campaignId: string;
  currency: string;
  readOnly?: boolean;
  isAdmin?: boolean;
  canManageClaims?: boolean;
}

export function CampaignRewardsTab({ campaignId, currency, readOnly = false, isAdmin = false, canManageClaims = !readOnly }: Props) {

  const [isEditing, setIsEditing] = useState<string | null>(null); // 'new' for new tier, or tier.id
  const [formData, setFormData] = useState<Partial<UpdateRewardTierDto>>({});
  const [submitting, setSubmitting] = useState(false);
  const [showClaims, setShowClaims] = useState(false);
  const [updatingClaimId, setUpdatingClaimId] = useState<string | null>(null);
  const [claimError, setClaimError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [tiers, claims] = await Promise.all([getRewardTiers(campaignId), isAdmin ? getAdminRewardClaims(campaignId) : getRewardClaims(campaignId)]);
    return {tiers, claims};
  }, [campaignId,isAdmin]);
  const resource = useAsyncResource(load);
  const tiers = resource.data?.tiers ?? [];
  const claims = resource.data?.claims ?? [];
  const loading = resource.loading;
  const error = resource.error ? 'Error al cargar la información de recompensas.' : null;
  const loadData = resource.retry;
  const setTiers = (tiers: RewardTier[]) => resource.setData(previous => ({tiers, claims: previous?.claims ?? []}));
  const setClaims = (value: RewardClaim[] | ((previous: RewardClaim[]) => RewardClaim[])) =>
    resource.setData((previous) => ({
      tiers: previous?.tiers ?? [],
      claims: typeof value === 'function' ? value(previous?.claims ?? []) : value,
    }));
  const handleAddNew = () => {
    setIsEditing('new');
    setFormData({
      title: '',
      description: '',
      minPercentage: 0,
      maxPercentage: 10,
      isActive: true,
      items: []
    });
  };

  const handleEdit = (tier: RewardTier) => {
    setIsEditing(tier.id);
    setFormData({
      title: tier.title,
      description: tier.description,
      minPercentage: tier.minPercentage || 0,
      maxPercentage: tier.maxPercentage || 100,
      isActive: tier.isActive,
      items: tier.items || []
    });
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar este nivel de recompensa?')) return;
    try {
      await deleteRewardTier(campaignId, id);
      setTiers(tiers.filter(t => t.id !== id));
    } catch (err: unknown) {
      alert(getApiErrorMessage(err, '') || 'Error al eliminar. Puede que ya tenga reclamos, en ese caso debes desactivarla.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (readOnly) return;
    if (!formData.title || !formData.description || formData.minPercentage === undefined || formData.maxPercentage === undefined) {
      alert('Por favor completa todos los campos requeridos (*)');
      return;
    }

    if (formData.minPercentage < 0 || formData.maxPercentage > 100 || formData.minPercentage >= formData.maxPercentage) {
      alert('Los porcentajes son inválidos.');
      return;
    }

    try {
      setSubmitting(true);
      
      const payload = { ...formData };
      
      if (isEditing === 'new') {
        const createPayload = {...payload};
        delete createPayload.isActive;
        const newTier = await createRewardTier(campaignId, createPayload as CreateRewardTierDto);
        setTiers([...tiers, newTier]);
      } else {
        const updatedTier = await updateRewardTier(campaignId, isEditing!, payload as UpdateRewardTierDto);
        setTiers(tiers.map(t => t.id === updatedTier.id ? updatedTier : t));
      }
      setIsEditing(null);
      setFormData({});
    } catch (err: unknown) {
      alert(getApiErrorMessage(err, '') || 'Error al guardar el nivel de recompensa.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <Loader2 className="w-10 h-10 text-[#72B626] animate-spin" />
        <p className="text-slate-400 font-medium text-sm">Cargando niveles de recompensa...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 bg-red-50 border border-red-100 rounded-3xl text-center">
        <p className="text-red-600 font-bold">{error}</p>
        <button onClick={loadData} className="mt-4 px-6 py-2 bg-red-600 text-white rounded-xl text-sm font-bold">
          Reintentar
        </button>
      </div>
    );
  }

  const inputClass = "w-full border-gray-200 border-[1.5px] rounded-xl px-4 py-3 text-[14px] outline-none transition-all bg-gray-50/50 focus:bg-white focus:border-[#72B626] focus:ring-4 focus:ring-[#72B626]/10 placeholder:text-gray-400 font-medium";
  const labelClass = "text-[11px] font-black text-slate-500 mb-2 block uppercase tracking-wider ml-1";

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 font-['Plus Jakarta Sans',sans-serif]">
      
      {/* Header y Progreso */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="flex-1 max-w-xl">
          <div className="flex items-center gap-3 text-amber-500 mb-2">
            <Gift size={20} strokeWidth={2.5} />
            <h3 className="text-[12px] font-black uppercase tracking-[0.2em]">Gestión de Recompensas</h3>
          </div>
          <p className="text-slate-500 text-[14px] font-medium mb-6">
            Define niveles de beneficios automáticos basados en el porcentaje de contribución de los donadores.
          </p>
        </div>
        {!isEditing && !readOnly && (
          <button
            onClick={handleAddNew}
            className="bg-[#72B626] hover:bg-[#1c2b1e] text-white font-black px-6 py-3 rounded-xl transition-all active:scale-95 shadow-lg shadow-[#72B626]/20/20 border-none cursor-pointer text-[13px] flex items-center justify-center gap-2"
          >
            <Plus size={16} strokeWidth={3} />
            Nuevo Nivel
          </button>
        )}
      </div>

      {/* Formulario */}
      {isEditing && (
        <div className="bg-white rounded-[32px] p-8 shadow-xl shadow-[#1c2b1e]/20/5 border border-gray-100 relative animate-in fade-in zoom-in-95 duration-300">
          <h3 className="text-xl font-black text-[#1c2b1e] mb-6">
            {isEditing === 'new' ? 'Crear Nivel de Recompensa' : 'Editar Nivel'}
          </h3>
          <form onSubmit={handleSubmit} className="flex flex-col gap-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className={labelClass}>Título *</label>
                <input 
                  type="text" 
                  required 
                  className={inputClass}
                  value={formData.title || ''}
                  onChange={e => setFormData({...formData, title: e.target.value})}
                  placeholder="Ej. Bronce, Plata, Acceso Anticipado..."
                />
              </div>
              <div>
                <label className={labelClass}>Porcentaje Mínimo (%) *</label>
                <input 
                  type="number" 
                  required 
                  min="0"
                  max="100"
                  className={inputClass}
                  value={formData.minPercentage === undefined ? '' : formData.minPercentage}
                  onChange={e => setFormData({...formData, minPercentage: parseFloat(e.target.value)})}
                  placeholder="Ej. 1"
                />
              </div>
              <div>
                <label className={labelClass}>Porcentaje Máximo (%) *</label>
                <input 
                  type="number" 
                  required 
                  min="0"
                  max="100"
                  className={inputClass}
                  value={formData.maxPercentage === undefined ? '' : formData.maxPercentage}
                  onChange={e => setFormData({...formData, maxPercentage: parseFloat(e.target.value)})}
                  placeholder="Ej. 10"
                />
              </div>
              <div className="md:col-span-2">
                <label className={labelClass}>Descripción y Beneficios *</label>
                <textarea 
                  required 
                  rows={3}
                  className={`${inputClass} resize-none`}
                  value={formData.description || ''}
                  onChange={e => setFormData({...formData, description: e.target.value})}
                  placeholder="Describe qué incluye esta recompensa..."
                />
              </div>

              {isEditing !== 'new' && (
                <div className="md:col-span-2 flex items-center gap-3 mt-2 bg-slate-50 p-4 rounded-xl border border-slate-100">
                  <input 
                    type="checkbox" 
                    id="isActive"
                    checked={formData.isActive}
                    onChange={e => setFormData({...formData, isActive: e.target.checked})}
                    className="w-5 h-5 accent-[#72B626]"
                  />
                  <div>
                    <label htmlFor="isActive" className="text-[14px] font-black text-slate-800 cursor-pointer">Recompensa Activa</label>
                    <p className="text-[12px] text-slate-500">Si desmarcas esta opción, la recompensa dejará de estar visible para nuevos donantes.</p>
                  </div>
                </div>
              )}
            </div>
            
            <div className="flex justify-end gap-3 mt-4 pt-6 border-t border-slate-100">
              <button 
                type="button"
                onClick={() => setIsEditing(null)}
                className="px-6 py-3 rounded-xl font-bold text-slate-500 hover:bg-slate-100 transition-colors"
                disabled={submitting}
              >
                Cancelar
              </button>
              <button 
                type="submit"
                className="px-6 py-3 rounded-xl bg-[#72B626] text-white font-black hover:bg-[#1c2b1e] transition-colors flex items-center gap-2"
                disabled={submitting}
              >
                {submitting ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} strokeWidth={2.5} />}
                {isEditing === 'new' ? 'Crear Recompensa' : 'Guardar Cambios'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Lista de Recompensas */}
      {!isEditing && tiers.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {tiers.map(tier => (
            <div key={tier.id} className={`bg-white rounded-[28px] border-2 p-6 transition-all ${tier.isActive ? 'border-gray-100 hover:border-gray-100 shadow-sm hover:shadow-xl' : 'border-slate-100 opacity-60'}`}>
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                  <span className="text-2xl font-black text-[#1c2b1e]">
                    {tier.minPercentage}% - {tier.maxPercentage}%
                  </span>
                  {!tier.isActive && (
                    <span className="bg-slate-100 text-slate-500 text-[10px] font-black px-2 py-1 rounded-lg uppercase tracking-widest">
                      Inactiva
                    </span>
                  )}
                </div>
                {!readOnly && (
                  <div className="flex gap-2">
                    <button onClick={() => handleEdit(tier)} className="w-8 h-8 rounded-full bg-slate-50 hover:bg-[#f0f9e0] text-slate-400 hover:text-[#72B626] flex items-center justify-center transition-colors">
                      <Edit2 size={14} strokeWidth={2.5} />
                    </button>
                    <button onClick={() => handleDelete(tier.id)} className="w-8 h-8 rounded-full bg-slate-50 hover:bg-red-100 text-slate-400 hover:text-red-600 flex items-center justify-center transition-colors">
                      <Trash2 size={14} strokeWidth={2.5} />
                    </button>
                  </div>
                )}
              </div>
              <h4 className="text-[16px] font-black text-[#1c2b1e] mb-2">{tier.title}</h4>
              <p className="text-[13px] text-slate-500 leading-relaxed mb-6 line-clamp-3">
                {tier.description}
              </p>
              
              <div className="flex items-center gap-4 text-[11px] font-bold text-slate-400 bg-slate-50 px-4 py-3 rounded-xl">
                <div className="flex items-center gap-1.5">
                  <Users size={14} strokeWidth={2.5} className="text-[#72B626]" />
                  <span className="text-slate-700">{tier.currentClaims || 0}</span>
                  <span>donantes han alcanzado este nivel</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {!isEditing && tiers.length === 0 && (
         <div className="col-span-full py-16 text-center bg-white border-2 border-dashed border-gray-100 rounded-[32px]">
           <div className="w-16 h-16 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-500 mx-auto mb-4">
             <Gift size={32} />
           </div>
           <h4 className="text-slate-900 font-black text-lg mb-2">No tienes recompensas</h4>
           <p className="text-slate-500 text-sm max-w-sm mx-auto mb-6 leading-relaxed">
             Añade niveles de recompensa para incentivar a tus donadores a aportar más capital.
           </p>
           <button
             onClick={handleAddNew}
             className="bg-[#72B626] text-white font-black px-6 py-3 rounded-xl transition-all shadow-lg hover:bg-[#1c2b1e]"
           >
             Crear Primer Nivel
           </button>
         </div>
      )}

      {/* Sección de Reclamos (Donadores que obtuvieron recompensa) */}
      {!isEditing && claims.length > 0 && (
        <div className="mt-12 pt-8 border-t border-slate-200">
          <button 
            onClick={() => setShowClaims(!showClaims)}
            className="w-full flex items-center justify-between bg-white border border-slate-200 p-6 rounded-[24px] hover:border-gray-100 transition-colors"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-[#f0f9e0] rounded-xl flex items-center justify-center text-[#72B626]">
                <Users size={20} strokeWidth={2.5} />
              </div>
              <div className="text-left">
                <h4 className="text-[15px] font-black text-slate-800">Donadores con Recompensas ({claims.length})</h4>
                <p className="text-[12px] text-slate-500 font-medium">Ver listado de personas que reclamaron un nivel</p>
              </div>
            </div>
            {showClaims ? <ChevronUp className="text-slate-400" /> : <ChevronDown className="text-slate-400" />}
          </button>

          {showClaims && (
            <div className="mt-4 bg-white rounded-[24px] border border-slate-200 overflow-hidden">
              {claimError && <p role="alert" className="p-4 text-sm text-red-700 bg-red-50">{claimError}</p>}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-[13px]">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-black uppercase tracking-widest text-[10px]">
                    <tr>
                      <th className="px-6 py-4">Donador</th>
                      <th className="px-6 py-4">Recompensa</th>
                      <th className="px-6 py-4">Monto Aportado</th>
                      <th className="px-6 py-4">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {claims.map((claim) => (
                      <tr key={claim.investment_id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="font-bold text-slate-800">{claim.first_name} {claim.last_name}</div>
                          <div className="text-slate-500 text-[11px]">{claim.investor_email}</div>
                          <div className="text-slate-400 text-[10px] mt-1">{new Date(claim.invested_at).toLocaleDateString()}</div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="inline-flex items-center gap-1.5 bg-amber-50 text-amber-700 font-bold px-3 py-1.5 rounded-lg text-[11px]">
                            <Gift size={12} strokeWidth={2.5} />
                            {claim.reward_title}
                          </span>
                        </td>
                        <td className="px-6 py-4 font-black text-[#4a7f1a]">
                          {formatCampaignCurrency(claim.amount, currency)}
                        </td>
                        <td className="px-6 py-4">
                          {claim.claim_id ? (
                            <select 
                              className="text-[11px] font-bold px-3 py-1.5 rounded-lg border border-slate-200 outline-none"
                              aria-label={`Estado de recompensa de ${claim.investor_email}`}
                              value={claim.claim_status}
                              disabled={!canManageClaims || isAdmin || !!updatingClaimId || !claim.allowed_statuses?.length}
                              onChange={async (e) => {
                                const status = e.target.value;
                                setUpdatingClaimId(claim.claim_id);
                                setClaimError(null);
                                try {
                                  const updated = await updateRewardClaim(campaignId, claim.claim_id, { status });
                                  setClaims(current => current.map(c => c.claim_id === claim.claim_id ? { ...c, claim_status: updated.status, allowed_statuses: updated.allowedStatuses } : c));
                                } catch(err: unknown) {
                                  const message = getApiErrorMessage(err, '');
                                  setClaimError(message || 'No se pudo actualizar el estado. Intenta nuevamente.');
                                  try { setClaims(await getRewardClaims(campaignId)); } catch { /* Keep the last confirmed state if refreshing fails. */ }
                                } finally {
                                  setUpdatingClaimId(null);
                                }
                              }}
                            >
                              <option value={claim.claim_status}>{rewardTrackingLabel(claim.claim_status)}</option>
                              {(claim.allowed_statuses ?? []).map(status => <option key={status} value={status}>{rewardTrackingLabel(status)}</option>)}
                            </select>
                          ) : (
                            <span className="text-slate-400 text-[11px] italic">Sin registro logístico</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
