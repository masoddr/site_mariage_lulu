# Site "Le Mariage des LULU" — Plan technique + prompt de démarrage pour Cursor

## 0. Décisions de stack (avant de lancer Cursor)

| Sujet | Choix recommandé | Pourquoi |
|---|---|---|
| Framework | **Astro** (déjà décidé) | Bon fit : site majoritairement statique, quelques îlots interactifs |
| Animation enveloppe/lettre | **GSAP** (vanilla TS, pas besoin de React) | C'est LE standard pour des séquences chorégraphiées (timelines, easing physique). Rendu "premium", pas de rendu "vieux HTML" tant qu'on soigne l'easing et le stagger. Reste léger, s'intègre nativement dans un `<script>` Astro sans framework UI. |
| Style | **Tailwind CSS 4**, via le plugin `@tailwindcss/vite` | Rapide à mettre en place avec Astro, évite le CSS qui traîne. ⚠️ L'ancienne intégration `@astrojs/tailwind` est **dépréciée** et ne cible que Tailwind 3 : elle ne recevra pas de support Astro 6+. Tailwind 4 se configure en CSS (bloc `@theme` dans `global.css`), il n'y a plus de `tailwind.config.js`. |
| Rendu | **Astro en `output: 'static'`** + adapter Vercel | Il te faut un backend léger pour : (1) vérifier le mot de passe côté serveur, (2) traiter le formulaire RSVP et envoyer les mails. ⚠️ Le mode `hybrid` a été **supprimé dans Astro 5** : il a été fusionné dans `static`, qui a désormais son comportement. Concrètement, tout est pré-rendu par défaut et chaque route qui a besoin du serveur porte `export const prerender = false`. L'adapter reste obligatoire. |
| Runtime | **Node 24** (`.nvmrc` + `package.json#engines`) | Version par défaut sur Vercel, et Astro 7 exige Node ≥ 22.12. ⚠️ Node 20 est **désactivé sur Vercel depuis le 01/10/2026** : ne pas partir dessus. |
| Emails | **Resend** (API simple, bon niveau gratuit) | Plus simple qu'un SMTP/Nodemailer à configurer, s'intègre en 5 lignes dans une route API Astro |
| Stockage des réponses RSVP | Un simple **Google Sheet** (via API) ou une petite base **Supabase/Turso** | Pour ne pas dépendre uniquement des emails pour savoir qui a répondu. Commence simple : Google Sheet si tu veux zéro infra, Supabase si tu veux une vraie base + un futur tableau de bord |
| Données invités (nom, hébergement) | Fichier **JSON généré une fois depuis ton Excel** | Sert à peupler la liste déroulante ET à savoir si la personne est "grisée" (déjà à l'hôtel) |
| Hébergement du site | **Vercel** | Adapter Astro officiel, domaines custom faciles, fonctions serverless incluses |

Un point important sur le mot de passe : ne mets jamais le mot de passe en clair dans le JS client (n'importe qui peut l'ouvrir dans l'inspecteur). Il doit être vérifié côté serveur (route API Astro) contre une variable d'environnement, qui renvoie un token/flag si c'est bon.

Les variables d'environnement passent par `astro:env` (schéma déclaré dans `env.schema` de `astro.config.mjs`) plutôt que par `import.meta.env` brut : elles sont ainsi typées, validées, et les secrets marqués `access: 'secret'` ne peuvent pas fuiter dans le bundle client.

À savoir aussi : la protection CSRF d'Astro (`security.checkOrigin`) est **active par défaut** et renvoie 403 sur un POST dont l'en-tête `Origin` ne correspond pas au site. C'est transparent pour un `fetch` depuis le site lui-même, mais ça explique un 403 si tu testes une route au curl sans cet en-tête.

---

## 1. Choréographie de la page d'accueil (le morceau délicat)

Séquence complète, pensée pour un rendu fluide et pas "robotique" :

1. **État initial** : photo du domaine en fond (légèrement floutée ou avec un léger effet Ken Burns très lent), enveloppe centrée avec une ombre portée douce, champ mot de passe qui apparaît au clic/hover sur l'enveloppe (pas affiché brutalement dès le chargement).
2. **Mot de passe correct** → déclenche une timeline GSAP unique (`gsap.timeline()`) qui enchaîne, sans à-coups :
   - Le rabat de l'enveloppe pivote (`rotateX` avec `transform-origin: top`, perspective CSS sur le parent) — pas un simple `display:none/block`.
   - La lettre glisse hors de l'enveloppe (`translateY` + léger `scale` + `ease: "power3.out"`), jamais en `linear` (le linéaire, c'est ce qui donne le côté "robotique/old-school").
   - La lettre se déplie/s'agrandit en plein écran. Deux options selon l'effort voulu :
     - Simple et propre : `scale` + `width/height` avec `ease: "expo.inOut"`.
     - Plus subtil (recommandé) : `clip-path` qui s'anime pour donner l'impression d'un papier qui se déplie, plutôt qu'un zoom brutal.
   - Les 6 formes envoyées par Lucie (Présence, Infos pratiques, Dress code, Appareil photo, Programme, Invit) sortent de l'enveloppe et se posent sur la lettre en **stagger** (`gsap.to(items, { stagger: 0.08, ease: "back.out(1.2)" })`) — c'est ce léger décalage + easing "back" qui donne un rendu moderne et vivant, pas mécanique.
   - Fondu très léger du fond (opacity + blur) pour faire ressortir la lettre au premier plan.
3. Respecter `prefers-reduced-motion` : si activé, on saute directement à l'état final (enveloppe ouverte, contenu affiché) sans animation.
4. Les 6 formes n'ont pas toutes le même comportement, précisé par Lucie :
   - **Cliquables** (liens vers une autre page) : Présence → `/rsvp`, Infos pratiques → `/infos-pratiques`, Dress code → `/dress-code`, Appareil photo → `/a-venir`. Léger effet hover (scale 1.03, ombre) pour signaler que c'est cliquable.
   - **Non cliquables** (Programme, Invit) : ce sont de simples visuels sur la lettre, pas des liens. Deux options :
     - Les laisser purement décoratifs (aucune interaction) — le plus fidèle à la demande de Lucie ("juste des éléments simples").
     - Ou, pour rester cohérent visuellement avec les 4 autres (même léger hover sur toutes les formes) sans créer de page dédiée : un clic ouvre une **modale/lightbox** qui affiche l'image en grand (le programme ou le carton d'invitation), sans navigation ni changement d'URL. À toi de trancher selon l'effet recherché — je te mets les deux pistes dans le prompt ci-dessous.
5. Sur toutes les pages liées (`/rsvp`, `/infos-pratiques`, `/dress-code`, `/a-venir`), prévoir un bouton/lien discret de retour vers l'accueil (ex. en haut à gauche, style cohérent avec la charte du site) puisque Lucie veut pouvoir naviguer entre ces pages et revenir à l'accueil.

---

## 2. Structure de pages

```
/                → page d'accueil (enveloppe + mot de passe + hub des formes)
/rsvp            → formulaire de confirmation (lien depuis la forme "Présence")
/infos-pratiques → infos pratiques + liste d'hébergements à proximité (lien depuis "Infos pratiques")
/dress-code      → dress code (lien depuis "Dress code")
/a-venir         → page d'attente pour les photos du mariage, publiées après coup (lien depuis "Appareil photo")
```

"Programme" et "Invit" ne sont pas des pages : ce sont les 2 formes non cliquables (voir §1.4), affichées directement sur la lettre de l'accueil, en modale le cas échéant.

Un composant `src/components/BackToHome.astro` (ou intégré dans un layout dédié `PageLayout.astro`) est à prévoir pour les 4 pages liées, afin d'offrir un retour cohérent vers `/`.

---

## 2bis. Organisation des assets (formes reçues de Lucie)

Toutes les formes ont un fond transparent, pensées pour être posées sur la lettre. Le pipeline retenu sépare la source de ce que consomme le build :

```
assets-source/            visuels reçus de Lucie, jamais modifiés (source de vérité)
  shapes/                   presence.png, infos-pratiques.png, dress-code.png,
                            appareil-photo.png, programme.png, invit.png
  envelope/                 enveloppe-fermee.png, enveloppe-ouverte.png

src/assets/images/        régénéré par scripts/prepare_assets.py, consommé par astro:assets
```

⚠️ Les fichiers de Lucie sont exportés sur des canvas surdimensionnés : jusqu'à **55 % de `presence.png` n'est que de la marge transparente**. Cette marge devient de la surface invisible en CSS et casse silencieusement toute mise en page. `scripts/prepare_assets.py` recadre chaque visuel sur sa boîte englobante opaque. À relancer à chaque nouvel envoi de Lucie :

```bash
python scripts/prepare_assets.py
```

⚠️ `enveloppe-fermee.png` embarque aussi une **ombre portée claire incrustée** dans le PNG (15 % du visuel, beige). Elle passe pour une ombre sur fond blanc, mais devient un halo blanc sur le fond sombre de l'accueil. Le script la retire (seuillage du canal alpha, voir `ALPHA_CUTOFFS`) et `Envelope.astro` la remplace par une vraie ombre CSS sombre, qui reste correcte quel que soit le fond.

Le fichier "programme" et "invit" contiennent déjà le texte final — ce sont donc des visuels figés, pas des composants à re-designer. Contenu confirmé en les ouvrant :

- **programme** : *Samedi* 15h ouverture des portes du domaine, 16h début de la cérémonie, 17h30 photos de groupe, 18h15 vin d'honneur, 20h15 repas, soirée dansante. *Dimanche* 11h brunch.
- **invit** : « Lucie et Lucas sont heureux de vous inviter à célébrer leur union au Domaine Verdé, dans la forêt Royale de Vacquiers (31340) — 31.07.2027 ».

⚠️ Les mariés sont donc **Lucie et Lucas** (LUcie + LUcas = LULU), pas « Ludo ».

Pour "Infos pratiques" et "Dress code", le texte n'est pas encore fourni par Lucie : ne pas bloquer le développement dessus, avancer avec une structure de titres à compléter.

### Poids des images : rien à faire à la main

La conversion WebP manuelle avec fallback `<picture>` n'est **plus nécessaire**. Les visuels sont importés depuis `src/assets/`, donc `astro:assets` s'en charge au build : conversion WebP, `srcset` responsive et `width`/`height` posés pour éviter le décalage de mise en page. Il suffit d'utiliser le composant `<Image>` plutôt qu'une balise `<img>`.

Résultat mesuré : **5,1 Mo de PNG sources → 508 Ko de WebP servis**, toutes variantes du `srcset` confondues (`programme.png` passe de 1793 Ko à 31 Ko). La configuration se trouve dans le bloc `image` de `astro.config.mjs` (`layout: 'constrained'`, `objectFit: 'contain'` car les formes sont des découpes transparentes qu'il ne faut jamais rogner).

---

## 3. Formulaire RSVP — logique

- Liste déroulante des noms → chargée depuis `guests.json` (généré depuis ton Excel).
- Chaque entrée de `guests.json` a un champ `hebergement: "hotel" | "libre"`.
  - Si `"hotel"` → le select hébergement est affiché mais désactivé (griséé), valeur pré-remplie "Logement à l'hôtel".
  - Si `"libre"` → select actif avec les 2 options (tente sur le domaine / je cherche moi-même à proximité, avec renvoi vers Infos Pratiques).
- Soumission → route API Astro (`POST /api/rsvp`) qui :
  1. valide les données,
  2. enregistre la réponse (Google Sheet ou Supabase),
  3. envoie un mail à l'invité (email qu'il a renseigné) + un mail à Lucie, via Resend.

---

## 4. Ordre de développement conseillé (à donner à Cursor, étape par étape — ne pas tout demander d'un coup)

1. ~~Scaffold du projet Astro + Tailwind + adapter Vercel, structure de dossiers ci-dessus.~~ ✅ **Fait** (commit `906d0c5`).
2. Conversion du fichier Excel en `src/data/guests.json` (script one-shot, pas besoin de l'automatiser).
3. ~~Page d'accueil : mise en place statique de l'enveloppe (sans animation, sans mot de passe) pour valider le layout et les assets.~~ ✅ **Fait**. Les deux états de la séquence sont posés l'un après l'autre sur la page pour être vérifiables à l'œil ; l'étape 5 en fera un seul écran.
4. Route API `/api/check-password` + logique client (fetch, gestion des erreurs, état "déverrouillé" en `sessionStorage`).
5. Timeline GSAP de la séquence d'ouverture (enveloppe → lettre → formes), en itérant sur les easings/timings.
6. Pages statiques : Infos pratiques, Dress Code, À venir (photos).
7. Formulaire RSVP + route API `/api/rsvp` + intégration Resend + stockage des réponses.
8. Tests responsive (l'animation d'enveloppe est le point le plus risqué en mobile — prévoir une version allégée sur petits écrans).
9. Achat + configuration DNS de `lemariagedeslulu` sur Vercel.

---

## 5. État du projet et charte

L'étape 1 (scaffold) est faite : voir le `README.md` pour l'arborescence réelle, les scripts et la liste de ce qui reste à fournir par Lucie.

### Charte graphique

Couleurs échantillonnées directement dans les visuels de Lucie et exposées comme tokens Tailwind dans `src/styles/global.css` :

| Token | Valeur | Origine |
|---|---|---|
| `forest` | `#374F35` | le vert des 6 formes |
| `forest-deep` | `#22301F` | variante sombre pour les contrastes |
| `kraft` | `#D4CAC1` | le papier de l'enveloppe |
| `paper` | `#E9E7E1` | l'ivoire du carton d'invitation |
| `ink` | `#1A1A18` | le texte |

### Méthode de travail

On avance étape par étape plutôt qu'en un seul prompt géant : le code est bien plus propre quand chaque étape est isolée et vérifiable. Après chaque étape, valider avec `npm run build` et `npm run check` (0 erreur attendue) avant de passer à la suivante.
