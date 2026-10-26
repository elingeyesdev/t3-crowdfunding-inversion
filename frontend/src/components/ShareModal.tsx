import { useEffect, useRef, useState } from 'react';
import { X, Copy, Check } from 'lucide-react';

const WhatsAppIcon = (props: { size?: number; strokeWidth?: number }) => (
  <svg viewBox="0 0 24 24" width={props.size ?? 18} height={props.size ?? 18} fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
  </svg>
);

const FacebookIcon = (props: { size?: number; strokeWidth?: number }) => (
  <svg viewBox="0 0 24 24" width={props.size ?? 18} height={props.size ?? 18} fill="currentColor">
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
  </svg>
);

const XIcon = (props: { size?: number; strokeWidth?: number }) => (
  <svg viewBox="0 0 24 24" width={props.size ?? 18} height={props.size ?? 18} fill="currentColor">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.748l7.73-8.835L1.254 2.25H8.08l4.258 5.631 5.906-5.631zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
  </svg>
);

const LinkedInIcon = (props: { size?: number; strokeWidth?: number }) => (
  <svg viewBox="0 0 24 24" width={props.size ?? 18} height={props.size ?? 18} fill="currentColor">
    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
  </svg>
);


interface Props {
  campaignId: string;
  campaignTitle: string;
  onClose: () => void;
}

const GREEN = '#72B626';

export function ShareModal({ campaignId, campaignTitle, onClose }: Props) {
  const url = `${window.location.origin}/campaign/${campaignId}`;
  const text = `¡Apoya esta campaña en Unifundme: ${campaignTitle}!`;
  const [copied, setCopied] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback for non-HTTPS or unsupported browsers
      const el = document.createElement('textarea');
      el.value = url;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const shareLinks = [
    {
      id: 'whatsapp',
      label: 'WhatsApp',
      color: '#25D366',
      bg: '#f0fdf4',
      Icon: WhatsAppIcon,
      href: `https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`,
    },
    {
      id: 'facebook',
      label: 'Facebook',
      color: '#1877F2',
      bg: '#eff6ff',
      Icon: FacebookIcon,
      href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
    },
    {
      id: 'twitter',
      label: 'X / Twitter',
      color: '#000000',
      bg: '#f8fafc',
      Icon: XIcon,
      href: `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`,
    },
    {
      id: 'linkedin',
      label: 'LinkedIn',
      color: '#0A66C2',
      bg: '#eff6ff',
      Icon: LinkedInIcon,
      href: `https://www.linkedin.com/shareArticle?mini=true&url=${encodeURIComponent(url)}&title=${encodeURIComponent(campaignTitle)}&summary=${encodeURIComponent(text)}`,
    },
  ];

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[9990] flex items-end sm:items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
    >
      <div
        className="w-full max-w-sm bg-white rounded-[28px] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-slate-100 shrink-0">
          <div>
            <h3 className="text-[16px] font-black text-[#1c2b1e] tracking-tight">Compartir campaña</h3>
            <p className="text-[12px] font-medium text-slate-400 mt-0.5 line-clamp-1">{campaignTitle}</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-colors cursor-pointer border-none shrink-0"
          >
            <X size={16} strokeWidth={2.5} />
          </button>
        </div>

        <div className="overflow-y-auto">
          {/* Social buttons */}
          <div className="px-6 pt-5 pb-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
            {shareLinks.map(({ id, label, color, bg, Icon, href }) => (
              <a
                key={id}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 px-4 py-3 rounded-2xl font-bold text-[13px] transition-all hover:scale-[1.03] active:scale-[0.98] no-underline"
                style={{ backgroundColor: bg, color }}
              >
                <Icon size={18} strokeWidth={2} />
                {label}
              </a>
            ))}
          </div>

          {/* Copy link */}
          <div className="px-6 pb-6 pt-4">
            <p className="text-[11px] font-black uppercase tracking-widest text-slate-400 mb-2 ml-1">O copia el enlace</p>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 bg-slate-50 border-2 border-slate-100 rounded-2xl px-4 py-3">
              <span className="flex-1 text-[12px] font-semibold text-slate-500 truncate text-center sm:text-left">{url}</span>
              <button
                onClick={copyLink}
                className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] font-black uppercase tracking-wider transition-all active:scale-95 cursor-pointer border-none shrink-0"
                style={{
                  backgroundColor: copied ? '#f0fdf4' : GREEN,
                  color: copied ? GREEN : '#fff',
                }}
              >
                {copied ? <Check size={14} strokeWidth={3} /> : <Copy size={14} strokeWidth={2.5} />}
                {copied ? '¡Copiado!' : 'Copiar'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
