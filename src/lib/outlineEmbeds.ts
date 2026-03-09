const YOUTUBE_EMBED_PATTERN =
  /(?:https?:\/\/)?(?:www\.)?youtu\.?be(?:\.com)?\/?.*(?:watch|embed|shorts)?(?:.*v=|v\/|\/)([a-zA-Z0-9_-]{11})([\&\?](.*))?$/i;

type OutlineEmbedDescriptor = {
  id: string;
  title: string;
  keywords?: string;
  visible?: boolean;
  disabled?: boolean;
  matcher: (url: string) => false | RegExpMatchArray;
  transformMatch?: (matches: RegExpMatchArray) => string;
};

function withProtocol(value: string) {
  return /^https?:\/\//i.test(value) ? value : `https://${value}`;
}

function parseYouTubeTimestamp(value: string | null): number | null {
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

  const parts = normalized.match(
    /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s?)?$/,
  );

  if (!parts) {
    return null;
  }

  const hours = Number(parts[1] ?? 0);
  const minutes = Number(parts[2] ?? 0);
  const seconds = Number(parts[3] ?? 0);
  const total = hours * 3600 + minutes * 60 + seconds;

  return total > 0 ? total : null;
}

function extractYouTubeVideoId(href: string) {
  try {
    const url = new URL(withProtocol(href));
    const host = url.hostname.replace(/^www\./i, "");

    if (host === "youtu.be") {
      return url.pathname.split("/").filter(Boolean)[0] ?? null;
    }

    if (host === "youtube.com" || host.endsWith(".youtube.com")) {
      const directId = url.searchParams.get("v");

      if (directId) {
        return directId;
      }

      const segments = url.pathname.split("/").filter(Boolean);

      if (segments[0] === "embed" || segments[0] === "shorts") {
        return segments[1] ?? null;
      }
    }
  } catch (_error) {
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
      parseYouTubeTimestamp(searchParams.get("t")) ??
      parseYouTubeTimestamp(searchParams.get("start"));
    const clip = searchParams.get("clip") ?? searchParams.get("amp;clip");
    const clipt = searchParams.get("clipt") ?? searchParams.get("amp;clipt");
    const params = new URLSearchParams({ modestbranding: "1" });

    if (start !== null) {
      params.set("start", String(start));
    }

    if (clip) {
      params.set("clip", clip);
    }

    if (clipt) {
      params.set("clipt", clipt);
    }

    return `https://www.youtube.com/embed/${videoId}?${params.toString()}`;
  } catch (_error) {
    return `https://www.youtube.com/embed/${videoId}?modestbranding=1`;
  }
}

export const outlineEmbeds: OutlineEmbedDescriptor[] = [
  {
    id: "youtube",
    title: "YouTube",
    keywords: "google video",
    visible: false,
    matcher(href: string) {
      return href.match(YOUTUBE_EMBED_PATTERN) ?? false;
    },
    transformMatch(matches: RegExpMatchArray) {
      const input = matches.input ?? matches[0];
      return getYouTubeEmbedUrl(input);
    },
  },
];

function isParagraphToken(token: { type?: string } | undefined) {
  return token?.type === "paragraph_open";
}

function isLinkOpenToken(token: { type?: string } | undefined) {
  return token?.type === "link_open";
}

function isLinkCloseToken(token: { type?: string } | undefined) {
  return token?.type === "link_close";
}

export function createOutlineEmbedMarkdownRule(
  embeds: Array<{
    matchOnInput?: boolean;
    matcher: (href: string) => false | RegExpMatchArray;
  }>,
) {
  return function outlineEmbedMarkdownRule(md: {
    core: {
      ruler: {
        after: (
          afterRule: string,
          name: string,
          fn: (state: {
            tokens: Array<{
              type: string;
              content?: string;
              children?: Array<{
                type?: string;
                content?: string;
                attrs?: [string, string][];
              }>;
            }>;
            Token: new (type: string, tag: string, nesting: number) => {
              attrSet: (name: string, value: string) => void;
            };
          }) => boolean,
        ) => void;
      };
    };
  }) {
    md.core.ruler.after("inline", "embeds", (state) => {
      const tokens = state.tokens;
      let insideLink:
        | {
            attrs?: [string, string][];
          }
        | undefined;

      for (let i = 0; i < tokens.length - 1; i++) {
        if (!isParagraphToken(tokens[i - 1])) {
          continue;
        }

        const tokenChildren = tokens[i]?.children ?? [];

        for (let j = 0; j < tokenChildren.length - 1; j++) {
          const current = tokenChildren[j];

          if (!current) {
            continue;
          }

          if (isLinkOpenToken(current)) {
            insideLink = current;
            continue;
          }

          if (isLinkCloseToken(current)) {
            insideLink = undefined;
            continue;
          }

          if (!insideLink) {
            continue;
          }

          const href = insideLink.attrs?.[0]?.[1] ?? "";
          const simpleLink = href === current.content;

          if (!simpleLink) {
            continue;
          }

          const shouldConvert = embeds.some((embed) => {
            if (embed.matchOnInput === false) {
              return false;
            }

            return Boolean(embed.matcher(href));
          });

          if (!shouldConvert) {
            continue;
          }

          const token = new state.Token("embed", "iframe", 0);
          token.attrSet("href", current.content ?? "");
          tokens.splice(i - 1, 3, token as any);
          break;
        }
      }

      return false;
    });
  };
}
