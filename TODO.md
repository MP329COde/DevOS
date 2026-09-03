# TODO.md — Backlog complet par phase

> Règles d'usage (pour Claude Code) : cocher chaque case au fur et à mesure, ne jamais décocher, ne jamais sauter une phase tant que la précédente n'est pas terminée sauf item explicitement marqué [parallélisable]. Voir PROMPT_CLAUDE_CODE.md pour le mode de travail complet et INFO.md pour toute référence technique (APIs, infra, patterns).

---

## Phase 0 — Socle technique

- [x] Initialiser le dépôt (structure monorepo : `backend/`, `frontend/`, `docs/`)
- [x] Setup PostgreSQL + migrations (choisir un ORM : Prisma ou Drizzle)
- [x] Setup Redis (cache + pub/sub pour le temps réel)
- [x] Intégration Vault : client backend + méthode Kubernetes Auth Method
- [x] Intégration Keycloak OIDC (login backend + frontend, gestion de session)
- [x] Modèle de permissions à 3 rôles : Admin / Contributeur / Lecteur
- [x] Pipeline CI GitLab pour le projet lui-même (lint, test, build)
- [x] Dockerfile + docker-compose pour dev local
- [x] Manifests Kubernetes de déploiement (Deployment, Service, Ingress via HAProxy existant)
- [x] `catalog-info.yaml` (ou équivalent) — spécifier le format que le module Catalogue lira plus tard

## Phase 1 — Module Tâches & Projets (MVP cœur)

- [x] Modèle de données : table `items` générique (type: task/doc/goal), voir INFO.md section 6
- [x] Hiérarchie Epic > Story > Task avec rollup automatique de statut
- [x] CRUD complet des tâches (API + UI)
- [x] Système de labels croisés (préfixe::valeur, façon GitLab)
- [x] Liens typés entre tâches (relates_to / blocks / is_blocked_by)
- [x] Vues découplées de la donnée : Liste, Board (Kanban), Gantt simple, Calendrier — une seule API de requête paramétrable, plusieurs rendus frontend
- [x] Cycles (sprints allégés type Linear) avec report automatique des tâches non terminées à la clôture
- [x] Moteur de règles interne (Trigger → Condition → Action, stocké en JSON, évalué à chaque événement)
- [x] File de Triage séparée pour toute tâche créée automatiquement (avant intégration à un board)
- [x] Command K (palette de commandes clavier-first) — **exigence UX non négociable**, dès ce stade
- [x] Time tracking basique (start/stop sur une tâche, historique)

## Phase 2 — Synchronisation GitLab bidirectionnelle [LE DIFFÉRENCIATEUR]

- [x] Client API GitLab (REST v4 + gestion pagination par curseur)
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
- [ ] Système de mises a jour 

---

## Notes de suivi (Claude Code doit ajouter ici l'historique des décisions prises en autonomie)

<!-- Ajouter ici, au fil de l'avancement, toute décision technique prise sans validation utilisateur, avec la date et la justification, pour traçabilité -->

- 2026-09-03: Initialisation du dépôt sur la branche `phase-0-foundation`, avec un monorepo minimal et `PROGRESS.md` pour suivre les phases. Aucun framework ni dépendance n'est ajouté avant les items qui les nécessitent.
- 2026-09-03: Prisma 6.19.3 retenu pour PostgreSQL: schema déclaratif, migrations versionnées et client TypeScript généré. La validation utilise une URL locale injectée au processus; les secrets de production resteront dans Vault. `npm install` signale 3 vulnérabilités élevées à traiter avant la mise en production.
- 2026-09-03: Client officiel `redis` v5 retenu; la fabrique crée des connexions séparées pour cache, publication et abonnement, sans connexion automatique au chargement.
- 2026-09-03: Client Vault implémenté avec Kubernetes Auth Method et lecture KV v2 à la demande; le JWT vient du fichier ServiceAccount monté, et le token Vault reste uniquement en mémoire.
- 2026-09-03: Contrat de configuration Keycloak OIDC ajouté avec issuer configurable et référence Vault pour le client secret. L'item reste ouvert jusqu'au flux HTTP login/callback et à la session frontend.
- 2026-09-03: Helper frontend PKCE ajoute avec challenge S256, state et client public sans secret; les routes backend login/callback et l'application React restent a relier.
- 2026-09-03: Ecran React/Vite de connexion ajouté, vérifié par Playwright desktop et mobile; console nettoyée après ajout du favicon. Le callback backend et la session Redis restent à implémenter.
- 2026-09-03: Modèle Prisma `Item` ajouté avec type `task/doc/goal`, statut extensible, parent/enfants auto-référencés et index de requête; le rollup hiérarchique est réservé à l'item suivant.
- 2026-09-03: Hiérarchie ajoutée via `TaskLevel` nullable et migration additive; le rollup pur donne priorité à `blocked`, puis `done` si tous les enfants sont terminés, sinon `in_progress`.
- 2026-09-03: Service CRUD `Item` ajouté avec validation de titre, normalisation et opérations Prisma list/create/update/delete; l'item reste ouvert jusqu'aux handlers HTTP et à l'UI.
- 2026-09-03: CRUD finalisé avec handlers HTTP et UI React: liste, filtre par type, création, changement de statut et suppression. 21 tests, lint et builds passent; Playwright mobile valide le rendu et le filtre. L'API nécessite le backend démarré pour afficher les données.
- 2026-09-03: Labels croisés intégrés au CRUD: tables `labels`/`item_labels`, unicité préfixe-valeur, parsing `prefix::value`, création relationnelle et champ UI multi-labels séparé par virgules. 24 tests passent.
- 2026-09-03: Liens typés ajoutés via `item_links` à clé composite source/cible/type, avec cascades, interdiction des auto-liens et inversion `blocks`/`is_blocked_by`. 26 tests passent.
- 2026-09-03: Vues découplées finalisées avec `dueAt` nullable, champ échéance CRUD et groupement réel par date pour Gantt/Calendrier. Prisma, lint, 28 tests, builds et Playwright mobile passent; aucun déploiement distant effectué.
- 2026-09-03: Cycles ajoutés côté domaine avec dates, fermeture et report pur des items non terminés; migrations, lint, builds et 30 tests passent. UI/API de gestion des cycles restent à relier.
- 2026-09-03: Noyau du moteur Trigger/Condition/Action ajouté; il retourne uniquement des actions déclaratives et n'exécute jamais les opérations d'infrastructure. Persistance JSON et branchement webhook restent à faire.
- 2026-09-03: Moteur de règles finalisé avec table JSONB `automation_rules`, service Prisma et évaluation `actionsFor(event)` sans exécution implicite; 38 tests passent.
- 2026-09-03: File Triage finalisée: items `pending` exclus de la liste générale, API GET/accept/reject, service Prisma et vue UI dédiée. Playwright valide l'acceptation mockée; 39 tests passent.
- 2026-09-03: Command K finalisée avec `cmdk`: raccourci Cmd/Ctrl+K, recherche, navigation des vues, ouverture Triage et focus de création. Build et test Playwright mobile réussis.
- 2026-09-03: Time tracking finalisé avec entrées persistantes, start/stop/history, protection contre double timer et boutons UI. Prisma, lint, builds et 42 tests passent.
- 2026-09-03: Client GitLab REST v4 ajouté avec token provider asynchrone (compatible Vault), header `private-token`, opérations de notes et pagination par header `Link`; tests HTTP simulés, sans appel à l'instance réelle.
- 2026-09-03: Statut de Triage ajouté (`none/pending/accepted/rejected`) avec migration et transitions contrôlées pour les items webhook. API/UI et intégration board restent à faire.
- 2026-09-03: API cycles (`GET`, `POST`, clôture explicite) et panneau UI de cycle actif ajoutés; Playwright valide l'affichage et la clôture mockée. Le service Prisma concret et le report transactionnel restent à brancher.
- 2026-09-03: Cycles finalisés avec `PrismaCycleService`: création/listage, clôture transactionnelle et report réel des items non terminés vers le cycle suivant. 37 tests et builds passent.
- 2026-09-03: Validation projet complète réussie (lint, 28 tests, builds, Compose config). Le build Docker n'a pas pu démarrer car le daemon local n'était pas disponible; aucune image/service n'a été lancé.
- 2026-09-03: Contrat de requête partagé ajouté avec filtres, tri et groupement; UI branchée sur les modes Liste/Board/Gantt/Calendrier et contrôlée par Playwright mobile. L'item vues reste ouvert pour les rendus métier complets et les données de timeline/calendrier.
- 2026-09-03: Flux Keycloak finalisé: échange PKCE backend via secret Vault, session opaque Redis, cookie HttpOnly/Secure et validation frontend du state. Test Playwright du callback invalide réussi; la zone d'administration des références Vault sera approfondie avec les intégrations d'outils.
- 2026-09-03: Permissions centralisées côté backend: Lecteur lecture seule, Contributeur collaboration sans administration, Admin toutes les actions déclarées dont l'infrastructure. Le frontend ne constitue pas une frontière de sécurité.
- 2026-09-03: Pipeline GitLab ajoutée avec `npm ci`, lint/typecheck, tests et builds séparés; aucun déploiement automatique n'est inclus afin de garder les changements d'infrastructure explicitement déclenchés.
- 2026-09-03: Dockerfiles multi-stage et `docker-compose.yml` ajoutés pour PostgreSQL, Redis, backend et frontend; valeurs de développement locales uniquement. Le serveur `/health` a été testé compilé sans démarrer l'infrastructure réelle.
- 2026-09-03: Manifests Kubernetes ajoutés avec Namespace, ServiceAccount Vault, Deployments/Services et Ingress HAProxy pour `dev-mpcode.duckdns.org`. YAML parsé localement (7 documents); aucun `kubectl apply`, et la validation OpenAPI reste impossible tant que le cluster configuré est inaccessible.
- 2026-09-03: Format `catalog-info.yaml` défini avec documents Backstage-compatible `Component` et `API`, dépendances, annotations DevOS et règles de validation multi-documents.
