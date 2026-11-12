import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Eye, 
  ChevronLeft, 
  ChevronRight, 
  Clock,
  CheckCircle2,
  ShieldAlert,
  PlayCircle
} from 'lucide-react';
import { getPendingCampaigns, updateCampaignStatus, getCampaignDetail } from '../../api/admin.api';
import type { PendingCampaign, PendingCampaignDetail } from '../../types/admin.types';
import { CampaignPreviewModal } from '../../components/CampaignPreviewModal';
import { AdminLayout } from '../../components/admin/AdminLayout';

export const CampaignReviewPage: React.FC = () => {
  const [campaigns, setCampaigns] = useState<PendingCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const typeFilter = 'all';
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  const [selectedCampaignDetail, setSelectedCampaignDetail] = useState<PendingCampaignDetail | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);


  // Custom modal dialog states
  const [dialog, setDialog] = useState<{
    isOpen: boolean;
    type: 'alert' | 'confirm' | 'prompt';
    title: string;
    message: string;
    placeholder?: string;
    defaultValue?: string;
    onConfirm: (val?: string) => void;
    onCancel?: () => void;
  } | null>(null);
  const [dialogInput, setDialogInput] = useState('');

  // Helper dialog methods returning promises
  const showAlert = (title: string, message: string): Promise<void> => {
    return new Promise((resolve) => {
      setDialog({
        isOpen: true,
        type: 'alert',
        title,
        message,
        onConfirm: () => {
          setDialog(null);
          resolve();
        }
      });
    });
  };

  const showConfirm = (title: string, message: string): Promise<boolean> => {
    return new Promise((resolve) => {
      setDialog({
        isOpen: true,
        type: 'confirm',
        title,
        message,
        onConfirm: () => {
          setDialog(null);
          resolve(true);
        },
        onCancel: () => {
          setDialog(null);
          resolve(false);
        }
      });
    });
  };

  const showPrompt = (title: string, message: string, placeholder = '', defaultValue = ''): Promise<string | null> => {
    setDialogInput(defaultValue);
    return new Promise((resolve) => {
      setDialog({
        isOpen: true,
        type: 'prompt',
        title,
        message,
        placeholder,
        defaultValue,
        onConfirm: (val) => {
          setDialog(null);
          resolve(val || '');
        },
        onCancel: () => {
          setDialog(null);
          resolve(null);
        }
      });
    });
  };

  useEffect(() => {
    loadCampaigns();
  }, [page, typeFilter]);

  const loadCampaigns = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await getPendingCampaigns({
        page,
        limit: pageSize,
        search: searchTerm,
        type: typeFilter,
        status: 'pending_review'
      });
      setCampaigns(response.campaigns);
      setTotal(response.total);
    } catch (err: any) {
      if (err.response?.status === 401) {
        setError('Acceso denegado. Se requieren permisos de administrador.');
      } else {
        console.error('Error loading pending campaigns:', err);
        setError('Error al cargar las campañas pendientes.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    loadCampaigns();
  };

  const openReviewModal = async (id: string) => {
    setSelectedCampaignId(id);
    setLoading(true);
    try {
      const detail = await getCampaignDetail(id);
      setSelectedCampaignDetail(detail);
      setIsModalOpen(true);
    } catch (err) {
      console.error('Error loading campaign detail:', err);
      await showAlert('Error', 'Error al cargar el detalle de la campaña.');
    } finally {
      setLoading(false);
    }
  };

  const handleReviewAction = async (status: 'approved' | 'rejected', feedback?: string) => {
    if (!selectedCampaignId) return;
    
    setActionLoading(true);
    try {
      await updateCampaignStatus(selectedCampaignId, status === 'approved' ? 'published' : 'rejected', feedback);
      setIsModalOpen(false);
      setSelectedCampaignDetail(null);
      loadCampaigns();
    } catch (err) {
      console.error('Error updating status:', err);
      await showAlert('Error', 'Error al actualizar el estado de la campaña.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleQuickApprove = async (id: string, title: string) => {
    const ok = await showConfirm('Aprobar Campaña', `¿Estás seguro de que deseas aprobar la campaña "${title}"?`);
    if (!ok) return;
    
    setLoading(true);
    try {
      await updateCampaignStatus(id, 'published');
      loadCampaigns();
    } catch (err) {
      console.error('Error approving campaign:', err);
      await showAlert('Error', 'Error al aprobar la campaña.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickReject = async (id: string, title: string) => {
    const feedback = await showPrompt('Rechazar Campaña', `Indica el motivo del rechazo para "${title}":`);
    if (feedback === null) return; // Cancelled
    if (!feedback.trim()) {
      await showAlert('Rechazo Inválido', 'El motivo del rechazo es obligatorio.');
      return;
    }

    setLoading(true);
    try {
      await updateCampaignStatus(id, 'rejected', feedback);
      loadCampaigns();
    } catch (err) {
      console.error('Error rejecting campaign:', err);
      await showAlert('Error', 'Error al rechazar la campaña.');
    } finally {
      setLoading(false);
    }
  };

  const totalPages = Math.ceil(total / pageSize);

  return (
    <AdminLayout>
      <div className="space-y-8 animate-in fade-in duration-500">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
              Revisión de Campañas
            </h1>
            <p className="text-gray-500 text-[14px]">
              Revisa las nuevas propuestas antes de que salgan al mercado.
            </p>
          </div>

          {/* Info Cards */}
          <div className="flex gap-4">
            <div className="p-4 bg-white rounded-lg flex items-center gap-3 shadow-sm min-w-[120px]">
              <div className="w-9 h-9 rounded bg-amber-50 flex items-center justify-center text-amber-500">
                <Clock size={18} />
              </div>
              <div>
                <p className="text-[10px] font-bold text-gray-500 uppercase">Pendientes</p>
                <p className="text-lg font-bold text-gray-900">{total}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Filters & Search Bar */}
        <div className="bg-white p-4 rounded-lg border border-gray-200 flex flex-col md:flex-row gap-3 shadow-sm">
          <form onSubmit={handleSearch} className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input 
              type="text" 
              placeholder="Buscar por título o emprendedor..."
              className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-gray-900 placeholder:text-gray-400 focus:outline-none focus:bg-white focus:border-indigo-500 transition-all font-medium text-[13px]"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </form>

          <div className="flex flex-wrap gap-2">
            <button 
              onClick={loadCampaigns}
              className="px-4 py-2 bg-[#72B626] hover:bg-[#4a7f1a] text-white font-semibold rounded-lg transition-all active:scale-95 cursor-pointer border-none text-[13px]"
            >
              Actualizar
            </button>
          </div>
        </div>

        {/* Campaigns Table */}
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
        {error ? (
          <div className="py-20 bg-red-50 border-y border-red-100 flex flex-col items-center justify-center text-center px-6">
            <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center text-red-500 mb-4">
              <ShieldAlert size={32} />
            </div>
            <h3 className="text-lg font-bold text-red-700 mb-2">{error}</h3>
            <p className="text-gray-500 max-w-sm mb-6 font-medium text-sm">
              No tienes permisos para ver esta sección o tu sesión ha expirado.
            </p>
            <button 
              onClick={() => window.location.href = '/login'}
              className="px-6 py-2.5 bg-gray-950 text-white font-semibold rounded-lg hover:bg-gray-800 transition-all border-none cursor-pointer"
            >
              Ir al Login
            </button>
          </div>
        ) : loading ? (
          <div className="py-24 flex flex-col items-center justify-center space-y-3">
            <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-gray-400 font-bold uppercase tracking-wider text-[10px]">Sincronizando revisión...</p>
          </div>
        ) : campaigns.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50/50">
                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">Perfil Corporativo</th>
                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">Emprendedor</th>
                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">Estructura</th>
                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">Meta de Capital</th>
                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wide text-center">Score</th>
                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wide text-right">Acciones de Revisión</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {campaigns.map((campaign) => (
                    <tr key={campaign.id} className="hover:bg-gray-50/50 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded bg-gray-100 flex items-center justify-center text-gray-500 group-hover:bg-indigo-50 group-hover:text-indigo-500 transition-all font-bold text-xs">
                             {campaign.title.substring(0, 2).toUpperCase()}
                          </div>
                          <div className="flex flex-col gap-0.5">
                            <span className="text-gray-900 font-semibold text-[14px] group-hover:text-indigo-600 transition-colors">{campaign.title}</span>
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">{campaign.category_name}</span>
                              <div className="w-1 h-1 rounded-full bg-gray-200"></div>
                              <span className="text-[10px] text-gray-400">Ref: {campaign.id.substring(0, 8)}</span>
                              {(campaign as any).video_url && (
                                <span
                                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider text-emerald-700 bg-green-50 border border-green-100"
                                  title="Tiene video pitch en DonaTok"
                                >
                                  <PlayCircle size={9} /> DonaTok
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                           <span className="text-gray-900 font-semibold text-[13px]">{campaign.entrepreneur_name}</span>
                           <span className="text-[10px] text-gray-400">Verificado el {new Date(campaign.created_at).toLocaleDateString()}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${
                          campaign.type === 'reward' 
                            ? 'bg-amber-50 text-amber-700 border-amber-200' 
                            : 'bg-green-50 text-emerald-700 border-emerald-200'
                        }`}>
                          {campaign.type === 'reward' ? 'Recompensa' : 'Donación'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                            <span className="text-gray-900 font-bold text-[14px]">Bs. {parseFloat(campaign.goal_amount).toLocaleString('es-BO')}</span>
                            <span className="text-[10px] text-gray-400 uppercase tracking-wider">BOB</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                         <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-green-50 text-emerald-600 font-bold text-xs border border-emerald-200">
                            {campaign.audit_score || 0}%
                         </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button 
                            onClick={() => openReviewModal(campaign.id)}
                            className="w-9 h-9 flex items-center justify-center bg-white hover:bg-gray-100 text-gray-500 rounded-lg transition-all border border-gray-200 shadow-sm cursor-pointer active:scale-95"
                            title="Revisar Documentación"
                          >
                            <Eye size={16} />
                          </button>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleQuickApprove(campaign.id, campaign.title);
                            }}
                            className="w-9 h-9 flex items-center justify-center bg-white hover:bg-green-50 text-emerald-600 rounded-lg transition-all border border-gray-200 shadow-sm cursor-pointer active:scale-95"
                            title="Aprobar Inmediatamente"
                          >
                            <CheckCircle2 size={16} />
                          </button>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleQuickReject(campaign.id, campaign.title);
                            }}
                            className="w-9 h-9 flex items-center justify-center bg-white hover:bg-red-50 text-red-600 rounded-lg transition-all border border-gray-200 shadow-sm cursor-pointer active:scale-95"
                            title="Rechazar Perfil Corporativo"
                          >
                            <ShieldAlert size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-20 flex flex-col items-center justify-center text-center px-6">
              <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center text-emerald-600 mb-4">
                <CheckCircle2 size={32} />
              </div>
              <h3 className="text-lg font-bold text-gray-800 mb-1">¡Todo al día!</h3>
              <p className="text-gray-500 max-w-sm text-sm">
                No hay campañas pendientes de revisión en este momento. Vuelve más tarde para revisar nuevas propuestas.
              </p>
            </div>
          )}

          {/* Pagination Footer */}
          {totalPages > 1 && (
            <div className="px-6 py-3 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
              <p className="text-[12px] font-semibold text-gray-500">
                Campañas <span className="text-indigo-600">{campaigns.length}</span> de <span className="text-gray-900">{total}</span>
              </p>
              <div className="flex items-center gap-2.5">
                <button 
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="w-8 h-8 flex items-center justify-center bg-white border border-gray-200 rounded text-gray-400 hover:text-indigo-600 disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
                >
                  <ChevronLeft size={16} />
                </button>
                <div className="flex gap-1">
                  {[...Array(totalPages)].map((_, i) => (
                    <button
                      key={i + 1}
                      onClick={() => setPage(i + 1)}
                      className={`w-8 h-8 rounded flex items-center justify-center font-bold text-xs transition-all cursor-pointer ${
                        page === i + 1 
                          ? 'bg-[#72B626] text-white shadow-sm border-none' 
                          : 'bg-white text-gray-400 border border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      {i + 1}
                    </button>
                  ))}
                </div>
                <button 
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="w-8 h-8 flex items-center justify-center bg-white border border-gray-200 rounded text-gray-400 hover:text-indigo-600 disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Modal de Detalle (Unified Preview) */}
        {selectedCampaignDetail && (
          <CampaignPreviewModal 
            open={isModalOpen}
            onClose={() => {
              setIsModalOpen(false);
              setSelectedCampaignDetail(null);
            }}
            isAdmin
            campaign={{
              id: selectedCampaignDetail.id,
              title: selectedCampaignDetail.title,
              slug: selectedCampaignDetail.slug || (selectedCampaignDetail as any).id,
              shortDescription: selectedCampaignDetail.short_description || '',
              description: selectedCampaignDetail.description || '',
              location: selectedCampaignDetail.location || 'Global',
              campaignType: 'donation',
              status: selectedCampaignDetail.status as any,
              goalAmount: parseFloat(selectedCampaignDetail.goal_amount || '0'),
              currentAmount: selectedCampaignDetail.current_amount || 0,
              investorCount: selectedCampaignDetail.investor_count || 0,
              currency: selectedCampaignDetail.currency || 'BOB',
              coverImageUrl: selectedCampaignDetail.main_image_url || null,
              categoryName: selectedCampaignDetail.category_name,
              categorySlug: '',
              startDate: selectedCampaignDetail.start_date,
              endDate: selectedCampaignDetail.end_date,
              fundedAt: null,
              isFeatured: false,
              viewCount: 0,
              createdAt: '',
              updatedAt: '',
              publishedAt: null
            }}
            entrepreneur={{
              firstName: selectedCampaignDetail.entrepreneur_first_name || '',
              lastName: selectedCampaignDetail.entrepreneur_last_name || '',
              email: selectedCampaignDetail.entrepreneur_email || '',
              bio: selectedCampaignDetail.entrepreneur_bio,
              avatar: selectedCampaignDetail.entrepreneur_avatar,
              linkedin: selectedCampaignDetail.entrepreneur_linkedin,
              website: selectedCampaignDetail.entrepreneur_website
            }}
            rewardTiers={selectedCampaignDetail.reward_tiers?.map(t => ({
              title: t.title,
              description: t.description,
              minPercentage: t.min_percentage || 0,
              maxPercentage: t.max_percentage || 100
            })) || []}
            onApprove={() => handleReviewAction('approved')}
            onReject={(feedback) => handleReviewAction('rejected', feedback)}
            actionLoading={actionLoading}
            media={selectedCampaignDetail.media}
            minInvestment={selectedCampaignDetail.min_investment}
            maxInvestment={selectedCampaignDetail.max_investment}
            subtitle={selectedCampaignDetail.subtitle}
            risksAndChallenges={selectedCampaignDetail.risks_and_challenges}
            videoUrl={selectedCampaignDetail.video_url}
            tags={selectedCampaignDetail.tags}
            socialLinks={selectedCampaignDetail.social_links}
          />
        )}

        {/* Custom modal dialog */}
        {dialog && dialog.isOpen && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div 
              className="absolute inset-0 bg-gray-950/60 backdrop-blur-sm" 
              onClick={() => dialog.onCancel ? dialog.onCancel() : dialog.onConfirm()} 
            />
            <div className="bg-white rounded-lg w-full max-w-md p-6 relative z-10 shadow-xl border border-gray-200 animate-in zoom-in-95 duration-200">
              <h3 className="text-lg font-bold text-gray-900 mb-2">{dialog.title}</h3>
              <p className="text-gray-500 font-medium text-sm mb-4 leading-relaxed">{dialog.message}</p>
              
              {dialog.type === 'prompt' && (
                <input
                  type="text"
                  placeholder={dialog.placeholder || "Escribe aquí..."}
                  value={dialogInput}
                  onChange={(e) => setDialogInput(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-gray-800 placeholder:text-gray-400 focus:outline-none focus:bg-white focus:border-indigo-500 transition-all font-medium mb-4 text-sm"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      dialog.onConfirm(dialogInput);
                    }
                  }}
                />
              )}
              
              <div className="flex justify-end gap-2.5">
                {dialog.type !== 'alert' && (
                  <button
                    onClick={() => dialog.onCancel?.()}
                    className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-lg text-xs uppercase tracking-wider transition-all active:scale-95 border-none cursor-pointer"
                  >
                    Cancelar
                  </button>
                )}
                <button
                  onClick={() => dialog.onConfirm(dialogInput)}
                  className={`px-4 py-2 font-semibold rounded-lg text-xs uppercase tracking-wider transition-all active:scale-95 border-none cursor-pointer text-white ${
                    dialog.type === 'prompt' && dialog.title.toLowerCase().includes('rechaz')
                      ? 'bg-red-500 hover:bg-red-600'
                      : 'bg-indigo-600 hover:bg-indigo-700'
                  }`}
                >
                  Aceptar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
};
