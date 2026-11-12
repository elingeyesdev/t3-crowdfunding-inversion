import { useEffect, useRef, useState } from 'react';
import { Volume2, VolumeX, Play } from 'lucide-react';

/* ─────────────────────────────────────────────
   URL PARSING UTILS
   ───────────────────────────────────────────── */

type VideoProvider = 'youtube' | 'tiktok' | 'unknown';

interface ParsedVideo {
  provider: VideoProvider;
  embedUrl: string | null;
}

function parseVideoUrl(url: string): ParsedVideo {
  if (!url) return { provider: 'unknown', embedUrl: null };

  // YouTube standard: youtube.com/watch?v=ID
  const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  if (ytMatch) {
    return {
      provider: 'youtube',
      // enablejsapi=1 is required to accept postMessage commands
      embedUrl: `https://www.youtube.com/embed/${ytMatch[1]}?autoplay=1&mute=1&loop=1&playlist=${ytMatch[1]}&controls=0&modestbranding=1&rel=0&playsinline=1&enablejsapi=1`,
    };
  }

  // YouTube Shorts: youtube.com/shorts/ID
  const ytShortsMatch = url.match(/youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/);
  if (ytShortsMatch) {
    return {
      provider: 'youtube',
      embedUrl: `https://www.youtube.com/embed/${ytShortsMatch[1]}?autoplay=1&mute=1&loop=1&playlist=${ytShortsMatch[1]}&controls=0&modestbranding=1&rel=0&playsinline=1&enablejsapi=1`,
    };
  }

  // TikTok: tiktok.com/@user/video/ID
  // IMPORTANT: Must use player/v1/ (NOT embed/v2/) for the postMessage API to work.
  // IMPORTANT: Do NOT use muted=1. Per official TikTok docs, muted=1 "prevents the user
  //            from changing the volume" which disables the unMute postMessage command.
  //            We use autoplay=1 which starts muted per browser policy; we then control
  //            audio via postMessage once the user clicks the button.
  const ttMatch = url.match(/tiktok\.com\/@[^/]+\/video\/(\d+)/);
  if (ttMatch) {
    return {
      provider: 'tiktok',
      embedUrl: `https://www.tiktok.com/player/v1/${ttMatch[1]}?autoplay=1&loop=1&controls=0&music_info=0&description=0&rel=0`,
    };
  }

  return { provider: 'unknown', embedUrl: null };
}

/* ─────────────────────────────────────────────
   HELPERS
   ───────────────────────────────────────────── */

function sendYouTubeMessage(iframe: HTMLIFrameElement, func: string) {
  iframe.contentWindow?.postMessage(
    JSON.stringify({ event: 'command', func, args: [] }),
    '*'
  );
}

function sendTikTokMessage(iframe: HTMLIFrameElement, type: string) {
  // TikTok official postMessage spec: { 'x-tiktok-player': true, type, value }
  iframe.contentWindow?.postMessage(
    { 'x-tiktok-player': true, type, value: null },
    '*'
  );
}

/* ─────────────────────────────────────────────
   COMPONENT
   ───────────────────────────────────────────── */

interface PitchVideoPlayerProps {
  videoUrl: string;
  isActive: boolean; // Controlled by parent via IntersectionObserver
}

export function PitchVideoPlayer({ videoUrl, isActive }: PitchVideoPlayerProps) {
  const [muted, setMuted] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const { provider, embedUrl } = parseVideoUrl(videoUrl);

  // Lazy-load: only set iframe src when active; clear when inactive to save memory
  useEffect(() => {
    if (!iframeRef.current || !embedUrl) return;
    if (isActive) {
      iframeRef.current.src = embedUrl;
    } else {
      const t = setTimeout(() => {
        if (iframeRef.current) iframeRef.current.src = '';
        setLoaded(false);
        setMuted(true); // reset mute state when leaving slide
      }, 400);
      return () => clearTimeout(t);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive, embedUrl]);

  // Send mute/unmute command via postMessage whenever muted state changes
  useEffect(() => {
    if (!iframeRef.current || !embedUrl || !isActive || !loaded) return;

    const cmd = muted ? 'mute' : 'unMute';

    if (provider === 'youtube') {
      sendYouTubeMessage(iframeRef.current, muted ? 'mute' : 'unMute');
    } else if (provider === 'tiktok') {
      sendTikTokMessage(iframeRef.current, cmd);
    }
  }, [muted, provider, isActive, embedUrl, loaded]);

  // When iframe finishes loading, wait briefly then sync the current muted state
  const handleLoad = () => {
    setLoaded(true);
    // Give the player SDK ~1s to fully initialize before sending commands
    setTimeout(() => {
      if (!iframeRef.current) return;
      const cmd = muted ? 'mute' : 'unMute';
      if (provider === 'youtube') {
        sendYouTubeMessage(iframeRef.current, muted ? 'mute' : 'unMute');
      } else if (provider === 'tiktok') {
        sendTikTokMessage(iframeRef.current, cmd);
      }
    }, 1200);
  };

  if (!embedUrl) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-[#1c2b1e]">
        <div className="text-center text-white/40 px-6">
          <Play size={48} strokeWidth={1} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium">URL de video no válida</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full bg-black overflow-hidden">
      {/* Loading shimmer */}
      {!loaded && (
        <div className="absolute inset-0 bg-gradient-to-b from-[#1c2b1e] to-black flex items-center justify-center">
          <div className="w-16 h-16 rounded-full border-4 border-white/10 border-t-[#72B626] animate-spin" />
        </div>
      )}

      {/* Video iframe */}
      <iframe
        ref={iframeRef}
        title="pitch-video"
        allow="autoplay; fullscreen; picture-in-picture"
        allowFullScreen
        className="absolute inset-0 w-full h-full border-none"
        style={{ opacity: loaded ? 1 : 0, transition: 'opacity 0.4s ease' }}
        onLoad={handleLoad}
      />

      {/* Mute / Unmute button */}
      <button
        onClick={(e) => { e.stopPropagation(); setMuted(m => !m); }}
        className="absolute bottom-6 right-5 z-20 w-11 h-11 rounded-full flex items-center justify-center transition-all active:scale-90"
        style={{
          background: 'rgba(0,0,0,0.55)',
          backdropFilter: 'blur(8px)',
          border: '1.5px solid rgba(255,255,255,0.18)',
        }}
        title={muted ? 'Activar sonido' : 'Silenciar'}
      >
        {muted
          ? <VolumeX size={18} className="text-white" strokeWidth={2.5} />
          : <Volume2 size={18} className="text-[#d4f0a0]" strokeWidth={2.5} />
        }
      </button>

      {/* Provider badge */}
      <div
        className="absolute top-5 right-5 z-20 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest text-white"
        style={{ background: 'rgba(0,0,0,0.50)', backdropFilter: 'blur(6px)' }}
      >
        {provider === 'youtube' ? '▶ YouTube' : provider === 'tiktok' ? '♪ TikTok' : ''}
      </div>
    </div>
  );
}
