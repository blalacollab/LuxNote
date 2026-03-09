import type { Token } from "markdown-it";
import { wrappingInputRule } from "prosemirror-inputrules";
import type {
  NodeSpec,
  Node as ProsemirrorNode,
  NodeType,
} from "prosemirror-model";
import type { Command, EditorState, Transaction } from "prosemirror-state";
import type { Primitive } from "utility-types";
import toggleWrap from "../commands/toggleWrap";
import type { MarkdownSerializerState } from "../lib/markdown/serializer";
import noticesRule from "../rules/notices";
import Node from "./Node";

export enum NoticeTypes {
  Info = "info",
  Success = "success",
  Tip = "tip",
  Warning = "warning",
}

const SVG_NAMESPACE = "http://www.w3.org/2000/svg";

interface NoticeIconShape {
  clipRule?: string;
  d: string;
  fillRule?: string;
}

function getNoticeIconShape(style: NoticeTypes | undefined): NoticeIconShape {
  switch (style) {
    case NoticeTypes.Tip:
      return {
        d: "M12,16.1500001 L8.79729751,17.8337604 L8.79729751,17.8337604 C8.30845292,18.0907612 7.70382577,17.9028147 7.44682496,17.4139701 C7.34448589,17.2193097 7.30917121,16.9963416 7.34634806,16.779584 L7.95800981,13.2133223 L5.36696906,10.6876818 L5.36696906,10.6876818 C4.97148548,10.3021806 4.96339318,9.66906733 5.34889439,9.27358375 C5.50240299,9.11610012 5.70354541,9.01361294 5.92118244,8.98198843 L9.50191268,8.46167787 L11.1032639,5.21698585 L11.1032639,5.21698585 C11.3476862,4.72173219 11.9473121,4.51839319 12.4425657,4.76281548 C12.6397783,4.86014572 12.7994058,5.01977324 12.8967361,5.21698585 L14.4980873,8.46167787 L18.0788176,8.98198843 L18.0788176,8.98198843 C18.6253624,9.06140605 19.0040439,9.5688489 18.9246263,10.1153938 C18.8930018,10.3330308 18.7905146,10.5341732 18.6330309,10.6876818 L16.0419902,13.2133223 L16.6536519,16.779584 L16.6536519,16.779584 C16.747013,17.3239204 16.3814251,17.8408763 15.8370887,17.9342373 C15.620331,17.9714142 15.397363,17.9360995 15.2027025,17.8337604 L12,16.1500001 Z",
      };
    case NoticeTypes.Warning:
      return {
        clipRule: "evenodd",
        d: "M12 20C7.58172 20 4 16.4183 4 12C4 7.58172 7.58172 4 12 4C16.4183 4 20 7.58172 20 12C20 16.4183 16.4183 20 12 20ZM12 15C12.5523 15 13 15.4477 13 16C13 16.5523 12.5523 17 12 17C11.4477 17 11 16.5523 11 16C11 15.4477 11.4477 15 12 15ZM12 14C13 14 13 13 13 13L13 10.5L13 8C13 8 13 7 12 7C11 7 11 8 11 8L11 13C11 13 11 14 12 14Z",
        fillRule: "evenodd",
      };
    case NoticeTypes.Success:
      return {
        clipRule: "evenodd",
        d: "M12 20C16.4183 20 20 16.4183 20 12C20 7.58172 16.4183 4 12 4C7.58172 4 4 7.58172 4 12C4 16.4183 7.58172 20 12 20ZM9.26825 11.3599L10.9587 13.3885L14.7 8.40006C15.0314 7.95823 15.6582 7.86869 16.1 8.20006C16.5419 8.53143 16.6314 9.15823 16.3 9.60006L11.8 15.6001C11.4128 16.1164 10.645 16.1361 10.2318 15.6402L7.7318 12.6402C7.37824 12.216 7.43556 11.5854 7.85984 11.2318C8.28412 10.8783 8.91468 10.9356 9.26825 11.3599Z",
        fillRule: "evenodd",
      };
    default:
      return {
        d: "M20 12C20 7.58172 16.4183 4 12 4C7.58172 4 4 7.58172 4 12C4 16.4183 7.58172 20 12 20C16.4183 20 20 16.4183 20 12ZM11 8C11 8.55228 11.4477 9 12 9C12.5523 9 13 8.55228 13 8C13 7.44772 12.5523 7 12 7C11.4477 7 11 7.44772 11 8ZM12 10C13 10 13 11 13 11V16C13 16 13 17 12 17C11 17 11 16 11 16V11C11 11 11 11 10.5 11C10 11 10 10 10 10H12Z",
        fillRule: "evenodd",
      };
  }
}

function createNoticeIcon(style: NoticeTypes | undefined) {
  if (typeof document === "undefined") {
    return null;
  }

  const shape = getNoticeIconShape(style);
  const icon = document.createElement("div");
  const svg = document.createElementNS(SVG_NAMESPACE, "svg");
  const path = document.createElementNS(SVG_NAMESPACE, "path");

  icon.className = "icon";
  icon.setAttribute("aria-hidden", "true");

  svg.setAttribute("fill", "currentColor");
  svg.setAttribute("width", "24px");
  svg.setAttribute("height", "24px");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("xmlns", SVG_NAMESPACE);

  path.setAttribute("d", shape.d);

  if (shape.fillRule) {
    path.setAttribute("fill-rule", shape.fillRule);
  }

  if (shape.clipRule) {
    path.setAttribute("clip-rule", shape.clipRule);
  }

  svg.append(path);
  icon.append(svg);

  return icon;
}

export default class Notice extends Node {
  get name() {
    return "container_notice";
  }

  get rulePlugins() {
    return [noticesRule];
  }

  get schema(): NodeSpec {
    return {
      attrs: {
        style: {
          default: NoticeTypes.Info,
        },
      },
      content:
        "(list | blockquote | hr | paragraph | heading | code_block | code_fence | attachment)+",
      group: "block",
      defining: true,
      draggable: true,
      parseDOM: [
        {
          tag: "div.notice-block",
          preserveWhitespace: "full",
          contentElement: (node: HTMLDivElement) =>
            node.querySelector("div.content") || node,
          getAttrs: (dom: HTMLDivElement) => ({
            style: dom.className.includes(NoticeTypes.Tip)
              ? NoticeTypes.Tip
              : dom.className.includes(NoticeTypes.Warning)
                ? NoticeTypes.Warning
                : dom.className.includes(NoticeTypes.Success)
                  ? NoticeTypes.Success
                  : undefined,
          }),
        },
        // Quill editor parsing
        {
          tag: "div.ql-hint",
          preserveWhitespace: "full",
          getAttrs: (dom: HTMLDivElement) => ({
            style: dom.dataset.hint,
          }),
        },
        // GitBook parsing
        {
          tag: "div.alert.theme-admonition",
          preserveWhitespace: "full",
          getAttrs: (dom: HTMLDivElement) => ({
            style: dom.className.includes(NoticeTypes.Warning)
              ? NoticeTypes.Warning
              : dom.className.includes(NoticeTypes.Success)
                ? NoticeTypes.Success
                : undefined,
          }),
        },
        // Confluence parsing
        {
          tag: "div.confluence-information-macro",
          preserveWhitespace: "full",
          getAttrs: (dom: HTMLDivElement) => ({
            style: dom.className.includes("confluence-information-macro-tip")
              ? NoticeTypes.Success
              : dom.className.includes("confluence-information-macro-note")
                ? NoticeTypes.Tip
                : dom.className.includes("confluence-information-macro-warning")
                  ? NoticeTypes.Warning
                  : undefined,
          }),
        },
      ],
      toDOM: (node) => {
        const icon = createNoticeIcon(node.attrs.style);

        return [
          "div",
          { class: `notice-block ${node.attrs.style}` },
          ...(icon ? [icon] : []),
          ["div", { class: "content" }, 0],
        ];
      },
    };
  }

  commands({ type }: { type: NodeType }) {
    return {
      container_notice: (attrs: Record<string, Primitive>) =>
        toggleWrap(type, attrs),
      info: (): Command => (state, dispatch) =>
        this.handleStyleChange(state, dispatch, NoticeTypes.Info),
      warning: (): Command => (state, dispatch) =>
        this.handleStyleChange(state, dispatch, NoticeTypes.Warning),
      success: (): Command => (state, dispatch) =>
        this.handleStyleChange(state, dispatch, NoticeTypes.Success),
      tip: (): Command => (state, dispatch) =>
        this.handleStyleChange(state, dispatch, NoticeTypes.Tip),
    };
  }

  handleStyleChange = (
    state: EditorState,
    dispatch: ((tr: Transaction) => void) | undefined,
    style: NoticeTypes
  ): boolean => {
    const { tr, selection } = state;
    const { $from } = selection;
    const node = $from.node(-1);

    if (node?.type.name === this.name) {
      if (dispatch) {
        const transaction = tr.setNodeMarkup($from.before(-1), undefined, {
          ...node.attrs,
          style,
        });
        dispatch(transaction);
      }
      return true;
    }
    return false;
  };

  inputRules({ type }: { type: NodeType }) {
    return [wrappingInputRule(/^:::$/, type)];
  }

  toMarkdown(state: MarkdownSerializerState, node: ProsemirrorNode) {
    state.write("\n:::" + (node.attrs.style || "info") + "\n");
    state.renderContent(node);
    state.ensureNewLine();
    state.write(":::");
    state.closeBlock(node);
  }

  parseMarkdown() {
    return {
      block: "container_notice",
      getAttrs: (tok: Token) => ({ style: tok.info }),
    };
  }
}
