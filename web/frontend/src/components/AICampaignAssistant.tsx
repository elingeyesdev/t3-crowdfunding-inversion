import { useState, useRef, useEffect } from 'react';
import {
  Sparkles, X, Send, ChevronDown, Loader2,
  Lightbulb, BarChart2, Gift, Megaphone, Video, Target,
} from 'lucide-react';
import { aiCampaignChat, type ChatMessage, type CampaignContext } from '../api/ai-campaign.api';

interface Props {
  campaignContext?: CampaignContext;
}

const GREEN = '#72B626';

const QUICK_PROMPTS = [
  { icon: <Lightbulb size={13} />, label: 'Crear campaña desde cero',   text: 'Quiero crear una nueva campaña desde cero. Guíame paso a paso: qué información necesito, qué tipo elegir y cómo estructurar mi propuesta de valor.' },
  { icon: <BarChart2  size={13} />, label: 'Analizar mi campaña',        text: 'Analiza mi campaña actual y dime qué está funcionando bien, qué debo mejorar y cómo puedo aumentar mis conversiones.' },
  { icon: <Target     size={13} />, label: 'Definir meta de financiamiento', text: 'Ayúdame a calcular y justificar una meta de financiamiento realista para mi campaña. ¿Qué factores debo considerar?' },
  { icon: <Gift       size={13} />, label: 'Diseñar niveles de recompensa', text: 'Necesito diseñar niveles de recompensa atractivos y bien valorados para mi campaña. Dame sugerencias de tiers con precios y beneficios.' },
  { icon: <Megaphone  size={13} />, label: 'Estrategia de marketing',    text: 'Dame una estrategia de marketing concreta para lanzar y difundir mi campaña en redes sociales bolivianas (Facebook, WhatsApp, Instagram, TikTok).' },
  { icon: <Video      size={13} />, label: 'Script para DonaTok',        text: 'Escríbeme un script para un video DonaTok de 60 segundos que presente mi campaña de forma viral y convincente.' },
];

function renderMarkdown(text: string) {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/^### (.+)$/gm, '<h4 class="font-black text-[#1c2b1e] text-[13px] mt-3 mb-1">$1</h4>')
    .replace(/^## (.+)$/gm,  '<h3 class="font-black text-[#1c2b1e] text-[14px] mt-4 mb-1">$1</h3>')
    .replace(/^- (.+)$/gm,   '<li class="ml-4 list-disc">$1</li>')
    .replace(/\n\n/g, '<br/><br/>')
    .replace(/\n/g, '<br/>');
}

export function AICampaignAssistant({ campaignContext }: Props) {
  const [open,      setOpen]     = useState(false);
  const [messages,  setMessages] = useState<ChatMessage[]>([]);
  const [input,     setInput]    = useState('');
  const [loading,   setLoading]  = useState(false);
  const [showQuick, setShowQuick] = useState(true);
  const prevContextTitle = useRef<string | undefined>(undefined);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Cuando cambia la campaña seleccionada, abrir y resetear el chat
  useEffect(() => {
    if (campaignContext?.title && campaignContext.title !== prevContextTitle.current) {
      prevContextTitle.current = campaignContext.title;
      setMessages([]);
      setShowQuick(true);
      setOpen(true);
    }
  }, [campaignContext?.title]);

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, open]);

  const send = async (text: string) => {
    if (!text.trim() || loading) return;
    const userMsg: ChatMessage = { role: 'user', content: text.trim() };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput('');
    setShowQuick(false);
    setLoading(true);
    try {
      const reply = await aiCampaignChat(next, campaignContext);
      setMessages(prev => [...prev, { role: 'assistant', content: reply }]);
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Hubo un error al conectar con el asistente. Verifica tu conexión e intenta de nuevo.' }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input); }
  };

  const reset = () => { setMessages([]); setShowQuick(true); setInput(''); };

  return (
    <>
      {/* ── Floating trigger ── */}
      <button
        onClick={() => setOpen(v => !v)}
        className="fixed bottom-6 left-6 z-40 w-14 h-14 rounded-2xl flex items-center justify-center text-white shadow-lg transition-all hover:scale-110 active:scale-95 border-none cursor-pointer"
        style={{ background: GREEN }}
        title="Asistente IA para campañas"
      >
        {open
          ? <ChevronDown size={22} strokeWidth={2.5} />
          : <Sparkles   size={22} strokeWidth={2.5} />}
      </button>

      {/* ── Panel ── */}
      {open && (
        <div className="fixed bottom-24 left-6 z-40 w-[370px] max-w-[calc(100vw-48px)] flex flex-col rounded-2xl overflow-hidden shadow-lg border border-gray-100 animate-in slide-in-from-bottom-4 duration-300"
          style={{ maxHeight: '78vh', background: '#fff' }}>

          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 shrink-0 bg-gray-900">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-white/10">
                <Sparkles size={18} className="text-[#a8d97c]" strokeWidth={2.5} />
              </div>
              <div>
                <p className="text-white font-black text-[14px] leading-none">CampaignAI</p>
                <p className="text-white/50 text-[11px] font-medium mt-0.5">Asistente para emprendedores</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {messages.length > 0 && (
                <button onClick={reset}
                  className="text-[11px] font-bold text-white/50 hover:text-white/80 transition-colors bg-transparent border-none cursor-pointer px-2 py-1 rounded-lg hover:bg-white/10">
                  Nueva consulta
                </button>
              )}
              <button onClick={() => setOpen(false)}
                className="w-7 h-7 rounded-lg flex items-center justify-center bg-white/10 hover:bg-white/20 transition-colors cursor-pointer border-none text-white">
                <X size={14} strokeWidth={2.5} />
              </button>
            </div>
          </div>

          {/* Campaign context badge */}
          {campaignContext?.title && (
            <div className="mx-4 mt-3 px-3 py-2 rounded-xl flex items-center gap-2 shrink-0 bg-gray-50 border border-gray-200">
              <BarChart2 size={13} className="text-[#72B626] shrink-0" strokeWidth={2.5} />
              <p className="text-[11px] font-bold text-gray-700 truncate">
                Contexto: <span className="font-black">{campaignContext.title}</span>
                {campaignContext.goalAmount && ` · Bs. ${campaignContext.goalAmount.toLocaleString('es-BO')}`}
              </p>
            </div>
          )}

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3 min-h-0" style={{ scrollbarWidth: 'thin' }}>

            {/* Welcome + quick prompts */}
            {showQuick && messages.length === 0 && (
              <div className="flex flex-col gap-3">
                <div className="bg-[#f7f9f7] rounded-2xl p-4">
                  <p className="text-[13px] font-bold text-[#1c2b1e] leading-relaxed mb-1">
                    ¡Hola, emprendedor! 👋
                  </p>
                  <p className="text-[12px] text-slate-500 font-medium leading-relaxed">
                    Soy tu asistente especializado en crowdfunding. Puedo ayudarte a crear campañas exitosas, analizar tu rendimiento y diseñar estrategias de marketing.
                  </p>
                </div>
                <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest px-1">Acciones rápidas</p>
                <div className="grid grid-cols-2 gap-2">
                  {QUICK_PROMPTS.map((q, i) => (
                    <button key={i} onClick={() => send(q.text)}
                      className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-left transition-all hover:shadow-sm active:scale-[0.98] cursor-pointer border-none"
                      style={{ background: '#f5fce8', color: '#4a7f1a' }}>
                      <span className="shrink-0 text-[#72B626]">{q.icon}</span>
                      <span className="text-[11px] font-black leading-tight">{q.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Chat bubbles */}
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.role === 'assistant' && (
                  <div className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0 mr-2 mt-0.5 bg-gray-900">
                    <Sparkles size={13} className="text-white" strokeWidth={2.5} />
                  </div>
                )}
                <div
                  className={`max-w-[85%] px-4 py-3 rounded-2xl text-[13px] leading-relaxed font-medium ${
                    msg.role === 'user'
                      ? 'text-white rounded-br-sm bg-gray-900'
                      : 'text-[#1c2b1e] rounded-bl-sm border border-gray-100 bg-[#f7f9f7]'
                  }`}
                  dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }}
                />
              </div>
            ))}

            {/* Loading */}
            {loading && (
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0 bg-gray-900">
                  <Sparkles size={13} className="text-white" strokeWidth={2.5} />
                </div>
                <div className="bg-[#f7f9f7] border border-gray-100 px-4 py-3 rounded-2xl rounded-bl-sm flex items-center gap-2">
                  <Loader2 size={13} className="text-[#72B626] animate-spin" strokeWidth={2.5} />
                  <span className="text-[12px] text-slate-400 font-medium">Analizando...</span>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="px-4 pb-4 pt-2 shrink-0 border-t border-gray-100">
            <div className="flex items-end gap-2 bg-[#f7f9f7] rounded-2xl border border-gray-200 focus-within:border-[#72B626] focus-within:ring-2 focus-within:ring-[#72B626]/10 transition-all px-4 py-3">
              <textarea
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKey}
                placeholder="Pregunta sobre tu campaña…"
                rows={1}
                className="flex-1 bg-transparent text-[13px] font-medium text-[#1c2b1e] placeholder:text-slate-400 outline-none resize-none leading-relaxed"
                style={{ maxHeight: '80px' }}
              />
              <button
                onClick={() => send(input)}
                disabled={!input.trim() || loading}
                className="w-8 h-8 rounded-xl flex items-center justify-center text-white transition-all active:scale-95 disabled:opacity-40 border-none cursor-pointer shrink-0"
                style={{ background: GREEN }}
              >
                <Send size={14} strokeWidth={2.5} />
              </button>
            </div>
            <p className="text-[10px] text-slate-400 font-medium text-center mt-2">
              Impulsado por DeepSeek AI · Unifundme
            </p>
          </div>
        </div>
      )}
    </>
  );
}
