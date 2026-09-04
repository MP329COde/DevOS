import type { CoderClient } from '../integrations/coder.js';
import { buildVSCodeDesktopUri } from '../integrations/coder.js';

export interface WorkspaceItem {
  id: string;
  coderTemplateId: string | null;
}

export interface WorkspaceRepository {
  saveWorkspace(itemId: string, fields: { coderWorkspaceId: string; coderWorkspaceName: string; coderWorkspaceStatus: string }): Promise<void>;
}

export interface OpenedWorkspace {
  workspaceId: string;
  workspaceName: string;
  status: string;
  vscodeUri: string;
}

/** Creates (or reuses, per Coder's own idempotent naming) a workspace for an item's default or overridden template, and persists the result. */
export async function openEnvironment(
  item: WorkspaceItem,
  coder: Pick<CoderClient, 'createWorkspace'>,
  repository: WorkspaceRepository,
  options: { defaultTemplateId?: string; baseUrl: string; owner: string },
): Promise<OpenedWorkspace> {
  const templateId = item.coderTemplateId ?? options.defaultTemplateId;
  if (!templateId) throw new Error('No Coder template configured for this item (set a template on the item or CODER_DEFAULT_TEMPLATE_ID)');
  const workspaceName = `devos-${item.id.slice(0, 8)}`;
  const workspace = await coder.createWorkspace(templateId, workspaceName);
  await repository.saveWorkspace(item.id, { coderWorkspaceId: workspace.id, coderWorkspaceName: workspace.name, coderWorkspaceStatus: workspace.latest_build.status });
  return { workspaceId: workspace.id, workspaceName: workspace.name, status: workspace.latest_build.status, vscodeUri: buildVSCodeDesktopUri(options.baseUrl, options.owner, workspace.name) };
}

/** Stops an item's linked workspace exactly when its status just transitioned into "done". */
export async function applyAutoStop(
  item: { status: string; coderWorkspaceId: string | null },
  previousStatus: string,
  coder: Pick<CoderClient, 'stopWorkspace'>,
): Promise<void> {
  if (previousStatus === 'done' || item.status !== 'done' || !item.coderWorkspaceId) return;
  await coder.stopWorkspace(item.coderWorkspaceId);
}
