/* ============================================================================
   Henna by Inès — Configuration du site
   ----------------------------------------------------------------------------
   C'est LE SEUL fichier à modifier pour brancher PayPal et Google Agenda.
   Remplacez les valeurs entre guillemets, enregistrez, rechargez la page.
   ========================================================================== */

window.HENNA_CONFIG = {

  /* --------------------------------------------------------------------------
     1. GOOGLE AGENDA + E-MAILS  (via Google Apps Script)
     --------------------------------------------------------------------------
     Collez ici l'URL de déploiement du script Google (elle se termine par /exec).
     Voir INTEGRATION.md, étape 1.
     Tant que c'est vide, les réservations s'affichent seulement dans la
     console du navigateur (mode démo) — rien n'est perdu, rien n'est envoyé.
  -------------------------------------------------------------------------- */
  appsScriptUrl: "https://script.google.com/macros/s/AKfycbwTMhLHpVKTRtZALXw6bRFM_5HUWi0jAyAxSfUNoGSG_SGxBEB3VGWUokDhvILowd3j/exec",
  // Projet Apps Script « Henna by Inès — Réservations »,
  // compte henna.by.ines15@gmail.com, version 1 déployée le 25/09/2026.


  /* --------------------------------------------------------------------------
     2. PAYPAL
     --------------------------------------------------------------------------
     Option A (la plus simple) : votre identifiant PayPal.Me.
       Créez-le sur https://www.paypal.com/paypalme/grant
       Si votre lien est https://paypal.me/hennabyines  ->  me: "hennabyines"

     Option B : des boutons PayPal hébergés, un par produit (facultatif).
       PayPal > Outils de paiement > Boutons de paiement. Collez l'URL
       du bouton en face de la référence du produit. Un bouton hébergé a
       priorité sur PayPal.Me pour ce produit.
  -------------------------------------------------------------------------- */
  paypal: {
    me: "hennabyines15",       // https://www.paypal.me/hennabyines15

    hostedButtons: {
      // "acompte":       "https://www.paypal.com/ncp/payment/XXXXXXXX",
      // "cone-1":        "https://www.paypal.com/ncp/payment/XXXXXXXX",
      // "cone-10":       "https://www.paypal.com/ncp/payment/XXXXXXXX",
      // "box-debutante": "https://www.paypal.com/ncp/payment/XXXXXXXX",
      // "poudre-100":    "https://www.paypal.com/ncp/payment/XXXXXXXX",
      // "poudre-200":    "https://www.paypal.com/ncp/payment/XXXXXXXX",
      // "poudre-300":    "https://www.paypal.com/ncp/payment/XXXXXXXX"
    },

    // Option C, repli : e-mail du compte PayPal professionnel.
    businessEmail: ""
  },


  /* --------------------------------------------------------------------------
     3. MONTANTS
  -------------------------------------------------------------------------- */
  // Acompte de réservation, en euros.
  //   10 -> la cliente règle 10 € sur PayPal pour bloquer la date
  //    0 -> aucun acompte : la demande est envoyée, vous rappelez pour confirmer
  //         (toutes les mentions d'acompte disparaissent automatiquement du site)
  depositAmount: 10,           // 0 = aucun acompte, la demande part sans paiement
  currency: "EUR",


  /* --------------------------------------------------------------------------
     4. PRODUITS  (catalogue utilisé par la page de commande commande.html)
     --------------------------------------------------------------------------
     C'est ici que vous changez un prix ou un libellé de produit : la page
     commande.html va chercher ces valeurs, inutile de toucher au HTML.
     oilChoice: true -> la page propose « avec / sans huile essentielle ».
  -------------------------------------------------------------------------- */
  /* kind   : "cone" | "box" | "poudre" (sert au calcul des frais de port)
     grams  : poids de poudre contenu (poudre uniquement)
     La poudre est limitée à powderMaxGrams (300 g) par commande.
     Les cônes ne se vendent plus à l'unité : on part du lot de 10 (le 11ᵉ offert). */
  products: {
    "cone-10":       { kind: "cone",   label: "Lot de 10 cônes de henné (le 11ᵉ offert)", price: 30,   oilChoice: true  },
    "box-debutante": { kind: "box",    label: "Box débutante henné (5 cônes, huile, spray révélateur)", price: 15, oilChoice: true },
    "poudre-100":    { kind: "poudre", label: "Poudre de henné BAQ — 100 g",           price: 8,    grams: 100, oilChoice: false },
    "poudre-200":    { kind: "poudre", label: "Poudre de henné BAQ — Pack 2 × 100 g",  price: 14.9, grams: 200, oilChoice: false },
    "poudre-300":    { kind: "poudre", label: "Poudre de henné BAQ — Pack 3 × 100 g",  price: 21.5, grams: 300, oilChoice: false }
  },
  powderMaxGrams: 300,


  /* --------------------------------------------------------------------------
     5. LIVRAISON (Colissimo)
     --------------------------------------------------------------------------
     Règle appliquée au panier (un seul colis) :
       • poudre seule, jusqu'à lightMaxGrams (250 g)  ->  light  (5,49 €)
       • tout le reste (cônes, box, poudre au-delà de 250 g, panier mixte)
                                                      ->  standard (7,59 €)
     Les tarifs se changent ici, la page de commande recalcule tout.

     freeFrom -> montant du panier (hors frais de port) à partir duquel la
                 livraison est offerte. Seuil pas encore connu : null = jamais
                 de livraison offerte. Exemple : freeFrom: 60
  -------------------------------------------------------------------------- */
  shipping: {
    light: 5.49,
    standard: 7.59,
    lightMaxGrams: 250,
    freeFrom: null
  },


  /* --------------------------------------------------------------------------
     6. PLUS TARD : VOTRE PROPRE SERVEUR
     --------------------------------------------------------------------------
     Le jour où vous aurez un backend, renseignez apiBase : il devient
     prioritaire sur appsScriptUrl et le site postera en JSON sur
     /api/bookings, /api/contacts, /api/orders et /api/payments.
  -------------------------------------------------------------------------- */
  apiBase: ""
};
