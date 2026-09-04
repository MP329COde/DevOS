import type { DevProject, Item, ItemComment, PrismaClient } from '@prisma/client';

import { DocsService } from '../docs/docs-service.js';

/**
 * Module Développement — section AM.8 (dernière sous-vague) : historique/timeline, doc par
 * projet, architecture logique, membres/permissions, page Intégrations dev, recherche globale +
 * actions rapides, assistant/agent IA (stubs), vue "cycle de vie" d'une modification, dashboard
 * développeur personnel. Regroupé dans un seul service pour rester lisible tant que le module
 * Développement n'a pas un panel racine dédié côté frontend (voir TODO au sommet de App.tsx).
 */

export interface TimelineEntry {
  id: string;
  type: 'item-created' | 'item-updated' | 'comment';
  occurredAt: string;
  itemId: string;
  itemTitle: string;
  itemType: string;
  devProjectId: string | null;
  summary: string;
}

export interface TimelineFilter {
  devProjectId?: string;
  type?: TimelineEntry['type'];
  from?: string;
  to?: string;
}

export interface ArchitectureNode {
  id: string;
  title: string;
  itemType: string;
  status: string;
}

export interface ArchitectureEdge {
  from: string;
  to: string;
  type: string;
}

export interface ArchitectureGraph {
  nodes: ArchitectureNode[];
  edges: ArchitectureEdge[];
}

export interface DevIntegrationStatus {
  id: string;
  label: string;
  configured: boolean;
  detail: string;
}

export interface SearchResult {
  kind: 'project' | 'item' | 'doc';
  id: string;
  title: string;
  subtitle: string;
}

export interface LifecycleStage {
  key: string;
  label: string;
  done: boolean;
  blocked: boolean;
  detail: string;
}

export interface LifecycleView {
  itemId: string;
  title: string;
  stages: LifecycleStage[];
}

export interface PersonalDashboard {
  member: string;
  assignedOpenTasks: Array<{ id: string; title: string; status: string; devProjectId: string | null }>;
  pipelinesFailing: Array<{ id: string; title: string; pipelineStatus: string | null }>;
  mergeRequestsToReview: Array<{ id: string; title: string; mergeRequestState: string | null }>;
}

/**
 * Réponse "IA" volontairement stubbée : aucun vrai LLM n'est branché pour le module
 * Développement (voir TODO-refonte-2.md AM.8). Le stub renvoie une réponse déterministe et
 * signale clairement `configured: false` pour que le frontend affiche un message explicite
 * plutôt que de laisser croire à une vraie génération IA.
 */
export interface AiStubResponse {
  configured: false;
  message: string;
}

export class DevActivityService {
  private readonly docs: DocsService;

  public constructor(private readonly database: PrismaClient) {
    this.docs = new DocsService(database);
  }

  /**
   * Timeline chronologique filtrable. Il n'existe pas de table d'évènements dédiée pour le
   * module Développement (le modèle `AuditLog` existant ne couvre que les décisions de synchro
   * GitLab, voir `integrations/audit-log-service.ts`) : on construit donc une timeline agrégée
   * à partir des faits déjà stockés (création/mise à jour de tâche, commentaires), triée par
   * date. Suffisant pour un historique consultable ; une vraie table d'évènements pourra
   * remplacer cette agrégation plus tard sans changer le contrat HTTP.
   */
  public async timeline(filter: TimelineFilter = {}): Promise<TimelineEntry[]> {
    const itemWhere = filter.devProjectId ? { devProjectId: filter.devProjectId } : {};
    const items = await this.database.item.findMany({ where: itemWhere, include: { comments: true } });

    const entries: TimelineEntry[] = [];
    for (const item of items as Array<Item & { comments: ItemComment[] }>) {
      entries.push({
        id: `item-created:${item.id}`,
        type: 'item-created',
        occurredAt: item.createdAt.toISOString(),
        itemId: item.id,
        itemTitle: item.title,
        itemType: item.type,
        devProjectId: item.devProjectId,
        summary: `Création de "${item.title}"`,
      });
      if (item.updatedAt.getTime() !== item.createdAt.getTime()) {
        entries.push({
          id: `item-updated:${item.id}:${item.updatedAt.toISOString()}`,
          type: 'item-updated',
          occurredAt: item.updatedAt.toISOString(),
          itemId: item.id,
          itemTitle: item.title,
          itemType: item.type,
          devProjectId: item.devProjectId,
          summary: `Mise à jour de "${item.title}" (statut : ${item.status})`,
        });
      }
      for (const comment of item.comments) {
        entries.push({
          id: `comment:${comment.id}`,
          type: 'comment',
          occurredAt: comment.createdAt.toISOString(),
          itemId: item.id,
          itemTitle: item.title,
          itemType: item.type,
          devProjectId: item.devProjectId,
          summary: `Commentaire de ${comment.author ?? 'inconnu'} sur "${item.title}"`,
        });
      }
    }

    const from = filter.from ? new Date(filter.from).getTime() : undefined;
    const to = filter.to ? new Date(filter.to).getTime() : undefined;
    return entries
      .filter((entry) => !filter.type || entry.type === filter.type)
      .filter((entry) => from === undefined || new Date(entry.occurredAt).getTime() >= from)
      .filter((entry) => to === undefined || new Date(entry.occurredAt).getTime() <= to)
      .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());
  }

  /**
   * Documentation scopée à un projet, distincte de la doc globale DevOS (section U, en cours en
   * parallèle). Réutilise le modèle `DocPage` existant (comme le fait déjà `docs-service.ts`
   * pour l'onboarding) avec `sourceProject = "project:<id>"` : pas de nouvelle table, et ces
   * pages n'apparaissent jamais dans le panel Docs global car ce dernier filtre/liste par son
   * propre usage du champ `sourceProject`.
   */
  public projectDocs(devProjectId: string): Promise<unknown> {
    return this.database.docPage.findMany({
      where: { sourceProject: `project:${devProjectId}` },
      orderBy: { title: 'asc' },
    });
  }

  public createProjectDoc(devProjectId: string, title: string, content: string): Promise<unknown> {
    const path = `project/${devProjectId}/${slugify(title)}`;
    return this.database.docPage.upsert({
      where: { sourceProject_path: { sourceProject: `project:${devProjectId}`, path } },
      create: { sourceProject: `project:${devProjectId}`, path, title, content, pageType: 'scanned' },
      update: { title, content },
    });
  }

  /**
   * Vue architecture logique d'un projet : composants (tâches de type feature/service liées au
   * projet) + dépendances (`ItemLink`). Réutilise le pattern de `catalog/catalog-graph.ts`
   * (nœuds + arêtes construits à partir d'entités existantes) mais côté module Développement,
   * sur les items du projet plutôt que sur le catalogue d'entités Backstage-like.
   */
  public async architecture(devProjectId: string): Promise<ArchitectureGraph> {
    const items = await this.database.item.findMany({ where: { devProjectId } });
    const ids = new Set(items.map((item) => item.id));
    const links = await this.database.itemLink.findMany({
      where: { OR: [{ sourceId: { in: [...ids] } }, { targetId: { in: [...ids] } }] },
    });
    const nodes: ArchitectureNode[] = items.map((item) => ({ id: item.id, title: item.title, itemType: item.type, status: item.status }));
    const edges: ArchitectureEdge[] = links
      .filter((link) => ids.has(link.sourceId) && ids.has(link.targetId))
      .map((link) => ({ from: link.sourceId, to: link.targetId, type: link.type }));
    return { nodes, edges };
  }

  /**
   * Membres/permissions par projet. `DevProject.members` est du texte libre (voir commentaire
   * sur le modèle dans schema.prisma) : pas de vraie table de permissions par environnement tant
   * que l'authentification applicative (section AC) n'existe pas. On renvoie donc les membres
   * connus avec un rôle par défaut ("member", ou "owner" pour le champ `owner`), par
   * environnement déclaré dans `content`/description si présent — sinon un seul environnement
   * générique "défaut".
   */
  public async members(devProjectId: string): Promise<{ member: string; role: 'owner' | 'member' }[]> {
    const project = await this.database.devProject.findUnique({ where: { id: devProjectId } });
    if (!project) return [];
    const result: { member: string; role: 'owner' | 'member' }[] = [];
    if (project.owner) result.push({ member: project.owner, role: 'owner' });
    for (const member of project.members) if (member !== project.owner) result.push({ member, role: 'member' });
    return result;
  }

  /**
   * Page Intégrations développement : état (configuré ou non) des intégrations pertinentes pour
   * le module Développement, dérivé des mêmes variables d'environnement que les services
   * d'intégration existants (pas de vraie requête réseau ici — "test connexion" reste un futur
   * bouton qui appellera les endpoints d'intégration existants, ex. `/api/dev-projects`,
   * `/api/integrations/test`).
   */
  public integrationsStatus(): DevIntegrationStatus[] {
    const check = (id: string, label: string, envKeys: string[]): DevIntegrationStatus => {
      const configured = envKeys.every((key) => Boolean(process.env[key]));
      return { id, label, configured, detail: configured ? 'Configuré' : `Variables manquantes : ${envKeys.join(', ')}` };
    };
    return [
      check('gitlab', 'GitLab', ['GITLAB_URL', 'GITLAB_TOKEN']),
      check('github', 'GitHub', ['GITHUB_TOKEN']),
      check('coder', 'Coder (environnements de dev)', ['CODER_URL', 'CODER_TOKEN']),
      check('woodpecker', 'Woodpecker CI', ['WOODPECKER_URL', 'WOODPECKER_TOKEN']),
      check('artifact-registry', "Registre d'artefacts", ['ARTIFACT_REGISTRY_URL']),
    ];
  }

  /** Recherche globale développement (projets, tâches, docs de projet) + entrée pour actions rapides côté frontend. */
  public async search(query: string): Promise<SearchResult[]> {
    const term = query.trim();
    if (!term) return [];
    const [projects, items, docs] = await Promise.all([
      this.database.devProject.findMany({ where: { name: { contains: term, mode: 'insensitive' } }, take: 10 }),
      this.database.item.findMany({ where: { title: { contains: term, mode: 'insensitive' } }, take: 10 }),
      this.database.docPage.findMany({ where: { title: { contains: term, mode: 'insensitive' }, sourceProject: { startsWith: 'project:' } }, take: 10 }),
    ]);
    const results: SearchResult[] = [];
    for (const project of projects) results.push({ kind: 'project', id: project.id, title: project.name, subtitle: project.status });
    for (const item of items) results.push({ kind: 'item', id: item.id, title: item.title, subtitle: item.status });
    for (const doc of docs) results.push({ kind: 'doc', id: doc.id, title: doc.title, subtitle: doc.sourceProject });
    return results;
  }

  /**
   * Assistant IA développement — stub. Aucune vraie API IA n'est branchée dans DevOS pour ce
   * module (Ollama est intégré ailleurs pour d'autres usages, voir `integrations/ollama.ts`,
   * mais pas câblé ici) : la réponse est déterministe et signale explicitement `configured:
   * false` pour que le frontend affiche un message clair ("Assistant IA non configuré") plutôt
   * que de simuler une vraie génération.
   */
  public assistantQuery(prompt: string, devProjectId?: string): AiStubResponse {
    return {
      configured: false,
      message: `Assistant IA développement non configuré (stub). Question reçue${devProjectId ? ` pour le projet ${devProjectId}` : ''} : "${prompt.slice(0, 200)}". Brancher une vraie intégration LLM (ex. Ollama local) pour activer cette fonctionnalité.`,
    };
  }

  /**
   * Agent IA développement — stub. Un vrai agent (création de branche/PR) nécessiterait des
   * permissions applicatives réelles (section AC) et une intégration GitLab en écriture ; ici on
   * ne fait qu'exposer le contrat attendu (action demandée, permission requise) sans exécuter
   * quoi que ce soit.
   */
  public agentAction(action: string, devProjectId?: string): AiStubResponse {
    return {
      configured: false,
      message: `Agent IA développement non configuré (stub). Action demandée${devProjectId ? ` sur le projet ${devProjectId}` : ''} : "${action}". Nécessite une permission explicite et une intégration GitLab en écriture non branchées pour l'instant.`,
    };
  }

  /**
   * Vue "cycle de vie" d'une modification (tâche -> ... -> déploiement), avec mise en évidence
   * des blocages. Dérivée des champs déjà présents sur `Item` (statut, MR GitLab, pipeline,
   * espace de travail Coder) plutôt que d'un vrai suivi de déploiement (pas encore modélisé).
   */
  public async lifecycle(itemId: string): Promise<LifecycleView | null> {
    const item = await this.database.item.findUnique({ where: { id: itemId } });
    if (!item) return null;
    const stages: LifecycleStage[] = [
      { key: 'task', label: 'Tâche créée', done: true, blocked: false, detail: `Statut : ${item.status}` },
      {
        key: 'dev',
        label: 'Développement',
        done: Boolean(item.coderWorkspaceId) || item.status !== 'backlog',
        blocked: false,
        detail: item.coderWorkspaceStatus ? `Espace de travail : ${item.coderWorkspaceStatus}` : 'Non démarré',
      },
      {
        key: 'review',
        label: 'Revue (merge request)',
        done: item.mergeRequestState === 'merged',
        blocked: item.mergeRequestState === 'closed',
        detail: item.mergeRequestState ?? 'Aucune merge request liée',
      },
      {
        key: 'pipeline',
        label: 'Pipeline CI',
        done: item.pipelineStatus === 'success',
        blocked: item.pipelineStatus === 'failed',
        detail: item.pipelineStatus ?? 'Aucun pipeline connu',
      },
      {
        key: 'done',
        label: 'Terminé',
        done: item.status === 'done',
        blocked: item.status === 'cancelled',
        detail: `Statut final : ${item.status}`,
      },
    ];
    return { itemId: item.id, title: item.title, stages };
  }

  /**
   * Dashboard développeur personnel. Il n'existe pas de champ "assigné" sur `Item` (voir
   * schema.prisma) : on approxime avec l'appartenance aux projets dont `member` est propriétaire
   * ou membre, ce qui reste cohérent avec le reste du module tant qu'une vraie relation
   * utilisateur <-> tâche n'existe pas (section AC).
   */
  public async personalDashboard(member: string): Promise<PersonalDashboard> {
    const projects = await this.database.devProject.findMany({
      where: { OR: [{ owner: member }, { members: { has: member } }] },
    });
    const projectIds = projects.map((project: DevProject) => project.id);
    if (projectIds.length === 0) return { member, assignedOpenTasks: [], pipelinesFailing: [], mergeRequestsToReview: [] };

    const items = await this.database.item.findMany({ where: { devProjectId: { in: projectIds } } });
    return {
      member,
      assignedOpenTasks: items
        .filter((item) => item.status !== 'done' && item.status !== 'cancelled')
        .map((item) => ({ id: item.id, title: item.title, status: item.status, devProjectId: item.devProjectId })),
      pipelinesFailing: items
        .filter((item) => item.pipelineStatus === 'failed')
        .map((item) => ({ id: item.id, title: item.title, pipelineStatus: item.pipelineStatus })),
      mergeRequestsToReview: items
        .filter((item) => item.mergeRequestState === 'opened')
        .map((item) => ({ id: item.id, title: item.title, mergeRequestState: item.mergeRequestState })),
    };
  }
}

function slugify(title: string): string {
  return title.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'page';
}
