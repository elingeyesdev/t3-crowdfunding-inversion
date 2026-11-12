import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Sparkles,
  Calendar,
  ExternalLink,
  Target,
  Image as ImageIcon,
  Video,
  Clock,
  ArrowRight,
  Filter,
} from 'lucide-react';
import { getBackedCampaignUpdates, type BackedCampaignUpdate } from '../../api/investor.api';
import { getImageUrl } from '../../utils/image.utils';

export function DonorBackedUpdatesFeed() {
  const [updates, setUpdates] = useState<BackedCampaignUpdate[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>('all');

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    getBackedCampaignUpdates()
      .then((data) => {
        if (isMounted) setUpdates(data || []);
      })
      .catch((err) => console.error('Error cargando novedades de campañas respaldadas:', err))
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Unique campaigns from updates list for filter
  const uniqueCampaigns = Array.from(
    new Map(updates.map((u) => [u.campaignId, { id: u.campaignId, title: u.campaignTitle }])).values()
  );

  const filteredUpdates = selectedCampaignId === 'all'
    ? updates
    : updates.filter((u) => u.campaignId === selectedCampaignId);

  return (
    <div className="space-y-6 font-['Plus Jakarta Sans',sans-serif]">
      {/* ── Header ── */}
      <div className="bg-white rounded-[24px] p-6 sm:p-8 border border-gray-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="px-3 py-1 rounded-full bg-green-50 text-[#72B626] text-[11px] font-black uppercase tracking-widest flex items-center gap-1.5">
              <Sparkles size={14} strokeWidth={2.5} />
              Bitácora de Impacto
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-[#1c2b1e] tracking-tight">
            Novedades de Mis Proyectos Apoyados
          </h2>
          <p className="text-[13px] sm:text-[14px] text-slate-500 font-medium mt-1 max-w-xl leading-relaxed">
            Mantente al tanto del progreso, avances técnicos y avisos compartidos por los emprendedores que has respaldado.
          </p>
        </div>

        {uniqueCampaigns.length > 1 && (
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200/80 rounded-2xl p-2 shrink-0">
            <Filter size={15} className="text-slate-400 ml-1" />
            <select
              value={selectedCampaignId}
              onChange={(e) => setSelectedCampaignId(e.target.value)}
              className="bg-transparent border-none text-[12px] font-bold text-slate-700 outline-none cursor-pointer pr-4"
            >
              <option value="all">Todos los proyectos ({updates.length})</option>
              {uniqueCampaigns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* ── Content ── */}
      {loading ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-gray-100">
          <div className="w-8 h-8 border-3 border-gray-200 border-t-[#72B626] rounded-full animate-spin mx-auto mb-3" />
          <p className="text-[12px] font-bold text-slate-400 uppercase tracking-widest">
            Sincronizando bitácora de proyectos...
          </p>
        </div>
      ) : filteredUpdates.length === 0 ? (
        <div className="bg-white rounded-[32px] border border-dashed border-gray-200 p-12 sm:p-16 text-center">
          <div className="w-16 h-16 rounded-2xl bg-green-50 text-[#72B626] flex items-center justify-center mx-auto mb-4">
            <Sparkles size={32} />
          </div>
          <h3 className="text-xl font-black text-[#1c2b1e] tracking-tight mb-2">
            Sin novedades publicadas aún
          </h3>
          <p className="text-[14px] text-slate-400 font-medium max-w-md mx-auto leading-relaxed">
            Cuando los emprendedores de los proyectos a los que has aportado publiquen nuevas historias,
            fotos de avances o reportes de desarrollo, los verás listados automáticamente en esta sección.
          </p>
          <Link
            to="/explore"
            className="inline-flex items-center gap-2 mt-6 px-6 py-3 rounded-xl bg-[#72B626] text-white font-black text-[12px] uppercase tracking-wider no-underline hover:bg-[#5fa01d] transition-all shadow-sm"
          >
            <span>Explorar más Proyectos</span>
            <ArrowRight size={15} />
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          {filteredUpdates.map((update) => {
            const author = update.entrepreneurName || 'Emprendedor';
            const progress = update.campaignGoalAmount > 0
              ? Math.min(100, Math.round((update.campaignCurrentAmount / update.campaignGoalAmount) * 100))
              : 0;

            return (
              <article
                key={update.id}
                className="bg-white rounded-[24px] sm:rounded-[28px] p-6 sm:p-8 border border-gray-100 shadow-sm hover:border-green-200 transition-all"
              >
                {/* Project Badge Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 mb-4 border-b border-slate-100">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-11 h-11 rounded-xl bg-slate-100 overflow-hidden shrink-0 shadow-sm">
                      {getImageUrl(update.campaignCoverImage) ? (
                        <img
                          src={getImageUrl(update.campaignCoverImage)}
                          alt={update.campaignTitle}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-[#1c2b1e]" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] font-black uppercase tracking-widest text-[#72B626]">
                        Proyecto que apoyas
                      </p>
                      <h4 className="text-[15px] sm:text-[16px] font-black text-[#1c2b1e] tracking-tight truncate">
                        {update.campaignTitle}
                      </h4>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0 self-start sm:self-auto">
                    <span className="text-[11px] font-bold text-slate-500 bg-slate-50 px-3 py-1 rounded-full border border-slate-100">
                      {progress}% de la meta
                    </span>
                    <Link
                      to={`/campaign/${update.campaignId}`}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#f5fce8] text-[#4a7f1a] hover:bg-[#72B626] hover:text-white text-[11px] font-black uppercase tracking-wider transition-all no-underline"
                    >
                      <span>Ver Campaña</span>
                      <ExternalLink size={12} />
                    </Link>
                  </div>
                </div>

                {/* Author & Timestamp */}
                <div className="flex items-center justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#1c2b1e] to-[#72B626] flex items-center justify-center text-white text-[11px] font-black overflow-hidden shrink-0">
                      {getImageUrl(update.entrepreneurAvatar) ? (
                        <img src={getImageUrl(update.entrepreneurAvatar)} alt="" className="w-full h-full object-cover" />
                      ) : (
                        author.charAt(0).toUpperCase()
                      )}
                    </div>
                    <div>
                      <p className="text-[12px] font-black text-[#1c2b1e] leading-none">
                        {author}
                      </p>
                      {update.entrepreneurDisplayName && (
                        <p className="text-[10px] text-[#72B626] font-bold">
                          @{update.entrepreneurDisplayName}
                        </p>
                      )}
                    </div>
                  </div>

                  <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1">
                    <Calendar size={12} />
                    {new Date(update.createdAt).toLocaleDateString('es-BO', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </span>
                </div>

                {/* Update Title & Content */}
                <h3 className="text-[17px] sm:text-[18px] font-black text-[#1c2b1e] tracking-tight mb-2">
                  {update.title}
                </h3>
                <div className="text-[13px] sm:text-[14px] text-slate-600 leading-relaxed whitespace-pre-wrap mb-4">
                  {update.content}
                </div>

                {/* Attachments if any */}
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
                              alt="Evidencia"
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                            />
                          </div>
                        );
                      }
                      if (att.type === 'video' && att.url) {
                        return (
                          <div key={aIdx} className="rounded-2xl overflow-hidden border border-slate-100">
                            <video src={getImageUrl(att.url)} controls className="w-full max-h-56 bg-black" />
                          </div>
                        );
                      }
                      if (att.text) {
                        return (
                          <div
                            key={aIdx}
                            className="bg-[#f5fce8] border border-green-100 rounded-xl p-3 text-[12px] text-slate-700 italic"
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
      )}
    </div>
  );
}

