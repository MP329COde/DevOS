# Prompt à coller dans Claude Code pour continuer la refonte
---

Tu reprends le projet DevOS (`phase-*`/`main`, monorepo `backend/`+`frontend/`). Le fichier `TODO-refonte-ux.md` à la racine du dépôt liste précisément tout ce qui reste à faire suite aux retours utilisateur les plus récents sur la navigation, le Dashboard et le module Infrastructure. Lis-le en entier avant de commencer.

Avant de coder quoi que ce soit, lis aussi :
- `Design.md` — la référence visuelle (palette, densité, identité "infra critique" du module Réseau/Serveurs). Toute UI que tu produis doit rester cohérente avec les tokens déjà en place dans `frontend/src/styles.css` (vert `#49634c`, terracotta `#a34f31`, fonds crème, rayons ~8-16px, ombres douces) — ne réinvente pas une palette parallèle.
- `TODO.md` — le backlog fonctionnel complet par phase, pour ne pas dupliquer un item déjà prévu ailleurs.
- `INFO.md` — les patterns techniques du projet (structure des services, conventions de tests, etc.) si tu as besoin de contexte technique.

## Méthode de travail — non négociable

Traite les sections de `TODO-refonte-ux.md` **dans l'ordre** (A, B, C, D, E, F, G, H, I), une case à la fois. Pour **chaque case** :

1. **Implémente** la modification, dans les fichiers indiqués (ou les fichiers logiquement pertinents si la case ne donne qu'un point de départ — cherche/adapte plutôt que de deviner à l'aveugle).
2. **Valide mécaniquement** : `npm run lint` (typecheck) puis `npm run build` puis `npm --workspace backend test`. Zéro régression tolérée avant de continuer.
3. **Valide visuellement avec Playwright, à chaque case, sans exception** :
   - Démarre le backend réel (Postgres + Redis locaux, `node dist/server.js`) et le frontend réel (`npx vite --port 5173`) — pas de mock si évitable, les intégrations non configurées répondent normalement en 503 et c'est attendu.
   - Pilote la fonctionnalité modifiée avec un script Playwright (navigation, clics, saisie selon le cas), prends des captures d'écran avant/après pour les changements visuels.
   - Vérifie l'absence d'erreurs console/réseau 5xx inattendues (les 503 des intégrations non configurées sont normaux, tout le reste ne l'est pas).
   - Si un bug apparaît (visuel ou fonctionnel), corrige-le avant de cocher — ne documente pas un bug connu comme acceptable sans le signaler explicitement à l'utilisateur.
4. **Coche la case** dans `TODO-refonte-ux.md` uniquement une fois les 3 étapes précédentes passées.
5. **Commit séparé** par case (sauf sous-cases explicitement groupées dans le fichier), message clair en français décrivant le changement et sa raison, jamais de `git push` ni de merge sans demande explicite.

Ne saute jamais une case pour "revenir plus tard" sauf si elle est explicitement marquée comme nécessitant une clarification utilisateur (sections F, H, I notamment) — dans ce cas, pose la question via une vraie interruption (AskUserQuestion ou équivalent) plutôt que de supposer une réponse, puis continue sur la case suivante en attendant, et reviens-y une fois la réponse obtenue.

## Exigences transverses à garder en tête sur toute la durée du travail

- **Performance** : pas de nouvelle dépendance sans nécessité réelle et justifiée ; si un fichier grossit de façon excessive (`App.tsx` notamment), extrais en composants séparés dans `frontend/src/components/` plutôt que d'empiler ; surveille la taille du bundle affichée par `vite build` et signale toute hausse anormale (>15 % sur un seul commit).
- **Cohérence visuelle** : chaque nouvel écran/panel doit respecter la même grammaire de composants que l'existant (cartes `.widget-card`/`.item`, boutons `.filter`/`.nav-link`, badges `.status-badge`) plutôt que d'introduire un style isolé.
- **Sécurité** : aucun secret (token, mot de passe, clé API) ne doit apparaître en clair dans le code, les logs, ou le DOM par défaut — en particulier pour la section E (Vault).
- **Pas de sur-ingénierie** : chaque section de `TODO-refonte-ux.md` donne un scope volontairement borné pour une première itération ; ne construis pas au-delà de ce qui est demandé (pas de système de plugins générique, pas d'abstraction spéculative) sauf si un point du fichier le demande explicitement.

## À la fin de chaque section (A, B, C, D, E, F, G, H, I)

Fais un point de synthèse court (2-3 phrases) de ce qui a été fait, ce qui a été testé, et ce qui reste avant de passer à la suivante — pour que l'utilisateur puisse suivre l'avancement sans relire tout `TODO-refonte-ux.md` à chaque fois.

Commence maintenant par la section A.
