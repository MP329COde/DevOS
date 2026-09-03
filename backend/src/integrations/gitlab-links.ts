export function extractIssueIids(...references: readonly string[]): number[] {
  const found = new Set<number>();
  for (const reference of references) {
    for (const match of reference.matchAll(/(?:^|\s)#([1-9]\d*)\b/g)) found.add(Number(match[1]));
  }
  return [...found].sort((left, right) => left - right);
}