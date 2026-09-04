// Peuple la base locale avec des données fictives mais cohérentes entre elles (mêmes noms de
// projets/machines partout), pour visualiser le rendu des pages sans vraie infra branchée.
// Idempotent : supprime les enregistrements créés par un run précédent (marqués "[Démo]") avant
// de les recréer. Ne jamais lancer contre une base de production.
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const DAY = 24 * 60 * 60 * 1000;
const now = Date.now();

async function main() {
  await prisma.itemComment.deleteMany({ where: { item: { title: { startsWith: '[Démo]' } } } });
  await prisma.docLink.deleteMany({ where: { item: { title: { startsWith: '[Démo]' } } } });
  await prisma.itemLabel.deleteMany({ where: { item: { title: { startsWith: '[Démo]' } } } });
  await prisma.itemLink.deleteMany({ where: { OR: [{ source: { title: { startsWith: '[Démo]' } } }, { target: { title: { startsWith: '[Démo]' } } }] } });
  await prisma.timeEntry.deleteMany({ where: { item: { title: { startsWith: '[Démo]' } } } });
  await prisma.item.deleteMany({ where: { title: { startsWith: '[Démo]' } } });
  await prisma.docPage.deleteMany({ where: { title: { startsWith: '[Démo]' } } });
  await prisma.catalogEntity.deleteMany({ where: { sourceProject: 'demo/homelab' } });
  await prisma.cycle.deleteMany({ where: { name: { startsWith: '[Démo]' } } });

  const cycle = await prisma.cycle.create({
    data: {
      name: '[Démo] Cycle 12',
      startsAt: new Date(now - 3 * DAY),
      endsAt: new Date(now + 11 * DAY),
    },
  });

  const epic = await prisma.item.create({
    data: {
      type: 'task',
      taskLevel: 'epic',
      title: '[Démo] Refonte de la topologie réseau homelab',
      description: "Cartographier l'ensemble des machines Proxmox, DNS et services critiques.",
      status: 'in_progress',
      required: true,
      cycleId: cycle.id,
    },
  });

  const story = await prisma.item.create({
    data: {
      type: 'task',
      taskLevel: 'story',
      title: '[Démo] Intégration Proxmox + PowerDNS',
      status: 'in_progress',
      parentId: epic.id,
      cycleId: cycle.id,
    },
  });

  const tasksData = [
    { title: '[Démo] Corriger le débordement du graphe réseau sur petit écran', status: 'in_progress', required: true, dueAt: new Date(now + 3 * 60 * 60 * 1000), mergeRequestState: 'open', pipelineStatus: 'running' },
    { title: '[Démo] Ajouter le badge de certificat TLS sur les nœuds HAProxy', status: 'backlog', dueAt: new Date(now + DAY) },
    { title: '[Démo] Documenter la procédure de bascule HAProxy edge → be_gitlab', status: 'done', dueAt: new Date(now - DAY) },
    { title: '[Démo] Vérifier les alertes Wazuh niveau critique sur pve-02', status: 'blocked', required: true, dueAt: new Date(now - 2 * 60 * 60 * 1000) },
    { title: '[Démo] Étendre le widget performance machine au disque', status: 'todo', dueAt: new Date(now + 6 * 60 * 60 * 1000) },
  ];

  const tasks = [];
  for (const t of tasksData) {
    tasks.push(await prisma.item.create({ data: { type: 'task', taskLevel: 'task', parentId: story.id, cycleId: cycle.id, ...t } }));
  }

  await prisma.itemComment.create({
    data: {
      itemId: tasks[0].id,
      body: "La régression vient du viewport SVG fixe à 520px — corrigé côté NetworkGraph, à revalider sur écran 1366px.",
      author: 'devos-admin',
    },
  });

  const goal = await prisma.item.create({
    data: { type: 'goal', title: "[Démo] Zéro incident non détecté sur l'infra critique ce trimestre", status: 'in_progress', required: true },
  });
  void goal;

  const docs = [
    { sourceProject: 'demo/homelab', path: 'docs/reverse-proxy-haproxy.md', title: '[Démo] Configurer un backend HAProxy pour un nouveau service', pageType: 'onboarding', content: '# Configurer HAProxy\n\n1. Ajouter le backend `be_<service>`\n2. Ajouter le serveur applicatif\n3. Recharger via la Data Plane API' },
    { sourceProject: 'demo/homelab', path: 'docs/depots-versions.md', title: '[Démo] Choisir un dépôt/version de logiciel', pageType: 'onboarding', content: '# Dépôts recommandés\n\nPréférer les images officielles taguées par version fixe, jamais `latest` en production.' },
    { sourceProject: 'demo/homelab', path: 'docs/topologie-reseau.md', title: '[Démo] Topologie réseau homelab', pageType: 'scanned', content: '# Topologie\n\npve-01 héberge gitlab-mpc, coder-workspaces, db-postgres.\npve-02 héberge haproxy-edge, monitoring-stack.' },
  ];
  const createdDocs = [];
  for (const d of docs) {
    createdDocs.push(await prisma.docPage.create({ data: d }));
  }

  await prisma.docLink.create({ data: { docPageId: createdDocs[0].id, itemId: tasks[2].id } });

  const catalogEntities = [
    {
      kind: 'Component',
      name: 'devos-demo',
      sourceProject: 'demo/homelab',
      description: "Plateforme DevOS elle-même, hébergée sur gitlab-mpc.",
      type: 'service',
      lifecycle: 'production',
      owner: 'devos-admin',
      system: 'homelab',
      dependsOn: ['gitlab-demo', 'postgres-demo'],
      providesApis: ['devos-api'],
      annotations: { 'devos.io/host': 'gitlab-mpc' },
      links: [],
    },
    {
      kind: 'Component',
      name: 'coder-workspaces-demo',
      sourceProject: 'demo/homelab',
      description: 'Environnements de développement à la demande.',
      type: 'service',
      lifecycle: 'production',
      owner: 'devos-admin',
      system: 'homelab',
      dependsOn: [],
      providesApis: [],
      annotations: { 'devos.io/host': 'coder-workspaces' },
      links: [],
    },
  ];
  for (const entity of catalogEntities) {
    await prisma.catalogEntity.upsert({ where: { kind_name: { kind: entity.kind, name: entity.name } }, create: entity, update: entity });
  }

  console.log('Données de démo créées : 1 cycle, 1 epic, 1 story, %d tâches, 1 objectif, %d docs, 2 entités catalogue.', tasks.length, docs.length);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
