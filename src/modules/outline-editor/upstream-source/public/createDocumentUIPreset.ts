import type Extension from "../shared/editor/lib/Extension";
import DiagramsExtension from "../shared/editor/extensions/Diagrams";
import type Mark from "../shared/editor/marks/Mark";
import { richExtensions, withComments } from "../shared/editor/nodes";
import type Node from "../shared/editor/nodes/Node";
import BlockMenuExtension from "../app/editor/extensions/BlockMenu";
import ClipboardTextSerializer from "../app/editor/extensions/ClipboardTextSerializer";
import EmojiMenuExtension from "../app/editor/extensions/EmojiMenu";
import FindAndReplaceExtension from "../app/editor/extensions/FindAndReplace";
import Keys from "../app/editor/extensions/Keys";
import MentionMenuExtension from "../app/editor/extensions/MentionMenu";
import PasteHandler from "../app/editor/extensions/PasteHandler";
import PreventTab from "../app/editor/extensions/PreventTab";
import SelectionToolbarExtension from "../app/editor/extensions/SelectionToolbar";
import SmartText from "../app/editor/extensions/SmartText";

type EditorExtension = typeof Node | typeof Mark | typeof Extension;

export type DocumentUIPresetOptions = {
  enableFindAndReplace?: boolean;
  enableDiagrams?: boolean;
};

export function createDocumentUIPreset(
  options: DocumentUIPresetOptions = {}
): EditorExtension[] {
  const {
    enableFindAndReplace = true,
    enableDiagrams = true,
  } = options;

  const extensions: EditorExtension[] = [
    ...withComments(richExtensions),
    SmartText,
    PasteHandler,
    ClipboardTextSerializer,
    BlockMenuExtension,
    EmojiMenuExtension,
    MentionMenuExtension,
    SelectionToolbarExtension,
    PreventTab,
    Keys,
  ];

  if (enableFindAndReplace) {
    extensions.push(FindAndReplaceExtension);
  }

  if (enableDiagrams) {
    extensions.push(DiagramsExtension);
  }

  return extensions;
}
