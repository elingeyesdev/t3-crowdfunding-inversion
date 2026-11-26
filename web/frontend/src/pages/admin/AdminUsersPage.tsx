import { useState, useEffect, useCallback, useRef } from 'react';
import { AdminLayout } from '../../components/admin/AdminLayout';
import { RequestErrorNotice } from '../../components/RequestErrorNotice';
import { getAllUsers, updateUserStatus, getUserStatusHistory } from '../../api/admin.api';
import type { SystemUser, UserStatusHistoryPage } from '../../types/admin.types';
import { 
  Users, 
  Search, 
  Trash2, 
  Mail, 
  Calendar,
  CheckCircle,
  XCircle,
  AlertTriangle,
  RotateCcw,
  History
} from 'lucide-react';

export function AdminUsersPage() {
  const [users, setUsers] = useState<SystemUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<unknown>(null);
  const [actionError, setActionError] = useState<unknown>(null);
  const [hasLoaded, setHasLoaded] = useState(false);
  const latestRequest = useRef(0);
  const mounted = useRef(false);
  const pending = useRef(false);
  const [reason, setReason] = useState('');
  const [validation, setValidation] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [historyUser, setHistoryUser] = useState<SystemUser | null>(null);

  // Dialog state
  const [dialog, setDialog] = useState<{
    isOpen: boolean;
    user: SystemUser;
    active: boolean;
  } | null>(null);

  const loadUsers = useCallback(async () => {
    if (pending.current) return;
    const requestId = ++latestRequest.current;
    setLoadError(null);
    try {
      setLoading(true);
      const data = await getAllUsers();
      if (!mounted.current || requestId !== latestRequest.current) return;
      // Sort users by registration date descending if possible
      const sorted = [...data].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setUsers(sorted);
      setHasLoaded(true);
    } catch (error) {
      if (mounted.current && requestId === latestRequest.current) setLoadError(error);
    } finally {
      if (mounted.current && requestId === latestRequest.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    void Promise.resolve().then(() => { if (mounted.current) void loadUsers(); });
    return () => { mounted.current = false; };
  }, [loadUsers]);

  const handleStatusClick = (user: SystemUser, active: boolean) => {
    setDialog({ isOpen: true, user, active });
    setReason(''); setValidation(null); setActionError(null); setSuccess(null);
  };

  const handleConfirmStatus = async () => {
    if (!dialog || pending.current) return;
    const trimmed = reason.trim();
    if (trimmed.length < 3 || trimmed.length > 2000) { setValidation('Ingresa un motivo de entre 3 y 2000 caracteres.'); return; }
    const { user, active } = dialog;
    const userId = user.id;
    pending.current = true;
    latestRequest.current++;
    setLoading(false);
    setActionLoading(userId);
    setActionError(null);
    setValidation(null);
    try {
      const confirmed = await updateUserStatus(userId, active, trimmed, user.status_version);
      if (mounted.current) {
        setUsers(current => current.map(row => row.id === confirmed.id ? confirmed : row));
        setDialog(null);
        setSuccess(active ? 'Cuenta reactivada. El usuario debe iniciar sesión nuevamente.' : 'Cuenta suspendida. Se revocaron sus accesos.');
      }
    } catch (error) {
      if (mounted.current) setActionError(error);
    } finally {
      pending.current = false;
      if (mounted.current) setActionLoading(null);
    }
  };

  const filteredUsers = users.filter(user => 
    user.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <AdminLayout>
      <div className="space-y-6 animate-in fade-in duration-500">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
              <Users className="text-[#72B626]" size={26} />
              Gestión de Usuarios
            </h1>
            <p className="text-gray-500 text-[14px]">
              Visualiza y gestiona los accesos de los usuarios registrados en el sistema.
            </p>
          </div>
          <div className="bg-white border border-gray-200 px-4 py-2.5 rounded-xl flex items-center gap-2.5 shadow-sm">
            <Users size={16} className="text-[#72B626]" />
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Usuarios:</span>
            <span className="text-sm font-bold text-gray-800">{hasLoaded ? users.length : '—'}</span>
          </div>
        </div>

        {/* Search Bar */}
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input 
              type="text" 
              placeholder="Buscar usuario por correo electrónico..."
              className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-gray-900 placeholder:text-gray-400 focus:outline-none focus:bg-white focus:border-[#72B626] focus:ring-3 focus:ring-[#72B626]/10 transition-all font-medium text-[13px]"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button 
            onClick={loadUsers}
            disabled={loading || actionLoading !== null || dialog !== null}
            className="px-4 py-2 bg-[#72B626] hover:bg-[#4a7f1a] text-white font-semibold rounded-lg transition-all active:scale-95 cursor-pointer border-none text-[13px]"
          >
            Actualizar Lista
          </button>
        </div>

        {/* Users Table */}
        {loadError !== null && <RequestErrorNotice error={loadError} fallback="No se pudieron cargar los usuarios. Intenta nuevamente." onRetry={() => void loadUsers()} stale={hasLoaded} retrying={loading} />}
        {success && <p role="status" className="rounded-xl bg-green-50 p-4 text-sm text-green-800">{success}</p>}
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
          {loading ? (
            <div className="py-24 flex flex-col items-center justify-center space-y-3">
              <div className="w-8 h-8 border-4 border-gray-200 border-t-[#72B626] rounded-full animate-spin"></div>
              <p className="text-gray-400 font-bold uppercase tracking-wider text-[10px]">Cargando usuarios...</p>
            </div>
          ) : filteredUsers.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50/50">
                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">Usuario</th>
                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">Fecha de Registro</th>
                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">Estado</th>
                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wide text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {filteredUsers.map((user) => (
                    <tr key={user.id} className="hover:bg-gray-50/30 transition-colors group">
                      {/* User Email Column */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center text-gray-400 group-hover:bg-[#f5fce8] group-hover:text-[#72B626] transition-all">
                            <Mail size={16} />
                          </div>
                          <div className="flex flex-col">
                            <span className="text-gray-900 font-semibold text-[14px] group-hover:text-[#72B626] transition-colors">
                              {user.email}
                            </span>
                            <span className="text-[10px] text-gray-400">ID: {user.id.substring(0, 8)}...</span>
                          </div>
                        </div>
                      </td>

                      {/* Created At Column */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-gray-600 font-medium text-[13px]">
                          <Calendar size={14} className="text-gray-400" />
                          {new Date(user.created_at).toLocaleDateString('es-ES', { 
                            day: 'numeric', 
                            month: 'long', 
                            year: 'numeric' 
                          })}
                        </div>
                      </td>

                      {/* Status Column */}
                      <td className="px-6 py-4">
                        {user.is_active ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold text-emerald-700 bg-green-50 border border-green-100">
                            <CheckCircle size={12} /> Activo
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold text-red-700 bg-red-50 border border-red-100">
                            <XCircle size={12} /> Suspendido
                          </span>
                        )}
                      </td>

                      {/* Action Column */}
                      <td className="px-6 py-4 text-right">
                        {user.can_suspend ? (
                          <button 
                            onClick={() => handleStatusClick(user, false)}
                            disabled={actionLoading !== null || loading || loadError !== null}
                            className="px-3 py-1.5 bg-white border border-gray-200 text-gray-500 hover:text-red-600 hover:border-red-200 hover:bg-red-50 rounded-lg transition-all active:scale-95 shadow-sm inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                            title="Suspender Cuenta"
                          >
                            <Trash2 size={14} />
                            <span className="text-[11px] font-bold uppercase tracking-wider hidden md:inline">Suspender</span>
                          </button>
                        ) : user.can_reactivate ? (
                          <button title="Reactivar Cuenta" disabled={actionLoading !== null || loading || loadError !== null} onClick={() => handleStatusClick(user, true)} className="inline-flex items-center gap-1.5 rounded-lg border border-green-200 px-3 py-1.5 text-green-700 disabled:opacity-50"><RotateCcw size={14} /><span className="text-[11px] font-bold">Reactivar</span></button>
                        ) : (
                          <span className="text-[11px] font-semibold text-gray-400 italic">Sin acciones autorizadas</span>
                        )}
                        {user.can_view_history && <button title="Ver historial de estado" disabled={actionLoading !== null || loading || loadError !== null} onClick={() => setHistoryUser(user)} className="ml-3 inline-flex items-center gap-1 text-xs text-gray-600 disabled:opacity-50"><History size={14} />Historial</button>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : loadError !== null ? null : (
            <div className="py-20 flex flex-col items-center justify-center text-center px-6">
              <div className="w-14 h-14 bg-gray-50 rounded-full flex items-center justify-center text-gray-400 mb-4">
                <Users size={28} />
              </div>
              <h3 className="text-base font-bold text-gray-800 mb-1">Sin resultados</h3>
              <p className="text-gray-500 max-w-sm text-xs">
                No se encontraron usuarios que coincidan con la búsqueda "{searchTerm}".
              </p>
            </div>
          )}
        </div>

        {/* Confirmation Dialog */}
        {dialog && dialog.isOpen && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div 
              className="absolute inset-0 bg-gray-950/60 backdrop-blur-sm" 
              onClick={() => { if (!pending.current) setDialog(null); }}
            />
            <form noValidate onSubmit={event => { event.preventDefault(); void handleConfirmStatus(); }} role="dialog" aria-modal="true" aria-label={dialog.active ? 'Reactivar cuenta' : 'Suspender cuenta'} onKeyDown={event => { if (event.key === 'Escape' && !pending.current) setDialog(null); }} className="bg-white rounded-2xl w-full max-w-md p-6 relative z-10 shadow-xl border border-gray-200 animate-in zoom-in-95 duration-200">
              <div className="flex items-center gap-3 mb-3 text-red-600">
                <AlertTriangle size={24} />
                <h3 className="text-lg font-bold text-gray-900">{dialog.active ? '¿Reactivar usuario?' : '¿Suspender usuario?'}</h3>
              </div>
              
              <p className="text-gray-500 font-medium text-sm mb-5 leading-relaxed">
                Cuenta: <span className="font-bold text-gray-900">{dialog.user.email}</span>.{' '}
                {dialog.active ? 'Se habilitará el acceso mediante un nuevo inicio de sesión. Los tokens anteriores no se restaurarán.' : 'Se desactivará su acceso y se revocarán sus sesiones. Sus datos se conservarán.'}
              </p>
              <label htmlFor="status-reason" className="block text-sm font-semibold mb-2">Motivo del cambio</label>
              <textarea id="status-reason" autoFocus maxLength={2000} value={reason} onChange={event => setReason(event.target.value)} disabled={actionLoading !== null} className="w-full rounded-lg border p-3 mb-3" />
              {validation && <p role="alert" className="mb-3 text-sm text-red-700">{validation}</p>}
              {actionError !== null && <RequestErrorNotice error={actionError} fallback="No se pudo cambiar el estado. Conservamos el motivo para que puedas reintentar." />}
              
              <div className="flex justify-end gap-2.5">
                <button
                  type="button"
                  disabled={actionLoading !== null}
                  onClick={() => setDialog(null)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-lg text-xs uppercase tracking-wider transition-all active:scale-95 border-none cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={actionLoading !== null}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg text-xs uppercase tracking-wider transition-all active:scale-95 border-none cursor-pointer"
                >
                  {actionLoading !== null ? 'Procesando...' : 'Confirmar'}
                </button>
              </div>
            </form>
          </div>
        )}

        {historyUser && <StatusHistoryDialog key={historyUser.id} user={historyUser} onClose={() => setHistoryUser(null)} />}
      </div>
    </AdminLayout>
  );
}

function StatusHistoryDialog({ user, onClose }: { user: SystemUser; onClose: () => void }) {
  const [page, setPage] = useState(1);
  const [retry, setRetry] = useState(0);
  const [data, setData] = useState<UserStatusHistoryPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  useEffect(() => {
    let active = true;
    getUserStatusHistory(user.id, page).then(result => { if (active) setData(result); })
      .catch(failure => { if (active) setError(failure); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [user.id, page, retry]);
  return <div className="fixed inset-0 z-[200] flex items-center justify-center bg-gray-950/60 p-4">
    <section role="dialog" aria-modal="true" aria-label="Historial de estado" onKeyDown={event => { if (event.key === 'Escape') onClose(); }} className="w-full max-w-xl max-h-[85vh] overflow-auto rounded-2xl bg-white p-6 space-y-4">
      <h2 className="text-lg font-bold">Historial de estado</h2><p className="text-sm text-gray-600">{user.email}</p>
      {loading && <p role="status">Cargando historial...</p>}
      {error !== null && <RequestErrorNotice error={error} fallback="No se pudo cargar el historial." onRetry={() => { setLoading(true); setError(null); setData(null); setRetry(value => value + 1); }} />}
      {data && <>
        {data.entries.length === 0 ? <p>No hay cambios registrados. Las suspensiones anteriores a esta función pueden no tener historial.</p> : <ol className="space-y-4">{data.entries.map(entry => <li key={entry.id} className="rounded-xl border p-3 text-sm space-y-1">
          <p className="font-semibold">{entry.toActive ? 'Reactivación' : 'Suspensión'} · {new Date(entry.createdAt).toLocaleString('es-BO')}</p>
          <p>Responsable: {entry.actorEmail ?? entry.actorId}</p><p className="whitespace-pre-wrap break-words">Motivo: {entry.reason}</p>
        </li>)}</ol>}
        <div className="flex items-center gap-3 text-sm"><button disabled={loading || page <= 1} onClick={() => { setLoading(true); setData(null); setPage(value => value - 1); }}>Anterior</button><span>Página {data.page} de {data.totalPages}</span><button disabled={loading || page >= data.totalPages} onClick={() => { setLoading(true); setData(null); setPage(value => value + 1); }}>Siguiente</button></div>
      </>}
      <button autoFocus onClick={onClose} className="rounded-lg bg-gray-100 px-4 py-2 font-semibold">Cerrar historial</button>
    </section>
  </div>;
}
