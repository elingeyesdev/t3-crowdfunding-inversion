import { useEffect, useRef, useState, useCallback } from 'react';
import Echo from 'laravel-echo';
import Pusher from 'pusher-js';
import { sendChatMessage, markAsRead, type Message } from '../api/chat.api';

interface UseChatOptions {
  conversationId: string | null;
  onNewMessage?: (msg: Message) => void;
  onConversationUpdated?: (data: { conversationId: string; lastMessage: Message }) => void;
}

export function useChat(options: UseChatOptions) {
  const { conversationId } = options;
  const callbacks = useRef(options);
  const echoRef = useRef<Echo<'reverb'> | null>(null);
  const [connected, setConnected] = useState(false);
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
  const seen = useRef(new Set<string>());
  const typingTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  useEffect(() => { callbacks.current = options; }, [options]);

  const receive = useCallback((message: Message) => {
    if (seen.current.has(message.id)) return;
    seen.current.add(message.id);
    if (seen.current.size > 2000) seen.current.delete(seen.current.values().next().value!);
    if (message.conversationId === callbacks.current.conversationId) callbacks.current.onNewMessage?.(message);
    callbacks.current.onConversationUpdated?.({ conversationId: message.conversationId, lastMessage: message });
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    const userId = localStorage.getItem('userId');
    if (!token || !userId || !import.meta.env.VITE_REVERB_APP_KEY) return;
    const echo = new Echo<'reverb'>({
      broadcaster: 'reverb', client: new Pusher(import.meta.env.VITE_REVERB_APP_KEY, {
        cluster: '',
        wsHost: import.meta.env.VITE_REVERB_HOST || window.location.hostname,
        wsPort: Number(import.meta.env.VITE_REVERB_PORT || 8080),
        wssPort: Number(import.meta.env.VITE_REVERB_PORT || 443),
        forceTLS: import.meta.env.VITE_REVERB_SCHEME === 'https',
        enabledTransports: ['ws', 'wss'],
        channelAuthorization: { endpoint: '/api/v1/broadcasting/auth', transport: 'ajax', headers: { Authorization: `Bearer ${token}` } },
      }),
    });
    echoRef.current = echo;
    const connection = echo.connector.pusher.connection;
    connection.bind('connected', () => setConnected(true));
    connection.bind('disconnected', () => setConnected(false));
    connection.bind('unavailable', () => setConnected(false));
    echo.private(`users.${userId}`).listen('.chat.message', (event: { message: Message }) => receive(event.message));
    return () => { echo.disconnect(); echoRef.current = null; };
  }, [receive]);

  useEffect(() => {
    if (!conversationId || !echoRef.current) return;
    const timers = typingTimers.current;
    const channel = echoRef.current.private(`conversations.${conversationId}`);
    channel.listenForWhisper('typing', ({ userId }: { userId: string }) => {
      if (userId === localStorage.getItem('userId')) return;
      setTypingUsers(previous => new Set(previous).add(userId));
      const previous = timers.get(userId);
      if (previous) clearTimeout(previous);
      timers.set(userId, setTimeout(() => {
        setTypingUsers(previous => { const next = new Set(previous); next.delete(userId); return next; });
        timers.delete(userId);
      }, 3000));
    });
    return () => {
      echoRef.current?.leave(`conversations.${conversationId}`);
      timers.forEach(clearTimeout); timers.clear(); setTypingUsers(new Set());
    };
  }, [conversationId]);

  const sendMessage = useCallback(async (id: string, content: string) => { receive(await sendChatMessage(id, content)); }, [receive]);
  const emitTyping = useCallback((id: string) => { echoRef.current?.private(`conversations.${id}`).whisper('typing', { userId: localStorage.getItem('userId') }); }, []);
  const emitMarkAsRead = useCallback((id: string) => { void markAsRead(id).catch(() => {}); }, []);
  return { connected, typingUsers, sendMessage, emitTyping, emitMarkAsRead };
}
