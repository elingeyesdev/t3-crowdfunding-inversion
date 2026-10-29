import { useState, useEffect } from 'react';
import { AdminLayout } from '../../components/admin/AdminLayout';
import {
  getAdminFinancialMovements,
  getAdminFinancialMovement,
  reviewAdminFinancialMovement,
  getAdminFinancialAuditSummary,
  getAdminCampaignFinancialAudit,
} from '../../api/admin.api';
import type {
  FinancialMovementAuditItem,
  FinancialAuditSummary,
} from '../../types/admin.types';
import {
  Receipt,
  Search,
  Filter,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Clock,
  Eye,
  FileText,
  DollarSign,
  TrendingUp,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  AlertCircle,
  BarChart2,
} from 'lucide-react';

export function AdminExpensesAuditPage() {
  const [movements, setMovements] = useState<FinancialMovementAuditItem[]>([]);
  const [summary, setSummary] = useState<FinancialAuditSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters state
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('expense'); // Default focus on expenses
  const [receiptFilter, setReceiptFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  // Review Modal State
  const [selectedMovement, setSelectedMovement] = useState<FinancialMovementAuditItem | null>(null);
  const [reviewAction, setReviewAction] = useState<'approve' | 'flag' | 'reject'>('approve');
  const [reviewNotes, setReviewNotes] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);

  // Campaign Audit Modal State
  const [campaignAuditData, setCampaignAuditData] = useState<any | null>(null);
  const [loadingCampaignAudit, setLoadingCampaignAudit] = useState(false);

  useEffect(() => {
    loadSummary();
  }, []);

  useEffect(() => {
    loadMovements();
  }, [page, statusFilter, typeFilter, receiptFilter]);

  const loadSummary = async () => {
    try {
      const data = await getAdminFinancialAuditSummary();
      setSummary(data);
    } catch (err) {
      console.error('Error al cargar métricas de auditoría financiera:', err);
    }
  };

  const loadMovements = async () => {
    try {
      setLoading(true);
      const res = await getAdminFinancialMovements({
        page,
        limit: 10,
        type: typeFilter || undefined,
        status: statusFilter || undefined,
        hasReceipt: receiptFilter === 'yes' ? true : receiptFilter === 'no' ? false : undefined,
        q: searchTerm || undefined,
      });

      setMovements(res.data || []);
      setTotalPages(Math.max(1, Math.ceil((res.total || 0) / (res.perPage || 10))));
      setTotalItems(res.total || 0);
    } catch (err) {
      console.error('Error al listar movimientos:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    loadMovements();
  };

  const handleOpenReview = async (movement: FinancialMovementAuditItem) => {
    try {
      // Fetch full details with consistency flags
      const fullDetail = await getAdminFinancialMovement(movement.id);
      setSelectedMovement(fullDetail);
      setReviewAction('approve');
      setReviewNotes(fullDetail.reviewNotes || '');
      setReviewError(null);
    } catch (err) {
      setSelectedMovement(movement);
    }
  };

  const handleSubmitReview = async () => {
    if (!selectedMovement) return;
    if ((reviewAction === 'flag' || reviewAction === 'reject') && !reviewNotes.trim()) {
      setReviewError('Debes ingresar notas de auditoría explicando la observación o motivo de rechazo.');
      return;
    }

    try {
      setSubmittingReview(true);
      setReviewError(null);
      await reviewAdminFinancialMovement(selectedMovement.id, reviewAction, reviewNotes);
      setSelectedMovement(null);
      await Promise.all([loadMovements(), loadSummary()]);
    } catch (err: any) {
      setReviewError(err?.response?.data?.message || 'Error al procesar la revisión.');
    } finally {
      setSubmittingReview(false);
    }
  };

  const handleOpenCampaignAudit = async (campaignId: string) => {
    try {
      setLoadingCampaignAudit(true);
      const audit = await getAdminCampaignFinancialAudit(campaignId);
      setCampaignAuditData(audit);
    } catch (err) {
      console.error('Error al cargar auditoría de campaña:', err);
    } finally {
      setLoadingCampaignAudit(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'verified':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle size={13} />
            Verificado
          </span>
        );
      case 'flagged':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <AlertTriangle size={13} />
            Observado / Irregular
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            <XCircle size={13} />
            Rechazado
          </span>
        );
      case 'pending':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-yellow-50 text-yellow-800 border border-yellow-200">
            <Clock size={13} />
            Pendiente
          </span>
        );
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Top Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
              <Receipt className="text-[#72B626]" size={26} />
              Revisión Administrativa de Gastos
            </h1>
            <p className="text-gray-500 text-sm mt-1">
              Fiscalización financiera de egresos reportados, comprobantes de pago y verificación contra planes de uso de fondos.
            </p>
          </div>
          <button
            onClick={() => {
              setRefreshing(true);
              Promise.all([loadMovements(), loadSummary()]);
            }}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-50 shadow-sm transition-all"
          >
            <RefreshCw size={16} className={refreshing ? 'animate-spin text-[#72B626]' : ''} />
            Actualizar
          </button>
        </div>

        {/* Audit Metrics Cards */}
        {summary && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
              <div className="flex items-center justify-between text-gray-500 text-xs font-bold uppercase tracking-wider">
                <span>Gastos Reportados</span>
                <DollarSign size={18} className="text-gray-400" />
              </div>
              <div className="text-2xl font-extrabold text-gray-900 mt-2">
                BOB {summary.totalExpenses.toLocaleString('es-BO', { minimumFractionDigits: 2 })}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                De {summary.totalMovements} movimientos totales en el sistema
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-yellow-200 bg-yellow-50/20 shadow-sm">
              <div className="flex items-center justify-between text-yellow-800 text-xs font-bold uppercase tracking-wider">
                <span>Pendientes de Revisión</span>
                <Clock size={18} className="text-yellow-600" />
              </div>
              <div className="text-2xl font-extrabold text-yellow-900 mt-2">
                {summary.pendingCount}
              </div>
              <div className="text-xs text-yellow-700 mt-1">
                Gastos esperando verificación de comprobante
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-amber-200 bg-amber-50/20 shadow-sm">
              <div className="flex items-center justify-between text-amber-800 text-xs font-bold uppercase tracking-wider">
                <span>Inconsistencias / Observados</span>
                <AlertTriangle size={18} className="text-amber-600" />
              </div>
              <div className="text-2xl font-extrabold text-amber-900 mt-2">
                {summary.flaggedCount}
              </div>
              <div className="text-xs text-amber-700 mt-1">
                {summary.campaignsWithIrregularitiesCount} campañas con movimientos observados
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-rose-200 bg-rose-50/20 shadow-sm">
              <div className="flex items-center justify-between text-rose-800 text-xs font-bold uppercase tracking-wider">
                <span>Sin Comprobante</span>
                <AlertCircle size={18} className="text-rose-600" />
              </div>
              <div className="text-2xl font-extrabold text-rose-900 mt-2">
                {summary.expensesWithoutReceiptCount}
              </div>
              <div className="text-xs text-rose-700 mt-1">
                Gastos declarados sin factura o recibo adjunto
              </div>
            </div>
          </div>
        )}

        {/* Filters bar */}
        <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm space-y-3">
          <form onSubmit={handleSearchSubmit} className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-3 text-gray-400" size={17} />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por concepto, Nº de factura, notas, observaciones o campaña..."
                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#72B626]/40"
              />
            </div>
            <button
              type="submit"
              className="px-4 py-2 bg-[#72B626] text-white text-sm font-semibold rounded-xl hover:bg-[#5e9620] transition-colors"
            >
              Buscar
            </button>
          </form>

          <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-gray-100 text-xs">
            <div className="flex items-center gap-1.5 text-gray-600 font-semibold">
              <Filter size={14} /> Filtros:
            </div>

            {/* Tipo */}
            <select
              value={typeFilter}
              onChange={(e) => {
                setTypeFilter(e.target.value);
                setPage(1);
              }}
              className="px-2.5 py-1.5 border border-gray-200 rounded-lg bg-gray-50 text-gray-700 font-medium"
            >
              <option value="">Tipo: Todos</option>
              <option value="expense">Solo Gastos (Egresos)</option>
              <option value="income">Solo Ingresos</option>
            </select>

            {/* Estado */}
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="px-2.5 py-1.5 border border-gray-200 rounded-lg bg-gray-50 text-gray-700 font-medium"
            >
              <option value="">Estado: Todos</option>
              <option value="pending">Pendiente de revisión</option>
              <option value="flagged">Observado / Irregular</option>
              <option value="verified">Verificado / Aprobado</option>
              <option value="rejected">Rechazado</option>
            </select>

            {/* Comprobante */}
            <select
              value={receiptFilter}
              onChange={(e) => {
                setReceiptFilter(e.target.value);
                setPage(1);
              }}
              className="px-2.5 py-1.5 border border-gray-200 rounded-lg bg-gray-50 text-gray-700 font-medium"
            >
              <option value="">Comprobante: Todos</option>
              <option value="yes">Con Comprobante adjunto</option>
              <option value="no">Sin Comprobante (Alerta)</option>
            </select>

            {(searchTerm || statusFilter || typeFilter !== 'expense' || receiptFilter) && (
              <button
                onClick={() => {
                  setSearchTerm('');
                  setStatusFilter('');
                  setTypeFilter('expense');
                  setReceiptFilter('');
                  setPage(1);
                }}
                className="text-xs text-rose-600 hover:underline font-semibold ml-auto"
              >
                Limpiar filtros
              </button>
            )}
          </div>
        </div>

        {/* Movements Table */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-base font-bold text-gray-900">
              Movimientos Financieros ({totalItems})
            </h2>
            <span className="text-xs text-gray-500">Página {page} de {totalPages}</span>
          </div>

          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center space-y-3">
              <div className="w-8 h-8 border-4 border-gray-200 border-t-[#72B626] rounded-full animate-spin"></div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Cargando movimientos...</p>
            </div>
          ) : movements.length === 0 ? (
            <div className="py-16 text-center">
              <Receipt size={40} className="mx-auto text-gray-300 mb-3" />
              <p className="text-gray-500 font-medium text-sm">No se encontraron movimientos registrados con los filtros aplicados.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-gray-700">
                <thead className="bg-gray-50 text-xs font-bold text-gray-400 uppercase tracking-wider border-b border-gray-100">
                  <tr>
                    <th className="py-3 px-4">Fecha & Concepto</th>
                    <th className="py-3 px-4">Campaña / Emprendedor</th>
                    <th className="py-3 px-4">Categoría</th>
                    <th className="py-3 px-4 text-right">Monto</th>
                    <th className="py-3 px-4 text-center">Comprobante</th>
                    <th className="py-3 px-4 text-center">Estado Auditoría</th>
                    <th className="py-3 px-4 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {movements.map((m) => (
                    <tr key={m.id} className="hover:bg-gray-50/60 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-gray-900">{m.concept}</div>
                        <div className="text-xs text-gray-500 flex items-center gap-2 mt-0.5">
                          <span>{m.movementDate}</span>
                          {m.referenceNumber && (
                            <span className="bg-gray-100 px-1.5 py-0.5 rounded text-[11px] font-mono text-gray-700">
                              Ref: {m.referenceNumber}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-medium text-gray-900 truncate max-w-[200px]" title={m.campaignTitle}>
                          {m.campaignTitle}
                        </div>
                        <div className="text-xs text-gray-500 truncate max-w-[200px]">
                          {m.creatorName} ({m.creatorEmail})
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="inline-block px-2.5 py-1 bg-gray-100 rounded-lg text-xs font-medium text-gray-700">
                          {m.category}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right font-bold text-gray-900">
                        <span className={m.type === 'expense' ? 'text-gray-900' : 'text-emerald-600'}>
                          {m.type === 'expense' ? '-' : '+'} {m.currency} {m.amount.toLocaleString('es-BO', { minimumFractionDigits: 2 })}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        {m.receiptUrl ? (
                          <a
                            href={m.receiptUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors"
                          >
                            <ExternalLink size={12} />
                            Ver Recibo
                          </a>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs text-rose-500 font-medium">
                            <AlertCircle size={13} />
                            Sin adjunto
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        {getStatusBadge(m.status)}
                        {m.reviewedAt && (
                          <div className="text-[10px] text-gray-400 mt-1">
                            Por {m.reviewerName || m.reviewerEmail || 'Admin'}
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenCampaignAudit(m.campaignId)}
                            title="Auditar Plan de Fondos de la Campaña"
                            className="p-1.5 text-gray-500 hover:text-[#72B626] hover:bg-green-50 rounded-lg transition-colors"
                          >
                            <BarChart2 size={16} />
                          </button>
                          <button
                            onClick={() => handleOpenReview(m)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-[#72B626] text-white text-xs font-bold rounded-lg hover:bg-[#5e9620] shadow-sm transition-all"
                          >
                            <ShieldCheck size={14} />
                            Revisar
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="px-6 py-3 border-t border-gray-100 flex items-center justify-between">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-gray-200 disabled:opacity-40"
              >
                Anterior
              </button>
              <span className="text-xs text-gray-500">
                Página {page} de {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-gray-200 disabled:opacity-40"
              >
                Siguiente
              </button>
            </div>
          )}
        </div>

        {/* Review Modal */}
        {selectedMovement && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-gray-200 space-y-5 animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
              <div className="flex items-start justify-between border-b border-gray-100 pb-3">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Auditoría de Movimiento Financiero</h3>
                  <p className="text-xs text-gray-500 mt-0.5">Campaña: {selectedMovement.campaignTitle}</p>
                </div>
                <button
                  onClick={() => setSelectedMovement(null)}
                  className="text-gray-400 hover:text-gray-600 p-1"
                >
                  <XCircle size={20} />
                </button>
              </div>

              {/* Movement Summary Details */}
              <div className="bg-gray-50 p-4 rounded-xl space-y-2 text-xs text-gray-700">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-gray-400 font-bold block">Concepto:</span>
                    <span className="font-semibold text-gray-900 text-sm">{selectedMovement.concept}</span>
                  </div>
                  <div>
                    <span className="text-gray-400 font-bold block">Monto Declarado:</span>
                    <span className="font-bold text-gray-900 text-sm">
                      {selectedMovement.currency} {selectedMovement.amount.toLocaleString('es-BO', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-400 font-bold block">Categoría:</span>
                    <span>{selectedMovement.category}</span>
                  </div>
                  <div>
                    <span className="text-gray-400 font-bold block">Fecha del Gasto:</span>
                    <span>{selectedMovement.movementDate}</span>
                  </div>
                  <div>
                    <span className="text-gray-400 font-bold block">Nº Comprobante / Factura:</span>
                    <span>{selectedMovement.referenceNumber || 'No especificado'}</span>
                  </div>
                  <div>
                    <span className="text-gray-400 font-bold block">Emprendedor Responsable:</span>
                    <span>{selectedMovement.creatorName}</span>
                  </div>
                </div>

                {selectedMovement.notes && (
                  <div className="pt-2 border-t border-gray-200">
                    <span className="text-gray-400 font-bold block">Notas del Emprendedor:</span>
                    <p className="italic text-gray-600 mt-0.5">{selectedMovement.notes}</p>
                  </div>
                )}

                {/* Comprobante link */}
                <div className="pt-2 border-t border-gray-200 flex items-center justify-between">
                  <span className="font-bold text-gray-500">Documento Comprobante:</span>
                  {selectedMovement.receiptUrl ? (
                    <a
                      href={selectedMovement.receiptUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
                    >
                      <ExternalLink size={13} />
                      Abrir Archivo de Respaldo
                    </a>
                  ) : (
                    <span className="text-rose-600 font-bold flex items-center gap-1">
                      <AlertCircle size={14} /> Sin archivo de respaldo adjunto
                    </span>
                  )}
                </div>
              </div>

              {/* Consistency Flags */}
              {selectedMovement.consistencyFlags && selectedMovement.consistencyFlags.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1">
                    <AlertTriangle size={14} className="text-amber-500" />
                    Observaciones Automáticas de Consistencia
                  </h4>
                  <div className="space-y-1.5">
                    {selectedMovement.consistencyFlags.map((flag, idx) => (
                      <div
                        key={idx}
                        className={`p-2.5 rounded-xl border text-xs flex items-start gap-2 ${
                          flag.severity === 'danger'
                            ? 'bg-rose-50 border-rose-200 text-rose-800'
                            : flag.severity === 'warning'
                            ? 'bg-amber-50 border-amber-200 text-amber-800'
                            : 'bg-blue-50 border-blue-200 text-blue-800'
                        }`}
                      >
                        <AlertCircle size={15} className="shrink-0 mt-0.5" />
                        <span>{flag.message}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Action selection */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-700 uppercase tracking-wider block">
                  Decisión de Auditoría
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setReviewAction('approve')}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold flex flex-col items-center gap-1 transition-all ${
                      reviewAction === 'approve'
                        ? 'bg-emerald-50 border-emerald-500 text-emerald-800 shadow-sm ring-2 ring-emerald-500/20'
                        : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <CheckCircle size={16} className={reviewAction === 'approve' ? 'text-emerald-600' : 'text-gray-400'} />
                    Aprobar / Verificado
                  </button>

                  <button
                    type="button"
                    onClick={() => setReviewAction('flag')}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold flex flex-col items-center gap-1 transition-all ${
                      reviewAction === 'flag'
                        ? 'bg-amber-50 border-amber-500 text-amber-800 shadow-sm ring-2 ring-amber-500/20'
                        : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <AlertTriangle size={16} className={reviewAction === 'flag' ? 'text-amber-600' : 'text-gray-400'} />
                    Marcar Observado
                  </button>

                  <button
                    type="button"
                    onClick={() => setReviewAction('reject')}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold flex flex-col items-center gap-1 transition-all ${
                      reviewAction === 'reject'
                        ? 'bg-rose-50 border-rose-500 text-rose-800 shadow-sm ring-2 ring-rose-500/20'
                        : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <XCircle size={16} className={reviewAction === 'reject' ? 'text-rose-600' : 'text-gray-400'} />
                    Rechazar
                  </button>
                </div>
              </div>

              {/* Review Notes */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-700 uppercase tracking-wider block">
                  Notas de Auditoría y Observaciones {reviewAction !== 'approve' && <span className="text-rose-500">*</span>}
                </label>
                <textarea
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  rows={3}
                  placeholder={
                    reviewAction === 'approve'
                      ? 'Notas opcionales de auditoría...'
                      : 'Explica la inconsistencia detectada o motivo de rechazo para el emprendedor...'
                  }
                  className="w-full p-3 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#72B626]/40"
                />
              </div>

              {reviewError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
                  <AlertCircle size={15} />
                  {reviewError}
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setSelectedMovement(null)}
                  className="px-4 py-2 border border-gray-200 rounded-xl text-xs font-semibold text-gray-600 hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSubmitReview}
                  disabled={submittingReview}
                  className="px-5 py-2 bg-[#72B626] text-white text-xs font-bold rounded-xl hover:bg-[#5e9620] shadow-sm disabled:opacity-50"
                >
                  {submittingReview ? 'Guardando...' : 'Confirmar Dictamen'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Campaign Deep-Dive Audit Modal */}
        {campaignAuditData && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-3xl w-full p-6 shadow-2xl border border-gray-200 space-y-5 max-h-[90vh] overflow-y-auto">
              <div className="flex items-start justify-between border-b border-gray-100 pb-3">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Auditoría Presupuestaria de la Campaña</h3>
                  <p className="text-xs text-gray-500 mt-0.5">{campaignAuditData.campaign?.title}</p>
                </div>
                <button
                  onClick={() => setCampaignAuditData(null)}
                  className="text-gray-400 hover:text-gray-600 p-1"
                >
                  <XCircle size={20} />
                </button>
              </div>

              {/* Comparison Table */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Plan de Fondos vs Gastos Reales Ejecutados
                </h4>
                <div className="border border-gray-200 rounded-xl overflow-hidden">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-gray-50 text-gray-400 uppercase font-bold border-b border-gray-200">
                      <tr>
                        <th className="py-2.5 px-3">Categoría</th>
                        <th className="py-2.5 px-3 text-right">Presupuestado</th>
                        <th className="py-2.5 px-3 text-right">Ejecutado</th>
                        <th className="py-2.5 px-3 text-right">Varianza</th>
                        <th className="py-2.5 px-3 text-center">Comprobantes Faltantes</th>
                        <th className="py-2.5 px-3 text-center">Estado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {campaignAuditData.fundingPlanComparison?.map((plan: any) => (
                        <tr key={plan.id} className="hover:bg-gray-50">
                          <td className="py-2.5 px-3 font-semibold text-gray-900">{plan.category}</td>
                          <td className="py-2.5 px-3 text-right font-medium">BOB {plan.budgetedAmount.toLocaleString('es-BO')}</td>
                          <td className="py-2.5 px-3 text-right font-bold text-gray-900">BOB {plan.spentAmount.toLocaleString('es-BO')}</td>
                          <td className="py-2.5 px-3 text-right font-semibold">
                            <span className={plan.variance < 0 ? 'text-rose-600' : 'text-emerald-600'}>
                              BOB {plan.variance.toLocaleString('es-BO')}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            {plan.missingReceiptCount > 0 ? (
                              <span className="text-rose-600 font-bold">{plan.missingReceiptCount} faltantes</span>
                            ) : (
                              <span className="text-emerald-600">Al día</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            {plan.isOverbudget ? (
                              <span className="px-2 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200 font-bold text-[10px]">
                                Sobregirado
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold text-[10px]">
                                En presupuesto
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Unbudgeted expenses */}
              {campaignAuditData.unbudgetedExpenses?.length > 0 && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-1">
                  <div className="text-xs font-bold text-amber-800 flex items-center gap-1.5">
                    <AlertTriangle size={15} />
                    Gastos en categorías no planificadas ({campaignAuditData.unbudgetedExpenses.length}):
                  </div>
                  <ul className="text-xs text-amber-900 list-disc list-inside">
                    {campaignAuditData.unbudgetedExpenses.map((u: any) => (
                      <li key={u.id}>
                        {u.concept} - {u.category} (BOB {u.amount})
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="flex justify-end pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setCampaignAuditData(null)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-xl transition-colors"
                >
                  Cerrar Auditoría
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
