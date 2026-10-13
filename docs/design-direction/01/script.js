(() => {
  'use strict';
  const views = [...document.querySelectorAll('.view')];
  const tabs = [...document.querySelectorAll('[data-view]')];
  const homeTargets = new Set(['about', 'projects', 'events', 'people', 'connect']);
  const menu = document.querySelector('.menu-toggle');
  const nav = document.querySelector('#home-nav');
  function closeMenu() {
    nav.classList.remove('open');
    menu.setAttribute('aria-expanded', 'false');
    menu.querySelector('span').textContent = '＋';
  }
  function route() {
    const target = location.hash.slice(1) || 'home';
    const view = homeTargets.has(target) ? 'home' : views.some(v => v.id === target) ? target : 'home';
    views.forEach(v => { v.hidden = v.id !== view; });
    tabs.forEach(tab => {
      const active = tab.dataset.view === view;
      tab.classList.toggle('active', active);
      if (active) tab.setAttribute('aria-current', 'page');
      else tab.removeAttribute('aria-current');
    });
    closeMenu();
    if (homeTargets.has(target)) {
      requestAnimationFrame(() => document.getElementById(target).scrollIntoView({ block: 'start' }));
    } else {
      window.scrollTo({ top: 0, behavior: 'instant' });
    }
    const titles = { home: 'HOME SAMPLE', concept: 'DESIGN CONCEPT', palette: 'COLOR PALETTE', type: 'TYPOGRAPHY', ui: 'UI ELEMENTS', event: 'EVENT DETAIL' };
    document.title = `${titles[view]} — NMJ トンマナ提案 01`;
  }
  window.addEventListener('hashchange', route);
  menu.addEventListener('click', () => {
    const opened = menu.getAttribute('aria-expanded') !== 'true';
    menu.setAttribute('aria-expanded', String(opened));
    nav.classList.toggle('open', opened);
    menu.querySelector('span').textContent = opened ? '−' : '＋';
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeMenu(); });
  const dialog = document.querySelector('#sample-dialog');
  function showDialog(title, body, label = 'DESIGN SAMPLE') {
    document.querySelector('#dialog-title').textContent = title;
    document.querySelector('#dialog-body').textContent = body;
    document.querySelector('#dialog-label').textContent = label;
    dialog.showModal();
  }
  dialog.querySelectorAll('.dialog-close, .dialog-done').forEach(b => b.addEventListener('click', () => dialog.close()));
  dialog.addEventListener('click', e => { if (e.target === dialog) {
    const rect = dialog.getBoundingClientRect();
    if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) dialog.close();
  }});
  const projects = [
    ['まちの未来を、次の世代と。', '若者・行政・地域が同じテーブルにつき、身近な課題から小さな実験を始める共創プロジェクト。地域リサーチ、対話、実証へとつなぐ活動を想定しています。掲載内容はデザイン検討用の架空サンプルです。'],
    ['その境界を、越えていこう。', '若者の問いと企業の経験を持ち寄り、新しい挑戦をつくるプロジェクト。世代や所属を越えたチームで、次のアイデアを試します。掲載内容はデザイン検討用の架空サンプルです。']
  ];
  document.querySelectorAll('[data-project]').forEach(a => a.addEventListener('click', e => {
    e.preventDefault();
    showDialog(...projects[Number(a.dataset.project)], 'PROJECT / SAMPLE');
  }));
  document.querySelector('[data-people]').addEventListener('click', e => {
    e.preventDefault();
    showDialog('違う視点があるから、一緒にやってみたくなる。', '若者、企業、行政、地域。それぞれの立場から見える景色を持ち寄ることで、一人では見つからなかった可能性が生まれる。共創の現場で出会う人々の声を届ける、メディア記事のサンプルです。', 'PEOPLE / MEDIA SAMPLE');
  });
  document.querySelector('[data-contact]').addEventListener('click', () => showDialog('次のMOVEを、一緒につくろう。', '企業・行政・地域とNMJの共創相談につながる導線のサンプルです。本提案では問い合わせは送信されません。', 'CO-CREATION / SAMPLE'));
  document.querySelector('[data-register]').addEventListener('click', () => showDialog('参加申し込みの導線', 'ここから、参加者情報の入力 → 内容確認 → 申し込み完了へつながる想定です。このイベントは架空のサンプルのため、申し込みや個人情報の送信は行われません。', 'EVENT ENTRY / SAMPLE'));
  const save = document.querySelector('.save-button');
  save.addEventListener('click', () => {
    const saved = save.getAttribute('aria-pressed') !== 'true';
    save.setAttribute('aria-pressed', String(saved));
    save.textContent = saved ? '✓ 保存しました（この画面内のみ）' : '＋ 気になるイベントに保存';
  });
  document.querySelectorAll('[data-demo]').forEach(b => b.addEventListener('click', () => {
    document.querySelector('#ui-feedback').textContent = b.dataset.demo;
  }));
  route();
})();
