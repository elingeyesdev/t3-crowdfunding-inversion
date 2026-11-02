import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Navbar } from '../components/Navbar';
import {
  getMyNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
  clearReadNotifications,
  getNotificationPreferences,
  updateNotificationPreferences,
  type AppNotification,
  type NotificationPreferences,
} from '../api/notifications.api';
import {
  Bell,
  BellRing,
  CheckCheck,
  Trash2,
  Filter,
  Search,
  ExternalLink,
  CheckCircle2,
  XCircle,
  Rocket,
  TrendingUp,
  MessageCircle,
  Star,
  FileText,
  Info,
  Sliders,
  RefreshCw,
  Clock,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  X,
  Check,
} from 'lucide-react';

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Justo ahora';
  if (mins < 60) return `Hace ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Hace ${hours}h`;
  const days = Math.floor(hours / 24);
  return `Hace ${days}d`;
}

function formatDate(dateStr: string): string {
  try {
    return new Intl.DateTimeFormat('es-BO', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(dateStr));
  } catch {
    return dateStr;
  }
}

function getCategoryFromType(typeCode?: string | null): string {
  if (!typeCode) return 'system';
  if (typeCode.startsWith('investment_')) return 'investment';
  if (typeCode.startsWith('campaign_')) return 'campaign';
  if (typeCode.startsWith('kyc_')) return 'kyc';
  if (typeCode === 'new_message' || typeCode === 'new_comment') return 'chat';
  if (typeCode.startsWith('financial_') || typeCode.startsWith('document_')) return 'financial';
  return 'system';
}

function getCategoryBadge(typeCode?: string | null): { label: string; color: string } {
  const cat = getCategoryFromType(typeCode);
  switch (cat) {
    case 'investment':
      return { label: 'Inversión', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
    case 'campaign':
      return { label: 'Campaña', color: 'bg-blue-50 text-blue-700 border-blue-200' };
    case 'kyc':
      return { label: 'Identidad KYC', color: 'bg-purple-50 text-purple-700 border-purple-200' };
    case 'chat':
      return { label: 'Mensajería', color: 'bg-indigo-50 text-indigo-700 border-indigo-200' };
    case 'financial':
      return { label: 'Auditoría', color: 'bg-amber-50 text-amber-700 border-amber-200' };
    default:
      return { label: 'Sistema', color: 'bg-slate-50 text-slate-700 border-slate-200' };
  }
}

function NotifIcon({ typeCode }: { typeCode?: string | null }) {
  const base = 'w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0';

  if (!typeCode) return <div className={`${base} bg-slate-100`}><Info size={18} className="text-slate-500" /></div>;

  if (typeCode === 'investment_received' || typeCode === 'investment_confirmed') {
    return <div className={`${base} bg-emerald-100`}><TrendingUp size={18} className="text-emerald-600" /></div>;
  }
  if (typeCode === 'investment_refunded') {
    return <div className={`${base} bg-amber-100`}><TrendingUp size={18} className="text-amber-600" /></div>;
  }
  if (typeCode === 'new_message' || typeCode === 'new_comment') {
    return <div className={`${base} bg-blue-100`}><MessageCircle size={18} className="text-blue-600" /></div>;
  }
  if (typeCode === 'campaign_approved' || typeCode === 'financial_movement_verified' || typeCode === 'kyc_approved') {
    return <div className={`${base} bg-green-100`}><CheckCircle2 size={18} className="text-green-600" /></div>;
  }
  if (typeCode === 'campaign_rejected' || typeCode === 'financial_movement_rejected' || typeCode === 'kyc_rejected') {
    return <div className={`${base} bg-red-100`}><XCircle size={18} className="text-red-500" /></div>;
  }
  if (typeCode === 'financial_movement_flagged') {
    return <div className={`${base} bg-amber-100`}><FileText size={18} className="text-amber-600" /></div>;
  }
  if (typeCode === 'campaign_funded') {
    return <div className={`${base} bg-amber-100`}><Star size={18} className="text-amber-500" /></div>;
  }
  if (typeCode.startsWith('campaign_')) {
    return <div className={`${base} bg-indigo-100`}><Rocket size={18} className="text-indigo-500" /></div>;
  }
  return <div className={`${base} bg-slate-100`}><Info size={18} className="text-slate-500" /></div>;
}

export function NotificationsPage() {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters state
  const [filterStatus, setFilterStatus] = useState<'all' | 'unread' | 'read'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Preferences modal state
  const [showPreferences, setShowPreferences] = useState(false);
  const [preferences, setPreferences] = useState<NotificationPreferences>({
    inAppEnabled: true,
    emailEnabled: true,
    campaignStatusUpdates: true,
    investmentAlerts: true,
    commentAlerts: true,
    milestoneUpdates: true,
  });
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [prefsSuccess, setPrefsSuccess] = useState(false);

  const fetchNotifications = useCallback(async () => {
    try {
      setLoading(true);
      const isUnread = filterStatus === 'unread' ? true : filterStatus === 'read' ? false : undefined;
      const res = await getMyNotifications({
        page,
        limit: 12,
        unread: isUnread,
        q: searchTerm || undefined,
      });

      setNotifications(res.notifications || []);
      setUnreadCount(res.unreadCount || 0);
      setTotalPages(res.totalPages || Math.max(1, Math.ceil((res.total || res.notifications.length) / (res.perPage || 12))));
      setTotalCount(res.total ?? res.notifications.length);
    } catch (err) {
      console.error('Error cargando notificaciones:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [page, filterStatus, searchTerm]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const handleOpenPreferences = async () => {
    setShowPreferences(true);
    try {
      const prefs = await getNotificationPreferences();
      if (prefs) setPreferences(prefs);
    } catch (e) {
      console.warn('Could not load preferences:', e);
    }
  };

  const handleSavePreferences = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingPrefs(true);
    try {
      await updateNotificationPreferences(preferences);
      setPrefsSuccess(true);
      setTimeout(() => {
        setPrefsSuccess(false);
        setShowPreferences(false);
      }, 1200);
    } catch (err) {
      console.error('Error saving notification preferences:', err);
    } finally {
      setSavingPrefs(false);
    }
  };

  const handleMarkOne = async (notif: AppNotification) => {
    if (!notif.isRead) {
      try {
        await markNotificationAsRead(notif.id);
        setNotifications((prev) =>
          prev.map((n) => (n.id === notif.id ? { ...n, isRead: true } : n))
        );
        setUnreadCount((c) => Math.max(0, c - 1));
      } catch (err) {
        console.error('Error al marcar notificación:', err);
      }
    }
    if (notif.actionUrl) {
      navigate(notif.actionUrl);
    }
  };

  const handleMarkAll = async () => {
    try {
      await markAllNotificationsAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error('Error al marcar todas como leídas:', err);
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string, wasRead: boolean) => {
    e.stopPropagation();
    try {
      await deleteNotification(id);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      if (!wasRead) {
        setUnreadCount((c) => Math.max(0, c - 1));
      }
      setTotalCount((c) => Math.max(0, c - 1));
    } catch (err) {
      console.error('Error al eliminar notificación:', err);
    }
  };

  const handleClearRead = async () => {
    try {
      await clearReadNotifications();
      setNotifications((prev) => prev.filter((n) => !n.isRead));
      setTotalCount((c) => Math.max(unreadCount, c - (notifications.length - unreadCount)));
    } catch (err) {
      console.error('Error al limpiar leídas:', err);
    }
  };

  // Filter by category client-side
  const filteredNotifications = notifications.filter((notif) => {
    if (categoryFilter === 'all') return true;
    return getCategoryFromType(notif.typeCode) === categoryFilter;
  });

  return (
    <div className="min-h-screen bg-[#f9fafb] text-gray-800" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <Navbar />

      <main className="max-w-4xl mx-auto py-8 px-4 sm:px-6">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-gray-200">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-[#f0f9e0] flex items-center justify-center text-[#72B626]">
                <Bell size={22} strokeWidth={2.5} />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Centro de Notificaciones</h1>
                <p className="text-sm text-gray-500">
                  Consulta tus avisos, alertas de proyectos e historial de actividad.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 self-start md:self-auto">
            <button
              onClick={() => {
                setRefreshing(true);
                fetchNotifications();
              }}
              disabled={refreshing}
              className="p-2.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-600 transition-colors cursor-pointer"
              title="Actualizar notificaciones"
            >
              <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
            </button>

            <button
              onClick={handleOpenPreferences}
              className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-xs font-bold text-gray-700 transition-colors cursor-pointer"
            >
              <Sliders size={15} />
              <span>Preferencias</span>
            </button>

            {unreadCount > 0 && (
              <button
                onClick={handleMarkAll}
                className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-[#72B626] hover:bg-[#5e9620] text-xs font-bold text-white transition-colors cursor-pointer shadow-sm border-none"
              >
                <CheckCheck size={15} strokeWidth={2.5} />
                <span>Marcar todas leídas</span>
              </button>
            )}
          </div>
        </div>

        {/* Filters and Search Bar */}
        <div className="my-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-gray-200 shadow-sm">
            {/* Status tabs */}
            <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl">
              <button
                onClick={() => {
                  setFilterStatus('all');
                  setPage(1);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer border-none ${
                  filterStatus === 'all'
                    ? 'bg-white text-gray-900 shadow-xs'
                    : 'text-gray-500 hover:text-gray-800 bg-transparent'
                }`}
              >
                Todas ({totalCount})
              </button>
              <button
                onClick={() => {
                  setFilterStatus('unread');
                  setPage(1);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer border-none flex items-center gap-1.5 ${
                  filterStatus === 'unread'
                    ? 'bg-white text-[#4a7f1a] shadow-xs'
                    : 'text-gray-500 hover:text-gray-800 bg-transparent'
                }`}
              >
                <span>No leídas</span>
                {unreadCount > 0 && (
                  <span className="bg-[#72B626] text-white text-[10px] px-1.5 py-0.2 rounded-full">
                    {unreadCount}
                  </span>
                )}
              </button>
              <button
                onClick={() => {
                  setFilterStatus('read');
                  setPage(1);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer border-none ${
                  filterStatus === 'read'
                    ? 'bg-white text-gray-900 shadow-xs'
                    : 'text-gray-500 hover:text-gray-800 bg-transparent'
                }`}
              >
                Historial leídas
              </button>
            </div>

            {/* Actions for read notifications */}
            {notifications.some((n) => n.isRead) && (
              <button
                onClick={handleClearRead}
                className="text-xs font-semibold text-gray-400 hover:text-rose-600 transition-colors flex items-center gap-1 self-end sm:self-auto cursor-pointer bg-transparent border-none"
              >
                <Trash2 size={14} />
                Limpiar leídas
              </button>
            )}
          </div>

          {/* Search & Category selectors */}
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <div className="relative flex-1 w-full">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar en notificaciones por texto o título..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setPage(1);
                }}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:border-[#72B626] transition-colors shadow-xs"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Filter size={15} className="text-gray-400 shrink-0 hidden sm:block" />
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                aria-label="Filtrar por categoría"
                className="w-full sm:w-auto px-3.5 py-2.5 rounded-xl border border-gray-200 bg-white text-xs font-semibold text-gray-700 focus:outline-none focus:border-[#72B626] transition-colors shadow-xs cursor-pointer"
              >
                <option value="all">Todas las categorías</option>
                <option value="campaign">Campañas y Proyectos</option>
                <option value="investment">Inversiones y Aportes</option>
                <option value="kyc">Identidad y KYC</option>
                <option value="chat">Mensajes y Comentarios</option>
                <option value="financial">Auditoría Financiera</option>
                <option value="system">Sistema y General</option>
              </select>
            </div>
          </div>
        </div>

        {/* Notifications Feed */}
        {loading ? (
          <div className="py-24 flex flex-col items-center justify-center space-y-3 bg-white rounded-2xl border border-gray-200">
            <div className="w-10 h-10 border-4 border-gray-200 border-t-[#72B626] rounded-full animate-spin"></div>
            <p className="text-gray-400 font-bold uppercase tracking-wider text-xs">Cargando notificaciones...</p>
          </div>
        ) : filteredNotifications.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center shadow-sm">
            <div className="w-14 h-14 rounded-2xl bg-[#f0f9e0] text-[#72B626] flex items-center justify-center mx-auto mb-3.5">
              <BellRing size={26} strokeWidth={2} />
            </div>
            <h3 className="text-base font-bold text-gray-900">No se encontraron notificaciones</h3>
            <p className="text-xs text-gray-500 max-w-sm mx-auto mt-1">
              {filterStatus === 'unread'
                ? '¡Excelente! Estás al día con todos tus acontecimientos y actividades.'
                : 'Aún no tienes actividad registrada con los filtros seleccionados.'}
            </p>
            {(searchTerm || categoryFilter !== 'all' || filterStatus !== 'all') && (
              <button
                onClick={() => {
                  setSearchTerm('');
                  setCategoryFilter('all');
                  setFilterStatus('all');
                }}
                className="mt-4 px-4 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-xs font-bold text-gray-700 transition-colors cursor-pointer border-none"
              >
                Restablecer filtros
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredNotifications.map((notif) => {
              const badge = getCategoryBadge(notif.typeCode);
              return (
                <div
                  key={notif.id}
                  onClick={() => handleMarkOne(notif)}
                  className={`p-4 sm:p-5 rounded-2xl border transition-all duration-200 cursor-pointer group flex items-start gap-4 ${
                    notif.isRead
                      ? 'bg-white border-gray-200 hover:border-gray-300 hover:shadow-xs'
                      : 'bg-[#fbfef5] border-[#72B626]/30 shadow-xs hover:border-[#72B626]'
                  }`}
                >
                  <NotifIcon typeCode={notif.typeCode} />

                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border uppercase tracking-wider ${badge.color}`}>
                          {badge.label}
                        </span>
                        {!notif.isRead && (
                          <span className="w-2 h-2 rounded-full bg-[#72B626] shrink-0" title="No leída" />
                        )}
                      </div>

                      <div className="flex items-center gap-2 text-gray-400 text-xs" title={formatDate(notif.createdAt)}>
                        <Clock size={13} />
                        <span className="font-medium text-[11px]">{timeAgo(notif.createdAt)}</span>
                      </div>
                    </div>

                    <h4 className={`text-sm mt-1.5 leading-snug ${notif.isRead ? 'font-semibold text-gray-800' : 'font-bold text-gray-950'}`}>
                      {notif.title}
                    </h4>

                    <p className="text-xs text-gray-600 mt-1 leading-relaxed">
                      {notif.body}
                    </p>

                    <div className="flex items-center justify-between mt-3 pt-2 border-t border-gray-100">
                      <div className="flex items-center gap-2">
                        {notif.actionUrl && (
                          <span className="inline-flex items-center gap-1 text-xs font-bold text-[#72B626] group-hover:underline">
                            Ver detalles <ExternalLink size={12} />
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={(e) => handleDelete(e, notif.id, notif.isRead)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-rose-600 hover:bg-rose-50 transition-colors opacity-0 group-hover:opacity-100 cursor-pointer border-none bg-transparent"
                          title="Eliminar notificación"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination controls */}
        {totalPages > 1 && (
          <div className="mt-8 flex items-center justify-between bg-white px-4 py-3 rounded-2xl border border-gray-200">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl border border-gray-200 text-xs font-bold text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer bg-white"
            >
              <ChevronLeft size={15} /> Anterior
            </button>

            <span className="text-xs font-bold text-gray-500">
              Página {page} de {totalPages}
            </span>

            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl border border-gray-200 text-xs font-bold text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer bg-white"
            >
              Siguiente <ChevronRight size={15} />
            </button>
          </div>
        )}
      </main>

      {/* Preferences Modal */}
      {showPreferences && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-3xl border border-gray-200 shadow-2xl max-w-md w-full p-6 animate-in fade-in duration-200">
            <div className="flex items-center justify-between pb-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-[#f0f9e0] text-[#72B626] flex items-center justify-center">
                  <Sliders size={18} />
                </div>
                <h3 className="text-base font-bold text-gray-900">Preferencias de Notificación</h3>
              </div>
              <button
                onClick={() => setShowPreferences(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg cursor-pointer border-none bg-transparent"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSavePreferences} className="py-4 space-y-4">
              <div className="space-y-3">
                <label className="flex items-center justify-between p-3 rounded-xl bg-gray-50 border border-gray-100 cursor-pointer">
                  <div>
                    <span className="text-xs font-bold text-gray-900 block">Notificaciones en la aplicación</span>
                    <span className="text-[11px] text-gray-500">Recibir alertas en la campana y panel web</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={preferences.inAppEnabled}
                    onChange={(e) => setPreferences({ ...preferences, inAppEnabled: e.target.checked })}
                    className="w-4 h-4 text-[#72B626] rounded focus:ring-0 cursor-pointer"
                  />
                </label>

                <label className="flex items-center justify-between p-3 rounded-xl bg-gray-50 border border-gray-100 cursor-pointer">
                  <div>
                    <span className="text-xs font-bold text-gray-900 block">Notificaciones por correo</span>
                    <span className="text-[11px] text-gray-500">Recibir resúmenes y alertas críticas por email</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={preferences.emailEnabled}
                    onChange={(e) => setPreferences({ ...preferences, emailEnabled: e.target.checked })}
                    className="w-4 h-4 text-[#72B626] rounded focus:ring-0 cursor-pointer"
                  />
                </label>

                <label className="flex items-center justify-between p-3 rounded-xl bg-gray-50 border border-gray-100 cursor-pointer">
                  <div>
                    <span className="text-xs font-bold text-gray-900 block">Estados de Campañas</span>
                    <span className="text-[11px] text-gray-500">Aprobación, revisión, publicación y metas alcanzadas</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={preferences.campaignStatusUpdates}
                    onChange={(e) => setPreferences({ ...preferences, campaignStatusUpdates: e.target.checked })}
                    className="w-4 h-4 text-[#72B626] rounded focus:ring-0 cursor-pointer"
                  />
                </label>

                <label className="flex items-center justify-between p-3 rounded-xl bg-gray-50 border border-gray-100 cursor-pointer">
                  <div>
                    <span className="text-xs font-bold text-gray-900 block">Inversiones y Aportes</span>
                    <span className="text-[11px] text-gray-500">Alertas de pagos recibidos, confirmaciones y reembolsos</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={preferences.investmentAlerts}
                    onChange={(e) => setPreferences({ ...preferences, investmentAlerts: e.target.checked })}
                    className="w-4 h-4 text-[#72B626] rounded focus:ring-0 cursor-pointer"
                  />
                </label>

                <label className="flex items-center justify-between p-3 rounded-xl bg-gray-50 border border-gray-100 cursor-pointer">
                  <div>
                    <span className="text-xs font-bold text-gray-900 block">Mensajes y Comentarios</span>
                    <span className="text-[11px] text-gray-500">Avisos de nuevos chats o consultas en tus proyectos</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={preferences.commentAlerts}
                    onChange={(e) => setPreferences({ ...preferences, commentAlerts: e.target.checked })}
                    className="w-4 h-4 text-[#72B626] rounded focus:ring-0 cursor-pointer"
                  />
                </label>
              </div>

              {prefsSuccess && (
                <div className="p-3 bg-green-50 border border-green-200 text-green-700 text-xs font-bold rounded-xl flex items-center gap-2">
                  <Check size={16} /> Preferencias guardadas correctamente.
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowPreferences(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-100 cursor-pointer border-none bg-transparent"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingPrefs}
                  className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-[#72B626] hover:bg-[#5e9620] cursor-pointer shadow-sm border-none disabled:opacity-50"
                >
                  {savingPrefs ? 'Guardando...' : 'Guardar Cambios'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

