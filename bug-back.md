# Bugs backend constatés (lecture de code + test réel, 2026-09-05)

1. **`npm run build` (tsc) échoue actuellement sur le backend**
   - Commande : `cd backend && npm run build` (= `tsc`).
   - Erreurs constatées :
     ```
     src/tasks/notifications-http.test.ts(7,3): error TS2741: Property 'markAllAsRead' is missing in type
       '{ trigger: ...; list: ...; markAsRead: ...; delete: ... }' but required in type 'NotificationsHttpService'.
     src/tasks/notifications-http.test.ts(42,101): error TS2322: Type '() => Promise<{ ...; category: null; ... }[]>'
       is not assignable to type '() => Promise<StoredNotification[]>'.
       Type '{ id; title; message; category: null; readAt: null; createdAt: Date }' is missing the following
       properties from type 'StoredNotification': resourceKind, resourceId, priority
     ```
   - Cause : `NotificationsHttpService` (probablement `backend/src/tasks/notifications-service.ts` /
     `notifications-http.ts`) a été étendu avec `markAllAsRead` et de nouveaux champs (`resourceKind`,
     `resourceId`, `priority`) sur `StoredNotification`, mais le mock utilisé dans
     `backend/src/tasks/notifications-http.test.ts` n'a pas été mis à jour en conséquence.
   - Conséquence : la compilation TypeScript du backend est cassée sur l'état actuel du dépôt — `npm run build`
     (et donc tout déploiement basé sur `dist/`) échoue. Le process backend actuellement en ligne pendant ce
     diagnostic tournait sur un `dist/server.js` compilé **avant** cette régression (build antérieur), ce qui a
     masqué le problème pendant les tests manuels côté navigateur.

2. **CORS : `/api/me` échoue toujours en environnement de développement local par défaut**
   - Fichier : `backend/src/server.ts`, fonction `applyCors` (ligne ~1367).
   - Constat : `applyCors` ne pose `access-control-allow-credentials: true` que si `process.env.FRONTEND_ORIGIN`
     est défini. Or `backend/.env` (le fichier de dev local documenté, `backend/.env.example` inclus) ne définit
     **pas** `FRONTEND_ORIGIN`. Résultat observé en conditions réelles (navigateur, `credentials: 'include'`
     sur le fetch de `/api/me` dans `frontend/src/App.tsx`) : la requête est bloquée par le navigateur
     (`Access-Control-Allow-Credentials` vaut `''` au lieu de `'true'`), donc **le frontend ne peut jamais
     déterminer le rôle de l'utilisateur (Admin ou non) en dev local out-of-the-box**, ce qui cache purement et
     simplement le panel Administration (voir bug-front.md #1 et #2).
   - `docker-compose.yml`, lui, définit bien `FRONTEND_ORIGIN: http://localhost:5173` pour le service `backend`
     — donc le problème n'apparaît qu'en dev "nu" (`npm run dev`/`tsx` + `.env`), pas via docker-compose. Le
     `.env` de dev local devrait documenter/inclure `FRONTEND_ORIGIN` pour éviter ce piège.

3. **`GET /api/me` renvoyait 404 avec le build effectivement en ligne pendant le test**
   - Constat : `curl localhost:3000/api/me` a renvoyé `{"error":"Not found"}` (404) en tout début de diagnostic,
     alors que le code source actuel (`backend/src/server.ts` ligne 180) définit explicitement cette route et
     renvoie toujours `200 { email, role }`. Le process en cours d'exécution (pid capturé, démarré à 15:20:33)
     exécutait un `dist/server.js` compilé **avant** l'ajout de cette route — donc un build obsolète était
     servi en "prod-like" pendant que le code source avait déjà évolué. Ceci confirme qu'un simple `npm run build`
     avant de relancer le service prod-like échouerait de toute façon à cause du bug #1 ci-dessus.

4. **Chevauchement fonctionnel entre modules `catalog`, `development` et `infrastructure` côté routes HTTP**
   - Fichiers : `backend/src/catalog/*-http.ts` (catalog-http, cicd-http, custom-widgets-http, deployment-http,
     extras-http, infra-http, integration-builder-http, proxmox-http) vs `backend/src/development/*-http.ts`
     (dev-activity-http, dev-project-http, dev-template-http, environment-http, release-http).
   - Constat structurel : le module `catalog` héberge à la fois des endpoints de "catalogue d'entités"
     (`catalog-http.ts`), du CI/CD (`cicd-http.ts`), du déploiement (`deployment-http.ts`), et de la
     construction d'intégrations (`integration-builder-http.ts`), alors qu'un module `development` distinct
     existe déjà pour des responsabilités très proches (templates, releases, activité de dev, environnements).
     La frontière entre "ce qui vit dans catalog" et "ce qui vit dans development" ne suit pas de règle
     apparente dans le code (aucun commentaire de module n'explique la séparation), ce qui a pour effet observé
     que le frontend doit interroger `/api/catalog/template`, `/api/catalog/scan`, `/api/development/*` et
     `/api/dev-templates`(via `dev-template-http.ts`) pour des fonctionnalités qui se lisent comme un seul
     domaine "création/gestion de projet" côté utilisateur (cf. panel `dev-templates` séparé de `development`,
     déjà signalé comme TODO dans `frontend/src/App.tsx` ligne 24-26).

5. **`extras-http.ts` sert de fourre-tout pour de nombreuses intégrations tierces**
   - Fichier : `backend/src/catalog/extras-http.ts` expose sous un seul routeur `/api/extras/grafana/*`,
     `/api/extras/harbor/*`, `/api/extras/proxmox/*`, `/api/extras/minio/*`, `/api/extras/rabbitmq/*`,
     `/api/extras/dns/*`, `/api/extras/metrics/node`, `/api/extras/dashboard/widgets`, `/api/extras/wazuh/alerts`
     — une dizaine d'intégrations tierces indépendantes (Proxmox, Harbor, MinIO, RabbitMQ, DNS, Wazuh, Grafana,
     Prometheus...) alors que le module `catalog` a par ailleurs un fichier dédié par intégration pour la
     logique métier (`proxmox.ts`, `harbor.ts`, `minio.ts`, `rabbitmq.ts`, `wazuh.ts`, `grafana.ts`,
     `dns-server.ts`, `prometheus-metrics.ts`...). Le découpage HTTP ne suit donc pas le découpage métier :
     toutes ces intégrations pourtant distinctes partagent un seul fichier `-http.ts` de routage, ce qui rend
     difficile de savoir quel endpoint HTTP correspond à quel service sans lire l'intégralité du fichier.

6. **Le code source backend a été modifié en direct pendant ce diagnostic**
   - Constat : `backend/src/catalog/proxmox-http.ts`, listé et lu en tout début de diagnostic (41 lignes),
     n'existe plus sur le disque au moment de la rédaction de ce rapport — le module `catalog` a été
     restructuré en cours de route (fichiers renommés/fusionnés, ex. `proxmox.ts` sans suffixe `-http`).
     Un `git diff --stat` global montre de nombreux fichiers backend et frontend modifiés pendant la session.
     Conséquence : certains constats structurels ci-dessus peuvent être déjà partiellement corrigés dans une
     version plus récente du code que celle observée au moment précis du test — à revérifier après
     stabilisation du dépôt (voir aussi bug-front.md #4 côté frontend).
