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
- [ ] Focus clavier visible (outline) sur `.nav-link` et `.sidebar-collapse`, y compris en mode replié (title/aria-label déjà présents à vérifier au clavier, pas seulement à la souris)

## C. Topologie réseau — graphe interactif zoomable

Contexte : demande explicite d'une vue nœuds/traits zoomable montrant IP/DNS, VMs reliées à leur hôte Proxmox, regroupement par cluster, certificats. S'appuie sur les intégrations déjà présentes : `backend/src/catalog/proxmox.ts` (VMs/hôtes), `backend/src/catalog/dns-server.ts` (PowerDNS), `backend/src/catalog/network-security.ts`.

- [ ] `backend/src/catalog/network-topology.ts` — fonction pure combinant les données Proxmox (hôte → VMs) et DNS (nom → IP) en un graphe `{ nodes, edges }` typé, sur le modèle de `backend/src/catalog/catalog-graph.ts` déjà existant (même pattern de construction de graphe pur, testable unitairement)
- [ ] Endpoint HTTP dans `backend/src/catalog/infra-http.ts` (`GET /api/infra/network-topology`), branché dans `server.ts`
- [ ] `frontend/src/components/NetworkGraph.tsx` — composant SVG/canvas avec zoom/pan (implémentation native, pas de dépendance graphe lourde sauf justification), nœuds colorés par type (hôte Proxmox / VM / enregistrement DNS), regroupement visuel par cluster
- [ ] Nouveau panel `'network'` dans `App.tsx` + entrée de nav (groupe "Infrastructure", icône dédiée)
- [ ] Affichage des certificats (échéance, autorité) sur les nœuds concernés si l'info est disponible via une intégration existante — sinon documenter le manque plutôt que d'inventer une donnée
- [ ] Vérifier avec Playwright : rendu du graphe avec données réelles/mock, zoom, pan, clic sur un nœud

## D. Générateur d'intégration générique

Contexte : au lieu d'un client codé à la main par service, permettre de donner une URL + des identifiants et laisser le système découvrir/tester l'API lui-même.

- [ ] `backend/src/integrations/integration-builder.ts` — service acceptant `{ baseUrl, authType: 'none'|'basic'|'bearer'|'apiKey', credentials }`, testant la connectivité (`GET /` ou endpoint de santé configurable) et proposant une détection basique du type d'API (OpenAPI/Swagger si `/openapi.json` ou `/swagger.json` répond, sinon REST générique)
- [ ] `backend/src/catalog/integration-builder-http.ts` — endpoints `POST /api/integrations/test` (valider une config avant sauvegarde) et `POST /api/integrations` (persister via `SettingsService` existant, `backend/src/tasks/settings-service.ts` si ce nom existe — vérifier le nom réel du service de paramètres avant de coder)
- [ ] Frontend : nouveau panel "Intégrations" (formulaire URL + type d'auth + credentials, bouton "Tester la connexion", liste des intégrations custom ajoutées)
- [ ] Documenter clairement les limites (pas de découverte magique universelle — best-effort sur OpenAPI/health checks standards) pour ne pas sur-promettre

## E. Vault — gestion des mots de passe/secrets dans l'UI

Contexte : Vault est déjà intégré côté backend (`backend/src/infrastructure/vault.ts`, utilisé aujourd'hui uniquement pour le secret client Keycloak). Objectif : exposer un usage générique pour stocker/consulter des identifiants (VMs, services) sans jamais les afficher en clair côté client sauf action explicite.

- [ ] Vérifier l'API actuelle de `VaultClient` dans `backend/src/infrastructure/vault.ts` (méthodes déjà disponibles) avant d'étendre
- [ ] `backend/src/tasks/secrets-service.ts` — CRUD minimal sur des secrets nommés, backé par Vault (jamais par Postgres en clair)
- [ ] Endpoint HTTP dédié (liste des clés existantes sans valeur, écriture, lecture à la demande uniquement)
- [ ] Frontend : section dans le panel Paramètres (ou nouveau panel dédié) — écriture d'un secret, pas d'affichage en clair par défaut (bouton "Révéler" explicite comme pour un gestionnaire de mots de passe classique)
- [ ] Vérifier avec Playwright que la valeur d'un secret n'apparaît jamais dans le DOM par défaut (attribut masqué ou absent tant que non révélé)

## F. Calendriers personnel/professionnel

- [ ] Clarifier avec l'utilisateur le protocole visé (CalDAV générique ? Google Calendar API ? ICS en lecture seule ?) avant de coder — item explicitement sous-spécifié, ne pas supposer
- [ ] Une fois clarifié : intégration en lecture seule dans un premier temps, affichage combiné avec la vue Calendrier existante (`view === 'calendar'` dans `App.tsx`)

## G. Marquage "obligatoire"/requis sur un item

Fichiers : `backend/prisma/schema.prisma` (champ `required Boolean @default(false)` sur `Item`), migration additive, `backend/src/tasks/item-service.ts` (`UpdateItemInput`), `backend/src/tasks/item-http.ts` (exposer dans `parseUpdate`, celui-ci contrairement aux champs GitLab internes doit être modifiable via l'API publique), `frontend/src/App.tsx` (case à cocher ou badge sur la carte d'item, filtre dédié)

- [ ] Champ + migration + service + endpoint + tests backend
- [ ] UI : indicateur visuel distinct (pas juste du texte) sur les cartes d'items marqués obligatoires, cohérent avec la palette de `Design.md`

## H. Notifications

- [ ] Clarifier le canal visé (notification navigateur Web Push ? email ? webhook sortant générique ?) avec l'utilisateur avant de coder — item sous-spécifié
- [ ] Une fois clarifié : commencer par le cas le plus simple (notification navigateur locale sur échéance dépassée / alerte critique), pas de système de notification distribué complexe sans besoin confirmé

## I. Fiche de formation / onboarding

- [ ] Clarifier le contenu attendu (checklist d'arrivée sur un projet ? documentation d'un service à consulter avant intervention ?) — probablement une extension du module Docs (`backend/src/tasks/docs-service.ts`) avec un type de page dédié plutôt qu'un nouveau module

---

## Notes de performance à respecter à chaque tâche

- Ne pas ajouter de dépendance frontend/backend sans nécessité réelle vérifiée (le repo n'a ajouté aucune nouvelle dépendance depuis la Phase 6 — continuer cette discipline)
- `frontend/src/App.tsx` grossit (~600 lignes) : si une tâche ci-dessus ajoute un panel entier (topologie réseau, intégrations), l'extraire en composant séparé dans `frontend/src/components/` plutôt que d'agrandir encore le fichier unique
- Éviter les re-renders inutiles sur les listes qui grossissent (items, widgets) : `React.memo`/clés stables déjà en place à conserver, ne pas régresser
- Garder le bundle de production sous contrôle : vérifier la taille affichée par `vite build` avant/après chaque tâche ajoutant du code substantiel, signaler toute hausse anormale (>15% sur un seul commit)

## Référence visuelle obligatoire

Avant toute modification d'UI, relire `Design.md` (palette, densité, identité visuelle demandée pour le module Réseau/Serveurs — "langage visuel clairement identifiable comme infra critique") et rester cohérent avec les tokens déjà utilisés dans `frontend/src/styles.css` (vert `#49634c`, terracotta `#a34f31`, fond crème `#dbe8dc`/`#f1dfc2`, rayons de bordure ~8-16px, ombres douces). Ne pas réinventer une palette parallèle sans le signaler explicitement à l'utilisateur.
