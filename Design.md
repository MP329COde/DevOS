# Prompt à coller dans Claude Design

---

Je veux que tu conçoives l'intégralité du design d'une plateforme tout-en-un, auto-hébergée, à usage personnel/homelab technique — mon centre de commande quotidien pour la gestion de projets ET la gestion de mon infrastructure réseau/serveurs. Voici le contexte complet.

## Ce que le produit fait

- **Module Tâches & Projets** : plusieurs projets en parallèle, hiérarchie Epic > Story > Task, vues multiples (Liste, Kanban/Board, Gantt, Calendrier), Cycles type Linear, palette de commandes "Command K"
- **Synchronisation GitLab** : indicateurs visuels sur chaque tâche liée à une issue/MR GitLab (statut MR, statut pipeline), file "Triage" pour les tâches importées automatiquement
- **Dashboard "Aujourd'hui"** : tâches du jour en timeline horaire, statut des pipelines, alertes actives, **et statut up/down de mes serveurs/services critiques**, en widgets réarrangeables
- **Catalogue de services/infra applicative** : services avec dépendances (graphe), statut de déploiement (ArgoCD), statut de scan de sécurité
- **Module Réseau & Serveurs** [NOUVEAU] : inventaire de toutes mes machines physiques/virtuelles (VMs Proxmox, hôtes, IPs, domaines), avec pour chaque machine : statut (running/stopped/down), actions de contrôle (démarrer/arrêter/redémarrer/snapshot), vue topologie (quelle VM sur quel hôte), historique de disponibilité
- **Module Docs** : documentation liée aux projets/serveurs, éditeur intégré + docs versionnées dans le code
- **Intégration environnements de dev (Coder)** : bouton "Ouvrir un environnement" sur une tâche, badge de statut sur la carte

## Exigences de style

- **Moderne, dans l'esprit Linear** : rapide, minimaliste, dense en information sans être surchargée, typographie soignée, dark mode par défaut, light mode disponible
- Palette de commandes centrale à l'expérience
- Cartes de tâches denses en info (labels, assigné, statut GitLab, statut pipeline, statut workspace Coder) sans devenir illisibles
- Le module Réseau & Serveurs doit avoir un langage visuel clairement identifiable comme "infra critique" (distinct du reste, ex : indicateurs de statut plus prononcés, confirmation visible avant toute action destructive comme arrêter une VM)
- Le Dashboard "Aujourd'hui" doit avoir une vraie identité visuelle propre, écran d'accueil quotidien qui donne envie d'y revenir

## Ce que je veux que tu produises

1. Pose-moi d'abord les questions nécessaires (palette de couleurs précise si j'ai une préférence, niveau de densité souhaité, nom/logo du produit à intégrer) avant de te lancer.
2. Utilise un système de design cohérent et réutilisable (tokens de couleur, typographie, espacements) appliqué uniformément à tous les écrans.
3. Conçois l'ensemble des écrans suivants de façon intégrale et intégrée entre eux (même navigation, même système de composants, transitions cohérentes) :
   - Dashboard "Aujourd'hui" (incluant le widget statut serveurs)
   - Vue Liste des tâches
   - Vue Board/Kanban
   - Vue Gantt
   - Vue Calendrier
   - Détail d'une tâche (avec indicateurs GitLab/pipeline/Coder)
   - File de Triage
   - Catalogue de services (vue liste + vue graphe de dépendances)
   - Détail d'un service du catalogue
   - **Inventaire Réseau & Serveurs (vue liste + vue topologie)**
   - **Détail d'une VM/serveur (avec actions start/stop/reboot/snapshot et historique de disponibilité)**
   - Module Docs
   - Palette de commandes (Command K) ouverte en overlay
4. **Remplis chaque écran avec des données fictives réalistes et cohérentes entre elles** (mêmes noms de projets, mêmes personnes, mêmes machines, mêmes statuts qui se recoupent d'un écran à l'autre — par exemple, une VM listée dans le module Serveurs doit apparaître avec le même nom dans le Dashboard si elle a une alerte). Aucun écran vide, aucun lorem ipsum générique.
5. Livre le tout comme un prototype cohérent et navigable, pas une série d'images isolées.

Commence par tes questions de clarification, puis go.
