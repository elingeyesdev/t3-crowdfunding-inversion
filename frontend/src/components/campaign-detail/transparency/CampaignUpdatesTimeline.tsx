import {
  MessageSquare,
  Calendar,
  User,
  Sparkles,
  Image as ImageIcon,
  ExternalLink,
  Clock,
} from 'lucide-react';
import type { PublicCampaignUpdate } from '../../../api/public-campaigns.api';
import { getImageUrl } from '../../../utils/image.utils';

interface Props {
  updates: PublicCampaignUpdate[];
  loading?: boolean;
  entrepreneurName?: string;
  entrepreneurAvatar?: string | null;
}

export function CampaignUpdatesTimeline({
  updates,
  loading = false,
  entrepreneurName = 'Emprendedor',
  entrepreneurAvatar,
}: Props) {
  if (loading) {
    return (
      <div className="bg-white rounded-2xl p-10 text-center border border-slate-100">
        <Clock size={28} className="animate-spin text-slate-300 mx-auto mb-2" />
        <p className="text-slate-400 text-[12px] font-bold">Cargando bitácora de avances...</p>
      </div>
    );
  }

  if (updates.length === 0) {
    return (
      <div className="bg-white rounded-[24px] sm:rounded-[28px] p-8 sm:p-12 text-center border border-green-50 shadow-sm font-['Plus Jakarta Sans',sans-serif]">
        <div className="w-16 h-16 rounded-2xl bg-[#f0f9e0] text-[#72B626] flex items-center justify-center mx-auto mb-4">
          <Sparkles size={32} />
        </div>
        <h4 className="text-[17px] font-black text-[#1c2b1e] mb-1">
          Aún no se han publicado bitácoras de avance
        </h4>
        <p className="text-[13px] text-slate-500 max-w-md mx-auto leading-relaxed">
          El equipo del proyecto publicará aquí historias, fotos de progreso y novedades sobre el
          desarrollo del proyecto en cuanto se completen los primeros hitos.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 font-['Plus Jakarta Sans',sans-serif]">
      {/* Header card */}
      <div className="bg-white rounded-[24px] sm:rounded-[28px] p-6 sm:p-8 border border-green-50 shadow-sm">
        <div className="flex items-center gap-2 mb-2">
          <span className="px-3 py-1 rounded-full bg-green-50 text-[#72B626] text-[11px] font-black uppercase tracking-widest flex items-center gap-1.5">
            <Sparkles size={14} strokeWidth={2.5} />
            Bitácora Oficial
          </span>
        </div>
        <h3 className="text-xl sm:text-2xl font-black text-[#1c2b1e] tracking-tight">
          Novedades y Avances del Proyecto ({updates.length})
        </h3>
        <p className="text-[13px] sm:text-[14px] text-slate-500 font-medium mt-1 max-w-2xl leading-relaxed">
          Sigue el día a día y los avances reportados directamente por el equipo emprendedor.
        </p>
      </div>

      {/* Timeline entries */}
      <div className="space-y-4">
        {updates.map((update, idx) => {
          const author = update.authorName || entrepreneurName;
          const avatar = update.authorAvatar || entrepreneurAvatar;

          return (
            <article
              key={update.id || idx}
              className="bg-white rounded-[24px] p-6 sm:p-8 border border-slate-100 shadow-sm hover:border-green-200 transition-all"
            >
              {/* Header with Author and Date */}
              <div className="flex items-center justify-between gap-4 pb-4 mb-4 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-[#1c2b1e] to-[#72B626] flex items-center justify-center text-white text-[12px] font-black overflow-hidden shrink-0 shadow-sm">
                    {getImageUrl(avatar) ? (
                      <img src={getImageUrl(avatar)} alt="" className="w-full h-full object-cover" />
                    ) : (
                      author.charAt(0).toUpperCase()
                    )}
                  </div>
                  <div>
                    <h5 className="font-black text-[13px] text-[#1c2b1e] leading-snug">
                      {author}
                    </h5>
                    {update.authorDisplayName && (
                      <p className="text-[11px] text-[#72B626] font-bold">
                        @{update.authorDisplayName}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 text-slate-400 text-[11px] font-bold bg-slate-50 px-3 py-1.5 rounded-full shrink-0">
                  <Calendar size={13} />
                  <span>
                    {new Date(update.createdAt).toLocaleDateString('es-BO', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </span>
                </div>
              </div>

              {/* Title and Content */}
              <h4 className="text-[17px] sm:text-[18px] font-black text-[#1c2b1e] tracking-tight mb-3">
                {update.title}
              </h4>
              <div className="text-[14px] text-slate-600 leading-relaxed whitespace-pre-wrap mb-4">
                {update.content}
              </div>

              {/* Attachments (if any) */}
              {update.attachments && update.attachments.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-slate-100">
                  {update.attachments.map((att: any, aIdx: number) => {
                    if (att.type === 'image' && att.url) {
                      return (
                        <div
                          key={aIdx}
                          className="rounded-2xl overflow-hidden border border-slate-100 h-48 bg-slate-900 group relative"
                        >
                          <img
                            src={getImageUrl(att.url)}
                            alt="Adjunto de avance"
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          />
                        </div>
                      );
                    }
                    if (att.type === 'video' && att.url) {
                      return (
                        <div key={aIdx} className="rounded-2xl overflow-hidden border border-slate-100">
                          <video
                            src={getImageUrl(att.url)}
                            controls
                            className="w-full max-h-56 bg-black"
                          />
                        </div>
                      );
                    }
                    if (att.text) {
                      return (
                        <div
                          key={aIdx}
                          className="bg-green-50/50 border border-green-100 rounded-xl p-3 text-[12px] text-slate-600 italic"
                        >
                          "{att.text}"
                        </div>
                      );
                    }
                    return null;
                  })}
                </div>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}

