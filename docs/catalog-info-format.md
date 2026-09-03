# Format `catalog-info.yaml`

Chaque depot integre au catalogue peut fournir un fichier `catalog-info.yaml` a sa racine. Le format suit les entites Backstage `Component` et `API` afin de rester interoperable avec les outils de catalogue existants.

## Champs requis

- `apiVersion`, `kind` et `metadata.name` identifient l'entite.
- `spec.type`, `spec.lifecycle` et `spec.owner` decrivent son cycle de vie et sa responsabilite.
- `spec.dependsOn` declare les dependances sous forme de references d'entites.
- `spec.providesApis` relie un composant aux APIs qu'il expose.
- `metadata.annotations` porte les extensions propres a DevOS sans modifier le contrat de base.

Le parseur DevOS devra refuser les documents sans identite, type, cycle de vie ou proprietaire, conserver les annotations inconnues et accepter plusieurs documents YAML dans un meme fichier.
