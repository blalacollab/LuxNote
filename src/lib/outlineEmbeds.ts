import { YouTubeEmbed } from '../components/YouTubeEmbed';
import { YOUTUBE_EMBED_PATTERN } from './youtubePlayback';

type OutlineEmbedDescriptor = {
  id: string;
  title: string;
  keywords?: string;
  visible?: boolean;
  disabled?: boolean;
  matcher: (url: string) => false | RegExpMatchArray;
  transformMatch?: (matches: RegExpMatchArray) => string;
  component?: unknown;
};

export { getYouTubeEmbedUrl } from './youtubePlayback';

export const outlineEmbeds: OutlineEmbedDescriptor[] = [
  {
    id: "youtube",
    title: "YouTube",
    keywords: "google video",
    visible: false,
    matcher(href: string) {
      return href.match(YOUTUBE_EMBED_PATTERN) ?? false;
    },
    component: YouTubeEmbed,
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
