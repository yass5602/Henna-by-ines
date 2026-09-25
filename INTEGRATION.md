# Henna by Inès — brancher PayPal et Google Agenda

Tout se configure dans **un seul fichier : `config.js`**.
Ni `index.html` ni `support.js` ne sont à modifier.

---

## Étape 1 — Google Agenda (et les e-mails)

Un petit script hébergé gratuitement par Google fait le lien entre le site et votre agenda.
Comptez 5 minutes, aucune carte bancaire.

1. Ouvrez **https://script.google.com** avec le compte Google dont vous voulez
   remplir l'agenda, puis **Nouveau projet**.
2. Effacez le contenu de `Code.gs` et collez à la place tout le contenu du fichier
   **`google-apps-script.gs`** fourni.
3. En haut du script, réglez `SETTINGS` :
   - `CALENDAR_ID` : laissez `'primary'` pour votre agenda principal ;
   - `NOTIFY_EMAIL` : l'adresse qui recevra les réservations (vide = celle du compte) ;
   - `EVENT_DURATION_MIN` : longueur du repère posé dans l'agenda (30 min par défaut) ;
   - `INVITE_CLIENT` : `true` si vous voulez que la cliente reçoive l'invitation.
4. Menu **Paramètres du projet** (roue dentée) → vérifiez que le fuseau horaire
   est bien **(GMT+01:00) Paris**.
5. Sélectionnez la fonction `testReservation` et cliquez sur **Exécuter**.
   Google demande d'autoriser l'accès à l'agenda, Drive et Gmail : acceptez
   (« Paramètres avancées » → « Accéder à … »). Un rendez-vous test apparaît
   demain à 14 h dans votre agenda — supprimez-le ensuite.
6. **Déployer** → **Nouveau déploiement** → type **Application Web** :
   - *Exécuter en tant que* : **moi** ;
   - *Qui a accès* : **Tout le monde**. ← indispensable, sinon le site ne peut pas écrire.
7. Copiez l'**URL de l'application Web** (elle se termine par `/exec`) et collez-la
   dans `config.js` :

   ```js
   appsScriptUrl: "https://script.google.com/macros/s/AKfycbx.../exec",
   ```

> À chaque modification du script, refaites **Déployer → Gérer les déploiements →
> modifier → Nouvelle version**, sinon l'ancienne version reste en ligne.

### Ce qui se passe ensuite

| Moment | Effet |
|---|---|
| La cliente envoie le formulaire | Un événement **⏳ orange « acompte en attente »** est créé dans votre agenda à l'heure demandée, avec coordonnées, adresse, formules par main, message et lien vers l'image de référence. Vous recevez un e-mail. |
| Elle clique « J'ai effectué le paiement » | Le même événement passe en **✅ vert « acompte réglé »**. Vous recevez un second e-mail vous invitant à vérifier PayPal. |
| Commande produit / message de contact | E-mail de notification (pas d'événement agenda). |

L'image de référence envoyée par la cliente est rangée dans un dossier Drive
« Henna by Inès — Références clientes » et son lien est ajouté à l'événement.

**Aucune durée n'est annoncée.** Ni le site ni les e-mails n'estiment le temps
que prendra la prestation, et l'évènement agenda n'est qu'un repère de 30 minutes
posé à l'heure de début : vous rallongez le créneau vous-même une fois la durée
réelle connue. Pour changer la longueur de ce repère, modifiez
`EVENT_DURATION_MIN` en haut du script.

---

## Étape 2 — PayPal

Vous avez choisi les **liens de paiement**, donc rien à installer.

1. Créez votre lien sur **https://www.paypal.com/paypalme/grant**
   (ou récupérez-le s'il existe déjà).
2. Si votre lien est `https://paypal.me/hennabyines`, renseignez dans `config.js` :

   ```js
   paypal: { me: "hennabyines" },
   ```

Le site construit alors automatiquement un lien pré-rempli avec le bon montant
(`…/paypalme/hennabyines/10.00EUR` pour l'acompte, le prix du produit pour une commande).
La cliente paie dans un nouvel onglet, revient sur le site et clique
« J'ai effectué le paiement ».

### Optionnel — boutons PayPal hébergés

Si vous préférez de vrais boutons PayPal par produit (PayPal → *Outils de paiement*
→ *Boutons de paiement*), collez l'URL de chaque bouton dans `hostedButtons`, avec
pour clé la référence du produit :

| Référence | Produit |
|---|---|
| `acompte` | acompte de réservation (10 €) |
| `cone-1` | 1 cône — 3 € |
| `cone-10` | 10 cônes + 1 offert — 30 € |
| `box-debutante` | Box débutante — 15 € |
| `poudre-100` | Poudre 100 g — 8 € |
| `poudre-200` | Pack 2 × 100 g — 14,90 € |
| `poudre-300` | Pack 3 × 100 g — 21,50 € |

Un bouton hébergé est prioritaire sur PayPal.Me pour ce produit.

### Point important

Avec des liens PayPal, **le site ne peut pas vérifier tout seul qu'un paiement a
bien eu lieu** : c'est la cliente qui le déclare. L'événement agenda et l'e-mail
vous le rappellent explicitement. Vérifiez donc toujours la réception sur PayPal
avant de confirmer une date.

Le jour où vous voudrez une confirmation automatique, il faudra un compte
PayPal professionnel + un backend (voir étape 4) : le code est déjà prévu pour.

---

## Étape 2 bis — Les e-mails

**Un seul e-mail par commande.** Rien n'est envoyé au clic sur « Commander » :
la cliente saisit d'abord son adresse, et la commande ne part qu'au moment où
elle est redirigée vers PayPal. Le bouton « J'ai effectué le paiement »
n'apparaît plus sur les commandes — c'est lui qui créait les doublons. Il reste
sur les prises de RDV, où il ne fait pas doublon : il fait passer l'évènement
agenda de ⏳ orange à ✅ vert.

**La cliente reçoit aussi un récapitulatif**, pour une commande comme pour un
rendez-vous. Pour le désactiver, mettez `CONFIRM_CLIENT: false` en haut du
script Google. Deux réglages voisins à ajuster : `NOM_EXPEDITEUR` et
`CONTACT_PUBLIC`, l'adresse à laquelle les clientes répondront.

**Plus de 2 mains ?** Le formulaire propose 1 ou 2 mains, plus un bouton
« Demande de devis ultérieur ». S'il est coché, la réservation est posée pour
2 mains, l'évènement agenda porte le repère « ➕ devis mains supp. », et votre
mail commence par « ➕ DEVIS À ÉTABLIR » : recontactez la cliente pour chiffrer
le reste (elle précise le nombre dans son message).

> ⚠️ Ces e-mails partent depuis votre Gmail. La limite est de 100 destinataires
> par jour sur un compte gratuit — largement suffisant, mais bon à savoir.
> Si l'envoi à la cliente échoue, la réservation est quand même enregistrée.

---

## Étape 3 — Mise en ligne

Le site est composé de :

```
index.html              la page d'accueil
config.js               vos réglages          ← à remplir
support.js              le moteur d'affichage
confidentialite.html    politique de confidentialité (RGPD)
mentions-legales.html   mentions légales
404.html                page d'erreur
image/                  logo, mains, cônes, poudre, motif de fond
```

> ⚠️ **Avant la mise en ligne**, ouvrez `mentions-legales.html` et
> `confidentialite.html` : les passages surlignés en jaune entre crochets sont
> à remplacer par vos informations réelles (statut, SIRET, adresse, hébergeur,
> médiateur de la consommation). Tant qu'ils ne le sont pas, ces pages ne vous
> protègent pas. Je ne suis pas juriste : pour une activité commerciale,
> faites relire ces pages.

**La page 404** est reconnue automatiquement par Netlify, Vercel, GitHub Pages
et la plupart des hébergeurs, du seul fait qu'elle s'appelle `404.html`. Sur un
serveur Apache classique, ajoutez un fichier `.htaccess` contenant
`ErrorDocument 404 /404.html`.

Déposez ces fichiers tels quels chez votre hébergeur.

> ⚠️ **Noms de dossiers.** Les dossiers `image/pack/Henna charge`,
> `Henna moyen` et `henna simple` contiennent des espaces et des majuscules.
> Windows s'en accommode, mais un serveur Linux distingue les majuscules :
> si les photos n'apparaissent pas en ligne, renommez les dossiers en
> `charge`, `moyen`, `simple` et remplacez les chemins correspondants dans
> `index.html`. C'est plus sûr à long terme.

---

## Étape 4 — Plus tard : votre propre serveur

Le code est déjà prêt. Renseignez `apiBase` dans `config.js` et le site postera
du JSON sur vos routes, en ignorant Apps Script :

| Action | Route | Contenu |
|---|---|---|
| Réservation | `POST /api/bookings` | contact, adresse, évènement, mains, acompte, référence |
| Paiement déclaré | `POST /api/payments` | `ref`, `amount`, `method` |
| Commande | `POST /api/orders` | `item` (sku, label, price, options) |
| Contact | `POST /api/contacts` | nom, e-mail, sujet, message |

Chaque route doit répondre du JSON ; renvoyez `{ "ok": true, "bookingId": "…" }`
pour une réservation, afin que le paiement puisse être rattaché ensuite.

C'est aussi à ce moment-là qu'on pourra passer au **SDK PayPal** (capture du
paiement vérifiée côté serveur) et à l'**API Google Calendar** avec un compte
de service, pour ne plus dépendre d'Apps Script.

---

## Vérifier que tout marche

1. Ouvrez `index.html` dans votre navigateur (double-clic suffit pour un premier
   coup d'œil ; pour tester l'envoi, passez par l'hébergeur ou un petit serveur local).
2. Remplissez le formulaire de RDV et validez.
3. L'événement doit apparaître dans votre agenda, et l'e-mail arriver.
4. Dans la fenêtre qui s'ouvre, le bouton bleu doit mener à PayPal avec le bon montant.
5. Si rien ne part : ouvrez la console du navigateur (F12). En mode démo
   (`appsScriptUrl` vide) le message `[HENNA] Aucun backend configuré` s'affiche
   avec le contenu de la réservation — c'est normal.
