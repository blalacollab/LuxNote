import { YOUTUBE_PROGRESS_LOCAL_STORAGE_KEY } from './constants';

export const YOUTUBE_EMBED_PATTERN =
  /(?:https?:\/\/)?(?:www\.)?youtu\.?be(?:\.com)?\/?.*(?:watch|embed|shorts)?(?:.*v=|v\/|\/)([a-zA-Z0-9_-]{11})([\&\?](.*))?$/i;

type StoredYouTubeProgress = Record<
  string,
  {
    currentTime: number;
    updatedAt: number;
  }
>;

export type YouTubeIframeApi = {
  Player: new (
    element: HTMLIFrameElement,
    options?: {
      events?: {
        onReady?: (event: { target: YouTubePlayer }) => void;
        onStateChange?: (event: { data: number; target: YouTubePlayer }) => void;
      };
    },
  ) => YouTubePlayer;
  PlayerState: {
    ENDED: number;
    PLAYING: number;
    PAUSED: number;
    BUFFERING: number;
    CUED: number;
  };
};

export type YouTubePlayer = {
  destroy?: () => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  seekTo: (seconds: number, allowSeekAhead?: boolean) => void;
};

declare global {
  interface Window {
    YT?: YouTubeIframeApi;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let youtubeIframeApiPromise: Promise<YouTubeIframeApi> | null = null;

function withProtocol(value: string) {
  return /^https?:\/\//i.test(value) ? value : `https://${value}`;
}

function readProgressMap(): StoredYouTubeProgress {
  if (typeof localStorage === 'undefined') {
    return {};
  }

  const raw = localStorage.getItem(YOUTUBE_PROGRESS_LOCAL_STORAGE_KEY);

  if (!raw) {
    return {};
  }

  try {
    const parsed = JSON.parse(raw);

    if (parsed && typeof parsed === 'object') {
      return parsed as StoredYouTubeProgress;
    }
  } catch {
    // Ignore malformed persisted progress.
  }

  return {};
}

function writeProgressMap(progressMap: StoredYouTubeProgress) {
  if (typeof localStorage === 'undefined') {
    return;
  }

  if (Object.keys(progressMap).length === 0) {
    localStorage.removeItem(YOUTUBE_PROGRESS_LOCAL_STORAGE_KEY);
    return;
  }

  localStorage.setItem(
    YOUTUBE_PROGRESS_LOCAL_STORAGE_KEY,
    JSON.stringify(progressMap),
  );
}

function makeProgressKey(noteId: string, href: string) {
  return `${noteId}::${href.trim()}`;
}

export function parseYouTubeTimestamp(value: string | null): number | null {
  if (!value) {
    return null;
  }

  const normalized = value.trim().toLowerCase();

  if (!normalized) {
    return null;
  }

  if (/^\d+$/.test(normalized)) {
    return Number(normalized);
  }

  const parts = normalized.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s?)?$/);

  if (!parts) {
    return null;
  }

  const hours = Number(parts[1] ?? 0);
  const minutes = Number(parts[2] ?? 0);
  const seconds = Number(parts[3] ?? 0);
  const total = hours * 3600 + minutes * 60 + seconds;

  return total > 0 ? total : null;
}

export function extractYouTubeVideoId(href: string) {
  try {
    const url = new URL(withProtocol(href));
    const host = url.hostname.replace(/^www\./i, '');

    if (host === 'youtu.be') {
      return url.pathname.split('/').filter(Boolean)[0] ?? null;
    }

    if (host === 'youtube.com' || host.endsWith('.youtube.com')) {
      const directId = url.searchParams.get('v');

      if (directId) {
        return directId;
      }

      const segments = url.pathname.split('/').filter(Boolean);

      if (segments[0] === 'embed' || segments[0] === 'shorts') {
        return segments[1] ?? null;
      }
    }
  } catch {
    // Ignore invalid URLs and fall back to regex parsing below.
  }

  return href.match(YOUTUBE_EMBED_PATTERN)?.[1] ?? null;
}

export function getYouTubeEmbedUrl(href: string) {
  const videoId = extractYouTubeVideoId(href);

  if (!videoId) {
    return href;
  }

  try {
    const url = new URL(withProtocol(href));
    const searchParams = new URLSearchParams(url.search);
    const start =
      parseYouTubeTimestamp(searchParams.get('t')) ??
      parseYouTubeTimestamp(searchParams.get('start'));
    const clip = searchParams.get('clip') ?? searchParams.get('amp;clip');
    const clipt = searchParams.get('clipt') ?? searchParams.get('amp;clipt');
    const params = new URLSearchParams({ modestbranding: '1' });

    if (start !== null) {
      params.set('start', String(start));
    }

    if (clip) {
      params.set('clip', clip);
    }

    if (clipt) {
      params.set('clipt', clipt);
    }

    return `https://www.youtube.com/embed/${videoId}?${params.toString()}`;
  } catch {
    return `https://www.youtube.com/embed/${videoId}?modestbranding=1`;
  }
}

export function buildYouTubePlayerSrc(
  href: string,
  rememberedTimeSeconds?: number | null,
) {
  const embedUrl = getYouTubeEmbedUrl(href);

  try {
    const url = new URL(embedUrl);

    url.searchParams.set('enablejsapi', '1');
    url.searchParams.set('playsinline', '1');

    if (typeof window !== 'undefined' && window.location.origin) {
      url.searchParams.set('origin', window.location.origin);
    }

    if (
      typeof rememberedTimeSeconds === 'number' &&
      Number.isFinite(rememberedTimeSeconds) &&
      rememberedTimeSeconds > 0
    ) {
      url.searchParams.set('start', String(Math.floor(rememberedTimeSeconds)));
    }

    return url.toString();
  } catch {
    return embedUrl;
  }
}

export function loadYouTubePlaybackProgress(noteId: string, href: string) {
  const progressMap = readProgressMap();
  const entry = progressMap[makeProgressKey(noteId, href)];

  if (!entry || !Number.isFinite(entry.currentTime) || entry.currentTime <= 0) {
    return null;
  }

  return entry.currentTime;
}

export function clearYouTubePlaybackProgress(noteId: string, href: string) {
  const progressMap = readProgressMap();
  const progressKey = makeProgressKey(noteId, href);

  if (!(progressKey in progressMap)) {
    return;
  }

  delete progressMap[progressKey];
  writeProgressMap(progressMap);
}

export function saveYouTubePlaybackProgress(
  noteId: string,
  href: string,
  currentTime: number,
  duration?: number,
) {
  if (!Number.isFinite(currentTime)) {
    return;
  }

  const normalizedTime = Math.max(0, currentTime);
  const normalizedDuration =
    typeof duration === 'number' && Number.isFinite(duration) && duration > 0
      ? duration
      : null;

  if (
    normalizedTime < 3 ||
    (normalizedDuration !== null && normalizedTime >= normalizedDuration - 5)
  ) {
    clearYouTubePlaybackProgress(noteId, href);
    return;
  }

  const progressMap = readProgressMap();

  progressMap[makeProgressKey(noteId, href)] = {
    currentTime: normalizedTime,
    updatedAt: Date.now(),
  };

  writeProgressMap(progressMap);
}

export function loadYouTubeIframeApi(): Promise<YouTubeIframeApi> {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return Promise.reject(new Error('YouTube iframe API requires a browser'));
  }

  if (window.YT?.Player) {
    return Promise.resolve(window.YT);
  }

  if (youtubeIframeApiPromise) {
    return youtubeIframeApiPromise;
  }

  youtubeIframeApiPromise = new Promise<YouTubeIframeApi>((resolve, reject) => {
    const apiUrl = 'https://www.youtube.com/iframe_api';
    const existingScript = document.querySelector<HTMLScriptElement>(
      `script[src="${apiUrl}"]`,
    );
    const previousReadyHandler = window.onYouTubeIframeAPIReady;

    window.onYouTubeIframeAPIReady = () => {
      previousReadyHandler?.();

      if (window.YT?.Player) {
        resolve(window.YT);
        return;
      }

      youtubeIframeApiPromise = null;
      reject(new Error('YouTube iframe API loaded without player support'));
    };

    const handleScriptError = () => {
      youtubeIframeApiPromise = null;
      reject(new Error('Failed to load YouTube iframe API'));
    };

    if (existingScript) {
      existingScript.addEventListener('error', handleScriptError, {
        once: true,
      });
      return;
    }

    const script = document.createElement('script');
    script.src = apiUrl;
    script.async = true;
    script.onerror = handleScriptError;
    document.head.appendChild(script);
  });

  return youtubeIframeApiPromise;
}
