export interface TerraformResourceSummary {
  type: string;
  name: string;
  provider: string;
  instanceCount: number;
}

/**
 * Parses a Terraform/OpenTofu state file (terraform.tfstate JSON) into a
 * flat list of resource summaries usable by the Catalogue. Tolerates
 * individually malformed resource entries: a bad entry is skipped rather
 * than aborting the whole parse.
 */
export function parseTerraformState(raw: string): TerraformResourceSummary[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error(`terraform.tfstate is not valid JSON: ${error instanceof Error ? error.message : String(error)}`);
  }

  if (!parsed || typeof parsed !== 'object') return [];
  const resources = (parsed as Record<string, unknown>).resources;
  if (!Array.isArray(resources)) return [];

  const summaries: TerraformResourceSummary[] = [];
  for (const entry of resources) {
    const summary = toSummary(entry);
    if (summary) summaries.push(summary);
  }
  return summaries;
}

function toSummary(value: unknown): TerraformResourceSummary | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const entry = value as Record<string, unknown>;

  const type = entry.type;
  const name = entry.name;
  const provider = entry.provider;
  if (typeof type !== 'string' || typeof name !== 'string' || typeof provider !== 'string') return undefined;

  const instances = Array.isArray(entry.instances) ? entry.instances : [];

  return {
    type,
    name,
    provider,
    instanceCount: instances.length,
  };
}
