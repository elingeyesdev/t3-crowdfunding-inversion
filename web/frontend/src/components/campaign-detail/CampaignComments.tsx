import { useAsyncResource } from '../../hooks/useAsyncResource.ts';
import { useState, useCallback, useRef, useEffect } from 'react';
import { RequestErrorNotice } from '../RequestErrorNotice';
import { useNavigate, useLocation } from 'react-router-dom';
import { ThumbsUp, MessageCircle, Send, Loader2, LogIn } from 'lucide-react';
import { getImageUrl } from '../../utils/image.utils';
import {
  getComments,
  postComment,
  toggleCommentLike,
  type CampaignComment,
} from '../../api/comments.api';

interface Props {
  campaignId: string;
  readOnly?: boolean;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Justo ahora';
  if (mins < 60) return `Hace ${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `Hace ${hrs} h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `Hace ${days} d`;
  return new Date(dateStr).toLocaleDateString('es-BO', { day: 'numeric', month: 'short', year: 'numeric' });
}

function Avatar({ name, avatarUrl }: { name: string | null | undefined; avatarUrl: string | null }) {
  const img = getImageUrl(avatarUrl);
  const initials = (name || 'Usuario')
    .split(' ')
    .slice(0, 2)
    .map((n) => n ? n[0] : '')
    .join('')
    .toUpperCase();

  if (img) {
    return <img src={img} alt={name || 'Usuario'} className="w-full h-full object-cover" />;
  }
  return <span className="text-[13px] font-black text-white">{initials || '?'}</span>;
}

export function CampaignComments(props: Props) {
  return <CampaignCommentsContent key={props.campaignId} {...props} />;
}

function CampaignCommentsContent({ campaignId, readOnly = false }: Props) {
  const navigate = useNavigate();
  const location = useLocation();



  const [commentText, setCommentText] = useState('');
  const [posting, setPosting] = useState(false);
  const [likingId, setLikingId] = useState<string | null>(null);
  const [postError, setPostError] = useState<unknown>(null);
  const [likeError, setLikeError] = useState<{ id: string; error: unknown } | null>(null);
  const mutationPending = useRef(false);
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  const busy = posting || likingId !== null;

  const isLoggedIn = !!localStorage.getItem('accessToken');

  const load = useCallback(() => getComments(campaignId), [campaignId]);
  const {data, loading, error, retry, setData: updateComments} = useAsyncResource(load);
  const comments = !loading && !error ? data ?? [] : [];
  const setComments = (update: (previous: CampaignComment[]) => CampaignComment[]) => updateComments(previous => update(previous ?? []));
  const handlePost = async () => {
    if (readOnly || mutationPending.current || loading || error) return;
    if (!isLoggedIn) {
      navigate('/login', { state: { from: location.pathname } });
      return;
    }
    if (!commentText.trim()) return;
    mutationPending.current = true;
    setPostError(null);
    try {
      setPosting(true);
      const created = await postComment(campaignId, commentText.trim());
      if (!mounted.current) return;
      // Enrich with likedByMe = false so UI is consistent
      setComments((prev) => [{ ...created, likedByMe: false }, ...prev.filter(comment => comment.id !== created.id)]);
      setCommentText('');
    } catch (failure) {
      if (mounted.current) setPostError(failure);
    } finally {
      mutationPending.current = false;
      if (mounted.current) setPosting(false);
    }
  };

  const handleLike = async (commentId: string) => {
    if (readOnly || mutationPending.current || loading || error) return;
    if (!isLoggedIn) {
      navigate('/login', { state: { from: location.pathname } });
      return;
    }
    const original = comments.find(comment => comment.id === commentId);
    if (!original) return;
    mutationPending.current = true;
    setLikingId(commentId);
    setLikeError(null);

    // Optimistic update
    setComments((prev) =>
      prev.map((c) =>
        c.id === commentId
          ? { ...c, likedByMe: !original.likedByMe, likesCount: Math.max(0, original.likesCount + (original.likedByMe ? -1 : 1)) }
          : c,
      ),
    );

    try {
      const result = await toggleCommentLike(campaignId, commentId);
      if (!mounted.current) return;
      setComments((prev) =>
        prev.map((c) =>
          c.id === commentId ? { ...c, likedByMe: result.liked, likesCount: result.likesCount } : c,
        ),
      );
    } catch (failure) {
      if (!mounted.current) return;
      // Revert optimistic update on error
      setComments((prev) =>
        prev.map((c) =>
          c.id === commentId
            ? { ...c, likedByMe: original.likedByMe, likesCount: original.likesCount }
            : c,
        ),
      );
      setLikeError({ id: commentId, error: failure });
    } finally {
      mutationPending.current = false;
      if (mounted.current) setLikingId(null);
    }
  };

  return (
    <div
      className="bg-white rounded-[28px] shadow-sm border border-green-50 p-8 md:p-10 font-['Plus Jakarta Sans',sans-serif]"
      id="campaign-comments"
    >
      {/* Header */}
      <h2 className="text-xl font-black text-[#1c2b1e] tracking-tight mb-6 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center">
          <MessageCircle size={20} strokeWidth={2.5} className="text-[#72B626]" />
        </div>
        Comentarios
        {!loading && !error && (
          <span className="ml-1 text-[14px] font-bold text-slate-400">({comments.length})</span>
        )}
      </h2>

      {/* ── Write comment box ── */}
      {readOnly ? (
        <p className="mb-6 text-sm text-slate-500">Los comentarios de esta campaña cerrada se conservan para consulta.</p>
      ) : <div className="flex gap-3 mb-8">
        {/* User avatar placeholder */}
        <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-[#1c2b1e] to-[#72B626] flex items-center justify-center shrink-0 overflow-hidden">
          {isLoggedIn && localStorage.getItem('userAvatar') ? (
            <img src={getImageUrl(localStorage.getItem('userAvatar'))} alt="Avatar" className="w-full h-full object-cover" />
          ) : (
            <span className="text-white text-[12px] font-black">
              U
            </span>
          )}
        </div>

        <div className="flex-1 relative">
          <textarea
            rows={2}
            maxLength={2000}
            placeholder={
              isLoggedIn
                ? 'Escribe un comentario...'
                : 'Inicia sesión para comentar'
            }
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            onFocus={() => {
              if (!isLoggedIn) navigate('/login', { state: { from: location.pathname } });
            }}
            disabled={posting}
            className="w-full px-4 py-3 pr-12 rounded-2xl bg-slate-50 border-2 border-slate-100 text-[14px] text-[#1c2b1e] font-medium outline-none focus:border-[#72B626] focus:ring-4 focus:ring-green-500/10 transition-all resize-none placeholder:text-slate-300 disabled:opacity-60"
            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
          />
          <button
            type="button"
            aria-label="Publicar comentario"
            onClick={handlePost}
            disabled={busy || loading || Boolean(error) || !commentText.trim()}
            className="absolute right-3 bottom-3 w-8 h-8 rounded-xl bg-[#72B626] hover:bg-[#1c2b1e] text-white flex items-center justify-center transition-all active:scale-90 disabled:opacity-40 disabled:cursor-not-allowed border-none cursor-pointer shadow-sm"
          >
            {posting ? (
              <Loader2 size={14} strokeWidth={2.5} className="animate-spin" />
            ) : (
              <Send size={14} strokeWidth={2.5} />
            )}
          </button>
        </div>
      </div>}
      {posting && <p role="status" className="mb-4 text-sm text-slate-500">Publicando comentario...</p>}
      {!readOnly && Boolean(postError) && <RequestErrorNotice error={postError} fallback="No se pudo publicar tu comentario. El texto se conserva para que puedas reintentarlo." onRetry={() => { void handlePost(); }} retrying={busy || loading || Boolean(error)} />}

      {/* ── Login nudge for non-authenticated ── */}
      {!readOnly && !isLoggedIn && (
        <div className="flex items-center gap-3 mb-6 bg-slate-50 rounded-2xl p-4 border border-slate-100">
          <LogIn size={18} strokeWidth={2} className="text-slate-400 shrink-0" />
          <p className="text-[13px] text-slate-500 font-medium flex-1">
            <button
              onClick={() => navigate('/login', { state: { from: location.pathname } })}
              className="text-[#72B626] font-black underline bg-transparent border-none cursor-pointer p-0"
            >
              Inicia sesión
            </button>{' '}
            para dejar comentarios y dar like.
          </p>
        </div>
      )}

      {/* ── Comments list ── */}
      {loading ? (
        <div role="status" className="flex items-center justify-center py-12 gap-3 text-slate-400">
          <Loader2 size={20} strokeWidth={2} className="animate-spin" />
          <span className="text-[13px] font-bold uppercase tracking-widest">Cargando comentarios...</span>
        </div>
      ) : error ? (
        <RequestErrorNotice error={error} fallback="No se pudieron cargar los comentarios." onRetry={retry} retrying={busy} />
      ) : comments.length === 0 ? (
        <div className="text-center py-12">
          <MessageCircle size={40} strokeWidth={1} className="text-slate-200 mx-auto mb-3" />
          <p className="text-slate-400 font-bold text-[14px]">Sé el primero en comentar</p>
          <p className="text-slate-300 text-[12px] mt-1">Comparte tu opinión sobre esta campaña</p>
        </div>
      ) : (
        <div className="space-y-6">
          {comments.map((comment) => (
            <div key={comment.id} className="flex gap-3 group">
              {/* Avatar */}
              <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-[#1c2b1e] to-[#72B626] flex items-center justify-center shrink-0 overflow-hidden">
                <Avatar name={comment.authorName} avatarUrl={comment.authorAvatar} />
              </div>

              {/* Content bubble */}
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2 mb-1 flex-wrap">
                  <span className="text-[13px] font-black text-[#1c2b1e]">{comment.authorName || 'Usuario'}</span>
                  <span className="text-[11px] text-slate-400 font-medium">{timeAgo(comment.createdAt)}</span>
                </div>

                <p className="text-[14px] text-slate-600 leading-relaxed mb-2 whitespace-pre-wrap">
                  {comment.content}
                </p>

                {/* Like button — YouTube style */}
                <button
                  type="button"
                  aria-label={`${comment.likedByMe ? 'Quitar me gusta' : 'Dar me gusta'} al comentario de ${comment.authorName || 'Usuario'}`}
                  aria-pressed={comment.likedByMe}
                  onClick={() => handleLike(comment.id)}
                  disabled={readOnly || busy}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] font-black transition-all active:scale-90 border-none cursor-pointer disabled:opacity-60 ${
                    comment.likedByMe
                      ? 'bg-[#72B626]/10 text-[#72B626] hover:bg-[#72B626]/15'
                      : 'bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-[#1c2b1e]'
                  }`}
                >
                  <ThumbsUp
                    size={13}
                    strokeWidth={2.5}
                    className={`transition-transform ${comment.likedByMe ? 'fill-[#72B626] scale-110' : ''}`}
                  />
                  {comment.likesCount > 0 && (
                    <span>{comment.likesCount.toLocaleString()}</span>
                  )}
                  {comment.likesCount === 0 && <span>Me gusta</span>}
                </button>
                {likingId === comment.id && <p role="status" className="mt-2 text-sm text-slate-500">Actualizando me gusta...</p>}
                {!readOnly && likeError?.id === comment.id && <RequestErrorNotice error={likeError.error} fallback="No se pudo actualizar el me gusta. Se restauró el estado anterior." onRetry={() => { void handleLike(comment.id); }} retrying={busy} />}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
