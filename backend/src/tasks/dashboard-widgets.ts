import type { AlertmanagerAlert } from '../integrations/alertmanager.js';
import type { GitLabPipelineSummary } from '../integrations/gitlab-pipelines.js';

export interface DashboardWidgetData {
  pipelines: { running: number; items: GitLabPipelineSummary[] };
  alerts: { active: number; critical: number; items: AlertmanagerAlert[] };
}

/** Pure aggregator combining running GitLab pipelines and active Alertmanager alerts into dashboard widget data. */
export function buildDashboardWidgets(
  pipelines: GitLabPipelineSummary[],
  alerts: AlertmanagerAlert[],
): DashboardWidgetData {
  return {
    pipelines: { running: pipelines.length, items: pipelines },
    alerts: {
      active: alerts.length,
      critical: alerts.filter((alert) => alert.labels.severity === 'critical').length,
      items: alerts,
    },
  };
}
