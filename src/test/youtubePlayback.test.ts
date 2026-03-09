import { beforeEach, describe, expect, it } from 'vitest';

import {
  buildYouTubePlayerSrc,
  clearYouTubePlaybackProgress,
  getYouTubeEmbedUrl,
  loadYouTubePlaybackProgress,
  saveYouTubePlaybackProgress,
} from '../lib/youtubePlayback';

describe('youtube playback helpers', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('adds player api params and remembered progress to the embed url', () => {
    const src = buildYouTubePlayerSrc(
      'https://www.youtube.com/watch?v=xVAHry8vjA8&t=30s',
      84.9,
    );
    const url = new URL(src);

    expect(`${url.origin}${url.pathname}`).toBe(
      'https://www.youtube.com/embed/xVAHry8vjA8',
    );
    expect(url.searchParams.get('modestbranding')).toBe('1');
    expect(url.searchParams.get('enablejsapi')).toBe('1');
    expect(url.searchParams.get('playsinline')).toBe('1');
    expect(url.searchParams.get('start')).toBe('84');
    expect(url.searchParams.get('origin')).toBe(window.location.origin);
  });

  it('stores playback progress per note and href', () => {
    saveYouTubePlaybackProgress(
      'note-a',
      'https://www.youtube.com/watch?v=xVAHry8vjA8',
      42,
      180,
    );

    expect(
      loadYouTubePlaybackProgress(
        'note-a',
        'https://www.youtube.com/watch?v=xVAHry8vjA8',
      ),
    ).toBe(42);
    expect(
      loadYouTubePlaybackProgress(
        'note-b',
        'https://www.youtube.com/watch?v=xVAHry8vjA8',
      ),
    ).toBeNull();
  });

  it('clears progress for barely started or completed videos', () => {
    saveYouTubePlaybackProgress(
      'note-a',
      'https://www.youtube.com/watch?v=xVAHry8vjA8',
      2,
      180,
    );
    expect(
      loadYouTubePlaybackProgress(
        'note-a',
        'https://www.youtube.com/watch?v=xVAHry8vjA8',
      ),
    ).toBeNull();

    saveYouTubePlaybackProgress(
      'note-a',
      'https://www.youtube.com/watch?v=xVAHry8vjA8',
      177,
      180,
    );
    expect(
      loadYouTubePlaybackProgress(
        'note-a',
        'https://www.youtube.com/watch?v=xVAHry8vjA8',
      ),
    ).toBeNull();
  });

  it('can clear a previously saved progress entry explicitly', () => {
    saveYouTubePlaybackProgress(
      'note-a',
      'https://www.youtube.com/watch?v=xVAHry8vjA8',
      42,
      180,
    );
    clearYouTubePlaybackProgress(
      'note-a',
      'https://www.youtube.com/watch?v=xVAHry8vjA8',
    );

    expect(
      loadYouTubePlaybackProgress(
        'note-a',
        'https://www.youtube.com/watch?v=xVAHry8vjA8',
      ),
    ).toBeNull();
  });

  it('keeps the embed url helper behavior intact', () => {
    expect(
      getYouTubeEmbedUrl('https://www.youtube.com/watch?v=xVAHry8vjA8&t=1m5s'),
    ).toBe('https://www.youtube.com/embed/xVAHry8vjA8?modestbranding=1&start=65');
  });
});
