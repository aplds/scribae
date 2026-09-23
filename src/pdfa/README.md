# Ressources de l'export PDF/A

Tout ce que l'export **PDF/A** embarque dans les fichiers qu'il produit. Ces
ressources ne servent que là : l'application les charge **à la demande**, la
première fois qu'un PDF/A est téléchargé (rien n'est téléchargé au démarrage).

| Fichier | Rôle | Licence |
| --- | --- | --- |
| `fonts/SourceSerif4-{Regular,Bold,It,BoldIt}.ttf` | famille « à empattements » du PDF/A — elle tient le rôle de la police à empattements de la charte | SIL Open Font License 1.1 (`LICENSE-POLICES.txt`) |
| `fonts/SourceSans3-{Regular,Bold,It,BoldIt}.ttf` | famille « sans empattement » du PDF/A | SIL Open Font License 1.1 (`LICENSE-POLICES.txt`) |
| `sRGB-v2-magic.icc` | profil colorimétrique **sRVB v2** déposé comme *OutputIntent* : la norme PDF/A l'exige (sans lui, le fichier n'est pas conforme) | CC0-1.0 (domaine public) |

## Pourquoi ces polices, et pourquoi embarquées

La norme PDF/A (ISO 19005) **interdit de dépendre d'une police qui n'est pas
embarquée dans le fichier** : un PDF/A doit rester identique dans vingt ans, sur
une machine qui n'a ni Times New Roman ni Segoe UI. Le PDF/A ne peut donc pas
utiliser les polices du système, ni les polices standard du format PDF
(Helvetica, Times, Courier : elles ne sont pas embarquables). Il embarque à la
place, en **sous-ensemble** (seuls les caractères réellement utilisés),
deux familles libres :

- **Source Serif 4** pour les chartes à empattements (Times, Georgia, Garamond,
  Cambria, Palatino, Century Schoolbook…) ;
- **Source Sans 3** pour les chartes sans empattement (Segoe UI, Arial, Calibri,
  Verdana, Tahoma, Trebuchet, Century Gothic…).

Le choix de la famille du document est donc respecté *par catégorie* : une
charte à empattements donne un PDF/A à empattements. Les métriques diffèrent
légèrement de la police système du même genre, si bien que les fins de ligne
peuvent bouger de quelques mots par rapport à l'aperçu ou au fichier Word — la
mise en page, les marges et les corps de texte, eux, sont ceux de la charte.

## Reconstruire ces fichiers

```
# les polices (SIL OFL) : les 4 instances statiques du dossier TTF/
https://github.com/adobe-fonts/source-serif/releases/download/4.005R/source-serif-4.005_Desktop.zip
https://github.com/adobe-fonts/source-sans/releases/download/3.052R/TTF-source-sans-3.052R.zip

# le profil colorimétrique (CC0), dépôt « Compact-ICC-Profiles »
https://raw.githubusercontent.com/saucecontrol/Compact-ICC-Profiles/master/profiles/sRGB-v2-magic.icc
```

Ne prendre que les instances **statiques** (`TTF/SourceSerif4-Regular.ttf`…).
Les fichiers `VAR/` sont des polices **variables** : `pdf-lib` n'embarquerait
que leur instance par défaut, et les graisses (gras, italique) seraient perdues.

## Contexte technique

L'export lui-même (mise en page, pagination, métadonnées XMP, *OutputIntent*)
est décrit dans `src/README.md`, section « PDF/A », et son code vit dans
`src/lib/pdfa.js`.
