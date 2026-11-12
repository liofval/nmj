/* NEXT MOVE TICKETS — 共通ヘッダー／フッター・画面部品
   data.js の後に読み込む（どちらも defer）。fetch を使わないので file:// で直接開いても動く。
     <script src="data.js" defer></script>
     <script src="common.js" defer></script>
   ページ固有の処理は NMT.ready(function (db, ui) { … }) の中に書く（ヘッダー差し込みの後に呼ばれる）。

   差し込み:
     <div data-header="default"></div>                       … Top 用（Header）
     <div data-header="v2" data-active="home|events|media"></div>  … 下層ページ用（Header v2）
     <div data-header="org" data-active="dashboard|events|settings"></div>
                                                             … 主催者用（Header Org）。団体は URL の ?org= か、ログイン中の人の最初の団体
     <div data-footer></div>                                 … Footer v2
   右下に「DEMO」バー（ログイン中の人の切り替え・データのリセット）を出す。 */
(function () {
  'use strict';

  // 画面とファイルの対応（wireframes.html の画面一覧と同じ並び）
  var PAGES = {
    top: 'index.html',
    events: 'events.html',            // /events（?q= で検索 /search も兼ねる）
    eventsList: 'events-list.html',
    calendar: 'calendar.html',        // /events/calendar
    event: 'event.html',              // /events/[id]       ?id=
    media: 'media.html',
    article: 'article.html',          // /media/[slug]      ?slug=
    organizer: 'organizer.html',      // /@[slug]           ?slug=
    login: 'login.html',              // /login（初回設定を含む）
    apply: 'apply.html',              // /events/[id]/apply ?id=
    checkout: 'checkout.html',        // /mock/checkout/[ref] ?payment=
    mypage: 'mypage.html',            // /me
    ticket: 'ticket.html',            // /me/tickets/[id]   ?id=
    profile: 'profile.html',          // /me/settings（プロフィール編集・メール設定）
    following: 'following.html',      // /me/following
    saved: 'saved.html',              // /me/favorites
    dashboard: 'dashboard.html',      // /manage/@[slug]    ?org=
    groupNew: 'group-new.html',       // /groups/new
    groupSettings: 'group-settings.html', // /@[slug]/settings ?org=
    eventCreate: 'event-create.html', // /events/new        ?org= ／ 編集 ?id=
    attendees: 'attendees.html',      // /manage/events/[id]/attendees ?id=
    checkin: 'checkin.html',          // /manage/events/[id]/checkin   ?id=
    announce: 'announce.html',        // /manage/events/[id]/announce  ?id=
    transfer: 'transfer.html',        // /manage/events/[id]/transfer  ?id=
    adminReports: 'admin-reports.html' // /admin/reports
  };

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function param(name) { return new URLSearchParams(location.search).get(name); }
  function url(page, params) {
    var q = params ? Object.keys(params).filter(function (k) { return params[k] != null && params[k] !== ''; }).map(function (k) { return encodeURIComponent(k) + '=' + encodeURIComponent(params[k]); }).join('&') : '';
    return PAGES[page] + (q ? '?' + q : '');
  }
  function db() { return window.NMT && window.NMT.db; }
  function fmt() { return window.NMT.fmt; }

  // ---------- ヘッダー ----------
  function rightParticipant(compact) {
    var u = db() && db().currentUser();
    var search = '<a href="' + url('events') + '#q" aria-label="検索"><img class="icon" src="assets/icon-search.svg" alt=""></a>';
    var onLogin = location.pathname.split('/').pop() === PAGES.login;
    if (!u) return search + '<a class="mytickets" href="' + url('mypage') + '">My Tickets</a>' + (onLogin ? '' : '<a class="header-login" href="' + url('login', { next: location.pathname.split('/').pop() + location.search }) + '">ログイン</a>');
    return search + '<a class="mytickets" href="' + url('mypage') + '">My Tickets</a>' +
      (compact ? '<a href="' + url('mypage') + '" aria-label="マイページ"><img class="avatar" src="assets/avatar.svg" alt=""></a>' : '');
  }
  function headerDefault() {
    return '' +
      '<header class="header">' +
        '<div class="wrap header__inner">' +
          '<a class="header__logo" href="' + url('top') + '">NEXT MOVE TICKETS</a>' +
          '<nav class="header__nav" aria-label="メイン">' +
            '<a href="' + url('events') + '">イベント</a>' +
            '<a href="' + organizerEntry() + '">主催者の方へ</a>' +
            '<a href="' + url('media') + '">ガイド</a>' +
            '<a href="' + url('media') + '">ニュース</a>' +
          '</nav>' +
          '<div class="header__right">' + rightParticipant(false) + '</div>' +
        '</div>' +
      '</header>';
  }
  function organizerEntry() {
    var d = db(), u = d && d.currentUser();
    if (!u) return url('login', { next: PAGES.groupNew });
    var orgs = d.managedOrganizers(u.id).filter(function (o) { return o.type === 'GROUP'; });
    return orgs.length ? url('dashboard', { org: orgs[0].slug }) : url('groupNew');
  }
  function headerV2(active) {
    var tabs = [['home', 'ホーム', url('top')], ['events', 'イベント', url('events')], ['media', 'メディア', url('media')]];
    var tabHtml = tabs.map(function (t) {
      var on = t[0] === active;
      return '<a class="header-v2__tab' + (on ? ' is-active' : '') + '" href="' + t[2] + '"' + (on ? ' aria-current="page"' : '') + '>' + t[1] + '</a>';
    }).join('');
    return '' +
      '<header class="header-v2">' +
        '<div class="wrap header-v2__inner">' +
          '<div class="header-v2__left">' +
            '<a class="header-v2__logo" href="' + url('top') + '">NEXT MOVE</a>' +
            '<nav class="header-v2__tabs" aria-label="メイン">' + tabHtml + '</nav>' +
          '</div>' +
          '<div class="header-v2__right">' + rightParticipant(true) + '</div>' +
        '</div>' +
      '</header>';
  }
  // 主催者ヘッダーで扱う団体（?org= → ?id= のイベントの主催者 → ログイン中の人の最初の団体）
  function currentOrg() {
    var d = db(); if (!d) return null;
    var slug = param('org');
    if (slug) { var o = d.organizerBySlug(slug); if (o) return o; }
    var eid = param('id') || param('event');
    if (eid) { var e = d.eventById(eid); if (e) return d.organizerById(e.organizerId); }
    var u = d.currentUser();
    var mine = u ? d.managedOrganizers(u.id) : [];
    return mine[0] || null;
  }
  function headerOrg(active) {
    var d = db(), org = currentOrg(), u = d && d.currentUser();
    var mine = u ? d.managedOrganizers(u.id) : [];
    var name = org ? org.displayName + (org.type === 'USER' ? '（個人）' : '') : '団体がありません';
    var slug = org ? org.slug : '';
    var nav = [
      ['dashboard', 'ダッシュボード', url('dashboard', { org: slug })],
      ['events', 'イベント', url('eventCreate', { org: slug })],
      ['settings', '設定', org && org.type === 'GROUP' ? url('groupSettings', { org: slug }) : url('profile')]
    ];
    var navHtml = nav.map(function (n) {
      var on = n[0] === active;
      return '<a class="' + (on ? 'is-active' : '') + '" href="' + n[2] + '"' + (on ? ' aria-current="page"' : '') + '>' + n[1] + '</a>';
    }).join('');
    var menu = mine.map(function (o) {
      return '<a href="' + url('dashboard', { org: o.slug }) + '"' + (org && o.id === org.id ? ' aria-current="true"' : '') + '>' + esc(o.displayName) + (o.type === 'USER' ? '（個人）' : '') + '</a>';
    }).join('') + '<a href="' + url('groupNew') + '">＋ 新しい団体を作る</a>';
    return '' +
      '<header class="header-org">' +
        '<div class="wrap header-org__inner">' +
          '<div class="header-org__left">' +
            '<a class="header-org__logo" href="' + url('dashboard', { org: slug }) + '">NEXT MOVE</a>' +
            '<span class="header-org__badge">' + (d && d.isAdmin() && active === 'admin' ? '運営' : '主催者') + '</span>' +
            '<span class="org-switcher-wrap">' +
              '<button class="org-switcher" type="button" aria-haspopup="true" aria-expanded="false" data-org-switcher>' +
                '<span class="org-switcher__swatch"></span>' +
                '<span class="org-switcher__name">' + esc(name) + '</span>' +
                '<span class="org-switcher__caret" aria-hidden="true">▼</span>' +
              '</button>' +
              '<span class="org-menu" hidden data-org-menu>' + menu + '</span>' +
            '</span>' +
            '<nav class="header-org__nav" aria-label="主催者メニュー">' + navHtml + '</nav>' +
          '</div>' +
          '<a class="header-org__switch" href="' + url('top') + '">参加者側へ →</a>' +
        '</div>' +
      '</header>';
  }
  function footer() {
    function col(title, links) {
      return '<div class="footer__col"><p class="footer__col-title t-mono-label">' + title + '</p>' +
        links.map(function (l) { return '<a href="' + l[1] + '">' + l[0] + '</a>'; }).join('') + '</div>';
    }
    return '' +
      '<footer class="footer">' +
        '<div class="wrap footer__inner">' +
          '<div class="footer__top">' +
            '<div class="footer__cols">' +
              col('Find', [['イベント', url('events')], ['カテゴリ', url('events') + '#genre'], ['エリア', url('events') + '#area']]) +
              col('Host', [['主催者の方へ', organizerEntry()], ['掲載の流れ', url('media')], ['手数料', url('media')]]) +
              col('Help', [['ガイド', url('media')], ['よくある質問', url('media')], ['お問い合わせ', 'mailto:info@example.com']]) +
            '</div>' +
          '</div>' +
          '<p class="footer__mark" aria-hidden="true">NEXT MOVE</p>' +
          '<div class="footer__bottom">' +
            '<p class="t-mono-body">© 2026 NEXT MOVE JAPAN</p>' +
            '<nav class="footer__legal" aria-label="規約">' +
              '<a href="' + url('media') + '">利用規約</a><a href="' + url('media') + '">プライバシー</a><a href="' + url('media') + '">特定商取引法に基づく表記</a>' +
            '</nav>' +
          '</div>' +
        '</div>' +
      '</footer>';
  }

  // ---------- デモバー ----------
  function demoBar() {
    var d = db(); if (!d) return;
    var u = d.currentUser();
    var people = [['u-yamada', 'やまだ（参加者・慶應軽音 owner）'], ['u-mio', 'みお（慶應軽音 owner）'], ['u-saki', 'さき（青学 Link owner）'], ['u-p150', 'ゲスト（参加者のみ）'], ['u-admin', 'NMJ 運営（admin）']];
    var el = document.createElement('div');
    el.className = 'demo-bar';
    el.setAttribute('role', 'region'); el.setAttribute('aria-label', 'デモの操作');
    el.innerHTML = '<span class="demo-bar__tag">DEMO</span>' +
      '<label class="sr-only" for="demo-user">ログイン中の人</label>' +
      '<select id="demo-user"><option value="">ログアウト中</option>' + people.map(function (p) { return '<option value="' + p[0] + '"' + (u && u.id === p[0] ? ' selected' : '') + '>' + esc(p[1]) + '</option>'; }).join('') +
      (u && !people.some(function (p) { return p[0] === u.id; }) ? '<option value="' + esc(u.id) + '" selected>' + esc(d.profileOf(u.id).displayName) + '</option>' : '') + '</select>' +
      '<button type="button" data-demo-reset>リセット</button>';
    document.body.appendChild(el);
    el.querySelector('select').addEventListener('change', function (ev) {
      if (ev.target.value) d.login(ev.target.value); else d.logout();
      location.reload();
    });
    el.querySelector('[data-demo-reset]').addEventListener('click', function () {
      ui.confirm({ title: 'デモのデータを最初の状態に戻しますか？', body: '申込・保存・作ったイベントなど、このブラウザで操作した内容が消えます。', ok: 'リセットする', danger: true }).then(function (yes) {
        if (yes) { d.reset(); location.href = url('top'); }
      });
    });
  }

  // ---------- 画面部品 ----------
  var ui = {
    esc: esc, param: param, url: url, pages: PAGES,
    // Figma の EventCard v2 と同じマークアップ
    eventCard: function (e, opts) {
      var d = db(), f = fmt(), o = d.organizerById(e.organizerId), b = d.eventBadge(e.id), pr = d.priceRange(e.id);
      var price = f.priceLabel(pr);
      return '<a class="event-card" href="' + url('event', { id: e.id }) + '">' +
        '<img class="event-card__flyer" src="' + esc(e.coverUrl) + '" alt="' + esc(e.title) + ' のフライヤー" loading="lazy">' +
        '<p class="event-card__date">' + f.card(e.startAt) + '</p>' +
        '<h3 class="event-card__title">' + esc(e.title) + '</h3>' +
        '<p class="event-card__venue">' + esc(e.venueName || 'オンライン') + '</p>' +
        '<p class="event-card__org">' + esc(o ? o.displayName : '') + '</p>' +
        '<div class="event-card__bottom"><span class="price' + (price === '無料' ? ' price--free' : '') + '">' + price + '</span>' + ui.pill(b) + '</div>' +
      '</a>';
    },
    pill: function (b) { return '<span class="pill pill--' + b.kind + '">' + esc(b.label) + '</span>'; },
    toast: function (msg) {
      var el = document.createElement('div'); el.className = 'toast'; el.setAttribute('role', 'status'); el.textContent = msg;
      document.body.appendChild(el); setTimeout(function () { el.remove(); }, 2600);
    },
    // { title, html, actions:[{label, value, kind:'black'|'outline'|'danger'}] } → Promise(value|null)
    modal: function (o) {
      return new Promise(function (resolve) {
        var prev = document.activeElement;
        var wrap = document.createElement('div');
        wrap.className = 'modal';
        wrap.innerHTML = '<div class="modal__panel" role="dialog" aria-modal="true" aria-labelledby="modal-title">' +
          '<button class="modal__close" type="button" aria-label="閉じる">×</button>' +
          '<h2 class="modal__title" id="modal-title">' + esc(o.title) + '</h2>' +
          '<div class="modal__body">' + (o.html || '') + '</div>' +
          '<div class="modal__actions">' + (o.actions || []).map(function (a, i) {
            return '<button type="button" class="btn btn--sm btn--' + (a.kind || 'black') + '" data-i="' + i + '">' + esc(a.label) + '</button>';
          }).join('') + '</div></div>';
        function close(v) { wrap.remove(); document.removeEventListener('keydown', onKey); if (prev && prev.focus) prev.focus(); resolve(v); }
        function onKey(ev) { if (ev.key === 'Escape') close(null); }
        wrap.addEventListener('click', function (ev) {
          if (ev.target === wrap || ev.target.closest('.modal__close')) return close(null);
          var b = ev.target.closest('[data-i]'); if (!b) return;
          var a = o.actions[+b.getAttribute('data-i')];
          if (a.onClick) { var r = a.onClick(wrap); if (r === false) return; }
          close(a.value === undefined ? true : a.value);
        });
        document.addEventListener('keydown', onKey);
        document.body.appendChild(wrap);
        var first = wrap.querySelector('input, select, textarea, .modal__actions button');
        (first || wrap.querySelector('.modal__close')).focus();
        if (o.onOpen) o.onOpen(wrap);
      });
    },
    // 破壊的な操作の確認（キャンセルを左、実行を右・警告色）
    confirm: function (o) {
      return ui.modal({ title: o.title, html: o.body ? '<p>' + esc(o.body) + '</p>' : '', actions: [{ label: o.cancel || 'やめる', value: false, kind: 'outline' }, { label: o.ok || 'OK', value: true, kind: o.danger ? 'danger' : 'black' }] });
    },
    // ログインが必要なページの頭で呼ぶ。未ログインならログインへ送って false
    requireLogin: function () {
      if (db().currentUser()) return true;
      location.replace(url('login', { next: location.pathname.split('/').pop() + location.search }));
      return false;
    },
    // 通報モーダル（理由は必須）
    report: function (type, targetId) {
      if (!db().currentUser()) { location.href = url('login', { next: location.pathname.split('/').pop() + location.search }); return; }
      var L = window.NMT.LABEL.ReportReason;
      return ui.modal({
        title: type === 'EVENT' ? 'このイベントを通報する' : 'このページを通報する',
        html: '<div class="stack"><p class="t-small t-muted">通報は NMJ 運営だけが見ます。主催者に通報者は伝わりません。</p>' +
          '<fieldset class="stack" style="border:0;padding:0;margin:0;--stack-gap:10px"><legend class="field__label">理由 <span class="req">必須</span></legend>' +
          Object.keys(L).map(function (k) { return '<label class="check"><input type="radio" name="reason" value="' + k + '">' + esc(L[k]) + '</label>'; }).join('') + '</fieldset>' +
          '<label class="field"><span class="field__label">詳しく（「その他」は必須）</span><textarea class="textarea" name="detail" maxlength="1000"></textarea></label><p class="field__error" hidden data-err></p></div>',
        actions: [{ label: 'やめる', value: false, kind: 'outline' }, { label: '通報する', kind: 'black', onClick: function (w) {
          var r = w.querySelector('input[name=reason]:checked');
          var err = w.querySelector('[data-err]');
          if (!r) { err.textContent = '理由を選んでください'; err.hidden = false; return false; }
          try { db().report(type, targetId, r.value, w.querySelector('textarea').value); }
          catch (e2) { err.textContent = e2.message; err.hidden = false; return false; }
        } }]
      }).then(function (v) { if (v) ui.toast('通報を受け付けました。運営が確認します'); return v; });
    },
    // リンクのコピー（10/8：シェアはリンクのコピーだけ）
    copyLink: function (href) {
      var text = href || location.href;
      var done = function () { ui.toast('リンクをコピーしました'); };
      var failMsg = function () { ui.toast('コピーできませんでした'); };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, failMsg); else failMsg();
    },
    // QR 風の図柄（token から決まる。プロトタイプでは読み取りを checkin.html の入力で代える）
    qr: function (token, size) {
      size = size || 29;
      var cells = [], h = 2166136261;
      for (var i = 0; i < size * size; i++) { h = Math.imul(h ^ token.charCodeAt(i % token.length) ^ i, 16777619); cells.push((h >>> 13) & 1); }
      function finder(x0, y0) {
        for (var y = 0; y < 7; y++) for (var x = 0; x < 7; x++) {
          var edge = x === 0 || y === 0 || x === 6 || y === 6, core = x >= 2 && x <= 4 && y >= 2 && y <= 4;
          cells[(y0 + y) * size + x0 + x] = edge || core ? 1 : 0;
        }
        for (var k = -1; k <= 7; k++) [[x0 + k, y0 - 1], [x0 + k, y0 + 7], [x0 - 1, y0 + k], [x0 + 7, y0 + k]].forEach(function (p) {
          if (p[0] >= 0 && p[1] >= 0 && p[0] < size && p[1] < size) cells[p[1] * size + p[0]] = 0;
        });
      }
      finder(0, 0); finder(size - 7, 0); finder(0, size - 7);
      var rects = '';
      cells.forEach(function (c, i) { if (c) rects += '<rect x="' + (i % size) + '" y="' + Math.floor(i / size) + '" width="1" height="1"/>'; });
      return '<svg viewBox="0 0 ' + size + ' ' + size + '" role="img" aria-label="QR コード" shape-rendering="crispEdges"><g fill="#000">' + rects + '</g></svg>';
    }
  };

  // ---------- 起動 ----------
  var readyFns = [], started = false;
  function render() {
    var hs = document.querySelectorAll('[data-header]');
    for (var i = 0; i < hs.length; i++) {
      var el = hs[i];
      var type = el.getAttribute('data-header') || 'default';
      var active = el.getAttribute('data-active') || '';
      el.outerHTML = type === 'v2' ? headerV2(active || 'events') : type === 'org' ? headerOrg(active || 'dashboard') : headerDefault();
    }
    var fs = document.querySelectorAll('[data-footer]');
    for (var j = 0; j < fs.length; j++) fs[j].outerHTML = footer();
    var sw = document.querySelector('[data-org-switcher]');
    if (sw) {
      var menu = document.querySelector('[data-org-menu]');
      sw.addEventListener('click', function (ev) { ev.stopPropagation(); menu.hidden = !menu.hidden; sw.setAttribute('aria-expanded', String(!menu.hidden)); });
      document.addEventListener('click', function () { menu.hidden = true; sw.setAttribute('aria-expanded', 'false'); });
    }
    demoBar();
    started = true;
    readyFns.forEach(function (fn) { run(fn); });
  }
  function run(fn) {
    try { fn(db(), ui); } catch (err) { console.error(err); ui.toast(err.message || String(err)); }
  }

  window.NMT = window.NMT || {};
  window.NMT.pages = PAGES;
  window.NMT.ui = ui;
  window.NMT.currentOrg = currentOrg;
  // 別のタブで変わったら読み直す（古い状態のまま書き込まないため。画面は次の操作か再読み込みで新しくなる）
  window.addEventListener('storage', function (ev) {
    if (ev.key !== (window.NMT.data && window.NMT.data.KEY) || !db()) return;
    if (!db().sync()) return;
    // 別のタブでログインし直したら、この画面は前の人のままなので読み直す
    if (db().tabUserChanged()) { location.reload(); return; }
    ui.toast('別のタブでの変更を読み込みました');
  });
  window.NMT.ready = function (fn) { if (started) run(fn); else readyFns.push(fn); };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', render);
  else render();
})();
