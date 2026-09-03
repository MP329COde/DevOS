# Suivi d'avancement

Etat maintenu au fil des phases du backlog `TODO.md`.

## Phase 0 - Socle technique

- [x] Initialiser le depot et la structure monorepo (`backend/`, `frontend/`, `docs/`)
- [x] Setup PostgreSQL + migrations (Prisma)
- [x] Setup Redis (cache + pub/sub)
- [x] Integration Vault (Kubernetes Auth Method + KV v2)
- [x] Integration Keycloak OIDC (PKCE, callback, session opaque)
- [x] Permissions (Admin / Contributeur / Lecteur)
- [x] Pipeline CI GitLab (lint, test, build)
- [x] Docker local (Dockerfiles + Compose)
- [x] Manifests Kubernetes (Deployment, Service, Ingress)
- [x] Format `catalog-info.yaml` (Component + API)

## Phases suivantes

- [ ] Phase 1 - Module Taches & Projets
- [ ] Phase 2 - Synchronisation GitLab
- [ ] Phase 3 - Dashboard Aujourd'hui
- [ ] Phase 4 - Catalogue
- [ ] Phase 5 - Docs
- [ ] Phase 6 - Coder
- [ ] Phase 7 - Elargissement

## Phase 1 - Module Taches & Projets

- [x] Modele generique `items` (task/doc/goal)
- [x] Hierarchie et rollup de statut
- [x] CRUD complet des taches (API + UI)
- [x] Systeme de labels croises (`prefix::value`)
- [x] Liens types entre taches
- [x] Vues decouplees (Liste, Board, Gantt, Calendrier)

## Historique

- 2026-09-03: branche `phase-0-foundation` creee; depot initialise; structure monorepo creee.
- 2026-09-03: Prisma configure, schema valide et client genere; migration initiale ajoutee.
- 2026-09-03: Redis configure avec trois clients separes et tests unitaires sans dependance a un serveur local.
- 2026-09-03: Client Vault configure et teste avec authentification Kubernetes et lecture KV v2 sans secret persiste.
- 2026-09-03: Configuration OIDC Keycloak ajoutee et testee; login/callback HTTP et session frontend restent a implementer.
- 2026-09-03: Helper PKCE frontend ajoute et typechecke; routes backend et ecran React restent a implementer.
- 2026-09-03: Ecran React/Vite ajoute; test Playwright desktop/mobile reussi avec console sans erreur apres correction du favicon.
- 2026-09-03: Callback backend et session Redis ajoutes; 10 tests backend et test Playwright du state invalide reussis.
- 2026-09-03: Matrice de permissions ajoutee et testee pour les trois roles, avec protection des actions d'administration et d'infrastructure.
- 2026-09-03: Pipeline GitLab ajoutee et reproduite localement: lint, 14 tests et builds backend/frontend reussis.
- 2026-09-03: Dockerfiles et Compose local ajoutes; configuration Compose validee et endpoint backend `/health` teste sur build compile.
- 2026-09-03: Manifests Kubernetes ajoutes et parses localement; aucun deploiement distant execute.
- 2026-09-03: Format catalog-info.yaml defini et valide avec deux documents YAML et champs structurants obligatoires.
- 2026-09-03: Hierarchie Epic/Story/Task et rollup de statut ajoutes; migrations Prisma conservees additives et 17 tests backend reussis.
- 2026-09-03: Service CRUD items ajoute et teste; 19 tests backend passent. Handlers HTTP et UI restent a relier.
- 2026-09-03: CRUD API/UI finalise; liste, filtres, creation, statut et suppression ajoutes. 21 tests et builds passent; Playwright mobile valide l'interface.
- 2026-09-03: Labels normalises integres au modele et au CRUD, champ UI ajoute; 24 tests backend passent.
- 2026-09-03: Liens types et inversion des relations de blocage ajoutes; migrations validees et 26 tests backend passent.
- 2026-09-03: Requete partagee et modes Liste/Board/Gantt/Calendrier ajoutes; 28 tests passent et Playwright mobile valide le changement de vue. Rendus timeline/calendrier detailles restent a finaliser.
- 2026-09-03: Echeance `dueAt` ajoutee et rendus Gantt/Calendrier groupes par date; validation Prisma, builds et Playwright mobile reussis.
- 2026-09-03: Cycles et report des items incomplets ajoutes et testes; 30 tests passent. Interface et endpoints de cycle restent a relier.
- 2026-09-03: Moteur de regles declaratif ajoute et teste; 32 tests passent. Persistance JSON et evaluation sur webhooks restent a relier.
- 2026-09-03: Validation globale reussie hors Docker; `docker compose build` bloque par daemon Docker local arrete.

## Etat de la Phase 0

Phase 0 terminee et validee localement. La suite est la Phase 1, module Taches & Projets.
