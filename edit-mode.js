/* ============================================================================
   Henna by Inès — Mode édition directement sur les pages du site
   ----------------------------------------------------------------------------
   Chargé par site-data.js UNIQUEMENT quand l'administratrice est connectée
   (session créée par admin.html) ET a ouvert la page avec « ?edit ».
   Les visiteurs ne téléchargent jamais ce fichier.

   Accueil   : clic sur un texte, une photo ou un prix -> modifier / rétablir ;
               galerie de réalisations : ajouter, remplacer, légender, ordonner, supprimer.
   Location  : sur chaque carte -> modifier, supprimer, déplacer ; ajouter un article.
   ========================================================================== */
(function () {
  'use strict';
  if (window.__hennaEdit) return;
  window.__hennaEdit = true;

  var CFG = window.HENNA_CONFIG || {};
  var DB = window.HennaDB;
  var SITE = window.HennaSite;
  if (!DB || !DB.enabled || !SITE) return;

  var SKEY = 'henna_admin_session', EKEY = 'henna_edit';
  var esc = SITE.esc;
  var root = document.documentElement;
  var IS_LOC = !!document.getElementById('galerie') && !!document.getElementById('filtres');

  /* ====================================================================== */
  /*  Session (créée par admin.html)                                         */
  /* ====================================================================== */
  function getSession() { try { return JSON.parse(localStorage.getItem(SKEY) || 'null'); } catch (e) { return null; } }
  function setSession(s) { try { s ? localStorage.setItem(SKEY, JSON.stringify(s)) : localStorage.removeItem(SKEY); } catch (e) {} }
  if (!getSession()) return;

  function quit(reload) {
    try { sessionStorage.removeItem(EKEY); } catch (e) {}
    if (reload !== false) location.reload();
  }

  function refreshSession(rt) {
    return fetch(DB.url + '/auth/v1/token?grant_type=refresh_token', {
      method: 'POST', headers: { apikey: DB.key, 'Content-Type': 'application/json' }, body: JSON.stringify({ refresh_token: rt })
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (!r.ok) throw new Error(j.error_description || j.msg || ('Erreur ' + r.status));
        var s = { access_token: j.access_token, refresh_token: j.refresh_token,
          expires_at: Date.now() + (j.expires_in || 3600) * 1000, email: (j.user && j.user.email) || '' };
        setSession(s);
        return s;
      });
    });
  }

  function token() {
    var s = getSession();
    if (!s) return Promise.reject(new Error('Session expirée : reconnectez-vous depuis l\'espace administrateur.'));
    if (s.expires_at - Date.now() > 60000) return Promise.resolve(s.access_token);
    return refreshSession(s.refresh_token).then(function (n) { return n.access_token; }, function (e) {
      setSession(null); quit(false);
      toast('Session expirée : reconnectez-vous depuis l\'espace administrateur.', true);
      setTimeout(function () { location.href = 'admin.html'; }, 1800);
      throw e;
    });
  }

  function db(method, path, json, prefer) {
    return token().then(function (t) {
      return DB.rest(method, path, { token: t, json: json, headers: prefer ? { Prefer: prefer } : undefined });
    });
  }

  function explain(e) {
    var m = (e && e.message) || String(e);
    if (e && (e.status === 404 || /relation .* does not exist|PGRST205|Could not find the table/i.test(m)))
      return 'La base n\'est pas prête : exécutez d\'abord supabase-setup.sql (voir ADMIN-SETUP.md).';
    if (e && (e.status === 401 || e.status === 403 || /row-level security|JWT/i.test(m)))
      return 'Modification refusée : reconnectez-vous depuis l\'espace administrateur.';
    if (/Failed to fetch|NetworkError/i.test(m)) return 'Connexion impossible. Vérifiez votre accès internet puis réessayez.';
    return m;
  }

  /* ====================================================================== */
  /*  Styles (tout est préfixé « hm- » pour ne rien mélanger avec le site)   */
  /* ====================================================================== */
  var css = [
    /* repères sur la page */
    'html.hm-on [data-edit],html.hm-on [data-price]{outline:2px dashed rgba(168,84,42,.6);outline-offset:3px;border-radius:4px;cursor:pointer}',
    'html.hm-on [data-edit]:hover,html.hm-on [data-price]:hover{outline-style:solid;background:rgba(197,139,62,.16)}',
    'html.hm-on img[data-img],html.hm-on [data-gallery] img{outline:3px dashed rgba(168,84,42,.65);outline-offset:-3px;cursor:pointer}',
    'html.hm-on img[data-img]:hover,html.hm-on [data-gallery] img:hover{outline-style:solid}',
    'html.hm-on body{padding-bottom:92px}',
    'html.hm-on #galerie .carte{position:relative}',
    '.hm-add[hidden]{display:none!important}',
    'html.hm-on #galerie .nbphotos{top:auto;bottom:12px}',
    /* barre */
    '.hm-bar{position:fixed;left:50%;bottom:14px;transform:translateX(-50%);z-index:2147483000;max-width:calc(100vw - 20px);display:flex;align-items:center;gap:10px;flex-wrap:wrap;justify-content:center;',
    'background:#241A14;color:#FBF4EB;border-radius:22px;padding:10px 12px 10px 18px;box-shadow:0 12px 36px rgba(0,0,0,.35);font:400 14px/1.35 Jost,system-ui,sans-serif}',
    '.hm-bar strong{font-weight:500;white-space:nowrap}',
    '.hm-dot{width:9px;height:9px;border-radius:50%;background:#C58B3E;display:inline-block;margin-right:8px;box-shadow:0 0 0 4px rgba(197,139,62,.3)}',
    '.hm-hint{opacity:.75;font-size:13px}',
    '.hm-b{display:inline-flex;align-items:center;justify-content:center;border:1px solid rgba(251,244,235,.35);background:transparent;color:#FBF4EB;border-radius:999px;padding:8px 14px;',
    'font:500 12px/1 Jost,system-ui,sans-serif;letter-spacing:.08em;text-transform:uppercase;cursor:pointer;text-decoration:none;white-space:nowrap}',
    '.hm-b:hover{background:#FBF4EB;color:#241A14}',
    '.hm-b.hm-q{background:#A8542A;border-color:#A8542A}',
    '.hm-b.hm-q:hover{background:#FBF4EB;color:#241A14}',
    /* barres d\'ajout et boutons de cartes */
    '.hm-addbar{display:flex;gap:10px;flex-wrap:wrap;margin:14px 0 18px}',
    '.hm-add{display:inline-flex;align-items:center;gap:8px;border:2px dashed #A8542A;background:rgba(251,244,235,.92);color:#A8542A;border-radius:999px;padding:11px 20px;',
    'font:500 14px/1 Jost,system-ui,sans-serif;cursor:pointer}',
    '.hm-add:hover{background:#A8542A;color:#FBF4EB}',
    '.hm-card-bar{position:absolute;left:8px;top:8px;z-index:6;display:flex;gap:5px;flex-wrap:wrap;max-width:calc(100% - 16px)}',
    '.hm-card-bar button{height:34px;min-width:34px;padding:0 10px;border:0;border-radius:999px;background:rgba(251,244,235,.96);color:#241A14;cursor:pointer;',
    'font:500 13px/1 Jost,system-ui,sans-serif;box-shadow:0 2px 8px rgba(0,0,0,.25)}',
    '.hm-card-bar button:hover{background:#A8542A;color:#fff}',
    '.hm-card-bar button.hm-del:hover{background:#9B2C1F}',
    '.hm-card-bar button[disabled]{opacity:.35;cursor:default}',
    /* modale */
    '.hm-veil{position:fixed;inset:0;z-index:2147483100;background:rgba(36,26,20,.6);display:flex;align-items:center;justify-content:center;padding:18px;',
    'font:400 16px/1.5 Jost,system-ui,sans-serif;color:#241A14}',
    '.hm-veil[hidden]{display:none!important}',
    '.hm-veil *{box-sizing:border-box}',
    '.hm-modal{background:#FBF4EB;border-radius:24px;width:100%;max-width:640px;max-height:92vh;max-height:92dvh;display:flex;flex-direction:column;box-shadow:0 30px 80px rgba(0,0,0,.4)}',
    '.hm-mh{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:22px 26px 6px}',
    '.hm-mh h2{font:600 26px/1.2 "Cormorant Garamond",serif;margin:0}',
    '.hm-mx{border:0;background:transparent;font-size:30px;line-height:1;cursor:pointer;padding:4px 10px;margin-right:-10px;color:#241A14}',
    '.hm-mb{padding:10px 26px 6px;overflow-y:auto;-webkit-overflow-scrolling:touch}',
    '.hm-mf{display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap;padding:16px 26px 22px;border-top:1px solid rgba(36,26,20,.1)}',
    '.hm-mf .hm-left{margin-right:auto}',
    '.hm-btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;border:1px solid #241A14;background:#241A14;color:#FBF4EB;border-radius:999px;padding:12px 20px;',
    'font:500 13px/1 Jost,system-ui,sans-serif;letter-spacing:.08em;text-transform:uppercase;cursor:pointer;white-space:nowrap}',
    '.hm-btn:hover{background:#A8542A;border-color:#A8542A}',
    '.hm-btn.sec{background:transparent;color:#241A14;border-color:rgba(36,26,20,.3)}',
    '.hm-btn.sec:hover{background:rgba(168,84,42,.1);border-color:#A8542A}',
    '.hm-btn.danger{background:transparent;color:#9B2C1F;border-color:rgba(155,44,31,.4)}',
    '.hm-btn.danger:hover{background:#9B2C1F;color:#fff;border-color:#9B2C1F}',
    '.hm-btn[disabled]{opacity:.55;cursor:default;pointer-events:none}',
    '.hm-field{display:block;margin-bottom:16px;font-size:13px;letter-spacing:.06em;text-transform:uppercase;color:rgba(36,26,20,.65)}',
    '.hm-field input,.hm-field select,.hm-field textarea{display:block;width:100%;margin-top:6px;padding:13px 15px;border:1px solid rgba(36,26,20,.22);border-radius:12px;background:#fff;',
    'font:400 16px/1.4 Jost,system-ui,sans-serif;letter-spacing:0;text-transform:none;color:#241A14}',
    '.hm-field input:focus,.hm-field select:focus,.hm-field textarea:focus{outline:2px solid #A8542A;outline-offset:1px}',
    '.hm-field textarea{resize:vertical;min-height:120px}',
    '.hm-help{font-size:13px;color:rgba(36,26,20,.6);margin:-8px 0 16px}',
    '.hm-help code{background:#F0E4D3;border-radius:6px;padding:1px 7px}',
    '.hm-veil details{margin:0 0 14px;font-size:14px}',
    '.hm-veil summary{cursor:pointer;color:#A8542A}',
    '.hm-veil details p{margin:8px 0 0;padding:10px 14px;background:#fff;border-radius:10px;white-space:pre-line;color:rgba(36,26,20,.75)}',
    '.hm-preview{display:block;max-width:100%;max-height:300px;margin:6px auto 16px;border-radius:12px;border:1px solid rgba(36,26,20,.12);object-fit:contain;background:#EFE6D8}',
    '.hm-drop{display:flex;flex-direction:column;align-items:center;gap:6px;border:2px dashed rgba(168,84,42,.5);border-radius:16px;padding:20px 16px;text-align:center;cursor:pointer;background:rgba(255,255,255,.6);margin-bottom:14px}',
    '.hm-drop:hover,.hm-drop.on{background:rgba(168,84,42,.08);border-color:#A8542A}',
    '.hm-drop strong{font-weight:500}',
    '.hm-drop span{font-size:13px;color:rgba(36,26,20,.6)}',
    '.hm-drop input{display:none}',
    '.hm-thumbs{display:grid;grid-template-columns:repeat(auto-fill,minmax(92px,1fr));gap:10px;margin-bottom:16px}',
    '.hm-th{position:relative;aspect-ratio:4/5;border-radius:10px;overflow:hidden;background:#EFE6D8;border:1px solid rgba(36,26,20,.12)}',
    '.hm-th img{width:100%;height:100%;object-fit:cover;display:block}',
    '.hm-th .hm-cv{position:absolute;left:4px;bottom:4px;background:#241A14;color:#FBF4EB;font-size:10px;letter-spacing:.06em;text-transform:uppercase;border-radius:999px;padding:1px 8px}',
    '.hm-th .hm-acts{position:absolute;right:3px;top:3px;display:flex;flex-direction:column;gap:3px}',
    '.hm-th .hm-acts button{width:26px;height:26px;border-radius:50%;border:0;background:rgba(251,244,235,.94);cursor:pointer;font-size:13px;line-height:1;padding:0}',
    '.hm-two{display:grid;grid-template-columns:1fr 1fr;gap:14px}',
    '.hm-check{display:flex;align-items:center;gap:10px;margin:2px 0 16px;font-size:15px;cursor:pointer}',
    '.hm-check input{width:20px;height:20px;accent-color:#A8542A}',
    '.hm-prog{height:6px;border-radius:999px;background:rgba(36,26,20,.12);overflow:hidden;margin:0 0 14px}',
    '.hm-prog i{display:block;height:100%;width:0;background:#A8542A;transition:width .25s}',
    '.hm-row{display:flex;align-items:center;gap:12px;background:#fff;border:1px solid rgba(36,26,20,.1);border-radius:14px;padding:10px 14px;margin-bottom:8px}',
    '.hm-row span{flex:1;min-width:0;overflow-wrap:anywhere}',
    '#hm-toast{position:fixed;left:50%;bottom:96px;transform:translateX(-50%);z-index:2147483200;max-width:min(92vw,460px);padding:13px 22px;border-radius:999px;background:#241A14;color:#FBF4EB;',
    'font:400 14.5px/1.4 Jost,system-ui,sans-serif;box-shadow:0 10px 30px rgba(36,26,20,.3);opacity:0;pointer-events:none;transition:opacity .25s;text-align:center}',
    '#hm-toast.on{opacity:1}',
    '#hm-toast.err{background:#9B2C1F}',
    '@media (max-width:640px){',
    ' .hm-hint,.hm-lg{display:none}',
    ' .hm-bar{left:8px;right:8px;transform:none;max-width:none;bottom:10px;flex-wrap:nowrap;justify-content:space-between;padding:8px 8px 8px 12px;gap:6px;border-radius:18px}',
    ' html.hm-home .hm-bar{bottom:84px}',
    ' .hm-b{padding:9px 11px;font-size:11px;letter-spacing:.05em}',
    ' .hm-bar strong{font-size:13px;text-transform:capitalize}',
    ' .hm-dot{margin-right:6px}',
    ' #hm-toast{bottom:150px}',
    ' html.hm-on #galerie .nbphotos{display:none}',
    ' .hm-veil{padding:0;align-items:flex-end}',
    ' .hm-modal{max-width:none;border-radius:24px 24px 0 0;max-height:94vh;max-height:94dvh}',
    ' .hm-mh{padding:18px 18px 4px}.hm-mb{padding:8px 18px 4px}',
    ' .hm-mf{padding:14px 18px calc(18px + env(safe-area-inset-bottom))}',
    ' .hm-mf .hm-btn{flex:1 1 auto}',
    ' .hm-two{grid-template-columns:1fr}',
    '}'
  ].join('\n');
  var st = document.createElement('style');
  st.textContent = css;
  document.head.appendChild(st);
  root.classList.add('hm-on');
  if (!IS_LOC) root.classList.add('hm-home');

  /* ====================================================================== */
  /*  Utilitaires d'interface                                                */
  /* ====================================================================== */
  var toastEl = document.createElement('div');
  toastEl.id = 'hm-toast'; toastEl.className = 'hm-ui'; toastEl.setAttribute('role', 'status');
  document.body.appendChild(toastEl);
  var toastTimer;
  function toast(msg, isErr) {
    toastEl.textContent = msg;
    toastEl.className = 'hm-ui on' + (isErr ? ' err' : '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.className = 'hm-ui'; }, isErr ? 5200 : 2800);
  }

  function slug(s) {
    return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'article';
  }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function euro(n) { return SITE.formatPrice(n); }

  var overlay = document.createElement('div');
  overlay.className = 'hm-ui hm-veil'; overlay.hidden = true;
  document.body.appendChild(overlay);
  var modalCleanup = null;

  function $q(sel) { return overlay.querySelector(sel); }

  function closeModal() {
    overlay.hidden = true; overlay.innerHTML = '';
    document.body.style.overflow = '';
    if (modalCleanup) { var c = modalCleanup; modalCleanup = null; c(); }
  }

  // opts : { title, body (html), buttons:[{label, kind, left, action(btn)}], onOpen(root) }
  function openModal(opts) {
    if (!overlay.hidden) closeModal();
    overlay.innerHTML = '<div class="hm-modal" role="dialog" aria-modal="true" aria-label="' + esc(opts.title) + '">' +
      '<div class="hm-mh"><h2>' + esc(opts.title) + '</h2><button type="button" class="hm-mx" aria-label="Fermer" data-close>×</button></div>' +
      '<div class="hm-mb">' + opts.body + '</div>' +
      '<div class="hm-mf">' + (opts.buttons || []).map(function (b, i) {
        return '<button type="button" class="hm-btn ' + (b.kind || '') + (b.left ? ' hm-left' : '') + '" data-bi="' + i + '">' + esc(b.label) + '</button>';
      }).join('') + '</div></div>';
    overlay.hidden = false;
    document.body.style.overflow = 'hidden';

    overlay.onclick = function (e) {
      if (e.target === overlay || (e.target.closest && e.target.closest('[data-close]'))) { closeModal(); return; }
      var bt = e.target.closest && e.target.closest('[data-bi]');
      if (!bt || bt.disabled) return;
      var b = opts.buttons[+bt.getAttribute('data-bi')];
      var label = bt.textContent;
      bt.disabled = true; bt.textContent = 'Un instant…';
      Promise.resolve().then(function () { return b.action(bt); }).then(function (keep) {
        if (keep === false) { bt.disabled = false; bt.textContent = label; return; }
        closeModal();
      }, function (err) {
        bt.disabled = false; bt.textContent = label;
        toast(explain(err), true);
      });
    };
    var onKey = function (e) { if (e.key === 'Escape') closeModal(); };
    document.addEventListener('keydown', onKey);
    modalCleanup = function () { document.removeEventListener('keydown', onKey); };
    if (opts.onOpen) opts.onOpen(overlay);
    var first = overlay.querySelector('input:not([type=file]),textarea,select');
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

  function dropzone(multiple) {
    return '<label class="hm-drop" data-drop><strong>' + (multiple ? 'Choisir des photos' : 'Choisir une photo') + '</strong>' +
      '<span>' + (multiple ? 'ou les déposer ici' : 'ou la déposer ici') + ' · JPG, PNG ou WebP</span>' +
      '<input type="file" accept="image/*"' + (multiple ? ' multiple' : '') + ' data-file></label>';
  }
  function wireDrop(rootEl, onFiles) {
    var z = rootEl.querySelector('[data-drop]'), inp = rootEl.querySelector('[data-file]');
    if (!z) return;
    inp.addEventListener('change', function () { if (inp.files.length) onFiles([].slice.call(inp.files)); inp.value = ''; });
    ['dragenter', 'dragover'].forEach(function (ev) { z.addEventListener(ev, function (e) { e.preventDefault(); z.classList.add('on'); }); });
    ['dragleave', 'drop'].forEach(function (ev) { z.addEventListener(ev, function (e) { e.preventDefault(); z.classList.remove('on'); }); });
    z.addEventListener('drop', function (e) {
      var fl = [].slice.call(e.dataTransfer.files).filter(function (f) { return /^image\//.test(f.type); });
      if (fl.length) onFiles(fl);
    });
  }

  /* ====================================================================== */
  /*  Photos : redimensionnement dans le navigateur + envoi au stockage      */
  /* ====================================================================== */
  function loadBitmap(file) {
    var viaImg = function () {
      return new Promise(function (res, rej) {
        var u = URL.createObjectURL(file), im = new Image();
        im.onload = function () { res(im); };
        im.onerror = function () { rej(new Error('Photo illisible (utilisez un JPG, PNG ou WebP).')); };
        im.src = u;
      });
    };
    if (window.createImageBitmap) return createImageBitmap(file, { imageOrientation: 'from-image' }).catch(viaImg);
    return viaImg();
  }
  function jpeg(canvas, q) { return new Promise(function (res) { canvas.toBlob(res, 'image/jpeg', q); }); }
  function fitJpeg(file, max, q) {
    return loadBitmap(file).then(function (b) {
      var w = b.width || b.naturalWidth, h = b.height || b.naturalHeight, k = Math.min(1, max / Math.max(w, h));
      var c = document.createElement('canvas'); c.width = Math.round(w * k); c.height = Math.round(h * k);
      var x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(b, 0, 0, c.width, c.height);
      return jpeg(c, q);
    });
  }
  function coverJpeg(file, W, H, q) {
    return loadBitmap(file).then(function (b) {
      var w = b.width || b.naturalWidth, h = b.height || b.naturalHeight, k = Math.max(W / w, H / h);
      var c = document.createElement('canvas'); c.width = W; c.height = H;
      var x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, W, H);
      x.drawImage(b, (W - w * k) / 2, (H - h * k) / 2, w * k, h * k);
      return jpeg(c, q);
    });
  }
  function upload(path, blob) {
    return token().then(function (t) {
      return fetch(DB.url + '/storage/v1/object/' + DB.bucket + '/' + path, {
        method: 'POST',
        headers: { apikey: DB.key, Authorization: 'Bearer ' + t, 'x-upsert': 'true', 'Content-Type': blob.type || 'image/jpeg', 'cache-control': 'max-age=31536000' },
        body: blob
      });
    }).then(function (r) {
      if (!r.ok) return r.text().then(function (t) { var e = new Error('Envoi de la photo refusé (' + r.status + ') ' + t.slice(0, 160)); e.status = r.status; throw e; });
      return DB.publicUrl(path);
    });
  }
  // Supprime un fichier du stockage seulement s'il y a été envoyé depuis l'espace admin.
  function removeFile(url) {
    var pre = DB.publicUrl('');
    if (typeof url !== 'string' || url.indexOf(pre) !== 0) return Promise.resolve();
    return token().then(function (t) {
      return fetch(DB.url + '/storage/v1/object/' + DB.bucket + '/' + url.slice(pre.length), {
        method: 'DELETE', headers: { apikey: DB.key, Authorization: 'Bearer ' + t }
      });
    }).catch(function () {});
  }
  function sendMany(files, onEach) {
    var bar = $q('#hm-prog'), done = 0;
    return files.reduce(function (p, f, i) {
      return p.then(function () { return onEach(f, i); }).then(function () {
        done++; if (bar) bar.style.width = Math.round(done / files.length * 100) + '%';
      });
    }, Promise.resolve());
  }

  /* ====================================================================== */
  /*  Données (lues avec le jeton de l'administratrice)                      */
  /* ====================================================================== */
  var S = { content: {}, rentals: [], gallery: [], doc: null, ready: false };

  function pushToSite() { SITE.setData({ content: S.content, rentals: S.rentals, gallery: S.gallery }); }

  function loadAll() {
    return Promise.all([
      db('GET', 'site_content?select=key,value'),
      db('GET', 'rentals?select=*&order=position.asc,name.asc'),
      db('GET', 'gallery?select=*&order=position.asc,id.asc')
    ]).then(function (r) {
      S.content = {};
      (r[0] || []).forEach(function (x) { S.content[x.key] = x.value; });
      S.rentals = r[1] || [];
      S.gallery = r[2] || [];
      S.ready = true;
    });
  }
  function reloadTable(t) {
    var q = t === 'rentals' ? 'rentals?select=*&order=position.asc,name.asc' : 'gallery?select=*&order=position.asc,id.asc';
    return db('GET', q).then(function (rows) { S[t] = rows || []; pushToSite(); });
  }

  // Version d'origine de index.html : sert à « Rétablir l'original » et à importer la galerie d'origine.
  function getDoc() {
    if (S.doc) return Promise.resolve(S.doc);
    return fetch('index.html?v=' + Date.now()).then(function (r) { return r.text(); }).then(function (t) {
      S.doc = new DOMParser().parseFromString(t, 'text/html');
      return S.doc;
    });
  }

  function setContent(key, value, def) {
    if (value == null || value === '' || value === def) {
      return db('DELETE', 'site_content?key=eq.' + encodeURIComponent(key)).then(function () { delete S.content[key]; pushToSite(); });
    }
    return db('POST', 'site_content?on_conflict=key', [{ key: key, value: String(value), updated_at: new Date().toISOString() }],
      'resolution=merge-duplicates,return=minimal').then(function () { S.content[key] = String(value); pushToSite(); });
  }

  /* ====================================================================== */
  /*  Accueil : textes                                                       */
  /* ====================================================================== */
  var GROUPES = {
    hdr: 'En-tête', hero: 'Accueil — bandeau', presta: 'Prestations henné', real: 'Réalisations',
    cones: 'Produits — cônes', poudre: 'Produits — poudre', loc: 'Location & articles personnalisés',
    histoire: 'Mon histoire', resa: 'Réservation', contact: 'Contact', pied: 'Pied de page'
  };
  var TYPES = { h1: 'Titre', h2: 'Titre', h3: 'Sous-titre', p: 'Paragraphe', li: 'Liste', span: 'Texte court', div: 'Texte court' };

  function editText(key) {
    getDoc().then(function (doc) {
      var el = doc.querySelector('[data-edit="' + key.replace(/"/g, '\\"') + '"]');
      if (!el) { toast('Ce texte n\'est pas modifiable.', true); return; }
      var def = SITE.fromEl(el);
      var type = TYPES[el.tagName.toLowerCase()] || 'Texte';
      var group = GROUPES[key.split('.')[0]] || '';
      var modified = S.content['text.' + key] != null;
      var cur = modified ? S.content['text.' + key] : def;
      var rows = Math.max(3, Math.min(14, Math.ceil(cur.length / 60) + (cur.split('\n').length - 1)));
      var buttons = [];
      if (modified) buttons.push({ label: 'Rétablir l\'original', kind: 'danger', left: true, action: function () {
        return setContent('text.' + key, null).then(function () { toast('Texte d\'origine rétabli.'); });
      } });
      buttons.push({ label: 'Annuler', kind: 'sec', action: function () {} });
      buttons.push({ label: 'Enregistrer', action: function () {
        var v = $q('#hm-texte').value.replace(/\r/g, '').trim();
        if (!v) { toast('Le texte ne peut pas être vide.', true); return false; }
        return setContent('text.' + key, v, def).then(function () { toast('Texte enregistré.'); });
      } });
      openModal({
        title: type + (group ? ' · ' + group : ''),
        body: '<label class="hm-field">Votre texte<textarea id="hm-texte" rows="' + rows + '">' + esc(cur) + '</textarea></label>' +
          '<p class="hm-help">Pour mettre un mot en <strong>gras</strong>, entourez-le de deux étoiles : <code>**mot**</code>. Un retour à la ligne reste un retour à la ligne.</p>' +
          (modified ? '<details><summary>Voir le texte d\'origine</summary><p>' + esc(def) + '</p></details>' : ''),
        buttons: buttons
      });
    }).catch(function (e) { toast(explain(e), true); });
  }

  /* ====================================================================== */
  /*  Accueil : photos du site                                               */
  /* ====================================================================== */
  function replaceImage(key) {
    getDoc().then(function (doc) {
      var d = doc.querySelector('img[data-img="' + key.replace(/"/g, '\\"') + '"]');
      var def = d ? d.getAttribute('src') : '';
      var alt = d ? (d.getAttribute('alt') || key) : key;
      var cur = S.content['img.' + key], chosen = null, buttons = [];
      if (cur) buttons.push({ label: 'Rétablir l\'originale', kind: 'danger', left: true, action: function () {
        return db('DELETE', 'site_content?key=eq.' + encodeURIComponent('img.' + key)).then(function () {
          delete S.content['img.' + key]; pushToSite(); removeFile(cur); toast('Photo d\'origine rétablie.');
        });
      } });
      buttons.push({ label: 'Annuler', kind: 'sec', action: function () {} });
      buttons.push({ label: 'Enregistrer', action: function () {
        if (!chosen) { toast('Choisissez d\'abord une photo.', true); return false; }
        return fitJpeg(chosen, 1600, 0.85).then(function (blob) {
          return upload('site/' + slug(key) + '-' + uid() + '.jpg', blob);
        }).then(function (url) {
          return db('POST', 'site_content?on_conflict=key', [{ key: 'img.' + key, value: url, updated_at: new Date().toISOString() }],
            'resolution=merge-duplicates,return=minimal').then(function () {
            S.content['img.' + key] = url; pushToSite(); if (cur) removeFile(cur);
            toast('Photo remplacée.');
          });
        });
      } });
      openModal({
        title: 'Remplacer la photo',
        body: '<p style="margin:0 0 8px;font-size:14.5px;color:rgba(36,26,20,.7)">' + esc(alt) + '</p>' +
          '<img class="hm-preview" id="hm-apercu" src="' + esc(cur || def) + '" alt="">' + dropzone(false),
        buttons: buttons,
        onOpen: function (r) { wireDrop(r, function (files) { chosen = files[0]; $q('#hm-apercu').src = URL.createObjectURL(chosen); }); }
      });
    }).catch(function (e) { toast(explain(e), true); });
  }

  /* ====================================================================== */
  /*  Accueil : prix et noms des produits                                    */
  /* ====================================================================== */
  function editProduct(sku) {
    var D = (CFG._productsDefault || {})[sku], P = (CFG.products || {})[sku];
    if (!D || !P) { toast('Ce produit n\'est pas modifiable.', true); return; }
    var mod = S.content['product.' + sku + '.price'] != null || S.content['product.' + sku + '.label'] != null;
    var buttons = [];
    if (mod) buttons.push({ label: 'Rétablir l\'original', kind: 'danger', left: true, action: function () {
      return Promise.all([setContent('product.' + sku + '.price', null), setContent('product.' + sku + '.label', null)])
        .then(function () { toast('Valeurs d\'origine rétablies.'); });
    } });
    buttons.push({ label: 'Annuler', kind: 'sec', action: function () {} });
    buttons.push({ label: 'Enregistrer', action: function () {
      var raw = $q('#hm-p').value.trim(), pr = Number(raw.replace(',', '.')), lb = $q('#hm-l').value.trim();
      if (raw === '' || !isFinite(pr) || pr < 0) { toast('Le prix n\'est pas valide.', true); return false; }
      if (!lb) { toast('Le nom ne peut pas être vide.', true); return false; }
      return Promise.all([setContent('product.' + sku + '.price', String(pr), String(D.price)), setContent('product.' + sku + '.label', lb, D.label)])
        .then(function () { toast('Produit enregistré.'); });
    } });
    openModal({
      title: 'Modifier le produit',
      body: '<label class="hm-field">Nom du produit (affiché dans le panier)<input id="hm-l" type="text" value="' + esc(P.label) + '"></label>' +
        '<label class="hm-field">Prix (€)<input id="hm-p" type="text" inputmode="decimal" value="' + esc(String(P.price).replace('.', ',')) + '"></label>' +
        '<p class="hm-help">Le texte de description du produit se modifie en cliquant dessus sur la page.</p>',
      buttons: buttons
    });
  }

  /* ====================================================================== */
  /*  Accueil : galerie de réalisations                                      */
  /* ====================================================================== */
  function defaultGallery() {
    return getDoc().then(function (doc) {
      return [].map.call(doc.querySelectorAll('[data-gallery] img'), function (im) {
        return { src: im.getAttribute('src'), caption: im.getAttribute('alt') || '' };
      });
    });
  }
  // Si la galerie n'a jamais été « importée », on enregistre d'abord les photos d'origine : rien ne disparaît.
  function ensureGallery() {
    if (S.gallery.length) return Promise.resolve();
    return defaultGallery().then(function (defs) {
      return db('POST', 'gallery', defs.map(function (d, i) { return { src: d.src, caption: d.caption, position: i + 1 }; }), 'return=minimal');
    }).then(function () { return reloadTable('gallery'); });
  }

  function moveGallery(row, dir) {
    var list = S.gallery.slice(), i = list.indexOf(row), j = i + dir;
    if (i < 0 || j < 0 || j >= list.length) return Promise.resolve();
    list.splice(j, 0, list.splice(i, 1)[0]);
    var jobs = [];
    list.forEach(function (r, n) { if (r.position !== n + 1) jobs.push(db('PATCH', 'gallery?id=eq.' + r.id, { position: n + 1 })); });
    return Promise.all(jobs).then(function () { return reloadTable('gallery'); });
  }

  function editGalleryPhoto(img) {
    var box = img.closest('[data-gallery]');
    var gid = img.getAttribute('data-gal-id');
    var origIdx = gid ? -1 : [].indexOf.call(box.querySelectorAll('img:not([data-gal-db])'), img);
    var chosen = null;

    function rowNow() {
      return gid ? S.gallery.filter(function (g) { return String(g.id) === gid; })[0] : S.gallery[origIdx];
    }

    openModal({
      title: 'Photo de la galerie',
      body: '<img class="hm-preview" id="hm-apercu" src="' + esc(img.currentSrc || img.src) + '" alt="" style="max-height:240px">' +
        '<label class="hm-field">Légende (décrit la photo, utile pour Google)<input id="hm-cap" type="text" value="' + esc(img.getAttribute('alt') || '') + '"></label>' +
        '<details><summary>Remplacer cette photo par une autre</summary><div style="margin-top:10px">' + dropzone(false) + '</div></details>',
      buttons: [
        { label: 'Supprimer', kind: 'danger', left: true, action: function () {
          return ensureGallery().then(function () {
            var row = rowNow(); if (!row) throw new Error('Photo introuvable, rechargez la page.');
            return db('DELETE', 'gallery?id=eq.' + row.id).then(function () { removeFile(row.src); return reloadTable('gallery'); });
          }).then(function () { toast('Photo supprimée.'); });
        } },
        { label: '◀', kind: 'sec', action: function () {
          return ensureGallery().then(function () { var row = rowNow(); return row && moveGallery(row, -1); }).then(function () { toast('Photo déplacée.'); });
        } },
        { label: '▶', kind: 'sec', action: function () {
          return ensureGallery().then(function () { var row = rowNow(); return row && moveGallery(row, 1); }).then(function () { toast('Photo déplacée.'); });
        } },
        { label: 'Annuler', kind: 'sec', action: function () {} },
        { label: 'Enregistrer', action: function () {
          var cap = $q('#hm-cap').value.trim();
          return ensureGallery().then(function () {
            var row = rowNow(); if (!row) throw new Error('Photo introuvable, rechargez la page.');
            var patch = { caption: cap }, old = row.src;
            var step = chosen ? fitJpeg(chosen, 1600, 0.85).then(function (b) { return upload('galerie/realisation-' + uid() + '.jpg', b); }).then(function (u) { patch.src = u; }) : Promise.resolve();
            return step.then(function () { return db('PATCH', 'gallery?id=eq.' + row.id, patch); }).then(function () {
              if (patch.src) removeFile(old);
              return reloadTable('gallery');
            });
          }).then(function () { toast('Photo enregistrée.'); });
        } }
      ],
      onOpen: function (r) { wireDrop(r, function (files) { chosen = files[0]; $q('#hm-apercu').src = URL.createObjectURL(chosen); r.querySelector('details').open = true; }); }
    });
  }

  function addGallery() {
    var files = [];
    openModal({
      title: 'Ajouter des photos',
      body: dropzone(true) + '<div class="hm-thumbs" id="hm-prev"></div>' +
        '<label class="hm-field">Légende (facultatif, appliquée à toutes les photos)<input id="hm-cap" type="text" placeholder="Ex. Henné de mariée, motifs floraux"></label>' +
        '<div class="hm-prog" id="hm-progbox" hidden><i id="hm-prog"></i></div>',
      buttons: [{ label: 'Annuler', kind: 'sec', action: function () {} },
        { label: 'Ajouter à la galerie', action: function () {
          if (!files.length) { toast('Choisissez au moins une photo.', true); return false; }
          $q('#hm-progbox').hidden = false;
          var cap = $q('#hm-cap').value.trim(), urls = [];
          return ensureGallery().then(function () {
            return sendMany(files, function (f) {
              return fitJpeg(f, 1600, 0.85).then(function (b) { return upload('galerie/realisation-' + uid() + '.jpg', b); }).then(function (u) { urls.push(u); });
            });
          }).then(function () {
            var pos = S.gallery.reduce(function (m, g) { return Math.max(m, g.position || 0); }, 0);
            return db('POST', 'gallery', urls.map(function (u, i) { return { src: u, caption: cap, position: pos + i + 1 }; }), 'return=minimal');
          }).then(function () { return reloadTable('gallery'); }).then(function () { toast(files.length + ' photo(s) ajoutée(s).'); });
        } }],
      onOpen: function (r) {
        wireDrop(r, function (fl) {
          files = files.concat(fl);
          $q('#hm-prev').innerHTML = files.map(function (f) { return '<div class="hm-th"><img src="' + URL.createObjectURL(f) + '" alt=""></div>'; }).join('');
        });
      }
    });
  }

  /* ====================================================================== */
  /*  Location : articles                                                    */
  /* ====================================================================== */
  function photoUrl(p, thumb) {
    if (p && typeof p === 'object') return (thumb && p.thumb) || p.src;
    return 'image/location/' + p + (thumb ? '-t.jpg' : '.jpg');
  }

  function importRentals() {
    var rows = (CFG._rentalsDefault || []).map(function (r, i) {
      return { id: r.id, name: r.name, note: r.note || null, price: r.price == null ? null : r.price, cat: r.cat, photos: r.photos, position: i + 1, active: true };
    });
    return db('POST', 'rentals?on_conflict=id', rows, 'resolution=merge-duplicates,return=minimal').then(function () { return reloadTable('rentals'); });
  }
  // Si le catalogue n'a jamais été « importé », on enregistre d'abord les articles d'origine : rien ne disparaît.
  function ensureRentals() { return S.rentals.length ? Promise.resolve() : importRentals(); }
  function rentalById(id) { return S.rentals.filter(function (r) { return r.id === id; })[0]; }

  function moveRental(id, dir) {
    return ensureRentals().then(function () {
      var ids = [].map.call(document.querySelectorAll('#galerie article.carte[data-id]'), function (a) { return a.getAttribute('data-id'); });
      var i = ids.indexOf(id), j = i + dir;
      if (i < 0 || j < 0 || j >= ids.length) return;
      var me = rentalById(id), nb = rentalById(ids[j]);
      if (!me || !nb) return;
      var arr = S.rentals.slice();
      arr.splice(arr.indexOf(me), 1);
      arr.splice(arr.indexOf(nb) + (dir > 0 ? 1 : 0), 0, me);
      var jobs = [];
      arr.forEach(function (r, n) { if (r.position !== n + 1) jobs.push(db('PATCH', 'rentals?id=eq.' + encodeURIComponent(r.id), { position: n + 1 })); });
      return Promise.all(jobs).then(function () { return reloadTable('rentals'); });
    });
  }

  function deleteRental(id) {
    ensureRentals().then(function () {
      var r = rentalById(id); if (!r) return;
      return confirmBox('Supprimer « ' + esc(r.name) + ' » ?',
        'L\'article et ses photos disparaîtront de la page Location. Pour le masquer sans le perdre, utilisez plutôt « Modifier » puis décochez « Visible sur le site ».', 'Supprimer').then(function (ok) {
        if (!ok) return;
        return db('DELETE', 'rentals?id=eq.' + encodeURIComponent(r.id)).then(function () {
          (r.photos || []).forEach(function (p) { if (p && typeof p === 'object') { removeFile(p.src); removeFile(p.thumb); } });
          return reloadTable('rentals');
        }).then(function () { toast('Article supprimé.'); });
      });
    }).catch(function (e) { toast(explain(e), true); });
  }

  function editRental(id) {
    (id ? ensureRentals() : Promise.resolve()).then(function () {
      var r = id ? rentalById(id) : null;
      if (id && !r) { toast('Article introuvable, rechargez la page.', true); return; }
      var isNew = !r;
      var list = r ? (r.photos || []).map(function (p) { return { p: p, url: photoUrl(p, true) }; }) : [];
      var cats = CFG.rentalCategories || [];

      function refresh() {
        $q('#hm-photos').innerHTML = list.map(function (t, n) {
          return '<div class="hm-th"><img src="' + esc(t.url) + '" alt="">' + (n === 0 ? '<span class="hm-cv">Couverture</span>' : '') +
            '<div class="hm-acts"><button type="button" data-ph="del" data-i="' + n + '" aria-label="Retirer la photo">×</button>' +
            (n > 0 ? '<button type="button" data-ph="first" data-i="' + n + '" aria-label="Mettre en couverture" title="Mettre en couverture">★</button>' : '') + '</div></div>';
        }).join('');
      }

      openModal({
        title: isNew ? 'Nouvel article à louer' : 'Modifier l\'article',
        body: '<label class="hm-field">Nom de l\'article<input id="hm-nom" type="text" value="' + esc(r ? r.name : '') + '" placeholder="Ex. Arche florale"></label>' +
          '<label class="hm-field">Précision (facultatif)<input id="hm-note" type="text" value="' + esc(r && r.note ? r.note : '') + '" placeholder="Ex. l\'unité, au choix…"></label>' +
          '<div class="hm-two"><label class="hm-field">Prix de location (€)<input id="hm-prix" type="text" inputmode="decimal" value="' + (r && r.price != null ? esc(String(r.price).replace('.', ',')) : '') + '" placeholder="Vide = sur devis"></label>' +
          '<label class="hm-field">Catégorie<select id="hm-cat">' + cats.map(function (c) {
            return '<option value="' + esc(c.id) + '"' + ((r ? r.cat : cats[0] && cats[0].id) === c.id ? ' selected' : '') + '>' + esc(c.label) + '</option>';
          }).join('') + '</select></label></div>' +
          '<label class="hm-check"><input type="checkbox" id="hm-actif"' + (!r || r.active !== false ? ' checked' : '') + '> Visible sur le site</label>' +
          '<div class="hm-field" style="margin-bottom:8px">Photos <span style="text-transform:none;letter-spacing:0">(la première est la couverture)</span></div>' +
          '<div class="hm-thumbs" id="hm-photos"></div>' + dropzone(true) +
          '<div class="hm-prog" id="hm-progbox" hidden><i id="hm-prog"></i></div>',
        buttons: [{ label: 'Annuler', kind: 'sec', action: function () {} },
          { label: isNew ? 'Ajouter l\'article' : 'Enregistrer', action: function () {
            var name = $q('#hm-nom').value.trim();
            if (!name) { toast('Indiquez le nom de l\'article.', true); return false; }
            if (!list.length) { toast('Ajoutez au moins une photo.', true); return false; }
            var ptxt = $q('#hm-prix').value.trim().replace(',', '.');
            var price = ptxt === '' ? null : Number(ptxt);
            if (price !== null && (!isFinite(price) || price < 0)) { toast('Le prix n\'est pas valide.', true); return false; }
            $q('#hm-progbox').hidden = false;
            var rid = r ? r.id : (slug(name) + '-' + uid().slice(-4));
            var fresh = list.filter(function (t) { return t.file && !t.p; });
            return sendMany(fresh, function (a) {
              return Promise.all([fitJpeg(a.file, 1400, 0.82), coverJpeg(a.file, 520, 650, 0.8)]).then(function (bl) {
                var base = 'location/' + slug(name) + '-' + uid();
                return Promise.all([upload(base + '.jpg', bl[0]), upload(base + '-t.jpg', bl[1])]);
              }).then(function (u) { a.p = { src: u[0], thumb: u[1] }; });
            }).then(function () {
              var photos = list.map(function (t) { return t.p; });
              var row = { id: rid, name: name, note: $q('#hm-note').value.trim() || null, price: price, cat: $q('#hm-cat').value,
                photos: photos, active: $q('#hm-actif').checked, updated_at: new Date().toISOString() };
              if (isNew) {
                return ensureRentals().then(function () {
                  row.position = S.rentals.reduce(function (m, x) { return Math.max(m, x.position || 0); }, 0) + 1;
                  return db('POST', 'rentals', row, 'return=minimal');
                });
              }
              return db('PATCH', 'rentals?id=eq.' + encodeURIComponent(r.id), row).then(function () {
                (r.photos || []).forEach(function (p) {
                  if (p && typeof p === 'object' && !photos.some(function (q) { return q && q.src === p.src; })) { removeFile(p.src); removeFile(p.thumb); }
                });
              });
            }).then(function () { return reloadTable('rentals'); }).then(function () { toast(isNew ? 'Article ajouté.' : 'Article enregistré.'); });
          } }],
        onOpen: function (rt) {
          refresh();
          wireDrop(rt, function (fl) {
            fl.forEach(function (f) { list.push({ file: f, url: URL.createObjectURL(f) }); });
            refresh();
          });
          $q('#hm-photos').addEventListener('click', function (e) {
            var b = e.target.closest('[data-ph]'); if (!b) return;
            var i = +b.getAttribute('data-i'), act = b.getAttribute('data-ph');
            if (act === 'del') list.splice(i, 1);
            if (act === 'first') list.unshift(list.splice(i, 1)[0]);
            refresh();
          });
        }
      });
    }).catch(function (e) { toast(explain(e), true); });
  }

  // Les articles « masqués » n'apparaissent pas sur la page : on les liste ici pour pouvoir les réafficher.
  function hiddenModal() {
    var hid = S.rentals.filter(function (r) { return r.active === false; });
    openModal({
      title: 'Articles masqués',
      body: hid.length ? '<p class="hm-help" style="margin-top:0">Ces articles ne sont pas visibles par les visiteurs.</p>' + hid.map(function (r) {
        return '<div class="hm-row"><span>' + esc(r.name) + '</span><button type="button" class="hm-btn sec" data-show="' + esc(r.id) + '" style="padding:9px 14px">Afficher</button>' +
          '<button type="button" class="hm-btn sec" data-mod="' + esc(r.id) + '" style="padding:9px 14px">Modifier</button></div>';
      }).join('') : '<p>Aucun article masqué.</p>',
      buttons: [{ label: 'Fermer', kind: 'sec', action: function () {} }],
      onOpen: function (r) {
        r.addEventListener('click', function (e) {
          var s = e.target.closest('[data-show]'), m = e.target.closest('[data-mod]');
          if (s) {
            s.disabled = true;
            db('PATCH', 'rentals?id=eq.' + encodeURIComponent(s.getAttribute('data-show')), { active: true })
              .then(function () { return reloadTable('rentals'); }).then(function () { toast('Article affiché.'); hiddenModal(); })
              .catch(function (er) { toast(explain(er), true); });
          }
          if (m) { var id = m.getAttribute('data-mod'); closeModal(); editRental(id); }
        });
      }
    });
  }

  /* ====================================================================== */
  /*  Décor de la page Location : boutons sur chaque carte + « Ajouter »     */
  /* ====================================================================== */
  function decorateLocation() {
    var g = document.getElementById('galerie');
    if (!g) return;
    var cards = g.querySelectorAll('article.carte[data-id]');
    var n = cards.length;
    [].forEach.call(cards, function (a, i) {
      if (a.querySelector('.hm-card-bar')) return;
      var bar = document.createElement('div');
      bar.className = 'hm-ui hm-card-bar';
      bar.innerHTML = '<button type="button" data-a="left" aria-label="Déplacer avant" title="Déplacer avant">◀</button>' +
        '<button type="button" data-a="right" aria-label="Déplacer après" title="Déplacer après">▶</button>' +
        '<button type="button" data-a="edit">✎ Modifier</button>' +
        '<button type="button" class="hm-del" data-a="del" aria-label="Supprimer" title="Supprimer">🗑</button>';
      a.appendChild(bar);
    });
    [].forEach.call(g.querySelectorAll('.hm-card-bar'), function (bar, i) {
      bar.querySelector('[data-a=left]').disabled = i === 0;
      bar.querySelector('[data-a=right]').disabled = i === n - 1;
    });
    if (!document.getElementById('hm-locbar')) {
      var ab = document.createElement('div');
      ab.id = 'hm-locbar'; ab.className = 'hm-ui hm-addbar';
      ab.innerHTML = '<button type="button" class="hm-add" data-a="add">+ Ajouter un article</button>' +
        '<button type="button" class="hm-add" data-a="hidden" id="hm-hidden-btn" hidden>Articles masqués</button>';
      g.parentNode.insertBefore(ab, g);
    }
    var hn = S.rentals.filter(function (r) { return r.active === false; }).length;
    var hb = document.getElementById('hm-hidden-btn');
    if (hb) { hb.hidden = !hn; hb.textContent = 'Articles masqués (' + hn + ')'; }
  }

  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('.hm-card-bar button, .hm-addbar button');
    if (!b || b.disabled) return;
    e.preventDefault(); e.stopPropagation();
    var act = b.getAttribute('data-a');
    var card = b.closest('article.carte');
    var id = card ? card.getAttribute('data-id') : null;
    if (act === 'add') return editRental(null);
    if (act === 'hidden') return hiddenModal();
    if (act === 'edit') return editRental(id);
    if (act === 'del') return deleteRental(id);
    if (act === 'left' || act === 'right') {
      b.disabled = true;
      moveRental(id, act === 'left' ? -1 : 1).catch(function (er) { toast(explain(er), true); });
    }
    if (act === 'gal-add') return addGallery();
  }, true);

  /* ====================================================================== */
  /*  Décor de l'accueil : bouton « Ajouter des photos » sous la galerie     */
  /* ====================================================================== */
  function decorateHome() {
    var box = document.querySelector('[data-gallery]');
    if (!box || !box.parentNode) return;
    var nx = box.nextElementSibling;
    if (nx && nx.id === 'hm-galbar') return;
    var old = document.getElementById('hm-galbar');
    if (old && old.parentNode) old.parentNode.removeChild(old);
    var ab = document.createElement('div');
    ab.id = 'hm-galbar'; ab.className = 'hm-ui hm-addbar';
    ab.style.justifyContent = 'center';
    ab.innerHTML = '<button type="button" class="hm-add" data-a="gal-add">+ Ajouter des photos à la galerie</button>';
    box.parentNode.insertBefore(ab, box.nextSibling);
  }

  /* ====================================================================== */
  /*  Clic sur un élément modifiable (accueil)                               */
  /* ====================================================================== */
  var SEL = '[data-edit],img[data-img],[data-price],[data-gallery] img';
  function pick(e) {
    var t = e.target;
    if (t && t.closest) {
      if (t.closest('.hm-ui')) return null;
      var d = t.closest(SEL);
      if (d) return d;
    }
    // un calque transparent peut recouvrir la photo : on regarde tout ce qui se trouve sous le doigt
    var stack = document.elementsFromPoint ? document.elementsFromPoint(e.clientX, e.clientY) : [];
    for (var i = 0; i < stack.length; i++) {
      if (stack[i].closest && stack[i].closest('.hm-ui')) return null;
      if (stack[i].matches && stack[i].matches(SEL)) return stack[i];
    }
    return null;
  }

  window.addEventListener('click', function (e) {
    if (!overlay.hidden) return;
    var el = pick(e);
    if (!el) return;
    e.preventDefault(); e.stopPropagation();
    if (!S.ready) { toast('Chargement… réessayez dans un instant.'); return; }
    if (el.matches('[data-gallery] img')) return editGalleryPhoto(el);
    if (el.matches('img[data-img]')) return replaceImage(el.getAttribute('data-img'));
    if (el.matches('[data-price]')) return editProduct(el.getAttribute('data-price'));
    if (el.matches('[data-edit]')) return editText(el.getAttribute('data-edit'));
  }, true);

  /* ====================================================================== */
  /*  Barre « Mode édition »                                                 */
  /* ====================================================================== */
  var bar = document.createElement('div');
  bar.className = 'hm-ui hm-bar';
  bar.innerHTML = '<span style="white-space:nowrap"><i class="hm-dot"></i><strong><span class="hm-lg">Mode </span>édition</strong></span>' +
    '<span class="hm-hint">' + (IS_LOC ? 'Utilisez les boutons sur chaque article.' : 'Cliquez sur un texte, une photo ou un prix pour le modifier.') + '</span>' +
    (IS_LOC ? '<a class="hm-b" href="index.html">‹ Accueil</a>' : '<a class="hm-b" href="location.html">Location ›</a>') +
    '<a class="hm-b" href="admin.html">Admin</a>' +
    '<button type="button" class="hm-b hm-q" id="hm-quit">Quitter</button>';
  document.body.appendChild(bar);
  bar.querySelector('#hm-quit').addEventListener('click', function () { quit(true); });

  /* ====================================================================== */
  /*  Démarrage                                                              */
  /* ====================================================================== */
  var timer = null;
  function schedule() {
    if (timer) return;
    timer = setTimeout(function () { timer = null; if (IS_LOC) decorateLocation(); else decorateHome(); }, 120);
  }
  try { new MutationObserver(schedule).observe(IS_LOC ? document.getElementById('galerie') : document.body, IS_LOC ? { childList: true } : { childList: true, subtree: true }); } catch (e) {}
  window.addEventListener('henna-content-updated', schedule);

  loadAll().then(function () {
    pushToSite();   // l'affichage reflète tout de suite l'état réel de la base (y compris les articles masqués)
    schedule();
  }).catch(function (e) { toast(explain(e), true); });

  if (IS_LOC) decorateLocation(); else decorateHome();
})();
