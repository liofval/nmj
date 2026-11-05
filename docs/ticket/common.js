/* NEXT MOVE TICKETS — 共通ヘッダー／フッターの差し込み
   fetch を使わないので file:// で直接開いても動く。
   使い方:
     <div data-header="default"></div>                       … Top 用（Header）
     <div data-header="v2" data-active="events"></div>       … 下層ページ用（Header v2）active: home | events | media
     <div data-header="org" data-active="dashboard" data-org="慶應軽音サークル"></div>
                                                             … 主催者用（Header Org）active: dashboard | events | settings
     <div data-footer></div>                                 … Footer v2
   <script src="common.js" defer></script> を </body> 直前か <head> に置く。 */
(function () {
  'use strict';

  // ページのファイル名割り当て（BASE.md と同じ）。未作成ページは '#'
  var PAGES = {
    top: 'index.html',
    events: 'events.html',
    eventsList: 'events-list.html',
    calendar: 'calendar.html',
    media: 'media.html',
    article: 'article.html',
    organizer: 'organizer.html',
    mypage: 'mypage.html',
    dashboard: 'dashboard.html',
    eventCreate: 'event-create.html'
  };

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function headerDefault() {
    return '' +
      '<header class="header">' +
        '<div class="wrap header__inner">' +
          '<a class="header__logo" href="' + PAGES.top + '">NEXT MOVE TICKETS</a>' +
          '<nav class="header__nav" aria-label="メイン">' +
            '<a href="' + PAGES.events + '">イベント</a>' +
            '<a href="' + PAGES.organizer + '">主催者の方へ</a>' +
            '<a href="#">ガイド</a>' +
            '<a href="#">ニュース</a>' +
          '</nav>' +
          '<div class="header__right">' +
            '<a href="#" aria-label="検索"><img class="icon" src="assets/icon-search.svg" alt=""></a>' +
            '<a class="mytickets" href="' + PAGES.mypage + '">My Tickets</a>' +
          '</div>' +
        '</div>' +
      '</header>';
  }

  function headerV2(active) {
    var tabs = [
      ['home', 'ホーム', PAGES.top],
      ['events', 'イベント', PAGES.events],
      ['media', 'メディア', PAGES.media]
    ];
    var tabHtml = tabs.map(function (t) {
      var on = t[0] === active;
      return '<a class="header-v2__tab' + (on ? ' is-active' : '') + '" href="' + t[2] + '"' +
        (on ? ' aria-current="page"' : '') + '>' + t[1] + '</a>';
    }).join('');
    return '' +
      '<header class="header-v2">' +
        '<div class="wrap header-v2__inner">' +
          '<div class="header-v2__left">' +
            '<a class="header-v2__logo" href="' + PAGES.top + '">NEXT MOVE</a>' +
            '<nav class="header-v2__tabs" aria-label="メイン">' + tabHtml + '</nav>' +
          '</div>' +
          '<div class="header-v2__right">' +
            '<a href="#" aria-label="検索"><img class="icon" src="assets/icon-search.svg" alt=""></a>' +
            '<a class="mytickets" href="' + PAGES.mypage + '">My Tickets</a>' +
            '<a href="' + PAGES.mypage + '" aria-label="マイページ"><img class="avatar" src="assets/avatar.svg" alt=""></a>' +
          '</div>' +
        '</div>' +
      '</header>';
  }

  function headerOrg(active, org) {
    var nav = [
      ['dashboard', 'ダッシュボード', PAGES.dashboard],
      ['events', 'イベント', '#'],
      ['settings', '設定', '#']
    ];
    var navHtml = nav.map(function (n) {
      var on = n[0] === active;
      return '<a class="' + (on ? 'is-active' : '') + '" href="' + n[2] + '"' +
        (on ? ' aria-current="page"' : '') + '>' + n[1] + '</a>';
    }).join('');
    return '' +
      '<header class="header-org">' +
        '<div class="wrap header-org__inner">' +
          '<div class="header-org__left">' +
            '<a class="header-org__logo" href="' + PAGES.dashboard + '">NEXT MOVE</a>' +
            '<span class="header-org__badge">主催者</span>' +
            '<button class="org-switcher" type="button" aria-label="団体を切り替える">' +
              '<span class="org-switcher__swatch"></span>' +
              '<span class="org-switcher__name">' + esc(org) + '</span>' +
              '<span class="org-switcher__caret" aria-hidden="true">▼</span>' +
            '</button>' +
            '<nav class="header-org__nav" aria-label="主催者メニュー">' + navHtml + '</nav>' +
          '</div>' +
          '<a class="header-org__switch" href="' + PAGES.top + '">参加者側へ →</a>' +
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
              col('Find', [['イベント', PAGES.events], ['カテゴリ', '#'], ['エリア', '#']]) +
              col('Host', [['主催者の方へ', PAGES.organizer], ['掲載の流れ', '#'], ['手数料', '#']]) +
              col('Help', [['ガイド', '#'], ['よくある質問', '#'], ['お問い合わせ', '#']]) +
            '</div>' +
          '</div>' +
          '<p class="footer__mark" aria-hidden="true">NEXT MOVE</p>' +
          '<div class="footer__bottom">' +
            '<p class="t-mono-body">© 2026 NEXT MOVE JAPAN</p>' +
            '<nav class="footer__legal" aria-label="規約">' +
              '<a href="#">利用規約</a><a href="#">プライバシー</a><a href="#">特定商取引法に基づく表記</a>' +
            '</nav>' +
          '</div>' +
        '</div>' +
      '</footer>';
  }

  function render() {
    var hs = document.querySelectorAll('[data-header]');
    for (var i = 0; i < hs.length; i++) {
      var el = hs[i];
      var type = el.getAttribute('data-header') || 'default';
      var active = el.getAttribute('data-active') || '';
      var html = type === 'v2' ? headerV2(active || 'events')
        : type === 'org' ? headerOrg(active || 'dashboard', el.getAttribute('data-org') || '慶應軽音サークル')
        : headerDefault();
      el.outerHTML = html;
    }
    var fs = document.querySelectorAll('[data-footer]');
    for (var j = 0; j < fs.length; j++) fs[j].outerHTML = footer();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', render);
  else render();

  window.NMT = { pages: PAGES };
})();
