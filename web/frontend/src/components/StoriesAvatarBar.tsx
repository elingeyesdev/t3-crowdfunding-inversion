import { useEffect, useRef, useState, useCallback } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { getRecentStories, type CampaignStoryGroup, type StoryItem } from '../api/public-campaigns.api';
import { getImageUrl } from '../utils/image.utils';

// ─── localStorage helpers ────────────────────────────────────────────────────
const STORAGE_KEY = 'cf_story_seen';

function getSeenMap(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
}

function markSeen(campaignId: string, latestAt: string) {
  const map = getSeenMap();
  map[campaignId] = latestAt;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
}

function isUnseen(campaignId: string, latestAt: string): boolean {
  const map = getSeenMap();
  const seen = map[campaignId];
  if (!seen) return true;
  return new Date(latestAt).getTime() > new Date(seen).getTime();
}

// ─── Avatar ───────────────────────────────────────────────────────────────────

interface AvatarProps {
  group: CampaignStoryGroup;
  unseen: boolean;
  onClick: () => void;
}

function StoryAvatar({ group, unseen, onClick }: AvatarProps) {
  const imgSrc = getImageUrl(group.entrepreneurAvatar) || getImageUrl(group.campaignCoverImageUrl);
  const initials = group.entrepreneurName
    .split(' ')
    .map(w => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <button
      onClick={onClick}
      id={`story-avatar-${group.campaignId}`}
      title={group.campaignTitle}
      style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', flexShrink: 0 }}
      className="flex flex-col items-center gap-2"
    >
      <div
        style={{
          padding: '3px',
          borderRadius: '50%',
          background: unseen
            ? 'linear-gradient(135deg, #00e676, #00bcd4, #1de9b6)'
            : 'transparent',
          border: unseen ? 'none' : '2px solid #d1d5db',
          transition: 'all 0.3s ease',
        }}
      >
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: '50%',
            background: unseen ? '#fff' : '#f1f5f9',
            padding: 2,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
          }}
        >
          {imgSrc ? (
            <img
              src={imgSrc}
              alt={group.entrepreneurName}
              style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }}
            />
          ) : (
            <span
              style={{
                width: '100%',
                height: '100%',
                borderRadius: '50%',
                background: unseen
                  ? 'linear-gradient(135deg, #00e676, #00bcd4)'
                  : 'linear-gradient(135deg, #1c2b1e, #72B626)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontSize: 16,
                fontWeight: 900,
                letterSpacing: 1,
              }}
            >
              {initials}
            </span>
          )}
        </div>
      </div>
      <span
        style={{
          fontSize: 10,
          fontWeight: 700,
          color: '#374151',
          maxWidth: 66,
          textAlign: 'center',
          overflow: 'hidden',
          whiteSpace: 'nowrap',
          textOverflow: 'ellipsis',
        }}
      >
        {group.campaignTitle}
      </span>
    </button>
  );
}

// ─── Story Viewer Modal ───────────────────────────────────────────────────────

interface ViewerProps {
  group: CampaignStoryGroup;
  onClose: () => void;
  onPrevGroup: (() => void) | null;
  onNextGroup: (() => void) | null;
}

function StoryViewer({ group, onClose, onPrevGroup, onNextGroup }: ViewerProps) {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [progress, setProgress] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const DURATION = 6000;
  const TICK = 50;

  const story: StoryItem = group.stories[currentIdx];
  const totalStories = group.stories.length;
  const attachment = story.attachments?.[0];

  const next = useCallback(() => {
    if (currentIdx < totalStories - 1) {
      setCurrentIdx(idx => idx + 1);
      setProgress(0);
    } else {
      if (onNextGroup) onNextGroup();
      else onClose();
    }
  }, [currentIdx, totalStories, onNextGroup, onClose]);

  const prev = () => {
    if (currentIdx > 0) {
      setCurrentIdx(idx => idx - 1);
      setProgress(0);
    } else if (onPrevGroup) {
      onPrevGroup();
    }
  };

  useEffect(() => {
    setProgress(0);
    intervalRef.current = setInterval(() => {
      setProgress(p => {
        if (p >= 100) {
          clearInterval(intervalRef.current!);
          next();
          return 0;
        }
        return p + (100 / (DURATION / TICK));
      });
    }, TICK);
    return () => clearInterval(intervalRef.current!);
  }, [currentIdx, next]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const imgSrc = getImageUrl(group.entrepreneurAvatar) || getImageUrl(group.campaignCoverImageUrl);
  const initials = group.entrepreneurName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

  return (
    <div
      id="story-viewer-overlay"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(0,0,0,0.85)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
      }}
    >
      <div
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: 420,
          height: '80vh',
          maxHeight: 720,
          borderRadius: 24,
          overflow: 'hidden',
          background: '#0f1117',
          boxShadow: '0 32px 64px rgba(0,0,0,0.6)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Progress bars */}
        <div style={{ display: 'flex', gap: 4, padding: '14px 14px 0', zIndex: 10, position: 'relative' }}>
          {group.stories.map((_, i) => (
            <div
              key={i}
              style={{ flex: 1, height: 3, borderRadius: 4, background: 'rgba(255,255,255,0.25)', overflow: 'hidden' }}
            >
              <div
                style={{
                  height: '100%',
                  background: 'linear-gradient(90deg, #00e676, #00bcd4)',
                  width: i < currentIdx ? '100%' : i === currentIdx ? `${progress}%` : '0%',
                  transition: i === currentIdx ? 'none' : 'width 0.1s',
                  borderRadius: 4,
                }}
              />
            </div>
          ))}
        </div>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', zIndex: 10, position: 'relative' }}>
          <div style={{ width: 38, height: 38, borderRadius: '50%', overflow: 'hidden', flexShrink: 0 }}>
            {imgSrc ? (
              <img src={imgSrc} alt={group.entrepreneurName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <div style={{ width: '100%', height: '100%', background: 'linear-gradient(135deg,#00e676,#00bcd4)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 900, fontSize: 14 }}>
                {initials}
              </div>
            )}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{group.campaignTitle}</p>
            <p style={{ margin: 0, fontSize: 11, color: 'rgba(255,255,255,0.5)', fontWeight: 500 }}>{group.entrepreneurName}</p>
          </div>
          <button
            id="story-viewer-close"
            onClick={onClose}
            style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: 8, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#fff', flexShrink: 0 }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
          {attachment?.type === 'image' && getImageUrl(attachment.url) ? (
            <img src={getImageUrl(attachment.url)} alt={story.title} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : attachment?.type === 'video' && attachment.url ? (
            <video key={attachment.url} src={attachment.url} autoPlay muted playsInline loop style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(160deg, #0d1f10, #1c3a1e, #0a2e2e)' }} />
          )}

          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, transparent 55%)' }} />

          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '0 20px 28px' }}>
            <h3 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 900, color: '#fff', lineHeight: 1.2, textShadow: '0 2px 8px rgba(0,0,0,0.5)' }}>
              {story.title}
            </h3>
            <p style={{ margin: 0, fontSize: 14, color: 'rgba(255,255,255,0.8)', lineHeight: 1.5, textShadow: '0 1px 4px rgba(0,0,0,0.5)' }}>
              {story.content}
            </p>
            {attachment?.type === 'text' && attachment.text && (
              <p style={{ marginTop: 10, fontSize: 13, color: 'rgba(0,230,118,0.9)', fontWeight: 600 }}>
                {attachment.text}
              </p>
            )}
          </div>
        </div>

        {/* Tap zones */}
        <button onClick={prev} style={{ position: 'absolute', left: 0, top: 0, width: '35%', height: '100%', background: 'transparent', border: 'none', cursor: 'pointer', zIndex: 5 }} aria-label="Historia anterior" />
        <button onClick={next} style={{ position: 'absolute', right: 0, top: 0, width: '35%', height: '100%', background: 'transparent', border: 'none', cursor: 'pointer', zIndex: 5 }} aria-label="Historia siguiente" />
      </div>

      {onPrevGroup && (
        <button id="story-prev-campaign" onClick={onPrevGroup} style={{ position: 'absolute', left: 'max(12px, calc(50% - 252px))', top: '50%', transform: 'translateY(-50%)', background: 'rgba(255,255,255,0.12)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 12, width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#fff' }}>
          <ChevronLeft size={20} />
        </button>
      )}
      {onNextGroup && (
        <button id="story-next-campaign" onClick={onNextGroup} style={{ position: 'absolute', right: 'max(12px, calc(50% - 252px))', top: '50%', transform: 'translateY(-50%)', background: 'rgba(255,255,255,0.12)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 12, width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#fff' }}>
          <ChevronRight size={20} />
        </button>
      )}
    </div>
  );
}

// ─── Main StoriesAvatarBar ────────────────────────────────────────────────────

export function StoriesAvatarBar({ style }: { style?: React.CSSProperties }) {
  const [groups, setGroups] = useState<CampaignStoryGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeIdx, setActiveIdx] = useState<number | null>(null);
  const [unseenMap, setUnseenMap] = useState<Record<string, boolean>>({});
  const scrollRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getRecentStories();
      const limited = data.slice(0, 8);
      setGroups(limited);

      const map: Record<string, boolean> = {};
      for (const g of limited) {
        const latest = g.stories[g.stories.length - 1].createdAt;
        map[g.campaignId] = isUnseen(g.campaignId, latest);
      }
      setUnseenMap(map);
    } catch {
      // Stories are optional — fail silently
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openStory = (idx: number) => {
    setActiveIdx(idx);
    const g = groups[idx];
    const latest = g.stories[g.stories.length - 1].createdAt;
    markSeen(g.campaignId, latest);
    setUnseenMap(prev => ({ ...prev, [g.campaignId]: false }));
  };

  const goToGroup = (idx: number) => {
    if (idx >= 0 && idx < groups.length) openStory(idx);
    else setActiveIdx(null);
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', gap: 16, padding: '0 4px', overflowX: 'auto', ...style }}>
        {[1, 2, 3, 4].map(i => (
          <div key={i} style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 62, height: 62, borderRadius: '50%', background: 'linear-gradient(135deg,#e2e8f0,#cbd5e1)', animation: 'pulse 1.5s infinite' }} />
            <div style={{ width: 48, height: 8, borderRadius: 4, background: '#e2e8f0' }} />
          </div>
        ))}
      </div>
    );
  }

  if (groups.length === 0) return null;

  return (
    <>
      <div
        style={{
          background: '#fff',
          borderRadius: 24,
          border: '1px solid #e8f5e9',
          boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
          padding: '18px 20px',
          ...style,
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <div>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 900, color: '#1c2b1e', letterSpacing: 0.5, textTransform: 'uppercase' }}>
              Novedades
            </p>
            <p style={{ margin: 0, fontSize: 11, color: '#6b7280', fontWeight: 500 }}>
              Actualizaciones de las últimas 24h · {groups.length} campaña{groups.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>

        {/* Avatar scroll */}
        <div
          ref={scrollRef}
          style={{ display: 'flex', gap: 20, overflowX: 'auto', paddingBottom: 6 }}
          className="hide-scrollbar"
        >
          {groups.map((g, idx) => (
            <StoryAvatar
              key={g.campaignId}
              group={g}
              unseen={unseenMap[g.campaignId] ?? true}
              onClick={() => openStory(idx)}
            />
          ))}
        </div>
      </div>

      {activeIdx !== null && groups[activeIdx] && (
        <StoryViewer
          group={groups[activeIdx]}
          onClose={() => setActiveIdx(null)}
          onPrevGroup={activeIdx > 0 ? () => goToGroup(activeIdx - 1) : null}
          onNextGroup={activeIdx < groups.length - 1 ? () => goToGroup(activeIdx + 1) : null}
        />
      )}
    </>
  );
}
