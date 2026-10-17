const TITLE_MAX = 60;
const PREVIEW_MAX = 80;

function collapseText(text: string): string {
  return text.trim().replace(/\s+/g, " ");
}

export function conversationTitleFromUserText(text: string): string {
  const collapsed = collapseText(text);
  if (collapsed.length <= TITLE_MAX) return collapsed;
  return collapsed.slice(0, TITLE_MAX);
}

export function conversationPreviewFromUserText(text: string): string {
  const collapsed = collapseText(text);
  if (collapsed.length <= PREVIEW_MAX) return collapsed;
  return `${collapsed.slice(0, PREVIEW_MAX)}…`;
}

export function mapConversationListItem(row: {
  id: string;
  title: string | null;
  updatedAt: Date;
  messages?: { content: string }[];
}): {
  id: string;
  title: string;
  updatedAt: string;
  preview: string;
} {
  const firstUserText = row.messages?.[0]?.content ?? "";
  const title =
    row.title?.trim() ||
    conversationTitleFromUserText(firstUserText) ||
    "New chat";
  return {
    id: row.id,
    title,
    updatedAt: row.updatedAt.toISOString(),
    preview: conversationPreviewFromUserText(firstUserText),
  };
}
