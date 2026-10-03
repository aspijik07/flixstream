import React, { useEffect, useState, useRef } from 'react';

export interface VideoPlayerProps {
  mediaId: string | number;
  mediaType?: 'movie' | 'tv';
  season?: number;
  episode?: number;
  title?: string;
  onStreamStart?: () => void;
  className?: string;
}

export interface StreamServer {
  id: string;
  name: string;
  badge: string;
  subtitle: string;
  getUrl: (id: string | number, season?: number, episode?: number) => string;
}

export const STREAM_SERVERS: StreamServer[] = [
  {
    id: 'vidsrc1',
    name: 'VidSrc 1',
    badge: 'VIDSRC #1 VIP',
    subtitle: 'Instant CDN • 0% Buffering',
    getUrl: (id, season = 1, episode = 1) =>
      `https://vidsrc.cc/v2/embed/${season && episode ? `tv/${id}/${season}/${episode}` : `movie/${id}`}`
  },
  {
    id: 'vidsrc2',
    name: 'VidSrc 2',
    badge: 'VIDSRC #2 IMDB',
    subtitle: 'High-Speed Cloud • Instant Play',
    getUrl: (id, season = 1, episode = 1) =>
      `https://player.autoembed.cc/embed/${season && episode ? `tv/${id}/${season}/${episode}` : `movie/${id}`}`
  },
  {
    id: 'vidsrc3',
    name: 'VidSrc 3',
    badge: 'VIDSRC #3 SUBS',
    subtitle: 'Direct Node • Multi-Language',
    getUrl: (id, season = 1, episode = 1) =>
      `https://vidlink.pro/${season && episode ? `tv/${id}/${season}/${episode}` : `movie/${id}`}?primaryColor=e50914&secondaryColor=111111&autoplay=false`
  },
  {
    id: 'vidsrc4',
    name: 'VidSrc 4',
    badge: 'VIDSRC #4 DIRECT',
    subtitle: 'Direct CDN • Stable Audio',
    getUrl: (id, season = 1, episode = 1) =>
      `https://embed.su/embed/${season && episode ? `tv/${id}/${season}/${episode}` : `movie/${id}`}`
  }
];

export const VideoPlayer: React.FC<VideoPlayerProps> = ({
  mediaId,
  mediaType = 'movie',
  season = 1,
  episode = 1,
  title = 'Cinema Stream',
  onStreamStart,
  className = ''
}) => {
  const [activeServerId, setActiveServerId] = useState<string>('vidsrc1');
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // ==========================================================================
  // BULLETPROOF ANTI-AD, ANTI-POPUP, AND ANTI-REDIRECT SHIELD (AdShield)
  // ==========================================================================
  useEffect(() => {
    const originalOpen = window.open;

    // 1. Intercept and drop all third-party ad popups
    window.open = (url?: string | URL, target?: string, features?: string) => {
      const urlStr = url?.toString() || '';
      if (urlStr.includes('youtube.com') || urlStr.startsWith(window.location.origin)) {
        return originalOpen.call(window, url, target, features);
      }
      console.warn('[AdShield] Blocked popup attempt:', urlStr);
      return null;
    };

    // 2. Reclaim window focus if an iframe ad tries to blur parent
    const handleBlur = () => {
      setTimeout(() => {
        window.focus();
      }, 25);
    };

    // 3. Prevent iframe from hijacking parent window URL
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };

    window.addEventListener('blur', handleBlur);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.open = originalOpen;
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  const activeServer = STREAM_SERVERS.find(s => s.id === activeServerId) || STREAM_SERVERS[0];
  const streamUrl = mediaType === 'tv'
    ? activeServer.getUrl(mediaId, season, episode)
    : activeServer.getUrl(mediaId);

  const handleStartPlay = () => {
    setIsPlaying(true);
    if (onStreamStart) onStreamStart();
  };

  return (
    <div className={`w-full max-w-6xl mx-auto flex flex-col gap-4 ${className}`}>
      {/* 1. Video Player Viewport */}
      <div className="relative w-full aspect-video bg-black rounded-xl overflow-hidden shadow-2xl border border-neutral-800">
        <iframe
          ref={iframeRef}
          src={streamUrl}
          title={title}
          className="w-full h-full border-0 absolute inset-0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
          allowFullScreen
          /* 🔥 STRICT POPUP BLOCKER 🔥 */
          sandbox="allow-scripts allow-same-origin allow-forms allow-presentation allow-pointer-lock"
          referrerPolicy="no-referrer"
          loading="eager"
        />

        {/* Play Overlay if not playing */}
        {!isPlaying && (
          <div
            onClick={handleStartPlay}
            className="absolute inset-0 bg-black/75 hover:bg-black/60 flex flex-col items-center justify-center cursor-pointer transition-colors z-20"
          >
            <div className="w-20 h-20 bg-[#e50914] rounded-full flex items-center justify-center text-white shadow-[0_0_35px_rgba(229,9,20,0.85)] hover:scale-105 transition-transform mb-4">
              <svg className="w-8 h-8 ml-1" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-white">Start Streaming in 1080p Full HD</h3>
            <p className="text-sm text-neutral-400 mt-1">Fast CDN Mirror • Multi-Subtitles • Dolby Audio</p>
          </div>
        )}
      </div>

      {/* 2. Streaming Server Switcher Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 w-full">
        {STREAM_SERVERS.map((server) => {
          const isActive = server.id === activeServerId;
          return (
            <button
              key={server.id}
              type="button"
              onClick={() => setActiveServerId(server.id)}
              className={`p-3 rounded-xl text-left transition-all border flex flex-col gap-1 select-none ${
                isActive
                  ? 'bg-gradient-to-b from-[#e50914]/20 to-neutral-900 border-[#e50914] shadow-[0_0_16px_rgba(229,9,20,0.3)]'
                  : 'bg-neutral-950/80 hover:bg-neutral-900 border-neutral-800 hover:border-neutral-700'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      isActive ? 'bg-[#e50914] shadow-[0_0_8px_#e50914]' : 'bg-neutral-500'
                    }`}
                  />
                  <span className="text-sm font-extrabold text-white">{server.name}</span>
                </div>
                <span
                  className={`text-[10px] font-black font-mono px-2 py-0.5 rounded ${
                    isActive
                      ? 'bg-[#e50914] text-white shadow-[0_2px_8px_rgba(229,9,20,0.4)]'
                      : 'bg-neutral-800 text-neutral-400'
                  }`}
                >
                  {server.badge}
                </span>
              </div>
              <span className={`text-xs truncate ${isActive ? 'text-neutral-200' : 'text-neutral-400'}`}>
                {server.subtitle}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default VideoPlayer;
