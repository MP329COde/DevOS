# Plan - Statut MR et pipeline

## Objectif
Projeter le cycle de vie GitLab MR sur le statut visible de l'item et afficher le pipeline courant.

## Ordre
1. Definir les types MR/pipeline et la projection.
2. Ajouter tests open/merged/closed et etats pipeline.
3. Exposer la projection au modele sync sans action destructive.
4. Valider lint/tests/build, mettre a jour le suivi et committer.
