# INFO.md — Référence technique du projet

> Ce fichier est une référence, pas une liste de tâches (voir TODO.md pour les tâches).
> Il contient tout ce qu'il faut savoir sur l'infra existante, les APIs à intégrer, les règles de sécurité et les patterns de modélisation à respecter. À relire avant chaque nouvelle phase.

---

## 1. Contexte et vision du projet (corrigé)

Plateforme tout-en-un, auto-hébergée, qui doit couvrir **l'intégralité de l'usage quotidien sur le réseau et le développement** : gestion de tâches/projets multi-projets, synchronisation GitLab, catalogue de services applicatifs, **ET gestion réelle de l'infrastructure physique/virtuelle** (serveurs Proxmox, réseau, domaines, monitoring uptime) — pas seulement une vue en lecture, un vrai outil d'administration quotidienne.

**Ce n'est plus seulement un outil de gestion de projet avec un catalogue en bonus.** C'est un centre de commande unique pour : ce que j'ai à faire aujourd'hui (tâches), ce qui tourne (services applicatifs), ce qui fait tourner le tout (serveurs, VMs, réseau), et comment j'y accède au quotidien (dev, SSH, environnements Coder).

**Différenciateurs centraux :**
1. Synchronisation bidirectionnelle native et complète des issues avec GitLab self-hosted
2. Gestion active (pas juste lecture) des serveurs/VMs Proxmox et de l'inventaire réseau, directement depuis l'outil

---

## 2. Infrastructure existante (à ne jamais casser, à intégrer ET à gérer)

### Hôtes Proxmox
- **ServeurMP2** — héberge au moins la VM ha-proxy1 (VMID 702, pare-feu Proxmox actif au niveau VM)
- **node2** — hôte Proxmox séparé, `192.168.1.7`, a rejoint le cluster Kubernetes comme worker

### Cluster Kubernetes
- Nœud principal "devops" : `192.168.1.97` — souvent en forte surcharge (load average élevé, disque système mécanique lent, pas idéal pour etcd). **Contrainte impérative : éviter toute brique lourde dessus.**
- Nœud "node2" : `192.168.1.7`
- Stockage distribué : Longhorn
- Load balancing IP : MetalLB (pool `192.168.1.200-220`)
- Monitoring : kube-prometheus-stack (Grafana + Prometheus + Alertmanager)

### Machines séparées (hors cluster K8s)
- GitLab : `192.168.1.65` (domaine `mpc-gitlab.duckdns.org`)
- HAProxy (reverse proxy externe) : VM "ha-proxy1" sur ServeurMP2, `192.168.1.57` — gère les domaines DuckDNS, certificats via certbot standalone (port 8888)
- Wazuh (SIEM) : `192.168.1.154`, machine séparée

### Réseau
- Routeur : Freebox Ultra, plage DHCP réduite à `192.168.1.2-199` pour laisser `192.168.1.200-220` à MetalLB
- Domaines DuckDNS actifs : `dev-mpcode.duckdns.org` (réservé aux nouveaux outils du cluster), `mpc-gitlab.duckdns.org`, `vault-mpcode.duckdns.org`, `coder-mpcode.duckdns.org`, `miam-dllice.duckdns.org`, `hermes-mpcode.duckdns.org`, `design-mp.duckdns.org`, `openclaw-my-family.duckdns.org`

### Services déployés sur le cluster
- HashiCorp Vault (secrets)
- Keycloak (SSO/identité, chart `codecentric/keycloakx`, PostgreSQL dédié)
- Coder (environnements de dev), domaine `coder-mpcode.duckdns.org`, workspace existant `matthew-devspace`
- GitLab Runners (namespace `gitlab-runner`, executor Kubernetes)
- Container Registry GitLab actif (port 5050)

### Prévu mais pas encore fait
Harbor (registre d'images privé), signature d'images Cosign/Sigstore, scans Trivy planifiés

---

## 3. Stack technique retenue

| Couche | Choix | Raison |
|---|---|---|
| Backend | Node.js/TypeScript, monolithe modulaire | Pas de microservices — complexité inutile en solo |
| Base de données | PostgreSQL | Léger, déjà maîtrisé |
| Cache / temps réel | Redis + WebSockets | Léger, standard |
| Frontend | React + Vite | Cohérent avec l'existant |
| Recherche | Meilisearch | Léger, contrairement à Elasticsearch (évité, trop lourd pour le cluster) |
| Auth | Keycloak (OIDC) | Déjà déployé |
| Secrets | HashiCorp Vault | Déjà déployé — coffre-fort unique obligatoire |

---

## 4. Règle de sécurité non négociable

**Aucun secret (token GitLab, kubeconfig, token Proxmox, clé API, token Coder) ne doit jamais être stocké en clair dans PostgreSQL, dans un fichier de config, ou dans une variable d'environnement statique.**

Flux obligatoire :
```
Backend → demande un secret par chemin Vault → Vault (KV v2, ou Kubernetes Auth Method) → secret à courte durée → appel API cible
```

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
secret/proxmox/<nom-hote>/api-token       (NOUVEAU — voir section 6)
secret/github/app-private-key              (si intégré plus tard)
secret/wazuh/token                         (si intégré plus tard)
```

**Pour Proxmox précisément** : créer un token API scope least-privilege (`PVEAuditor` pour la lecture seule du monitoring, `PVEVMAdmin` pour le contrôle des VM) plutôt qu'un compte admin complet. Deux tokens séparés si besoin de distinguer lecture/écriture.

Préférence forte pour le **Kubernetes Auth Method** de Vault plutôt qu'un token Vault statique.

---

## 5. APIs à intégrer, par priorité

### Priorité 1 — Socle
- **GitLab API** (REST v4 + GraphQL + Webhooks) — `https://mpc-gitlab.duckdns.org/api/v4`, endpoints `issues`, `merge_requests`, `pipelines`, pagination par curseur (header `Link`), webhooks `issue`/`merge_request`/`pipeline`/`note`
- **Keycloak** (OIDC + Admin REST API)
- **HashiCorp Vault API** — racine de confiance

### Priorité 2 — Infra applicative
- **Kubernetes API** (`@kubernetes/client-node`) — lecture pods/deployments/nodes
- **ArgoCD API** (REST/gRPC) — statut des Applications
- **Prometheus API** (PromQL) — alimente le Dashboard
- **Grafana API** — panels existants, Service Account token
- **Coder API/CLI** — Templates, Workspaces, Rich Parameters, Autostart/Autostop
- **Harbor API** (une fois déployé)

### Priorité 2bis — Infra physique/virtuelle [NOUVEAU, égal priorité à la 2]

**Proxmox VE API** (REST, `https://<hote>:8006/api2/json/`)
Endpoints confirmés utiles :
- `GET /nodes/{node}/qemu` — liste des VMs du nœud
- `GET /nodes/{node}/lxc` — liste des conteneurs LXC
- `POST /nodes/{node}/qemu/{vmid}/status/start|stop|shutdown|reboot` — contrôle du cycle de vie
- `POST /nodes/{node}/qemu` — création d'une VM
- `GET /cluster/nextid` — obtenir le prochain VMID disponible
- `GET /nodes/{node}/storage` — état du stockage
- Snapshots : création/liste/restauration par VM
- Auth : `Authorization: PVEAPIToken=<id>=<secret>` — token créé dans Datacenter → Permissions → API Tokens

**NetBox — pattern de modélisation à reprendre (pas forcément l'outil lui-même)**
NetBox est LE standard open source IPAM/DCIM (source de vérité réseau), avec un plugin officiel communautaire d'intégration Proxmox déjà existant (`netbox-proxbox`) — preuve que le pattern "Proxmox + inventaire réseau centralisé" est éprouvé. Modèle de données à copier :
```
Site (ex: "homelab")
 └─ Device / VM
     ├─ appartient à un hôte Proxmox (device parent)
     ├─ a une ou plusieurs adresses IP
     ├─ a un rôle (GitLab / HAProxy / Wazuh / K8s node / ...)
     └─ a un statut (actif/hors service/maintenance)
IP Address
 └─ liée à un Device/VM, éventuellement à un enregistrement DNS
DNS Record (domaine DuckDNS ↔ service ↔ route HAProxy)
```

Décision : ne pas déployer NetBox comme outil séparé (redondant avec l'objectif "tout centralisé"), mais **répliquer son modèle de données IPAM/DCIM directement dans le module Réseau & Serveurs de l'outil.**

### Priorité 3 — Élargissement (pas urgent)
GitHub API (via GitHub App), GitHub MCP Registry, HAProxy Data Plane API, Wazuh API

---

## 6. Patterns de modélisation de données à respecter

| Pattern | Origine | Application obligatoire |
|---|---|---|
| Table `items` générique avec colonne `type` (task/doc/goal) | ClickUp | Éviter les tables séparées par concept |
| Vue découplée de la donnée (filtres+groupby+sort paramétrables, rendu séparé) | GitHub Projects v2 | Une seule API de requête ; le frontend choisit juste le composant |
| Hiérarchie Epic > Story > Task avec rollup automatique du statut | Jira | Statut calculé depuis les enfants, jamais fixé manuellement |
| Moteur de règles Trigger → Condition → Action, stocké en JSON | Jira/ClickUp | Remplace un outil d'automatisation externe ; prévoir une action type "nécessite approbation" (pattern Odoo Approvals) |
| Fichier de métadonnées `catalog-info.yaml` à la racine de chaque dépôt | Backstage | Alimente le Catalogue sans configuration manuelle répétée |
| Statut de tâche lié au cycle de vie de la MR associée | OpenProject | Cœur du module de sync GitLab |
| Triage : file d'attente séparée pour toute tâche créée par webhook | Linear | Évite que la sync GitLab pollue directement les boards |
| Time-blocking : positionner une tâche sur une timeline horaire | Huly | Base du Dashboard "Aujourd'hui" |
| **Modèle IPAM/DCIM (Site > Device/VM > IP > DNS Record)** | **NetBox** | **Base du nouveau module Réseau & Serveurs** |
| **Masquer la complexité d'infra à l'affichage** (statut simple, pas les détails K8s bruts) | Azure Container Apps | Catalogue et module Serveurs : afficher "ça tourne, voici l'accès", pas du YAML brut |
| Incrustation de bloc de documentation dans la vue détail d'un autre objet | Odoo Knowledge | Module Docs : un bloc de doc incrusté dans la fiche tâche/projet/serveur, pas juste un lien |

---

## 7. Exigences UX non négociables

- **Command K** (palette de commandes clavier-first) dès le MVP frontend
- Cycles type Linear : report automatique des tâches non terminées à la clôture
- Dashboard "Aujourd'hui" doit inclure : mes tâches, statut pipelines, alertes Grafana, **ET statut up/down des serveurs/services critiques** (pattern Uptime Kuma : checks périodiques ping/HTTP, historique de disponibilité)

---

## 8. Ce qu'on ne recode PAS (hors scope volontaire)

- CI/CD (GitLab CI + ArgoCD suffisent)
- Gestion Git (GitLab suffit)
- Environnements de dev cloud (Coder suffit — l'outil en est un client)
- Chat d'équipe façon Slack
- ERP/facturation
- Système d'auth maison (Keycloak fait foi)
- Hyperviseur/virtualisation maison (Proxmox fait foi — l'outil en est un client, jamais une réimplémentation, exactement comme pour Coder)
