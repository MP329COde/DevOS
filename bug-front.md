# Bugs frontend constatés (test réel Playwright, 2026-09-05)

Environnement : frontend Vite sur http://localhost:5173, backend sur http://localhost:3000
(process déjà démarré avant cette session — voir bug-back.md #1 pour le détail du build utilisé).
Captures dans `/private/tmp/claude-501/-Users-matthew-dev-DevOS/e217f9a1-9b56-4b19-8261-499de03305a1/scratchpad/`.

1. **Erreurs console CORS sur `/api/me` à chaque chargement de page**
   - Composant : `frontend/src/App.tsx` (effet `fetch(.../api/me)`, ligne ~192).
   - Reproduction : ouvrir n'importe quelle page (`/`, `/work`, `/catalog`, ...) avec les DevTools ouverts.
   - Constat : 4 erreurs console à chaque navigation :
     `Access to fetch at 'http://localhost:3000/api/me' from origin 'http://localhost:5173' has been blocked by CORS policy: The value of the 'Access-Control-Allow-Credentials' header in the response is '' which must be 'true' when the request's credentials mode is 'include'.`
   - Conséquence visible : `/api/me` échoue toujours en local, donc `currentRole`/`isAdmin` restent indéfinis côté client même quand le backend a un rôle Admin à renvoyer. Cause racine détaillée dans bug-back.md #2.

2. **Page `/settings-admin` accessible par URL directe mais incohérente visuellement quand l'utilisateur n'est pas Admin (ce qui est le cas par défaut ici, cf. bug #1)**
   - Composant : `frontend/src/App.tsx`, rendu du header (titre `<h1>`) et de la nav (aucune entrée active).
   - Reproduction : naviguer directement vers `http://localhost:5173/settings-admin` (lien direct, historique, favori...).
   - Constat (capture `03-settings-admin-blocked.png`) : le contenu affiche bien "Accès réservé aux administrateurs.", mais :
     - le titre `<h1>` du header affiche toujours **"Dashboard"** au lieu de "Administration" ou d'un intitulé cohérent avec l'URL — car `settings-admin` n'est jamais dans `navItems` quand `isAdmin` est faux, donc `navItems.find(...)` échoue et retombe sur le libellé par défaut.
     - aucun bouton de la nav (sidebar/topbar) n'est marqué actif — l'utilisateur atterrit sur une page "orpheline" sans repère visuel de sa position.
   - Le message d'erreur en lui-même n'a aucune mise en forme (texte brut, pas de bouton de retour, pas de style d'état d'erreur cohérent avec le reste de l'app).

3. **Incohérence visuelle des boutons "Réinitialiser les couleurs" / "Annuler la dernière couleur" (panel Profil → Apparence)**
   - Composant : `frontend/src/components/ProfileSettingsPanel.tsx` (section couleurs personnalisées), styles dans `frontend/src/styles.css`.
   - Reproduction : aller sur `/profile`, section "Couleurs personnalisées".
   - Constat (capture `02-topbar-layout.png`) : le bouton **"Réinitialiser les couleurs"** (actif, cliquable) est stylé en ton pâle/atténué qui se lit visuellement comme désactivé, alors que **"Annuler la dernière couleur"**, qui est réellement `disabled` (aucun historique de couleur au premier chargement, `aria-disabled`/attribut `disabled` confirmé dans le DOM), est stylé en rouge terracotta plein — la couleur la plus "active"/proéminente de l'écran. L'état visuel est donc inversé par rapport à l'état réel des deux boutons.

4. **Le catalogue de navigation (`PANEL_IDS`, `navItems`) a été modifié en direct pendant la session de test**
   - Fichier : `frontend/src/App.tsx`.
   - Constat : en cours de test, une entrée `tools` ("Gestionnaire d'outils") est apparue dans la nav topbar/sidebar entre deux captures, alors qu'elle n'existait pas dans la version du fichier lue en tout début de diagnostic (`PANEL_IDS` ne comptait alors que 15 entrées, sans `tools`). `git diff --stat` confirme que `frontend/src/App.tsx` a été modifié pendant la session (329 lignes changées), avec un horodatage de modification concomitant aux tests Playwright.
   - Ce n'est pas un bug d'UI en tant que tel, mais cela signifie que **tous les constats de ce fichier doivent être revérifiés après stabilisation du code** : le code testé n'était pas figé pendant le diagnostic (voir aussi le rapport final pour les limites de l'environnement).

5. **Page Topologie réseau (`/network`) : état de chargement bref sans transition/squelette**
   - Composant : `frontend/src/App.tsx` ligne ~1479, `frontend/src/components/NetworkGraph.tsx`.
   - Constat : au premier rendu la page affiche seulement le texte brut "Chargement de la topologie…" (pas de spinner ni de squelette cohérent avec les autres pages), puis bascule directement sur le graphe une fois `/api/infra/network-topology` résolu (200 OK avec des données réelles dans cet environnement). Le texte de chargement n'est pas un bug bloquant mais détonne : aucune autre page ne montre cet état "texte brut sans style" pendant son chargement (comparer avec Catalogue/HAProxy qui affichent directement leur structure vide).
