import { useState, useEffect } from 'react';
import { AdminLayout } from '../../components/admin/AdminLayout';
import { getPendingKyc, reviewKyc } from '../../api/admin.api';
import { KYCReviewModal } from '../../components/admin/KYCReviewModal';
import { 
  UserCheck, 
  Search, 
  Eye, 
  Mail, 
  Calendar,
  Building,
  CheckCircle2
} from 'lucide-react';

export function AdminKycPage() {
  const [pendingKyc, setPendingKyc] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedKyc, setSelectedKyc] = useState<any | null>(null);
  const [isKycModalOpen, setIsKycModalOpen] = useState(false);

  useEffect(() => {
    loadKyc();
  }, []);

  const loadKyc = async () => {
    try {
      setLoading(true);
      const data = await getPendingKyc();
      // Sort by updated_at descending
      const sorted = [...data].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
      setPendingKyc(sorted);
    } catch (error) {
      console.error('Error loading pending KYC:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApproveKyc = async (id: string) => {
    try {
      await reviewKyc(id, 'approve');
      await loadKyc();
    } catch (error) {
      console.error('Error approving KYC:', error);
      alert('Error al aprobar KYC.');
    }
  };

  const handleRejectKyc = async (id: string, reason: string) => {
    try {
      await reviewKyc(id, 'reject', reason);
      await loadKyc();
    } catch (error) {
      console.error('Error rejecting KYC:', error);
      alert('Error al rechazar KYC.');
    }
  };

  const filteredKyc = pendingKyc.filter(kyc => {
    const fullName = `${kyc.first_name || ''} ${kyc.last_name || ''}`.toLowerCase();
    const matchesSearch = fullName.includes(searchTerm.toLowerCase()) ||
                          (kyc.email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (kyc.company_name || '').toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  return (
    <AdminLayout>
      <div className="space-y-6 animate-in fade-in duration-500">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
              <UserCheck className="text-[#72B626]" size={26} />
              Verificaciones KYC
            </h1>
            <p className="text-gray-500 text-[14px]">
              Verifica los perfiles y documentación de los emprendedores bolivianos para habilitar su publicación.
            </p>
          </div>
          <div className="bg-white border border-gray-200 px-4 py-2.5 rounded-xl flex items-center gap-2.5 shadow-sm">
            <UserCheck size={16} className="text-[#72B626]" />
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Pendientes de revisión:</span>
            <span className="text-sm font-bold text-gray-800">{pendingKyc.length}</span>
          </div>
        </div>

        {/* Search and refresh */}
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input 
              type="text" 
              placeholder="Buscar por nombre, correo o empresa..."
              className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-gray-900 placeholder:text-gray-400 focus:outline-none focus:bg-white focus:border-[#72B626] focus:ring-3 focus:ring-[#72B626]/10 transition-all font-medium text-[13px]"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button 
            onClick={loadKyc}
            className="px-4 py-2 bg-[#72B626] hover:bg-[#4a7f1a] text-white font-semibold rounded-lg transition-all active:scale-95 cursor-pointer border-none text-[13px]"
          >
            Actualizar Lista
          </button>
        </div>

        {/* KYC List Table */}
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
          {loading ? (
            <div className="py-24 flex flex-col items-center justify-center space-y-3">
              <div className="w-8 h-8 border-4 border-gray-200 border-t-[#72B626] rounded-full animate-spin"></div>
              <p className="text-gray-400 font-bold uppercase tracking-wider text-[10px]">Cargando solicitudes KYC...</p>
            </div>
          ) : filteredKyc.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50/50">
                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">Emprendedor</th>
                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">Empresa</th>
                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">Fecha Envío</th>
                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wide text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {filteredKyc.map((kyc) => (
                    <tr key={kyc.id} className="hover:bg-gray-50/30 transition-colors group">
                      {/* Entrepreneur Name / Email */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center text-gray-400 group-hover:bg-[#f5fce8] group-hover:text-[#72B626] transition-all">
                            <UserCheck size={16} />
                          </div>
                          <div className="flex flex-col">
                            <span className="text-gray-900 font-semibold text-[14px] group-hover:text-[#72B626] transition-colors">
                              {kyc.first_name} {kyc.last_name}
                            </span>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <Mail size={12} className="text-gray-400" />
                              <span className="text-[11px] text-gray-400 font-medium">{kyc.email}</span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Company Name */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1.5 text-gray-600 font-medium text-[13px]">
                          <Building size={14} className="text-gray-400" />
                          <span>{kyc.company_name || 'Sin especificar'}</span>
                        </div>
                      </td>

                      {/* Submitted Date */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-gray-600 font-medium text-[13px]">
                          <Calendar size={14} className="text-gray-400" />
                          {new Date(kyc.updated_at).toLocaleDateString('es-ES', { 
                            day: 'numeric', 
                            month: 'short',
                            year: 'numeric'
                          })}
                        </div>
                      </td>

                      {/* Action Column */}
                      <td className="px-6 py-4 text-right">
                        <button 
                          onClick={() => {
                            setSelectedKyc(kyc);
                            setIsKycModalOpen(true);
                          }}
                          className="px-3 py-1.5 bg-white border border-gray-200 text-gray-500 hover:text-[#72B626] hover:border-green-200 hover:bg-[#f5fce8] rounded-lg transition-all active:scale-95 shadow-sm inline-flex items-center gap-1.5 cursor-pointer"
                        >
                          <Eye size={15} />
                          <span className="text-[11px] font-bold uppercase tracking-wider hidden md:inline">Revisar</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-20 flex flex-col items-center justify-center text-center px-6 border-t border-gray-100">
              <div className="w-14 h-14 bg-green-50 rounded-full flex items-center justify-center text-[#72B626] mb-4">
                <CheckCircle2 size={28} />
              </div>
              <h3 className="text-base font-bold text-gray-800 mb-1">¡Al día!</h3>
              <p className="text-gray-500 max-w-sm text-xs">
                No hay solicitudes de verificación KYC pendientes en este momento.
              </p>
            </div>
          )}
        </div>

        {/* KYC Review Modal */}
        <KYCReviewModal 
          isOpen={isKycModalOpen}
          onClose={() => {
            setIsKycModalOpen(false);
            setSelectedKyc(null);
          }}
          kycData={selectedKyc}
          onApprove={handleApproveKyc}
          onReject={handleRejectKyc}
        />

      </div>
    </AdminLayout>
  );
}
