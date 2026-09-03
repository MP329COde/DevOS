# Tests d'intégration GitLab

`gitlab.integration.test.ts` s'exécute contre une vraie instance GitLab et est ignoré par défaut
(le test runner l'affiche comme `skipped`) tant que ces trois variables d'environnement ne sont
pas fournies :

- `GITLAB_INTEGRATION_BASE_URL` — ex. `https://mpc-gitlab.duckdns.org/api/v4`
- `GITLAB_INTEGRATION_TOKEN` — token API personnel avec accès `api` sur le projet de test
- `GITLAB_INTEGRATION_PROJECT_ID` — chemin ou identifiant du projet de test (ex. `root/teste`)

Chaque test crée sa propre issue jetable et la supprime dans un `finally`, sans jamais toucher
aux autres données du projet. Ne jamais committer de token ni le passer autrement qu'en variable
d'environnement locale au shell.

```
GITLAB_INTEGRATION_BASE_URL=https://mpc-gitlab.duckdns.org/api/v4 \
GITLAB_INTEGRATION_TOKEN=*** \
GITLAB_INTEGRATION_PROJECT_ID=root/teste \
node --test --import tsx src/integrations/gitlab.integration.test.ts
```
