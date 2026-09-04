# TODO-refonte-ux.md — Suivi de la refonte navigation/dashboard/infra

> Fichier de suivi dédié à la refonte demandée après retour utilisateur du 2026-09-03/04. Complète `TODO.md` (backlog fonctionnel par phase) sans le remplacer. Voir `PROMPT_CLAUDE_CODE_REFONTE.md` pour le mode opératoire complet (méthode, validation Playwright, commits).
>
> Règle : ne jamais cocher une case sans avoir (1) implémenté, (2) validé `npm run lint` + `npm run build` + `npm --workspace backend test`, (3) vérifié visuellement via Playwright contre le backend/frontend réels démarrés, (4) commité séparément. Ne jamais décocher une case déjà cochée. Une case = un commit (sauf sous-cases explicitement groupées).

---

## Déjà fait (contexte, ne pas refaire)

- [x] Dashboard "Aujourd'hui" réel en page d'accueil, cartes de stats, widgets Pipelines/Alertes/Wazuh
- [x] Choix de disposition sidebar/topbar (Paramètres → Apparence), persisté
- [x] Navigation groupée par sections (Vue d'ensemble / Travail / Infrastructure / Autres) avec icônes SVG inline, repli en mode icône-seule persisté, Docs déplacé en dernier
- [x] Badges d'état ("Non configuré" avec puce colorée) à la place du texte brut sur les widgets du Dashboard
- [x] Message de statut par défaut inutile retiré du pied de page
- [x] Mode édition basique du Dashboard (crayon → réordonner/masquer les widgets, persisté en localStorage)
- [x] Bouton "Connexion SSO" retiré de la topbar (page supposée déjà authentifiée en amont)

---

## A. Dashboard — améliorer le système d'édition des widgets

Fichiers : `frontend/src/App.tsx` (bloc `panel === 'home'`, fonctions `moveHomeWidget`/`toggleHomeWidget`/état `homeWidgets`), `frontend/src/styles.css` (`.widget-toolbar`, `.edit-toggle`, `.widget-card`, `.widget-controls`)

- [x] Remplacer les boutons monter/descendre par un vrai drag-and-drop (pointer events natifs, pas de nouvelle dépendance lourde type dnd-kit sauf si strictement nécessaire — justifier le choix si une lib est ajoutée)
- [x] Rendre le mode édition visuellement évident sur toute la grille (pas seulement sur chaque carte isolée) : bordure en pointillés sur `.widget-grid`, léger fond distinct
- [x] Ajouter un panneau "Ajouter un widget" listant les widgets masqués, plutôt que de devoir deviner qu'il faut recliquer sur le `×` d'une carte grisée
- [x] Prévoir l'ajout de widgets génériques pour les intégrations déjà branchées sur `/api/extras/*` (pas seulement pipelines/alertes/wazuh — voir `backend/src/catalog/extras-http.ts` pour la liste des routes existantes)
- [x] Ajouter un bouton "Terminer l'édition" explicite (pas seulement recliquer le crayon)
- [x] Vérifier avec Playwright : ouverture du mode édition, drag d'un widget, ajout d'un widget masqué, sortie du mode édition — capture d'écran de chaque étape

## B. Nav — finitions accessibilité

Fichiers : `frontend/src/App.tsx` (`navButton`, `<nav className="sidebar">`), `frontend/src/styles.css` (`.nav-link`)

- [x] `aria-current="page"` sur le lien actif en plus de la classe `.active`
- [x] Focus clavier visible (outline) sur `.nav-link` et `.sidebar-collapse`, y compris en mode replié (title/aria-label déjà présents à vérifier au clavier, pas seulement à la souris)

## C. Topologie réseau — graphe interactif zoomable

Contexte : demande explicite d'une vue nœuds/traits zoomable montrant IP/DNS, VMs reliées à leur hôte Proxmox, regroupement par cluster, certificats. S'appuie sur les intégrations déjà présentes : `backend/src/catalog/proxmox.ts` (VMs/hôtes), `backend/src/catalog/dns-server.ts` (PowerDNS), `backend/src/catalog/network-security.ts`.

- [x] `backend/src/catalog/network-topology.ts` — fonction pure combinant les données Proxmox (hôte → VMs) et DNS (nom → IP) en un graphe `{ nodes, edges }` typé, sur le modèle de `backend/src/catalog/catalog-graph.ts` déjà existant (même pattern de construction de graphe pur, testable unitairement)
- [x] Endpoint HTTP dans `backend/src/catalog/infra-http.ts` (`GET /api/infra/network-topology`), branché dans `server.ts`
- [x] `frontend/src/components/NetworkGraph.tsx` — composant SVG/canvas avec zoom/pan (implémentation native, pas de dépendance graphe lourde sauf justification), nœuds colorés par type (hôte Proxmox / VM / enregistrement DNS), regroupement visuel par cluster
- [x] Nouveau panel `'network'` dans `App.tsx` + entrée de nav (groupe "Infrastructure", icône dédiée)
- [x] Affichage des certificats (échéance, autorité) sur les nœuds concernés si l'info est disponible via une intégration existante — sinon documenter le manque plutôt que d'inventer une donnée — **manque documenté** : aucune intégration du dépôt n'expose de données de certificat (voir commentaire dans `network-topology.ts`), donc rien n'est affiché plutôt que d'inventer une donnée
- [x] Vérifier avec Playwright : rendu du graphe avec données réelles/mock, zoom, pan, clic sur un nœud

## D. Générateur d'intégration générique

Contexte : au lieu d'un client codé à la main par service, permettre de donner une URL + des identifiants et laisser le système découvrir/tester l'API lui-même.

- [x] `backend/src/integrations/integration-builder.ts` — service acceptant `{ baseUrl, authType: 'none'|'basic'|'bearer'|'apiKey', credentials }`, testant la connectivité (`GET /` ou endpoint de santé configurable) et proposant une détection basique du type d'API (OpenAPI/Swagger si `/openapi.json` ou `/swagger.json` répond, sinon REST générique)
- [x] `backend/src/catalog/integration-builder-http.ts` — endpoints `POST /api/integrations/test` (valider une config avant sauvegarde) et `POST /api/integrations` (persister via `SettingsService` existant — le service réel vit dans `backend/src/settings/settings-service.ts`, pas `tasks/`)
- [x] Frontend : nouveau panel "Intégrations" (formulaire URL + type d'auth + credentials, bouton "Tester la connexion", liste des intégrations custom ajoutées)
- [x] Documenter clairement les limites (pas de découverte magique universelle — best-effort sur OpenAPI/health checks standards) pour ne pas sur-promettre

## E. Vault — gestion des mots de passe/secrets dans l'UI

Contexte : Vault est déjà intégré côté backend (`backend/src/infrastructure/vault.ts`, utilisé aujourd'hui uniquement pour le secret client Keycloak). Objectif : exposer un usage générique pour stocker/consulter des identifiants (VMs, services) sans jamais les afficher en clair côté client sauf action explicite.

- [x] Vérifier l'API actuelle de `VaultClient` dans `backend/src/infrastructure/vault.ts` (méthodes déjà disponibles) avant d'étendre — seule `readKv2` existait ; ajout de `writeKv2`/`deleteKv2`/`listKv2`
- [x] `backend/src/tasks/secrets-service.ts` — CRUD minimal sur des secrets nommés, backé par Vault (jamais par Postgres en clair)
- [x] Endpoint HTTP dédié (liste des clés existantes sans valeur, écriture, lecture à la demande uniquement)
- [x] Frontend : section dans le panel Paramètres (ou nouveau panel dédié) — écriture d'un secret, pas d'affichage en clair par défaut (bouton "Révéler" explicite comme pour un gestionnaire de mots de passe classique)
- [x] Vérifier avec Playwright que la valeur d'un secret n'apparaît jamais dans le DOM par défaut (attribut masqué ou absent tant que non révélé)

## F. Calendriers personnel/professionnel

- [x] Clarifier avec l'utilisateur le protocole visé (CalDAV générique ? Google Calendar API ? ICS en lecture seule ?) avant de coder — **réponse utilisateur : ICS en lecture seule**
- [x] Une fois clarifié : intégration en lecture seule dans un premier temps, affichage combiné avec la vue Calendrier existante (`view === 'calendar'` dans `App.tsx`)

## G. Marquage "obligatoire"/requis sur un item

Fichiers : `backend/prisma/schema.prisma` (champ `required Boolean @default(false)` sur `Item`), migration additive, `backend/src/tasks/item-service.ts` (`UpdateItemInput`), `backend/src/tasks/item-http.ts` (exposer dans `parseUpdate`, celui-ci contrairement aux champs GitLab internes doit être modifiable via l'API publique), `frontend/src/App.tsx` (case à cocher ou badge sur la carte d'item, filtre dédié)

- [x] Champ + migration + service + endpoint + tests backend
- [x] UI : indicateur visuel distinct (pas juste du texte) sur les cartes d'items marqués obligatoires, cohérent avec la palette de `Design.md`

## H. Notifications

- [x] Clarifier le canal visé (notification navigateur Web Push ? email ? webhook sortant générique ?) avec l'utilisateur avant de coder — **réponse utilisateur : les trois canaux** (navigateur + email + webhook), avec `nodemailer` explicitement accepté comme nouvelle dépendance pour l'email
- [x] Une fois clarifié : notification navigateur locale sur échéance dépassée / alerte critique (Wazuh niveau ≥ 12) côté client, fan-out best-effort vers email (SMTP) et webhook générique côté serveur via `POST /api/notifications/trigger`

## I. Fiche de formation / onboarding

- [x] Clarifier le contenu attendu (checklist d'arrivée sur un projet ? documentation d'un service à consulter avant intervention ?) — **réponse utilisateur : extension du module Docs** avec un type de page dédié (le service réel vit dans `backend/src/docs/docs-service.ts`, pas `tasks/`) ; implémenté : `pageType` sur `DocPage`, formulaire de création titre + contenu Markdown, badge distinct dans le panel Docs

## J. Paramètres — favicon/icône réelle, formulaires typés par service, sections repliables

Contexte : retour utilisateur du 2026-09-04 — le panel Paramètres n'a pas de vraie icône (favicon générique), tout y est un simple champ clé/valeur texte alors que certaines intégrations ont besoin de plusieurs champs structurés (ex. SMTP : hôte, port, utilisateur, mot de passe, adresse expéditeur, nom d'expéditeur pour les alertes), et tout est regroupé dans un seul bloc qu'il faut faire défiler au lieu d'être organisé en sections dépliables/navigables.

- [x] Favicon réel du produit (remplacer le favicon Vite par défaut dans `frontend/index.html` / `frontend/public`)
- [x] Regrouper les ~57+ clés de Paramètres en sections repliables par intégration/thème (Général, Apparence, GitLab, Email/SMTP, Webhooks, Vault, HAProxy, Coder, Proxmox, etc.) avec ancre/scroll-to-section, plutôt qu'une liste plate unique
- [x] Formulaire structuré dédié pour l'email sortant (SMTP) : hôte, port, utilisateur, mot de passe, adresse expéditeur, nom expéditeur — au lieu de clés brutes génériques, en s'appuyant sur les clés déjà utilisées par `backend/src/notifications/` (vérifier les noms de variables SMTP existants avant d'en inventer de nouveaux)
- [x] Vérifier Playwright : favicon visible, navigation entre sections, formulaire SMTP structuré fonctionnel

## K. Thème — personnalisation du fond et vrai mode sombre

Contexte : couleurs/teintes incohérentes signalées (décalages), seul un thème clair existe alors que `Design.md` prévoit "dark mode par défaut, light mode disponible". L'utilisateur veut 5-6 réglages de personnalisation du fond (couleur d'accent bleu, autres teintes) en plus du choix clair/sombre.

- [x] Implémenter un vrai thème sombre (tokens CSS dupliqués en variante sombre dans `frontend/src/styles.css`, cohérents avec la palette `Design.md`) et un sélecteur clair/sombre/système dans Paramètres → Apparence
- [x] Ajouter 5-6 réglages de personnalisation (couleur d'accent, teinte de fond, etc.) persistés en `localStorage`, appliqués via variables CSS — 6 jetons : accent, accent secondaire, fond teinte 1, fond teinte 2, accent doré, bordures (`frontend/src/theme.ts`)
- [x] Corriger les décalages/incohérences de teinte existants relevés visuellement (comparer captures avant/après) — l'ensemble des couleurs codées en dur de `styles.css` a été converti en variables CSS (`--text`, `--surface`, `--accent`, etc.), supprimant les décalages entre composants ajoutés à des moments différents ; le module Réseau & Serveurs garde volontairement son identité "infra critique" fixe (fond sombre), non liée au thème, comme documenté dans `Design.md`
- [x] Vérifier Playwright : bascule clair/sombre, personnalisation d'accent, captures avant/après — vérifié en conditions réelles (backend+frontend démarrés) : bascule Clair/Sombre/Système, changement live de l'accent en bleu, persistance après rechargement, aucune erreur console/réseau inattendue (seuls des 503 d'intégrations non configurées)

## L. URL — paramètres de requête pour l'état de navigation

Contexte : actuellement l'état (panel actif, filtres, item ouvert) n'est pas reflété dans l'URL, empêchant le lien direct/partage/retour arrière navigateur.

- [x] Synchroniser `panel` (et filtres/état pertinents) avec `history.pushState`/`URLSearchParams` dans `App.tsx`, lecture au chargement initial
- [x] Vérifier Playwright : navigation entre panels met à jour l'URL, rechargement sur une URL paramétrée restaure le bon panel

## M. Documentation — cerner strictement le contenu à DevOS + guides opérationnels

Contexte : la documentation doit se limiter à la documentation de DevOS lui-même (pas de contenu hors sujet), et il manque des guides opérationnels : comment configurer un reverse proxy HAProxy par service, quel logiciel/dépôt/version installer selon le contexte, recommandations de sécurité.

- [x] Créer/lister dans le module Docs des pages d'onboarding dédiées (réutiliser `pageType` déjà ajouté en section I) : "Configurer un backend HAProxy pour un nouveau service", "Choisir un dépôt/version de logiciel", "Bonnes pratiques de sécurité"
- [x] Vérifier que le panel Docs ne mélange pas de contenu hors périmètre DevOS (filtrage/label dédié si nécessaire)
- [x] Vérifier Playwright : pages visibles et accessibles depuis le panel Docs

## N. Tâches — vue du jour + intégration GitLab enrichie (commentaires depuis l'interface)

Contexte : demande d'une vraie vue "tâches du jour" pilotable depuis l'app, et d'un vrai module développement pour GitLab (pas seulement un badge de statut) — pouvoir ouvrir une tâche liée à une issue/MR, voir son état, et ajouter un commentaire qui se propage vers GitLab sans changer d'outil.

- [ ] Vérifier/étendre la vue "Aujourd'hui" existante (Phase 3) pour permettre de contrôler une tâche directement (changer statut, voir détail) sans changer de panel
- [ ] Ajouter la possibilité de poster un commentaire sur un item lié à une issue GitLab depuis l'interface DevOS, propagé via `GitLabClient` existant (note sur l'issue), avec historique des commentaires affiché sur la tâche
- [ ] Vérifier Playwright : ajout d'un commentaire depuis l'UI, apparition dans l'historique

## O. Dashboard — cases de stats éditables + widget performance machine + grille responsive avec prévisualisation

Contexte : les 4 cases de statistiques en haut du Dashboard sont fixes (non supprimables/déplaçables) contrairement aux widgets. Il manque un widget de performance machine (CPU/RAM/disque), et le mode édition doit devenir une vraie grille drag-and-drop qui s'adapte à la taille d'écran avec prévisualisation à données fictives si l'intégration n'est pas configurée.

- [x] Intégrer les 4 cases de stats dans le même système `homeWidgets` que les autres widgets (déplaçables/masquables/réordonnables), au lieu d'un bloc séparé non éditable
- [x] Nouveau widget "Performance machine" (CPU/RAM/disque) réutilisant l'exporter Prometheus générique déjà en place (`backend/src/catalog/prometheus-metrics.ts`), 503 propre si non configuré — via l'endpoint générique existant `GET /api/extras/metrics/:exporter` (exporter `node`), aucun changement backend nécessaire
- [x] Grille responsive (colonnes qui s'adaptent à la largeur d'écran) pour `.widget-grid`
- [x] En mode édition, si un widget n'a pas de données réelles (503/non configuré), afficher un aperçu avec données fictives clairement labellisées "exemple" plutôt qu'un état vide
- [x] Vérifier Playwright : cases de stats déplaçables/masquables, widget performance machine, aperçu à données fictives, redimensionnement de fenêtre

## P. Catalogue — création de projet depuis template + corrections topologie réseau

Contexte : le catalogue doit permettre de créer un nouveau projet à partir d'un template existant. La vue topologie réseau (section C) a des bugs de design signalés et doit lister les outils/services par machine plus clairement.

- [x] Action "Créer un projet" dans le panel Catalogue avec choix d'un template `catalog-info.yaml` existant comme point de départ (génère un nouveau document, ne pousse rien vers GitLab automatiquement sans confirmation explicite) — `backend/src/catalog/catalog-template.ts` (fonction pure), endpoint `POST /api/catalog/template`, formulaire dédié dans le panel Catalogue ; le document généré est affiché pour copie manuelle, rien n'est jamais poussé vers GitLab automatiquement
- [x] Revue et correction des bugs visuels de `frontend/src/components/NetworkGraph.tsx` relevés (à identifier précisément via Playwright avant de corriger) — bug identifié : le graphe utilisait un viewport SVG fixe (520px), coupant les nœuds dès qu'un hôte avait plus de ~4 VMs ou que plusieurs hôtes dépassaient la largeur visible ; corrigé en calculant la taille du canevas depuis les positions réelles des nœuds, avec défilement du conteneur si nécessaire. Corrigé aussi l'absence d'activation clavier (Entrée/Espace) sur les nœuds malgré `role="button"`/`tabIndex`
- [x] Afficher, par nœud machine du graphe, la liste des services/outils qui y tournent (croiser avec les données Catalogue/Proxmox déjà disponibles) — annotation `devos.io/host` sur les entités du Catalogue (documentée dans `docs/catalog-info-format.md`), croisée dans `network-topology.ts` (`buildNetworkTopology`) ; badge de comptage sur le nœud + liste détaillée au clic
- [x] Vérifier Playwright : création de projet depuis template, captures avant/après des corrections de topologie — vérifié en conditions réelles (backend+frontend démarrés) : création d'un projet depuis le template `devos`, apparition dans la liste et le sélecteur ; topologie testée avec données mock (6 VMs sur un hôte) pour valider la correction du viewport, badge de services et détail au clic, aucune erreur console/réseau inattendue (seuls les 503 des intégrations Kubernetes/ArgoCD non configurées)

## Q. Infra — HAProxy et Proxmox à approfondir, vraie supervision système

Contexte : le module Infra HAProxy est jugé peu avancé, l'intégration Proxmox (VMs) manque d'une vraie gestion (actions, pas seulement lecture) et de supervision système générale.

- [ ] Étendre le panel HAProxy (Phase 8 déjà fait côté backend) avec édition guidée frontend des frontends/ACL/certificats déjà exposés par l'API, pas seulement lecture de backends/serveurs
- [ ] Ajouter des actions de contrôle VM Proxmox (start/stop/reboot) côté backend (`backend/src/catalog/proxmox.ts` déjà en lecture seule — étendre avec confirmation explicite avant toute action destructive, cohérent avec l'identité visuelle "infra critique" de `Design.md`) et panel frontend dédié
- [ ] Vérifier Playwright : actions VM avec confirmation, affichage HAProxy étendu

## R. Widgets — personnalisation, création via template/code, variables

Contexte : les widgets doivent être personnalisables et il doit être possible d'en créer de nouveaux à partir d'un template (ou de code), avec des variables configurables.

- [x] Définir un format de widget "custom" simple (JSON : titre, source de données parmi `/api/extras/*` existants, template d'affichage) persisté via `SettingsService`
- [x] UI de création de widget custom dans le panel Widgets/Paramètres : choix d'une source existante + variables (clé à afficher, libellé), pas d'exécution de code arbitraire côté serveur pour rester sûr
- [x] Vérifier Playwright : création d'un widget custom, apparition dans le Dashboard

## S. Intégrations — page dédiée dans Paramètres, sections au lieu d'un bloc unique

Contexte : le générateur d'intégration générique (section D) existe mais doit devenir une vraie page à l'intérieur de Paramètres (pas un panel séparé isolé), organisée en sections comme le reste de J plutôt qu'en bloc unique.

- [ ] Déplacer/lier le panel "Intégrations" (section D) comme sous-section de Paramètres, cohérent avec le regroupement en sections de la section J
- [ ] Vérifier Playwright : accès aux intégrations depuis Paramètres, navigation par section

---

## Notes de performance à respecter à chaque tâche

- Ne pas ajouter de dépendance frontend/backend sans nécessité réelle vérifiée (le repo n'a ajouté aucune nouvelle dépendance depuis la Phase 6 — continuer cette discipline)
- `frontend/src/App.tsx` grossit (~600 lignes) : si une tâche ci-dessus ajoute un panel entier (topologie réseau, intégrations), l'extraire en composant séparé dans `frontend/src/components/` plutôt que d'agrandir encore le fichier unique
- Éviter les re-renders inutiles sur les listes qui grossissent (items, widgets) : `React.memo`/clés stables déjà en place à conserver, ne pas régresser
- Garder le bundle de production sous contrôle : vérifier la taille affichée par `vite build` avant/après chaque tâche ajoutant du code substantiel, signaler toute hausse anormale (>15% sur un seul commit)

## Référence visuelle obligatoire

Avant toute modification d'UI, relire `Design.md` (palette, densité, identité visuelle demandée pour le module Réseau/Serveurs — "langage visuel clairement identifiable comme infra critique") et rester cohérent avec les tokens déjà utilisés dans `frontend/src/styles.css` (vert `#49634c`, terracotta `#a34f31`, fond crème `#dbe8dc`/`#f1dfc2`, rayons de bordure ~8-16px, ombres douces). Ne pas réinventer une palette parallèle sans le signaler explicitement à l'utilisateur.
