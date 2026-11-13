/* ============================================================================
   Henna by Inès — Pilotage : tableau de bord, calendrier, agenda, recettes
   ----------------------------------------------------------------------------
   Page privée (pilotage.html). Données dans Supabase (tables mouvements,
   rendez_vous, commandes_paypal, reglages — voir supabase-pilotage.sql),
   lisibles et modifiables uniquement par l'administratrice connectée.
   Aucune bibliothèque externe : graphiques en SVG, appels « fetch » simples.
   ========================================================================== */
(function () {
  'use strict';

  var CFG = window.HENNA_CONFIG || {};
  var DB = window.HennaDB;
  var SITE = window.HennaSite;
  var SKEY = 'henna_admin_session';
  var esc = SITE.esc;

  function $(id) { return document.getElementById(id); }

  /* ====================================================================== */
  /*  Utilitaires                                                            */
  /* ====================================================================== */
  var toastTimer;
  function toast(msg, isErr) {
    var t = $('toast');
    t.textContent = msg;
    t.className = 'on' + (isErr ? ' err' : '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.className = ''; }, isErr ? 5200 : 2800);
  }
  function show(id) { ['v-config', 'v-login', 'v-app'].forEach(function (v) { $(v).hidden = v !== id; }); }

  function explain(e) {
    var m = (e && e.message) || String(e);
    if (e && (e.status === 404 || /relation .* does not exist|PGRST205|Could not find the table/i.test(m)))
      return 'Les tables ne sont pas prêtes : exécutez supabase-pilotage.sql dans Supabase (voir ADMIN-SETUP.md).';
    if (e && (e.status === 401 || e.status === 403 || /row-level security|JWT|permission denied/i.test(m)))
      return 'Accès refusé : reconnectez-vous (ou vérifiez l\'adresse e-mail administratrice dans supabase-setup.sql).';
    if (/Failed to fetch|NetworkError/i.test(m)) return 'Connexion impossible. Vérifiez votre accès internet puis réessayez.';
    return m;
  }

  function p2(n) { return (n < 10 ? '0' : '') + n; }
  function ymd(d) { return d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate()); }
  function fromYmd(s) { var a = String(s).split('-'); return new Date(+a[0], +a[1] - 1, +a[2]); }
  function addDays(d, n) { return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n); }
  function mondayOf(d) { var x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); return addDays(x, -((x.getDay() + 6) % 7)); }
  function monthStart(d, off) { return new Date(d.getFullYear(), d.getMonth() + (off || 0), 1); }
  function hhmm(d) { return p2(d.getHours()) + ':' + p2(d.getMinutes()); }
  var MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  var MOIS_C = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
  var JOURS = ['lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.', 'dim.'];
  var JOURS_L = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
  function dateLongue(d) { return JOURS_L[d.getDay()] + ' ' + d.getDate() + ' ' + MOIS[d.getMonth()] + ' ' + d.getFullYear(); }
  function dateCourte(d) { return JOURS[(d.getDay() + 6) % 7] + ' ' + d.getDate() + ' ' + MOIS_C[d.getMonth()]; }
  function euro(n) {
    n = Number(n) || 0;
    var neg = n < 0; n = Math.abs(n);
    var s = (Math.round(n * 100) % 100 === 0)
      ? n.toLocaleString('fr-FR', { maximumFractionDigits: 0 })
      : n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return (neg ? '−' : '') + s + ' €';
  }
  function round2(n) { return Math.round(n * 100) / 100; }
  function parseMontant(s) {
    var t = String(s || '').trim().replace(/\s/g, '').replace(',', '.');
    if (t === '') return NaN;
    return Number(t);
  }

  var PAIEMENTS = [['', '—'], ['especes', 'Espèces'], ['virement', 'Virement'], ['paypal', 'PayPal'], ['carte', 'Carte bancaire'], ['cheque', 'Chèque'], ['autre', 'Autre']];
  function paiementLabel(k) { var r = PAIEMENTS.filter(function (p) { return p[0] === k; })[0]; return r ? r[1] : (k || ''); }
  var PRESTATIONS = ['Henné mariée', 'Henné soirée / fiançailles', 'Henné invitées', 'Cônes de henné', 'Box débutante', 'Poudre de henné', 'Location', 'Boutique en ligne', 'Autre'];
  var DEPENSES = ['Matériel', 'Déplacement', 'Emballage / port', 'Achat henné / ingrédients', 'Publicité', 'Autre'];

  /* ====================================================================== */
  /*  Connexion (même session que l'espace admin)                            */
  /* ====================================================================== */
  function getSession() { try { return JSON.parse(localStorage.getItem(SKEY) || 'null'); } catch (e) { return null; } }
  function setSession(s) { try { s ? localStorage.setItem(SKEY, JSON.stringify(s)) : localStorage.removeItem(SKEY); } catch (e) {} }

  function authCall(grant, body) {
    return fetch(DB.url + '/auth/v1/token?grant_type=' + grant, {
      method: 'POST', headers: { apikey: DB.key, 'Content-Type': 'application/json' }, body: JSON.stringify(body)
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (!r.ok) { var e = new Error(j.error_description || j.msg || j.message || ('Erreur ' + r.status)); e.status = r.status; throw e; }
        return j;
      });
    }).then(function (j) {
      var s = { access_token: j.access_token, refresh_token: j.refresh_token,
        expires_at: Date.now() + (j.expires_in || 3600) * 1000, email: (j.user && j.user.email) || '' };
      setSession(s);
      return s;
    });
  }
  function token() {
    var s = getSession();
    if (!s) return Promise.reject(new Error('Session expirée, reconnectez-vous.'));
    if (s.expires_at - Date.now() > 60000) return Promise.resolve(s.access_token);
    return authCall('refresh_token', { refresh_token: s.refresh_token }).then(function (n) { return n.access_token; }, function (e) {
      setSession(null); show('v-login'); throw e;
    });
  }
  function api(method, path, json, prefer) {
    return token().then(function (t) {
      return DB.rest(method, path, { token: t, json: json, headers: prefer ? { Prefer: prefer } : undefined });
    });
  }
  // Lecture complète d'une table (Supabase renvoie au plus 1000 lignes par appel).
  function apiAll(path) {
    var out = [];
    function page(off) {
      return api('GET', path + '&limit=1000&offset=' + off).then(function (rows) {
        rows = rows || []; out = out.concat(rows);
        return rows.length >= 1000 ? page(off + 1000) : out;
      });
    }
    return page(0);
  }

  /* ====================================================================== */
  /*  Données                                                                */
  /* ====================================================================== */
  var S = { mouv: [], rdv: [], cmd: [], reg: {}, tab: 'dash', calMonth: monthStart(new Date()), chart: '30j', agView: 'avenir',
    f: { mois: 'tous', sens: 'tous', q: '' } };

  function sortData() {
    S.mouv.sort(function (a, b) { return a.jour < b.jour ? 1 : a.jour > b.jour ? -1 : (b.id - a.id); });
    S.rdv.sort(function (a, b) { return new Date(a.debut) - new Date(b.debut); });
    S.cmd.sort(function (a, b) { return a.created_at < b.created_at ? 1 : -1; });
  }
  function loadTable(name) {
    if (name === 'mouv') return apiAll('mouvements?select=*&order=jour.desc,id.desc').then(function (r) { S.mouv = r; sortData(); });
    if (name === 'rdv') return apiAll('rendez_vous?select=*&order=debut.asc').then(function (r) { S.rdv = r; sortData(); });
    if (name === 'cmd') return api('GET', 'commandes_paypal?select=*&statut=eq.a_confirmer&order=created_at.desc').then(function (r) { S.cmd = r || []; sortData(); });
    if (name === 'reg') return api('GET', 'reglages?select=key,value').then(function (r) { S.reg = {}; (r || []).forEach(function (x) { S.reg[x.key] = x.value; }); });
    return Promise.resolve();
  }
  function loadAll() { return Promise.all(['mouv', 'rdv', 'cmd', 'reg'].map(loadTable)); }

  /* ====================================================================== */
  /*  Calculs du tableau de bord                                             */
  /* ====================================================================== */
  function sum(from, to, sens) {
    var t = 0;
    S.mouv.forEach(function (m) { if (m.jour >= from && m.jour <= to && (!sens || m.sens === sens)) t += Number(m.montant) || 0; });
    return round2(t);
  }

  function periods() {
    var now = new Date(), w0 = mondayOf(now), w1 = addDays(w0, 6);
    var m0 = monthStart(now), m1 = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    var pm0 = monthStart(now, -1), pm1 = new Date(now.getFullYear(), now.getMonth(), 0);
    return [
      { label: 'Aujourd\'hui', sub: dateCourte(now), from: ymd(now), to: ymd(now), pfrom: ymd(addDays(now, -1)), pto: ymd(addDays(now, -1)), plabel: 'hier' },
      { label: 'Cette semaine', sub: 'du ' + w0.getDate() + ' ' + MOIS_C[w0.getMonth()] + ' au ' + w1.getDate() + ' ' + MOIS_C[w1.getMonth()],
        from: ymd(w0), to: ymd(w1), pfrom: ymd(addDays(w0, -7)), pto: ymd(addDays(w0, -1)), plabel: 'la semaine dernière' },
      { label: 'Ce mois', sub: MOIS[now.getMonth()] + ' ' + now.getFullYear(), from: ymd(m0), to: ymd(m1), pfrom: ymd(pm0), pto: ymd(pm1), plabel: 'le mois dernier' }
    ];
  }

  function deltaHtml(cur, prev, plabel) {
    if (!cur && !prev) return '<div class="delta eq">— rien ' + (plabel === 'hier' ? 'hier non plus' : 'la période précédente') + '</div>';
    if (!prev) return '<div class="delta up">▲ nouveau (0 € ' + (plabel === 'hier' ? 'hier' : plabel.replace('la ', 'la ').replace('le ', 'le ')) + ')</div>';
    var pct = Math.round((cur - prev) / prev * 100);
    var cls = pct > 0 ? 'up' : pct < 0 ? 'down' : 'eq';
    var arrow = pct > 0 ? '▲ +' : pct < 0 ? '▼ ' : '= ';
    return '<div class="delta ' + cls + '">' + arrow + pct + ' % par rapport à ' + esc(plabel) + ' (' + esc(euro(prev)) + ')</div>';
  }

  function kpiHtml(p) {
    var rec = sum(p.from, p.to, 'recette'), dep = sum(p.from, p.to, 'depense'), prec = sum(p.pfrom, p.pto, 'recette');
    return '<div class="kpi"><div class="lab">' + esc(p.label) + '<span>' + esc(p.sub) + '</span></div>' +
      '<div class="val">' + esc(euro(rec)) + '</div>' + deltaHtml(rec, prec, p.plabel) +
      '<div class="sous">Dépenses ' + esc(euro(dep)) + ' · Bénéfice <strong style="font-weight:500">' + esc(euro(round2(rec - dep))) + '</strong></div></div>';
  }

  function series(mode) {
    var out = [], now = new Date(), i, d, a, b;
    if (mode === '30j') {
      for (i = 29; i >= 0; i--) { d = addDays(now, -i); out.push({ label: d.getDate() + '/' + (d.getMonth() + 1), full: dateCourte(d), from: ymd(d), to: ymd(d) }); }
    } else if (mode === '12s') {
      var w = mondayOf(now);
      for (i = 11; i >= 0; i--) { a = addDays(w, -7 * i); b = addDays(a, 6); out.push({ label: a.getDate() + '/' + (a.getMonth() + 1), full: 'semaine du ' + a.getDate() + ' ' + MOIS_C[a.getMonth()], from: ymd(a), to: ymd(b) }); }
    } else {
      for (i = 11; i >= 0; i--) {
        a = monthStart(now, -i); b = new Date(a.getFullYear(), a.getMonth() + 1, 0);
        out.push({ label: MOIS_C[a.getMonth()].replace('.', ''), full: MOIS[a.getMonth()] + ' ' + a.getFullYear(), from: ymd(a), to: ymd(b) });
      }
    }
    out.forEach(function (s) { s.rec = sum(s.from, s.to, 'recette'); s.dep = sum(s.from, s.to, 'depense'); });
    return out;
  }
  function niceMax(v) {
    if (v <= 0) return 10;
    var e = Math.pow(10, Math.floor(Math.log10(v))), f = v / e;
    return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * e;
  }

  function chartSvg(sr) {
    var W = 720, H = 270, l = 52, r = 8, t = 12, bt = 34, iw = W - l - r, ih = H - t - bt, n = sr.length;
    var max = niceMax(Math.max.apply(null, sr.map(function (s) { return Math.max(s.rec, s.dep); }).concat([0])));
    var gw = iw / n, bw = gw * 0.34, step = n > 14 ? Math.ceil(n / 8) : 1, g = '';
    for (var k = 0; k <= 4; k++) {
      var y = t + ih - ih * k / 4;
      g += '<line x1="' + l + '" x2="' + (W - r) + '" y1="' + y + '" y2="' + y + '" stroke="rgba(36,26,20,.12)"/>' +
        '<text x="' + (l - 8) + '" y="' + (y + 4) + '" text-anchor="end">' + esc(euro(max * k / 4)) + '</text>';
    }
    sr.forEach(function (s, i) {
      var x0 = l + i * gw, hr = s.rec / max * ih, hd = s.dep / max * ih;
      g += '<g><title>' + esc(s.full + ' — Recettes ' + euro(s.rec) + ' · Dépenses ' + euro(s.dep)) + '</title>' +
        '<rect x="' + x0 + '" y="' + t + '" width="' + gw + '" height="' + ih + '" fill="transparent"/>' +
        (s.rec > 0 ? '<rect x="' + (x0 + gw * 0.12) + '" y="' + (t + ih - hr) + '" width="' + bw + '" height="' + hr + '" rx="3" fill="#1F6B5E"/>' : '') +
        (s.dep > 0 ? '<rect x="' + (x0 + gw * 0.54) + '" y="' + (t + ih - hd) + '" width="' + bw + '" height="' + hd + '" rx="3" fill="#C58B3E"/>' : '') + '</g>';
      if (i % step === 0 || i === n - 1 && step === 1) g += '<text x="' + (x0 + gw / 2) + '" y="' + (H - 12) + '" text-anchor="middle">' + esc(s.label) + '</text>';
    });
    return '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Recettes et dépenses">' + g + '</svg>';
  }

  function repartitionHtml() {
    var now = new Date(), from = ymd(monthStart(now)), to = ymd(new Date(now.getFullYear(), now.getMonth() + 1, 0)), by = {}, total = 0;
    S.mouv.forEach(function (m) {
      if (m.sens !== 'recette' || m.jour < from || m.jour > to) return;
      var k = (m.prestation || 'Autre').trim() || 'Autre';
      by[k] = (by[k] || 0) + Number(m.montant); total += Number(m.montant);
    });
    var rows = Object.keys(by).map(function (k) { return [k, round2(by[k])]; }).sort(function (a, b) { return b[1] - a[1]; });
    if (!rows.length) return '<div class="vide">Aucune recette ce mois-ci pour l\'instant.</div>';
    var top = rows.slice(0, 6), reste = rows.slice(6).reduce(function (s, r) { return s + r[1]; }, 0);
    if (reste > 0) top.push(['Autres', round2(reste)]);
    var max = top[0][1] || 1;
    return top.map(function (r) {
      return '<div class="barre-l"><span class="nom">' + esc(r[0]) + '</span><span class="piste"><i style="width:' + Math.max(3, Math.round(r[1] / max * 100)) + '%"></i></span>' +
        '<span class="mt">' + esc(euro(r[1])) + ' <span style="opacity:.55;font-weight:400">· ' + Math.round(r[1] / total * 100) + ' %</span></span></div>';
    }).join('');
  }

  /* ====================================================================== */
  /*  Rendez-vous : affichage et lien Google Agenda                          */
  /* ====================================================================== */
  function rdvHeure(r) {
    if (r.journee) return 'Journée entière';
    var s = new Date(r.debut), e = r.fin ? new Date(r.fin) : null;
    return hhmm(s) + (e ? ' – ' + hhmm(e) : '');
  }
  function utcStamp(d) {
    return d.getUTCFullYear() + p2(d.getUTCMonth() + 1) + p2(d.getUTCDate()) + 'T' + p2(d.getUTCHours()) + p2(d.getUTCMinutes()) + p2(d.getUTCSeconds()) + 'Z';
  }
  function gcalLink(r) {
    var s = new Date(r.debut), e = r.fin ? new Date(r.fin) : null, dates;
    if (r.journee) dates = ymd(s).replace(/-/g, '') + '/' + ymd(addDays(s, 1)).replace(/-/g, '');
    else { if (!e) e = new Date(s.getTime() + 3600000); dates = utcStamp(s) + '/' + utcStamp(e); }
    var details = [r.client ? 'Client : ' + r.client : '', r.note || ''].filter(Boolean).join('\n');
    return 'https://calendar.google.com/calendar/render?action=TEMPLATE&text=' + encodeURIComponent(r.titre) + '&dates=' + dates +
      (details ? '&details=' + encodeURIComponent(details) : '') + (r.lieu ? '&location=' + encodeURIComponent(r.lieu) : '') + '&ctz=Europe%2FParis';
  }
  function rdvItem(r, withDate) {
    return '<div class="rdv"><div class="h">' + (withDate ? esc(dateCourte(new Date(r.debut))) + '<br>' : '') + esc(rdvHeure(r)) + '</div>' +
      '<div class="c"><strong>' + esc(r.titre) + '</strong>' +
      (r.client ? '<span>Client : ' + esc(r.client) + '</span>' : '') + (r.lieu ? '<span>📍 ' + esc(r.lieu) + '</span>' : '') +
      (r.note ? '<span>' + esc(r.note) + '</span>' : '') + '</div>' +
      '<div class="acts"><a class="btn sec petit" href="' + esc(gcalLink(r)) + '" target="_blank" rel="noopener" title="Ajouter ce rendez-vous à Google Agenda">+ Google Agenda</a>' +
      '<button type="button" class="ico" data-act="edit-rdv" data-id="' + esc(r.id) + '" aria-label="Modifier" title="Modifier">✎</button>' +
      '<button type="button" class="ico" data-act="del-rdv" data-id="' + esc(r.id) + '" aria-label="Supprimer" title="Supprimer">🗑</button></div></div>';
  }
  function rdvEnCours(r) {
    var now = new Date();
    if (r.journee) return ymd(new Date(r.debut)) >= ymd(now);
    return new Date(r.fin || r.debut) >= now;
  }

  /* ====================================================================== */
  /*  Modale                                                                 */
  /* ====================================================================== */
  var modalCleanup = null;
  function closeModal() {
    $('modal').hidden = true; $('modal').innerHTML = '';
    document.body.style.overflow = '';
    if (modalCleanup) { var c = modalCleanup; modalCleanup = null; c(); }
  }
  function openModal(opts) {
    var m = $('modal');
    if (!m.hidden) closeModal();
    m.innerHTML = '<div class="modale" role="dialog" aria-modal="true" aria-label="' + esc(opts.title) + '">' +
      '<div class="mh"><h2>' + esc(opts.title) + '</h2><button type="button" class="mx" aria-label="Fermer" data-close>×</button></div>' +
      '<div class="mb">' + opts.body + '</div>' +
      '<div class="mf">' + (opts.buttons || []).map(function (b, i) {
        return '<button type="button" class="btn ' + (b.kind || '') + (b.left ? ' gauche' : '') + '" data-bi="' + i + '">' + esc(b.label) + '</button>';
      }).join('') + '</div></div>';
    m.hidden = false;
    document.body.style.overflow = 'hidden';
    m.onclick = function (e) {
      if (e.target === m || (e.target.closest && e.target.closest('[data-close]'))) { closeModal(); return; }
      var bt = e.target.closest && e.target.closest('[data-bi]');
      if (!bt || bt.disabled) return;
      var b = opts.buttons[+bt.getAttribute('data-bi')], label = bt.textContent;
      bt.disabled = true; bt.textContent = 'Un instant…';
      Promise.resolve().then(function () { return b.action(bt); }).then(function (keep) {
        if (keep === false) { bt.disabled = false; bt.textContent = label; return; }
        closeModal();
      }, function (err) { bt.disabled = false; bt.textContent = label; toast(explain(err), true); });
    };
    var onKey = function (e) { if (e.key === 'Escape') closeModal(); };
    document.addEventListener('keydown', onKey);
    modalCleanup = function () { document.removeEventListener('keydown', onKey); };
    if (opts.onOpen) opts.onOpen(m);
    var first = m.querySelector('input:not([type=hidden]):not([type=radio]):not([type=checkbox]),textarea');
    if (first) setTimeout(function () { first.focus(); }, 30);
  }
  function confirmBox(title, message, okLabel) {
    return new Promise(function (res) {
      var done = false;
      openModal({
        title: title, body: '<p style="margin:6px 0 12px;font-size:16px">' + message + '</p>',
        buttons: [
          { label: 'Annuler', kind: 'sec', action: function () { done = true; res(false); } },
          { label: okLabel || 'Confirmer', kind: 'danger', action: function () { done = true; res(true); } }
        ]
      });
      var prev = modalCleanup;
      modalCleanup = function () { if (prev) prev(); if (!done) res(false); };
    });
  }

  /* ====================================================================== */
  /*  Recette / dépense : formulaire                                         */
  /* ====================================================================== */
  // opts : { sens, jour, prefill:{montant,prestation,paiement,note,commande} } ; m = ligne existante ou null
  function editMouvement(m, opts) {
    opts = opts || {};
    var pre = opts.prefill || {}, isNew = !m;
    var sens = m ? m.sens : (opts.sens || 'recette');
    var jour = m ? m.jour : (opts.jour || ymd(new Date()));
    var montant = m ? m.montant : (pre.montant != null ? pre.montant : '');
    var prest = m ? (m.prestation || '') : (pre.prestation || '');
    var paie = m ? (m.paiement || '') : (pre.paiement || '');
    var note = m ? (m.note || '') : (pre.note || '');
    var cmd = pre.commande || null;

    var buttons = [];
    if (!isNew) buttons.push({ label: 'Supprimer', kind: 'danger', left: true, action: function () {
      return confirmBox('Supprimer cette ligne ?', 'Elle ne sera plus comptée dans vos totaux.', 'Supprimer').then(function (ok) {
        if (!ok) return false;
        return api('DELETE', 'mouvements?id=eq.' + encodeURIComponent(m.id)).then(function () { return loadTable('mouv'); }).then(function () { toast('Ligne supprimée.'); refresh(); });
      }).then(function (r) { return r === false ? false : undefined; });
    } });
    buttons.push({ label: 'Annuler', kind: 'sec', action: function () {} });
    buttons.push({ label: cmd ? 'Enregistrer la recette' : (isNew ? 'Ajouter' : 'Enregistrer'), kind: 'vert', action: function () {
      var mt = parseMontant($('f-montant').value), s = document.querySelector('input[name=f-sens]:checked').value;
      if (!isFinite(mt) || mt <= 0) { toast('Indiquez un montant supérieur à 0.', true); return false; }
      if (!$('f-jour').value) { toast('Indiquez la date.', true); return false; }
      var row = { jour: $('f-jour').value, sens: s, montant: round2(mt), prestation: $('f-prest').value.trim() || null,
        paiement: $('f-paie').value || null, note: $('f-note').value.trim() || null };
      var job;
      if (isNew) {
        if (cmd) row.commande_id = cmd.id;
        job = api('POST', 'mouvements', row, 'return=minimal').then(function () {
          return cmd ? api('PATCH', 'commandes_paypal?id=eq.' + encodeURIComponent(cmd.id), { statut: 'confirme' }) : null;
        });
      } else job = api('PATCH', 'mouvements?id=eq.' + encodeURIComponent(m.id), row);
      return job.then(function () { return Promise.all([loadTable('mouv'), loadTable('cmd')]); })
        .then(function () { toast(cmd ? 'Recette enregistrée, commande confirmée.' : (isNew ? 'Ajouté.' : 'Modifié.')); refresh(); });
    } });

    openModal({
      title: (isNew ? 'Nouvelle ' : 'Modifier la ') + 'ligne',
      body: (cmd ? '<div class="mini">Pré-rempli depuis la commande PayPal de <strong>' + esc(cmd.client || 'client') + '</strong>. Vérifiez que le paiement est bien arrivé dans PayPal, ajustez si besoin, puis enregistrez.</div>' : '') +
        '<div class="sens"><label><input type="radio" name="f-sens" value="recette"' + (sens === 'recette' ? ' checked' : '') + '> Recette</label>' +
        '<label><input type="radio" name="f-sens" value="depense"' + (sens === 'depense' ? ' checked' : '') + '> Dépense</label></div>' +
        '<div class="deux"><label class="champ">Date<input id="f-jour" type="date" value="' + esc(jour) + '"></label>' +
        '<label class="champ">Montant (€)<input id="f-montant" type="text" inputmode="decimal" placeholder="0" value="' + esc(montant === '' ? '' : String(montant).replace('.', ',')) + '"></label></div>' +
        '<label class="champ">Prestation / catégorie<input id="f-prest" type="text" list="l-prest" value="' + esc(prest) + '" placeholder="Ex. Henné mariée"></label>' +
        '<datalist id="l-prest">' + PRESTATIONS.concat(DEPENSES).map(function (x) { return '<option value="' + esc(x) + '">'; }).join('') + '</datalist>' +
        '<label class="champ">Mode de paiement<select id="f-paie">' + PAIEMENTS.map(function (p) {
          return '<option value="' + esc(p[0]) + '"' + (p[0] === paie ? ' selected' : '') + '>' + esc(p[1]) + '</option>';
        }).join('') + '</select></label>' +
        '<label class="champ">Note (facultatif)<textarea id="f-note" rows="2" placeholder="Ex. acompte mariage Sara">' + esc(note) + '</textarea></label>',
      buttons: buttons
    });
  }

  function ignoreCommande(id) {
    confirmBox('Ignorer cette commande ?', 'Le client avait cliqué sur PayPal mais le paiement n\'est pas arrivé. Elle sera retirée de la liste « à confirmer ».', 'Ignorer').then(function (ok) {
      if (!ok) return;
      api('PATCH', 'commandes_paypal?id=eq.' + encodeURIComponent(id), { statut: 'ignore' }).then(function () { return loadTable('cmd'); })
        .then(function () { toast('Commande ignorée.'); refresh(); }).catch(function (e) { toast(explain(e), true); });
    });
  }
  function confirmerCommande(id) {
    var c = S.cmd.filter(function (x) { return String(x.id) === String(id); })[0];
    if (!c) return;
    editMouvement(null, { sens: 'recette', jour: ymd(new Date()), prefill: {
      montant: Number(c.total), prestation: 'Boutique en ligne', paiement: 'paypal',
      note: 'Commande ' + (c.ref || '') + ' — ' + (c.client || '') + (c.resume ? ' : ' + c.resume : ''), commande: c } });
  }

  /* ====================================================================== */
  /*  Rendez-vous : formulaire                                               */
  /* ====================================================================== */
  function editRdv(r, day) {
    var isNew = !r, s = r ? new Date(r.debut) : null, e = r && r.fin ? new Date(r.fin) : null;
    var jour = r ? ymd(s) : (day || ymd(new Date()));
    var journee = r ? !!r.journee : false;
    var buttons = [];
    if (!isNew) buttons.push({ label: 'Supprimer', kind: 'danger', left: true, action: function () {
      return confirmBox('Supprimer ce rendez-vous ?', esc(r.titre), 'Supprimer').then(function (ok) {
        if (!ok) return false;
        return api('DELETE', 'rendez_vous?id=eq.' + encodeURIComponent(r.id)).then(function () { return loadTable('rdv'); }).then(function () { toast('Rendez-vous supprimé.'); refresh(); });
      }).then(function (x) { return x === false ? false : undefined; });
    } });
    buttons.push({ label: 'Annuler', kind: 'sec', action: function () {} });
    buttons.push({ label: isNew ? 'Ajouter' : 'Enregistrer', kind: 'vert', action: function () {
      var titre = $('r-titre').value.trim(), d = $('r-jour').value, allDay = $('r-journee').checked;
      if (!titre) { toast('Indiquez un titre.', true); return false; }
      if (!d) { toast('Indiquez la date.', true); return false; }
      var debut, fin = null;
      if (allDay) debut = new Date(d + 'T00:00:00');
      else {
        if (!$('r-debut').value) { toast('Indiquez l\'heure de début.', true); return false; }
        debut = new Date(d + 'T' + $('r-debut').value);
        if ($('r-fin').value) {
          fin = new Date(d + 'T' + $('r-fin').value);
          if (fin <= debut) { toast('L\'heure de fin doit être après le début.', true); return false; }
        }
      }
      var row = { titre: titre, debut: debut.toISOString(), fin: fin ? fin.toISOString() : null, journee: allDay,
        lieu: $('r-lieu').value.trim() || null, client: $('r-client').value.trim() || null, note: $('r-note').value.trim() || null };
      var job = isNew ? api('POST', 'rendez_vous', row, 'return=minimal') : api('PATCH', 'rendez_vous?id=eq.' + encodeURIComponent(r.id), row);
      return job.then(function () { return loadTable('rdv'); }).then(function () { toast(isNew ? 'Rendez-vous ajouté.' : 'Rendez-vous modifié.'); refresh(); });
    } });
    openModal({
      title: isNew ? 'Nouveau rendez-vous' : 'Modifier le rendez-vous',
      body: '<label class="champ">Titre<input id="r-titre" type="text" value="' + esc(r ? r.titre : '') + '" placeholder="Ex. Henné mariée — Sara"></label>' +
        '<label class="champ">Client (facultatif)<input id="r-client" type="text" value="' + esc(r && r.client ? r.client : '') + '"></label>' +
        '<label class="champ">Date<input id="r-jour" type="date" value="' + esc(jour) + '"></label>' +
        '<label class="case"><input type="checkbox" id="r-journee"' + (journee ? ' checked' : '') + '> Journée entière</label>' +
        '<div class="deux" id="r-heures"><label class="champ">Début<input id="r-debut" type="time" value="' + (s && !journee ? hhmm(s) : '14:00') + '"></label>' +
        '<label class="champ">Fin (facultatif)<input id="r-fin" type="time" value="' + (e && !journee ? hhmm(e) : '') + '"></label></div>' +
        '<label class="champ">Lieu (facultatif)<input id="r-lieu" type="text" value="' + esc(r && r.lieu ? r.lieu : '') + '" placeholder="Adresse ou ville"></label>' +
        '<label class="champ">Note (facultatif)<textarea id="r-note" rows="2">' + esc(r && r.note ? r.note : '') + '</textarea></label>',
      buttons: buttons,
      onOpen: function () {
        var sync = function () { $('r-heures').hidden = $('r-journee').checked; };
        $('r-journee').addEventListener('change', sync); sync();
      }
    });
  }

  /* ====================================================================== */
  /*  Onglet : tableau de bord                                               */
  /* ====================================================================== */
  function pendingHtml() {
    if (!S.cmd.length) return '';
    return '<div class="pending"><h3>Commandes PayPal à confirmer <span class="badge">' + S.cmd.length + '</span></h3>' +
      '<p>Ces clients ont cliqué sur « Payer avec PayPal ». Vérifiez le paiement dans PayPal : « Vérifier et enregistrer » ouvre la recette déjà pré-remplie.</p>' +
      S.cmd.map(function (c) {
        var d = new Date(c.created_at);
        return '<div class="cmd"><div class="qui"><strong>' + esc(c.client || 'Client') + '</strong> <span style="display:inline;opacity:.6">· ' + esc(dateCourte(d) + ' ' + hhmm(d)) + '</span>' +
          '<span>' + esc(c.resume || '') + '</span></div><div class="mt">' + esc(euro(c.total)) + '</div>' +
          '<div class="acts"><button type="button" class="btn petit vert" data-act="cmd-ok" data-id="' + esc(c.id) + '">Vérifier et enregistrer</button>' +
          '<button type="button" class="btn petit sec" data-act="cmd-no" data-id="' + esc(c.id) + '">Ignorer</button></div></div>';
      }).join('') + '</div>';
  }

  function tabDash() {
    var now = new Date(), y0 = now.getFullYear() + '-01-01', y1 = now.getFullYear() + '-12-31';
    var next = S.rdv.filter(rdvEnCours).slice(0, 5);
    var yr = sum(y0, y1, 'recette'), yd = sum(y0, y1, 'depense');
    $('panneau').innerHTML =
      '<div class="entete"><div><h2>Tableau de bord</h2><p>Vos recettes du jour, de la semaine et du mois, comparées à la période précédente.</p></div>' +
      '<div class="actions-ligne"><button type="button" class="btn vert" data-act="new-rec">+ Recette</button>' +
      '<button type="button" class="btn sec" data-act="new-dep">+ Dépense</button>' +
      '<button type="button" class="btn sec" data-act="new-rdv">+ Rendez-vous</button></div></div>' +
      pendingHtml() +
      '<div class="kpis">' + periods().map(kpiHtml).join('') + '</div>' +
      '<div class="carte"><div class="chart-tete"><div><h3>Évolution</h3><p class="leg">Recettes et dépenses, survolez une barre pour le détail.</p></div>' +
      '<div class="toggle" id="tg-chart"><button type="button" data-chart="30j" aria-pressed="' + (S.chart === '30j') + '">30 jours</button>' +
      '<button type="button" data-chart="12s" aria-pressed="' + (S.chart === '12s') + '">12 semaines</button>' +
      '<button type="button" data-chart="12m" aria-pressed="' + (S.chart === '12m') + '">12 mois</button></div></div>' +
      '<div class="legende"><span><i style="background:#1F6B5E"></i>Recettes</span><span><i style="background:#C58B3E"></i>Dépenses</span></div>' +
      '<div id="chart-zone">' + chartSvg(series(S.chart)) + '</div></div>' +
      '<div class="duo"><div class="carte"><h3>Recettes par prestation</h3><p class="leg">Ce mois-ci</p>' + repartitionHtml() + '</div>' +
      '<div class="carte"><h3>Prochains rendez-vous</h3><p class="leg">Les 5 à venir</p>' +
      (next.length ? next.map(function (r) { return rdvItem(r, true); }).join('') : '<div class="vide">Aucun rendez-vous à venir.<br><button type="button" class="btn sec petit" style="margin-top:10px" data-act="new-rdv">+ Ajouter un rendez-vous</button></div>') + '</div></div>' +
      '<div class="annee"><span>Depuis le 1er janvier : recettes <strong>' + esc(euro(yr)) + '</strong></span><span>dépenses <strong>' + esc(euro(yd)) + '</strong></span><span>bénéfice <strong>' + esc(euro(round2(yr - yd))) + '</strong></span></div>';
  }

  /* ====================================================================== */
  /*  Onglet : calendrier                                                    */
  /* ====================================================================== */
  function rdvByDay() {
    var map = {};
    S.rdv.forEach(function (r) { var k = ymd(new Date(r.debut)); (map[k] = map[k] || []).push(r); });
    return map;
  }
  function tabCal() {
    var first = S.calMonth, y = first.getFullYear(), mo = first.getMonth();
    var start = mondayOf(first), end = addDays(mondayOf(new Date(y, mo + 1, 0)), 6);
    var map = rdvByDay(), rec = {}, today = ymd(new Date());
    S.mouv.forEach(function (m) { if (m.sens === 'recette') rec[m.jour] = (rec[m.jour] || 0) + Number(m.montant); });
    var cells = '';
    for (var d = start; d <= end; d = addDays(d, 1)) {
      var k = ymd(d), list = map[k] || [];
      cells += '<button type="button" class="cell' + (d.getMonth() !== mo ? ' hors' : '') + (k === today ? ' auj' : '') + '" data-day="' + k + '" aria-label="' + esc(dateLongue(d)) + '">' +
        '<span class="dn">' + d.getDate() + '</span>' +
        list.slice(0, 2).map(function (r) { return '<span class="chip">' + esc((r.journee ? '' : hhmm(new Date(r.debut)) + ' ') + r.titre) + '</span>'; }).join('') +
        (list.length > 2 ? '<span class="more">+' + (list.length - 2) + ' autre' + (list.length > 3 ? 's' : '') + '</span>' : '') +
        (list.length ? '<span class="points">' + list.slice(0, 4).map(function () { return '<i></i>'; }).join('') + '</span>' : '') +
        (rec[k] ? '<span class="cal-rec">+' + esc(euro(Math.round(rec[k]))) + '</span>' : '') + '</button>';
    }
    $('panneau').innerHTML =
      '<div class="cal-nav"><button type="button" class="ico" data-act="cal-prev" aria-label="Mois précédent">‹</button>' +
      '<h2>' + MOIS[mo] + ' ' + y + '</h2><button type="button" class="ico" data-act="cal-next" aria-label="Mois suivant">›</button>' +
      '<button type="button" class="btn sec petit" data-act="cal-today">Aujourd\'hui</button>' +
      '<button type="button" class="btn vert petit" style="margin-left:auto" data-act="new-rdv">+ Rendez-vous</button></div>' +
      '<div class="cal">' + JOURS.map(function (j) { return '<div class="jn">' + j + '</div>'; }).join('') + cells + '</div>' +
      '<p class="aide" style="margin-top:12px">Touchez un jour pour voir ou ajouter ses rendez-vous. Le montant en vert est la recette du jour.</p>';
  }

  function dayModal(k) {
    var d = fromYmd(k), list = (rdvByDay()[k] || []), mv = S.mouv.filter(function (m) { return m.jour === k; });
    var body = '<h3 style="font-size:20px;margin:6px 0 8px">Rendez-vous</h3>' +
      (list.length ? list.map(function (r) { return rdvItem(r, false); }).join('') : '<div class="vide" style="margin-bottom:10px">Aucun rendez-vous ce jour.</div>') +
      '<h3 style="font-size:20px;margin:16px 0 8px">Recettes et dépenses</h3>' +
      (mv.length ? mv.map(function (m) { return mvRow(m, true); }).join('') : '<div class="vide">Aucune ligne ce jour.</div>');
    openModal({
      title: dateLongue(d).replace(/^./, function (c) { return c.toUpperCase(); }), body: body,
      buttons: [{ label: 'Fermer', kind: 'sec', action: function () {} },
        { label: '+ Recette', kind: 'sec', action: function () { setTimeout(function () { editMouvement(null, { sens: 'recette', jour: k }); }, 0); } },
        { label: '+ Rendez-vous', kind: 'vert', action: function () { setTimeout(function () { editRdv(null, k); }, 0); } }]
    });
  }

  /* ====================================================================== */
  /*  Onglet : agenda                                                        */
  /* ====================================================================== */
  function tabAgenda() {
    var list = S.rdv.filter(function (r) { return S.agView === 'avenir' ? rdvEnCours(r) : !rdvEnCours(r); });
    if (S.agView === 'passe') list = list.slice().reverse();
    var html = '', last = '';
    list.forEach(function (r) {
      var k = ymd(new Date(r.debut));
      if (k !== last) { html += '<div class="jour-t">' + esc(dateLongue(new Date(r.debut))) + '</div>'; last = k; }
      html += rdvItem(r, false);
    });
    $('panneau').innerHTML =
      '<div class="entete"><div><h2>Agenda</h2><p>Vos rendez-vous : mariages, soirées henné, livraisons de location. Chaque rendez-vous peut être ajouté à votre Google Agenda en un clic.</p></div>' +
      '<div class="actions-ligne"><div class="toggle"><button type="button" data-ag="avenir" aria-pressed="' + (S.agView === 'avenir') + '">À venir</button>' +
      '<button type="button" data-ag="passe" aria-pressed="' + (S.agView === 'passe') + '">Passés</button></div>' +
      '<button type="button" class="btn vert" data-act="new-rdv">+ Rendez-vous</button></div></div>' +
      (html || '<div class="vide">' + (S.agView === 'avenir' ? 'Aucun rendez-vous à venir.' : 'Aucun rendez-vous passé.') + '</div>');
  }

  /* ====================================================================== */
  /*  Onglet : recettes et dépenses                                          */
  /* ====================================================================== */
  function mvRow(m, compact) {
    var r = m.sens === 'recette';
    return '<div class="mv"><div class="d">' + esc(compact ? '' : dateCourte(fromYmd(m.jour))) + '</div>' +
      '<div class="p"><strong>' + esc(m.prestation || (r ? 'Recette' : 'Dépense')) + '</strong>' +
      (m.paiement ? '<span class="puce">' + esc(paiementLabel(m.paiement)) + '</span>' : '') +
      (m.note ? '<span>' + esc(m.note) + '</span>' : '') + '</div>' +
      '<div class="m ' + (r ? 'r' : 'dep') + '">' + (r ? '+' : '−') + esc(euro(m.montant)) + '</div>' +
      '<div class="acts"><button type="button" class="ico" data-act="edit-mv" data-id="' + esc(m.id) + '" aria-label="Modifier" title="Modifier">✎</button></div></div>';
  }
  function filtered() {
    var f = S.f, q = f.q.trim().toLowerCase();
    return S.mouv.filter(function (m) {
      if (f.mois !== 'tous' && m.jour.slice(0, 7) !== f.mois) return false;
      if (f.sens !== 'tous' && m.sens !== f.sens) return false;
      if (q && ((m.prestation || '') + ' ' + (m.note || '') + ' ' + paiementLabel(m.paiement)).toLowerCase().indexOf(q) < 0) return false;
      return true;
    });
  }
  function moisOptions() {
    var set = {}; set[ymd(new Date()).slice(0, 7)] = 1;
    S.mouv.forEach(function (m) { set[m.jour.slice(0, 7)] = 1; });
    return Object.keys(set).sort().reverse();
  }
  function renderFinList() {
    var list = filtered(), rec = 0, dep = 0;
    list.forEach(function (m) { if (m.sens === 'recette') rec += Number(m.montant); else dep += Number(m.montant); });
    $('fin-liste').innerHTML = list.length ? list.map(function (m) { return mvRow(m, false); }).join('') +
      '<div class="totaux"><span>Recettes<strong style="color:#1F6B5E">' + esc(euro(round2(rec))) + '</strong></span><span>Dépenses<strong style="color:#9B2C1F">' + esc(euro(round2(dep))) + '</strong></span>' +
      '<span>Solde<strong>' + esc(euro(round2(rec - dep))) + '</strong></span></div>'
      : '<div class="vide">Aucune ligne pour ces filtres.' + (S.mouv.length ? '' : '<br>Commencez par « + Recette » : une ligne par encaissement.') + '</div>';
  }
  function tabFin() {
    $('panneau').innerHTML =
      '<div class="entete"><div><h2>Recettes &amp; dépenses</h2><p>Une ligne par encaissement ou par dépense. Les totaux du tableau de bord se calculent à partir d\'ici.</p></div>' +
      '<div class="actions-ligne"><button type="button" class="btn vert" data-act="new-rec">+ Recette</button>' +
      '<button type="button" class="btn sec" data-act="new-dep">+ Dépense</button>' +
      '<button type="button" class="btn sec" data-act="csv">Exporter (CSV)</button></div></div>' +
      pendingHtml() +
      '<div class="filtres"><select id="fl-mois" aria-label="Mois"><option value="tous">Tous les mois</option>' + moisOptions().map(function (k) {
        var a = k.split('-'); return '<option value="' + k + '"' + (S.f.mois === k ? ' selected' : '') + '>' + MOIS[+a[1] - 1] + ' ' + a[0] + '</option>';
      }).join('') + '</select>' +
      '<select id="fl-sens" aria-label="Type"><option value="tous">Recettes et dépenses</option><option value="recette"' + (S.f.sens === 'recette' ? ' selected' : '') + '>Recettes</option><option value="depense"' + (S.f.sens === 'depense' ? ' selected' : '') + '>Dépenses</option></select>' +
      '<input id="fl-q" type="search" placeholder="Rechercher…" aria-label="Rechercher" value="' + esc(S.f.q) + '"></div>' +
      '<div id="fin-liste"></div>';
    renderFinList();
    $('fl-mois').addEventListener('change', function () { S.f.mois = this.value; renderFinList(); });
    $('fl-sens').addEventListener('change', function () { S.f.sens = this.value; renderFinList(); });
    $('fl-q').addEventListener('input', function () { S.f.q = this.value; renderFinList(); });
  }
  function exportCsv() {
    var list = filtered();
    var q = function (v) { return '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"'; };
    var lines = [['Date', 'Type', 'Montant', 'Prestation', 'Paiement', 'Note'].map(q).join(';')].concat(list.map(function (m) {
      return [m.jour, m.sens === 'recette' ? 'Recette' : 'Dépense', String(m.montant).replace('.', ','), m.prestation, paiementLabel(m.paiement), m.note].map(q).join(';');
    }));
    var blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'henna-by-ines-recettes-' + ymd(new Date()) + '.csv';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    toast(list.length + ' ligne(s) exportée(s).');
  }

  /* ====================================================================== */
  /*  Onglet : Google Agenda                                                 */
  /* ====================================================================== */
  function calendarId(v) {
    v = String(v || '').trim();
    var m = v.match(/[?&]src=([^&"'\s]+)/);          // adresse d'intégration ou code <iframe> collé en entier
    if (m) { try { return decodeURIComponent(m[1]); } catch (e) { return m[1]; } }
    return v;
  }
  function tabGoogle() {
    var id = calendarId(S.reg.google_calendar);
    $('panneau').innerHTML =
      '<div class="entete"><div><h2>Google Agenda</h2><p>Retrouvez votre vrai Google Agenda ici. Pour y ajouter un rendez-vous de cette page, utilisez le bouton « + Google Agenda » de l\'onglet Agenda.</p></div>' +
      '<div class="actions-ligne"><a class="btn sec" href="https://calendar.google.com/calendar/u/0/r" target="_blank" rel="noopener">Ouvrir Google Agenda</a></div></div>' +
      '<div class="carte" style="margin-bottom:16px"><label class="champ" style="margin-bottom:8px">Adresse de votre Google Agenda' +
      '<input id="g-id" type="text" value="' + esc(S.reg.google_calendar || '') + '" placeholder="votre.adresse@gmail.com"></label>' +
      '<p class="aide" style="margin:0 0 12px">Saisissez l\'adresse Gmail liée à l\'agenda (ou son identifiant d\'agenda). L\'agenda s\'affiche si vous êtes connectée à ce compte Google dans ce navigateur. ' +
      'Ne rendez pas l\'agenda public : vos rendez-vous clients seraient visibles par tous.</p>' +
      '<div class="actions-ligne"><button type="button" class="btn" data-act="g-save">Enregistrer</button>' +
      (S.reg.google_calendar ? '<button type="button" class="btn sec" data-act="g-clear">Retirer</button>' : '') + '</div></div>' +
      (id ? '<iframe class="gframe" title="Google Agenda" loading="lazy" src="https://calendar.google.com/calendar/embed?src=' + encodeURIComponent(id) +
        '&ctz=Europe%2FParis&hl=fr&mode=MONTH&showTitle=0&showPrint=0&showTz=0&wkst=2"></iframe>' +
        '<p class="aide" style="margin-top:10px">Si l\'agenda demande une connexion ou reste vide, connectez-vous à Google dans ce navigateur, puis rechargez cette page.</p>'
        : '<div class="vide">Renseignez votre adresse ci-dessus pour afficher votre agenda ici.</div>');
  }
  function saveReg(key, value) {
    var job = value ? api('POST', 'reglages?on_conflict=key', [{ key: key, value: value }], 'resolution=merge-duplicates,return=minimal')
      : api('DELETE', 'reglages?key=eq.' + encodeURIComponent(key));
    return job.then(function () { return loadTable('reg'); });
  }

  /* ====================================================================== */
  /*  Navigation et actions                                                  */
  /* ====================================================================== */
  var TABS = { dash: tabDash, cal: tabCal, agenda: tabAgenda, fin: tabFin, google: tabGoogle };
  function badge() {
    $('t-fin').innerHTML = 'Recettes &amp; dépenses' + (S.cmd.length ? '<span class="nb">' + S.cmd.length + '</span>' : '');
  }
  function refresh() {
    badge();
    [].forEach.call($('onglets').children, function (b) { b.setAttribute('aria-selected', String(b.getAttribute('data-tab') === S.tab)); });
    TABS[S.tab]();
  }
  function goTab(name) {
    if (!TABS[name]) name = 'dash';
    S.tab = name;
    try { history.replaceState(null, '', '#' + name); } catch (e) {}
    refresh();
    window.scrollTo(0, 0);
  }
  $('onglets').addEventListener('click', function (e) { var b = e.target.closest('[data-tab]'); if (b) goTab(b.getAttribute('data-tab')); });

  function byId(list, id) { return list.filter(function (x) { return String(x.id) === String(id); })[0]; }

  $('panneau').addEventListener('click', function (e) {
    var day = e.target.closest('[data-day]');
    if (day) { dayModal(day.getAttribute('data-day')); return; }
    var ch = e.target.closest('[data-chart]');
    if (ch) { S.chart = ch.getAttribute('data-chart'); tabDash(); return; }
    var ag = e.target.closest('[data-ag]');
    if (ag) { S.agView = ag.getAttribute('data-ag'); tabAgenda(); return; }
    var b = e.target.closest('[data-act]');
    if (!b) return;
    var act = b.getAttribute('data-act'), id = b.getAttribute('data-id');
    if (act === 'new-rec') return editMouvement(null, { sens: 'recette' });
    if (act === 'new-dep') return editMouvement(null, { sens: 'depense' });
    if (act === 'new-rdv') return editRdv(null);
    if (act === 'edit-mv') return editMouvement(byId(S.mouv, id));
    if (act === 'edit-rdv') return editRdv(byId(S.rdv, id));
    if (act === 'del-rdv') return editRdv(byId(S.rdv, id));
    if (act === 'cmd-ok') return confirmerCommande(id);
    if (act === 'cmd-no') return ignoreCommande(id);
    if (act === 'csv') return exportCsv();
    if (act === 'cal-prev') { S.calMonth = monthStart(S.calMonth, -1); return tabCal(); }
    if (act === 'cal-next') { S.calMonth = monthStart(S.calMonth, 1); return tabCal(); }
    if (act === 'cal-today') { S.calMonth = monthStart(new Date()); return tabCal(); }
    if (act === 'g-save') {
      var v = $('g-id').value.trim();
      if (!v) { toast('Saisissez l\'adresse de votre Google Agenda.', true); return; }
      saveReg('google_calendar', v).then(function () { toast('Enregistré.'); tabGoogle(); }).catch(function (er) { toast(explain(er), true); });
    }
    if (act === 'g-clear') saveReg('google_calendar', '').then(function () { toast('Agenda retiré.'); tabGoogle(); }).catch(function (er) { toast(explain(er), true); });
  });

  // Les lignes affichées dans la fenêtre d'un jour (modifier / supprimer / Google) réagissent aussi.
  $('modal').addEventListener('click', function (e) {
    var b = e.target.closest('[data-act]');
    if (!b) return;
    var act = b.getAttribute('data-act'), id = b.getAttribute('data-id');
    if (act === 'edit-mv') { closeModal(); editMouvement(byId(S.mouv, id)); }
    if (act === 'edit-rdv' || act === 'del-rdv') { closeModal(); editRdv(byId(S.rdv, id)); }
  });

  /* ====================================================================== */
  /*  Démarrage                                                              */
  /* ====================================================================== */
  function enter() {
    var s = getSession();
    $('qui').textContent = s && s.email ? 'Connectée : ' + s.email : '';
    show('v-app');
    $('panneau').innerHTML = '<div class="chargement">Chargement…</div>';
    loadAll().then(function () {
      var h = (location.hash || '').replace('#', '');
      S.tab = TABS[h] ? h : 'dash';
      refresh();
    }).catch(function (e) {
      $('panneau').innerHTML = '<div class="erreur">' + esc(explain(e)) + '</div><button class="btn sec" id="retry">Réessayer</button>';
      $('retry').addEventListener('click', enter);
    });
  }

  $('b-logout').addEventListener('click', function () { setSession(null); show('v-login'); });
  $('f-login').addEventListener('submit', function (e) {
    e.preventDefault();
    var btn = $('login-btn'), err = $('login-err');
    err.hidden = true; btn.disabled = true; btn.textContent = 'Connexion…';
    authCall('password', { email: $('login-email').value.trim(), password: $('login-pw').value }).then(function () {
      $('login-pw').value = ''; enter();
    }, function (ex) {
      err.textContent = ex.status === 400 || ex.status === 401 || /invalid/i.test(ex.message) ? 'Adresse e-mail ou mot de passe incorrect.' : explain(ex);
      err.hidden = false;
    }).then(function () { btn.disabled = false; btn.textContent = 'Se connecter'; });
  });

  if (!DB || !DB.enabled) show('v-config');
  else if (getSession()) enter();
  else show('v-login');
})();
