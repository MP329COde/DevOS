export interface ParsedLabel {
  prefix: string;
  value: string;
}

export function parseLabel(input: string): ParsedLabel {
  const match = input.trim().match(/^([^:\s]+)::([^:\s].*)$/);
  if (!match) throw new Error('Label must use the prefix::value format');
  return { prefix: match[1].toLowerCase(), value: match[2].trim() };
}

export function formatLabel(label: ParsedLabel): string {
  return `${label.prefix}::${label.value}`;
}