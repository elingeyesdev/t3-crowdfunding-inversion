import { useState, useEffect } from 'react';
import { AdminLayout } from '../../components/admin/AdminLayout';
import { getAllCampaigns, hardDeleteCampaign, getCampaignDetail } from '../../api/admin.api';
import type { SystemCampaign, PendingCampaignDetail } from '../../types/admin.types';
import { CampaignPreviewModal } from '../../components/CampaignPreviewModal';
import { 
  Rocket, 
  Search, 
  Trash2, 
  Eye, 
  AlertTriangle
} from 'lucide-react';

export function AdminCampaignsPage() {
  const [campaigns, setCampaigns] = useState<SystemCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedDetail, setSelectedDetail] = useState<PendingCampaignDetail | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  
  // Dialog state
  const [deleteDialog, setDeleteDialog] = useState<{
    isOpen: boolean;
    campaignId: string;
    campaignTitle: string;
  } | null>(null);

  useEffect(() => {
    loadCampaigns();
  }, []);

  const loadCampaigns = async () => {
    try {
      setLoading(true);
      const data = await getAllCampaigns();
      // Sort by creation date descending
      const sorted = [...data].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setCampaigns(sorted);
    } catch (error) {
      console.error('Error loading campaigns:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePreviewClick = async (id: string) => {
    try {
      setModalLoading(true);
      const detail = await getCampaignDetail(id);
      setSelectedDetail(detail);
      setIsModalOpen(true);
    } catch (error) {
      console.error('Error loading campaign detail:', error);
      alert('No se pudo cargar el detalle de la campaña.');
    } finally {
      setModalLoading(false);
    }
  };

  const handleDeleteClick = (id: string, title: string) => {
    setDeleteDialog({
      isOpen: true,
      campaignId: id,
      campaignTitle: title
    });
  };

  const handleConfirmDelete = async () => {
    if (!deleteDialog) return;
    const { campaignId } = deleteDialog;
    setDeleteDialog(null);
    try {
      setLoading(true);
      await hardDeleteCampaign(campaignId);
      await loadCampaigns();
    } catch (error) {
      console.error('Error deleting campaign:', error);
      alert('Ocurrió un error al eliminar la campaña.');
    } finally {
      setLoading(false);
    }
  };

  // Filtering
  const filteredCampaigns = campaigns.filter(c => {
    const matchesSearch = c.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (c.creator_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (c.creator_email || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' ? true : c.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: string) => {
    switch(status) {
      case 'published':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold text-emerald-700 bg-green-50 border border-green-100">
            Activa
          </span>
        );
      case 'pending_review':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-100">
            En Revisión
          </span>
        );
      case 'draft':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold text-gray-700 bg-gray-50 border border-gray-100">
            Borrador
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold text-red-700 bg-red-50 border border-red-100">
            Rechazada
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold text-gray-600 bg-gray-100 border border-gray-200">
            {status}
          </span>
        );
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6 animate-in fade-in duration-500">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
              <Rocket className="text-[#72B626]" size={26} />
              Gestión de Campañas
            </h1>
            <p className="text-gray-500 text-[14px]">
              Supervisa, filtra y audita todas las campañas creadas en Unifundme.
            </p>
          </div>
          <div className="bg-white border border-gray-200 px-4 py-2.5 rounded-xl flex items-center gap-2.5 shadow-sm">
            <Rocket size={16} className="text-[#72B626]" />
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Campañas:</span>
            <span className="text-sm font-bold text-gray-800">{campaigns.length}</span>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input 
              type="text" 
              placeholder="Buscar por título, creador o correo..."
              className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-gray-900 placeholder:text-gray-400 focus:outline-none focus:bg-white focus:border-[#72B626] focus:ring-3 focus:ring-[#72B626]/10 transition-all font-medium text-[13px]"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <div className="flex gap-2">
            <select 
              className="px-3.5 py-2 bg-gray-50 border border-gray-200 rounded-lg text-[13px] font-semibold text-gray-700 outline-none cursor-pointer focus:bg-white focus:border-[#72B626] transition-all"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">Todos los estados</option>
              <option value="published">Activas (Published)</option>
              <option value="pending_review">En Revisión (Pending)</option>
              <option value="draft">Borradores (Draft)</option>
              <option value="rejected">Rechazadas (Rejected)</option>
            </select>

            <button 
              onClick={loadCampaigns}
              className="px-4 py-2 bg-[#72B626] hover:bg-[#4a7f1a] text-white font-semibold rounded-lg transition-all active:scale-95 cursor-pointer border-none text-[13px]"
            >
              Actualizar
            </button>
          </div>
        </div>

        {/* Campaigns Table */}
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
          {loading ? (
            <div className="py-24 flex flex-col items-center justify-center space-y-3">
              <div className="w-8 h-8 border-4 border-gray-200 border-t-[#72B626] rounded-full animate-spin"></div>
              <p className="text-gray-400 font-bold uppercase tracking-wider text-[10px]">Cargando campañas...</p>
            </div>
          ) : filteredCampaigns.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50/50">
                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">Campaña</th>
                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">Creador</th>
                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">Meta de Capital</th>
                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">Estado</th>
                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wide text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {filteredCampaigns.map((campaign) => {
                    const goal = parseFloat(campaign.goal_amount || '0');
                    const current = parseFloat(campaign.current_amount || '0');
                    const progress = goal > 0 ? Math.min(100, Math.round((current / goal) * 100)) : 0;

                    return (
                      <tr key={campaign.id} className="hover:bg-gray-50/30 transition-colors group">
                        {/* Campaign title and details */}
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center text-gray-400 group-hover:bg-[#f5fce8] group-hover:text-[#72B626] transition-all">
                              <Rocket size={16} />
                            </div>
                            <div className="flex flex-col">
                              <span className="text-gray-900 font-semibold text-[14px] group-hover:text-[#72B626] transition-colors line-clamp-1 max-w-xs md:max-w-md">
                                {campaign.title}
                              </span>
                              <span className="text-[10px] text-gray-400">Ref: {campaign.id.substring(0, 8)}</span>
                            </div>
                          </div>
                        </td>

                        {/* Creator Info */}
                        <td className="px-6 py-4 text-gray-600 font-medium text-[13px]">
                          <div className="flex flex-col">
                            <span className="text-gray-900 font-semibold">{campaign.creator_name || 'Sin nombre'}</span>
                            <span className="text-[11px] text-gray-400">{campaign.creator_email}</span>
                          </div>
                        </td>

                        {/* Goal / Progress Info */}
                        <td className="px-6 py-4">
                          <div className="flex flex-col gap-1.5 w-40">
                            <div className="flex justify-between items-baseline text-xs">
                              <span className="font-bold text-gray-900">${current.toLocaleString()}</span>
                              <span className="text-[10px] text-gray-400">de ${goal.toLocaleString()}</span>
                            </div>
                            {/* Simple Progress Bar */}
                            <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-[#72B626] rounded-full transition-all duration-500" 
                                style={{ width: `${progress}%` }}
                              />
                            </div>
                          </div>
                        </td>

                        {/* Status Column */}
                        <td className="px-6 py-4">
                          {getStatusBadge(campaign.status)}
                        </td>

                        {/* Actions Column */}
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button 
                              onClick={() => handlePreviewClick(campaign.id)}
                              disabled={modalLoading}
                              className="w-8 h-8 flex items-center justify-center bg-white hover:bg-[#f5fce8] text-gray-500 hover:text-[#72B626] border border-gray-200 hover:border-green-200 rounded-lg transition-all shadow-sm cursor-pointer"
                              title="Previsualizar Campaña"
                            >
                              <Eye size={15} />
                            </button>
                            <button 
                              onClick={() => handleDeleteClick(campaign.id, campaign.title)}
                              className="w-8 h-8 flex items-center justify-center bg-white hover:bg-red-50 text-gray-500 hover:text-red-600 border border-gray-200 hover:border-red-200 rounded-lg transition-all shadow-sm cursor-pointer"
                              title="Eliminar Campaña"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-20 flex flex-col items-center justify-center text-center px-6">
              <div className="w-14 h-14 bg-gray-50 rounded-full flex items-center justify-center text-gray-400 mb-4">
                <Rocket size={28} />
              </div>
              <h3 className="text-base font-bold text-gray-800 mb-1">Sin campañas</h3>
              <p className="text-gray-500 max-w-sm text-xs">
                No se encontraron campañas que coincidan con los filtros seleccionados.
              </p>
            </div>
          )}
        </div>

        {/* Campaign Preview Modal */}
        {selectedDetail && (
          <CampaignPreviewModal 
            open={isModalOpen}
            onClose={() => {
              setIsModalOpen(false);
              setSelectedDetail(null);
            }}
            isAdmin={false} // Make it read-only for general campaign monitoring
            campaign={{
              id: selectedDetail.id,
              title: selectedDetail.title,
              slug: selectedDetail.slug || (selectedDetail as any).id,
              shortDescription: selectedDetail.short_description || '',
              description: selectedDetail.description || '',
              location: selectedDetail.location || 'Global',
              campaignType: selectedDetail.type as any,
              status: selectedDetail.status as any,
              goalAmount: parseFloat(selectedDetail.goal_amount || '0'),
              currentAmount: selectedDetail.current_amount || 0,
              investorCount: selectedDetail.investor_count || 0,
              currency: selectedDetail.currency || 'BOB',
              coverImageUrl: selectedDetail.main_image_url || selectedDetail.cover_image_url || null,
              categoryName: selectedDetail.category_name,
              categorySlug: '',
              startDate: selectedDetail.start_date,
              endDate: selectedDetail.end_date,
              fundedAt: null,
              isFeatured: false,
              viewCount: 0,
              createdAt: '',
              updatedAt: '',
              publishedAt: null
            }}
            auditScore={selectedDetail.audit_score}
            entrepreneur={{
              firstName: selectedDetail.entrepreneur_first_name || '',
              lastName: selectedDetail.entrepreneur_last_name || '',
              email: selectedDetail.entrepreneur_email || '',
              bio: selectedDetail.entrepreneur_bio,
              avatar: selectedDetail.entrepreneur_avatar,
              linkedin: selectedDetail.entrepreneur_linkedin,
              website: selectedDetail.entrepreneur_website,
            }}
            rewardTiers={selectedDetail.reward_tiers?.map(t => ({
              title: t.title,
              description: t.description,
              amount: t.min_percentage || 0,
              minPercentage: t.min_percentage || 0,
              maxPercentage: t.max_percentage || 100
            })) || []}
            actionLoading={false}
            media={selectedDetail.media}
            minInvestment={selectedDetail.min_investment}
            maxInvestment={selectedDetail.max_investment}
            subtitle={selectedDetail.subtitle}
            risksAndChallenges={selectedDetail.risks_and_challenges}
            videoUrl={selectedDetail.video_url}
            tags={selectedDetail.tags}
            socialLinks={selectedDetail.social_links}
          />
        )}

        {/* Delete Confirmation Dialog */}
        {deleteDialog && deleteDialog.isOpen && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div 
              className="absolute inset-0 bg-gray-950/60 backdrop-blur-sm" 
              onClick={() => setDeleteDialog(null)} 
            />
            <div className="bg-white rounded-2xl w-full max-w-md p-6 relative z-10 shadow-xl border border-gray-200 animate-in zoom-in-95 duration-200">
              <div className="flex items-center gap-3 mb-3 text-red-600">
                <AlertTriangle size={24} />
                <h3 className="text-lg font-bold text-gray-900">¿Eliminar campaña?</h3>
              </div>
              
              <p className="text-gray-500 font-medium text-sm mb-5 leading-relaxed">
                Estás a punto de eliminar permanentemente la campaña <span className="font-bold text-gray-900">{deleteDialog.campaignTitle}</span>. 
                Esta acción no se puede deshacer y borrará toda la información relacionada de la base de datos.
              </p>
              
              <div className="flex justify-end gap-2.5">
                <button
                  onClick={() => setDeleteDialog(null)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-lg text-xs uppercase tracking-wider transition-all active:scale-95 border-none cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleConfirmDelete}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg text-xs uppercase tracking-wider transition-all active:scale-95 border-none cursor-pointer"
                >
                  Confirmar Eliminación
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </AdminLayout>
  );
}
