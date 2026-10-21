import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AdminLayout } from '../../components/admin/AdminLayout';
import { 
  getDashboardStats, 
  getPendingCampaigns,
  getPendingKyc
} from '../../api/admin.api';
import type { DashboardStats } from '../../types/admin.types';
import { 
  Users, 
  Rocket, 
  BarChart3, 
  Clock, 
  ChevronRight,
  UserCheck,
  AlertCircle,
  FileCheck
} from 'lucide-react';

export function AdminDashboardPage() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [pendingCampaignsCount, setPendingCampaignsCount] = useState(0);
  const [pendingKycCount, setPendingKycCount] = useState(0);
  const [recentPending, setRecentPending] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const [statsData, campaignsData, kycData] = await Promise.all([
        getDashboardStats(),
        getPendingCampaigns({ page: 1, limit: 3, status: 'pending_review' }),
        getPendingKyc()
      ]);
      setStats(statsData);
      setPendingCampaignsCount(campaignsData.total);
      setRecentPending(campaignsData.campaigns);
      setPendingKycCount(kycData.length);
    } catch (error) {
      console.error('Error loading dashboard stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="py-24 flex flex-col items-center justify-center space-y-3">
          <div className="w-10 h-10 border-4 border-gray-200 border-t-[#72B626] rounded-full animate-spin"></div>
          <p className="text-gray-400 font-bold uppercase tracking-wider text-[10px]">Cargando estadísticas globales...</p>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-8 animate-in fade-in duration-500">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Panel de Control</h1>
            <p className="text-gray-500 text-[14px] mt-1">Supervisión en tiempo real de Unifundme Bolivia.</p>
          </div>
        </div>

        {/* Stats Grid - Premium Minimalist Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Card 1: Total Users */}
          <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md group">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block">Usuarios Totales</span>
                <span className="text-3xl font-extrabold text-gray-950 tracking-tight mt-2.5 block">{stats?.totalUsers || 0}</span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center text-gray-400 group-hover:text-[#72B626] group-hover:bg-[#f5fce8] transition-all duration-300">
                <Users size={20} />
              </div>
            </div>
          </div>

          {/* Card 2: Active Campaigns */}
          <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md group">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block">Campañas Activas</span>
                <span className="text-3xl font-extrabold text-gray-950 tracking-tight mt-2.5 block">{stats?.totalCampaigns || 0}</span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center text-gray-400 group-hover:text-[#72B626] group-hover:bg-[#f5fce8] transition-all duration-300">
                <Rocket size={20} />
              </div>
            </div>
          </div>

          {/* Card 3: Total Investments */}
          <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md group">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block">Total Donado</span>
                <span className="text-3xl font-extrabold text-gray-950 tracking-tight mt-2.5 block">
                  Bs. {(stats?.totalFunded || 0).toLocaleString('es-BO')}
                </span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center text-gray-400 group-hover:text-[#72B626] group-hover:bg-[#f5fce8] transition-all duration-300">
                <BarChart3 size={20} />
              </div>
            </div>
          </div>
        </div>

        {/* Dashboard split layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Left: Actions Required Panel */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
              <h2 className="text-base font-bold text-gray-900 mb-5 flex items-center gap-2">
                <AlertCircle size={18} className="text-[#72B626]" />
                Acciones Requeridas
              </h2>
              
              <div className="space-y-4">
                {/* Pending Campaigns Alert */}
                <div className="p-4 rounded-xl border border-amber-100 bg-amber-50/50 flex flex-col gap-3">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center text-amber-600 shrink-0">
                      <Clock size={16} />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-amber-900">Campañas pendientes de revisión</h4>
                      <p className="text-xs text-amber-700/80 mt-0.5">Hay <span className="font-bold">{pendingCampaignsCount}</span> propuestas esperando auditoría y aprobación.</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => navigate('/admin/campaigns/review')}
                    className="w-full py-2 bg-[#72B626] hover:bg-[#4a7f1a] text-white text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer active:scale-98 border-none"
                  >
                    Ir a Revisar <ChevronRight size={14} />
                  </button>
                </div>

                {/* Pending KYC Alert */}
                <div className="p-4 rounded-xl border border-indigo-100 bg-indigo-50/50 flex flex-col gap-3">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
                      <UserCheck size={16} />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-indigo-900">Verificaciones KYC pendientes</h4>
                      <p className="text-xs text-indigo-700/80 mt-0.5">Hay <span className="font-bold">{pendingKycCount}</span> solicitudes de identidad por revisar.</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => navigate('/admin/kyc')}
                    className="w-full py-2 bg-[#72B626] hover:bg-[#4a7f1a] text-white text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer active:scale-98 border-none"
                  >
                    Ir a Verificar <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Recent activity / quick view */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gray-50/40">
                <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
                  <FileCheck size={18} className="text-[#72B626]" />
                  Propuestas de Campaña Recientes
                </h2>
                <span className="text-xs text-gray-400 font-medium">Bandeja de Entrada</span>
              </div>
              
              <div className="divide-y divide-gray-100">
                {recentPending.length > 0 ? (
                  recentPending.map((campaign) => (
                    <div key={campaign.id} className="p-5 flex items-center justify-between hover:bg-gray-50/30 transition-colors group">
                      <div className="flex items-center gap-3.5">
                        <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center font-bold text-xs text-gray-500 group-hover:bg-[#f5fce8] group-hover:text-[#72B626] transition-all duration-200">
                          {campaign.title.substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <h4 className="text-sm font-semibold text-gray-900 group-hover:text-[#72B626] transition-colors">{campaign.title}</h4>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">{campaign.category_name}</span>
                            <span className="text-[10px] text-gray-300">•</span>
                            <span className="text-[11px] text-gray-500">{campaign.entrepreneur_name}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <span className="text-sm font-bold text-gray-900">Bs. {parseFloat(campaign.goal_amount).toLocaleString('es-BO')}</span>
                          <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider ml-1 block">BOB</span>
                        </div>
                        <button 
                          onClick={() => navigate('/admin/campaigns/review')}
                          className="p-1.5 rounded-lg border border-gray-200 text-gray-400 hover:text-[#72B626] hover:bg-[#f5fce8] transition-all cursor-pointer"
                        >
                          <ChevronRight size={16} />
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="py-16 text-center">
                    <p className="text-gray-400 text-sm">No hay propuestas de campañas pendientes en este momento.</p>
                  </div>
                )}
              </div>
              
              <div className="px-6 py-3 bg-gray-50/50 border-t border-gray-200 text-right">
                <button 
                  onClick={() => navigate('/admin/campaigns/review')}
                  className="text-xs font-bold text-[#72B626] hover:text-[#5e9620] inline-flex items-center gap-1 cursor-pointer bg-transparent border-none"
                >
                  Ver todas las propuestas <ChevronRight size={14} />
                </button>
              </div>
            </div>
          </div>
          
        </div>
      </div>
    </AdminLayout>
  );
}
