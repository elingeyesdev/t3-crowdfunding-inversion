import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Navbar } from '../components/Navbar';
import { ConversationsSidebar } from '../components/chat/ConversationsSidebar';
import { ChatWindow } from '../components/chat/ChatWindow';
import { useChat } from '../hooks/useChat';
import {
  getMyConversations,
  markAsRead,
  type Conversation,
  type Message,
} from '../api/chat.api';
import { MessageCircle } from 'lucide-react';

export function ChatPage() {
  const navigate = useNavigate();
  const { conversationId } = useParams<{ conversationId?: string }>();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loadingConvs, setLoadingConvs] = useState(true);
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  const [search, setSearch] = useState('');
  const [showSidebar, setShowSidebar] = useState(true);

  // Último mensaje recibido por WebSocket para pasarlo al ChatWindow
  const [lastIncoming, setLastIncoming] = useState<Message | null>(null);

  const currentUserId = localStorage.getItem('userId') ?? '';

  // ── Cargar conversaciones via REST ────────────────────────
  const loadConversations = useCallback(async () => {
    try {
      const convs = await getMyConversations();
      setConversations(convs);
    } catch (err) {
      console.error('Error cargando conversaciones:', err);
    } finally {
      setLoadingConvs(false);
    }
  }, []);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // Synchronize URL conversationId with activeConversation state
  useEffect(() => {
    if (loadingConvs) return;

    if (conversationId) {
      const found = conversations.find((c) => c.id === conversationId);
      if (found) {
        if (activeConversation?.id !== found.id) {
          setActiveConversation(found);
          setLastIncoming(null);
          setShowSidebar(false);
          // Mark as read locally in sidebar list
          setConversations((prev) =>
            prev.map((c) => (c.id === found.id ? { ...c, unreadCount: 0 } : c))
          );
        }
      } else {
        // If the ID in URL is invalid or not in the user's conversation list, fallback to /chat
        setActiveConversation(null);
      }
    } else {
      // No conversationId in URL, clear active conversation and show sidebar
      if (activeConversation) {
        setActiveConversation(null);
        setShowSidebar(true);
      }
    }
  }, [conversationId, conversations, loadingConvs, activeConversation]);

  // ── Callback para nuevo mensaje recibido por WS ───────────
  const handleNewMessage = useCallback((msg: Message) => {
    setLastIncoming(msg);

    // Actualizar la conversación en el sidebar
    setConversations((prev) =>
      prev.map((c) => {
        if (c.id !== msg.conversationId) return c;
        const isActive = msg.conversationId === activeConversation?.id;
        return {
          ...c,
          lastMessage: {
            content: msg.content,
            createdAt: msg.createdAt,
            senderId: msg.senderId,
          },
          lastMessageAt: msg.createdAt,
          unreadCount: isActive ? 0 : c.unreadCount + 1,
        };
      }),
    );
  }, [activeConversation?.id]);

  // ── Callback para actualización de conversación ───────────
  const handleConversationUpdated = useCallback(
    (data: { conversationId: string; lastMessage: Message }) => {
      setConversations((prev) =>
        prev
          .map((c) => {
            if (c.id !== data.conversationId) return c;
            const isActive = data.conversationId === activeConversation?.id;
            return {
              ...c,
              lastMessage: {
                content: data.lastMessage.content,
                createdAt: data.lastMessage.createdAt,
                senderId: data.lastMessage.senderId,
              },
              lastMessageAt: data.lastMessage.createdAt,
              unreadCount: isActive ? 0 : c.unreadCount + (data.lastMessage.senderId !== currentUserId ? 1 : 0),
            };
          })
          .sort(
            (a, b) =>
              new Date(b.lastMessageAt ?? 0).getTime() -
              new Date(a.lastMessageAt ?? 0).getTime(),
          ),
      );
    },
    [activeConversation?.id, currentUserId],
  );

  // ── WebSocket hook ────────────────────────────────────────
  const { connected, typingUsers, sendMessage, emitTyping, emitMarkAsRead } = useChat({
    conversationId: activeConversation?.id ?? null,
    onNewMessage: handleNewMessage,
    onConversationUpdated: handleConversationUpdated,
  });

  // ── Seleccionar conversación ──────────────────────────────
  const handleSelectConversation = useCallback(
    (conv: Conversation) => {
      navigate(`/chat/${conv.id}`);
    },
    [navigate],
  );

  const handleBack = useCallback(() => {
    navigate('/chat');
    loadConversations(); // Refresca para sincronizar unread
  }, [navigate, loadConversations]);

  const handleMarkAsRead = useCallback(
    async (convId: string) => {
      await markAsRead(convId).catch(() => { });
      setConversations((prev) =>
        prev.map((c) => (c.id === convId ? { ...c, unreadCount: 0 } : c)),
      );
    },
    [],
  );

  return (
    <div className="flex flex-col h-screen bg-white font-['Plus Jakarta Sans',sans-serif] overflow-hidden">
      <Navbar />

      {/* Contenido principal - Fluido de pantalla completa */}
      <div className="flex-1 flex overflow-hidden w-full bg-[#f8f9fa]">
        {/* Sidebar — visible siempre en md+, toggle en móvil */}
        <div
          className={`${
            showSidebar ? 'flex' : 'hidden'
          } md:flex border-r border-gray-200 h-full w-full md:w-[350px] md:min-w-[350px]`}
        >
          <ConversationsSidebar
            conversations={conversations}
            activeId={activeConversation?.id ?? null}
            onSelect={handleSelectConversation}
            loading={loadingConvs}
            connected={connected}
            search={search}
            onSearchChange={setSearch}
            currentUserId={currentUserId}
          />
        </div>

        {/* Chat window */}
        <div
          className={`${
            !showSidebar || activeConversation ? 'flex' : 'hidden'
          } md:flex flex-1 flex-col h-full overflow-hidden`}
        >
          {activeConversation ? (
            <ChatWindow
              conversation={activeConversation}
              currentUserId={currentUserId}
              typingUsers={typingUsers}
              onBack={handleBack}
              onSend={sendMessage}
              onTyping={emitTyping}
              onMarkAsRead={handleMarkAsRead}
              newIncomingMessage={lastIncoming}
            />
          ) : (
            /* Pantalla vacía cuando no hay conversación seleccionada */
            <div className="flex-1 flex flex-col items-center justify-center gap-5 bg-gray-50">
              <div className="w-20 h-20 rounded-2xl bg-white flex items-center justify-center text-green-500 shadow-sm border border-gray-100">
                <MessageCircle size={36} strokeWidth={1.5} />
              </div>
              <div className="text-center">
                <p className="text-[16px] font-bold text-gray-700 tracking-tight">
                  Selecciona una conversación
                </p>
                <p className="text-[13px] text-gray-400 font-medium mt-1">
                  Elige un chat de la lista para comenzar
                </p>
              </div>
              <div className="bg-green-50 border border-green-100 text-emerald-700 text-[12px] font-medium px-5 py-2 rounded-lg">
                Puedes iniciar un chat desde el detalle de cualquier campaña
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
