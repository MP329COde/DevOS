export type Trigger = 'item.created' | 'item.updated' | 'webhook.received';
export type ConditionOperator = 'equals' | 'not_equals';
export type ActionType = 'notify' | 'set_status' | 'execute_infrastructure';

export interface Rule {
  id: string;
  enabled: boolean;
  trigger: Trigger;
  condition?: { field: string; operator: ConditionOperator; value: string };
  action: { type: ActionType; payload: Record<string, string> };
}

export interface RuleEvent {
  trigger: Trigger;
  data: Record<string, string | undefined>;
}

export function evaluateRules(rules: readonly Rule[], event: RuleEvent): Rule['action'][] {
  return rules.filter((rule) => rule.enabled && rule.trigger === event.trigger && matches(rule.condition, event.data)).map((rule) => rule.action);
}

function matches(condition: Rule['condition'], data: RuleEvent['data']): boolean {
  if (!condition) return true;
  const actual = data[condition.field];
  return condition.operator === 'equals' ? actual === condition.value : actual !== condition.value;
}