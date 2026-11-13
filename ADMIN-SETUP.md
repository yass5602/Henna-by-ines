# Espace administrateur — mise en place (une seule fois, ~15 min)

L'espace administrateur (`/admin.html`) permet à la propriétaire du site de modifier, sans toucher au code :
les **textes**, les **photos du site**, la **galerie de réalisations**, le **catalogue de location** (photos, prix, catégories)
et les **prix des produits**. Les données sont stockées chez **Supabase** (offre gratuite).

Tant que rien n'est configuré, le site fonctionne exactement comme avant.

## 1. Créer le projet Supabase

1. Créer un compte gratuit sur <https://supabase.com> (connexion avec GitHub ou e-mail).
2. **New project** : nom `henna-by-ines`, région **Europe** (Paris ou Frankfurt), choisir un mot de passe de base de données
   (le garder dans un gestionnaire de mots de passe ; il ne sert jamais dans le site).
3. Attendre ~2 minutes la création du projet.

## 2. Créer les tables et les règles de sécurité

1. Menu **SQL Editor** > **New query**.
2. Ouvrir le fichier `supabase-setup.sql`, **remplacer `ADMIN_EMAIL_ICI`** par l'adresse e-mail de l'administratrice
   (celle du compte créé à l'étape 3), puis coller le tout dans l'éditeur et cliquer **Run**.

Résultat : tout le monde peut **lire** le contenu du site, mais seule cette adresse peut le **modifier**.

## 3. Créer le compte administrateur

1. Menu **Authentication** > **Users** > **Add user** > **Create new user**.
2. Saisir l'e-mail (le même qu'à l'étape 2) et un mot de passe solide, cocher **Auto Confirm User**.
3. Menu **Authentication** > **Sign In / Providers** (ou *Settings*) : **désactiver « Allow new users to sign up »**,
   pour que personne d'autre ne puisse créer de compte.

## 4. Brancher le site

1. Menu **Project Settings** > **API** (ou *Data API* / *API Keys*) :
   - copier **Project URL** (`https://xxxx.supabase.co`) ;
   - copier la clé **anon / public**.
2. Dans `config.js`, rubrique `supabase`, renseigner :

```js
supabase: {
  url: "https://xxxx.supabase.co",
  anonKey: "eyJhbGciOi...",   // clé publique « anon »
  bucket: "media"
},
```

La clé « anon » peut être publique : ce sont la connexion et les règles de l'étape 2 qui protègent les modifications.
**Ne jamais** mettre la clé « service_role » dans le site.

3. Publier (`git add . && git commit && git push`), puis ouvrir **https://www.hennabyines.ch/admin.html**.

## 5. Première utilisation

- Onglet **Réalisations** : cliquer sur **Importer les photos actuelles** une fois, pour pouvoir ensuite en retirer,
  en ajouter et les réordonner.
- Onglet **Location** : cliquer sur **Importer le catalogue actuel** une fois, pour pouvoir ensuite modifier les articles.
- Onglet **Textes** : cliquer sur **Modifier** à côté d'un texte. `**mot**` met un mot en gras.
  Le bouton « Rétablir l'original » annule une modification.
- Onglet **Photos du site** : remplacer une photo de l'accueil (redimensionnée automatiquement).
- Onglet **Produits & prix** : le prix et le nom changent à la fois l'affichage, le panier et la page de commande.

L'adresse `/admin.html` n'est ni dans le menu, ni dans le sitemap, et la page est marquée « noindex ».

## Modifier directement sur les pages

Depuis l'espace administrateur (`/admin.html`), le bandeau sombre « Modifier directement sur le site » ouvre la page d'accueil ou la page Location en **mode édition** (adresses `index.html?edit` et `location.html?edit`). Il faut être connectée : sans connexion, rien ne s'affiche et la page reste normale.

- **Accueil** : un clic sur un texte, une photo ou un prix ouvre sa fenêtre de modification (avec « Rétablir l'original »). Sous la galerie de réalisations, « + Ajouter des photos » ; un clic sur une photo de la galerie permet de changer sa légende, la remplacer, la déplacer (◀ ▶) ou la supprimer.
- **Location** : chaque article porte ses boutons (◀ ▶ déplacer, ✎ Modifier, 🗑 Supprimer) ; « + Ajouter un article » en haut de la liste ; les articles masqués se réaffichent via « Articles masqués ».
- **Quitter** : bouton « Quitter » dans la barre en bas de l'écran. Les visiteurs ne voient jamais cette barre et ne téléchargent pas le fichier `edit-mode.js`.

## Pilotage : agenda, recettes et tableau de bord

La page privée **`/pilotage.html`** (lien « Agenda & recettes » dans l'espace administrateur, même e-mail et mot de passe) regroupe :

- un **tableau de bord** : recettes, dépenses et bénéfice du jour, de la semaine (lundi à dimanche) et du mois, comparés à la période précédente, avec graphique (30 jours, 12 semaines ou 12 mois) et répartition par prestation ;
- un **calendrier** mensuel et un **agenda** de rendez-vous (titre, client, date et heure ou journée entière, lieu, note) ;
- les **recettes et dépenses** (montant, date, prestation, mode de paiement, note) avec filtres, recherche et export CSV ;
- un onglet **Google Agenda**.

**Installation (une seule fois)** : dans Supabase > SQL Editor, exécuter le contenu de `supabase-pilotage.sql` (après `supabase-setup.sql`). Il crée quatre tables **privées** : seule l'administratrice connectée peut les lire ou les modifier ; les visiteurs n'ont aucun accès.

**Commandes PayPal** : quand un client clique sur « Payer avec PayPal » dans `commande.html`, la commande (nom, e-mail, téléphone, panier, total) est déposée dans la liste « Commandes PayPal à confirmer ». Elle n'est **pas** comptée dans les totaux tant que vous n'avez pas cliqué sur « Vérifier et enregistrer » : un clic ne prouve pas qu'un paiement a abouti. Vérifiez dans PayPal, ajustez si besoin, puis enregistrez ; ou « Ignorer ». Les visiteurs peuvent seulement déposer cette ligne, jamais la relire.

**Google Agenda** (formule simple, sans projet Google Cloud) :

- chaque rendez-vous a un bouton « + Google Agenda » qui ouvre Google Agenda avec l'événement déjà rempli, à valider ;
- l'onglet Google Agenda affiche votre agenda dans la page : saisir l'adresse Gmail de l'agenda. Il s'affiche si vous êtes connectée à ce compte Google dans le navigateur. Ne rendez pas l'agenda public (vos rendez-vous clients seraient visibles par tous) ;
- il n'y a pas de synchronisation automatique dans les deux sens : un rendez-vous créé ici n'apparaît dans Google Agenda que via le bouton.

**Confidentialité** : les nom, e-mail et téléphone des clients PayPal sont conservés dans votre base Supabase privée (ils partaient déjà vers votre Google Sheet). Mentionnez-le dans votre politique de confidentialité si besoin et supprimez les lignes devenues inutiles.

## Bon à savoir

- **Rien ne casse si Supabase est indisponible** : le site affiche la dernière version connue (mémorisée dans le navigateur
  du visiteur) ou, à défaut, les textes et images d'origine.
- **Affichage** : les modifications apparaissent après un très court instant au premier chargement ; ensuite elles sont
  immédiates. Les moteurs de recherche voient d'abord les textes d'origine du fichier, puis les modifications une fois
  le JavaScript exécuté.
- **Offre gratuite** : stockage et trafic limités (largement suffisants pour ce site) et, à ce jour, un projet gratuit
  est mis en pause après environ une semaine sans aucune activité ; il se réveille depuis le tableau de bord Supabase
  (bouton *Restore*). Vérifier les limites actuelles sur <https://supabase.com/pricing>.
- **Prix et frais de port** : les frais de port (grille Colissimo) restent dans `config.js`, rubrique `shipping`.
- **Rendre un autre texte modifiable** : ajouter `data-edit="nom.unique"` à n'importe quelle balise de `index.html`
  qui ne contient que du texte (sans `{{ }}`) ; il apparaît automatiquement dans l'onglet « Textes ».
  Idem pour une photo : `data-img="nom-unique"` sur la balise `<img>`.
- **Sauvegarde** : Supabase > *Table Editor* permet d'exporter chaque table en CSV.
