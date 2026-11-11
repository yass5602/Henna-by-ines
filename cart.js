/* ============================================================================
   Henna by Inès — Panier (JavaScript simple, sans dépendance)
   ----------------------------------------------------------------------------
   Chargé par index.html (boutons « Ajouter au panier », pastille du panier)
   et par commande.html (page panier + commande).
   Le panier est mémorisé dans le navigateur de la cliente (localStorage).
   Tous les prix, poids et frais de port viennent de config.js : rien à
   modifier ici pour changer un tarif.
   ========================================================================== */
(function () {
  'use strict';

  var KEY = 'henna_cart_v1';
  var CFG = window.HENNA_CONFIG || {};
  var PRODUCTS = CFG.products || {};
  var SHIP = CFG.shipping || {};
  var POWDER_MAX = CFG.powderMaxGrams || 300;
  var LINE_MAX = 20;      // garde-fou : quantité maximale par ligne (hors poudre)

  /* ---------- stockage ---------- */
  function load() {
    try {
      var raw = window.localStorage.getItem(KEY);
      var list = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(list)) return [];
      // on ne garde que les produits qui existent encore dans le catalogue
      return list.filter(function (l) {
        return l && PRODUCTS[l.sku] && l.qty > 0;
      }).map(function (l) {
        return { sku: l.sku, qty: Math.floor(l.qty), oil: l.oil === 'sans' ? 'sans' : 'avec' };
      });
    } catch (e) { return []; }
  }

  var memory = null;           // repli si localStorage est indisponible (navigation privée…)
  function get() { return memory ? memory : load(); }
  function save(list) {
    try { window.localStorage.setItem(KEY, JSON.stringify(list)); memory = null; }
    catch (e) { memory = list; }
    notify();
  }

  function notify() {
    updateBadges();
    try { window.dispatchEvent(new CustomEvent('henna-cart-change')); } catch (e) {}
  }

  /* ---------- règles du panier ---------- */
  function lineKey(l) { return l.sku + ':' + (PRODUCTS[l.sku] && PRODUCTS[l.sku].oilChoice ? l.oil : '-'); }

  function powderGrams(list) {
    return list.reduce(function (g, l) {
      var p = PRODUCTS[l.sku];
      return g + (p && p.kind === 'poudre' ? (p.grams || 0) * l.qty : 0);
    }, 0);
  }

  function count(list) {
    list = list || get();
    return list.reduce(function (n, l) { return n + l.qty; }, 0);
  }

  /* Frais de port d'un panier : calculés OFFRE PAR OFFRE, puis additionnés.
       • cônes / box : la grille Colissimo de config.js (shipping.coneTiers) s'applique au nombre de
         cônes de CHAQUE offre (quantité × shipCones). Ex. : 1 box (7,59 €) + 1 lot de 10 cônes (7,59 €) = 15,18 €.
       • poudre (toutes les poudres ensemble) : jusqu'à 250 g -> 5,49 €, au-delà -> 7,59 €.
       • location : jamais de colis. */
  function coneFee(n) {
    var tiers = SHIP.coneTiers || [];
    for (var i = 0; i < tiers.length; i++) if (n <= tiers[i].max) return tiers[i].fee;
    return tiers.length ? tiers[tiers.length - 1].fee : (SHIP.standard || 0);
  }

  function shippingFor(list, subtotal) {
    if (!list.length) return { fee: 0, free: false, tier: null, parts: [] };
    var colis = list.filter(function (l) { return PRODUCTS[l.sku].kind !== 'location'; });
    if (!colis.length) return { fee: 0, free: false, tier: 'location', parts: [] };
    var subColis = colis.reduce(function (s, l) { return s + PRODUCTS[l.sku].price * l.qty; }, 0);
    if (SHIP.freeFrom != null && subColis >= SHIP.freeFrom) return { fee: 0, free: true, tier: 'free', parts: [] };

    var parts = [], bySku = {};
    colis.forEach(function (l) {
      var p = PRODUCTS[l.sku];
      if (p.kind === 'poudre') return;
      var g = bySku[l.sku];
      if (!g) { g = bySku[l.sku] = { sku: l.sku, label: shortLabel(p.label), qty: 0, cones: 0 }; parts.push(g); }
      g.qty += l.qty;
      g.cones += l.qty * (p.shipCones || 1);
    });
    parts.forEach(function (g) { g.fee = coneFee(g.cones); });
    var grams = powderGrams(colis);
    if (grams > 0) {
      parts.push({ sku: 'poudre', label: 'Poudre de henné (' + grams + ' g)', qty: 1, cones: 0,
        fee: grams <= (SHIP.lightMaxGrams || 250) ? SHIP.light : SHIP.standard });
    }
    var fee = Math.round(parts.reduce(function (s, g) { return s + g.fee; }, 0) * 100) / 100;
    return { fee: fee, free: false, tier: 'calc', parts: parts };
  }

  function compute(list) {
    list = list || get();
    var lines = list.map(function (l) {
      var p = PRODUCTS[l.sku];
      return {
        sku: l.sku, qty: l.qty, oil: l.oil, key: lineKey(l),
        label: p.label, kind: p.kind, price: p.price, oilChoice: !!p.oilChoice,
        grams: p.grams || 0, total: Math.round(p.price * l.qty * 100) / 100
      };
    });
    var subtotal = Math.round(lines.reduce(function (s, l) { return s + l.total; }, 0) * 100) / 100;
    var ship = shippingFor(list, subtotal);
    return {
      lines: lines,
      count: count(list),
      grams: powderGrams(list),
      subtotal: subtotal,
      hasRental: lines.some(function (l) { return l.kind === 'location'; }),
      hasParcel: lines.some(function (l) { return l.kind !== 'location'; }),
      shipping: ship,
      total: Math.round((subtotal + ship.fee) * 100) / 100
    };
  }

  /* ---------- actions ---------- */
  // Renvoie { ok:true } ou { ok:false, reason:'…' } (message affichable).
  function add(sku, qty, oil) {
    var p = PRODUCTS[sku];
    if (!p) return { ok: false, reason: 'Ce produit n\'est plus disponible.' };
    qty = Math.max(1, Math.floor(qty || 1));
    var list = get().slice();
    var probe = { sku: sku, qty: qty, oil: oil === 'sans' ? 'sans' : 'avec' };
    var key = lineKey(probe);
    var found = null;
    list.forEach(function (l) { if (lineKey(l) === key) found = l; });

    if (p.kind === 'poudre') {
      if (powderGrams(list) + (p.grams || 0) * qty > POWDER_MAX) {
        return { ok: false, reason: 'Vous pouvez commander au maximum ' + POWDER_MAX + ' g de poudre par commande.' };
      }
    } else if ((found ? found.qty : 0) + qty > LINE_MAX) {
      return { ok: false, reason: 'Quantité maximale atteinte pour ce produit. Écrivez-nous pour une grosse commande.' };
    }
    if (found) found.qty += qty; else list.push(probe);
    save(list);
    return { ok: true };
  }

  function setQty(key, qty) {
    var list = get().slice();
    var idx = -1;
    list.forEach(function (l, i) { if (lineKey(l) === key) idx = i; });
    if (idx < 0) return { ok: false, reason: '' };
    qty = Math.floor(qty);
    if (!(qty > 0)) { list.splice(idx, 1); save(list); return { ok: true }; }
    var p = PRODUCTS[list[idx].sku];
    if (p.kind === 'poudre') {
      var others = powderGrams(list) - (p.grams || 0) * list[idx].qty;
      if (others + (p.grams || 0) * qty > POWDER_MAX) {
        return { ok: false, reason: 'Maximum ' + POWDER_MAX + ' g de poudre par commande.' };
      }
    } else if (qty > LINE_MAX) {
      return { ok: false, reason: 'Quantité maximale atteinte pour ce produit.' };
    }
    list[idx].qty = qty;
    save(list);
    return { ok: true };
  }

  function setOil(key, oil) {
    var list = get().slice();
    var idx = -1;
    list.forEach(function (l, i) { if (lineKey(l) === key) idx = i; });
    if (idx < 0) return;
    list[idx].oil = oil === 'sans' ? 'sans' : 'avec';
    // fusion si une ligne identique existe déjà avec ce choix
    var k = lineKey(list[idx]);
    for (var i = 0; i < list.length; i++) {
      if (i !== idx && lineKey(list[i]) === k) {
        list[i].qty += list[idx].qty;
        list.splice(idx, 1);
        break;
      }
    }
    save(list);
  }

  function remove(key) { setQty(key, 0); }
  function clear() { save([]); }

  /* ---------- pastille du panier dans l'en-tête ---------- */
  function updateBadges() {
    var n = count();
    var els = document.querySelectorAll('[data-cart-count]');
    for (var i = 0; i < els.length; i++) {
      // On n'écrit que si la valeur change, sinon l'observateur ci-dessous tournerait en boucle.
      if (els[i].textContent !== String(n)) els[i].textContent = n;
      var disp = n > 0 ? 'inline-block' : 'none';
      if (els[i].style.display !== disp) els[i].style.display = disp;
    }
  }

  /* ---------- petit message de confirmation ---------- */
  var toastTimer = null;
  function toast(message, isError) {
    var el = document.getElementById('henna-toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'henna-toast';
      el.setAttribute('role', 'status');
      el.style.cssText = 'position:fixed;left:50%;bottom:90px;transform:translateX(-50%);z-index:200;' +
        'max-width:min(92vw,420px);padding:14px 22px;border-radius:999px;font:500 14px/1.4 Jost,system-ui,sans-serif;' +
        'box-shadow:0 10px 30px rgba(36,26,20,.28);text-align:center;transition:opacity .25s;opacity:0;pointer-events:none';
      document.body.appendChild(el);
    }
    el.style.background = isError ? '#A8542A' : '#241A14';
    el.style.color = '#FBF4EB';
    el.innerHTML = '';
    el.appendChild(document.createTextNode(message));
    if (!isError) {
      var a = document.createElement('a');
      a.href = 'commande.html';
      a.setAttribute('data-cart-link', '');
      a.textContent = ' Voir le panier →';
      a.style.cssText = 'color:#EFCF9C;text-decoration:underline;margin-left:6px;pointer-events:auto;white-space:nowrap';
      el.appendChild(a);
    }
    el.style.opacity = '1';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.style.opacity = '0'; }, isError ? 4200 : 3200);
  }

  /* ---------- boutons « Ajouter au panier » (n'importe où dans la page) ---------- */
  document.addEventListener('click', function (e) {
    var t = e.target;
    while (t && t !== document && !(t.getAttribute && t.getAttribute('data-add-to-cart'))) t = t.parentNode;
    if (!t || t === document) return;
    e.preventDefault();
    var sku = t.getAttribute('data-add-to-cart');
    var res = add(sku, 1);
    if (res.ok) {
      toast('« ' + (PRODUCTS[sku] ? shortLabel(PRODUCTS[sku].label) : 'Produit') + ' » ajouté au panier.');
    } else {
      toast(res.reason, true);
    }
  });

  function shortLabel(label) { return String(label).replace(/\s*\(.*\)\s*$/, ''); }


  /* ---------- mini-panier sous le bouton « Panier » ---------- */
  function euro(n) { return Number(n).toFixed(2).replace('.', ',') + ' €'; }
  function esc(t) {
    return String(t).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  var panel = null, veil = null, anchor = null;

  /* Mise en forme du mini-panier. Ordinateur : petite fenêtre sous le bouton.
     Téléphone (≤ 600 px) : volet qui monte du bas de l'écran, gros boutons,
     fond assombri, bouton « Valider ma commande » toujours visible. */
  var CSS = [
    '#henna-minicart{position:fixed;z-index:120;display:none;flex-direction:column;box-sizing:border-box;width:min(92vw,370px);',
    'background:#FBF4EB;color:#241A14;border:1px solid rgba(36,26,20,.14);border-radius:20px;',
    'box-shadow:0 18px 48px rgba(36,26,20,.28);font:400 14.5px/1.5 Jost,system-ui,sans-serif}',
    '#henna-minicart .mc-head{display:flex;align-items:center;justify-content:space-between;padding:18px 20px 10px}',
    '#henna-minicart .mc-titre{font:600 22px/1.2 "Cormorant Garamond",serif}',
    '#henna-minicart .mc-x{border:none;background:transparent;font-size:28px;line-height:1;cursor:pointer;color:#241A14;padding:4px 8px;margin-right:-8px}',
    '#henna-minicart .mc-body{overflow-y:auto;-webkit-overflow-scrolling:touch;padding:0 20px;flex:1 1 auto;min-height:0}',
    '#henna-minicart .mc-ligne{padding:12px 0;border-top:1px solid rgba(36,26,20,.1)}',
    '#henna-minicart .mc-haut{display:flex;justify-content:space-between;gap:12px}',
    '#henna-minicart .mc-nom{font-weight:500;line-height:1.35;min-width:0}',
    '#henna-minicart .mc-opt{font-size:12.5px;font-weight:400;color:rgba(36,26,20,.6)}',
    '#henna-minicart .mc-prix{font:600 18px/1.3 "Cormorant Garamond",serif;color:#A8542A;white-space:nowrap}',
    '#henna-minicart .mc-ctrl{display:flex;align-items:center;gap:10px;margin-top:8px}',
    '#henna-minicart .mc-ctrl button.mc-b{width:32px;height:32px;border:1px solid rgba(36,26,20,.22);border-radius:50%;background:transparent;color:#241A14;font-size:18px;line-height:1;cursor:pointer;padding:0;font-family:inherit}',
    '#henna-minicart .mc-qte{min-width:24px;text-align:center;font-size:15px}',
    '#henna-minicart .mc-ret{margin-left:auto;border:none;background:transparent;color:#A8542A;text-decoration:underline;font-size:13px;cursor:pointer;font-family:inherit;padding:8px 2px}',
    '#henna-minicart .mc-foot{padding:12px 20px 20px;border-top:1px solid rgba(36,26,20,.14);font-size:14px;color:rgba(36,26,20,.78)}',
    '#henna-minicart .mc-l{display:flex;justify-content:space-between}',
    '#henna-minicart .mc-tot{margin-top:6px;font:600 21px/1.3 "Cormorant Garamond",serif;color:#241A14}',
    '#henna-minicart .mc-valider{display:block;text-align:center;margin-top:14px;background:#241A14;color:#FBF4EB;padding:15px;border-radius:999px;font-size:12.5px;letter-spacing:.12em;text-transform:uppercase;text-decoration:none}',
    '#henna-minicart .mc-vide{margin:6px 0 4px;text-align:center;color:rgba(36,26,20,.72)}',
    '#henna-minicart .mc-dec{display:block;text-align:center;margin:14px 0 22px;font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:#A8542A;text-decoration:underline}',
    '#henna-minicart-veil{position:fixed;inset:0;z-index:119;background:rgba(36,26,20,.42);display:none}',
    '@media (max-width:600px){',
    '#henna-minicart{left:0!important;right:0!important;top:auto!important;bottom:0!important;width:auto;max-height:88vh;max-height:88dvh;',
    'border-radius:24px 24px 0 0;border-bottom:none;padding-bottom:env(safe-area-inset-bottom)}',
    '#henna-minicart .mc-head{padding:20px 20px 10px}',
    '#henna-minicart .mc-titre{font-size:26px}',
    '#henna-minicart .mc-nom{font-size:16px}',
    '#henna-minicart .mc-prix{font-size:20px}',
    '#henna-minicart .mc-ctrl{gap:14px;margin-top:10px}',
    '#henna-minicart .mc-ctrl button.mc-b{width:42px;height:42px;font-size:22px}',
    '#henna-minicart .mc-qte{font-size:17px;min-width:28px}',
    '#henna-minicart .mc-ret{font-size:14.5px;padding:12px 4px}',
    '#henna-minicart .mc-foot{font-size:15px;padding:14px 20px calc(18px + env(safe-area-inset-bottom))}',
    '#henna-minicart .mc-tot{font-size:24px}',
    '#henna-minicart .mc-valider{padding:18px;font-size:13.5px}',
    '#henna-minicart .mc-vide{font-size:16px;margin-top:14px}',
    '}'
  ].join('');

  function isPhone() { return !!(window.matchMedia && window.matchMedia('(max-width:600px)').matches); }
  function isOpen() { return !!panel && panel.style.display !== 'none'; }

  function ensurePanel() {
    if (panel) return panel;
    var st = document.createElement('style');
    st.textContent = CSS;
    document.head.appendChild(st);
    veil = document.createElement('div');
    veil.id = 'henna-minicart-veil';
    document.body.appendChild(veil);
    panel = document.createElement('div');
    panel.id = 'henna-minicart';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', 'Mon panier');
    document.body.appendChild(panel);
    panel.addEventListener('click', onPanelClick);
    return panel;
  }

  function place() {
    if (!panel) return;
    veil.style.display = isPhone() ? 'block' : 'none';
    if (isPhone()) {                    // le volet est ancré en bas par la feuille de style
      panel.style.top = panel.style.right = panel.style.maxHeight = '';
      return;
    }
    if (!anchor) return;
    var r = anchor.getBoundingClientRect();
    var top = Math.max(8, r.bottom + 10);
    var right = Math.max(10, window.innerWidth - r.right);
    panel.style.top = top + 'px';
    panel.style.right = right + 'px';
    panel.style.maxHeight = Math.max(220, window.innerHeight - top - 14) + 'px';
  }

  function renderPanel() {
    if (!panel) return;
    var c = compute();
    var h = '<div class="mc-head"><span class="mc-titre">Mon panier</span>' +
      '<button type="button" class="mc-x" data-mc="close" aria-label="Fermer">×</button></div>';

    if (!c.count) {
      h += '<div class="mc-body"><p class="mc-vide">Votre panier est vide.</p>' +
        '<a class="mc-dec" href="index.html#produits" data-mc="close">Découvrir nos produits</a></div>';
    } else {
      h += '<div class="mc-body">';
      c.lines.forEach(function (l) {
        h += '<div class="mc-ligne" data-key="' + esc(l.key) + '">' +
          '<div class="mc-haut">' +
            '<div class="mc-nom">' + esc(shortLabel(l.label)) +
              (l.oilChoice ? '<div class="mc-opt">' + (l.oil === 'avec' ? 'Avec' : 'Sans') + ' huile essentielle</div>' : '') +
            '</div>' +
            '<div class="mc-prix">' + euro(l.total) + '</div>' +
          '</div>' +
          '<div class="mc-ctrl">' +
            '<button type="button" class="mc-b" data-mc="moins" aria-label="Diminuer la quantité">−</button>' +
            '<span class="mc-qte">' + l.qty + '</span>' +
            '<button type="button" class="mc-b" data-mc="plus" aria-label="Augmenter la quantité">+</button>' +
            '<button type="button" class="mc-ret" data-mc="retirer">Retirer</button>' +
          '</div></div>';
      });
      h += '</div><div class="mc-foot">' +
        '<div class="mc-l"><span>Sous-total</span><span>' + euro(c.subtotal) + '</span></div>' +
        '<div class="mc-l"><span>Livraison</span><span>' + (c.shipping.tier === 'location' ? 'À convenir' : c.shipping.free ? 'Offerte' : euro(c.shipping.fee)) + '</span></div>' +
        '<div class="mc-l mc-tot"><span>Total</span><span>' + euro(c.total) + '</span></div>' +
        '<a class="mc-valider" href="commande.html">Valider ma commande</a></div>';
    }
    panel.innerHTML = h;
  }

  function onPanelClick(e) {
    var b = e.target.closest ? e.target.closest('[data-mc]') : null;
    if (!b) return;
    var act = b.getAttribute('data-mc');
    if (act === 'close') { closePanel(); return; }
    var row = b.closest('[data-key]');
    if (!row) return;
    var key = row.getAttribute('data-key');
    var line = compute().lines.filter(function (l) { return l.key === key; })[0];
    if (!line) return;
    var res = { ok: true };
    if (act === 'plus') res = setQty(key, line.qty + 1);
    if (act === 'moins') res = setQty(key, line.qty - 1);
    if (act === 'retirer') remove(key);
    if (res && !res.ok && res.reason) toast(res.reason, true);
  }

  function openPanel(src) {
    // depuis le message de confirmation ou le menu mobile, on ancre sous le bouton Panier de l'en-tête
    var el = src;
    var links = document.querySelectorAll('[data-cart-link]');
    var header = null;
    for (var i = 0; i < links.length; i++) {
      if (links[i].closest('#henna-toast')) continue;
      if (links[i].getClientRects().length && links[i].closest('header')) { header = links[i]; break; }
    }
    if (header) el = header;
    anchor = el;
    ensurePanel();
    var t = document.getElementById('henna-toast');
    if (t) t.style.opacity = '0';
    renderPanel();
    panel.style.display = 'flex';
    place();
  }

  function closePanel() { if (panel) { panel.style.display = 'none'; veil.style.display = 'none'; } }

  document.addEventListener('click', function (e) {
    var t = e.target;
    while (t && t !== document && !(t.hasAttribute && t.hasAttribute('data-cart-link'))) t = t.parentNode;
    if (t && t !== document) {
      e.preventDefault();
      if (isOpen() && !t.closest('#henna-toast')) closePanel(); else openPanel(t);
      return;
    }
    if (isOpen() && !(panel.contains(e.target))) closePanel();
  }, true);   // phase de capture : fonctionne même dans le menu mobile, qui bloque la propagation des clics
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closePanel(); });
  window.addEventListener('resize', function () { if (isOpen()) place(); });
  window.addEventListener('henna-cart-change', function () { if (isOpen()) { renderPanel(); place(); } });

  /* La page d'accueil est dessinée après le chargement (runtime « dc ») :
     on surveille donc l'arrivée des pastilles pour les remplir. */
  var scheduled = false;
  function scheduleBadges() {
    if (scheduled) return;
    scheduled = true;
    setTimeout(function () { scheduled = false; updateBadges(); }, 60);
  }
  try {
    new MutationObserver(scheduleBadges).observe(document.documentElement, { childList: true, subtree: true });
  } catch (e) {}
  document.addEventListener('DOMContentLoaded', updateBadges);
  window.addEventListener('storage', function (e) { if (e.key === KEY) updateBadges(); });
  window.addEventListener('pageshow', updateBadges);

  window.HennaCart = {
    get: get, compute: compute, add: add, setQty: setQty, setOil: setOil,
    remove: remove, clear: clear, count: count, toast: toast,
    powderMax: POWDER_MAX, lineMax: LINE_MAX
  };
})();
