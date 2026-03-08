import { isEmail } from "class-validator";
import { runInAction } from "mobx";
import { CollectionIcon, DocumentIcon, PlusIcon } from "outline-icons";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { v4 as uuidv4 } from "uuid";
import Icon from "@shared/components/Icon";
import type {
  EditorDataAdapter,
  EditorMentionMenuItem,
} from "@shared/editor/types/EditorDataAdapter";
import { MentionType } from "@shared/types";
import parseCollectionSlug from "@shared/utils/parseCollectionSlug";
import parseDocumentSlug from "@shared/utils/parseDocumentSlug";
import { isCollectionUrl, isDocumentUrl } from "@shared/utils/urls";
import { Avatar, AvatarSize, GroupAvatar } from "~/components/Avatar";
import DocumentBreadcrumb from "~/components/DocumentBreadcrumb";
import Flex from "~/components/Flex";
import {
  CollectionsSection,
  DocumentsSection,
  GroupSection,
  UserSection,
} from "~/actions/sections";
import useStores from "~/hooks/useStores";
import { client } from "~/utils/ApiClient";

type Props = {
  documentId?: string;
};

export default function useOutlineEditorDataAdapter({
  documentId,
}: Props = {}): EditorDataAdapter {
  const { t } = useTranslation();
  const { auth, documents, users, collections, groups } = useStores();
  const actorId = auth.currentUserId ?? undefined;

  return useMemo<EditorDataAdapter>(
    () => ({
      searchMentions: async ({ query, limit }) => {
        const res = await client.post("/suggestions.mention", { query, limit });

        runInAction(() => {
          res.data.documents.map(documents.add);
          res.data.users.map(users.add);
          res.data.collections.map(collections.add);
          res.data.groups.map(groups.add);
        });

        if (!actorId) {
          return [];
        }

        const items: EditorMentionMenuItem[] = users
          .findByQuery(query, { maxResults: limit })
          .map(
            (user) =>
              ({
                name: "mention",
                icon: (
                  <Flex
                    align="center"
                    justify="center"
                    style={{ width: 24, height: 24 }}
                  >
                    <Avatar
                      model={user}
                      alt={t("Profile picture")}
                      size={AvatarSize.Small}
                    />
                  </Flex>
                ),
                title: user.name,
                section: UserSection,
                appendSpace: true,
                attrs: {
                  id: uuidv4(),
                  type: MentionType.User,
                  modelId: user.id,
                  actorId,
                  label: user.name,
                },
              }) as EditorMentionMenuItem
          )
          .concat(
            groups.findByQuery(query, { maxResults: limit }).map((group) => ({
              name: "mention",
              icon: (
                <Flex
                  align="center"
                  justify="center"
                  style={{ width: 24, height: 24, marginRight: 4 }}
                >
                  <GroupAvatar group={group} size={AvatarSize.Small} />
                </Flex>
              ),
              title: group.name,
              subtitle: t("{{ count }} members", {
                count: group.memberCount,
              }),
              section: GroupSection,
              appendSpace: true,
              attrs: {
                id: uuidv4(),
                type: MentionType.Group,
                modelId: group.id,
                actorId,
                label: group.name,
              },
            }))
          )
          .concat(
            documents.findByQuery(query, { maxResults: limit }).map((doc) => ({
              name: "mention",
              icon: doc.icon ? (
                <Icon
                  value={doc.icon}
                  initial={doc.initial}
                  color={doc.color ?? undefined}
                />
              ) : (
                <DocumentIcon />
              ),
              title: doc.title,
              subtitle: doc.collectionId ? (
                <DocumentBreadcrumb document={doc} onlyText reverse maxDepth={2} />
              ) : undefined,
              section: DocumentsSection,
              appendSpace: true,
              attrs: {
                id: uuidv4(),
                type: MentionType.Document,
                modelId: doc.id,
                actorId,
                label: doc.title,
              },
            }))
          )
          .concat(
            collections.findByQuery(query, { maxResults: limit }).map(
              (collection) =>
                ({
                  name: "mention",
                  icon: collection.icon ? (
                    <Icon
                      value={collection.icon}
                      initial={collection.initial}
                      color={collection.color ?? undefined}
                    />
                  ) : (
                    <CollectionIcon />
                  ),
                  title: collection.name,
                  section: CollectionsSection,
                  appendSpace: true,
                  attrs: {
                    id: uuidv4(),
                    type: MentionType.Collection,
                    modelId: collection.id,
                    actorId,
                    label: collection.name,
                  },
                }) as EditorMentionMenuItem
            )
          )
          .concat([
            {
              name: "link",
              icon: <PlusIcon />,
              title: query?.trim(),
              section: DocumentsSection,
              subtitle: t("Create a new doc"),
              visible: !!query && !isEmail(query),
              priority: -1,
              appendSpace: true,
              attrs: {
                id: uuidv4(),
                type: MentionType.Document,
                modelId: uuidv4(),
                actorId,
                label: query,
              },
            } as EditorMentionMenuItem,
          ]);

        return items;
      },
      searchDocuments: async ({ query, limit }) => {
        const res = await client.post("/suggestions.mention", { query, limit });

        runInAction(() => {
          res.data.documents.map(documents.add);
        });

        return documents.findByQuery(query, { maxResults: limit }).map((doc) => ({
          id: doc.id,
          title: doc.title,
          path: doc.path,
          url: doc.url,
          icon: doc.icon,
          initial: doc.initial,
          color: doc.color,
          subtitle: doc.collectionId ? (
            <DocumentBreadcrumb document={doc} onlyText reverse maxDepth={2} />
          ) : undefined,
        }));
      },
      resolveInternalLink: async ({ url }) => {
        if (isDocumentUrl(url)) {
          const slug = parseDocumentSlug(url);
          if (!slug) {
            return undefined;
          }

          const document = await documents.fetch(slug);
          if (!document) {
            return undefined;
          }

          const { hash } = new URL(url);

          return {
            mentionType: MentionType.Document,
            modelId: document.id,
            label: document.titleWithDefault,
            path: document.path,
            hash,
            icon: document.icon,
            color: document.color,
          };
        }

        if (isCollectionUrl(url)) {
          const slug = parseCollectionSlug(url);
          if (!slug) {
            return undefined;
          }

          const collection = await collections.fetch(slug);
          if (!collection) {
            return undefined;
          }

          const { hash } = new URL(url);

          return {
            mentionType: MentionType.Collection,
            modelId: collection.id,
            label: collection.name,
            path: collection.path,
            hash,
            icon: collection.icon,
            color: collection.color,
          };
        }

        return undefined;
      },
      checkEmbed: async ({ url }) => {
        const res = await client.post<{ embeddable: boolean; reason?: string }>(
          "/urls.checkEmbed",
          {
            url,
          }
        );

        return res as { embeddable: boolean; reason?: string };
      },
      validateMentionNotification: async ({
        mentionType,
        modelId,
        label,
        documentId: docId,
      }) => {
        const targetDocumentId = docId || documentId;
        if (!targetDocumentId) {
          return undefined;
        }

        if (mentionType === MentionType.User) {
          const res = await client.post("/documents.users", {
            id: targetDocumentId,
            userId: modelId,
          });

          if (!res.data.length) {
            const user = users.get(modelId);
            return {
              notify: false,
              message: t(
                "{{ userName }} won't be notified, as they do not have access to this document",
                {
                  userName: label,
                }
              ),
              icon: user ? <Avatar model={user} size={AvatarSize.Toast} /> : null,
              duration: 10000,
            };
          }
        } else if (mentionType === MentionType.Group) {
          const group = groups.get(modelId);
          return {
            notify: true,
            message: t(
              `Members of "{{ groupName }}" that have access to this document will be notified`,
              {
                groupName: label,
              }
            ),
            icon: group ? <GroupAvatar group={group} /> : undefined,
            duration: 10000,
          };
        }

        return undefined;
      },
    }),
    [
      actorId,
      collections,
      documentId,
      documents,
      groups,
      t,
      users,
    ]
  );
}
