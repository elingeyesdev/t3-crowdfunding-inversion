import { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, Bot, User, Loader2 } from 'lucide-react';
import axios from 'axios';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const WELCOME_MSG: Message = {
  role: 'assistant',
  content: '¡Hola! Soy el asistente de Unifundme 👋 ¿En qué puedo ayudarte hoy? Puedo responder preguntas sobre campañas, DonaTok, donaciones y más.',
};

export function AISupportChat() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([WELCOME_MSG]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [open]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: Message = { role: 'user', content: text };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput('');
    setLoading(true);

    try {
      const { data } = await axios.post<{ reply: string }>(
        '/api/v1/ai-support/chat',
        { messages: next }
      );
      setMessages(prev => [...prev, { role: 'assistant', content: data.reply }]);
    } catch {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Lo siento, ocurrió un error. Por favor intenta de nuevo más tarde.',
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
      {/* Chat window */}
      {open && (
        <div
          className="w-[360px] max-w-[calc(100vw-48px)] rounded-2xl shadow-lg overflow-hidden flex flex-col"
          style={{
            background: 'white',
            border: '1px solid rgba(114,182,38,0.15)',
            boxShadow: '0 8px 30px rgba(0,0,0,0.1)',
            height: '500px',
            maxHeight: 'calc(100vh - 120px)',
          }}
        >
          {/* Header */}
          <div
            className="px-5 py-4 flex items-center justify-between flex-shrink-0"
            style={{ background: '#1c2b1e' }}
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center">
                <Bot size={18} className="text-white" strokeWidth={2.5} />
              </div>
              <div>
                <p className="text-white text-[13px] font-black leading-tight">Asistente IA</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#d4f0a0] animate-pulse" />
                  <p className="text-white/70 text-[10px] font-semibold">En línea</p>
                </div>
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors cursor-pointer border-none"
            >
              <X size={15} className="text-white" strokeWidth={2.5} />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4" style={{ scrollbarWidth: 'thin' }}>
            {messages.map((msg, i) => (
              <div key={i} className={`flex gap-2.5 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                {/* Avatar */}
                <div
                  className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center mt-0.5"
                  style={{
                    background: msg.role === 'assistant'
                      ? '#1c2b1e'
                      : '#e0e7ff',
                  }}
                >
                  {msg.role === 'assistant'
                    ? <Bot size={13} className="text-white" strokeWidth={2.5} />
                    : <User size={13} className="text-indigo-600" strokeWidth={2.5} />
                  }
                </div>

                {/* Bubble */}
                <div
                  className="max-w-[75%] px-4 py-2.5 rounded-[18px] text-[13px] leading-relaxed"
                  style={msg.role === 'assistant' ? {
                    background: '#f4f7f4',
                    color: '#1c2b1e',
                    borderBottomLeftRadius: 4,
                  } : {
                    background: '#72B626',
                    color: 'white',
                    borderBottomRightRadius: 4,
                  }}
                >
                  {msg.content}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex gap-2.5">
                <div
                  className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center"
                  style={{ background: '#1c2b1e' }}
                >
                  <Bot size={13} className="text-white" strokeWidth={2.5} />
                </div>
                <div className="bg-[#f4f7f4] px-4 py-3 rounded-[18px] rounded-bl-[4px] flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="px-4 pb-4 pt-2 flex-shrink-0 border-t border-slate-100">
            <div className="flex items-center gap-2 bg-[#f4f7f4] rounded-2xl px-4 py-2.5">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKey}
                placeholder="Escribe tu pregunta..."
                disabled={loading}
                className="flex-1 bg-transparent text-[13px] font-medium text-[#1c2b1e] placeholder:text-slate-400 outline-none border-none"
              />
              <button
                onClick={sendMessage}
                disabled={!input.trim() || loading}
                className="w-8 h-8 rounded-xl flex items-center justify-center transition-all active:scale-90 border-none cursor-pointer flex-shrink-0"
                style={{
                  background: input.trim() && !loading
                    ? '#72B626'
                    : '#e5e7eb',
                }}
              >
                {loading
                  ? <Loader2 size={14} className="text-slate-400 animate-spin" strokeWidth={2.5} />
                  : <Send size={14} className={input.trim() ? 'text-white' : 'text-slate-400'} strokeWidth={2.5} />
                }
              </button>
            </div>
            <p className="text-[10px] text-slate-300 text-center mt-2 font-medium">
              Impulsado por DeepSeek AI · Unifundme
            </p>
          </div>
        </div>
      )}

      {/* Toggle button */}
      <button
        onClick={() => setOpen(v => !v)}
        className="w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-all hover:scale-105 active:scale-95 border-none cursor-pointer relative"
        style={{ background: '#72B626' }}
        title="Soporte IA"
      >
        {open
          ? <X size={22} className="text-white" strokeWidth={2.5} />
          : <MessageCircle size={22} className="text-white" strokeWidth={2.5} />
        }
        {!open && (
          <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#d4f0a0] border-2 border-white animate-pulse" />
        )}
      </button>
    </div>
  );
}
