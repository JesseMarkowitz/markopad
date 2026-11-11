/* MarkoPad application code.
 *
 * The build joins this file with the two libraries (marked, DOMPurify) and a data block
 * (MP_BUILD: version, help text, cheat sheet, document stylesheet) into one inline script.
 *
 * Rules that keep the page safe. Do not relax them without reading REQUIREMENTS.md sections 4-5.
 *  - Document content reaches the page only through buildChunk(): marked -> DOMPurify -> normalize().
 *  - That work happens in a detached document, where images never load. Only decoratePreview()
 *    decides which images keep their address before anything is moved into the live page.
 *  - The document is cleaned in independent pieces (see chunkTokens). The preview, the exported
 *    files and the clipboard are all assembled from the same pieces, so they always agree.
 *  - Links in the preview carry no href. The destination lives in a data attribute and can only
 *    be opened through confirmLink(), so no click, middle-click or menu can skip the question.
 *  - No inline style attributes and no literal script tags in this file: the page's content
 *    security policy allows only the one script and the one style sheet the build hashed.
 */
(function () {
  'use strict';

  var BUILD = window.MP_BUILD;
  var STORE_KEY = 'markopad.v1.tab';
  var INDENT = '    ';
  var MAX_OPEN_BYTES = 20 * 1024 * 1024;
  var NARROW_QUERY = '(max-width: 720px)';

  var $ = function (id) { return document.getElementById(id); };
  var el = {
    body: document.body, root: document.documentElement,
    editor: $('editor'), preview: $('preview'), previewScroll: $('preview-scroll'),
    panes: $('panes'), divider: $('divider'),
    btnNew: $('btn-new'), btnOpen: $('btn-open'), fileInput: $('file-input'),
    btnDownload: $('btn-download'), menuDownload: $('menu-download'),
    btnCopy: $('btn-copy'), menuCopy: $('menu-copy'),
    actSaveMd: $('act-save-md'), actSaveHtml: $('act-save-html'), actPrint: $('act-print'),
    actCopyMd: $('act-copy-md'), actCopyRich: $('act-copy-rich'), actCopyHtml: $('act-copy-html'),
    viewEdit: $('view-edit'), viewBoth: $('view-both'), viewPreview: $('view-preview'),
    btnSync: $('btn-sync'), btnTheme: $('btn-theme'), btnHowto: $('btn-howto'), btnToolbar: $('btn-toolbar'), toolbar: $('toolbar'),
    imgNotice: $('img-notice'), imgNoticeText: $('img-notice-text'), imgLoadedText: $('img-loaded-text'),
    imgLoadAll: $('img-load-all'), imgBlockAgain: $('img-block-again'), imgWhy: $('img-why'),
    counts: $('counts'), recovery: $('recovery'), statusMsg: $('status-msg'), version: $('version'),
    howto: $('howto'), howtoClose: $('howto-close'), howtoSearch: $('howto-search'), howtoList: $('howto-list'),
    dlg: $('dlg'), dlgTitle: $('dlg-title'), dlgBody: $('dlg-body'), dlgActions: $('dlg-actions'),
    dropOverlay: $('drop-overlay')
  };

  var state = {
    name: '',            // name of the opened file, '' when there is none
    dirty: false,        // edited since the last Open, Markdown download or New
    split: 50,           // divider position, percent
    view: null,          // 'edit' | 'both' | 'preview'; null = follow the screen width
    theme: null,         // 'light' | 'dark'; null = follow the device
    sync: true,
    toolbar: true,
    startedAt: clockNow(),
    approvedUrls: {},    // exact image addresses the reader allowed
    approvedHosts: {},   // exact host names the reader allowed
    approveAll: false
  };
  var narrow = false;
  var storageWorks = true;
  var recoveryFailed = false;
  var renderTimer = 0;
  var persistTimer = 0;
  var msgTimer = 0;

  /* ====================================================================== helpers */

  function clockNow() {
    var d = new Date();
    return ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
  }
  function clamp(n, lo, hi) { return Math.min(hi, Math.max(lo, n)); }
  function make(tag, props, children) {
    var node = document.createElement(tag);
    if (props) Object.keys(props).forEach(function (k) {
      if (k === 'class') node.className = props[k];
      else if (k === 'text') node.textContent = props[k];
      else node.setAttribute(k, props[k]);
    });
    (children || []).forEach(function (c) { node.append(c); });
    return node;
  }
  function plural(n, one, many) { return n.toLocaleString() + ' ' + (n === 1 ? one : many); }

  function flash(text, keep) {
    clearTimeout(msgTimer);
    el.statusMsg.textContent = text;
    el.statusMsg.classList.add('strong');
    if (!keep) msgTimer = setTimeout(function () {
      el.statusMsg.textContent = '';
      el.statusMsg.classList.remove('strong');
    }, 4500);
  }
  function hint(text) {           // quiet, replaceable line: used for link destinations
    clearTimeout(msgTimer);
    el.statusMsg.classList.remove('strong');
    el.statusMsg.textContent = text;
  }

  /* ====================================================================== dialogs */

  // ask({title, body, actions:[{label, value, primary}], cancel}) -> Promise(value)
  function ask(opts) {
    return new Promise(function (resolve) {
      var dlg = el.dlg;
      var done = false;
      function finish(value) {
        if (done) return;
        done = true;
        dlg.removeEventListener('cancel', onCancel);
        dlg.removeEventListener('close', onClose);
        if (dlg.open) dlg.close();
        resolve(value);
      }
      function onCancel(ev) { ev.preventDefault(); finish(opts.cancel); }
      // The browser reports "closed" a moment after the fact. If the next question is already
      // open by then, that late report belongs to the previous one and must not dismiss this one.
      function onClose() { if (!dlg.open) finish(opts.cancel); }
      el.dlgTitle.textContent = opts.title;
      el.dlgBody.replaceChildren();
      (Array.isArray(opts.body) ? opts.body : [opts.body]).forEach(function (part) {
        el.dlgBody.append(typeof part === 'string' ? make('p', { text: part }) : part);
      });
      el.dlgActions.replaceChildren();
      var focusTarget = null;
      opts.actions.forEach(function (a) {
        var b = make('button', { type: 'button', text: a.label });
        if (a.primary) b.className = 'primary';
        if (a.title) b.title = a.title;
        b.addEventListener('click', function () {
          if (a.run) { a.run(b); return; }      // an action that keeps the question open
          finish(a.value);
        });
        if (a.focus) focusTarget = b;
        el.dlgActions.append(b);
      });
      dlg.addEventListener('cancel', onCancel);
      dlg.addEventListener('close', onClose);
      if (typeof dlg.showModal === 'function') {
        dlg.showModal();
        if (focusTarget) focusTarget.focus();
      } else {
        // Very old browser: fall back to the built-in question, first action = OK.
        finish(window.confirm(opts.title + '\n\n' + el.dlgBody.textContent) ? opts.actions[0].value : opts.cancel);
      }
    });
  }

  /* ====================================================================== safe rendering */

  var ALLOWED_TAGS = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'br', 'hr', 'blockquote', 'pre', 'code',
    'em', 'strong', 'del', 's', 'ins', 'u', 'b', 'i', 'sub', 'sup', 'kbd', 'mark', 'small', 'samp', 'var',
    'abbr', 'q', 'cite', 'a', 'img', 'ul', 'ol', 'li', 'dl', 'dt', 'dd', 'table', 'thead', 'tbody', 'tfoot',
    'tr', 'th', 'td', 'caption', 'details', 'summary', 'input', 'span', 'div'];
  var ALLOWED_ATTR = ['href', 'src', 'alt', 'align', 'colspan', 'rowspan', 'start', 'type', 'checked',
    'disabled', 'open', 'width', 'height', 'lang', 'dir'];
  var PURIFY = {
    ALLOWED_TAGS: ALLOWED_TAGS,
    ALLOWED_ATTR: ALLOWED_ATTR,
    ALLOW_DATA_ATTR: false,
    ALLOW_ARIA_ATTR: false,
    ALLOW_UNKNOWN_PROTOCOLS: false,
    RETURN_DOM: true
  };
  var IMAGE_DATA = /^data:image\/(?:png|jpeg|gif|webp|avif|bmp|svg\+xml)[;,]/i;

  function slugify(text) {
    return text.trim().toLowerCase()
      .replace(/[^\p{L}\p{N}\s_-]/gu, '')
      .replace(/\s+/g, '-');
  }
  function unwrap(node) { node.replaceWith.apply(node, Array.prototype.slice.call(node.childNodes)); }

  var MARKED_OPTS = { gfm: true, breaks: false, async: false };
  var VOID_TAGS = /^(?:area|base|br|col|embed|hr|img|input|link|meta|param|source|track|wbr)$/i;

  // How many HTML elements a raw HTML block leaves open (negative when it closes more than it opens).
  function htmlDepth(raw) {
    var depth = 0, m;
    var re = /<(\/)?([a-zA-Z][a-zA-Z0-9-]*)\b[^>]*?(\/)?>/g;
    var text = raw.replace(/<!--[\s\S]*?-->/g, '');
    while ((m = re.exec(text))) {
      if (VOID_TAGS.test(m[2]) || m[3]) continue;
      depth += m[1] ? -1 : 1;
    }
    return depth;
  }
  function cheapHash(s) {
    var h = s.length, n = Math.min(s.length, 96);
    for (var i = 0; i < n; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
    return h;
  }

  // Cuts the document into pieces that are rendered and cleaned independently, so that an edit
  // costs one small piece instead of the whole document. A piece is a run of top-level blocks.
  //  - Where a piece ends depends only on the text near that point, so typing in one place does
  //    not move the boundaries elsewhere.
  //  - A piece never ends inside an HTML element that a raw HTML block opened (for example
  //    <details> ... </details> spanning several paragraphs): those blocks stay together.
  function chunkTokens(tokens) {
    var chunks = [], cur = null, depth = 0;
    for (var i = 0; i < tokens.length; i++) {
      var tok = tokens[i];
      var cut = depth <= 0 && tok.type !== 'space' &&
        (tok.type === 'heading' || tok.type === 'html' || (cheapHash(tok.raw) & 3) === 0);
      if (!cur || (cut && cur.solid)) {
        cur = { raw: '', tokens: [], solid: false };
        chunks.push(cur);
        depth = 0;
      }
      cur.raw += tok.raw;
      cur.tokens.push(tok);
      if (tok.type !== 'space') cur.solid = true;
      if (tok.type === 'html') depth += htmlDepth(tok.raw);
    }
    return chunks;
  }

  // The document as a list of pieces, each with the key its cleaned form is cached under.
  // Reference-style link definitions can sit anywhere in a document, so they are part of every key.
  function planDocument(text) {
    var tokens = window.marked.lexer(text, MARKED_OPTS);
    var defs = tokens.links && Object.keys(tokens.links).length ? JSON.stringify(tokens.links) : '';
    var chunks = chunkTokens(tokens);
    for (var i = 0; i < chunks.length; i++) chunks[i].key = chunks[i].raw + '\u0000' + defs;
    return chunks;
  }

  // One piece -> { frag, remote }: a cleaned, classified fragment living in a detached document.
  // Nothing in it has touched the network, and it is never shown itself, only copies of it.
  function buildChunk(chunk) {
    var html = window.marked.parser(chunk.tokens, MARKED_OPTS);
    var body = window.DOMPurify.sanitize(html, PURIFY);
    if (!body || body.ownerDocument === document) {
      // Belt and braces: never work on document content inside the live page.
      var inert = new DOMParser().parseFromString(
        window.DOMPurify.sanitize(html, Object.assign({}, PURIFY, { RETURN_DOM: false })), 'text/html');
      body = inert.body;
    }
    normalize(body);
    var frag = body.ownerDocument.createDocumentFragment();
    while (body.firstChild) frag.appendChild(body.firstChild);
    return { frag: frag, remote: frag.querySelector('img[data-mp-kind="remote"]') !== null };
  }

  var chunkCache = new Map();
  function cachedChunk(chunk) {
    var hit = chunkCache.get(chunk.key);
    if (!hit) { hit = buildChunk(chunk); chunkCache.set(chunk.key, hit); }
    return hit;
  }

  // Markdown text -> a <body> element in a detached document holding the whole cleaned document.
  // Used for exported files, the clipboard and the cheat sheet samples.
  function safeBody(text) {
    var body = new DOMParser().parseFromString('', 'text/html').body;
    planDocument(text).forEach(function (chunk) {
      body.appendChild(body.ownerDocument.importNode(cachedChunk(chunk).frag, true));
    });
    assignSlugs(body);
    return body;
  }

  // Gives every heading the name a "#link" refers to: its text in lower case with hyphens.
  function assignSlugs(root) {
    var used = {};
    root.querySelectorAll('h1,h2,h3,h4,h5,h6').forEach(function (h) {
      var base = slugify(h.textContent) || 'section';
      var slug = base, n = 1;
      while (used[slug]) slug = base + '-' + n++;
      used[slug] = true;
      h.setAttribute('data-mp-slug', slug);
    });
  }

  function normalize(body) {
    body.querySelectorAll('input').forEach(function (input) {
      if ((input.getAttribute('type') || '').toLowerCase() !== 'checkbox') { input.remove(); return; }
      input.setAttribute('disabled', '');
    });

    body.querySelectorAll('a').forEach(function (a) {
      var href = a.getAttribute('href');
      if (href === null || href.trim() === '') { unwrap(a); return; }
      href = href.trim();
      if (href.charAt(0) === '#') {
        var target = href.slice(1);
        try { target = decodeURIComponent(target); } catch (e) { /* keep as typed */ }
        a.setAttribute('data-mp-kind', 'anchor');
        a.setAttribute('data-mp-target', target.toLowerCase());
        return;
      }
      var url;
      try { url = new URL(href); } catch (e) {
        a.setAttribute('data-mp-kind', 'relative');
        a.removeAttribute('href');
        return;
      }
      if (url.protocol === 'http:' || url.protocol === 'https:') {
        a.setAttribute('data-mp-kind', 'web');
        a.setAttribute('data-mp-url', url.href);
        a.setAttribute('href', url.href);
      } else if (url.protocol === 'mailto:') {
        a.setAttribute('data-mp-kind', 'mail');
        a.setAttribute('data-mp-url', url.href);
        a.setAttribute('href', url.href);
      } else {
        unwrap(a);        // any other kind of link is shown as plain text
      }
    });

    body.querySelectorAll('img').forEach(function (img) {
      var src = (img.getAttribute('src') || '').trim();
      var url = null;
      try { url = new URL(src); } catch (e) { /* relative or empty */ }
      if (url && (url.protocol === 'http:' || url.protocol === 'https:')) {
        img.setAttribute('data-mp-kind', 'remote');
        img.setAttribute('data-mp-url', url.href);
        img.setAttribute('data-mp-host', url.host);
        img.setAttribute('src', url.href);
      } else if (IMAGE_DATA.test(src)) {
        img.setAttribute('data-mp-kind', 'embedded');
      } else {
        img.setAttribute('data-mp-kind', 'unavailable');
        img.removeAttribute('src');
      }
    });
  }

  /* ---------------------------------------------------------------- suspicious links */

  var COMMON_ENDINGS = /\.(?:com|org|net|edu|gov|mil|int|io|co|me|app|dev|info|biz|us|uk|ca|de|fr|es|it|nl|se|no|fi|dk|ch|at|be|ie|pl|pt|ru|jp|cn|in|au|nz|br|mx|ar|za|kr|tv|cc|xyz|online|site|shop|store|tech|ai|ly|to|gg|eu|onion)$/i;

  function bareHost(host) { return host.toLowerCase().replace(/^www\./, '').replace(/\.$/, ''); }

  // The site a piece of visible text claims to be, or '' when it does not look like an address.
  function claimedHost(text) {
    var t = text.trim();
    if (t === '' || /\s/.test(t)) return '';
    var withScheme = /^https?:\/\//i.test(t);
    var m = t.replace(/^https?:\/\//i, '').match(/^(?:[^@\/?#]*@)?([^\/?#:]+)/);
    if (!m) return '';
    var host = m[1];
    if (!/^[a-z0-9-]+(?:\.[a-z0-9-]+)+\.?$/i.test(host)) return '';
    if (!withScheme && !/^www\./i.test(host) && !COMMON_ENDINGS.test(host.replace(/\.$/, ''))) return '';
    return bareHost(host);
  }

  function linkWarnings(urlString, text) {
    var warnings = [];
    var url;
    try { url = new URL(urlString); } catch (e) { return ['The address could not be read.']; }
    if (url.protocol === 'mailto:') {
      var to = decodeURIComponentSafe(url.pathname).toLowerCase();
      var shown = text.trim().toLowerCase();
      if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(shown) && shown !== to) {
        warnings.push('The text shows the address ' + shown + ', but the email would go to ' + to + '.');
      }
      return warnings;
    }
    var host = url.hostname;
    var claim = claimedHost(text);
    var real = bareHost(host);
    if (claim && claim !== real && !real.endsWith('.' + claim)) {
      warnings.push('The text shows ' + claim + ', but the link goes to ' + real + '.');
    }
    if (/(^|\.)xn--/i.test(host)) {
      warnings.push('The site name contains letters from another alphabet, which can be used to imitate a familiar name. Its exact form is shown above.');
    }
    if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(host) || host.charAt(0) === '[') {
      warnings.push('The link goes to a bare numeric address instead of a named site.');
    }
    if (url.username !== '' || url.password !== '') {
      warnings.push('The address has a name in front of an @ sign. The real site is the part after the @.');
    }
    return warnings;
  }
  function decodeURIComponentSafe(s) { try { return decodeURIComponent(s); } catch (e) { return s; } }

  /* ---------------------------------------------------------------- preview decoration */

  function imageAllowed(url, host) {
    return state.approveAll || state.approvedUrls[url] === true || state.approvedHosts[host] === true;
  }

  // Turns a cleaned fragment (or body) into what the preview shows: links lose their href and
  // gain the confirmation behaviour; remote images the reader has not allowed become placeholders.
  function decoratePreview(body, interactive) {
    var doc = body.ownerDocument;
    var mk = function (tag, cls, text) {
      var n = doc.createElement(tag);
      if (cls) n.className = cls;
      if (text != null) n.textContent = text;
      return n;
    };

    body.querySelectorAll('a').forEach(function (a) {
      var kind = a.getAttribute('data-mp-kind');
      a.removeAttribute('href');
      if (kind === 'relative') {
        var span = mk('span', 'mp-unavailable');
        span.setAttribute('title', 'This link has no site name in its address, so there is nothing to open.');
        while (a.firstChild) span.appendChild(a.firstChild);
        a.replaceWith(span);
        return;
      }
      a.setAttribute('role', 'link');
      a.setAttribute('tabindex', '0');
      if (kind === 'anchor') {
        a.className = 'mp-anchor';
        a.setAttribute('title', 'Jumps to a heading in this document');
        return;
      }
      var url = a.getAttribute('data-mp-url');
      var text = a.textContent;
      a.setAttribute('data-mp-text', text);
      a.className = 'mp-link';
      a.setAttribute('title', (kind === 'mail' ? 'Email link: ' : 'Goes to: ') + url);
      if (linkWarnings(url, text).length) {
        a.classList.add('mp-suspicious');
        var flag = mk('span', 'mp-flag', '⚠');
        flag.setAttribute('aria-label', 'Suspicious link');
        flag.setAttribute('title', 'This link may not be what it appears to be. Click it to see why.');
        a.appendChild(flag);
      }
    });

    body.querySelectorAll('img[data-mp-kind="remote"]').forEach(function (img) {
      var url = img.getAttribute('data-mp-url');
      var host = img.getAttribute('data-mp-host');
      if (imageAllowed(url, host)) {
        img.setAttribute('referrerpolicy', 'no-referrer');
        img.setAttribute('loading', 'lazy');
        img.setAttribute('decoding', 'async');
        return;
      }
      var box = mk('span', 'mp-blocked');
      box.setAttribute('data-mp-url', url);
      box.setAttribute('data-mp-host', host);
      var label = mk('span', null, 'Image blocked, from ');
      label.appendChild(mk('b', null, host));
      var alt = (img.getAttribute('alt') || '').trim();
      if (alt) label.appendChild(doc.createTextNode(' (“' + (alt.length > 60 ? alt.slice(0, 57) + '…' : alt) + '”)'));
      box.appendChild(label);
      if (interactive) {
        var one = mk('button', null, 'Load');
        one.setAttribute('type', 'button');
        one.setAttribute('data-mp-act', 'one');
        one.setAttribute('title', 'Load this one image from ' + host);
        box.appendChild(one);
        var all = mk('button', null, 'Load all from this site');     // labelled by refreshImageNotice()
        all.setAttribute('type', 'button');
        all.setAttribute('data-mp-act', 'host');
        all.setAttribute('title', 'Load every image in this document that comes from ' + host);
        all.setAttribute('hidden', '');
        box.appendChild(all);
      }
      img.replaceWith(box);           // the address never reaches the live page
    });

    body.querySelectorAll('img[data-mp-kind="unavailable"]').forEach(function (img) {
      var alt = (img.getAttribute('alt') || '').trim();
      var box = mk('span', 'mp-unavailable-img', 'Image unavailable' + (alt ? ': ' + alt : ''));
      box.setAttribute('title', 'This image has no site name in its address, so there is nowhere to load it from.');
      img.replaceWith(box);
    });
  }

  function moveInto(target, body) {
    var frag = document.createDocumentFragment();
    while (body.firstChild) frag.appendChild(document.adoptNode(body.firstChild));
    target.replaceChildren(frag);
  }

  /* ---------------------------------------------------------------- the live preview */

  var shown = [];            // what the preview holds now, in order: { key, nodes, remote, epoch }
  var approvalsEpoch = 0;    // raised whenever image approvals change
  var job = null;            // a redraw in progress
  var lastRenderCost = 0;    // how long the last redraw held the page, in milliseconds
  var SLICE_MS = 20;
  var BIG_DOCUMENT = 200000;  // characters; below this a newly loaded document is drawn in one go

  function cancelJob() {
    if (job && job.timer) clearTimeout(job.timer);
    job = null;
  }

  // Redraws the preview. Small documents finish at once. A large one is cleaned a slice at a time
  // so typing stays responsive; pass true to finish in one go (needed just before printing).
  function render(finishNow) {
    if (renderTimer) { clearTimeout(renderTimer); renderTimer = 0; }
    cancelJob();
    var started = performance.now();
    var text = el.editor.value;
    var chunks = planDocument(text);
    var todo = [];
    var seen = {};
    for (var i = 0; i < chunks.length; i++) {
      var key = chunks[i].key;
      if (!chunkCache.has(key) && seen[key] !== true) { seen[key] = true; todo.push(chunks[i]); }
    }
    job = { text: text, chunks: chunks, todo: todo, at: 0, timer: 0, cost: performance.now() - started };
    renderStep(finishNow === true);
  }

  function renderStep(finishNow) {
    var j = job;
    if (!j) return;
    j.timer = 0;
    var began = performance.now();
    while (j.at < j.todo.length) {
      cachedChunk(j.todo[j.at++]);
      if (!finishNow && performance.now() - began > SLICE_MS) {
        j.cost = Math.max(j.cost, performance.now() - began);
        j.timer = setTimeout(renderStep, 0);
        return;
      }
    }
    // Everything is cleaned. Keep only what this document uses, then update the page.
    var keep = new Map();
    j.chunks.forEach(function (c) { keep.set(c.key, chunkCache.get(c.key)); });
    chunkCache = keep;
    patchPreview(j.chunks);
    refreshImageNotice();
    updateCounts(j.text);
    updateTitle();
    if (state.sync && document.activeElement === el.editor) followEditor();
    lastRenderCost = Math.max(j.cost, performance.now() - began);
    job = null;
  }

  function stillShown(entry, key) {
    return entry.key === key && (!entry.remote || entry.epoch === approvalsEpoch);
  }

  // Replaces only the pieces of the preview that changed, leaving the rest of the page alone.
  function patchPreview(chunks) {
    var old = shown, n = chunks.length, m = old.length, i;
    var head = 0;
    while (head < n && head < m && stillShown(old[head], chunks[head].key)) head++;
    var tail = 0;
    while (tail < n - head && tail < m - head && stillShown(old[m - 1 - tail], chunks[n - 1 - tail].key)) tail++;
    for (i = head; i < m - tail; i++) old[i].nodes.forEach(function (node) { node.remove(); });
    var anchor = null;
    for (i = m - tail; i < m && !anchor; i++) if (old[i].nodes.length) anchor = old[i].nodes[0];
    var incoming = document.createDocumentFragment();
    var fresh = [];
    for (i = head; i < n - tail; i++) {
      var cached = chunkCache.get(chunks[i].key);
      var copy = cached.frag.cloneNode(true);          // still in the detached document
      decoratePreview(copy, true);
      var nodes = [];
      while (copy.firstChild) {
        var node = document.adoptNode(copy.firstChild);
        nodes.push(node);
        incoming.appendChild(node);
      }
      fresh.push({ key: chunks[i].key, nodes: nodes, remote: cached.remote, epoch: approvalsEpoch });
    }
    el.preview.insertBefore(incoming, anchor);
    shown = old.slice(0, head).concat(fresh, old.slice(m - tail));
  }

  // Counts the blocked images now on the page, labels the per-site buttons and updates the notice.
  function refreshImageNotice() {
    var boxes = el.preview.querySelectorAll('.mp-blocked');
    var perHost = {};
    boxes.forEach(function (box) {
      var host = box.getAttribute('data-mp-host');
      perHost[host] = (perHost[host] || 0) + 1;
    });
    boxes.forEach(function (box) {
      var btn = box.querySelector('button[data-mp-act="host"]');
      if (!btn) return;
      var count = perHost[box.getAttribute('data-mp-host')];
      btn.hidden = count < 2;
      btn.textContent = 'Load all ' + count + ' from this site';
    });
    // Remote images the reader allowed and that are showing now.
    var loaded = el.preview.querySelectorAll('img[data-mp-kind="remote"]');
    var loadedHosts = {};
    loaded.forEach(function (img) { loadedHosts[img.getAttribute('data-mp-host')] = true; });

    if (boxes.length) {
      el.imgNoticeText.textContent = plural(boxes.length, 'remote image is', 'remote images are') +
        ' blocked, from ' + plural(Object.keys(perHost).length, 'site', 'sites') + '.';
      el.imgLoadedText.textContent = loaded.length ? plural(loaded.length, 'is', 'are') + ' loaded.' : '';
    } else if (loaded.length) {
      el.imgNoticeText.textContent = plural(loaded.length, 'remote image is', 'remote images are') +
        ' loaded, from ' + plural(Object.keys(loadedHosts).length, 'site', 'sites') + '.';
      el.imgLoadedText.textContent = '';
    }
    el.imgLoadAll.hidden = boxes.length === 0;
    el.imgBlockAgain.hidden = loaded.length === 0;
    el.imgNotice.classList.toggle('calm', boxes.length === 0);
    el.imgWhy.textContent = boxes.length ? 'Why are they blocked?' : 'What does loading them reveal?';
    el.imgNotice.hidden = boxes.length === 0 && loaded.length === 0;
  }

  // Takes back every image approval for this document. It cannot undo what a site already learned.
  function blockImagesAgain() {
    clearApprovals();
    render();
    persist();
    flash('Remote images are blocked again in this document.');
  }

  function approvalsChanged() {
    approvalsEpoch++;
    render();
    persist();
  }

  function scheduleRender() {
    if (renderTimer) clearTimeout(renderTimer);
    cancelJob();
    // Wait a little longer when the last redraw was slow, so typing is never held up by it.
    renderTimer = setTimeout(render, clamp(Math.round(lastRenderCost * 1.5), 40, 900));
  }

  /* ---------------------------------------------------------------- export */

  // The formatted document as HTML text, with real links and images, for files and the clipboard.
  // blockedAsText: replace remote images the reader has not allowed with their description.
  function exportHtml(blockedAsText) {
    var body = safeBody(el.editor.value);
    var doc = body.ownerDocument;
    body.querySelectorAll('[data-mp-slug]').forEach(function (h) { h.setAttribute('id', h.getAttribute('data-mp-slug')); });
    body.querySelectorAll('a').forEach(function (a) {
      var kind = a.getAttribute('data-mp-kind');
      if (kind === 'relative') { unwrap(a); return; }
      if (kind === 'anchor') { a.setAttribute('href', '#' + a.getAttribute('data-mp-target')); return; }
      a.setAttribute('rel', 'noopener noreferrer');
    });
    body.querySelectorAll('img').forEach(function (img) {
      var kind = img.getAttribute('data-mp-kind');
      var alt = (img.getAttribute('alt') || '').trim();
      if (kind === 'unavailable' ||
          (kind === 'remote' && blockedAsText && !imageAllowed(img.getAttribute('data-mp-url'), img.getAttribute('data-mp-host')))) {
        img.replaceWith(doc.createTextNode('[image' + (alt ? ': ' + alt : '') + ']'));
        return;
      }
      if (kind === 'remote') img.setAttribute('referrerpolicy', 'no-referrer');
    });
    body.querySelectorAll('*').forEach(function (node) {
      Array.prototype.slice.call(node.attributes).forEach(function (attr) {
        if (attr.name.indexOf('data-mp-') === 0) node.removeAttribute(attr.name);
      });
    });
    return body.innerHTML;
  }

  function escapeHtml(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function standalonePage() {
    var title = escapeHtml(displayName());
    return '<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n' +
      '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; img-src data: https: http:; style-src \'unsafe-inline\'">\n' +
      '<meta name="referrer" content="no-referrer">\n' +
      '<meta name="viewport" content="width=device-width, initial-scale=1">\n' +
      '<meta name="color-scheme" content="light dark">\n' +
      '<meta name="generator" content="MarkoPad ' + escapeHtml(BUILD.version) + '">\n' +
      '<title>' + title + '</title>\n<style>\n' +
      'html { background: #fff; }\n@media (prefers-color-scheme: dark) { html { background: #15181c; } }\n' +
      'body { margin: 0 auto; max-width: 860px; padding: 32px 20px 64px; }\n' +
      BUILD.mdCss + '</style>\n</head>\n<body class="md">\n' + exportHtml(false) + '\n</body>\n</html>\n';
  }

  /* ====================================================================== names and titles */

  function plainInline(s) {
    return s.replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/<[^>]+>/g, '').replace(/[*_`~]/g, '').trim();
  }
  function firstHeading(text) {
    var m = text.match(/^ {0,3}#{1,6}[ \t]+(.+?)[ \t]*#*[ \t]*$/m);
    return m ? plainInline(m[1]) : '';
  }
  function firstLine(text) {
    var m = text.match(/^[ \t]*(?:[-*+>]|\d+[.)])?[ \t]*(\S.*)$/m);
    return m ? plainInline(m[1]) : '';
  }
  function shorten(s, n) { return s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s; }

  // What this tab is called: file name, else first heading, else first line, else "Untitled 14:05".
  function displayName() {
    if (state.name) return state.name;
    var text = el.editor.value;
    return shorten(firstHeading(text) || firstLine(text), 60) || ('Untitled ' + state.startedAt);
  }
  function updateTitle() {
    document.title = (state.dirty ? '● ' : '') + displayName() + ' · MarkoPad';
  }
  function fileBase() {
    if (state.name) return state.name.replace(/\.(?:md|markdown|mdown|txt|text)$/i, '');
    var fromHeading = firstHeading(el.editor.value)
      .replace(/[\\/:*?"<>|\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().replace(/^\.+/, '');
    return shorten(fromHeading, 80).replace(/…$/, '').replace(/ /g, '-') || 'untitled';
  }

  function updateCounts(text) {
    var lines = text === '' ? 0 : text.split('\n').length;
    var words = (text.match(/\S+/g) || []).length;
    var pairs = (text.match(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g) || []).length;
    el.counts.textContent = plural(lines, 'line', 'lines') + ' · ' + plural(words, 'word', 'words') +
      ' · ' + plural(text.length - pairs, 'character', 'characters');
  }

  /* ====================================================================== recovery copy */

  function snapshot() {
    return JSON.stringify({
      v: 1, text: el.editor.value, name: state.name, dirty: state.dirty, split: state.split,
      view: state.view, theme: state.theme, sync: state.sync, toolbar: state.toolbar, startedAt: state.startedAt,
      approvedUrls: Object.keys(state.approvedUrls), approvedHosts: Object.keys(state.approvedHosts),
      approveAll: state.approveAll
    });
  }
  function showRecovery(on, why) {
    el.recovery.textContent = on ? 'Recovery copy: on' : 'Recovery copy: off';
    el.recovery.classList.toggle('off', !on);
    if (!on) el.recovery.title = why;
  }
  function persist() {
    persistTimer = 0;
    if (!storageWorks) return;
    try {
      sessionStorage.setItem(STORE_KEY, snapshot());
      if (recoveryFailed) { recoveryFailed = false; showRecovery(true); }
    } catch (e) {
      try { sessionStorage.removeItem(STORE_KEY); } catch (e2) { /* nothing more to do */ }
      if (!recoveryFailed) {
        recoveryFailed = true;
        showRecovery(false, 'This document is too large for the browser to keep a recovery copy. A reload would lose it. Download the Markdown file to keep your work.');
        flash('Recovery copy is off: this document is too large for the browser to keep. Download it to be safe.', true);
      }
    }
  }
  function schedulePersist() {
    if (persistTimer) clearTimeout(persistTimer);
    persistTimer = setTimeout(persist, 400);
  }
  function restore() {
    var raw = null;
    try { raw = sessionStorage.getItem(STORE_KEY); } catch (e) { storageWorks = false; }
    if (!storageWorks) {
      showRecovery(false, 'This browser does not allow a recovery copy here. A reload would lose the text.');
      return false;
    }
    if (!raw) return false;
    try {
      var s = JSON.parse(raw);
      if (!s || s.v !== 1 || typeof s.text !== 'string') return false;
      el.editor.value = s.text;
      state.name = typeof s.name === 'string' ? s.name : '';
      state.dirty = s.dirty === true;
      state.split = typeof s.split === 'number' ? clamp(s.split, 10, 90) : 50;
      state.view = ['edit', 'both', 'preview'].indexOf(s.view) >= 0 ? s.view : null;
      state.theme = s.theme === 'light' || s.theme === 'dark' ? s.theme : null;
      state.sync = s.sync !== false;
      state.toolbar = s.toolbar !== false;
      if (typeof s.startedAt === 'string') state.startedAt = s.startedAt;
      (s.approvedUrls || []).forEach(function (u) { state.approvedUrls[u] = true; });
      (s.approvedHosts || []).forEach(function (h) { state.approvedHosts[h] = true; });
      state.approveAll = s.approveAll === true;
      return true;
    } catch (e) { return false; }
  }
  function wipeRecovery() {
    try { sessionStorage.removeItem(STORE_KEY); } catch (e) { /* storage unavailable */ }
  }

  /* ====================================================================== documents */

  function clearApprovals() { state.approvedUrls = {}; state.approvedHosts = {}; state.approveAll = false; approvalsEpoch++; }

  function loadDocument(text, name) {
    el.editor.value = text;
    state.name = name || '';
    state.dirty = false;
    clearApprovals();
    el.editor.scrollTop = 0;
    el.editor.setSelectionRange(0, 0);
    render(text.length < BIG_DOCUMENT);
    el.previewScroll.scrollTop = 0;
    persist();
  }

  function setDirty(value) {
    if (state.dirty === value) return;
    state.dirty = value;
    updateTitle();
  }

  function newDocument() {
    var go = state.dirty
      ? ask({
        title: 'Discard this document?',
        body: 'It has changes you have not downloaded. Starting a new document wipes the text and its recovery copy from this tab.',
        actions: [{ label: 'Discard and start new', value: true, primary: true }, { label: 'Keep working', value: false, focus: true }],
        cancel: false
      })
      : Promise.resolve(true);
    go.then(function (yes) {
      if (!yes) return;
      wipeRecovery();
      state.startedAt = clockNow();
      loadDocument('', '');
      el.editor.focus();
      flash('New document. The old text is gone from this tab.');
    });
  }

  function openFile(file, extraCount) {
    if (!file) return;
    if (file.size > MAX_OPEN_BYTES) {
      ask({ title: 'That file is too large', body: 'MarkoPad opens text files up to 20 MB. “' + file.name + '” is larger.', actions: [{ label: 'OK', value: true, primary: true }], cancel: true });
      return;
    }
    file.text().then(function (text) {
      if (text.slice(0, 8000).indexOf('\u0000') >= 0) {
        return ask({ title: 'That does not look like a text file', body: '“' + file.name + '” seems to be a picture, a document in another format, or a program. MarkoPad opens plain text and Markdown files.', actions: [{ label: 'OK', value: true, primary: true }], cancel: true });
      }
      var go = el.editor.value === ''
        ? Promise.resolve(true)
        : ask({
          title: 'Replace the current document?',
          body: 'Opening “' + file.name + '” replaces the text in this tab.' + (state.dirty ? ' It has changes you have not downloaded.' : '') + ' To keep both, cancel and open the file in a new window instead.',
          actions: [{ label: 'Replace', value: true, primary: true }, { label: 'Cancel', value: false, focus: true }],
          cancel: false
        });
      return go.then(function (yes) {
        if (!yes) return;
        loadDocument(text.replace(/\r\n?/g, '\n'), file.name);
        flash('Opened ' + file.name + (extraCount ? '. Only the first of the ' + (extraCount + 1) + ' files was opened.' : ''));
      });
    }, function () {
      flash('That file could not be read.');
    });
  }

  function download(filename, text, type) {
    var url = URL.createObjectURL(new Blob([text], { type: type }));
    var a = make('a', { href: url, download: filename });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 30000);
  }
  function saveMarkdown() {
    var name = state.name && /\.(?:md|markdown|mdown|txt|text)$/i.test(state.name) ? state.name : fileBase() + '.md';
    download(name, el.editor.value, 'text/markdown;charset=utf-8');
    setDirty(false);
    schedulePersist();
    flash('Downloaded ' + name);
  }
  function saveHtml() {
    var name = fileBase() + '.html';
    download(name, standalonePage(), 'text/html;charset=utf-8');
    flash('Downloaded ' + name);
  }

  /* ====================================================================== clipboard */

  function legacyCopyText(text) {
    var ta = make('textarea', { 'aria-hidden': 'true', tabindex: '-1', class: 'mp-offscreen' });
    ta.value = text;
    document.body.append(ta);
    ta.select();
    var ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    ta.remove();
    return ok;
  }
  function legacyCopyRich(html) {
    var box = make('div', { class: 'md mp-offscreen', 'aria-hidden': 'true' });
    box.contentEditable = 'true';
    moveInto(box, new DOMParser().parseFromString(html, 'text/html').body);
    document.body.append(box);
    var range = document.createRange();
    range.selectNodeContents(box);
    var sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    var ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    sel.removeAllRanges();
    box.remove();
    return ok;
  }
  var CLIPBOARD_HELP = 'The browser would not allow copying here. Browsers give full clipboard access only to pages served over HTTPS or opened from a disk. Select the text and copy it by hand instead.';

  function copyText(text, label) {
    var restoreFocus = document.activeElement;
    var fallback = function () {
      var ok = legacyCopyText(text);
      if (restoreFocus && restoreFocus.focus) restoreFocus.focus();
      flash(ok ? label + ' copied' : CLIPBOARD_HELP, !ok);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { flash(label + ' copied'); }, fallback);
    } else fallback();
  }
  function copyRich() {
    var fallback = function () {
      // This path puts the content in the page for a moment, so images the reader has not
      // allowed are copied as their description, never loaded.
      var ok = legacyCopyRich(exportHtml(true));
      flash(ok ? 'Formatted text copied' : CLIPBOARD_HELP, !ok);
    };
    if (navigator.clipboard && navigator.clipboard.write && window.ClipboardItem) {
      var html = exportHtml(false);
      var plain = el.editor.value;
      navigator.clipboard.write([new ClipboardItem({
        'text/html': new Blob([html], { type: 'text/html' }),
        'text/plain': new Blob([plain], { type: 'text/plain' })
      })]).then(function () { flash('Formatted text copied'); }, fallback);
    } else fallback();
  }

  /* ====================================================================== editing */

  // Replace a range of the text through the browser's editing command, so that undo still works.
  function replaceRange(start, end, text, selStart, selEnd) {
    var ed = el.editor;
    ed.focus();
    ed.setSelectionRange(start, end);
    var ok = false;
    try {
      ok = text === ''
        ? (start === end ? true : document.execCommand('delete'))
        : document.execCommand('insertText', false, text);
    } catch (e) { ok = false; }
    if (!ok) {
      ed.setRangeText(text, start, end, 'end');
      ed.dispatchEvent(new Event('input', { bubbles: true }));
    }
    if (selStart != null) ed.setSelectionRange(selStart, selEnd == null ? selStart : selEnd);
  }

  function indentSelection(outdent) {
    var ed = el.editor, v = ed.value, s = ed.selectionStart, e = ed.selectionEnd;
    if (s === e && !outdent) { replaceRange(s, e, INDENT); return; }
    var lineStart = v.lastIndexOf('\n', s - 1) + 1;
    var scanFrom = e > s && v.charAt(e - 1) === '\n' ? e - 1 : e;
    var lineEnd = v.indexOf('\n', scanFrom);
    if (lineEnd === -1) lineEnd = v.length;
    var first = 0, total = 0;
    var out = v.slice(lineStart, lineEnd).split('\n').map(function (line, i) {
      if (!outdent) { total += INDENT.length; if (i === 0) first = INDENT.length; return INDENT + line; }
      var m = line.match(/^(?: {1,4}|\t)/);
      var n = m ? m[0].length : 0;
      total -= n;
      if (i === 0) first = -n;
      return line.slice(n);
    }).join('\n');
    if (total === 0) return;
    replaceRange(lineStart, lineEnd, out, Math.max(lineStart, s + first), Math.max(lineStart, e + total));
  }

  // Enter inside a list starts the next item; Enter on an empty item ends the list.
  function continueList(ev) {
    var ed = el.editor, v = ed.value, s = ed.selectionStart;
    if (s !== ed.selectionEnd) return;
    var lineStart = v.lastIndexOf('\n', s - 1) + 1;
    var nl = v.indexOf('\n', s);
    var after = v.slice(s, nl === -1 ? v.length : nl);
    var m = v.slice(lineStart, s).match(/^([ \t]*(?:>[ \t]*)*)([-*+]|\d{1,9}[.)])( +)(\[[ xX]\] +)?(.*)$/);
    if (!m) return;
    ev.preventDefault();
    if (m[5].trim() === '' && after.trim() === '') {
      replaceRange(lineStart, s, '');
      return;
    }
    var marker = m[2];
    var num = marker.match(/^(\d+)([.)])$/);
    if (num) marker = (parseInt(num[1], 10) + 1) + num[2];
    replaceRange(s, s, '\n' + m[1] + marker + m[3] + (m[4] ? '[ ] ' : ''));
  }

  // Inserts text at the selection. A block gets blank lines around it as needed. caretFrom/caretTo,
  // offsets within md, say what to select afterwards; by default the caret lands after the text.
  function insertSnippet(md, block, caretFrom, caretTo) {
    var ed = el.editor, v = ed.value, s = ed.selectionStart, e = ed.selectionEnd;
    var text = md, pre = '';
    if (block) {
      var before = v.slice(0, s), after = v.slice(e);
      pre = before === '' || /\n\n$/.test(before) ? '' : /\n$/.test(before) ? '\n' : '\n\n';
      var post = after === '' ? '\n' : /^\n\n/.test(after) ? '' : /^\n/.test(after) ? '\n' : '\n\n';
      text = pre + md + post;
    }
    if (caretFrom == null) replaceRange(s, e, text);
    else replaceRange(s, e, text, s + pre.length + caretFrom, s + pre.length + (caretTo == null ? caretFrom : caretTo));
  }

  /* ====================================================================== formatting toolbar */

  function lineSpan(v, s, e) {
    var start = v.lastIndexOf('\n', s - 1) + 1;
    var scanFrom = e > s && v.charAt(e - 1) === '\n' ? e - 1 : e;
    var end = v.indexOf('\n', scanFrom);
    return [start, end === -1 ? v.length : end];
  }

  // Wraps the selection in an inline mark such as ** or `, or removes it if it is already there.
  // With nothing selected, the word under the caret is used; failing that, a placeholder.
  function wrapInline(mark, placeholder) {
    var ed = el.editor, v = ed.value, s = ed.selectionStart, e = ed.selectionEnd, n = mark.length;
    if (s === e) {
      var ws = s, we = s;
      while (ws > 0 && /[^\s*_`~]/.test(v.charAt(ws - 1))) ws--;
      while (we < v.length && /[^\s*_`~]/.test(v.charAt(we))) we++;
      if (ws === we) { replaceRange(s, s, mark + placeholder + mark, s + n, s + n + placeholder.length); return; }
      s = ws; e = we;
    }
    var inner = v.slice(s, e);
    var lead = inner.match(/^\s*/)[0].length, trail = inner.match(/\s*$/)[0].length;
    if (lead + trail >= inner.length) { replaceRange(s, e, mark + placeholder + mark, s + n, s + n + placeholder.length); return; }
    s += lead; e -= trail; inner = inner.slice(lead, inner.length - trail);
    // The single * of italic must not mistake the ** of bold for itself.
    var starClash = mark === '*' && /^\*\*/.test(inner) && /\*\*$/.test(inner);
    if (!starClash && inner.length >= 2 * n && inner.slice(0, n) === mark && inner.slice(-n) === mark) {
      replaceRange(s, e, inner.slice(n, inner.length - n), s, e - 2 * n);         // selection held the marks
      return;
    }
    var outerClash = mark === '*' && (v.slice(s - 2, s) === '**' || v.slice(e, e + 2) === '**');
    if (!outerClash && v.slice(s - n, s) === mark && v.slice(e, e + n) === mark) {
      replaceRange(s - n, e + n, inner, s - n, e - n);                               // marks sat just outside
      return;
    }
    replaceRange(s, e, mark + inner + mark, s + n, e + n);
  }

  // Applies a change to every selected line (or the current one) and selects the result.
  function editLines(change) {
    var ed = el.editor, v = ed.value, s = ed.selectionStart, e = ed.selectionEnd;
    var span = lineSpan(v, s, e);
    var lines = v.slice(span[0], span[1]).split('\n');
    var out = change(lines).join('\n');
    if (out === lines.join('\n')) { ed.focus(); return; }
    replaceRange(span[0], span[1], out, span[0], span[0] + out.length);
  }
  var LINE_MARK = /^(\s*)(?:[-*+] (?:\[[ xX]\] )?|\d{1,9}[.)] |> ?|#{1,6} )?/;

  // A line prefix such as "- " or "> ": added to every line, or removed when every line has it.
  function togglePrefix(matcher, prefix) {
    editLines(function (lines) {
      var real = lines.filter(function (l) { return l.trim() !== ''; });
      var allHave = real.length > 0 && real.every(function (l) { return matcher.test(l); });
      return lines.map(function (l) {
        if (l.trim() === '') return l;
        var m = l.match(LINE_MARK);
        var indent = m[1], rest = l.slice(m[0].length);
        return allHave ? indent + rest : indent + prefix + rest;
      });
    });
  }
  function toggleNumbered() {
    editLines(function (lines) {
      var real = lines.filter(function (l) { return l.trim() !== ''; });
      var allHave = real.length > 0 && real.every(function (l) { return /^\s*\d{1,9}[.)] /.test(l); });
      var k = 0;
      return lines.map(function (l) {
        if (l.trim() === '') return l;
        var m = l.match(LINE_MARK);
        return allHave ? m[1] + l.slice(m[0].length) : m[1] + (++k) + '. ' + l.slice(m[0].length);
      });
    });
  }
  // Makes every selected line a heading of this level, or plain text if they already are.
  function setHeading(level) {
    editLines(function (lines) {
      var real = lines.filter(function (l) { return l.trim() !== ''; });
      var already = real.length > 0 && real.every(function (l) { return new RegExp('^\\s*#{' + level + '} ').test(l); });
      return lines.map(function (l) {
        if (l.trim() === '') return l;
        var rest = l.replace(/^\s*#{1,6}\s+/, '').replace(/^\s+/, '');
        return already ? rest : '#'.repeat(level) + ' ' + rest;
      });
    });
  }
  function insertLink() {
    var ed = el.editor, v = ed.value, s = ed.selectionStart, e = ed.selectionEnd;
    var text = v.slice(s, e).trim();
    if (text === '') { replaceRange(s, e, '[link text](https://)', s + 1, s + 10); return; }
    if (/^https?:\/\/\S+$/i.test(text)) { replaceRange(s, e, '[link text](' + text + ')', s + 1, s + 10); return; }
    var out = '[' + text + '](https://)';
    replaceRange(s, e, out, s + text.length + 3, s + out.length - 1);                // the address is selected, ready to type
  }
  function insertImage() {
    var ed = el.editor, v = ed.value, s = ed.selectionStart, e = ed.selectionEnd;
    var text = v.slice(s, e).trim();
    if (text === '') { replaceRange(s, e, '![description](https://)', s + 2, s + 13); return; }
    var out = '![' + text + '](https://)';
    replaceRange(s, e, out, s + text.length + 4, s + out.length - 1);
  }
  function insertCodeBlock() {
    var ed = el.editor, v = ed.value, s = ed.selectionStart, e = ed.selectionEnd;
    if (s === e) { insertSnippet('```\n\n```', true, 4); return; }
    var span = lineSpan(v, s, e);
    ed.setSelectionRange(span[0], span[1]);
    insertSnippet('```\n' + v.slice(span[0], span[1]) + '\n```', true, 0, span[1] - span[0] + 8);
  }

  var TOOLS = [
    { id: 'bold', cls: 'tb-b', label: 'B', title: 'Bold (Ctrl+B)', run: function () { wrapInline('**', 'bold text'); } },
    { id: 'italic', cls: 'tb-i', label: 'I', title: 'Italic (Ctrl+I)', run: function () { wrapInline('*', 'italic text'); } },
    { id: 'strike', cls: 'tb-s', label: 'S', title: 'Strikethrough', run: function () { wrapInline('~~', 'crossed out'); } },
    { id: 'code', cls: 'tb-code', label: '<>', title: 'Code inside a sentence', run: function () { wrapInline('`', 'code'); } },
    { gap: true },
    { id: 'h1', label: 'H1', title: 'Biggest heading. Press again to remove.', run: function () { setHeading(1); } },
    { id: 'h2', label: 'H2', title: 'Second-level heading. Press again to remove.', run: function () { setHeading(2); } },
    { id: 'h3', label: 'H3', title: 'Third-level heading. Press again to remove.', run: function () { setHeading(3); } },
    { gap: true },
    { id: 'link', label: 'Link', title: 'Link (Ctrl+K). Select the words first, then type the address.', run: insertLink },
    { id: 'image', label: 'Image', title: 'Image. Select the description first, then type the address.', run: insertImage },
    { gap: true },
    { id: 'ul', label: '• List', title: 'Bulleted list. Press again to remove.', run: function () { togglePrefix(/^\s*[-*+] (?!\[[ xX]\] )/, '- '); } },
    { id: 'ol', label: '1. List', title: 'Numbered list. Press again to remove.', run: toggleNumbered },
    { id: 'task', label: '☑ List', title: 'Checklist. Press again to remove.', run: function () { togglePrefix(/^\s*[-*+] \[[ xX]\] /, '- [ ] '); } },
    { id: 'quote', label: '“ Quote', title: 'Quotation. Press again to remove.', run: function () { togglePrefix(/^\s*> ?/, '> '); } },
    { gap: true },
    { id: 'codeblock', cls: 'tb-block', label: '```', title: 'Code block around the selected lines', run: insertCodeBlock },
    { id: 'table', label: 'Table', title: 'Insert a table', run: function () { insertSnippet('| Column | Column |\n| --- | --- |\n| cell | cell |', true, 2, 8); } },
    { id: 'hr', label: '—', title: 'Dividing line', run: function () { insertSnippet('---', true); } }
  ];
  var toolById = {};

  function buildToolbar() {
    TOOLS.forEach(function (tool, i) {
      if (tool.gap) { el.toolbar.append(make('span', { class: 'tb-gap', 'aria-hidden': 'true' })); return; }
      var b = make('button', { type: 'button', id: 'tb-' + tool.id, text: tool.label, title: tool.title, 'aria-label': tool.title, tabindex: i === 0 ? '0' : '-1' });
      if (tool.cls) b.className = tool.cls;
      // Pressing with a mouse or finger must not take the selection away from the text.
      b.addEventListener('pointerdown', function (ev) { ev.preventDefault(); });
      b.addEventListener('click', function () { if (currentView() === 'preview') setView(narrow ? 'edit' : 'both'); tool.run(); });
      toolById[tool.id] = tool;
      el.toolbar.append(b);
    });
    el.toolbar.addEventListener('keydown', function (ev) {          // arrow keys move along the toolbar
      if (ev.key !== 'ArrowLeft' && ev.key !== 'ArrowRight') return;
      var all = Array.prototype.slice.call(el.toolbar.querySelectorAll('button'));
      var i = all.indexOf(document.activeElement);
      if (i < 0) return;
      var next = all[(i + (ev.key === 'ArrowRight' ? 1 : all.length - 1)) % all.length];
      all.forEach(function (b) { b.tabIndex = -1; });
      next.tabIndex = 0;
      next.focus();
      ev.preventDefault();
    });
  }
  function applyToolbar() {
    el.body.dataset.toolbar = String(state.toolbar);
    el.btnToolbar.setAttribute('aria-pressed', String(state.toolbar));
  }

  var escapeArmed = false;        // Escape, then Tab, leaves the text box
  var wasEmptyBeforeInput = false;

  function onEditorKeydown(ev) {
    if (ev.isComposing) return;
    if (ev.key === 'Escape') { escapeArmed = true; hint('Press Tab to leave the text pane.'); return; }
    if (ev.key === 'Tab' && !ev.ctrlKey && !ev.metaKey && !ev.altKey) {
      if (escapeArmed) { escapeArmed = false; hint(''); return; }
      ev.preventDefault();
      indentSelection(ev.shiftKey);
      return;
    }
    if (ev.key !== 'Shift') escapeArmed = false;
    if (ev.key === 'Enter' && !ev.shiftKey && !ev.ctrlKey && !ev.metaKey && !ev.altKey) { continueList(ev); return; }
    if ((ev.ctrlKey || ev.metaKey) && !ev.altKey && !ev.shiftKey) {
      var tool = { b: 'bold', i: 'italic', k: 'link' }[(ev.key || '').toLowerCase()];
      if (tool) { ev.preventDefault(); toolById[tool].run(); }
    }
  }

  function onEditorInput(ev) {
    var text = el.editor.value;
    var cameFromOutside = ev && (ev.inputType === 'insertFromPaste' || ev.inputType === 'insertFromDrop');
    if (text === '') setDirty(false);                                  // nothing left to lose
    else if (cameFromOutside && wasEmptyBeforeInput) setDirty(false);   // pasted to read, not edited
    else setDirty(true);
    scheduleRender();
    schedulePersist();
  }

  /* ====================================================================== scrolling together */

  var ignoreScrollOn = null, ignoreUntil = 0;
  function ratioOf(box) {
    var range = box.scrollHeight - box.clientHeight;
    return range > 0 ? box.scrollTop / range : null;
  }
  function scrollToRatio(box, ratio) {
    ignoreScrollOn = box;
    ignoreUntil = Date.now() + 120;
    box.scrollTop = ratio * (box.scrollHeight - box.clientHeight);
  }
  function followEditor() {
    var r = ratioOf(el.editor);
    if (r === null) {          // text too short to scroll: follow the cursor instead
      var len = el.editor.value.length;
      r = len ? el.editor.selectionStart / len : 0;
    }
    scrollToRatio(el.previewScroll, r);
  }
  function onScroll(source, target) {
    if (!state.sync || currentView() !== 'both') return;
    if (ignoreScrollOn === source && Date.now() < ignoreUntil) return;
    var r = ratioOf(source);
    if (r !== null) scrollToRatio(target, r);
  }

  /* ====================================================================== layout */

  function currentView() { return state.view || (narrow ? 'edit' : 'both'); }
  function applyView() {
    var view = currentView();
    el.body.dataset.view = view;
    el.body.dataset.narrow = String(narrow);
    el.viewEdit.setAttribute('aria-pressed', String(view === 'edit'));
    el.viewBoth.setAttribute('aria-pressed', String(view === 'both'));
    el.viewPreview.setAttribute('aria-pressed', String(view === 'preview'));
    el.divider.setAttribute('aria-orientation', narrow ? 'horizontal' : 'vertical');
  }
  function setView(view) { state.view = view; applyView(); schedulePersist(); }

  function applySplit() {
    el.panes.style.setProperty('--split', String(state.split));
    el.divider.setAttribute('aria-valuenow', String(Math.round(state.split)));
  }
  function setSplit(pct) { state.split = clamp(pct, 10, 90); applySplit(); schedulePersist(); }

  function setupDivider() {
    var dragging = false, moved = false, lastTap = 0;
    var d = el.divider;
    d.addEventListener('pointerdown', function (ev) {
      if (ev.button !== undefined && ev.button !== 0) return;
      dragging = true; moved = false;
      try { d.setPointerCapture(ev.pointerId); } catch (e) { /* capture is a nicety */ }
      d.classList.add('dragging');
      el.body.classList.add('dragging');
      ev.preventDefault();
    });
    d.addEventListener('pointermove', function (ev) {
      if (!dragging) return;
      var rect = el.panes.getBoundingClientRect();
      var pct = narrow ? (ev.clientY - rect.top) / rect.height * 100 : (ev.clientX - rect.left) / rect.width * 100;
      if (Math.abs(pct - state.split) > 0.3) moved = true;
      setSplit(pct);
    });
    var stop = function (ev) {
      if (!dragging) return;
      dragging = false;
      d.classList.remove('dragging');
      el.body.classList.remove('dragging');
      if (ev.type === 'pointerup' && !moved) {            // a tap: two in a row centres the divider
        var now = Date.now();
        if (now - lastTap < 400) { setSplit(50); lastTap = 0; } else lastTap = now;
      }
    };
    d.addEventListener('pointerup', stop);
    d.addEventListener('pointercancel', stop);
    d.addEventListener('keydown', function (ev) {
      var back = narrow ? 'ArrowUp' : 'ArrowLeft', fwd = narrow ? 'ArrowDown' : 'ArrowRight';
      if (ev.key === back) setSplit(state.split - 2);
      else if (ev.key === fwd) setSplit(state.split + 2);
      else if (ev.key === 'Home') setSplit(10);
      else if (ev.key === 'End') setSplit(90);
      else if (ev.key === 'Enter' || ev.key === ' ') setSplit(50);
      else return;
      ev.preventDefault();
    });
  }

  function systemDark() { return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches; }
  function applyTheme() {
    if (state.theme) el.root.dataset.theme = state.theme; else delete el.root.dataset.theme;
    var dark = state.theme ? state.theme === 'dark' : systemDark();
    el.btnTheme.textContent = dark ? 'Light' : 'Dark';
  }
  function applySync() {
    el.btnSync.setAttribute('aria-pressed', String(state.sync));
    el.btnSync.title = state.sync ? 'The panes scroll together. Click to turn off.' : 'The panes scroll separately. Click to scroll them together.';
  }

  /* ====================================================================== menus */

  var openMenu = null;
  function closeMenu(refocus) {
    if (!openMenu) return;
    openMenu.list.hidden = true;
    openMenu.button.setAttribute('aria-expanded', 'false');
    if (refocus) openMenu.button.focus();
    openMenu = null;
  }
  function setupMenu(button, list) {
    var items = function () { return Array.prototype.slice.call(list.querySelectorAll('[role="menuitem"]')); };
    button.addEventListener('click', function () {
      var wasOpen = openMenu && openMenu.list === list;
      closeMenu(false);
      if (wasOpen) return;
      list.hidden = false;
      button.setAttribute('aria-expanded', 'true');
      openMenu = { button: button, list: list };
      items()[0].focus();
    });
    list.addEventListener('keydown', function (ev) {
      var all = items(), i = all.indexOf(document.activeElement);
      if (ev.key === 'ArrowDown') { all[(i + 1) % all.length].focus(); ev.preventDefault(); }
      else if (ev.key === 'ArrowUp') { all[(i - 1 + all.length) % all.length].focus(); ev.preventDefault(); }
      else if (ev.key === 'Escape') { closeMenu(true); ev.stopPropagation(); }
      else if (ev.key === 'Tab') closeMenu(false);
    });
    list.addEventListener('click', function () { closeMenu(false); });
  }

  /* ====================================================================== links and images in the preview */

  function confirmLink(a) {
    var url = a.getAttribute('data-mp-url');
    var isMail = a.getAttribute('data-mp-kind') === 'mail';
    var warnings = linkWarnings(url, a.getAttribute('data-mp-text') || '');
    var parsed = new URL(url);
    var where = isMail ? decodeURIComponentSafe(parsed.pathname) : parsed.host;
    var body = [
      make('p', { text: isMail ? 'This link starts an email to' : 'This link goes to' }),
      make('p', { class: 'host', text: where })
    ];
    if (warnings.length) {
      body.push(make('ul', { class: 'warnbox' }, warnings.map(function (w) { return make('li', { text: w }); })));
    }
    body.push(make('p', { text: 'Full address:' }));
    body.push(make('code', { class: 'addr', text: url }));
    if (!isMail) body.push(make('p', { text: 'MarkoPad cannot tell whether this site is safe. Open it only if you trust it.' }));
    ask({
      title: warnings.length ? 'Check this link carefully' : 'Open this link?',
      body: body,
      actions: [
        { label: isMail ? 'Write the email' : 'Open in a new tab', value: 'open', primary: !warnings.length },
        { label: 'Copy address', run: function (btn) { copyText(url, 'Address'); btn.textContent = 'Copied'; } },
        { label: 'Cancel', value: 'cancel', focus: true }
      ],
      cancel: 'cancel'
    }).then(function (choice) {
      if (choice === 'open') window.open(url, '_blank', 'noopener,noreferrer');
    });
  }

  function jumpToHeading(target, container, scroller) {
    assignSlugs(container);
    var want = slugify(target) || target;
    var hit = null;
    container.querySelectorAll('[data-mp-slug]').forEach(function (h) {
      if (!hit && (h.getAttribute('data-mp-slug') === want || h.getAttribute('data-mp-slug') === target)) hit = h;
    });
    if (!hit) { flash('No heading in this document matches “#' + target + '”.'); return false; }
    var top = hit.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop - 8;
    ignoreScrollOn = el.editor; ignoreUntil = Date.now() + 200;
    scroller.scrollTop = top;
    return true;
  }

  function activate(ev, container, scroller) {
    var t = ev.target;
    if (!(t instanceof Element)) return;
    var btn = t.closest('button[data-mp-act]');
    if (btn && container.contains(btn)) {
      ev.preventDefault();
      var box = btn.closest('.mp-blocked');
      if (btn.getAttribute('data-mp-act') === 'host') {
        state.approvedHosts[box.getAttribute('data-mp-host')] = true;
        flash('Loading images from ' + box.getAttribute('data-mp-host'));
      } else {
        state.approvedUrls[box.getAttribute('data-mp-url')] = true;
      }
      approvalsChanged();
      return;
    }
    var a = t.closest('a');
    if (!a || !container.contains(a)) return;
    ev.preventDefault();
    var kind = a.getAttribute('data-mp-kind');
    if (kind === 'anchor') jumpToHeading(a.getAttribute('data-mp-target'), container, scroller);
    else if (kind === 'web' || kind === 'mail') confirmLink(a);
  }
  function wireRendered(container, scroller) {
    container.addEventListener('click', function (ev) { activate(ev, container, scroller); });
    container.addEventListener('auxclick', function (ev) { if (ev.button === 1) activate(ev, container, scroller); });
    container.addEventListener('keydown', function (ev) {
      if ((ev.key === 'Enter' || ev.key === ' ') && ev.target instanceof Element && ev.target.matches('a[role="link"]')) activate(ev, container, scroller);
    });
    var show = function (ev) {
      var a = ev.target instanceof Element ? ev.target.closest('a[data-mp-url]') : null;
      if (a) hint((a.getAttribute('data-mp-kind') === 'mail' ? 'Email link: ' : 'Link goes to: ') + a.getAttribute('data-mp-url'));
    };
    var hide = function (ev) {
      if (ev.target instanceof Element && ev.target.closest('a[data-mp-url]')) hint('');
    };
    container.addEventListener('mouseover', show);
    container.addEventListener('focusin', show);
    container.addEventListener('mouseout', hide);
    container.addEventListener('focusout', hide);
  }

  /* ====================================================================== How do I…? */

  var howtoBuilt = false;
  function buildHowto() {
    if (howtoBuilt) return;
    howtoBuilt = true;
    BUILD.howto.forEach(function (entry) {
      var card = make('section', { class: 'how' });
      card.dataset.words = (entry.t + ' ' + (entry.k || '')).toLowerCase();
      card.dataset.code = (entry.md || '').toLowerCase();
      card.append(make('h3', { text: entry.t }));
      if (!entry.none) {
        var sample = make('div', { class: 'md' });
        var body = safeBody(entry.demo || entry.md);
        decoratePreview(body, false);
        moveInto(sample, body);
        card.append(make('div', { class: 'how-cols' }, [
          make('div', null, [make('p', { class: 'how-label', text: 'You type' }), make('pre', { class: 'how-src', text: entry.md })]),
          make('div', null, [make('p', { class: 'how-label', text: 'You get' }), sample])
        ]));
      }
      if (entry.note) card.append(make('p', { class: 'how-note', text: entry.note }));
      if (!entry.none) {
        var insert = make('button', { type: 'button', class: 'primary', text: 'Insert', title: 'Put this example into the text where the cursor is' });
        insert.addEventListener('click', function () {
          if (currentView() === 'preview') setView(narrow ? 'edit' : 'both');
          insertSnippet(entry.md, entry.block === true);
          if (narrow) toggleHowto(false);
          flash('Inserted: ' + entry.t);
        });
        var copy = make('button', { type: 'button', text: 'Copy', title: 'Copy this example to the clipboard' });
        copy.addEventListener('click', function () { copyText(entry.md, 'Example'); });
        card.append(make('div', { class: 'how-actions' }, [insert, copy]));
      }
      el.howtoList.append(card);
    });
    el.howtoList.append(make('p', { id: 'howto-empty', text: 'Nothing matches. Try a simpler word, or open Help for the full reference.', hidden: '' }));
    wireRendered(el.howtoList, el.howtoList);
  }
  function filterHowto() {
    var words = el.howtoSearch.value.toLowerCase().split(/\s+/).filter(Boolean);
    var shown = 0;
    el.howtoList.querySelectorAll('.how').forEach(function (card) {
      // A word matches the start of a title or keyword word ("tab" finds Table, not Vegetables).
      // Symbols such as ** or ~~ are looked up in the example itself.
      var known = card.dataset.words.split(/[^\p{L}\p{N}]+/u);
      var hit = words.every(function (w) {
        if (!/[\p{L}\p{N}]/u.test(w)) return card.dataset.code.indexOf(w) >= 0;
        return known.some(function (k) { return k.indexOf(w) === 0; });
      });
      card.hidden = !hit;
      if (hit) shown++;
    });
    $('howto-empty').hidden = shown > 0;
  }
  function toggleHowto(open) {
    var show = open === undefined ? el.howto.hidden : open;
    if (show) buildHowto();
    el.howto.hidden = !show;
    el.btnHowto.setAttribute('aria-expanded', String(show));
    if (show) el.howtoSearch.focus(); else el.btnHowto.focus();
  }

  /* ====================================================================== start-up */

  function readStartHash() {
    var hash = location.hash;
    if (hash === '#new') return { kind: 'new' };
    if (hash === '#help' || hash.indexOf('#help=') === 0) return { kind: 'help', target: hash.slice(6) };
    return { kind: 'restore' };
  }
  function clearHash() {
    if (!location.hash) return;
    try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { /* tried below */ }
    // A leftover "#new" would wipe the document on the next reload, so make sure it is gone.
    if (location.hash) { try { location.replace(location.pathname + location.search + '#'); } catch (e) { /* nothing more to try */ } }
  }

  function wire() {
    el.editor.addEventListener('beforeinput', function () { wasEmptyBeforeInput = el.editor.value === ''; });
    el.editor.addEventListener('paste', function () { wasEmptyBeforeInput = el.editor.value === ''; });
    el.editor.addEventListener('input', onEditorInput);
    el.editor.addEventListener('keydown', onEditorKeydown);
    el.editor.addEventListener('blur', function () { escapeArmed = false; });
    el.editor.addEventListener('scroll', function () { onScroll(el.editor, el.previewScroll); }, { passive: true });
    el.previewScroll.addEventListener('scroll', function () { onScroll(el.previewScroll, el.editor); }, { passive: true });

    el.btnNew.addEventListener('click', newDocument);
    el.btnOpen.addEventListener('click', function () { el.fileInput.click(); });
    el.fileInput.addEventListener('change', function () {
      var files = el.fileInput.files;
      if (files && files.length) openFile(files[0], files.length - 1);
      el.fileInput.value = '';
    });
    setupMenu(el.btnDownload, el.menuDownload);
    setupMenu(el.btnCopy, el.menuCopy);
    el.actSaveMd.addEventListener('click', saveMarkdown);
    el.actSaveHtml.addEventListener('click', saveHtml);
    el.actPrint.addEventListener('click', function () { render(true); window.print(); });
    el.actCopyMd.addEventListener('click', function () { copyText(el.editor.value, 'Markdown'); });
    el.actCopyRich.addEventListener('click', copyRich);
    el.actCopyHtml.addEventListener('click', function () { copyText(exportHtml(false), 'HTML'); });

    el.viewEdit.addEventListener('click', function () { setView('edit'); });
    el.viewBoth.addEventListener('click', function () { setView('both'); });
    el.viewPreview.addEventListener('click', function () { setView('preview'); });
    el.btnSync.addEventListener('click', function () { state.sync = !state.sync; applySync(); schedulePersist(); });
    el.btnToolbar.addEventListener('click', function () { state.toolbar = !state.toolbar; applyToolbar(); schedulePersist(); });
    el.btnTheme.addEventListener('click', function () {
      var dark = state.theme ? state.theme === 'dark' : systemDark();
      state.theme = dark ? 'light' : 'dark';
      applyTheme();
      schedulePersist();
    });
    el.btnHowto.addEventListener('click', function () { toggleHowto(); });
    el.howtoClose.addEventListener('click', function () { toggleHowto(false); });
    el.howtoSearch.addEventListener('input', filterHowto);
    el.imgLoadAll.addEventListener('click', function () { state.approveAll = true; approvalsChanged(); flash('Loading every image in this document'); });
    el.imgBlockAgain.addEventListener('click', blockImagesAgain);

    wireRendered(el.preview, el.previewScroll);
    setupDivider();

    document.addEventListener('pointerdown', function (ev) {
      if (openMenu && !openMenu.list.contains(ev.target) && ev.target !== openMenu.button) closeMenu(false);
    });
    window.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape') {
        if (openMenu) { closeMenu(true); return; }
        if (!el.howto.hidden && !el.dlg.open && document.activeElement !== el.editor) { toggleHowto(false); return; }
      }
      var mod = (ev.ctrlKey || ev.metaKey) && !ev.altKey && !ev.shiftKey;
      if (!mod || el.dlg.open) return;
      var key = (ev.key || '').toLowerCase();
      if (key === 'o') { ev.preventDefault(); el.fileInput.click(); }
      else if (key === 's') { ev.preventDefault(); saveMarkdown(); }
    });

    // Dropping a file anywhere on the page opens it. Dragged text still drops into the text box.
    var dragDepth = 0;
    var hasFiles = function (ev) { return ev.dataTransfer && Array.prototype.indexOf.call(ev.dataTransfer.types || [], 'Files') >= 0; };
    window.addEventListener('dragenter', function (ev) { if (hasFiles(ev)) { dragDepth++; el.dropOverlay.hidden = false; ev.preventDefault(); } });
    window.addEventListener('dragover', function (ev) { if (hasFiles(ev)) { ev.preventDefault(); ev.dataTransfer.dropEffect = 'copy'; } });
    window.addEventListener('dragleave', function (ev) { if (hasFiles(ev) && --dragDepth <= 0) { dragDepth = 0; el.dropOverlay.hidden = true; } });
    window.addEventListener('drop', function (ev) {
      if (!hasFiles(ev)) return;
      ev.preventDefault();
      dragDepth = 0;
      el.dropOverlay.hidden = true;
      var files = ev.dataTransfer.files;
      if (files && files.length) openFile(files[0], files.length - 1);
    });

    window.addEventListener('beforeunload', function (ev) {
      if (persistTimer) persist();
      if (!state.dirty) return;
      ev.preventDefault();
      ev.returnValue = '';
    });
    window.addEventListener('pagehide', function () { if (persistTimer) persist(); });
    window.addEventListener('beforeprint', function () { if (job || renderTimer) render(true); });
    document.addEventListener('visibilitychange', function () { if (document.hidden && persistTimer) persist(); });

    var mq = window.matchMedia(NARROW_QUERY);
    var onWidth = function () { narrow = mq.matches; applyView(); };
    if (mq.addEventListener) mq.addEventListener('change', onWidth); else mq.addListener(onWidth);
    var dark = window.matchMedia('(prefers-color-scheme: dark)');
    if (dark.addEventListener) dark.addEventListener('change', applyTheme);
  }

  function start() {
    narrow = window.matchMedia(NARROW_QUERY).matches;
    var boot = readStartHash();
    var helpTarget = '';
    if (boot.kind === 'new') {
      wipeRecovery();
      restore();                    // only to learn whether storage works
    } else if (boot.kind === 'help') {
      wipeRecovery();
      restore();
      el.editor.value = BUILD.help;
      state.name = 'MarkoPad Help';
      state.view = narrow ? 'preview' : 'both';
      helpTarget = boot.target;
    } else {
      restore();
    }
    clearHash();
    el.version.textContent = 'v' + BUILD.version;
    el.version.title = 'MarkoPad version ' + BUILD.version;
    applyTheme();
    applySync();
    buildToolbar();
    applyToolbar();
    applySplit();
    applyView();
    wire();
    render(el.editor.value.length < BIG_DOCUMENT);
    if (boot.kind !== 'restore') persist();
    if (helpTarget) requestAnimationFrame(function () { jumpToHeading(helpTarget, el.preview, el.previewScroll); });
    else if (boot.kind !== 'help' && !narrow) el.editor.focus();
  }

  window.MarkoPad = { version: BUILD.version };
  start();
})();
