# Sources — ce que Lucie a envoyé

Dépôt des **sources brutes** du contenu du site : liens externes et textes des
mails, recopiés tels quels. Rien n'est reformulé ici. Quand une page du site
contredit ce fichier, c'est ce fichier qui fait foi — ou alors c'est qu'un
arbitrage a été pris, et il est noté dans la section « Écarts assumés » en bas.

## Liens externes

| Quoi | Lien | Récupéré dans |
|---|---|---|
| Drive des visuels (dossier Illustrator `DA-Mariage-Lulax`) | https://drive.google.com/drive/folders/1syO35_KoIUEEdDTxz7DRla0dowNx7Mrq | `docs/sources/da-mariage-lulax/` |
| Google Sheet de la liste des invités | https://docs.google.com/spreadsheets/d/1hnOdTrLM1wTOViaL8vFh3Dtkh7_tbw4bx9H7FBDsh_M/edit?gid=0#gid=0 | `docs/sources/invites-laique.csv` |

### Ce qui a été extrait du dossier Drive

Le dossier pèse 103 Mo (fichier `.ai`, HEIC, PNG en 4000 px) : il est **ignoré
par git**, comme `resitemariage/` et `sitemariage/`. Seuls les éléments
réellement utilisés par le site en sont sortis et versionnés :

| Source dans le dossier | Destination | Usage |
|---|---|---|
| `Fonts/BillaMount-Regular.ttf` | `public/fonts/billa-mount.woff2` + `.woff` | les titres, via le `@font-face` de `global.css` |
| `Links/Image 13-10-2026 à 13.53.png` | `assets-source/dress-code/couleurs.png` | les 3 pastilles de la page Dress code |

**Visuels repérés mais non versionnés.** Ils pèsent 9 Mo et ne servent encore
nulle part ; ils restent dans le Drive plutôt que dans le dépôt. Pour en
utiliser un, le copier dans `assets-source/decor/` puis relancer
`python scripts/prepare_assets.py` :

| Fichier du dossier Drive | Ce que c'est |
|---|---|
| `PNG/Fichier 6.png` | un tournesol à l'aquarelle |
| `PNG/Fichier 5.png` | un cartouche ovale « Domaine Verdé — Vacquiers, 31340 » |
| `PNG/Fichier 35.png` | une enveloppe ouverte avec le carton « Lucie & Lucas » |
| `PNG/Fichier 1.png` | un polaroid du couple |

La conversion de la police se refait avec `fontTools` :

```python
from fontTools.ttLib import TTFont
f = TTFont("…/Fonts/BillaMount-Regular.ttf"); f.flavor = "woff2"
f.save("public/fonts/billa-mount.woff2")
```

Tout ce qui est dans `assets-source/` est recadré vers `src/assets/images/` par
`python scripts/prepare_assets.py`.

**Pas encore exploité** : les 16 SVG de `SVG/` (versions vectorielles des formes
et des blocs de texte, noms non parlants « Fichier 2…20 »), les photos
`Links/IMG_2392.jpg` et `Links/IMG_8266.HEIC`. L'une des deux est peut-être la
photo du domaine attendue pour le fond de l'accueil — à confirmer avec Lucie.

### Le Sheet des invités

`docs/sources/invites-laique.csv` est l'export brut, converti par
`python scripts/import_guests.py` vers `src/data/guests.json` (90 invités,
30 déjà logés). Attention, ce n'est **pas** encore la liste définitive : Lucie
a écrit « je t'envoie la liste des invités pour le formulaire dès qu'on aura
tranché sur les derniers invités ». Points à clarifier avec elle :

- 4 entrées sont des réservations de place, pas des noms : `Nathalie?`,
  `sa meuf?`, `+ 1 de Marianne ?`, `+1 de maxime` — marquées `needs_review`.
- Le CSV n'a **aucun email** : le champ reste `null`, c'est le formulaire RSVP
  qui le collectera.
- La colonne M du Sheet (ELISE, MICHAEL, PAUL…, numérotée de 1 à 22) n'a pas
  d'en-tête : plan de table ? comptage ? Elle est **ignorée** par le script.
- « 5 chambres doubles / 2 chambres de 4 / 1 chambre de 8 / chez ju /
  camping car » sont recopiés tels quels dans le champ `logement` ; toute
  personne y figurant est marquée `hebergement: "hotel"` (= déjà logée, donc
  champ grisé dans le formulaire).

---

## Mail du vendredi 28 août, 16:32 — Lucie GALPERN &lt;lucie.galpern@gmail.com&gt; (à Lucas et Massyl)

> Hello,
>
> j'ai pas mal avancé :)
> voici les éléments à faire sortir de l'enveloppe en PJ
>
> - l'appareil photo, dress code, infos pratiques et présence seront des liens
>   cliquables qui renverront vers d'autres pages (l'idée c'est qu'on puisse
>   faire retour sur ces pages pour retourner à l'accueil)
>
> - appareil photo vers une page "à venir" ou on publiera les photos du mariage
>   quand on les aura
> - dress code, je te l'envoi après votre soirée garçon d'honneur quand vous avez
>   décidé de comment vous vous habillez avec les garçons pour dire aux autres
>   invités garçon de ne pas s'habiller dans ces teintes
> - infos pratiques je prépare le texte et je te l'envoie quand je l'ai
> - présence renverra vers le formulaire (il faut que je te prépare l'excel avec
>   les listes déroulantes)
>
> tandis que programme et invit seront juste des éléments simples
>
> est ce que ça te convient ? :)
>
> des gros bisous, j'espère que ca va pas trop etre une galère pour toi...

**Pièces jointes** : les 6 formes, rangées dans `assets-source/shapes/`.

---

## Mail suivant — les textes définitifs

> Hello Massyl,
>
> Voici les éléments textes :
>
> **Infos Pratiques**
>
> **Horaires & arrivée**
> Le domaine ouvrira ses portes à 15h, où des rafraîchissements vous attendront
> jusqu'au début de la cérémonie, qui commencera à 16h.
> Pour que tout le monde puisse profiter pleinement de ce moment et que la
> cérémonie commence à l'heure, nous comptons sur vous pour arriver suffisamment
> tôt. Évitez donc les arrivées de dernière minute à 15h50
> Comment accéder au domaine ? Passez le portail, puis remontez la grande allée.
> Le parking se trouve au fond, derrière la villa.
>
> **Au menu !**
> Pour le repas, nous avons opté pour un food truck qui vous proposera des pâtes
> ou des gnocchis, accompagnés de la sauce de votre choix.
> Afin de limiter l'attente, nous vous invitons à choisir votre menu à l'avance,
> directement dans le formulaire de confirmation que vous retrouverez plus bas.
>
> **Où dormir ?**
> Le domaine est niché au cœur d'une forêt, et vous pourrez tout à fait planter
> votre tente sur place pour profiter de la soirée sans vous soucier du retour.
> Si l'option camping vous tente, pensez simplement à apporter votre matériel !
> Pour ceux qui préfèrent un peu plus de confort, un hôtel se trouve à environ
> 15 minutes en voiture : Hôtel Eurocentre – Castelnau-d'Estrétefonds.
> N'hésitez pas à vous organiser entre vous pour partager les taxis et limiter
> les trajets. Vous pouvez aussi regarder les Airbnb, il y en a plusieurs aux
> alentours.
>
> **Confirmation de présence**
> Pour nous aider à organiser cette belle journée au mieux, merci de confirmer
> votre présence avant la fin du mois de mars, en remplissant le formulaire
> disponible en bas de du site.
>
> On a hâte de partager cette journée avec vous ! ❤️
>
> **Programme**
>
> **Samedi**
>
> 15h - Ouverture des portes du domaine
> 16h - Début de la cérémonie
> 17h30 - Photos de groupe
> 18h00 - vin d'honneur
> 20h - Repas
>
> - Soirée dansante -
>
> **Dimanche**
>
> 10h30 - Brunch
>
> **Dress code**
> Le bleu ciel, le vert olive et le jaune beurre indiqués ci-dessus sont les
> couleurs dédiées à la team d'honneur et aux témoins des mariés.
>
> Quant aux invités, n'hésitez pas à oser la couleur, qu'elle soit pastel ou
> pétillante !
>
> Les titres et les jours du programmes sont à écrire en police Billa Mount
> Le reste des textes en time new roman
>
> Je t'envoie la liste des invités pour le formulaire dès qu'on aura tranché sur
> les derniers invités !
>
> merci encore à tous les deuuuux

---

## Écarts assumés entre ces sources et le site

| Source | Site | Pourquoi |
|---|---|---|
| « le formulaire disponible en bas du site » | lien vers `/rsvp` | Le RSVP est une page à part (devbook §2), pas un bloc en bas de page. |
| « programme […] juste un élément simple » | page dédiée `/programme` | Le texte du programme est arrivé après ce mail ; trop long pour tenir dans le visuel. Arbitré avec Massyl. |
| Couleurs du dress code « indiquées ci-dessus » | l'aquarelle de Lucie affichée telle quelle | Le visuel a été retrouvé dans le Drive ; plus besoin de pastilles CSS approximées. |

## Ce qui manque encore

- La **liste définitive des invités** (voir ci-dessus) et les 4 entrées à
  clarifier.
- La **photo du domaine** pour le fond de la page d'accueil — peut-être déjà
  dans `Links/` du dossier Drive, à confirmer.
