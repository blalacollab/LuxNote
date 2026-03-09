import { describe, expect, it } from 'vitest';

import { isInternalUrl } from '../modules/outline-editor/upstream-source/shared/utils/urls';

describe('editor url helpers', () => {
  it('does not throw when env.URL is missing', () => {
    expect(() => isInternalUrl('https://example.com')).not.toThrow();
    expect(isInternalUrl('https://example.com')).toBe(false);
  });

  it('treats relative paths as internal', () => {
    expect(isInternalUrl('/doc/123')).toBe(true);
  });
});
