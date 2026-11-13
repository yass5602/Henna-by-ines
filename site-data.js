/* ============================================================================
   Henna by Inès — Contenu modifiable depuis l'espace administrateur
   ----------------------------------------------------------------------------
   Chargé par index.html, location.html et commande.html (après config.js,
   avant cart.js), et par admin.html.

   Rôle : lire dans Supabase (service gratuit) les modifications faites par
   l'administratrice et les appliquer au site :
     • textes            -> éléments  <… data-edit="clé">
     • photos du site    -> éléments  <img data-img="clé">
     • prix / noms       -> éléments  <… data-price="référence produit"> + config.js
     • réalisations      -> conteneur <… data-gallery>
     • location          -> CFG.rentals (utilisé par location.html)

   Si Supabase n'est pas configuré (config.js > supabase.url vide) ou injoignable,
   le site s'affiche exactement comme avant : rien ne casse.
   Aucune dépendance : simples appels « fetch » vers l'API REST de Supabase.
   ========================================================================== */
(function () {
  'use strict';

  var CFG = window.HENNA_CONFIG = window.HENNA_CONFIG || {};
  var SB = CFG.supabase || {};
  var URL_ = String(SB.url || '').replace(/\/+$/, '');
  var KEY = SB.anonKey || '';
  var BUCKET = SB.bucket || 'media';
  var ENABLED = !!(URL_ && KEY);
  var CACHE_KEY = 'henna_site_v1';

  // On garde l'original de config.js pour que l'espace admin puisse « importer » ou « rétablir ».
  CFG._rentalsDefault = JSON.parse(JSON.stringify(CFG.rentals || []));
  CFG._productsDefault = JSON.parse(JSON.stringify(CFG.products || {}));

  /* ---------------------------------------------------------------------- */
  /* Petit client REST Supabase (lecture publique ; l'admin ajoute son jeton) */
  /* ---------------------------------------------------------------------- */
  function headers(token, extra) {
    var h = { apikey: KEY, Authorization: 'Bearer ' + (token || KEY) };
    for (var k in (extra || {})) h[k] = extra[k];
    return h;
  }

  function rest(method, path, opts) {
    opts = opts || {};
    var h = headers(opts.token, opts.headers);
    var body;
    if (opts.json !== undefined) { h['Content-Type'] = 'application/json'; body = JSON.stringify(opts.json); }
    return fetch(URL_ + '/rest/v1/' + path, { method: method, headers: h, body: body }).then(function (r) {
      if (!r.ok) {
        return r.text().then(function (t) {
          var e = new Error('Supabase ' + r.status + ' : ' + t.slice(0, 300));
          e.status = r.status;
          throw e;
        });
      }
      return r.status === 204 ? null : r.text().then(function (t) { return t ? JSON.parse(t) : null; });
    });
  }

  function publicUrl(path) { return URL_ + '/storage/v1/object/public/' + BUCKET + '/' + path; }

  window.HennaDB = {
    enabled: ENABLED, url: URL_, key: KEY, bucket: BUCKET,
    headers: headers, rest: rest, publicUrl: publicUrl
  };

  /* ---------------------------------------------------------------------- */
  /* Texte  <->  HTML  (gras = **mot**, retour à la ligne = saut de ligne)    */
  /* ---------------------------------------------------------------------- */
  function esc(t) {
    return String(t).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // Valeur saisie par l'administratrice -> HTML sûr (rien d'autre que <strong> et <br> n'est possible).
  function toHtml(value, strongStyle) {
    var open = '<strong' + (strongStyle ? ' style="' + esc(strongStyle) + '"' : '') + '>';
    return esc(value)
      .replace(/\*\*([^*]+)\*\*/g, open + '$1</strong>')
      .replace(/\r?\n/g, '<br>');
  }

  // Contenu HTML d'origine d'un élément -> texte modifiable.
  function fromEl(el) {
    var out = '';
    (function walk(node) {
      for (var n = node.firstChild; n; n = n.nextSibling) {
        if (n.nodeType === 3) out += n.nodeValue.replace(/\s+/g, ' ');
        else if (n.nodeType === 1) {
          var t = n.tagName.toLowerCase();
          if (t === 'br') out += '\n';
          else if (t === 'strong' || t === 'b') { out += '**'; walk(n); out += '**'; }
          else walk(n);
        }
      }
    })(el);
    return out.replace(/ *\n */g, '\n').replace(/\*\* +\*\*/g, ' ').trim();
  }

  function formatPrice(n) {
    n = Number(n);
    return (n % 1 === 0 ? String(n) : n.toFixed(2).replace('.', ',')) + ' €';
  }

  /* ---------------------------------------------------------------------- */
  /* Cache local : la page s'affiche tout de suite avec la dernière version   */
  /* ---------------------------------------------------------------------- */
  var data = { content: {}, rentals: null, gallery: null };

  function readCache() {
    try {
      var c = JSON.parse(window.localStorage.getItem(CACHE_KEY) || 'null');
      if (c && typeof c === 'object') {
        data.content = c.content || {};
        data.rentals = Array.isArray(c.rentals) ? c.rentals : null;
        data.gallery = Array.isArray(c.gallery) ? c.gallery : null;
      }
    } catch (e) {}
  }
  function writeCache() {
    try { window.localStorage.setItem(CACHE_KEY, JSON.stringify(data)); } catch (e) {}
  }

  /* ---------------------------------------------------------------------- */
  /* Application à config.js (produits, location) — modifie les objets en     */
  /* place, pour que cart.js et location.html voient toujours les bonnes      */
  /* valeurs.                                                                 */
  /* ---------------------------------------------------------------------- */
  function applyConfig() {
    var P = CFG.products || {}, D = CFG._productsDefault || {};
    Object.keys(P).forEach(function (sku) {
      var price = data.content['product.' + sku + '.price'];
      var label = data.content['product.' + sku + '.label'];
      var n = price != null && price !== '' ? Number(String(price).replace(',', '.')) : NaN;
      P[sku].price = isFinite(n) && n >= 0 ? n : D[sku].price;
      P[sku].label = label ? label : D[sku].label;
    });
    // Location : le catalogue de la base remplace celui de config.js dès qu'il contient des articles.
    if (data.rentals && data.rentals.length) {
      CFG.rentals = data.rentals.filter(function (r) { return r.active !== false; }).map(function (r) {
        return { id: r.id, name: r.name, note: r.note || '', price: r.price == null ? null : Number(r.price),
          cat: r.cat, photos: Array.isArray(r.photos) ? r.photos : [] };
      });
    } else {
      CFG.rentals = JSON.parse(JSON.stringify(CFG._rentalsDefault || []));
    }
  }

  /* ---------------------------------------------------------------------- */
  /* Application à la page                                                    */
  /* ---------------------------------------------------------------------- */
  function applyDom() {
    if (!document.body) return;
    var c = data.content, i, el;

    var texts = document.querySelectorAll('[data-edit]');
    for (i = 0; i < texts.length; i++) {
      el = texts[i];
      var v = c['text.' + el.getAttribute('data-edit')];
      if (v == null || v === '') {              // texte rétabli : on remet l'original
        if (el._hv !== undefined && el._hOrig !== undefined) { el.innerHTML = el._hOrig; el._hv = undefined; }
        continue;
      }
      if (el._hv === v) continue;
      if (el._hStyle === undefined) {          // on retient le style du gras d'origine
        var st = el.querySelector('strong,b');
        el._hStyle = st ? st.getAttribute('style') : null;
      }
      if (el._hOrig === undefined) el._hOrig = el.innerHTML;
      el.innerHTML = toHtml(v, el._hStyle);
      el._hv = v;
    }

    var imgs = document.querySelectorAll('img[data-img]');
    for (i = 0; i < imgs.length; i++) {
      el = imgs[i];
      var u = c['img.' + el.getAttribute('data-img')];
      if (!u) {                                 // photo rétablie : on remet l'original
        if (el._hs !== undefined && el._hSrc0 != null) { el.setAttribute('src', el._hSrc0); el._hs = undefined; }
        continue;
      }
      if (el._hs === u) continue;
      if (el._hSrc0 === undefined) el._hSrc0 = el.getAttribute('src');
      el.src = u; el._hs = u;
    }

    var prices = document.querySelectorAll('[data-price]');
    for (i = 0; i < prices.length; i++) {
      el = prices[i];
      var p = CFG.products && CFG.products[el.getAttribute('data-price')];
      if (!p) continue;
      var t = formatPrice(p.price);
      if (el._hp !== t) { el.textContent = t; el._hp = t; }
    }

    var gals = document.querySelectorAll('[data-gallery]');
    for (i = 0; i < gals.length; i++) applyGallery(gals[i]);
  }

  // Réalisations : si la base contient des photos, elles remplacent celles du site (qu'on masque sans les supprimer).
  function applyGallery(box) {
    var list = data.gallery;
    var sig = list && list.length ? JSON.stringify(list.map(function (g) { return [g.id, g.src, g.caption, g.position]; })) : '';
    if (box._hg === sig && (!sig || box.querySelector('[data-gal-db]'))) return;
    var old = box.querySelectorAll('[data-gal-db]');
    for (var k = 0; k < old.length; k++) old[k].parentNode.removeChild(old[k]);
    var orig = box.querySelectorAll('img:not([data-gal-db])');
    for (k = 0; k < orig.length; k++) orig[k].style.display = sig ? 'none' : '';
    if (sig) {
      list.forEach(function (g) {
        var im = document.createElement('img');
        im.className = 'photo';
        im.loading = 'lazy';
        im.style.borderRadius = '16px';
        im.src = g.src;
        im.alt = g.caption || 'Réalisation de henné';
        im.setAttribute('data-gal-db', '');
        im.setAttribute('data-gal-id', g.id);
        box.appendChild(im);
      });
    }
    box._hg = sig;
  }

  /* ---------------------------------------------------------------------- */
  /* Démarrage                                                                */
  /* ---------------------------------------------------------------------- */
  var scheduled = false;
  function schedule() {
    if (scheduled) return;
    scheduled = true;
    setTimeout(function () { scheduled = false; applyDom(); }, 60);
  }

  function notifyChange() {
    applyConfig();
    applyDom();
    try { window.dispatchEvent(new CustomEvent('henna-content-updated')); } catch (e) {}
  }

  function fetchFresh() {
    if (!ENABLED) return Promise.resolve();
    return Promise.all([
      rest('GET', 'site_content?select=key,value'),
      rest('GET', 'rentals?select=*&order=position.asc,name.asc'),
      rest('GET', 'gallery?select=*&order=position.asc,id.asc')
    ]).then(function (res) {
      var content = {};
      (res[0] || []).forEach(function (r) { content[r.key] = r.value; });
      var fresh = { content: content, rentals: res[1] || [], gallery: res[2] || [] };
      if (JSON.stringify(fresh) !== JSON.stringify(data)) {
        data = fresh;
        writeCache();
        notifyChange();
      }
    }).catch(function (e) {
      if (window.console) console.warn('[HENNA] contenu admin indisponible, version d\'origine conservée :', e && e.message);
    });
  }

  /* ---------------------------------------------------------------------- */
  /* Mode édition sur la page : chargé UNIQUEMENT si l'administratrice est    */
  /* connectée (session de admin.html) et a ouvert la page avec « ?edit ».    */
  /* Les visiteurs ne téléchargent rien de plus.                              */
  /* ---------------------------------------------------------------------- */
  function loadEditMode() {
    try {
      if (!ENABLED || /(admin|pilotage)(\.html)?\/?$/.test(location.pathname)) return;
      var asked = /[?&]edit(=|&|$)/.test(location.search);
      var hasSession = !!window.localStorage.getItem('henna_admin_session');
      if (!hasSession) { window.sessionStorage.removeItem('henna_edit'); return; }
      if (asked) {
        window.sessionStorage.setItem('henna_edit', '1');
        var clean = location.search.replace(/([?&])edit(=[^&]*)?(&|$)/, function (m, a, b, c) { return c ? a : ''; }).replace(/[?&]$/, '');
        history.replaceState(null, '', location.pathname + clean + location.hash);
      }
      if (window.sessionStorage.getItem('henna_edit') !== '1') return;
      var go = function () {
        var s = document.createElement('script');
        s.src = 'edit-mode.js?v=1';
        document.head.appendChild(s);
      };
      if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go); else go();
    } catch (e) {}
  }

  readCache();
  applyConfig();                                  // tout de suite, avant que cart.js lise les produits
  loadEditMode();

  document.addEventListener('DOMContentLoaded', applyDom);
  window.addEventListener('pageshow', applyDom);
  try {
    // index.html est dessiné après le chargement : on applique dès que les éléments arrivent
    new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
  } catch (e) {}
  fetchFresh();

  window.HennaSite = {
    enabled: ENABLED,
    get: function () { return data; },
    refresh: fetchFresh,
    toHtml: toHtml, fromEl: fromEl, esc: esc, formatPrice: formatPrice,
    // utilisé par l'espace admin pour appliquer ses changements aussitôt
    setData: function (d) { data = d; writeCache(); notifyChange(); }
  };
})();
