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
npm run test:a11y    # audit d’accessibilité axe-core (après npm run build)
npm run server       # serveur de synchronisation et d’alertes sur http://localhost:8787
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
  doctor/       tablette du médecin
  components/   cadre de téléphone, horloge de démo, pastille de médicament
```

`server/` contient le serveur de synchronisation et d’alertes (Node, sans dépendance ; il réutilise le réducteur et le moteur d’alertes de `src/lib`, d’où la construction par Vite avant lancement) et ses tests d’intégration.

## Installer sur un téléphone

Une fois déployée (`npm run build`, puis servir `dist/` en HTTPS), chaque rôle a sa propre adresse, installable sur l’écran d’accueil :

- `/patient` pour la personne qui prend le traitement ;
- `/aidant` pour un proche ;
- `/medecin` pour le médecin.

Sur Android, Chrome propose « Ajouter à l’écran d’accueil » ; sur iPhone, Safari > Partager > « Sur l’écran d’accueil ». Chaque adresse a son propre manifeste, donc son nom et son icône. L’heure suit l’heure réelle, et non l’horloge de démo.

Un service worker garde l’application en cache : elle s’ouvre sans réseau. Les notifications système s’affichent quand l’application est en arrière-plan, après accord donné depuis l’écran du patient ou l’onglet Alertes de l’aidant. Pour prévenir les proches téléphone fermé, voir les alertes push plus bas.

## Partager un dossier entre les téléphones

Sans serveur, tout reste dans le navigateur. Avec `npm run server` (données dans `data/` ou `MEDOC_DATA` ; en développement, Vite le joint derrière `/api`), le téléphone du patient, ceux des proches et la tablette du médecin partagent le même dossier :

1. dans l’appli de l’aidant (`/aidant`), Réglages > « Partager ce dossier » : le dossier de ce téléphone devient le dossier partagé ;
2. « Inviter » donne un code à 8 caractères (et un lien) pour le téléphone du patient, un autre proche ou le médecin. Il sert une fois et expire au bout de 48 heures ;
3. sur l’autre appareil, ouvrir le lien ou la page `/rejoindre` et saisir le code : l’appareil est appairé, sans mot de passe, et s’ouvre sur l’appli de son rôle.

Le patient confirme ses prises et règle son affichage ; les aidants et le médecin modifient l’ordonnance ; tout le monde voit le suivi. Le patient et les aidants invitent et retirent un accès (Réglages > « Qui a accès au dossier ») ; un appareil retiré perd l’accès aussitôt, flux en direct compris. Le médecin retrouve dans « Mes patients » chaque dossier où il est invité, à la place des patients d’exemple.

Chaque geste (prise, ordonnance, réglage) part au serveur, qui vérifie le rôle, le numérote et le diffuse en direct (SSE) ; tous les appareils rejouent les gestes dans cet ordre, ce qui règle les conflits. Hors réseau, l’appli continue : les gestes attendent dans une file et partent au retour, sans doublon. L’horloge de démo reste propre à chaque appareil.

### Alertes push aux proches

Le serveur fait tourner le même moteur d’alertes que l’appli, toutes les 30 secondes, même si aucun téléphone n’est ouvert. Quand une prise dépasse le délai d’escalade (ou au réveil, pendant les heures calmes), ou qu’une glycémie sort des seuils, il ajoute l’alerte au dossier et envoie une notification Web Push aux aidants abonnés : « Maman n’a pas encore pris Metformine (prévu à 8 h). » Un toucher ouvre le suivi. Si la prise est faite ensuite, la notification est remplacée par « Maman a pris Metformine à 9 h 10. »

- Abonnement : onglet Alertes de l’appli aidant, « Recevoir les alertes sur ce téléphone » (appli installée, hors navigation privée).
- Clés VAPID créées au premier lancement dans `MEDOC_DATA/_vapid.json` ; chiffrement aes128gcm (RFC 8291) fait par le serveur, sans dépendance.
- Les heures de prise sont des heures locales : lancer le serveur dans le fuseau du patient, par exemple `TZ=Europe/Paris npm run server`.

## Scanner une ordonnance

Onglet Ordonnance de l’aidant, « Scanner une ordonnance » : photo (ou texte collé), lecture dans le navigateur avec Tesseract (modèle français servi par l’appli, la photo ne quitte pas le téléphone), puis une proposition par médicament : nom et dosage, quantité, heures du pilulier, durée, « si besoin », consignes (« pendant le repas », « dans chaque œil »). Ce qui reste incertain est signalé. Chaque proposition s’ouvre dans l’éditeur habituel : rien n’entre dans l’ordonnance sans « Enregistrer ».

La lecture de la posologie (`src/lib/prescription.ts`) est testée à part : « 1 cp matin et soir », « 2 fois par jour pendant 7 jours », « 1 sachet si douleur, maximum 3 par jour », « un jour sur deux », « toutes les 8 heures »…

## Application mobile (Expo, EAS)

`mobile/` est une coque Expo : l’appli web du patient dans une WebView, et, autour, ce que seul le natif garantit.

- **Rappels même appli fermée** : la page calcule les rappels des trois prochains jours (`src/lib/reminders.ts`), un à l’heure de chaque moment de prise et un second après le délai de retard, puis les envoie à la coque (message `schedule` de `src/lib/platform.ts`) à chaque changement d’ordonnance ou de prise. La coque les programme avec `expo-notifications` (60 au plus, limite d’iOS) ; ils sonnent téléphone verrouillé.
- **Boutons dans la notification** : « J’ai pris » ouvre l’appli et coche les prises du rappel ; « Plus tard » reprogramme un rappel après le délai de report, sans ouvrir l’appli, et la page l’enregistre à sa prochaine ouverture (`src/lib/bridge.ts`).
- Voix (`expo-speech`), vibration (`expo-haptics`) et notifications immédiates passent par le même pont.

```bash
cd mobile
npm install
npm start                 # Expo Go ou client de développement
npm run typecheck
eas build --profile preview --platform android   # APK à installer directement
eas build --profile production --platform all    # Play Store et App Store
```

L’adresse de l’appli web chargée vient de `EXPO_PUBLIC_MEDOC_URL`, réglée par profil dans `mobile/eas.json` (développement : la machine locale, `npm run dev -- --host`).

