# Medoc · site vitrine

Le site de présentation de Medoc (Next.js), avec le prototype interactif au centre de la page.

- **Pilulier en 3D** (three.js, react-three-fiber) : la semaine de la patiente, sept jours et quatre couvercles aux couleurs du pilulier classique (matin jaune, midi orange, soir bleu, coucher violet). Un couvercle ouvert et vide : la prise est faite. Un couvercle qui s'entrouvre et luit : c'est l'heure. Une pastille rouge : la prise a été oubliée. On le fait tourner, on touche une case pour voir ce qu'elle contient.
- **Trois regards sur le même dossier** : le téléphone de Mireille (la patiente), celui de Naz (son fils), la tablette du Dr Martin. Chacun ne voit que ce qu'il doit savoir ; « Les trois en même temps » les affiche côte à côte.
- **Horloge de démo** : un ruban de la journée, des raccourcis (réveil, oubli du matin, insuline du soir) et l'accélération ×60 ou ×600.

Le prototype n'est pas une maquette : il réutilise la logique de l'appli (`../src/lib`), c'est-à-dire le même réducteur, le même calcul des prises et le même moteur d'alertes en deux temps que l'appli et le serveur. Prendre un médicament, laisser passer l'heure, modifier une dose ou envoyer un conseil se répercute sur les trois écrans et sur le pilulier.

## Lancer

```bash
cd site
npm install
npm run dev     # http://localhost:3000
npm run build   # build de production
npm run typecheck
```

## Organisation

```
app/                 page unique, styles globaux
components/three/    le pilulier 3D
components/proto/    prototype : horloge, fil du dossier, vues patiente, proches, médecin
components/ui/       icônes et dessins de médicaments, repris de l'appli
lib/                 état partagé de la démo, grille du pilulier
```

La racine de Turbopack est celle du dépôt (`next.config.ts`) pour pouvoir importer `../src/lib` via l'alias `@medoc/*`. Seuls des modules sans React sont importés depuis l'appli.
