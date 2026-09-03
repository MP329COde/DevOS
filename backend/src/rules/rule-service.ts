import type { PrismaClient } from '@prisma/client';

import { evaluateRules, type Rule, type RuleEvent } from './engine.js';

export class RuleService {
  public constructor(private readonly database: PrismaClient) {}

  public list() {
    return this.database.automationRule.findMany({ orderBy: { createdAt: 'desc' } });
  }

  public create(rule: Rule & { name: string }) {
    return this.database.automationRule.create({ data: { name: rule.name, enabled: rule.enabled, trigger: rule.trigger, condition: rule.condition, action: rule.action } });
  }

  public async actionsFor(event: RuleEvent) {
    const stored = await this.database.automationRule.findMany({ where: { enabled: true, trigger: event.trigger } });
    return evaluateRules(stored.map((rule) => ({ id: rule.id, enabled: rule.enabled, trigger: rule.trigger as Rule['trigger'], condition: rule.condition as Rule['condition'], action: rule.action as Rule['action'] })), event);
  }
}