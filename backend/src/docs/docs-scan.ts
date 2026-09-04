import type { GitLabClient } from '../integrations/gitlab.js';

export interface ScannedDocPage {
  sourceProject: string;
  path: string;
  title: string;
  content: string;
}

export interface DocsScanResult {
  pages: ScannedDocPage[];
  errors: Array<{ project: string; message: string }>;
}

/**
 * Scans every GitLab project reachable by the given client for Markdown files under
 * `docsPath` (default "docs", TechDocs convention) and reads their content. A project
 * without the folder is silently skipped; a project whose files fail to read is reported
 * in `errors` without aborting the scan of the remaining projects.
 */
export async function scanDocsFromGitLab(
  gitlab: Pick<GitLabClient, 'listProjects' | 'listRepositoryTree' | 'getRawFile'>,
  docsPath = 'docs',
): Promise<DocsScanResult> {
  const pages: ScannedDocPage[] = [];
  const errors: Array<{ project: string; message: string }> = [];

  for await (const project of gitlab.listProjects()) {
    const ref = project.default_branch ?? 'HEAD';
    try {
      for await (const entry of gitlab.listRepositoryTree(project.path_with_namespace, docsPath, ref)) {
        if (entry.type !== 'blob' || !entry.path.endsWith('.md')) continue;
        const content = await gitlab.getRawFile(project.path_with_namespace, entry.path, ref);
        if (content === null) continue;
        pages.push({ sourceProject: project.path_with_namespace, path: entry.path, title: deriveTitle(content, entry.path), content });
      }
    } catch (error) {
      errors.push({ project: project.path_with_namespace, message: error instanceof Error ? error.message : 'Failed to scan docs' });
    }
  }

  return { pages, errors };
}

function deriveTitle(content: string, path: string): string {
  const heading = content.match(/^#\s+(.+)$/m);
  if (heading) return heading[1].trim();
  const fileName = path.split('/').pop() ?? path;
  return fileName.replace(/\.md$/, '');
}
