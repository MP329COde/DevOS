# INFO.md — Référence technique du projet

> Ce fichier est une référence, pas une liste de tâches (voir TODO.md pour les tâches).
> Il contient tout ce qu'il faut savoir sur l'infra existante, les APIs à intégrer, les règles de sécurité et les patterns de modélisation à respecter. À relire avant chaque nouvelle phase.

---

## 1. Contexte du projet

Plateforme DevOps + gestion de projets tout-en-un, auto-hébergée, pour un homelab personnel. Construite from scratch après analyse comparative de Backstage, Plane, OpenProject, Tuleap, Huly, ZenTao, GitLab CE, Azure DevOps, GitHub, Jira, ClickUp, Linear, Monday — aucun ne couvrant l'ensemble des besoins sans compromis majeur.

**Le différenciateur central du produit** : synchronisation bidirectionnelle native et complète des issues avec GitLab self-hosted (aucun outil du marché ne le fait bien aujourd'hui), combinée à un catalogue de services/infra et un dashboard unifié.

---

## 2. Infrastructure existante (à ne jamais casser, à intégrer)

### Cluster Kubernetes
- Nœud principal "devops" : `192.168.1.97` — souvent en forte surcharge (load average élevé, disque système mécanique lent, pas idéal pour etcd)
- Nœud "node2" : `192.168.1.7` (Proxmox host séparé "ServeurMP2")
- Stockage distribué : Longhorn
- Load balancing IP : MetalLB (pool `192.168.1.200-220`)
- Monitoring : kube-prometheus-stack (Grafana + Prometheus + Alertmanager)

### Machines séparées
- GitLab : `192.168.1.65` (domaine `mpc-gitlab.duckdns.org`)
- HAProxy (reverse proxy externe) : VM "ha-proxy1", `192.168.1.57` — gère les domaines DuckDNS
- Wazuh (SIEM) : `192.168.1.154`, machine séparée

### Services déployés sur le cluster
- HashiCorp Vault (secrets)
- Keycloak (SSO/identité, chart `codecentric/keycloakx`, PostgreSQL dédié)
- Coder (environnements de dev), domaine `coder-mpcode.duckdns.org`, workspace existant `matthew-devspace`
- GitLab Runners (namespace `gitlab-runner`, executor Kubernetes)
- Container Registry GitLab actif (port 5050)

### Domaines DuckDNS déjà configurés
`dev-mpcode.duckdns.org` (réservé aux nouveaux outils du cluster), `mpc-gitlab.duckdns.org`, `vault-mpcode.duckdns.org`, `coder-mpcode.duckdns.org`

### Prévu mais pas encore fait
Harbor (registre d'images privé), signature d'images Cosign/Sigstore, scans Trivy planifiés

### ⚠️ Contrainte impérative
Le nœud "devops" (192.168.1.97) est déjà proche de la saturation. Toute nouvelle brique lourde (bases de données type Elasticsearch/CockroachDB) doit être évitée ou isolée sur une machine dédiée. Préférer PostgreSQL simple + Redis, déjà validés comme légers.

---

## 3. Stack technique retenue

| Couche | Choix | Raison |
|---|---|---|
| Backend | Node.js/TypeScript, monolithe modulaire | Pas de microservices — complexité inutile en solo |
| Base de données | PostgreSQL | Léger, déjà maîtrisé (voir Nexus Console) |
| Cache / temps réel | Redis + WebSockets | Léger, standard |
| Frontend | React + Vite | Cohérent avec l'existant |
| Recherche | Meilisearch | Léger, contrairement à Elasticsearch (évité, trop lourd pour le cluster) |
| Auth | Keycloak (OIDC) | Déjà déployé — ne pas réinventer l'authentification |
| Secrets | HashiCorp Vault | Déjà déployé — coffre-fort unique obligatoire |

---

## 4. Règle de sécurité non négociable

**Aucun secret (token GitLab, kubeconfig, clé API, token Coder) ne doit jamais être stocké en clair dans PostgreSQL, dans un fichier de config, ou dans une variable d'environnement statique.**

Flux obligatoire :
```
Backend → demande un secret par chemin Vault → Vault (KV v2, ou Kubernetes Auth Method) → secret à courte durée → appel API cible
```

PostgreSQL ne stocke QUE des références (chemins Vault), jamais les secrets eux-mêmes.

### Structure Vault recommandée
```
secret/gitlab/token
secret/gitlab/webhook-secret
secret/keycloak/client
secret/k8s/<nom-cluster>/kubeconfig
secret/argocd/token
secret/grafana/token
secret/harbor/robot-token
secret/coder/token
secret/github/app-private-key   (si intégré plus tard)
secret/proxmox/token             (si intégré plus tard)
secret/wazuh/token                (si intégré plus tard)
```

Préférence forte pour le **Kubernetes Auth Method** de Vault plutôt qu'un token Vault statique : le backend s'authentifie via son propre ServiceAccount K8s.

---

## 5. APIs à intégrer, par priorité, avec détails d'usage

### Priorité 1 — Socle

**GitLab API (REST v4 + GraphQL + Webhooks)**
- Base : `https://mpc-gitlab.duckdns.org/api/v4`
- Endpoints clés : `GET /projects/:id/issues`, `POST /projects/:id/issues/:iid/notes`, `GET /projects/:id/merge_requests`, `GET /projects/:id/pipelines`
- Pagination par curseur (header `Link`) — à gérer proprement, ne pas assumer une pagination par offset
- Webhooks à écouter : `issue`, `merge_request`, `pipeline`, `note` — le payload `pipeline` inclut déjà le statut par job
- Auth : Project/Group Access Token scope `api`, scope limité par projet plutôt qu'un token global
- Pattern de détection de lien : rechercher `#<iid>` dans les titres de branche/commit pour lier automatiquement code ↔ tâche
- Système de labels à réutiliser tel quel : `type::bug`, `priority::high` (préfixe + valeur, filtrage multi-dimensionnel)
- Liens typés entre issues à répliquer : `relates_to` / `blocks` / `is_blocked_by`

**Keycloak (OIDC + Admin REST API)**
- Auth SSO du backend et du frontend
- Client OIDC dédié à créer dans le realm Keycloak existant

**HashiCorp Vault API**
- Racine de confiance, voir section 4

### Priorité 2 — Infra/catalogue

**Kubernetes API** (`@kubernetes/client-node`)
- Lecture seule : pods, deployments, nodes, ressources (CPU/RAM utilisés)
- Auth via ServiceAccount token (Kubernetes Auth Method Vault de préférence)

**ArgoCD API** (REST/gRPC)
- Statut des Applications, historique de sync
- Compte de service dédié, lecture seule

**Prometheus API** (requêtes PromQL en HTTP)
- Pour alimenter le Dashboard "Aujourd'hui"

**Grafana API**
- Récupérer des panels existants sans les recréer — Service Account token, scope lecture seule

**Coder API/CLI** (voir aussi doc dédiée "analyse-approfondie-par-outil.md" section 11)
- Concepts clés : Templates (définitions Terraform d'environnement), Workspaces (instance d'un template), Rich Parameters (choix à la création), Autostart/Autostop
- Endpoints CLI équivalents à REST : création (`POST /workspaces`), état, arrêt/démarrage
- Mapping à construire : chaque "Projet" de l'outil référence un `template_name` Coder par défaut
- Auto-stop à déclencher quand une tâche passe "Done" (économie de ressources — nœud devops déjà saturé)

**Harbor API** (une fois déployé)
- Liste des images, résultats de scan Trivy intégré

### Priorité 3 — Élargissement (pas urgent)
GitHub API (REST/GraphQL/Webhooks, via GitHub App plutôt que PAT), GitHub MCP Registry, Proxmox API, HAProxy Data Plane API, Wazuh API

---

## 6. Patterns de modélisation de données à respecter

| Pattern | Origine | Application obligatoire |
|---|---|---|
| Table `items` générique avec colonne `type` (task/doc/goal) | ClickUp | Éviter les tables séparées par concept — simplifie recherche/vues transverses |
| Vue découplée de la donnée (filtres+groupby+sort paramétrables, rendu séparé) | GitHub Projects v2 | Une seule API de requête ; le frontend choisit juste le composant (liste/board/gantt) |
| Hiérarchie Epic > Story > Task avec rollup automatique du statut | Jira | Le statut d'une Epic se calcule depuis ses enfants, jamais fixé manuellement |
| Moteur de règles Trigger → Condition → Action, stocké en JSON, évalué à chaque webhook | Jira/ClickUp | Remplace le besoin d'un outil d'automatisation externe |
| Fichier de métadonnées `catalog-info.yaml` à la racine de chaque dépôt | Backstage | Alimente le module Catalogue sans configuration manuelle répétée |
| Statut de tâche lié au cycle de vie de la MR associée (open/merged/closed) | OpenProject | Cœur du module de sync GitLab |
| Triage : file d'attente séparée pour toute tâche créée automatiquement par webhook, avant intégration au board | Linear | Évite que la sync GitLab pollue directement les boards |
| Time-blocking : positionner une tâche sur une timeline horaire, pas juste une liste | Huly | Base du Dashboard "Aujourd'hui" |

---

## 7. Exigences UX non négociables

- **Command K** (palette de commandes clavier-first, type `cmdk` en React) dès le MVP frontend — élément différenciant le plus fort observé chez Linear
- Cycles type Linear : à la clôture, les tâches non terminées se déplacent automatiquement au cycle suivant (pas de replanification manuelle)

---

## 8. Ce qu'on ne recode PAS (hors scope volontaire)

- CI/CD (GitLab CI + ArgoCD suffisent)
- Gestion Git (GitLab suffit)
- Environnements de dev cloud (Coder suffit — l'outil en est un client, jamais une réimplémentation)
- Chat d'équipe façon Slack
- ERP/facturation
- Système d'auth maison (Keycloak fait foi)
