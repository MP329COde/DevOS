# TODO.md — Backlog complet par phase

> Règles d'usage (pour Claude Code) : cocher chaque case au fur et à mesure, ne jamais décocher, ne jamais sauter une phase tant que la précédente n'est pas terminée sauf item explicitement marqué [parallélisable]. Voir PROMPT_CLAUDE_CODE.md pour le mode de travail complet et INFO.md pour toute référence technique (APIs, infra, patterns).

---

## Phase 0 — Socle technique

- [x] Initialiser le dépôt (structure monorepo : `backend/`, `frontend/`, `docs/`)
- [ ] Setup PostgreSQL + migrations (choisir un ORM : Prisma ou Drizzle)
- [ ] Setup Redis (cache + pub/sub pour le temps réel)
- [ ] Intégration Vault : client backend + méthode Kubernetes Auth Method
- [ ] Intégration Keycloak OIDC (login backend + frontend, gestion de session)
- [ ] Modèle de permissions à 3 rôles : Admin / Contributeur / Lecteur
- [ ] Pipeline CI GitLab pour le projet lui-même (lint, test, build)
- [ ] Dockerfile + docker-compose pour dev local
- [ ] Manifests Kubernetes de déploiement (Deployment, Service, Ingress via HAProxy existant)
- [ ] `catalog-info.yaml` (ou équivalent) — spécifier le format que le module Catalogue lira plus tard

## Phase 1 — Module Tâches & Projets (MVP cœur)

- [ ] Modèle de données : table `items` générique (type: task/doc/goal), voir INFO.md section 6
- [ ] Hiérarchie Epic > Story > Task avec rollup automatique de statut
- [ ] CRUD complet des tâches (API + UI)
- [ ] Système de labels croisés (préfixe::valeur, façon GitLab)
- [ ] Liens typés entre tâches (relates_to / blocks / is_blocked_by)
- [ ] Vues découplées de la donnée : Liste, Board (Kanban), Gantt simple, Calendrier — une seule API de requête paramétrable, plusieurs rendus frontend
- [ ] Cycles (sprints allégés type Linear) avec report automatique des tâches non terminées à la clôture
- [ ] Moteur de règles interne (Trigger → Condition → Action, stocké en JSON, évalué à chaque événement)
- [ ] File de Triage séparée pour toute tâche créée automatiquement (avant intégration à un board)
- [ ] Command K (palette de commandes clavier-first) — **exigence UX non négociable**, dès ce stade
- [ ] Time tracking basique (start/stop sur une tâche, historique)

## Phase 2 — Synchronisation GitLab bidirectionnelle [LE DIFFÉRENCIATEUR]

- [ ] Client API GitLab (REST v4 + gestion pagination par curseur)
- [ ] Réception webhooks GitLab (issue, merge_request, pipeline, note) — endpoint sécurisé par secret token
- [ ] Table de correspondance `task_id ↔ gitlab_project_id ↔ gitlab_issue_iid`
- [ ] Sync GitLab → Outil : création/mise à jour automatique d'une tâche depuis une issue GitLab (passe d'abord par Triage)
- [ ] Sync Outil → GitLab : toute modification d'une tâche liée met à jour l'issue GitLab correspondante (statut, labels, commentaires)
- [ ] Détection automatique de lien via pattern `#<iid>` dans les commits/branches
- [ ] Statut de tâche lié au cycle de vie de la MR associée (open/merged/closed), affichage du statut pipeline sur la carte de tâche
- [ ] Gestion des conflits : dernière écriture gagne + log d'audit consultable
- [ ] Tests d'intégration bout-en-bout avec une vraie instance GitLab (utiliser l'instance existante `mpc-gitlab.duckdns.org` en environnement de test)

## Phase 3 — Dashboard "Aujourd'hui"

- [ ] Vue agrégée : tâches du jour (positionnées en timeline horaire, façon Huly time-blocking)
- [ ] Widget statut pipelines en cours (via Prometheus/GitLab API)
- [ ] Widget alertes actives (via Prometheus/Alertmanager)
- [ ] Système de widgets interchangeables (façon Azure DevOps Dashboards) plutôt qu'une page figée
- [ ] Vue "demain" / planification à l'avance

## Phase 4 — Module Catalogue (infra/services) [parallélisable avec Phase 3]

- [ ] Parseur du fichier `catalog-info.yaml` à la racine des dépôts GitLab
- [ ] Scan automatique des dépôts pour peupler le catalogue
- [ ] Intégration API Kubernetes (lecture pods/deployments/nodes)
- [ ] Intégration API ArgoCD (statut des Applications, historique de sync)
- [ ] Graphe de dépendances entre services (relations dependsOn/partOf)
- [ ] Affichage du statut de scan Trivy par service (une fois Harbor/Trivy déployés — sinon stub)

## Phase 5 — Module Docs

- [ ] Docs-as-code : lecture de fichiers Markdown versionnés dans les dépôts (façon TechDocs)
- [ ] Éditeur de documents intégré (pour les docs qui ne sont pas dans un dépôt)
- [ ] Liaison document ↔ tâche/projet

## Phase 6 — Intégration Coder [voir INFO.md section 5 + analyse-approfondie section 11]

- [ ] Client API Coder (auth, liste des templates)
- [ ] Mapping Projet ↔ template Coder par défaut
- [ ] Bouton "Ouvrir un environnement" sur une tâche → création workspace via API avec le bon template
- [ ] Affichage du statut du workspace (running/stopped) en badge sur la carte de tâche
- [ ] Auto-stop du workspace quand la tâche liée passe "Done"
- [ ] Lien direct vers VS Code Desktop une fois le workspace prêt

## Phase 7 — Élargissement (à la demande, pas urgent)

- [ ] Intégration GitHub (même logique que GitLab, via GitHub App)
- [ ] Exposer l'outil comme serveur MCP (pour interrogation par agents IA)
- [ ] Intégration Grafana (affichage de panels existants)
- [ ] Intégration Harbor (une fois déployé)
- [ ] Intégration Proxmox (vue infra au-delà de K8s)
- [ ] Intégration Wazuh (alertes sécurité dans le Dashboard)

---

## Notes de suivi (Claude Code doit ajouter ici l'historique des décisions prises en autonomie)

<!-- Ajouter ici, au fil de l'avancement, toute décision technique prise sans validation utilisateur, avec la date et la justification, pour traçabilité -->

- 2026-09-03: Initialisation du dépôt sur la branche `phase-0-foundation`, avec un monorepo minimal et `PROGRESS.md` pour suivre les phases. Aucun framework ni dépendance n'est ajouté avant les items qui les nécessitent.
