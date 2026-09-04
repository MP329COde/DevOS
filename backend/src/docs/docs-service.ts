import type { DocPage, PrismaClient } from '@prisma/client';

const DEFAULT_ONBOARDING_PAGES: ReadonlyArray<{ slug: string; title: string; content: string }> = [
  {
    slug: 'configurer-un-backend-haproxy-pour-un-nouveau-service',
    title: 'Configurer un backend HAProxy pour un nouveau service',
    content: `# Configurer un backend HAProxy pour un nouveau service

Guide pour exposer un nouveau service DevOS derrière le reverse proxy HAProxy externe
(VM "ha-proxy1", 192.168.1.57) qui gère les domaines DuckDNS.

## Checklist
- [ ] Choisir/réserver un sous-domaine DuckDNS (\`dev-mpcode.duckdns.org\` pour les nouveaux outils du cluster, sauf service déjà rattaché à un domaine existant)
- [ ] Créer le backend dans la config HAProxy (ou via la Data Plane API si disponible) : nom explicite \`<service>-backend\`, mode \`http\` ou \`tcp\` selon le protocole
- [ ] Ajouter le(s) serveur(s) du backend : IP interne du pod/VM cible, port applicatif, \`check\` activé pour la supervision de santé HAProxy
- [ ] Ajouter une règle \`frontend\` (ACL sur le nom d'hôte) qui route vers ce backend
- [ ] Terminaison TLS : certificat valide pour le sous-domaine (Let's Encrypt via DuckDNS ou certificat déjà géré par HAProxy), ne jamais exposer en HTTP brut sur Internet
- [ ] Vérifier la propagation DNS DuckDNS puis tester l'accès externe
- [ ] Documenter le nouveau service dans le Catalogue DevOS (\`catalog-info.yaml\` du dépôt correspondant) pour qu'il apparaisse dans la topologie réseau

## Points d'attention
- Le nœud "devops" (192.168.1.97) est déjà proche de la saturation : préférer un service léger, ne pas y ajouter de brique lourde sans validation.
- Toujours passer par le panel Infra HAProxy de DevOS quand une action est disponible plutôt que d'éditer la config à la main, pour garder l'état visible dans l'outil.
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

Toutes les intégrations externes (GitLab, GitHub, Proxmox, HAProxy, Vault, Kubernetes/ArgoCD...)
se paramètrent depuis Paramètres → Intégrations, jamais en dur dans le code.

## Checklist
- [ ] Ouvrir Paramètres → Intégrations et repérer la carte du service à connecter
- [ ] Renseigner l'URL et le token/identifiant requis (stocké via Vault quand c'est le cas, jamais en clair)
- [ ] Utiliser le bouton de test de connexion avant de considérer l'intégration comme active
- [ ] Vérifier qu'un service non configuré répond simplement par une absence de données (503 attendu), sans casser le reste de l'UI
- [ ] Revenir sur cette page pour toute rotation de token ou changement d'URL de service

## Points d'attention
- Le scan de dépôts applicatifs (catalogue de services) reste disponible depuis le panel Catalogue ; la page Docs, elle, ne contient que de la documentation DevOS.
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
