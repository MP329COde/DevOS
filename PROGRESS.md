# Suivi d'avancement

Etat maintenu au fil des phases du backlog `TODO.md`.

## Phase 0 - Socle technique

- [x] Initialiser le depot et la structure monorepo (`backend/`, `frontend/`, `docs/`)
- [x] Setup PostgreSQL + migrations (Prisma)
- [x] Setup Redis (cache + pub/sub)
- [x] Integration Vault (Kubernetes Auth Method + KV v2)
- [ ] Integration Keycloak OIDC
- [ ] Permissions
- [ ] Pipeline CI GitLab
- [ ] Docker local
- [ ] Manifests Kubernetes
- [ ] Format `catalog-info.yaml`

## Phases suivantes

- [ ] Phase 1 - Module Taches & Projets
- [ ] Phase 2 - Synchronisation GitLab
- [ ] Phase 3 - Dashboard Aujourd'hui
- [ ] Phase 4 - Catalogue
- [ ] Phase 5 - Docs
- [ ] Phase 6 - Coder
- [ ] Phase 7 - Elargissement

## Historique

- 2026-09-03: branche `phase-0-foundation` creee; depot initialise; structure monorepo creee.
- 2026-09-03: Prisma configure, schema valide et client genere; migration initiale ajoutee.
- 2026-09-03: Redis configure avec trois clients separes et tests unitaires sans dependance a un serveur local.
- 2026-09-03: Client Vault configure et teste avec authentification Kubernetes et lecture KV v2 sans secret persiste.
- 2026-09-03: Configuration OIDC Keycloak ajoutee et testee; login/callback HTTP et session frontend restent a implementer.
- 2026-09-03: Helper PKCE frontend ajoute et typechecke; routes backend et ecran React restent a implementer.
