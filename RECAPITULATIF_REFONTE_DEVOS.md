# Récapitulatif — refonte DevOS

## Expérience et navigation

- Dashboard d’accueil enrichi : salutation personnalisable, widgets déplaçables et mode édition.
- Barre latérale repliable, navigation horizontale alternative et comportements adaptatifs pour grands écrans.
- Design liquid-glass, fonds animés légers, transitions de thèmes et animations de composants.
- Thèmes prêts à l’emploi, palettes personnalisées avec annulation, presets et planification clair/sombre.

## Espaces de travail

- Le module Travail réunit tâches, triage et vue du jour dans une même section.
- Un espace Notes autonome permet les notes Markdown et les listes de contrôle non rattachées à un projet.
- Le module Développement apporte projets, catalogue de modèles, création guidée, dépôts Git unifiés,
  tâches/bugs, roadmap, activité, recherches et vues CI/CD/sécurité.
- Les releases et les environnements sont suivis par projet, avec protections explicites pour la production.

## Déploiement et intégrations

- Générateur de manifestes Kubernetes (Deployment, Service et ApplicationSet ArgoCD) à partir d’un dépôt
  et de ses environnements.
- Connexions GitHub/GitLab, comptes techniques DevOS, pipelines, artefacts et informations de déploiement.
- Profils, rôles système et permissions par projet ajoutés au modèle de données et aux routes HTTP.

## Documentation

- Docs est désormais strictement le manuel DevOS : l’import/scanner GitLab y est supprimé.
- Les documents de projet restent dans leur espace Développement et ne peuvent plus être affichés dans
  le manuel global, y compris si une API plus ancienne les retourne.

## Validation réalisée

- `npm run typecheck` : réussi.
- `npm run build` : réussi.
- `npm test` : 576 tests réussis, 3 ignorés, 0 échec.
- Contrôle Playwright dans Chrome : Dashboard, Développement, Docs, Notes et réduction de la navigation.
