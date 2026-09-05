# Le Mariage des LULU

Site d'invitation pour le mariage de Lucie et Ludo — Domaine Verdé, forêt Royale
de Vacquiers, le 31 juillet 2027.

Le plan technique complet et l'ordre de développement sont dans [`devbook.md`](./devbook.md).

## Stack

| Brique | Version | Note |
|---|---|---|
| Astro | 7.x | `output: 'static'` + adapter Vercel, routes API en `prerender = false` |
| Tailwind CSS | 4.x | via le plugin `@tailwindcss/vite` (l'intégration `@astrojs/tailwind` est dépréciée) |
| Node | 24.x | version par défaut sur Vercel ; Node 20 y est désactivé depuis le 01/10/2026 |
| Hébergement | Vercel | fonctions serverless pour le mot de passe et le RSVP |

## Démarrage

```bash
nvm use            # lit .nvmrc → Node 24
npm install
cp .env.example .env   # puis renseigner les valeurs
npm run dev
```

## Scripts

| Commande | Rôle |
|---|---|
| `npm run dev` | serveur de développement |
| `npm run build` | build de production dans `dist/` |
| `npm run preview` | prévisualisation du build |
| `npm run check` | vérification des types Astro/TypeScript |

## Structure

```
src/
  components/BackToHome.astro    lien de retour vers l'accueil
  data/guests.json               liste des invités (généré depuis l'Excel)
  data/guests.ts                 accès typé à guests.json
  layouts/BaseLayout.astro       <html>, meta tags, styles globaux
  layouts/PageLayout.astro       gabarit des 4 pages internes (titre + retour)
  pages/index.astro              enveloppe, mot de passe, hub des formes
  pages/rsvp.astro               formulaire de confirmation de présence
  pages/infos-pratiques.astro    infos pratiques et hébergements
  pages/dress-code.astro         dress code
  pages/a-venir.astro            page d'attente pour les photos
  pages/api/check-password.ts    POST — vérifie SITE_PASSWORD côté serveur
  pages/api/rsvp.ts              POST — enregistre le RSVP et envoie les mails
  styles/global.css              import Tailwind + tokens de la charte
  types.ts                       types métier (Guest, RsvpPayload…)
public/images/
  shapes/                        les 6 formes de Lucie (fond transparent)
  envelope/                      enveloppe fermée et ouverte
```

## Variables d'environnement

Déclarées dans `astro.config.mjs` (`env.schema`) et donc typées via
`astro:env/server`. Voir [`.env.example`](./.env.example) pour la liste.

## État d'avancement

Suit l'ordre du devbook §4.

- [x] 1. Scaffold Astro + Tailwind + adapter Vercel
- [ ] 2. Conversion de l'Excel en `src/data/guests.json`
- [ ] 3. Page d'accueil statique (enveloppe, sans animation)
- [ ] 4. Route `/api/check-password` + déverrouillage côté client
- [ ] 5. Timeline GSAP de la séquence d'ouverture
- [ ] 6. Contenu des pages Infos pratiques, Dress code, À venir
- [ ] 7. Formulaire RSVP + `/api/rsvp` + Resend + stockage
- [ ] 8. Tests responsive (version allégée de l'animation sur mobile)
- [ ] 9. Achat et configuration DNS du domaine sur Vercel

### Reste à fournir

- Le texte définitif des pages Infos pratiques et Dress code.
- La photo du domaine pour le fond de la page d'accueil.
- Le fichier Excel des invités (nom, email, hébergement).
- Conversion des PNG en WebP avec fallback, notamment `presence.png` (1,5 Mo)
  et `programme.png` (1,9 Mo).
