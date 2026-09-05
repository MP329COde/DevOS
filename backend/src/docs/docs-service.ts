import type { DocPage, PrismaClient } from '@prisma/client';

const DEFAULT_ONBOARDING_PAGES: ReadonlyArray<{ slug: string; title: string; content: string }> = [
  {
    slug: 'configurer-un-backend-haproxy-pour-un-nouveau-service',
    title: 'Configurer un backend HAProxy pour un nouveau service',
    content: `# Configurer un backend HAProxy pour un nouveau service

Guide pour connecter HAProxy à la plateforme DevOS, puis exposer un nouveau service
derrière le reverse proxy externe (VM "ha-proxy1", 192.168.1.57) qui gère les domaines DuckDNS.

## Étape 1 — Connecter HAProxy à DevOS
- [ ] Aller dans **Paramètres → Intégrations → HAProxy**
- [ ] Renseigner \`HAPROXY_DATA_PLANE_URL\` (URL de la Data Plane API HAProxy, ex. \`https://ha-proxy1.internal:5555\`), \`HAPROXY_USERNAME\` et \`HAPROXY_PASSWORD\`
- [ ] Enregistrer, puis ouvrir le panel **Infra HAProxy** (menu "Infrastructure") : les frontends, backends et certificats doivent apparaître si la connexion est correcte
- [ ] Si le panel reste vide, vérifier que la Data Plane API est bien activée sur la VM HAProxy et joignable depuis le backend DevOS (pas de blocage réseau/pare-feu)

## Étape 2 — Exposer un nouveau service
- [ ] Choisir/réserver un sous-domaine DuckDNS (\`dev-mpcode.duckdns.org\` pour les nouveaux outils du cluster, sauf service déjà rattaché à un domaine existant)
- [ ] Depuis le panel **Infra HAProxy** de DevOS, créer le backend : nom explicite \`<service>-backend\`, mode \`http\` ou \`tcp\` selon le protocole
- [ ] Ajouter le(s) serveur(s) du backend : IP interne du pod/VM cible, port applicatif, \`check\` activé pour la supervision de santé HAProxy
- [ ] Ajouter une règle \`frontend\` (ACL sur le nom d'hôte) qui route vers ce backend
- [ ] Terminaison TLS : certificat valide pour le sous-domaine (Let's Encrypt via DuckDNS ou certificat déjà géré par HAProxy), ne jamais exposer en HTTP brut sur Internet
- [ ] Vérifier la propagation DNS DuckDNS puis tester l'accès externe
- [ ] Documenter le nouveau service dans le Catalogue DevOS (\`catalog-info.yaml\` du dépôt correspondant) pour qu'il apparaisse dans la topologie réseau

## Points d'attention
- Le nœud "devops" (192.168.1.97) est déjà proche de la saturation : préférer un service léger, ne pas y ajouter de brique lourde sans validation.
- Toujours passer par le panel Infra HAProxy de DevOS une fois la connexion établie, plutôt que d'éditer la config à la main, pour garder l'état visible dans l'outil.
`,
  },
  {
    slug: 'vue-d-ensemble-des-pages-devos',
    title: "Vue d'ensemble des pages DevOS",
    content: `# Vue d'ensemble des pages DevOS

Repère rapide de chaque page (panel) de la plateforme, son rôle, et si elle nécessite une
intégration externe pour afficher des données.

## Travail
- **Accueil / Dashboard** — écran de départ : widgets (pipelines, alertes, sources personnalisées), vue "Aujourd'hui" (tâches et commentaires du jour).
- **Notes** — prise de notes personnelle liée à la plateforme.

## Infrastructure
- **Infra HAProxy** — frontends/ACLs, backends/serveurs et certificats TLS du reverse proxy externe. Nécessite \`HAPROXY_DATA_PLANE_URL\`/\`HAPROXY_USERNAME\`/\`HAPROXY_PASSWORD\` (Paramètres → Intégrations → HAProxy) — voir le guide "Configurer un backend HAProxy pour un nouveau service".
- **Proxmox** — état des VM/CT de l'hyperviseur. Nécessite \`PROXMOX_BASE_URL\`/\`PROXMOX_API_TOKEN\`.
- **Réseau** — topologie réseau et supervision DNS/sécurité (PowerDNS, Suricata, WireGuard, NATS), alimentée par le catalogue et les intégrations réseau configurées.

## Plateforme
- **Catalogue** — inventaire des services (\`catalog-info.yaml\` de chaque dépôt), scanné via les intégrations GitLab/GitHub configurées.
- **Docs** — ce module : uniquement les guides d'usage et de fonctionnement de DevOS (jamais de documentation de dépôt externe, qui reste dans son projet de développement).
- **Développement** — vue globale des projets, dashboard par projet, assistant de création de nouveaux projets/services.
- **Déploiement** — suivi des déploiements (Kubernetes/ArgoCD, CI/CD), nécessite les intégrations correspondantes (\`K8S_API_SERVER\`, \`ARGOCD_BASE_URL\`, \`WOODPECKER_BASE_URL\`...).
- **Widgets** — activation/désactivation des widgets affichés sur le Dashboard.
- **Paramètres** — apparence (thème, disposition), intégrations externes, notifications, comptes plateforme dédiés, générateur d'intégration custom.

## Points d'attention
- Un panel vide ou affichant une erreur 503 signifie généralement une intégration non configurée, pas un bug : vérifier Paramètres → Intégrations en premier réflexe.
- La liste des groupes de navigation peut varier légèrement selon la configuration de la disposition (barre latérale ou barre du haut), mais les pages listées ici restent les mêmes.
`,
  },
  {
    slug: 'choisir-un-depot-version-de-logiciel',
    title: 'Choisir un dépôt/version de logiciel',
    content: `# Choisir un dépôt/version de logiciel

Recommandations pour choisir quoi installer et quelle version cibler dans l'infrastructure DevOS,
en cohérence avec la stack déjà validée (voir INFO.md section 3).

## Checklist
- [ ] Vérifier si un équivalent léger est déjà déployé sur le cluster avant d'ajouter un nouvel outil (éviter la redondance — ex. ne pas réintroduire Elasticsearch alors que Meilisearch est déjà retenu)
- [ ] Préférer un dépôt officiel maintenu activement (releases régulières, CVE suivies) à un fork ou un paquet tiers non maintenu
- [ ] Cibler une version stable (pas de \`latest\`/\`main\` en production) ; noter la version exacte dans \`catalog-info.yaml\` du service
- [ ] Vérifier la compatibilité avec l'infra existante : PostgreSQL simple + Redis sont les briques de données validées, éviter d'introduire une base de données lourde (voir contrainte de saturation du nœud "devops")
- [ ] Vérifier la disponibilité d'une image/chart Helm officielle pour un déploiement Kubernetes cohérent avec le reste du cluster
- [ ] Planifier la mise à jour : suivre les CVE du composant, prévoir une fenêtre de mise à jour régulière plutôt que de figer une version indéfiniment

## Points d'attention
- Toute nouvelle brique lourde doit être isolée sur une machine dédiée si le nœud "devops" est déjà chargé.
- Ne pas dupliquer un outil déjà couvert : voir la section "Ce qu'on ne recode/ré-héberge pas" avant d'ajouter un service équivalent à l'existant.
`,
  },
  {
    slug: 'bonnes-pratiques-de-securite',
    title: 'Bonnes pratiques de sécurité',
    content: `# Bonnes pratiques de sécurité

Rappel des règles de sécurité non négociables pour tout nouveau service ou intégration
DevOS (voir INFO.md section 4 pour la référence complète).

## Checklist
- [ ] Aucun secret (token, mot de passe, clé API, kubeconfig) en clair dans PostgreSQL, un fichier de config versionné, ou une variable d'environnement statique
- [ ] Tout secret passe par HashiCorp Vault (KV v2), référencé depuis PostgreSQL uniquement par son chemin Vault
- [ ] Préférer le Kubernetes Auth Method de Vault à un token Vault statique pour l'authentification du backend
- [ ] Scoper les tokens d'API au strict nécessaire (ex. Project/Group Access Token GitLab plutôt qu'un token global \`api\` sur tout le groupe)
- [ ] Vérifier qu'aucun secret n'apparaît dans les logs applicatifs ni dans le DOM par défaut côté frontend (masquage explicite, action "Révéler" requise)
- [ ] TLS obligatoire pour tout service exposé au-delà du réseau local (voir guide HAProxy)
- [ ] Surveiller les alertes Wazuh (SIEM, 192.168.1.154) pour tout nouveau service exposé

## Points d'attention
- Cette checklist s'applique à toute nouvelle intégration ajoutée via le générateur d'intégration générique ou le Vault applicatif — ne pas contourner le flux Vault même pour un test rapide.
`,
  },
  {
    slug: 'prendre-en-main-le-dashboard-devos',
    title: 'Prendre en main le Dashboard DevOS',
    content: `# Prendre en main le Dashboard DevOS

Le Dashboard est l'écran d'accueil de DevOS : il regroupe les widgets (pipelines, alertes,
sources personnalisées) et sert de point de départ vers les autres modules (Infra, Catalogue,
Docs, Paramètres...).

## Checklist
- [ ] Repérer la barre latérale de navigation (groupes Travail / Infra / Plateforme) et la flèche de réduction pour la replier/déplier
- [ ] Activer/désactiver les widgets utiles depuis le panel Widgets (ou Paramètres selon la version)
- [ ] Personnaliser l'ordre et la disposition des widgets si l'édition est activée
- [ ] Consulter la vue "Aujourd'hui" pour les tâches et commentaires du jour
- [ ] Ouvrir Paramètres pour ajuster thème, intégrations et widgets custom

## Points d'attention
- Le Dashboard n'affiche que les widgets pour lesquels une intégration est configurée ou une source \`/api/extras/*\` existe ; un widget vide n'est pas une erreur.
`,
  },
  {
    slug: 'configurer-les-integrations-devos',
    title: 'Configurer les intégrations DevOS',
    content: `# Configurer les intégrations DevOS

Toutes les intégrations externes se paramètrent depuis **Paramètres → Intégrations**, jamais en
dur dans le code. Chaque section correspond à un outil et à ses identifiants propres.

## Procédure générale
- [ ] Ouvrir Paramètres → Intégrations et repérer la section du service à connecter
- [ ] Renseigner l'URL et le token/identifiant requis (stocké via Vault quand c'est le cas, jamais en clair)
- [ ] Enregistrer, puis ouvrir le panel correspondant (ex. Infra HAProxy, Proxmox, Développement) : les données doivent apparaître si la connexion est correcte
- [ ] Vérifier qu'un service non configuré répond simplement par une absence de données (503 attendu), sans casser le reste de l'UI
- [ ] Revenir sur cette page pour toute rotation de token ou changement d'URL de service

## Sections disponibles (clés attendues)
- **HAProxy** — \`HAPROXY_DATA_PLANE_URL\`, \`HAPROXY_USERNAME\`, \`HAPROXY_PASSWORD\` (voir le guide dédié "Configurer un backend HAProxy pour un nouveau service")
- **GitLab** — \`GITLAB_BASE_URL\`, \`GITLAB_TOKEN\`, \`GITLAB_PROJECT_ID\`
- **GitHub** — \`GITHUB_TOKEN\`, \`GITHUB_BASE_URL\`
- **Proxmox** — \`PROXMOX_BASE_URL\`, \`PROXMOX_API_TOKEN\`
- **Coder** — \`CODER_BASE_URL\`, \`CODER_TOKEN\`, \`CODER_ORGANIZATION_ID\`, \`CODER_OWNER\`, \`CODER_DEFAULT_TEMPLATE_ID\`
- **Kubernetes / ArgoCD** — \`K8S_API_SERVER\`, \`K8S_TOKEN\`, \`ARGOCD_BASE_URL\`, \`ARGOCD_TOKEN\`, \`DEPLOYMENT_CENTRAL_REPO_URL\`
- **Monitoring & alerting** — \`GRAFANA_BASE_URL\`, \`GRAFANA_API_KEY\`, \`ALERTMANAGER_BASE_URL\`, \`PROMETHEUS_EXPORTERS\`, \`WAZUH_BASE_URL\`, \`WAZUH_TOKEN\`
- **Réseau (DNS/sécurité)** — \`POWERDNS_BASE_URL\`, \`POWERDNS_API_KEY\`, \`POWERDNS_SERVER_ID\`, \`SURICATA_BASE_URL\`, \`WIREGUARD_EXPORTER_BASE_URL\`, \`NATS_MONITOR_BASE_URL\`
- **Stockage & registres** — \`MINIO_BASE_URL\`/\`MINIO_ACCESS_KEY\`/\`MINIO_SECRET_KEY\`, \`HARBOR_BASE_URL\`/\`HARBOR_USERNAME\`/\`HARBOR_PASSWORD\`, \`NEXUS_BASE_URL\`/\`NEXUS_USERNAME\`/\`NEXUS_PASSWORD\`, \`VERDACCIO_BASE_URL\`/\`VERDACCIO_TOKEN\`
- **CI/CD** — \`WOODPECKER_BASE_URL\`, \`WOODPECKER_TOKEN\`
- **Webhooks & Vault** — \`NOTIFICATIONS_WEBHOOK_URL\` ; Vault ne prend pas d'URL/token statique ici, voir le guide "Bonnes pratiques de sécurité"
- **Comptes plateforme** — \`GITHUB_PLATFORM_USERNAME\`/\`GITHUB_PLATFORM_EMAIL\`/\`GITHUB_PLATFORM_TOKEN\`, \`GITLAB_PLATFORM_USERNAME\`/\`GITLAB_PLATFORM_EMAIL\`/\`GITLAB_PLATFORM_TOKEN\` — identité dédiée à DevOS, distincte des tokens GitLab/GitHub utilisés pour le catalogue

## Points d'attention
- Le scan de dépôts applicatifs (catalogue de services) reste disponible depuis le panel Catalogue ; la page Docs, elle, ne contient que de la documentation DevOS.
- Pour un outil non listé ci-dessus, utiliser le générateur d'intégration (custom) accessible depuis Paramètres.
`,
  },
];

export class DocsService {
  public constructor(private readonly database: PrismaClient) {}

  public list(): Promise<DocPage[]> {
    // The global Docs area is deliberately limited to DevOS guides. Project documentation
    // lives under its development project and must never leak into this platform handbook.
    return this.database.docPage.findMany({ where: { sourceProject: 'onboarding' }, orderBy: { title: 'asc' } });
  }

  /**
   * Onboarding pages (checklists, service runbooks to read before intervening) live in the
   * same DocPage model as the rest of the application, while remaining scoped to the platform
   * handbook by its stable `onboarding` source.
   */
  public createOnboardingPage(title: string, content: string): Promise<DocPage> {
    const path = `onboarding/${slugify(title)}`;
    return this.database.docPage.create({
      data: { sourceProject: 'onboarding', path, title, content, pageType: 'onboarding' },
    });
  }

  /**
   * Seeds the fixed set of operational onboarding guides (HAProxy backend setup, software
   * choice, security practices — see section M of TODO-refonte-ux.md) if they are not already
   * present. Idempotent: upserts by the same (sourceProject, path) pair as `sync`, using a
   * stable slug per guide (unlike `createOnboardingPage`'s timestamp-suffixed slug) so calling
   * this again — e.g. on every server startup — never creates duplicates.
   */
  public async ensureDefaultOnboardingPages(): Promise<DocPage[]> {
    return Promise.all(DEFAULT_ONBOARDING_PAGES.map((page) => this.database.docPage.upsert({
      where: { sourceProject_path: { sourceProject: 'onboarding', path: `onboarding/${page.slug}` } },
      create: { sourceProject: 'onboarding', path: `onboarding/${page.slug}`, title: page.title, content: page.content, pageType: 'onboarding' },
      update: { title: page.title, content: page.content },
    })));
  }

  public get(id: string): Promise<DocPage | null> {
    return this.database.docPage.findUnique({ where: { id } });
  }

  public async link(docPageId: string, itemId: string): Promise<void> {
    await this.database.docLink.upsert({
      where: { docPageId_itemId: { docPageId, itemId } },
      create: { docPageId, itemId },
      update: {},
    });
  }

  public async unlink(docPageId: string, itemId: string): Promise<void> {
    await this.database.docLink.deleteMany({ where: { docPageId, itemId } });
  }

  public linkedItemIds(docPageId: string): Promise<string[]> {
    return this.database.docLink.findMany({ where: { docPageId }, select: { itemId: true } }).then((rows) => rows.map((row) => row.itemId));
  }
}

function slugify(title: string): string {
  const base = title.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return `${base || 'page'}-${Date.now().toString(36)}`;
}
