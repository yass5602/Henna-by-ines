/**
 * ============================================================================
 *  Henna by Inès — backend Google Apps Script
 * ----------------------------------------------------------------------------
 *  Rôle :
 *   • créer l'événement dans votre Google Agenda à chaque réservation ;
 *   • le passer en « confirmé » quand la cliente signale l'acompte payé ;
 *   • enregistrer l'image de référence dans Google Drive ;
 *   • vous envoyer un e-mail pour chaque réservation, commande et message.
 *
 *  Installation : voir INTEGRATION.md (5 minutes, aucune carte bancaire).
 * ============================================================================
 */

const SETTINGS = {
  // 'primary' = votre agenda principal. Sinon, collez l'ID de l'agenda
  // (Agenda > Paramètres de l'agenda > Intégrer l'agenda > ID de l'agenda).
  CALENDAR_ID: 'primary',

  // Adresse qui reçoit les notifications. Vide = l'adresse du compte Google.
  NOTIFY_EMAIL: '',

  // Dossier Drive où sont rangées les images de référence envoyées par les clientes.
  DRIVE_FOLDER: 'Henna by Inès — Références clientes',

  // Durée estimée du rendez-vous.
  MINUTES_PER_HAND: 45,
  MIN_DURATION_MIN: 60,

  // true = la cliente reçoit une invitation Google Agenda (elle voit votre adresse e-mail).
  INVITE_CLIENT: false,

  // Rappel automatique (en minutes avant le rendez-vous). 0 = aucun.
  REMINDER_MIN: 24 * 60,

  // Accusé de réception envoyé à la cliente (commandes et rendez-vous).
  CONFIRM_CLIENT: true,
  NOM_EXPEDITEUR: 'Henna by Inès',
  CONTACT_PUBLIC: 'contact@hennabyines.fr'
};

/* ==========================================================================
   Point d'entrée
   ========================================================================== */

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    switch (data.type) {
      case 'booking': return json(handleBooking(data));
      case 'payment': return json(handlePayment(data));
      case 'contact': return json(handleContact(data));
      case 'order':   return json(handleOrder(data));
      default:        return json({ ok: false, error: 'Type inconnu : ' + data.type });
    }
  } catch (err) {
    console.error(err);
    return json({ ok: false, error: String(err && err.message || err) });
  }
}

function doGet() {
  return json({ ok: true, service: 'henna-by-ines', version: 1 });
}

function json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/* ==========================================================================
   Réservation -> événement dans l'agenda
   ========================================================================== */

function handleBooking(d) {
  const cal = getCalendar();

  const start = parseDateTime(d.event.date, d.event.time);
  const nbMains = (d.hands || []).length || 1;
  const minutes = Math.max(SETTINGS.MIN_DURATION_MIN, nbMains * SETTINGS.MINUTES_PER_HAND);
  const end = new Date(start.getTime() + minutes * 60000);

  const who = ((d.contact.firstName || '') + ' ' + (d.contact.lastName || '')).trim();
  const type = (d.event.type === 'Autre' && d.event.other) ? d.event.other : d.event.type;
  const address = [d.address.streetNumber, d.address.street].filter(String).join(' ')
                + ', ' + d.address.zip + ' ' + d.address.city;

  // Image de référence -> Drive
  let refUrl = null;
  if (d.reference && d.reference.dataUrl) {
    try { refUrl = saveReference(d.reference, who); }
    catch (err) { console.warn('Référence non enregistrée : ' + err); }
  }

  const description = buildDescription(d, who, type, address, minutes, refUrl);

  const options = { description: description, location: address };
  if (SETTINGS.INVITE_CLIENT && d.contact.email) {
    options.guests = d.contact.email;
    options.sendInvites = true;
  }

  // Sans acompte, le rendez-vous est posé directement ; avec acompte, il reste en attente.
  const attenteAcompte = !!(d.deposit && Number(d.deposit.amount) > 0);
  const devis = !!d.devisUlterieur;
  const titre = (attenteAcompte
    ? '⏳ ' + type + ' — ' + who + ' (acompte en attente)'
    : '📅 ' + type + ' — ' + who + ' (à confirmer)')
    + (devis ? ' · ➕ devis mains supp.' : '');

  const ev = cal.createEvent(titre, start, end, options);

  try {
    ev.setColor(attenteAcompte ? CalendarApp.EventColor.ORANGE : CalendarApp.EventColor.BLUE);
    if (SETTINGS.REMINDER_MIN > 0) ev.addPopupReminder(SETTINGS.REMINDER_MIN);
  } catch (err) { console.warn(err); }

  notify(
    'Nouvelle réservation — ' + who + ' le ' + fmtDate(start) + (devis ? ' — DEVIS À ÉTABLIR' : ''),
    (devis ? '➕ DEVIS À ÉTABLIR : la cliente souhaite plus de 2 mains.\n'
           + '   Recontactez-la pour chiffrer les mains supplémentaires (détail éventuel dans son message).\n\n' : '')
    + description + '\n\n' + (attenteAcompte
      ? 'L\'événement a été ajouté à votre agenda en attente de l\'acompte.'
      : 'L\'événement a été ajouté à votre agenda. Aucun acompte n\'est demandé : recontactez la cliente pour confirmer.')
  );

  if (d.contact.email) {
    const lignesClient = [
      'Bonjour ' + (d.contact.firstName || '') + ',',
      '',
      'Votre demande de rendez-vous est bien arrivée. Voici ce que nous avons noté :',
      '',
      '   Date      : ' + fmtDate(start),
      '   Durée est.: ' + minutes + ' min',
      '   Évènement : ' + type,
      '   Lieu      : ' + address,
      '   Prestation: ' + (d.hands || []).map(function (h) { return 'main ' + h.index + ' en ' + h.formule; }).join(', '),
      ''
    ];
    lignesClient.push(attenteAcompte
      ? 'Votre date sera définitivement bloquée dès réception de l\'acompte de '
        + d.deposit.amount + ' ' + d.deposit.currency + ' sur PayPal.'
      : 'Inès vous recontacte très vite pour confirmer le rendez-vous et établir le devis.');
    if (devis) {
      lignesClient.push('', 'Vous avez demandé un devis pour des mains supplémentaires : Inès vous recontacte'
        + ' après votre réservation pour l\'établir.');
    }
    lignesClient.push('', 'Une erreur dans ces informations ? Répondez simplement à cet e-mail.');

    confirmerAuClient(d.contact.email, 'Votre demande de rendez-vous du ' + fmtDate(start), lignesClient.join('\n'));
  }

  return {
    ok: true,
    bookingId: ev.getId(),
    start: start.toISOString(),
    durationMinutes: minutes
  };
}

function buildDescription(d, who, type, address, minutes, refUrl) {
  const mains = (d.hands || [])
    .map(function (h) { return '   • Main ' + h.index + ' : Henné ' + h.formule; })
    .join('\n');

  const lignes = [
    'RÉSERVATION HENNA BY INÈS',
    '',
    'Cliente    : ' + who,
    'E-mail     : ' + (d.contact.email || '—'),
    'Téléphone  : ' + (d.contact.phone || '—'),
    'Instagram  : ' + (d.contact.instagram || '—'),
    '',
    'Évènement  : ' + type,
    'Lieu       : ' + address,
    'Durée est. : ' + minutes + ' min (' + ((d.hands || []).length || 1) + ' main(s))',
    '',
    'Prestations :',
    mains || '   • —',
    (d.devisUlterieur ? '   ➕ Devis ultérieur demandé : plus de 2 mains souhaitées' : null),
    '',
    'Message    : ' + (d.message || '—'),
    'Modèle réf.: ' + (refUrl || '—'),
    '',
    'Acompte    : ' + (d.deposit && Number(d.deposit.amount) > 0
        ? d.deposit.amount + ' ' + d.deposit.currency + ' — EN ATTENTE'
        : 'aucun acompte demandé'),
    'Demande reçue le ' + fmtDate(new Date(d.createdAt || Date.now()))
  ];
  return lignes.filter(function (l) { return l !== null; }).join('\n');
}

/* ==========================================================================
   Paiement signalé -> l'événement passe en confirmé
   ========================================================================== */

function handlePayment(d) {
  const quand = fmtDate(new Date());

  if (d.kind === 'booking' && d.ref) {
    const ev = getCalendar().getEventById(d.ref);
    if (!ev) return { ok: false, error: 'Événement introuvable : ' + d.ref };

    ev.setTitle(ev.getTitle()
      .replace('⏳', '✅')
      .replace(' (acompte en attente)', ' (acompte réglé)'));

    ev.setDescription(ev.getDescription().replace('— EN ATTENTE', '— SIGNALÉ PAYÉ')
      + '\n\n✅ Acompte de ' + d.amount + ' ' + d.currency
      + ' signalé payé par la cliente le ' + quand
      + '.\n⚠️ À vérifier sur votre compte PayPal avant de confirmer la date.');

    try { ev.setColor(CalendarApp.EventColor.GREEN); } catch (err) { console.warn(err); }

    notify(
      'Acompte signalé — ' + ev.getTitle(),
      'La cliente indique avoir réglé l\'acompte de ' + d.amount + ' ' + d.currency + ' le ' + quand + '.'
      + '\n\nVérifiez la réception sur PayPal, puis confirmez la date à la cliente.'
      + '\n\n' + ev.getDescription()
    );

    return { ok: true, confirmed: true };
  }

  notify(
    'Paiement signalé (' + (d.kind || 'commande') + ') — ' + d.amount + ' ' + d.currency,
    'Un paiement PayPal de ' + d.amount + ' ' + d.currency + ' a été signalé le ' + quand + '.'
    + '\nRéférence : ' + (d.ref || '—')
    + '\n\n⚠️ À vérifier sur votre compte PayPal.'
  );
  return { ok: true };
}

/* ==========================================================================
   Commandes produits et messages de contact
   ========================================================================== */

function handleOrder(d) {
  const it = d.item || {};
  const huile = it.options && it.options.huileEssentielle ? 'avec huile essentielle' : 'sans huile essentielle';
  const corps = [
    'NOUVELLE COMMANDE',
    '',
    'Produit   : ' + (it.label || '—') + ' (' + (it.sku || '—') + ')',
    'Prix      : ' + it.price + ' ' + (it.currency || 'EUR'),
    'Option    : ' + huile,
    'Reçue le  : ' + fmtDate(new Date(d.createdAt || Date.now())),
    '',
    'Le paiement PayPal est à vérifier sur votre compte.'
  ].join('\n');

  const client = (d.customer && d.customer.email) || null;
  notify('Commande — ' + (it.label || 'produit') + (client ? ' — ' + client : ''), corps, client);

  if (client) {
    confirmerAuClient(client,
      'Votre commande — ' + (it.label || 'produit'),
      [
        'Bonjour,',
        '',
        'Merci pour votre commande chez Henna by Inès. Voici le récapitulatif :',
        '',
        '   Produit : ' + (it.label || '—'),
        '   Montant : ' + it.price + ' ' + (it.currency || 'EUR'),
        '   Option  : ' + huile,
        '',
        'Votre commande sera préparée dès réception du paiement PayPal.',
        'Nous revenons vers vous très vite pour la livraison ou le retrait.',
        '',
        'Une question ? Répondez simplement à cet e-mail.'
      ].join('\n'));
  }

  return { ok: true, orderId: 'CMD-' + Date.now() };
}

function handleContact(d) {
  const corps = [
    'NOUVEAU MESSAGE',
    '',
    'De      : ' + (d.name || '—'),
    'E-mail  : ' + (d.email || '—'),
    'Sujet   : ' + (d.subject || '—'),
    '',
    d.message || '',
    '',
    'Reçu le ' + fmtDate(new Date(d.createdAt || Date.now()))
  ].join('\n');

  notify('Message site — ' + (d.subject || d.name || 'contact'), corps, d.email);
  return { ok: true };
}

/* ==========================================================================
   Utilitaires
   ========================================================================== */

function getCalendar() {
  const cal = SETTINGS.CALENDAR_ID === 'primary'
    ? CalendarApp.getDefaultCalendar()
    : CalendarApp.getCalendarById(SETTINGS.CALENDAR_ID);
  if (!cal) throw new Error('Agenda introuvable : ' + SETTINGS.CALENDAR_ID);
  return cal;
}

/** "2026-10-12" + "14:30" -> Date dans le fuseau du script (Europe/Paris). */
function parseDateTime(dateStr, timeStr) {
  const d = String(dateStr || '').split('-');
  const t = String(timeStr || '10:00').split(':');
  return new Date(
    Number(d[0]), Number(d[1]) - 1, Number(d[2]),
    Number(t[0]) || 0, Number(t[1]) || 0, 0
  );
}

function fmtDate(date) {
  return Utilities.formatDate(date, Session.getScriptTimeZone(), 'dd/MM/yyyy à HH:mm');
}

function saveReference(ref, who) {
  const m = String(ref.dataUrl).match(/^data:([^;]+);base64,([\s\S]*)$/);
  if (!m) return null;

  const ext = (ref.name && ref.name.indexOf('.') > -1) ? ref.name.slice(ref.name.lastIndexOf('.')) : '';
  const nom = (who || 'cliente').replace(/[^\w\s-]/g, '') + ' — ' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HHmm') + ext;

  const blob = Utilities.newBlob(Utilities.base64Decode(m[2]), m[1] || 'image/jpeg', nom);
  const file = getFolder(SETTINGS.DRIVE_FOLDER).createFile(blob);

  try { file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); }
  catch (err) { console.warn('Partage du fichier impossible : ' + err); }

  return file.getUrl();
}

function getFolder(name) {
  const it = DriveApp.getFoldersByName(name);
  return it.hasNext() ? it.next() : DriveApp.createFolder(name);
}

/** Accusé de réception envoyé à la cliente. Jamais bloquant : si l'envoi
 *  échoue (quota Gmail, adresse invalide), la réservation reste enregistrée. */
function confirmerAuClient(email, sujet, corps) {
  if (!SETTINGS.CONFIRM_CLIENT || !email) return;
  try {
    MailApp.sendEmail(email, '[' + SETTINGS.NOM_EXPEDITEUR + '] ' + sujet,
      corps + '\n\n— ' + SETTINGS.NOM_EXPEDITEUR + '\n' + SETTINGS.CONTACT_PUBLIC
            + '\n\nVos données ne servent qu\'au traitement de cette demande.'
            + ' Vous pouvez demander leur suppression à tout moment en répondant à cet e-mail.',
      { name: SETTINGS.NOM_EXPEDITEUR, replyTo: SETTINGS.CONTACT_PUBLIC });
  } catch (err) {
    console.warn('Accusé de réception non envoyé à ' + email + ' : ' + err);
  }
}

function notify(sujet, corps, replyTo) {
  const to = SETTINGS.NOTIFY_EMAIL || Session.getEffectiveUser().getEmail();
  if (!to) return;
  const options = { name: 'Site Henna by Inès' };
  if (replyTo) options.replyTo = replyTo;
  MailApp.sendEmail(to, '[Henna by Inès] ' + sujet, corps, options);
}

/* ==========================================================================
   Test rapide : exécutez cette fonction une fois depuis l'éditeur Apps Script
   pour accorder les autorisations et vérifier que tout fonctionne.
   Elle crée un rendez-vous fictif demain à 14 h, puis vous l'effacez.
   ========================================================================== */

function testReservation() {
  const demain = new Date(Date.now() + 86400000);
  const res = handleBooking({
    type: 'booking',
    contact: { firstName: 'Test', lastName: 'Cliente', email: 'test@example.com', phone: '0600000000', instagram: null },
    address: { streetNumber: '12', street: 'rue des Lilas', zip: '75011', city: 'Paris' },
    event: {
      type: 'Mariage', other: null,
      date: Utilities.formatDate(demain, Session.getScriptTimeZone(), 'yyyy-MM-dd'),
      time: '14:00'
    },
    hands: [{ index: 1, formule: 'Élégance' }, { index: 2, formule: 'Signature' }],
    message: 'Ceci est un test.',
    deposit: { amount: 10, currency: 'EUR', status: 'pending' },
    createdAt: new Date().toISOString()
  });
  console.log(res);
  return res;
}
