# Medoc

Rappels de médicaments pour les personnes âgées qui voient mal ou pas du tout, et pour les proches qui les accompagnent.

Ce dépôt contient pour l’instant un **prototype web** : un appareil simulé par rôle (téléphone du patient, téléphone de l’aidant, tablette du médecin), qu’on peut basculer ou afficher côte à côte.

Le fil conducteur visuel est le pilulier : chaque moment de la journée a la couleur de couvercle d’un pilulier classique (matin jaune, midi orange, soir bleu, coucher violet), et ces couleurs se retrouvent chez les trois rôles.

- **Téléphone du patient** : un écran « Maintenant » avec une seule chose à faire, un énorme bouton « J’ai pris », la lecture à voix haute à l’heure de la prise, « Plus tard » et la réponse à la voix (« c’est pris », « plus tard ») quand le navigateur le permet. Trois affichages, choisis par l’aidant :
  - **Voix d’abord** : pour une personne qui ne voit pas, deux zones géantes « C’est pris » et « Répéter ».
  - **Gros caractères** : cataracte, glaucome ; texte très grand, jaune sur noir, une chose à la fois.
  - **Standard** : la journée classée matin, midi, soir, avec des cases à cocher.
- **Téléphone de l’aidant** (fils, fille, médecin, personne de confiance) : suivi du jour, saisie de l’ordonnance, alertes, réglages du patient et des personnes à prévenir.
- **Tablette du médecin** : la liste de ses patients triée par observance, le semainier des 7 derniers jours, les oublis répétés, le traitement modifiable et des conseils envoyés au patient (affichés et lus sur son téléphone, visibles par les proches).
- **Alertes** : quand une prise dépasse le délai choisi (30 min par défaut), le téléphone du patient relance et une alerte part vers les proches qui l’ont activée.
- **Horloge de démo** : avancer le temps, sauter à une heure, ou accélérer (1 min par seconde) pour parcourir une journée.

L’ordonnance fournie est fictive. Les données restent dans le navigateur (`localStorage`) ; deux onglets ouverts se synchronisent entre eux.

## Lancer

```bash
npm install
npm run dev          # http://localhost:5173
npm test             # tests unitaires (Vitest)
npm run build        # build classique dans dist/
npm run build:single # un seul fichier dist-single/index.html, autonome
node scripts/artifact.mjs # page de démo publiable comme Artifact claude.ai
```

## Organisation

```
src/
  lib/          types, calcul des prises du jour, phrases lues, pont vers l’appareil, état partagé
  patient/      application du patient
  caregiver/    application de l’aidant (suivi, ordonnance, réglages)
  components/   cadre de téléphone, horloge de démo, pastille de médicament
```

## Vers l’application mobile (EAS)

L’idée est d’emballer cette page dans une WebView React Native construite avec EAS, pour Android et iPhone. `src/lib/platform.ts` prépare ce passage : si `window.ReactNativeWebView` existe, la voix, les notifications et la vibration sont envoyées au natif par `postMessage` (à brancher sur `expo-speech`, `expo-notifications` et `expo-haptics`) ; sinon les API web prennent le relais.

Ce qu’il restera à faire côté mobile :

- notifications locales programmées à l’avance, pour sonner même téléphone verrouillé ou appli fermée ;
- un serveur pour partager l’ordonnance et les prises entre le téléphone du patient et ceux des proches, et pousser les alertes ;
- comptes et invitations (le patient invite un proche ou son médecin) ;
- à étudier : photo de la boîte, scan de l’ordonnance, suivi de la glycémie et des doses d’insuline variables.
