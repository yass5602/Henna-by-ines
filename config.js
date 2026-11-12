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

  // WhatsApp qui reçoit les demandes de devis de la page Location (indicatif pays + numéro, sans « + » ni espaces)
  whatsapp: "33627113078",


  /* --------------------------------------------------------------------------
     4. PRODUITS  (catalogue utilisé par la page de commande commande.html)
     --------------------------------------------------------------------------
     C'est ici que vous changez un prix ou un libellé de produit : la page
     commande.html va chercher ces valeurs, inutile de toucher au HTML.
     oilChoice: true -> la page propose « avec / sans huile essentielle ».
  -------------------------------------------------------------------------- */
  /* kind   : "cone" | "box" | "poudre" (sert au calcul des frais de port)
     grams  : poids de poudre contenu (poudre uniquement)
     shipCones : nombre de cônes pris en compte dans la grille de frais de port (voir §5)
                 — le lot de 10 compte 11 (le 11ᵉ est offert) ; la box compte 9 (cônes + huile + spray,
                 ce qui donne 7,59 € pour une box).
     La poudre est limitée à powderMaxGrams (300 g) par commande. */
  products: {
    "cone-1":        { kind: "cone",   label: "1 cône de henné",                          price: 3,    shipCones: 1,  oilChoice: true  },
    "cone-10":       { kind: "cone",   label: "Lot de 10 cônes de henné (le 11ᵉ offert)", price: 30,   shipCones: 11, oilChoice: true  },
    "box-debutante": { kind: "box",    label: "Box débutante henné (5 cônes, huile, spray révélateur)", price: 15, shipCones: 9, oilChoice: true },
    "poudre-100":    { kind: "poudre", label: "Poudre de henné BAQ — 100 g",           price: 8,    grams: 100, oilChoice: false },
    "poudre-200":    { kind: "poudre", label: "Poudre de henné BAQ — Pack 2 × 100 g",  price: 14.9, grams: 200, oilChoice: false },
    "poudre-300":    { kind: "poudre", label: "Poudre de henné BAQ — Pack 3 × 100 g",  price: 21.5, grams: 300, oilChoice: false }
  },
  powderMaxGrams: 300,


  /* --------------------------------------------------------------------------
     5. LIVRAISON (Colissimo)
     --------------------------------------------------------------------------
     Les frais sont calculés OFFRE PAR OFFRE puis additionnés :
       • chaque offre de cônes (1 cône, lot de 10, box) : la grille coneTiers
         ci-dessous s'applique au nombre de cônes de cette offre
         (quantité × shipCones). Exemple : 1 box (7,59 €) + 1 lot de 10
         cônes (7,59 €) = 15,18 € de frais de port.
       • poudre (toutes les poudres ensemble) : jusqu'à lightMaxGrams (250 g)
         -> light (5,49 €), au-delà -> standard (7,59 €).
     Les tarifs se changent ici, la page de commande recalcule tout.
     coneTiers : « max » = nombre de cônes maximum de la tranche, « fee » = frais.

     freeFrom -> montant du panier (hors frais de port) à partir duquel la
                 livraison est offerte. Seuil pas encore connu : null = jamais
                 de livraison offerte. Exemple : freeFrom: 60
  -------------------------------------------------------------------------- */
  shipping: {
    light: 5.49,
    standard: 7.59,
    lightMaxGrams: 250,
    coneTiers: [
      { max: 8,    fee: 5.49 },
      { max: 18,   fee: 7.59 },
      { max: 28,   fee: 9.29 },
      { max: 38,   fee: 9.59 },
      { max: 78,   fee: 11.19 },
      { max: 198,  fee: 17.39 },
      { max: 398,  fee: 25.29 },
      { max: 598,  fee: 31.99 },
      { max: 1198, fee: 39.59 }
    ],
    freeFrom: null
  },


  /* --------------------------------------------------------------------------
     5 bis. ESPACE ADMINISTRATEUR  (service gratuit Supabase)
     --------------------------------------------------------------------------
     Permet à l'administratrice du site de se connecter sur admin.html pour
     modifier les textes, les prix, les photos, la galerie de réalisations et
     le catalogue de location, sans toucher au code.
     Mise en place : voir ADMIN-SETUP.md (10 minutes, une seule fois).
       url     -> « Project URL » du projet Supabase (https://xxxx.supabase.co)
       anonKey -> clé publique « anon public » (elle peut être publique : c'est
                  la connexion administrateur + les règles de la base qui
                  protègent les modifications)
     Tant que « url » est vide, le site s'affiche comme avant et admin.html
     explique ce qu'il reste à configurer.
  -------------------------------------------------------------------------- */
  supabase: {
    url: "https://cvozkuuhhwzvtnejkgyv.supabase.co",
    anonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN2b3prdXVoaHd6dnRuZWprZ3l2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQ0OTgxNTEsImV4cCI6MjExMDA3NDE1MX0.rcW9kndi3CNo6nkKLWmKNmUN2R4WkeiQ7J6rhKKQsCI",
    bucket: "media"        // nom du stockage d'images (créé par supabase-setup.sql)
  },


  /* --------------------------------------------------------------------------
     6. LOCATION D'ARTICLES  (catalogue de la page location.html)
     --------------------------------------------------------------------------
     Pour changer un prix, un nom ou ajouter une photo : modifiez ici, la
     galerie se met à jour toute seule (aucun HTML à toucher).
       cat    -> la catégorie (un des "id" de rentalCategories ci-dessous)
       price  -> prix en euros ; null = affiche « Sur devis »
       note   -> petite précision sous le nom (facultatif)
       photos -> la 1re est la photo de couverture ; chaque photo existe en
                 "nom.jpg" (grande) et "nom-t.jpg" (vignette) dans image/location/
  -------------------------------------------------------------------------- */
  rentalCategories: [
    { id: "fleurs",  label: "Décoration florale" },
    { id: "mariee",  label: "Mariée & tradition" },
    { id: "assises", label: "Assises & tapis" },
    { id: "reception", label: "Réception & entrée" }
  ],
  rentals: [
    { id: "structure-fleur", name: "Structure fleur", note: "l'unité", price: 10, cat: "fleurs",
      photos: ["structure-fleur-1", "structure-fleur-2", "structure-fleur-3", "structure-fleur-4"] },
    { id: "vases-metal", name: "Vases en métal avec fleurs", price: 10, cat: "fleurs",
      photos: ["vases-metal-1", "vases-metal-2"] },
    { id: "bar-a-fleurs", name: "Bar à fleurs", price: 55, cat: "fleurs",
      photos: ["bar-a-fleurs-1"] },
    { id: "coffre-mariee", name: "Coffre de mariée traditionnel doré", price: 25, cat: "mariee",
      photos: ["coffre-mariee-1", "coffre-mariee-2"] },
    { id: "tayfour", name: "Tayfour", price: 45, cat: "mariee",
      photos: ["tayfour-1", "tayfour-2"] },
    { id: "table-a-the", name: "Table à thé dorée & traditionnelle", note: "au choix", price: 35, cat: "mariee",
      photos: ["table-a-the-1", "table-a-the-2", "table-a-the-3"] },
    { id: "tapis", name: "Tapis", note: "au choix", price: 40, cat: "assises",
      photos: ["tapis-1", "tapis-2"] },
    { id: "assise-henne", name: "Assise henné réversible", note: "plusieurs coloris : bordeaux, vert & doré", price: null, cat: "assises",
      photos: ["assise-henne-1", "assise-henne-2"] },
    { id: "livre-dor-audio", name: "Livre d'or audio", note: "clé USB incluse", price: 70, cat: "reception",
      photos: ["livre-dor-1"] },
    { id: "entree-vip", name: "Entrée VIP + tapis", note: "tapis rouge ou style persan", price: 50, cat: "reception",
      photos: ["entree-vip-1", "entree-vip-2", "entree-vip-3"] },
    { id: "arche-imperiale", name: "L'arche impériale", price: 300, cat: "reception",
      photos: ["arche-imperiale-1"] }
  ],


  /* --------------------------------------------------------------------------
     7. PLUS TARD : VOTRE PROPRE SERVEUR
     --------------------------------------------------------------------------
     Le jour où vous aurez un backend, renseignez apiBase : il devient
     prioritaire sur appsScriptUrl et le site postera en JSON sur
     /api/bookings, /api/contacts, /api/orders et /api/payments.
  -------------------------------------------------------------------------- */
  apiBase: ""
};
