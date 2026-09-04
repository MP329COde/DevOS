# TODO-refonte-2.md — Suivi de la refonte v2 (Dashboard, Développement, Thèmes, Domaines...)

> Complète `TODO-refonte-ux.md` (sections A-S, terminées) sans le remplacer. Demande utilisateur du 2026-09-04, périmètre très large — traité par vagues priorisées, une section à la fois.
>
> Règle identique : ne jamais cocher une case sans avoir (1) implémenté, (2) validé `npm run lint` + `npm run build` + `npm --workspace backend test`, (3) vérifié visuellement via Playwright (playwright-cli, Chrome) contre le backend/frontend réels démarrés, (4) commité séparément. Ne jamais décocher une case déjà cochée.

---

## T. Dashboard — finitions

- [ ] Message d'accueil personnalisé "Bonjour, {nom}" en haut du Dashboard (utiliser le nom disponible côté session/profil ; fallback générique si aucun nom résolu)
- [ ] Corriger l'affichage/comportement de la barre d'outils (toolbar d'édition des widgets) en disposition non-horizontale (barre latérale) — actuellement illisible
- [ ] Repositionner/finaliser la flèche de réduction de la barre latérale (`.sidebar-collapse`)
- [ ] Icône Paramètres : remplacer le soleil actuel par un engrenage
- [ ] Vérifier Playwright

## U. Docs — recentrer sur DevOS uniquement

- [ ] Retirer le scan de dépôts GitLab de la page Docs (bouton + logique dans le panel Docs) — la doc doit être 100% DevOS (usage/fonctionnalités de la plateforme), pas du contenu de dépôts externes
- [ ] Retirer le bouton "Scanner les dépôts GitLab" de toutes les pages où il apparaît hors de son emplacement légitime (Catalogue notamment) ; centraliser cette action dans les Intégrations/Paramètres si elle reste utile ailleurs (catalogue applicatif, pas doc)
- [ ] Repenser le contenu de la page Docs autour de vraies pages d'aide DevOS (déjà amorcé en section M/I avec `pageType: onboarding` — étendre)
- [ ] Vérifier Playwright

## V. Notes — module indépendant

- [x] Nouveau type de contenu "note" libre + todo-list externe, non rattaché à un projet (backend : nouveau statut/flag ou nouvel `ItemType` `note` à évaluer selon le schéma existant)
- [x] Nouveau panel "Notes" dans la nav (groupe Travail), CRUD simple (titre, contenu markdown, cases à cocher)
- [x] Vérifier Playwright

## W. Comptes GitHub/GitLab dédiés à la plateforme

- [ ] Permettre de configurer un compte GitHub et un compte GitLab appartenant à DevOS lui-même (pas à un utilisateur), utilisés pour la création de dépôts/versioning/sauvegardes autonomes — nouvelle section Paramètres, réutilise `SettingsService`
- [ ] Vérifier Playwright

## X. Travail — fusionner les onglets fractionnés

- [ ] Fusionner Tâches/Triage/Aujourd'hui (ou le sous-ensemble concerné) en un seul onglet cohérent avec sous-vues internes plutôt que des panels séparés, sans perdre de fonctionnalité
- [ ] Vérifier Playwright

## Y. Notifications et erreurs — header dédié

- [ ] Header avec centre de notifications/erreurs + raccourcis rapides
- [ ] Header personnalisable (liens externes ajoutables)
- [ ] Paramétrage des notifications déplacé de Paramètres utilisateur vers une zone Administrateur dédiée (nouveau concept de rôle admin distinct si absent)
- [ ] Vérifier Playwright

## Z. Authentification — interface uniquement

- [ ] Écrans de login complets (email uniquement, sans Keycloak obligatoire) navigables, sans branchement réel obligatoire — juste le parcours UI
- [ ] Vérifier Playwright

## AA. Identité visuelle et animations

- [ ] Fond dynamique animé (léger, CSS/canvas, pas de vidéo)
- [ ] Logo/favicon animé au survol
- [ ] Icônes animées au survol, généralisées au-delà de la sidebar
- [ ] Direction "liquid glass" (glassmorphism cohérent avec la palette existante)
- [ ] Adaptation grands écrans / ultra-wide (max-width contrôlé, grilles qui exploitent l'espace)
- [ ] Transitions de page/panneaux cohérentes
- [ ] Vérifier Playwright

## AB. Thèmes et apparence — approfondissement

- [ ] Historique/undo sur la dernière couleur personnalisée modifiée
- [ ] Presets de couleurs personnalisés (paire clair/sombre) sauvegardables
- [ ] Bascule automatique clair/sombre selon horaire configurable (avec on/off)
- [ ] Transition fade douce au changement de thème
- [ ] 5-6 thèmes préconfigurés (palettes cohérentes, ex. thème bleu)
- [ ] Réorganiser Paramètres → Apparence en sous-zones distinctes (disposition / thème clair-sombre / couleurs / thèmes préconfigurés / fond animé)
- [ ] Fonds d'écran animés au choix (7-8 propositions, légers, dans le profil utilisateur)
- [ ] Vérifier Playwright

## AC. Profils, comptes, rôles et permissions

- [ ] Profil utilisateur : photo/icône, initiales par défaut, nom affiché, statut de disponibilité (avec horaires/dates), emojis/infos complémentaires
- [ ] Personnalisation thème/couleur au niveau du profil (rien d'admin dedans)
- [ ] Modèle de rôles étendu au-delà d'Admin/Contributeur/Lecteur (ex. Réseau, Testeur) — configurable
- [ ] Permissions par projet (qui a accès à quoi, projet par projet)
- [ ] Vérifier Playwright

## AD. Catalogue — dépendances et création de projet

- [ ] Réafficher les dépendances sous forme de cartes claires (outil/version), info détaillée réservée aux templates, pas partout
- [ ] Refonte de l'assistant de création de projet (voir aussi section AF pour le module Développement) — au minimum : titre modifiable, création auto du dépôt + branches
- [ ] Vérifier Playwright

## AE. Topologie réseau — approfondissement

- [ ] Réorganiser le placement des nœuds (éviter le chevauchement/désordre)
- [ ] Vraies icônes par outil (Proxmox, GitLab, etc.) au clic sur un nœud, pas d'icône générique
- [ ] Nœuds "site hébergé" avec URL cliquable (redirection directe) quand un site est en ligne
- [ ] Corriger le zoom trackpad (isoler le zoom au composant, ne pas zoomer toute la page)
- [ ] Corriger le défilement (saccadé)
- [ ] Édition des informations d'un nœud au clic + ajout de nouveaux nœuds
- [ ] Vérifier Playwright

## AF. HAProxy — refonte complète

- [ ] Détails certificats (état, date de renouvellement) au-delà de la liste actuelle
- [ ] Règles de redirection lisibles (quelle URL → quel backend)
- [ ] Liaison Traefik ↔ HAProxy documentée/configurable
- [ ] Vérifier Playwright

## AG. Proxmox — refonte complète

- [ ] Icônes personnalisables par VM
- [ ] Visualisation écran VM (VNC/noVNC si Proxmox l'expose) avec authentification
- [ ] Enrichir les infos visibles par VM (CPU/RAM/disque/réseau en un coup d'œil)
- [ ] Vérifier Playwright

## AH. Widgets — déplacer dans Paramètres

- [ ] Déplacer la gestion des widgets custom (section R) dans Paramètres, mieux organisée
- [ ] Icônes manquantes + options enrichies
- [ ] Vérifier Playwright

## AI. Multilingue FR/EN

- [ ] Infrastructure i18n minimale (clés de traduction, sélecteur de langue dans Paramètres/profil)
- [ ] Traduire au moins la coquille (nav, Dashboard, Paramètres) en premier lieu, étendre ensuite
- [ ] Vérifier Playwright

## AJ. Performance

- [ ] Auditer chargement/déchargement des données (listes, widgets), réduire les re-fetch inutiles
- [ ] Vérifier bundle/build avant-après

## AK. Domaines — gestion et liaison HAProxy/SEO

- [ ] Ajouter/gérer des noms de domaine facilement, liés à HAProxy (frontend/ACL) et à la machine cible
- [ ] Visibilité de l'accessibilité en ligne du domaine (statut up/down, cohérent avec la topologie réseau section AE)
- [ ] Mise en place facilitée du SEO de base (meta title/description, sitemap, robots.txt) pour les sites hébergés
- [ ] Vérifier Playwright

## AL. Déploiement Kubernetes/ArgoCD — assistant et dépôt central

Cadrage V1 validé par l'utilisateur (volontairement simple, pas d'analyse IA du code) : détection du langage/framework principal via les fichiers présents dans le dépôt (ex. `package.json` → Node, `Dockerfile` présent, `requirements.txt` → Python, `go.mod` → Go, `pom.xml`/`build.gradle` → Java) puis génération de manifests Kubernetes (Deployment/Service/Ingress) + un `ApplicationSet` ArgoCD à partir de gabarits prédéfinis paramétrés (nom, image, port, replicas, environnement dev/staging/prod) — jamais d'exécution ni d'analyse de code réelle, uniquement inspection de la liste de fichiers du dépôt (déjà possible via `GitLabClient.listRepositoryTree()` existant).

- [ ] `backend/src/catalog/k8s-manifest-generator.ts` — fonction pure : détection de type de projet depuis une liste de noms de fichiers + génération de manifests YAML (Deployment/Service/Ingress) et d'un ApplicationSet ArgoCD à partir de gabarits, paramétrable (nom app, image, port, replicas, environnements)
- [ ] Endpoint HTTP `POST /api/deployment/generate` (paramètres : projet GitLab/GitHub source, nom, image, port, environnements) — retourne les manifests générés, ne pousse rien automatiquement (comme le générateur catalogue de template existant)
- [ ] Configuration d'un "dépôt central" optionnel (URL) dans Paramètres, où l'utilisateur pourrait copier les ApplicationSets générés (pas de push automatique en V1 — juste la configuration de la cible et l'affichage de l'URL)
- [ ] Panel frontend "Déploiement" (nouvelle entrée nav, groupe Infrastructure) : formulaire de génération + affichage des manifests générés (copiables)
- [ ] Vérifier Playwright

## AM. Section Développement — refonte complète [CHANTIER MAJEUR, multi-vagues, voir détail ci-dessous]

Contexte : cf. spécification détaillée fournie par l'utilisateur (projets, création guidée par templates, dépôts Git centralisés, branches, tâches de dev avec sous-tâches/dépendances, tickets/bugs, roadmap, versions/releases, environnements, CI/CD, déploiements, tests, qualité de code, sécurité, dépendances, artefacts, historique, activité, doc par projet, architecture, membres/permissions par projet, intégrations dev, synchronisation, recherche, actions rapides, assistant IA dev, agent IA dev, vue cycle de vie, dashboards développeur/projet). Vu l'ampleur, traité en sous-vagues distinctes en respectant les fondations déjà en place (`Item`, `GitLabIssueLink`, `ItemComment`, workspace Coder, catalogue).

### AM.1 — Fondations : modèle Projet + dashboard projet
- [ ] Introduire une vraie entité "Projet de développement" (actuellement seulement modélisé implicitement via items/catalogue) : nom, description, statut (planification/développement/maintenance/terminé/archivé), responsable, membres, dates prévisionnelles, objectif de livraison
- [ ] Page résumé/dashboard par projet : avancement, dernière activité, dernière version, état pipeline, état déploiement, tâches ouvertes, bugs connus, état sécurité
- [ ] Vue globale : actifs / bloqués / en attente / terminés + recherche
- [ ] Vérifier Playwright

### AM.2 — Création de projet guidée (assistant multi-étapes)
- [ ] Assistant en étapes : template, langage/framework/gestionnaire de paquets, environnements, fournisseur Git, création auto dépôt + branches, génération structure/CI-CD/déploiement selon le template, résumé avant validation
- [ ] Vérifier Playwright

### AM.3 — Catalogue de templates de développement
- [ ] Templates avec technologies/dépendances/versions/environnements compatibles/éléments générés, création/édition/versionnement, template par défaut, désactivation sans suppression
- [ ] Vérifier Playwright

### AM.4 — Dépôts Git centralisés + branches
- [ ] Vue dépôt (fournisseur, URL, branche principale, dernière activité/commit/release, pipeline, branches, MR/PR) unifiée GitHub/GitLab
- [ ] Vue branches (protégées, diff avec main, obsolètes, non fusionnées)
- [ ] Vérifier Playwright

### AM.5 — Tâches de développement enrichies + tickets/bugs
- [ ] Étendre le modèle tâche existant (sous-tâches, dépendances, pièces jointes, liens commits/MR/versions déjà partiellement en place) + workflow configurable par projet
- [ ] Modèle Bug distinct (gravité, environnement, version, reproduction, logs) relié à releases/commits
- [ ] Vérifier Playwright

### AM.6 — Roadmap, versions/releases, environnements
- [ ] Roadmap (objectifs/epics/features/tâches liés, vues liste/kanban/calendrier/timeline, jalons)
- [ ] Versions/releases (changelog auto, environnements de déploiement, validation avant publication)
- [ ] Environnements par projet (dev/staging/prod +), version actuelle vs attendue, actions sensibles avec validation
- [ ] Vérifier Playwright

### AM.7 — CI/CD, déploiements, tests, qualité, sécurité, dépendances, artefacts
- [ ] Vue CI/CD par projet (pipelines, étapes, logs, relance, artefacts)
- [ ] Vue déploiements (historique, rollback si possible, diff entre déploiements)
- [ ] Vue tests (unitaires/intégration/e2e, taux de réussite, historique)
- [ ] Vue qualité de code, sécurité (scans dépendances/secrets/images), dépendances, artefacts/packages
- [ ] Vérifier Playwright

### AM.8 — Historique, activité, documentation projet, architecture, membres, intégrations dev, recherche, actions rapides, assistant/agent IA, vue cycle de vie, dashboard développeur
- [ ] Historique chronologique filtrable + timeline d'activité
- [ ] Documentation par projet (distincte de la doc globale DevOS, section U)
- [ ] Vue architecture logique (composants + dépendances)
- [ ] Membres/permissions par projet et par environnement
- [ ] Page Intégrations développement (état, test connexion, sync)
- [ ] Recherche globale développement + actions rapides contextuelles aux permissions
- [ ] Assistant IA développement (contexte projet) + agent IA (branche/PR encadrée par permissions)
- [ ] Vue "cycle de vie" d'une modification (tâche → ... → déploiement) avec mise en évidence des blocages
- [ ] Dashboard développeur personnel (tâches assignées, PR à review, pipelines échouées...)
- [ ] Vérifier Playwright

---

## Notes de performance et de cohérence (héritées de TODO-refonte-ux.md)

- Ne pas ajouter de dépendance sans nécessité réelle vérifiée
- Extraire en composants séparés dans `frontend/src/components/` plutôt que de faire grossir `App.tsx`
- Respecter la palette/tokens de `Design.md` et `frontend/src/styles.css`, y compris en thème sombre (section K déjà faite)
- Chaque nouvelle section Développement (AM) doit rester lisible sur grand écran/ultra-wide dès sa conception
