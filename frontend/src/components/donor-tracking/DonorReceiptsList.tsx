import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  FileText,
  Download,
  CheckCircle2,
  Calendar,
  ExternalLink,
  ShieldCheck,
  Search,
  Receipt,
  Loader2,
  DollarSign,
  AlertCircle,
} from 'lucide-react';
import type { InvestmentHistoryItem } from '../../api/investor.api';
import { downloadInvestmentReceipt } from '../../api/investor.api';

interface Props {
  investments: InvestmentHistoryItem[];
  loading?: boolean;
}

export function DonorReceiptsList({ investments, loading }: Props) {
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const completedInvestments = investments.filter(
    (inv) => inv.investmentStatus === 'completed'
  );

  const filteredReceipts = completedInvestments.filter((inv) => {
    return (
      inv.campaignTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inv.id.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  const totalDonatedAmount = completedInvestments.reduce((sum, inv) => sum + inv.amount, 0);

  const handleDownload = async (id: string) => {
    try {
      setDownloadingId(id);
      setDownloadError(null);
      await downloadInvestmentReceipt(id);
    } catch (err) {
      console.error('Error descargando comprobante:', err);
      setDownloadError('No se pudo generar el comprobante. Por favor intenta de nuevo.');
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <div className="space-y-6 font-['Plus Jakarta Sans',sans-serif]">
      {/* ── Header ── */}
      <div className="bg-white rounded-[24px] p-6 sm:p-8 border border-gray-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-[11px] font-black uppercase tracking-widest flex items-center gap-1.5">
              <Receipt size={14} strokeWidth={2.5} />
              Auditoría y Comprobantes
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-[#1c2b1e] tracking-tight">
            Comprobantes Oficiales de Donación
          </h2>
          <p className="text-[13px] sm:text-[14px] text-slate-500 font-medium mt-1 max-w-xl leading-relaxed">
            Descarga en formato PDF tus certificados oficiales de aporte con validez tributaria e identificador único de transacción.
          </p>
        </div>

        <div className="flex items-center gap-3 bg-slate-50 rounded-2xl p-4 shrink-0 border border-slate-200/60">
          <div className="w-11 h-11 rounded-xl bg-white flex items-center justify-center text-[#72B626] shadow-sm">
            <FileText size={22} strokeWidth={2.5} />
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              Total Certificado
            </p>
            <p className="text-xl font-black text-[#1c2b1e]">
              Bs. {totalDonatedAmount.toLocaleString('es-BO')}
            </p>
            <p className="text-[11px] font-bold text-slate-500">
              {completedInvestments.length} Comprobante{completedInvestments.length === 1 ? '' : 's'} disponible{completedInvestments.length === 1 ? '' : 's'}
            </p>
          </div>
        </div>
      </div>

      {downloadError && (
        <div className="bg-red-50 text-red-700 p-4 rounded-2xl text-[13px] font-bold border border-red-100 flex items-center gap-2">
          <AlertCircle size={18} />
          <span>{downloadError}</span>
        </div>
      )}

      {/* ── Search Bar ── */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por proyecto o código de recibo..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 bg-white text-[13px] font-medium outline-none focus:border-[#72B626] shadow-sm transition-colors"
          />
        </div>

        <div className="text-[12px] font-bold text-slate-400 hidden sm:block">
          Mostrando {filteredReceipts.length} de {completedInvestments.length} recibos
        </div>
      </div>

      {/* ── Content List ── */}
      {loading ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-gray-100">
          <div className="w-8 h-8 border-3 border-gray-200 border-t-[#72B626] rounded-full animate-spin mx-auto mb-3" />
          <p className="text-[12px] font-bold text-slate-400 uppercase tracking-widest">
            Cargando comprobantes...
          </p>
        </div>
      ) : filteredReceipts.length === 0 ? (
        <div className="bg-white rounded-[32px] border border-dashed border-gray-200 p-12 sm:p-16 text-center">
          <div className="w-16 h-16 rounded-2xl bg-blue-50 text-blue-500 flex items-center justify-center mx-auto mb-4">
            <FileText size={32} />
          </div>
          <h3 className="text-xl font-black text-[#1c2b1e] tracking-tight mb-2">
            No hay comprobantes disponibles
          </h3>
          <p className="text-[14px] text-slate-400 font-medium max-w-md mx-auto leading-relaxed">
            {completedInvestments.length === 0
              ? 'Cuando realices donaciones y se procesen con éxito, aquí se generarán automáticamente tus comprobantes en PDF.'
              : 'No se encontraron comprobantes que coincidan con la búsqueda.'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl sm:rounded-[24px] border border-gray-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px]">
              <thead>
                <tr className="border-b border-gray-100 text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-50/50">
                  <th className="py-3.5 px-4 sm:px-6">Comprobante ID</th>
                  <th className="py-3.5 px-4 sm:px-6">Proyecto Financiado</th>
                  <th className="py-3.5 px-4 sm:px-6">Fecha de Aporte</th>
                  <th className="py-3.5 px-4 sm:px-6 text-right">Monto Donado</th>
                  <th className="py-3.5 px-4 sm:px-6 text-center">Estado</th>
                  <th className="py-3.5 px-4 sm:px-6 text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 font-medium">
                {filteredReceipts.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-4 px-4 sm:px-6 font-mono text-[11px] text-slate-500">
                      REC-{inv.id.substring(0, 8).toUpperCase()}
                    </td>
                    <td className="py-4 px-4 sm:px-6">
                      <Link
                        to={`/campaign/${inv.campaignId}`}
                        className="font-black text-[#1c2b1e] hover:text-[#72B626] transition-colors no-underline block max-w-xs truncate"
                      >
                        {inv.campaignTitle}
                      </Link>
                      {inv.rewardTitle && (
                        <span className="text-[11px] text-amber-700 font-bold block mt-0.5">
                          Recompensa: {inv.rewardTitle}
                        </span>
                      )}
                    </td>
                    <td className="py-4 px-4 sm:px-6 text-slate-500 text-[12px]">
                      {new Date(inv.createdAt).toLocaleDateString('es-BO', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </td>
                    <td className="py-4 px-4 sm:px-6 text-right font-black text-[#1c2b1e] text-[15px]">
                      Bs. {inv.amount.toLocaleString('es-BO', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-4 px-4 sm:px-6 text-center">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-black uppercase tracking-wider">
                        <CheckCircle2 size={12} strokeWidth={2.5} />
                        Confirmado
                      </span>
                    </td>
                    <td className="py-4 px-4 sm:px-6 text-right">
                      <button
                        onClick={() => handleDownload(inv.id)}
                        disabled={downloadingId === inv.id}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#f5fce8] hover:bg-[#72B626] text-[#4a7f1a] hover:text-white font-black text-[11px] uppercase tracking-wider transition-all border-none cursor-pointer shadow-sm active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Descargar en PDF"
                      >
                        {downloadingId === inv.id ? (
                          <Loader2 size={13} className="animate-spin" />
                        ) : (
                          <Download size={13} strokeWidth={2.5} />
                        )}
                        <span>Descargar PDF</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

