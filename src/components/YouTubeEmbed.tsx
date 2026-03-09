import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { OpenIcon } from 'outline-icons';
import type { EditorView } from 'prosemirror-view';

import { buildYouTubePlayerSrc, clearYouTubePlaybackProgress, loadYouTubeIframeApi, loadYouTubePlaybackProgress, saveYouTubePlaybackProgress, type YouTubePlayer } from '../lib/youtubePlayback';

type YouTubeEmbedProps = {
  attrs: {
    href: string;
  };
  style?: React.CSSProperties;
  isSelected?: boolean;
  view?: EditorView;
};

function readNoteId(view?: EditorView | null) {
  const root = view?.dom.closest('[data-note-editor-root="true"]');

  return root?.getAttribute('data-note-id') ?? null;
}

export function YouTubeEmbed({
  attrs,
  style,
  isSelected,
  view,
}: YouTubeEmbedProps) {
  const [noteId, setNoteId] = useState<string | null>(() => readNoteId(view));
  const [iframeElement, setIframeElement] = useState<HTMLIFrameElement | null>(
    null,
  );
  const playerRef = useRef<YouTubePlayer | null>(null);
  const autoSaveTimerRef = useRef<number | null>(null);
  const restoredProgressRef = useRef(false);
  const rememberedTime = useMemo(
    () => (noteId ? loadYouTubePlaybackProgress(noteId, attrs.href) : null),
    [attrs.href, noteId],
  );
  const src = useMemo(
    () => buildYouTubePlayerSrc(attrs.href, rememberedTime),
    [attrs.href, rememberedTime],
  );
  const wrapperStyle: React.CSSProperties = {
    ...style,
    position: 'relative',
    lineHeight: 0,
    maxWidth: '100%',
    borderRadius: 6,
    overflow: 'hidden',
    border: '1px solid rgba(160, 216, 228, 0.14)',
    background: 'rgba(8, 12, 17, 0.98)',
  };
  const iframeStyle: React.CSSProperties = {
    display: 'block',
    width: '100%',
    border: 0,
    background: '#000',
    height:
      style?.height !== undefined
        ? '100%'
        : 400,
    minHeight:
      style?.height === undefined
        ? 400
        : undefined,
  };

  const stopAutoSave = useCallback(() => {
    if (autoSaveTimerRef.current === null) {
      return;
    }

    window.clearInterval(autoSaveTimerRef.current);
    autoSaveTimerRef.current = null;
  }, []);

  const persistProgress = useCallback(() => {
    if (!noteId || !playerRef.current) {
      return;
    }

    try {
      saveYouTubePlaybackProgress(
        noteId,
        attrs.href,
        playerRef.current.getCurrentTime(),
        playerRef.current.getDuration(),
      );
    } catch {
      // Ignore transient player API failures.
    }
  }, [attrs.href, noteId]);

  const clearProgress = useCallback(() => {
    if (!noteId) {
      return;
    }

    clearYouTubePlaybackProgress(noteId, attrs.href);
  }, [attrs.href, noteId]);

  const startAutoSave = useCallback(() => {
    if (autoSaveTimerRef.current !== null) {
      return;
    }

    autoSaveTimerRef.current = window.setInterval(() => {
      persistProgress();
    }, 5000);
  }, [persistProgress]);

  useEffect(() => {
    setNoteId(readNoteId(view));
  }, [view]);

  const handleFrameRef = useCallback((node: HTMLIFrameElement | null) => {
    setIframeElement(node);
  }, []);

  useEffect(() => {
    restoredProgressRef.current = false;
  }, [attrs.href, noteId]);

  useEffect(() => {
    if (!noteId) {
      return;
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        persistProgress();
      }
    };

    window.addEventListener('pagehide', persistProgress);
    window.addEventListener('beforeunload', persistProgress);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('pagehide', persistProgress);
      window.removeEventListener('beforeunload', persistProgress);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [noteId, persistProgress]);

  useEffect(() => {
    if (!noteId || !iframeElement) {
      return;
    }

    let disposed = false;

    void loadYouTubeIframeApi()
      .then((youtubeApi) => {
        if (disposed || !iframeElement) {
          return;
        }

        const player = new youtubeApi.Player(iframeElement, {
          events: {
            onReady: (event) => {
              if (
                restoredProgressRef.current ||
                typeof rememberedTime !== 'number' ||
                rememberedTime <= 0
              ) {
                return;
              }

              restoredProgressRef.current = true;

              try {
                event.target.seekTo(Math.floor(rememberedTime), true);
              } catch {
                // Ignore seek failures and keep playback usable.
              }
            },
            onStateChange: (event) => {
              if (event.data === youtubeApi.PlayerState.PLAYING) {
                startAutoSave();
                return;
              }

              stopAutoSave();

              if (event.data === youtubeApi.PlayerState.ENDED) {
                clearProgress();
                return;
              }

              if (
                event.data === youtubeApi.PlayerState.PAUSED ||
                event.data === youtubeApi.PlayerState.BUFFERING ||
                event.data === youtubeApi.PlayerState.CUED
              ) {
                persistProgress();
              }
            },
          },
        });

        playerRef.current = player;
      })
      .catch(() => {
        // Leave the plain iframe in place if the player API cannot load.
      });

    return () => {
      disposed = true;
      persistProgress();
      stopAutoSave();
      playerRef.current?.destroy?.();
      playerRef.current = null;
    };
  }, [
    attrs.href,
    clearProgress,
    iframeElement,
    noteId,
    persistProgress,
    rememberedTime,
    src,
    startAutoSave,
    stopAutoSave,
  ]);

  return (
    <div
      style={wrapperStyle}
      className={isSelected ? 'ProseMirror-selectednode' : undefined}
    >
      <iframe
        ref={handleFrameRef}
        src={src}
        style={iframeStyle}
        title="YouTube"
        loading="lazy"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
        sandbox="allow-same-origin allow-scripts allow-popups allow-popups-to-escape-sandbox allow-forms allow-downloads allow-storage-access-by-user-activation"
        allow="fullscreen; encrypted-media; picture-in-picture; clipboard-read; clipboard-write"
      />
      <a
        href={attrs.href}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          position: 'absolute',
          right: 10,
          top: 10,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '6px 10px',
          borderRadius: 999,
          background: 'rgba(8, 12, 17, 0.78)',
          border: '1px solid rgba(160, 216, 228, 0.14)',
          color: '#effaff',
          fontSize: 12,
          fontWeight: 500,
          textDecoration: 'none',
          lineHeight: 1,
        }}
      >
        <OpenIcon size={14} />
        Open
      </a>
    </div>
  );
}
