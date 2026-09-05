# Site "Le Mariage des LULU" — Plan technique + prompt de démarrage pour Cursor

## 0. Décisions de stack (avant de lancer Cursor)

| Sujet | Choix recommandé | Pourquoi |
|---|---|---|
| Framework | **Astro** (déjà décidé) | Bon fit : site majoritairement statique, quelques îlots interactifs |
| Animation enveloppe/lettre | **GSAP** (vanilla TS, pas besoin de React) | C'est LE standard pour des séquences chorégraphiées (timelines, easing physique). Rendu "premium", pas de rendu "vieux HTML" tant qu'on soigne l'easing et le stagger. Reste léger, s'intègre nativement dans un `<script>` Astro sans framework UI. |
| Style | **Tailwind CSS** | Rapide à mettre en place avec Astro, évite le CSS qui traîne |
| Rendu | **Astro en mode hybride/server** (adapter Vercel ou Netlify) | Il te faut un backend léger pour : (1) vérifier le mot de passe côté serveur, (2) traiter le formulaire RSVP et envoyer les mails. Astro seul en mode statique ne peut pas faire ça. |
| Emails | **Resend** (API simple, bon niveau gratuit) | Plus simple qu'un SMTP/Nodemailer à configurer, s'intègre en 5 lignes dans une route API Astro |
| Stockage des réponses RSVP | Un simple **Google Sheet** (via API) ou une petite base **Supabase/Turso** | Pour ne pas dépendre uniquement des emails pour savoir qui a répondu. Commence simple : Google Sheet si tu veux zéro infra, Supabase si tu veux une vraie base + un futur tableau de bord |
| Données invités (nom, hébergement) | Fichier **JSON généré une fois depuis ton Excel** | Sert à peupler la liste déroulante ET à savoir si la personne est "grisée" (déjà à l'hôtel) |
| Hébergement du site | **Vercel** | Adapter Astro officiel, domaines custom faciles, fonctions serverless incluses |

Un point important sur le mot de passe : ne mets jamais le mot de passe en clair dans le JS client (n'importe qui peut l'ouvrir dans l'inspecteur). Il doit être vérifié côté serveur (route API Astro) contre une variable d'environnement, qui renvoie un token/flag si c'est bon.

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

Toutes les formes ont un fond transparent, pensées pour être posées sur la lettre — à ranger dans `public/images/shapes/` avec des noms explicites, par ex. :

```
public/images/shapes/
  presence.png
  infos-pratiques.png
  dress-code.png
  appareil-photo.png
  programme.png
  invit.png
```

Le fichier "programme" et "invit" contiennent déjà le texte final (programme du samedi/dimanche, carton d'invitation avec lieu et date : Domaine Verdé, forêt Royale de Vacquiers, 31.07.2027) — ce sont donc des visuels figés, pas des composants à re-designer. Pour "Infos pratiques" et "Dress code", le texte n'est pas encore fourni par Lucie : ne bloque pas le développement dessus, avance avec un contenu de remplacement ("Lorem" ou une structure de titres) que tu remplaceras dès qu'elle te l'envoie.

Pense à convertir ces PNG en **WebP** (en gardant un fallback PNG) pour le poids des images, surtout celles en haute résolution comme `presence.png` (assez lourde).

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

1. Scaffold du projet Astro + Tailwind + adapter Vercel, structure de dossiers ci-dessus.
2. Conversion du fichier Excel en `src/data/guests.json` (script one-shot, pas besoin de l'automatiser).
3. Page d'accueil : mise en place statique de l'enveloppe (sans animation, sans mot de passe) pour valider le layout et les assets.
4. Route API `/api/check-password` + logique client (fetch, gestion des erreurs, état "déverrouillé" en `sessionStorage`).
5. Timeline GSAP de la séquence d'ouverture (enveloppe → lettre → formes), en itérant sur les easings/timings.
6. Pages statiques : Infos pratiques, Dress Code, À venir (photos).
7. Formulaire RSVP + route API `/api/rsvp` + intégration Resend + stockage des réponses.
8. Tests responsive (l'animation d'enveloppe est le point le plus risqué en mobile — prévoir une version allégée sur petits écrans).
9. Achat + configuration DNS de `lemariagedeslulu` sur Vercel.

---

## 5. Prompt à copier-coller dans Cursor (première étape uniquement : le scaffold)

```
Contexte : je construis un site de mariage statique/hybride avec Astro, Tailwind CSS et un adapter Vercel pour deux fonctions serverless (vérification de mot de passe, traitement d'un formulaire RSVP avec envoi de mail via Resend).

Étape actuelle : scaffold uniquement, pas d'animation ni de logique métier pour l'instant.

Fais ceci :
1. Initialise un projet Astro avec TypeScript strict, Tailwind CSS, et l'adapter @astrojs/vercel en mode "hybrid" (pages statiques par défaut, routes API en server-rendering).
2. Crée la structure de dossiers suivante :
   - src/pages/index.astro
   - src/pages/rsvp.astro
   - src/pages/infos-pratiques.astro
   - src/pages/dress-code.astro
   - src/pages/a-venir.astro
   - src/pages/api/check-password.ts
   - src/pages/api/rsvp.ts
   - src/data/guests.json (fichier vide en attendant, structure : [{ "name": string, "email": string | null, "hebergement": "hotel" | "libre" }])
   - src/components/BackToHome.astro (composant simple, lien vers "/", utilisé sur rsvp/infos-pratiques/dress-code/a-venir)
   - src/layouts/BaseLayout.astro (layout minimal avec meta tags de base)
3. Configure les variables d'environnement dans un .env.example : SITE_PASSWORD, RESEND_API_KEY, NOTIFY_EMAIL (email de Lucie).
4. Ajoute un .gitignore adapté (node_modules, .env, dist, .vercel).
5. N'implémente aucune logique d'animation ni d'envoi de mail à cette étape : uniquement le scaffold, avec des pages qui affichent juste un titre de section pour vérifier que le routing fonctionne.

Ne me propose pas de librairie d'animation à cette étape, je la choisirai moi-même (ce sera GSAP).
```

Une fois ce scaffold validé, on donne à Cursor l'étape suivante (mot de passe côté serveur), puis celle d'après (timeline GSAP), plutôt que de tout demander en un seul prompt géant — Cursor produit un code bien plus propre quand chaque étape est isolée et vérifiable.
