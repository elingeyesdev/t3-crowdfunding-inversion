import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Bell, BellRing, Check, CheckCheck, ExternalLink, Loader2,
  TrendingUp, MessageCircle, CheckCircle2, XCircle, Rocket, Star, Info
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  getMyNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  type AppNotification,
} from '../api/notifications.api';

const POLL_INTERVAL_MS = 15_000; // 15 segundos

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

/* ── Ícono + color según tipo de notificación ── */
function NotifIcon({ typeCode }: { typeCode?: string }) {
  const base = 'w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0';

  if (!typeCode) return (
    <div className={`${base} bg-slate-100`}><Info size={16} className="text-slate-500" /></div>
  );

  if (typeCode === 'investment_received' || typeCode === 'investment_confirmed') return (
    <div className={`${base} bg-[#f0f9e0]`}><TrendingUp size={16} className="text-[#72B626]" /></div>
  );
  if (typeCode === 'new_message') return (
    <div className={`${base} bg-blue-100`}><MessageCircle size={16} className="text-blue-600" /></div>
  );
  if (typeCode === 'campaign_approved') return (
    <div className={`${base} bg-green-100`}><CheckCircle2 size={16} className="text-green-600" /></div>
  );
  if (typeCode === 'campaign_rejected') return (
    <div className={`${base} bg-red-100`}><XCircle size={16} className="text-red-500" /></div>
  );
  if (typeCode === 'campaign_funded') return (
    <div className={`${base} bg-amber-100`}><Star size={16} className="text-amber-500" /></div>
  );
  if (typeCode?.startsWith('campaign_')) return (
    <div className={`${base} bg-indigo-100`}><Rocket size={16} className="text-indigo-500" /></div>
  );
  return (
    <div className={`${base} bg-slate-100`}><Info size={16} className="text-slate-500" /></div>
  );
}

export function NotificationBell() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const prevUnreadRef = useRef(0);
  const [shake, setShake] = useState(false);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await getMyNotifications();
      setNotifications(res.notifications);
      // Animar la campana si llegaron notificaciones nuevas
      if (res.unreadCount > prevUnreadRef.current) {
        setShake(true);
        setTimeout(() => setShake(false), 800);
      }
      prevUnreadRef.current = res.unreadCount;
      setUnreadCount(res.unreadCount);
    } catch {
      // silently fail — user may not be logged in yet
    }
  }, []);

  // Initial fetch + polling
  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  async function handleMarkOne(notif: AppNotification) {
    if (!notif.isRead) {
      await markNotificationAsRead(notif.id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === notif.id ? { ...n, isRead: true } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    }
    if (notif.actionUrl) {
      setOpen(false);
      navigate(notif.actionUrl);
    }
  }

  async function handleMarkAll() {
    setLoading(true);
    try {
      await markAllNotificationsAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } finally {
      setLoading(false);
    }
  }

  const hasUnread = unreadCount > 0;

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        id="notification-bell-btn"
        onClick={() => setOpen((v) => !v)}
        className="relative flex items-center justify-center w-10 h-10 rounded-xl border border-slate-200 bg-white hover:bg-[#f0f9e0] hover:border-gray-100 transition-all duration-200 active:scale-95 cursor-pointer"
        aria-label="Notificaciones"
        style={{ animation: shake ? 'bellShake 0.6s ease' : undefined }}
      >
        {hasUnread
          ? <BellRing size={18} className="text-[#72B626]" strokeWidth={2.5} />
          : <Bell size={18} className="text-slate-500" strokeWidth={2.5} />
        }
        {hasUnread && (
          <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] flex items-center justify-center bg-red-500 text-white text-[10px] font-black rounded-full px-1 shadow-sm border-2 border-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div
          className="fixed sm:absolute top-[72px] sm:top-[calc(100%+8px)] left-4 right-4 sm:left-auto sm:right-0 sm:w-[380px] max-h-[70vh] sm:max-h-[500px] flex flex-col bg-white rounded-2xl border border-slate-200 shadow-2xl z-50 overflow-hidden"
          style={{ animation: 'slideDownFade 0.18s ease-out' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50/60">
            <div className="flex items-center gap-2">
              <Bell size={15} className="text-[#72B626]" strokeWidth={2.5} />
              <span className="text-[14px] font-black text-slate-800">Notificaciones</span>
              {hasUnread && (
                <span className="bg-[#f0f9e0] text-[#4a7f1a] text-[10px] font-black px-2 py-0.5 rounded-full">
                  {unreadCount} nuevas
                </span>
              )}
            </div>
            {hasUnread && (
              <button
                onClick={handleMarkAll}
                disabled={loading}
                className="flex items-center gap-1.5 text-[12px] font-bold text-[#72B626] hover:text-[#1c2b1e] transition-colors cursor-pointer disabled:opacity-50"
              >
                {loading
                  ? <Loader2 size={12} className="animate-spin" />
                  : <CheckCheck size={13} strokeWidth={2.5} />
                }
                Marcar todas
              </button>
            )}
          </div>

          {/* List */}
          <div className="overflow-y-auto flex-1">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-14 gap-3 text-slate-400">
                <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center">
                  <Bell size={22} strokeWidth={1.5} />
                </div>
                <span className="text-[13px] font-semibold">Sin notificaciones</span>
                <span className="text-[11px] text-slate-300">Cuando recibas actividad aparecerá aquí</span>
              </div>
            ) : (
              notifications.map((notif) => (
                <button
                  key={notif.id}
                  onClick={() => handleMarkOne(notif)}
                  className={`w-full text-left px-4 py-3 flex items-start gap-3 border-b border-slate-50 last:border-0 transition-colors cursor-pointer group ${
                    notif.isRead
                      ? 'bg-white hover:bg-slate-50'
                      : 'bg-[#f0f9e0]/50 hover:bg-[#f0f9e0]'
                  }`}
                >
                  {/* Ícono por tipo */}
                  <NotifIcon typeCode={notif.typeCode ?? undefined} />

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className={`text-[13px] leading-snug ${notif.isRead ? 'font-medium text-slate-600' : 'font-bold text-slate-800'}`}>
                        {notif.title}
                      </p>
                      {/* Dot no leído */}
                      {!notif.isRead && (
                        <div className="w-2 h-2 rounded-full bg-[#72B626] flex-shrink-0 mt-1" />
                      )}
                    </div>
                    <p className="text-[12px] text-slate-500 leading-relaxed line-clamp-2 mt-0.5">
                      {notif.body}
                    </p>
                    <p className="text-[11px] text-slate-400 mt-1 font-medium">
                      {timeAgo(notif.createdAt)}
                    </p>
                  </div>

                  {/* Action icon */}
                  {notif.actionUrl && (
                    <ExternalLink size={13} className="flex-shrink-0 text-slate-300 group-hover:text-[#72B626] transition-colors mt-1" strokeWidth={2.5} />
                  )}
                  {notif.isRead && !notif.actionUrl && (
                    <Check size={13} className="flex-shrink-0 text-slate-300 mt-1" strokeWidth={2.5} />
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}

      <style>{`
        @keyframes slideDownFade {
          from { opacity: 0; transform: translateY(-6px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes bellShake {
          0%, 100% { transform: rotate(0deg); }
          15%  { transform: rotate(15deg); }
          30%  { transform: rotate(-12deg); }
          45%  { transform: rotate(10deg); }
          60%  { transform: rotate(-8deg); }
          75%  { transform: rotate(5deg); }
        }
      `}</style>
    </div>
  );
}
