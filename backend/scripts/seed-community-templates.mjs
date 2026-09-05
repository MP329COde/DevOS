// Peuple le catalogue de templates (`dev_templates`) avec un socle de gabarits communautaires
// courants de l'écosystème npm/Node.js (et quelques autres), pour que le sélecteur du wizard de
// création de projet (AM.2) ne parte jamais vide. Idempotent : upsert par (name, source) plutôt
// que suppression/recréation, pour ne pas casser les projets déjà créés à partir de ces gabarits
// (`DevProject.templateId` pointe sur l'id existant). Sûr à relancer en production.
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const COMMUNITY_TEMPLATES = [
  {
    name: 'Vite + React',
    type: 'web-app',
    description: "Application web React avec build Vite, généré via `npm create vite@latest -- --template react-ts`.",
    technologies: ['node', 'npm', 'react', 'vite', 'typescript'],
    dependencies: [{ name: 'react', version: '^18' }, { name: 'vite', version: '^5' }],
    environments: ['dev', 'staging', 'prod'],
    integrableTools: ['gitlab-ci'],
    generatedItems: ['package.json', 'vite.config.ts', 'src/main.tsx'],
    registry: 'npm',
    packageName: 'create-vite',
  },
  {
    name: 'Next.js',
    type: 'web-app',
    description: "Application web React full-stack avec rendu serveur, généré via `npm create next-app@latest`.",
    technologies: ['node', 'npm', 'react', 'next', 'typescript'],
    dependencies: [{ name: 'next', version: '^14' }, { name: 'react', version: '^18' }],
    environments: ['dev', 'staging', 'prod'],
    integrableTools: ['gitlab-ci', 'argocd'],
    generatedItems: ['package.json', 'next.config.js', 'app/page.tsx'],
    registry: 'npm',
    packageName: 'create-next-app',
  },
  {
    name: 'Express API',
    type: 'api',
    description: "API REST minimale Node.js/Express, généré via `npx express-generator`.",
    technologies: ['node', 'npm', 'express'],
    dependencies: [{ name: 'express', version: '^4.19' }],
    environments: ['dev', 'staging', 'prod'],
    integrableTools: ['gitlab-ci', 'sonarqube'],
    generatedItems: ['package.json', 'app.js', 'bin/www'],
    registry: 'npm',
    packageName: 'express-generator',
  },
  {
    name: 'NestJS API',
    type: 'api',
    description: "API structurée (modules/DI) avec NestJS, généré via `npx @nestjs/cli new`.",
    technologies: ['node', 'npm', 'nestjs', 'typescript'],
    dependencies: [{ name: '@nestjs/core', version: '^10' }, { name: '@nestjs/common', version: '^10' }],
    environments: ['dev', 'staging', 'prod'],
    integrableTools: ['gitlab-ci', 'sonarqube', 'argocd'],
    generatedItems: ['package.json', 'src/main.ts', 'src/app.module.ts'],
    repositoryUrl: 'https://github.com/nestjs/nest',
    registry: 'npm',
    packageName: '@nestjs/cli',
  },
  {
    name: 'Node.js CLI',
    type: 'cli',
    description: "Outil en ligne de commande Node.js minimal (yargs/commander), sans framework web.",
    technologies: ['node', 'npm'],
    dependencies: [{ name: 'commander', version: '^12' }],
    environments: ['dev'],
    integrableTools: ['gitlab-ci'],
    generatedItems: ['package.json', 'bin/cli.js'],
    registry: 'npm',
    packageName: 'commander',
  },
  {
    name: 'Fastify API',
    type: 'api',
    description: "API REST performante Node.js/Fastify, généré via `npm init fastify`.",
    technologies: ['node', 'npm', 'fastify'],
    dependencies: [{ name: 'fastify', version: '^4.28' }],
    environments: ['dev', 'staging', 'prod'],
    integrableTools: ['gitlab-ci'],
    generatedItems: ['package.json', 'app.js'],
    registry: 'npm',
    packageName: 'fastify-cli',
  },
  {
    name: 'BullMQ Worker',
    type: 'worker',
    description: "Worker de traitement de jobs en file d'attente (Redis) avec BullMQ.",
    technologies: ['node', 'npm', 'bullmq', 'redis'],
    dependencies: [{ name: 'bullmq', version: '^5' }],
    environments: ['dev', 'staging', 'prod'],
    integrableTools: ['gitlab-ci'],
    generatedItems: ['package.json', 'src/worker.ts'],
    registry: 'npm',
    packageName: 'bullmq',
  },
  {
    name: 'Cobra CLI (Go)',
    type: 'cli',
    description: "Outil en ligne de commande Go avec le framework Cobra, généré via `cobra-cli init`.",
    technologies: ['go'],
    dependencies: [{ name: 'github.com/spf13/cobra', version: 'latest' }],
    environments: ['dev'],
    integrableTools: ['gitlab-ci'],
    generatedItems: ['go.mod', 'main.go', 'cmd/root.go'],
    repositoryUrl: 'https://github.com/spf13/cobra-cli',
    registry: 'github',
    packageName: 'spf13/cobra-cli',
  },
];

async function main() {
  for (const template of COMMUNITY_TEMPLATES) {
    const existing = await prisma.devTemplate.findFirst({ where: { name: template.name, source: 'community' } });
    const data = {
      name: template.name,
      type: template.type,
      description: template.description,
      technologies: template.technologies,
      dependencies: template.dependencies,
      version: '1.0.0',
      environments: template.environments,
      integrableTools: template.integrableTools,
      generatedItems: template.generatedItems,
      source: 'community',
      registry: template.registry ?? null,
      packageName: template.packageName ?? null,
      repositoryUrl: template.repositoryUrl ?? null,
    };
    if (existing) {
      await prisma.devTemplate.update({ where: { id: existing.id }, data });
      console.log(`Mis à jour : ${template.name}`);
    } else {
      await prisma.devTemplate.create({ data });
      console.log(`Créé : ${template.name}`);
    }
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
