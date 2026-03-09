import MarkdownIt from 'markdown-it';
import { describe, expect, it } from 'vitest';

import {
  createOutlineEmbedMarkdownRule,
  getYouTubeEmbedUrl,
  outlineEmbeds,
} from '../lib/outlineEmbeds';
import {
  getDataUrlContentType,
  inferContentType,
  isDirectVideoUrl,
  isPdfSource,
  isPersistedAssetUrl,
  isYouTubeUrl,
} from '../modules/outline-editor/upstream-source/shared/editor/lib/media';
import { sanitizeUrl } from '../modules/outline-editor/upstream-source/shared/utils/urls';

describe('editor media helpers', () => {
  it('keeps persisted asset URLs intact when sanitizing', () => {
    expect(sanitizeUrl('data:application/pdf;base64,AAA=')).toBe(
      'data:application/pdf;base64,AAA=',
    );
    expect(sanitizeUrl('blob:https://example.com/asset-id')).toBe(
      'blob:https://example.com/asset-id',
    );
  });

  it('infers attachment content types from data URLs and filenames', () => {
    expect(getDataUrlContentType('data:application/pdf;base64,AAA=')).toBe(
      'application/pdf',
    );
    expect(inferContentType('https://cdn.example.com/file.pdf')).toBe(
      'application/pdf',
    );
    expect(inferContentType('', 'clip.webm')).toBe('video/webm');
    expect(isPdfSource('data:application/pdf;base64,AAA=')).toBe(true);
    expect(isPersistedAssetUrl('data:text/plain;base64,QQ==')).toBe(true);
  });

  it('recognizes direct video URLs', () => {
    expect(isDirectVideoUrl('https://cdn.example.com/video.mp4')).toBe(true);
    expect(isDirectVideoUrl('data:video/mp4;base64,AAA=')).toBe(true);
    expect(isDirectVideoUrl('https://example.com/watch?v=123')).toBe(false);
    expect(isYouTubeUrl('https://www.youtube.com/watch?v=xVAHry8vjA8')).toBe(true);
    expect(isYouTubeUrl('https://youtu.be/xVAHry8vjA8?t=5')).toBe(true);
  });

  it('converts YouTube links into embed URLs', () => {
    expect(
      getYouTubeEmbedUrl('https://www.youtube.com/watch?v=xVAHry8vjA8&t=1m5s'),
    ).toBe('https://www.youtube.com/embed/xVAHry8vjA8?modestbranding=1&start=65');
    expect(getYouTubeEmbedUrl('https://youtu.be/xVAHry8vjA8')).toBe(
      'https://www.youtube.com/embed/xVAHry8vjA8?modestbranding=1',
    );
  });

  it('parses persisted YouTube links back into embed tokens', () => {
    const markdown = new MarkdownIt('default', {
      breaks: false,
      html: false,
      linkify: false,
    });
    markdown.use(createOutlineEmbedMarkdownRule(outlineEmbeds) as any);
    const tokens = markdown.parse(
      '[https://www.youtube.com/watch?v=xVAHry8vjA8](https://www.youtube.com/watch?v=xVAHry8vjA8)',
      {},
    );

    expect(tokens).toHaveLength(1);
    expect(tokens[0]?.type).toBe('embed');
    expect(tokens[0]?.attrGet('href')).toBe(
      'https://www.youtube.com/watch?v=xVAHry8vjA8',
    );
  });
});
