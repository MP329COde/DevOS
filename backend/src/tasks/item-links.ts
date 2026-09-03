export const linkTypes = ['relates_to', 'blocks', 'is_blocked_by'] as const;
export type LinkType = (typeof linkTypes)[number];

export interface ItemLink {
  sourceId: string;
  targetId: string;
  type: LinkType;
}

export function createItemLink(sourceId: string, targetId: string, type: LinkType): ItemLink {
  if (!sourceId || !targetId || sourceId === targetId) throw new Error('Item links require two different items');
  return { sourceId, targetId, type };
}

export function inverseLink(link: ItemLink): ItemLink {
  const type = link.type === 'blocks' ? 'is_blocked_by' : link.type === 'is_blocked_by' ? 'blocks' : 'relates_to';
  return { sourceId: link.targetId, targetId: link.sourceId, type };
}