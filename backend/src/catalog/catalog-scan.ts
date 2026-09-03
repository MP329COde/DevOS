import type { GitLabClient } from '../integrations/gitlab.js';
import { parseCatalogInfo, type CatalogEntity } from './catalog-parser.js';

export interface CatalogScanResult {
  entities: Array<CatalogEntity & { sourceProject: string }>;
  errors: Array<{ project: string; message: string }>;
}

/**
 * Scans every GitLab project reachable by the given client for a root-level
 * catalog-info.yaml and parses it. A project without the file is silently
 * skipped; a project whose file fails to parse is reported in `errors`
 * without aborting the scan of the remaining projects.
 */
export async function scanCatalogFromGitLab(gitlab: Pick<GitLabClient, 'listProjects' | 'getRawFile'>): Promise<CatalogScanResult> {
  const entities: Array<CatalogEntity & { sourceProject: string }> = [];
  const errors: Array<{ project: string; message: string }> = [];

  for await (const project of gitlab.listProjects()) {
    const ref = project.default_branch ?? 'HEAD';
    let raw: string | null;
    try {
      raw = await gitlab.getRawFile(project.path_with_namespace, 'catalog-info.yaml', ref);
    } catch (error) {
      errors.push({ project: project.path_with_namespace, message: error instanceof Error ? error.message : 'Failed to read catalog-info.yaml' });
      continue;
    }
    if (raw === null) continue;

    try {
      for (const entity of parseCatalogInfo(raw)) entities.push({ ...entity, sourceProject: project.path_with_namespace });
    } catch (error) {
      errors.push({ project: project.path_with_namespace, message: error instanceof Error ? error.message : 'Failed to parse catalog-info.yaml' });
    }
  }

  return { entities, errors };
}
