import { isEmail } from "class-validator";
import { observer } from "mobx-react";
import { v4 as uuidv4 } from "uuid";
import { PlusIcon } from "outline-icons";
import { useState, useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import type { MenuItem } from "@shared/editor/types";
import { MentionType } from "@shared/types";
import parseDocumentSlug from "@shared/utils/parseDocumentSlug";
import type { Props as SuggestionsMenuProps } from "./SuggestionsMenu";
import SuggestionsMenu from "./SuggestionsMenu";
import SuggestionsMenuItem from "./SuggestionsMenuItem";
import { useEditorHost } from "./EditorHostContext";

interface MentionItem extends MenuItem {
  attrs: {
    id: string;
    type: MentionType;
    modelId: string;
    label: string;
    actorId?: string;
  };
}

type Props = Omit<
  SuggestionsMenuProps<MentionItem>,
  "renderMenuItem" | "items" | "embeds"
>;

function MentionMenu({ search, isActive, ...rest }: Props) {
  const [loaded, setLoaded] = useState(false);
  const [adapterItems, setAdapterItems] = useState<MentionItem[]>([]);
  const { t } = useTranslation();
  const { hostAdapter } = useEditorHost();
  const documentId =
    typeof window !== "undefined"
      ? parseDocumentSlug(window.location.pathname)
      : undefined;
  const maxResultsInSection = search ? 25 : 5;
  const isAdapterMode = !!hostAdapter?.searchMentions;

  useEffect(() => {
    if (!isActive || !hostAdapter?.searchMentions) {
      setAdapterItems([]);
      setLoaded(true);
      return;
    }

    let cancelled = false;
    setLoaded(false);

    void hostAdapter
      .searchMentions({
        query: search,
        limit: maxResultsInSection,
        documentId: documentId ?? undefined,
      })
      .then((results) => {
        if (!cancelled) {
          setAdapterItems(results as MentionItem[]);
          setLoaded(true);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setAdapterItems([]);
          setLoaded(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [
    documentId,
    hostAdapter,
    isActive,
    maxResultsInSection,
    search,
  ]);

  // Computed in the render body so MobX observer can track store access
  // (e.g. searchSuppressed). Previously this lived inside a useEffect which
  // runs outside the reactive context and triggered MobX warnings.
  const items: MentionItem[] = adapterItems.concat([
    {
      name: "link",
      icon: <PlusIcon />,
      title: search?.trim(),
      subtitle: t("Create a new doc"),
      visible: !!search && !isEmail(search),
      priority: -1,
      appendSpace: true,
      attrs: {
        id: uuidv4(),
        type: MentionType.Document,
        modelId: uuidv4(),
        label: search,
      },
    } as MentionItem,
  ]);

  const handleSelect = useCallback(
    async (item: MentionItem) => {
      if (
        hostAdapter?.validateMentionNotification &&
        documentId &&
        (item.attrs.type === MentionType.User ||
          item.attrs.type === MentionType.Group)
      ) {
        const result = await hostAdapter.validateMentionNotification({
          documentId,
          mentionType: item.attrs.type,
          modelId: item.attrs.modelId,
          label: item.attrs.label,
        });

        if (result?.message) {
          toast.message(result.message, {
            icon: result.icon,
            duration: result.duration,
          });
        }

        return;
      }
    },
    [documentId, hostAdapter]
  );

  const renderMenuItem = useCallback(
    (item, _index, options) => (
      <SuggestionsMenuItem
        {...options}
        subtitle={item.subtitle}
        title={item.title}
        icon={item.icon}
      />
    ),
    []
  );

  // Prevent showing the menu until we have data otherwise it will be positioned
  // incorrectly due to the height being unknown.
  if (!loaded) {
    return null;
  }

  return (
    <SuggestionsMenu
      {...rest}
      isActive={isActive}
      filterable={false}
      search={search}
      onSelect={handleSelect}
      renderMenuItem={renderMenuItem}
      items={items}
    />
  );
}

export default observer(MentionMenu);
