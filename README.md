# APEX : version de test

Runner rythmique à une touche : une panthère bioluminescente chasse des cerfs de lumière dans une jungle noire.

**Jouer :** https://meta-h777.github.io/apex/

- **Maintenir** : se baisser et traquer (passer sous les branches).
- **Relâcher sur le temps fort** : bondir sur la proie. Parfait à ±45 ms, bien à ±90 ms.
- À la moitié du territoire, les rôles s'inversent : tu deviens le cerf, la panthère te poursuit.
- Monte le son : la chasse se joue au rythme.

## v1.0 : refonte complète

- Monde en volume : terrain en relief, sentier qui serpente, troncs à contreforts, fougères en rosettes de frondes,
  champignons, lianes à perles, canopée, brume, lucioles. Plus aucune image de fond.
- Animaux avec squelette (panthère et cerf), animés par le calcul : galop calé sur le temps, traque, bond, queue à inertie.
- Lumière : rien ne clignote. La jungle respire, s'éveille au passage du joueur et avec la série.
- Mise à mort : la proie se désagrège en spores qui reviennent au chasseur ; une onde de lumière traverse la forêt.
- Fichiers : `main.js` (jeu), `monde.js` (décor et shaders), `betes.js` (animation), `son.js` (musique synthétisée).

Raccourcis de test : `?auto=1` (pilote automatique), `?fuite=1` (commence en cerf), `?bascule=4` (bascule à la 4e mesure),
`?studio=1&pose=run|crouch|air` (vue de profil pour régler les animations).

Visuels sources (textures, modèles 3D) générés avec Higgsfield, squelettes posés dans Blender.
