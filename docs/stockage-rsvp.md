# Où atterrissent les réponses au formulaire

Une réponse validée est écrite à **deux endroits durables**, en parallèle :

1. une ligne dans l'onglet `REPONSES SITE` du Sheet de Lucie ;
2. deux mails envoyés par Resend — confirmation à l'invité, notification à `NOTIFY_EMAIL`.

Si **l'un des deux** réussit, l'invité voit « Merci, c'est noté ! ». Si **les deux**
échouent, la route répond 502 et demande à l'invité de réessayer : lui afficher
un remerciement alors que sa réponse est perdue serait un mensonge.

> ⚠️ Les logs de fonction Vercel ne sont **pas** un stockage. Leur rétention est
> d'**une heure** en plan Hobby. `traceRsvp()` n'existe que pour déboguer une
> soumission qui vient d'avoir lieu. Tant qu'aucune des deux intégrations
> ci-dessous n'est configurée, **n'envoyez pas le lien aux invités**.

---

## 1. L'onglet qui reçoit les réponses

À créer une seule fois dans le Sheet « Mariage des Lulu », à côté de `LAÏQUE` :

- nom de l'onglet : **`REPONSES SITE`** (exactement, c'est `SHEET_TAB` dans
  `src/lib/sheets.ts`) ;
- première ligne, les 8 en-têtes, dans cet ordre :

  | A | B | C | D | E | F | G | H |
  |---|---|---|---|---|---|---|---|
  | Date | Invité | E-mail | Présent | Plat | Sauce | Hébergement | Message |

Le code n'écrit jamais dans les autres onglets : il ajoute des lignes à la fin
de `REPONSES SITE!A:H`, rien d'autre. La liste d'invités de Lucie n'est donc
jamais modifiée par le site.

## 2. Le compte de service Google

Un compte de service est un « robot » avec sa propre adresse e-mail, que l'on
partage comme n'importe quel collaborateur. Aucun humain ne se connecte, ce qui
est indispensable pour une fonction serveur.

1. Sur <https://console.cloud.google.com>, créer un projet (ou en réutiliser un).
2. **APIs & Services → Library** : activer **Google Sheets API**.
3. **IAM & Admin → Service Accounts → Create service account**. Un nom suffit,
   aucun rôle IAM n'est nécessaire (l'accès vient du partage du Sheet).
4. Onglet **Keys → Add key → Create new key → JSON**. Un fichier se télécharge.
   Il contient `client_email` et `private_key`.
5. **Partager le Sheet** avec la valeur de `client_email` (elle ressemble à
   `xxx@yyy.iam.gserviceaccount.com`), en droit **Éditeur**.

Sans l'étape 5, l'API répond 403 : la clé est valide mais le robot n'a pas accès
au document.

## 3. Les secrets dans Vercel

Settings → Environment Variables, scope *Production* (et *Preview* si vous
voulez tester avant de publier) :

| Variable | Valeur |
|---|---|
| `GOOGLE_CLIENT_EMAIL` | le `client_email` du fichier JSON |
| `GOOGLE_PRIVATE_KEY` | la `private_key` du fichier JSON, **collée telle quelle**, avec ses `\n` littéraux |
| `RSVP_SPREADSHEET_ID` | la longue chaîne de l'URL du Sheet, entre `/d/` et `/edit` |

La clé privée est un PEM multi-lignes que Vercel stocke sur une seule ligne.
`readSheetConfig()` retransforme les `\n` littéraux en vrais retours à la ligne —
donc il ne faut surtout pas « nettoyer » la valeur à la main.

Les trois variables sont déclarées **optionnelles** dans `astro.config.mjs` : si
l'une manque, l'écriture Sheet est simplement sautée (un avertissement part dans
les logs) et le site continue de fonctionner. Seule `SITE_PASSWORD` est
obligatoire.

## 4. Vérifier que ça marche

Soumettre une réponse de test depuis `/rsvp`, puis :

- une ligne doit apparaître dans `REPONSES SITE` ;
- la réponse JSON de `POST /api/rsvp` contient `"stored": true`.

Si `stored` est `false`, la cause exacte est dans les logs Vercel, préfixée
`RSVP spreadsheet append failed:` — le plus souvent un 403 (Sheet non partagé
avec le robot) ou un 400 (nom d'onglet différent de `REPONSES SITE`).
