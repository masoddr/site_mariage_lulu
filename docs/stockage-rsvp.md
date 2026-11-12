# Où atterrissent les réponses au formulaire

Une réponse validée est écrite à **deux endroits durables**, en parallèle :

1. la ligne de l'invité dans l'onglet **`fichier inscription`** du Sheet de Lucie ;
2. deux mails envoyés par Resend — confirmation à l'invité, notification à `NOTIFY_EMAIL`.

Si **l'un des deux** réussit, l'invité voit « Merci, c'est noté ! ». Si **les deux**
échouent, la route répond 502 et demande à l'invité de réessayer : lui afficher
un remerciement alors que sa réponse est perdue serait un mensonge.

> ⚠️ Les logs de fonction Vercel ne sont **pas** un stockage. Leur rétention est
> d'**une heure** en plan Hobby. `traceRsvp()` n'existe que pour déboguer une
> soumission qui vient d'avoir lieu. Tant qu'aucune des deux intégrations
> ci-dessous n'est configurée, **n'envoyez pas le lien aux invités** : toute
> réponse serait refusée.

---

## 1. L'onglet `fichier inscription`

Rien à créer : l'onglet existe, avec **une ligne par invité** que le site vient
remplir. Sa structure, telle que le code l'attend :

| | A | B | C | D | E | F | G |
|---|---|---|---|---|---|---|---|
| **ligne 1** | | | | `REPAS` (fusionnée) | | | |
| **ligne 2** | `Invités` | `Présence` | `Logement` | `Plat` | `Sauce` | `Dessert` | `Brunch lendemain` |
| **ligne 3+** | un invité par ligne | | | | | | |

Le site écrit **uniquement** dans les colonnes **B, D, E, F et G** de la ligne
concernée. Il ne touche jamais :

- la colonne **A**, les noms ;
- la colonne **C**, `Logement` — c'est la donnée de planification de Lucie
  (`HOTEL OFFERT`, `CAMPING CAR`, `DOMAINE VERDE`). Le site la **lit** pour
  verrouiller le champ hébergement des invités déjà logés, mais ne l'écrit
  jamais. Le choix d'hébergement d'un invité libre part dans le mail seulement.

Les valeurs sont écrites en majuscules (`OUI`, `PATES`, `GNOCCHIS`) pour
ressembler à ce que Lucie saisit déjà à la main.

Le **« mot pour les mariés » ne va pas dans le Sheet** : il n'a pas de colonne,
et il part uniquement dans les mails. Si Resend n'est pas configuré, ce mot est
perdu — les réponses structurées, elles, survivent dans le Sheet.

### Comment la bonne ligne est trouvée

À chaque soumission, le site relit la colonne A et cherche le nom. Il ne stocke
**pas** un numéro de ligne dans `guests.json` : Lucie trie et insère des lignes
dans cet onglet, et un index périmé écrirait la réponse d'un invité sur la ligne
d'un autre. La comparaison ignore la casse, les accents et les espaces en trop.

Corollaire : **renommer quelqu'un dans la colonne A casse le lien** avec
`guests.json` tant que l'import n'a pas été rejoué (`python scripts/import_guests.py`
après avoir ré-exporté le CSV). Le symptôme est explicite dans les logs :
`no row for "..." in fichier inscription`.

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

- la ligne de l'invité choisi doit se remplir dans `fichier inscription` ;
- la réponse JSON de `POST /api/rsvp` contient `"stored": true`.

> Pensez à effacer la ligne de test ensuite, sinon elle compte comme une vraie
> réponse.

Si `stored` est `false`, la cause exacte est dans les logs Vercel, préfixée
`RSVP spreadsheet write failed:` :

| Message | Cause |
|---|---|
| `403` | le Sheet n'est pas partagé avec l'adresse du compte de service |
| `no row for "..."` | le nom de `guests.json` ne correspond plus à la colonne A |
| `400` | l'onglet a été renommé (le code attend `fichier inscription`) |
