export interface QueryItem {
  id: string;
  title: string;
  type: string;
  status: string;
  createdAt?: string | Date;
  dueAt?: string | Date | null;
}

export interface ItemQuery {
  type?: string;
  status?: string;
  groupBy?: 'status' | 'type';
  sort?: 'title' | 'createdAt' | 'dueAt';
  direction?: 'asc' | 'desc';
}

export interface ItemQueryResult {
  items: QueryItem[];
  groups: Record<string, QueryItem[]>;
}

export function queryItems(source: readonly QueryItem[], query: ItemQuery = {}): ItemQueryResult {
  const filtered = source.filter((item) => (!query.type || item.type === query.type) && (!query.status || item.status === query.status));
  const direction = query.direction === 'desc' ? -1 : 1;
  const items = [...filtered].sort((left, right) => compare(left, right, query.sort ?? 'createdAt') * direction);
  const groups = items.reduce<Record<string, QueryItem[]>>((result, item) => {
    const key = query.groupBy === 'type' ? item.type : query.groupBy === 'status' ? item.status : 'all';
    (result[key] ??= []).push(item);
    return result;
  }, {});
  return { items, groups };
}

function compare(left: QueryItem, right: QueryItem, field: ItemQuery['sort']): number {
  if (field === 'title') return left.title.localeCompare(right.title);
  const leftValue = sortableValue(left[field ?? 'createdAt']);
  const rightValue = sortableValue(right[field ?? 'createdAt']);
  return leftValue - rightValue;
}

function sortableValue(value: string | Date | null | undefined): number {
  if (value === null || value === undefined) return 0;
  return value instanceof Date ? value.getTime() : Date.parse(value) || Number(value) || 0;
}
