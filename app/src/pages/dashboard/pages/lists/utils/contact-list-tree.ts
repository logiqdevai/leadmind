import type { ContactList } from "@/features/contact-lists/interfaces/contact-list.interface";

export function collectDescendantUuids(lists: ContactList[], rootUuid: string): Set<string> {
  const childrenByParent = new Map<string, string[]>();
  for (const list of lists) {
    if (!list.parent_list_uuid) continue;
    const siblings = childrenByParent.get(list.parent_list_uuid) ?? [];
    siblings.push(list.uuid);
    childrenByParent.set(list.parent_list_uuid, siblings);
  }

  const out = new Set<string>();
  const stack = [...(childrenByParent.get(rootUuid) ?? [])];
  while (stack.length > 0) {
    const id = stack.pop()!;
    if (out.has(id)) continue;
    out.add(id);
    stack.push(...(childrenByParent.get(id) ?? []));
  }
  return out;
}

export function listPathLabel(lists: ContactList[], uuid: string): string {
  const byId = new Map(lists.map((list) => [list.uuid, list]));
  const parts: string[] = [];
  const seen = new Set<string>();
  let cursor = byId.get(uuid);

  while (cursor && !seen.has(cursor.uuid)) {
    seen.add(cursor.uuid);
    parts.unshift(cursor.title);
    cursor = cursor.parent_list_uuid ? byId.get(cursor.parent_list_uuid) : undefined;
  }

  return parts.join(" / ");
}
