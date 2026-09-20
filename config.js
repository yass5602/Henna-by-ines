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
  appsScriptUrl: "https://script.google.com/macros/s/AKfycbyks24yOYPbIt79RShho8E5HTUWtLGRhIqV3-huiidWXFUDWjkmuPi1mlVMQIroYFg5Ow/exec",
  // Projet Apps Script « Henna by Inès — Réservations », déployé le 20/09/2026.


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
     4. PLUS TARD : VOTRE PROPRE SERVEUR
     --------------------------------------------------------------------------
     Le jour où vous aurez un backend, renseignez apiBase : il devient
     prioritaire sur appsScriptUrl et le site postera en JSON sur
     /api/bookings, /api/contacts, /api/orders et /api/payments.
  -------------------------------------------------------------------------- */
  apiBase: ""
};
