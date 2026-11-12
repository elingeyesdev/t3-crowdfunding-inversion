import { Search, MessageCircle, Wifi, WifiOff } from 'lucide-react';
import type { Conversation } from '../../api/chat.api';
import { getImageUrl } from '../../utils/image.utils';

interface ConversationsSidebarProps {
  conversations: Conversation[];
  activeId: string | null;
  onSelect: (conv: Conversation) => void;
  loading: boolean;
  connected: boolean;
  search: string;
  onSearchChange: (v: string) => void;
  currentUserId: string;
}

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'ahora';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `${days}d`;
}

function AvatarFallback({ name, className }: { name: string; className?: string }) {
  const initials = name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0] ?? '')
    .join('')
    .toUpperCase();
  return (
    <div
      className={`rounded-full bg-gradient-to-br from-green-500 to-emerald-700 flex items-center justify-center text-white font-bold select-none ${className}`}
    >
      {initials || '?'}
    </div>
  );
}

export function ConversationAvatar({ name, url, className }: { name: string; url: string | null; className?: string }) {
  const [error, setError] = useState(false);
  if (!url || error) {
    return <AvatarFallback name={name} className={className} />;
  }
  return (
    <img
      src={url}
      alt=""
      onError={() => setError(true)}
      className={`${className} rounded-full object-cover`}
    />
  );
}

import { useState } from 'react';

export function ConversationsSidebar({
  conversations,
  activeId,
  onSelect,
  loading,
  connected,
  search,
  onSearchChange,
  currentUserId,
}: ConversationsSidebarProps) {
  const filtered = conversations.filter((c) =>
    c.otherUser.fullName.toLowerCase().includes(search.toLowerCase()) ||
    (c.campaignTitle ?? '').toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <aside className="w-full h-full flex flex-col bg-white">
      {/* Header */}
      <div className="p-5 border-b border-slate-100">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <MessageCircle size={20} className="text-emerald-600" strokeWidth={2.5} />
            <h2 className="text-[17px] font-black text-slate-800 tracking-tight">Mensajes</h2>
          </div>
          {connected ? (
            <span className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-600 bg-green-50 px-2.5 py-1 rounded-full">
              <Wifi size={12} />
              En línea
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400 bg-slate-100 px-2.5 py-1 rounded-full">
              <WifiOff size={12} />
              Desconectado
            </span>
          )}
        </div>

        {/* Búsqueda */}
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Buscar conversación..."
            className="w-full bg-gray-50 rounded-lg pl-8 pr-4 py-2 text-[13px] font-medium text-gray-700 outline-none border border-gray-200 focus:bg-white focus:border-indigo-500 transition-colors placeholder:text-gray-400"
          />
        </div>
      </div>

      {/* Lista */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex flex-col gap-3 p-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-2xl animate-pulse">
                <div className="w-12 h-12 rounded-full bg-slate-100 shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 bg-slate-100 rounded-full w-3/4" />
                  <div className="h-2.5 bg-slate-100 rounded-full w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full py-16 px-6 text-center">
            <div className="w-16 h-16 rounded-3xl bg-slate-50 flex items-center justify-center text-slate-300 mb-4">
              <MessageCircle size={32} />
            </div>
            <p className="text-[13px] font-bold text-slate-400">
              {search ? 'Sin resultados' : 'No tienes conversaciones aún'}
            </p>
            {!search && (
              <p className="text-[12px] text-slate-300 mt-1">
                Inicia un chat desde el detalle de una campaña
              </p>
            )}
          </div>
        ) : (
          <ul className="p-2 space-y-1">
            {filtered.map((conv) => {
              const isActive = conv.id === activeId;
              const hasUnread = conv.unreadCount > 0;
              const isMyLastMsg =
                conv.lastMessage?.senderId === currentUserId;
              const avatarUrl = getImageUrl(conv.otherUser.avatar);

              return (
                <li key={conv.id}>
                  <button
                    onClick={() => onSelect(conv)}
                    className={`w-full flex items-center gap-3 p-3 rounded-lg transition-all text-left cursor-pointer border-none
                      ${isActive
                        ? 'bg-gray-100'
                        : 'hover:bg-gray-50'
                      }`}
                  >
                    {/* Avatar */}
                    <div className="relative shrink-0">
                      <ConversationAvatar
                        name={conv.otherUser.fullName}
                        url={avatarUrl}
                        className="w-11 h-11"
                      />
                      {hasUnread && (
                        <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-green-500 text-white text-[10px] font-black rounded-full flex items-center justify-center px-1">
                          {conv.unreadCount > 9 ? '9+' : conv.unreadCount}
                        </span>
                      )}
                    </div>

                    {/* Contenido */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <p
                          className={`text-[13px] truncate leading-snug ${
                            hasUnread ? 'font-black text-slate-800' : 'font-bold text-slate-700'
                          }`}
                        >
                          {conv.otherUser.fullName}
                        </p>
                        <span className="text-[11px] text-slate-400 font-medium shrink-0 ml-2">
                          {timeAgo(conv.lastMessageAt)}
                        </span>
                      </div>

                      {conv.campaignTitle && (
                        <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wide truncate mb-0.5">
                          {conv.campaignTitle}
                        </p>
                      )}

                      <p
                        className={`text-[12px] truncate leading-snug ${
                          hasUnread ? 'font-semibold text-slate-600' : 'text-slate-400 font-medium'
                        }`}
                      >
                        {conv.lastMessage
                          ? `${isMyLastMsg ? 'Tú: ' : ''}${conv.lastMessage.content}`
                          : 'Inicia la conversación...'}
                      </p>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </aside>
  );
}
