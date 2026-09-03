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
- [x] Réception webhooks GitLab (issue, merge_request, pipeline, note) — endpoint sécurisé par secret token
- [x] Table de correspondance `task_id ↔ gitlab_project_id ↔ gitlab_issue_iid`
- [x] Sync GitLab → Outil : création/mise à jour automatique d'une tâche depuis une issue GitLab (passe d'abord par Triage)
- [x] Sync Outil → GitLab : toute modification d'une tâche liée met à jour l'issue GitLab correspondante (statut, labels, commentaires)
- [x] Détection automatique de lien via pattern `#<iid>` dans les commits/branches
- [x] Statut de tâche lié au cycle de vie de la MR associée (open/merged/closed), affichage du statut pipeline sur la carte de tâche
- [x] Gestion des conflits : dernière écriture gagne + log d'audit consultable
- [x] Tests d'intégration bout-en-bout avec une vraie instance GitLab (utiliser l'instance existante `mpc-gitlab.duckdns.org` en environnement de test)

## Phase 3 — Dashboard "Aujourd'hui"

- [x] Vue agrégée : tâches du jour (positionnées en timeline horaire, façon Huly time-blocking)
- [ ] Widget statut pipelines en cours (via Prometheus/GitLab API)
- [ ] Widget alertes actives (via Prometheus/Alertmanager)
- [ ] Système de widgets interchangeables (façon Azure DevOps Dashboards) plutôt qu'une page figée
- [x] Vue "demain" / planification à l'avance

## Phase 4 — Module Catalogue (infra/services) [parallélisable avec Phase 3]

- [ ] Parseur du fichier `catalog-info.yaml` à la racine des dépôts GitLab
- [ ] Scan automatique des dépôts pour peupler le catalogue
- [ ] Intégration API Kubernetes (lecture pods/deployments/nodes)
- [ ] Intégration API ArgoCD (statut des Applications, historique de sync)
- [ ] Graphe de dépendances entre services (relations dependsOn/partOf)
- [ ] Affichage du statut de scan Trivy par service (une fois Harbor/Trivy déployés — sinon stub)
- [ ] Intégration k3s/Docker Swarm : statut des services/pods orchestrés en complément de l'API Kubernetes existante (équivalent open source à Azure Container Apps/AKS)
- [ ] Intégration fonctions serverless auto-hébergées (OpenFaaS, Knative ou Fission) : liste et statut des fonctions déployées (équivalent Azure Functions)
- [ ] Statut des reverse proxies (Traefik/Caddy/Nginx) par service catalogué, au-delà de HAProxy déjà géré en Phase 8 (équivalent App Service/Ingress)

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
- [ ] Intégration bases de données auto-hébergées : statut/metrics PostgreSQL/MySQL-MariaDB (équivalent Azure SQL), MongoDB/CouchDB/ScyllaDB (équivalent Cosmos DB) — Redis déjà en place en Phase 0
- [ ] Intégration stockage objet MinIO (équivalent Azure Blob Storage, API compatible S3) et affichage NFS/Samba (équivalent Azure File Storage)
- [ ] Intégration réseau : statut VPN WireGuard/OpenVPN (équivalent VPN Gateway), pare-feu pfSense/iptables-nftables/Suricata (équivalent Azure Firewall), DNS CoreDNS/PowerDNS/Bind9 (équivalent Azure DNS)
- [ ] Intégration messaging/streaming : RabbitMQ (équivalent Service Bus), Apache Kafka/Redpanda (équivalent Event Hubs), NATS (équivalent Event Grid), n8n pour les workflows low-code (équivalent Logic Apps)
- [ ] CI/CD complémentaire : Drone CI/Woodpecker CI en option à GitLab CI, registre d'artefacts Verdaccio (npm) et Nexus Repository OSS
- [ ] Intégration IA locale : modèles via Ollama/vLLM/LM Studio (équivalent Azure OpenAI) pour les fonctionnalités IA de Nexus Console, recherche via Meilisearch/Typesense/Elasticsearch (équivalent Azure AI Search)
- [ ] Infrastructure as Code : génération/lecture de manifests Terraform/OpenTofu, Ansible ou Pulumi pour le provisioning déclaratif de l'infra homelab, visible depuis le Catalogue

## Phase 8 — Gestion HAProxy (CLI + interface intégrée)

- [ ] Client HAProxy (Runtime API / Data Plane API) pour lire la configuration et les statistiques en temps réel depuis le backend
- [ ] CLI DevOS pour piloter HAProxy depuis la machine (lister/ajouter/modifier des backends, frontends, ACLs, serveurs)
- [ ] Interface web intégrée à DevOS pour visualiser et modifier la configuration HAProxy (frontends/backends/routes/certificats) directement depuis l'app
- [ ] Application directe des modifications sur l'instance HAProxy réelle (rechargement à chaud sans coupure, via Data Plane API ou `haproxy -sf`)
- [ ] Historique des modifications de configuration HAProxy avec possibilité de rollback
- [ ] Garde-fous : validation de la configuration avant application, permissions Admin uniquement (voir modèle de permissions Phase 0)

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
- 2026-09-03: Webhook GitLab sécurisé ajouté sur `/api/webhooks/gitlab`: secret fourni par provider, comparaison constant-time, événements supportés et accusé 202; aucune action automatique n'est déclenchée par le handler.
- 2026-09-03: Table `gitlab_issue_links` ajoutée avec unicité issue/projet et item/projet, références Prisma et validation des IIDs positifs; 48 tests et builds passent.
- 2026-09-03: Synchronisation bidirectionnelle ajoutée: issue webhook importée en Triage, item lié propagé vers GitLab avec état close/reopen, titre et description. 51 tests passent; aucune instance GitLab réelle appelée.
- 2026-09-03: Détection automatique `#<iid>` ajoutée pour branches/commits, avec IIDs positifs uniques et faux positifs ignorés; 53 tests passent.
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
- 2026-09-03: Statut MR/pipeline branché de bout en bout: `projectGitLabStatus` désormais appelé par `processGitLabMergeRequestWebhook`/`processGitLabPipelineWebhook` dans `gitlab-sync.ts`, résolution de l'item via `GitLabIssueLink` (référence `#<iid>` dans le titre/description de la MR), et persistance via `ItemService.update` étendu (`mergeRequestState`/`pipelineStatus` non exposés côté API publique, réservés à la sync interne). Hypothèse retenue: un pipeline n'est propagé que s'il est rattaché à une merge request (`payload.merge_request` présent) — un pipeline de branche seule n'a pas de cible fiable et n'est pas traité. Le câblage Prisma réel (instanciation `PrismaClient` + injection dans `createServer`) n'existe pas encore côté `backend/src` pour aucun des flux GitLab (comme `Issue Hook` déjà en place) — uniquement les fonctions/services testés unitairement.
- 2026-09-03: Gestion des conflits ajoutée pour la direction Outil → GitLab: `resolveConflict` compare `Item.updatedAt` local au timestamp distant (`GitLabIssue.updated_at`, désormais exposé côté client) et applique la règle dernière écriture gagne (égalité tranchée en faveur du local); `pushItemToGitLab` court-circuite l'appel GitLab si le distant est plus récent, et journalise systématiquement la décision via la nouvelle table `audit_logs`/`AuditLogService` (consultable via `list(entityId?)`, pas encore exposée par une route HTTP — aucune maquette n'a été demandée). Limitation assumée: la direction GitLab → Outil ne dispose pas encore d'un flux de mise à jour d'un item déjà lié (seule la création en Triage existe pour `Issue Hook`), donc aucun conflit n'est actuellement possible ni géré dans ce sens; à couvrir si/quand ce flux est ajouté. Câblage Prisma réel de `AuditLogSync`/`pushItemToGitLab` dans `createServer` non fait, même limitation que le point précédent.
- 2026-09-03: Tests d'intégration bout-en-bout ajoutés dans `gitlab.integration.test.ts`, exécutés contre l'instance réelle `mpc-gitlab.duckdns.org` (projet `root/teste`) seulement si `GITLAB_INTEGRATION_BASE_URL`/`GITLAB_INTEGRATION_TOKEN`/`GITLAB_INTEGRATION_PROJECT_ID` sont fournis (voir `backend/src/integrations/README-integration-tests.md`); ignorés (`skipped`) sinon, donc `npm test` reste vert sans réseau. Chaque test crée puis supprime sa propre issue jetable. Exécution manuelle contre l'instance réelle: 3/3 tests passent, projet nettoyé après coup. Cette exécution a révélé et corrigé un vrai bug de production dans `gitlab.ts::updateIssue`: le corps de requête envoyait la clé `stateEvent` (camelCase) au lieu de `state_event` attendu par l'API REST GitLab, si bien que la fermeture/réouverture d'issue ne prenait jamais effet malgré une réponse 200; corrigé et couvert par un test unitaire dédié dans `gitlab.test.ts`. Le token API fourni pour ce test a une date d'expiration et n'a jamais été committé.
- 2026-09-03: Phase 2 clôturée. Amorce de la Phase 3 (Dashboard "Aujourd'hui"): `DashboardService`/`DashboardHttpService` exposent `GET /api/dashboard/today` et `/api/dashboard/tomorrow`, filtrant les items par `dueAt` sur la fenêtre du jour (réutilise le modèle `Item` existant, aucune nouvelle table). Onglet "Aujourd'hui" ajouté côté React avec bascule Aujourd'hui/Demain et rendu en timeline triée par heure. Vérifié visuellement via un serveur mock + Playwright (capture d'écran) plutôt que contre une vraie base de données, faute de câblage Prisma réel dans `createServer` (limitation déjà documentée pour les autres flux). Widgets Prometheus/GitLab pipelines, Alertmanager et le système de widgets interchangeables restent à cadrer séparément avec l'utilisateur avant implémentation (accès aux sources, architecture polling/websocket).
- 2026-09-03: Câblage Prisma réel ajouté à `server.ts` (`ItemService`, `PrismaCycleService`, `PrismaTriageService`, `PrismaTimeService`, `DashboardService` instanciés et injectés dans `createServer` au démarrage) — comble la limitation notée dans les entrées précédentes pour ces flux; auth Keycloak et webhooks GitLab restent non branchés faute d'accès Vault/Kubernetes/instance GitLab réelle dans cet environnement. Vérification bout-en-bout menée avec un vrai PostgreSQL local (Homebrew, migrations appliquées) et le frontend Vite servi séparément: navigation complète testée via Playwright (Liste/Board/Gantt/Calendrier/Triage/Dashboard/Palette de commandes) contre le vrai backend, aucune erreur console, capture d'écran à l'appui. Cette vérification a révélé et corrigé trois bugs de production réels, tous couverts par de nouveaux tests dans `server.test.ts`: (1) la route générique `/api/items` interceptait `/api/items/:id/time` avant le handler de time-tracking dédié, et une exception de parsing JSON non interceptée en dehors du bloc try/catch faisait planter tout le process Node — routes réordonnées, `readJsonIfNeeded` rendu résilient à un corps vide, et tout le handler de requête englobé dans un try/catch renvoyant 500 au lieu de crasher; (2) aucun en-tête CORS n'était émis, bloquant silencieusement tout appel cross-origin — cassant l'architecture réelle de `docker-compose.yml` où frontend (8080) et backend (3000) sont sur des origines différentes; ajout d'un CORS reflétant l'origine de la requête (`FRONTEND_ORIGIN` en prod pour activer les credentials, sinon reflet sans credentials en dev) et d'une gestion du préflight `OPTIONS`; (3) le script `npm test`/la CI GitLab ne positionnent jamais `NODE_ENV=test`, donc importer `server.ts` depuis un test (ex. le nouveau `server.test.ts`) exécutait le vrai bootstrap Prisma + `listen()` au chargement du module et bloquait indéfiniment le test runner; remplacé par la garde standard `require.main === module`. Script `backend/package.json` `test` corrigé au passage: le glob `src/**/*.test.ts` ne matche pas les fichiers `*.test.ts` directement à la racine de `src/` sous `sh` (pas de globstar), donc tout test placé à la racine (dont le nouveau `server.test.ts`) était silencieusement ignoré par `npm test`/la CI; ajout du motif `src/*.test.ts`. 82 tests passent (5 nouveaux dans `server.test.ts`), lint et builds (source et compilé `dist/`) vérifiés.
- 2026-09-03: Backlog enrichi (demande utilisateur) avec la cartographie des équivalents open source aux services Azure pour le homelab: nouveaux items en Phase 4 (k3s/Docker Swarm, fonctions serverless auto-hébergées OpenFaaS/Knative/Fission, reverse proxies Traefik/Caddy/Nginx) et Phase 7 (bases de données PostgreSQL/MySQL/MongoDB/CouchDB/ScyllaDB, stockage MinIO/NFS/Samba, réseau WireGuard/OpenVPN/pfSense/Suricata/CoreDNS/PowerDNS/Bind9, messaging RabbitMQ/Kafka/Redpanda/NATS/n8n, CI/CD Drone/Woodpecker/Verdaccio/Nexus, IA Ollama/vLLM/LM Studio/Meilisearch/Typesense, IaC Terraform/Ansible/Pulumi). Keycloak, Vault, Redis, Prometheus, Grafana et Harbor n'ont pas été redupliqués car déjà couverts en Phase 0/7. Nouvelle Phase 8 dédiée à la gestion HAProxy (CLI + interface web intégrée à DevOS pour lire/modifier/appliquer la configuration directement, avec historique et garde-fous Admin) créée séparément à la demande explicite de l'utilisateur. Modification du backlog uniquement — aucun code ajouté pour ces items, à planifier/implémenter phase par phase.
