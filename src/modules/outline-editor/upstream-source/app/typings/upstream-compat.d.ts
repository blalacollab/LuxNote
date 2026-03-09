declare module "lodash/filter" {
  import filter from "lodash/filter.js";
  export default filter;
}

declare module "lodash/find" {
  import find from "lodash/find.js";
  export default find;
}

declare module "lodash/map" {
  import map from "lodash/map.js";
  export default map;
}

declare module "lodash/isNull" {
  import isNull from "lodash/isNull.js";
  export default isNull;
}

declare module "lodash/intersection" {
  import intersection from "lodash/intersection.js";
  export default intersection;
}

declare module "lodash/deburr" {
  import deburr from "lodash/deburr.js";
  export default deburr;
}

declare module "lodash/isEqual" {
  import isEqual from "lodash/isEqual.js";
  export default isEqual;
}

declare module "lodash/capitalize" {
  import capitalize from "lodash/capitalize.js";
  export default capitalize;
}

declare module "lodash/sortBy" {
  import sortBy from "lodash/sortBy.js";
  export default sortBy;
}

declare module "lodash/orderBy" {
  import orderBy from "lodash/orderBy.js";
  export default orderBy;
}

declare module "lodash/escapeRegExp" {
  import escapeRegExp from "lodash/escapeRegExp.js";
  export default escapeRegExp;
}

declare module "lodash/some" {
  import some from "lodash/some.js";
  export default some;
}

declare module "markdown-it-container" {
  import type MarkdownIt from "markdown-it";

  const markdownItContainer: (
    md: MarkdownIt,
    name: string,
    options?: Record<string, unknown>,
  ) => void;

  export default markdownItContainer;
}

declare module "markdown-it-emoji" {
  export const full: (md: unknown, options?: Record<string, unknown>) => void;
}

declare module "crypto-js/md5" {
  import md5 from "crypto-js/md5.js";
  export default md5;
}

declare module "fuzzy-search" {
  export default class FuzzySearch<T> {
    constructor(
      haystack: T[],
      keys?: string[],
      options?: Record<string, unknown>,
    );
    search(query: string): T[];
  }
}

declare module "natural-sort" {
  type NaturalSortComparator = (a: string, b: string) => number;
  type NaturalSortOptions = {
    caseSensitive?: boolean;
    direction?: "asc" | "desc";
  };
  const naturalSort: {
    (): NaturalSortComparator;
    (options: NaturalSortOptions): NaturalSortComparator;
  };
  export default naturalSort;
}

declare module "slug" {
  const slug: (value: string, options?: Record<string, unknown>) => string;
  export default slug;
}

declare module "plugins/notion/shared/types" {
  export type NotionPropertyType = string;
}

declare module "markdown-it" {
  export interface Options {
    breaks?: boolean;
    html?: boolean;
    linkify?: boolean;
    [key: string]: unknown;
  }

  export class Token {
    constructor(type: string, tag: string, nesting: number);
    type: string;
    tag: string;
    nesting: number;
    content: string;
    markup: string;
    info: string;
    level: number;
    map?: [number, number];
    children?: Token[];
    attrs?: [string, string][];
    attrGet(name: string): string | null;
    attrSet(name: string, value: string): void;
  }

  export interface StateInline {
    pos: number;
    src: string;
    tokens: Token[];
    delimiters: StateInline.Delimiter[];
    Token: typeof Token;
    push(type: string, tag: string, nesting: number): Token;
    scanDelims(
      pos: number,
      canSplitWord: boolean,
    ): { length: number; can_open: boolean; can_close: boolean };
    [key: string]: any;
  }

  export namespace StateInline {
    interface Delimiter {
      marker: number;
      length: number;
      token: number;
      end: number;
      open: boolean;
      close: boolean;
      jump?: number;
      [key: string]: any;
    }
  }

  export interface StateBlock {
    [key: string]: any;
  }

  export interface StateCore {
    tokens: Token[];
    env: Record<string, any>;
    Token: typeof Token;
    [key: string]: any;
  }

  export class MarkdownIt {
    constructor(presetName?: string, options?: Options);
    core: any;
    block: any;
    inline: any;
    renderer: any;
    utils: any;
    options: Options;
    disable(ruleName: string): this;
    use(plugin: PluginSimple, ...params: any[]): this;
  }

  export type PluginSimple = (
    md: MarkdownIt,
    options?: Record<string, unknown>,
  ) => void;

  export default MarkdownIt;
}

declare module "lodash" {
  export function isArray(value: unknown): value is unknown[];
  export function map<T, U>(
    collection: T[] | Record<string, T> | null | undefined,
    iteratee: (value: T, index: number | string) => U,
  ): U[];
}

declare module "react-portal" {
  import type { ComponentType } from "react";

  export const Portal: ComponentType<any>;
}

declare module "~/components/Avatar" {
  import type { ComponentType } from "react";

  export const AvatarSize: {
    Small: string;
    Toast: string;
  };
  export const Avatar: ComponentType<any>;
  export const GroupAvatar: ComponentType<any>;
}

declare module "~/components/Button" {
  import type { ComponentType } from "react";

  const Button: ComponentType<any>;
  export default Button;
}

declare module "~/components/DocumentBreadcrumb" {
  import type { ComponentType } from "react";

  const DocumentBreadcrumb: ComponentType<any>;
  export default DocumentBreadcrumb;
}

declare module "~/components/Emoji" {
  import type { ComponentType } from "react";

  const Emoji: ComponentType<any>;
  export { Emoji };
}

declare module "~/components/Flex" {
  import type { ComponentType } from "react";

  const Flex: ComponentType<any>;
  export default Flex;
}

declare module "~/components/Header" {
  export const HEADER_HEIGHT: number;
}

declare module "~/components/HoverPreview" {
  import type { ComponentType } from "react";

  const HoverPreview: ComponentType<any>;
  export default HoverPreview;
}

declare module "~/components/Input" {
  import type { ComponentType } from "react";

  const Input: ComponentType<any>;
  export const NativeInput: any;
  export const Outline: any;
  export default Input;
}

declare module "~/components/Lightbox" {
  import type { ComponentType } from "react";

  const Lightbox: ComponentType<any>;
  export default Lightbox;
}

declare module "~/components/Menu/transformer" {
  export function toMenuItems(items: any[]): any;
}

declare module "~/components/MouseSafeArea" {
  import type { ComponentType } from "react";

  export const MouseSafeArea: ComponentType<any>;
}

declare module "~/components/NudeButton" {
  import type { ComponentType } from "react";

  const NudeButton: ComponentType<any>;
  export default NudeButton;
}

declare module "~/components/Portal" {
  import type { ComponentType, Context } from "react";

  export const PortalContext: Context<HTMLElement | null>;
  export const Portal: ComponentType<any>;
  export function usePortalContext(): HTMLElement | null;
}

declare module "~/components/ResizingHeightContainer" {
  import type { ComponentType } from "react";

  export const ResizingHeightContainer: ComponentType<any>;
}

declare module "~/components/Scrollable" {
  import type { ComponentType } from "react";

  const Scrollable: ComponentType<any>;
  export default Scrollable;
}

declare module "~/components/Tooltip" {
  import type { ComponentType, ReactNode } from "react";

  export type Props = {
    children?: ReactNode;
    content?: ReactNode;
    shortcut?: ReactNode;
    disabled?: boolean;
    side?: string;
    sideOffset?: number;
    delayDuration?: number;
    shortcutOnNewline?: boolean;
    [key: string]: unknown;
  };
  const Tooltip: ComponentType<any>;
  export default Tooltip;
}

declare module "~/components/TooltipContext" {
  import type { ComponentType } from "react";

  export const TooltipProvider: ComponentType<any>;
}

declare module "~/components/Icons/ArrowIcon" {
  import type { ComponentType } from "react";

  export const ArrowDownIcon: ComponentType<any>;
  export const ArrowLeftIcon: ComponentType<any>;
  export const ArrowRightIcon: ComponentType<any>;
  export const ArrowUpIcon: ComponentType<any>;
}

declare module "~/components/Icons/CircleIcon" {
  import type { ComponentType } from "react";

  const CircleIcon: ComponentType<any>;
  export default CircleIcon;
}

declare module "~/components/Icons/DottedCircleIcon" {
  import type { ComponentType } from "react";

  export const DottedCircleIcon: ComponentType<any>;
}

declare module "~/components/primitives/Drawer" {
  import type { ComponentType } from "react";

  export const Drawer: ComponentType<any>;
  export const DrawerContent: ComponentType<any>;
  export const DrawerTitle: ComponentType<any>;
}

declare module "~/components/primitives/HStack" {
  import type { ComponentType } from "react";

  export const HStack: ComponentType<any>;
}

declare module "~/components/primitives/Menu" {
  import type { ComponentType } from "react";

  export const Menu: ComponentType<any>;
  export const MenuContent: ComponentType<any>;
  export const MenuTrigger: ComponentType<any>;
}

declare module "~/components/primitives/Menu/MenuContext" {
  import type { ComponentType } from "react";

  export const MenuProvider: ComponentType<any>;
}

declare module "~/components/primitives/Popover" {
  import type { ComponentType } from "react";

  export const Popover: ComponentType<any>;
  export const PopoverAnchor: ComponentType<any>;
  export const PopoverContent: ComponentType<any>;
  export const PopoverTrigger: ComponentType<any>;
}

declare module "~/components/primitives/components/Menu" {
  import type { ComponentType } from "react";

  export const MenuButton: ComponentType<any>;
  export const MenuDisclosure: ComponentType<any>;
  export const MenuHeader: ComponentType<any>;
  export const MenuIconWrapper: ComponentType<any>;
  export const MenuLabel: ComponentType<any>;
}

declare module "~/env" {
  const env: Record<string, unknown>;
  export default env;
}

declare module "~/hooks/useBoolean" {
  export default function useBoolean(
    initialValue?: boolean,
  ): [boolean, () => void, () => void];
}

declare module "~/hooks/useDictionary" {
  export type Dictionary = Record<string, any>;

  export default function useDictionary(): Dictionary;
}

declare module "~/hooks/useEventListener" {
  export default function useEventListener(
    eventName: string,
    handler: (...args: any[]) => void,
    ...args: any[]
  ): void;
}

declare module "~/hooks/useKeyDown" {
  export default function useKeyDown(
    predicate: (event: KeyboardEvent) => boolean,
    handler: (event: KeyboardEvent) => void,
    options?: Record<string, unknown>,
  ): void;
}

declare module "~/hooks/useMobile" {
  export default function useMobile(): boolean;
}

declare module "~/hooks/useOnClickOutside" {
  export default function useOnClickOutside(
    ref: { current: unknown },
    handler: (event: any) => void,
  ): void;
}

declare module "~/hooks/useStores" {
  export default function useStores(): Record<string, any>;
}

declare module "~/hooks/useWindowSize" {
  export default function useWindowSize(): {
    width: number;
    height: number;
  };
}

declare module "~/models/Document" {
  class Document {}
  export default Document;
}

declare module "~/stores" {
  const stores: Record<string, any>;
  export default stores;
}

declare module "~/types" {
  export type MenuItem = any;
  export type Properties<T> = Partial<T> & Record<string, unknown>;
}

declare module "~/utils/ApiClient" {
  export const client: Record<string, any>;
}

declare module "~/utils/Desktop" {
  const Desktop: {
    bridge?: Record<string, any>;
    isElectron(): boolean;
  };
  export default Desktop;
}

declare module "~/utils/Logger" {
  const Logger: {
    debug(...args: any[]): void;
    error(...args: any[]): void;
    info(...args: any[]): void;
    warn(...args: any[]): void;
  };
  export default Logger;
}

declare module "~/actions/sections" {
  export const openDocument: (...args: any[]) => any;
  export const openCollection: (...args: any[]) => any;
  export const openUser: (...args: any[]) => any;
}
